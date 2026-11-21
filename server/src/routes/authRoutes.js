import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { passportInstance } from '../config/passport.js';
import { config } from '../config/env.js';
import { authController } from '../controllers/authController.js';
import { accountDeletionService } from '../services/accountDeletionService.js';
import { requireAuthenticatedUser } from '../middleware/requireAuthenticatedUser.js';
import { replaceAuthSession, saveSession } from '../services/authSessionService.js';
import { HttpError, UnauthorizedError, ValidationError } from '../utils/httpErrors.js';

const asyncHandler = (handler) => (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);

function assertBody(request, allowedFields) {
  const body = request.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('The request body must be an object.');
  const unknown = Object.keys(body).filter((key) => !allowedFields.includes(key));
  if (unknown.length) throw new ValidationError('The request contains unsupported fields.', unknown.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
}

function localAuthentication(passport) {
  return (request, response, next) => {
    try {
      assertBody(request, ['identifier', 'email', 'password']);
      request.body.identifier ??= request.body.email;
    } catch (error) {
      return next(error);
    }

    return passport.authenticate('local', { session: false }, (error, user, info) => {
      if (error) return next(error);
      if (!user) return next(new UnauthorizedError());
      request.authLoginResult = info?.authResult;
      return next();
    })(request, response, next);
  };
}

function safeAuthenticatedDestination(candidate, settings = config) {
  const base = settings.appBaseUrl || 'http://localhost:5175';
  if (typeof candidate !== 'string' || !candidate.startsWith('/app')
    || candidate.startsWith('//') || candidate.includes('\\') || /[\u0000-\u001f]/.test(candidate)) {
    return '/app/dashboard';
  }
  try {
    const target = new URL(candidate, base);
    if (target.origin !== new URL(base).origin
      || (target.pathname !== '/app' && !target.pathname.startsWith('/app/'))) return '/app/dashboard';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/app/dashboard';
  }
}

function safeAuthRedirect(path, oauth = '', returnTo) {
  const target = new URL(path, config.appBaseUrl || 'http://localhost:5175');
  if (oauth) target.searchParams.set('oauth', oauth);
  if (returnTo) target.searchParams.set('returnTo', safeAuthenticatedDestination(returnTo));
  return target.toString();
}

async function completeGoogleCallback({ request, response, next, passport }) {
  const returnTo = safeAuthenticatedDestination(request.session?.googleAuthReturnTo);
  delete request.session?.googleAuthReturnTo;
  passport.authenticate('google', { session: false }, async (error, user, info) => {
    try {
      if (error) {
        if (error.code === 'ACCOUNT_METHOD_CONFLICT' || error.code === 'EMAIL_ALREADY_EXISTS') {
          return response.redirect(safeAuthRedirect('/login', 'provider-conflict', returnTo));
        }
        if (error.status === 503) return response.redirect(safeAuthRedirect('/login', 'unavailable', returnTo));
        return next(error);
      }

      if (info?.googlePending?.pendingRegistration) {
        await new Promise((resolve, reject) => request.session.regenerate((sessionError) => sessionError ? reject(sessionError) : resolve()));
        request.session.pendingGoogleRegistration = info.googlePending.pendingRegistration;
        request.session.pendingGoogleReturnTo = returnTo;
        request.session.csrfToken = randomBytes(32).toString('base64url');
        await saveSession(request);
        return response.redirect(safeAuthRedirect('/google-complete', '', returnTo));
      }

      if (!user) return response.redirect(safeAuthRedirect('/login', 'failed', returnTo));
      const result = info?.authResult;
      if (!result?.sessionUser) throw new HttpError(401, 'GOOGLE_SIGN_IN_FAILED', 'Google sign-in could not be completed. Try again.');
      await replaceAuthSession({ request, response, user: result.sessionUser });
      return response.redirect(safeAuthRedirect(returnTo));
    } catch (callbackError) {
      return next(callbackError);
    }
  })(request, response, next);
}

function deletionSettingsRedirect(status) {
  const target = new URL('/app/settings', config.appBaseUrl || 'http://localhost:5175');
  target.searchParams.set('category', 'security');
  target.searchParams.set('accountDeletion', status);
  return target.toString();
}

function completeGoogleDeletionCallback({ request, response, next, passport, deletionService }) {
  passport.authenticate('google-delete-reauth', { session: false }, async (error, profile) => {
    const intent = request.session?.googleDeletionIntent;
    try {
      if (error || !profile || !intent || !request.user?.id || String(request.user.id) !== intent.userId) {
        delete request.session.googleDeletionIntent;
        delete request.session.googleAccountDeletionAuthorization;
        await saveSession(request);
        return response.redirect(deletionSettingsRedirect('reauth-failed'));
      }
      const authorization = await deletionService.finishGoogleReauthentication({
        userId: request.user.id,
        intent,
        googleSub: typeof profile.id === 'string' ? profile.id : '',
      });
      delete request.session.googleDeletionIntent;
      request.session.googleAccountDeletionAuthorization = authorization;
      await saveSession(request);
      return response.redirect(deletionSettingsRedirect('verified'));
    } catch {
      delete request.session.googleDeletionIntent;
      delete request.session.googleAccountDeletionAuthorization;
      try { await saveSession(request); } catch { /* The existing account session remains fail-closed. */ }
      return response.redirect(deletionSettingsRedirect('reauth-failed'));
    }
  })(request, response, next);
}

export function createAuthRouter({
  controller = authController,
  identityMiddleware = requireAuthenticatedUser,
  passport = passportInstance,
  settings = config,
  deletionService = accountDeletionService,
} = {}) {
  const router = Router();
  router.get('/auth/csrf', asyncHandler(controller.csrf));
  router.get('/auth/capabilities', asyncHandler(controller.capabilities));
  router.get('/auth/username-availability', asyncHandler(controller.usernameAvailability));
  router.get('/auth/me', asyncHandler(controller.me));
  router.post('/auth/signup', asyncHandler(controller.signup));
  router.post('/auth/login', localAuthentication(passport), asyncHandler(controller.login));
  router.post('/auth/logout', asyncHandler(controller.logout));
  router.get('/auth/account/deletion/status', identityMiddleware, asyncHandler(controller.accountDeletionStatus));
  router.post('/auth/account/delete', identityMiddleware, asyncHandler(controller.deleteAccount));
  router.get('/auth/account/google-deletion/reauth', identityMiddleware, asyncHandler(async (request, response, next) => {
    if (!settings.googleOAuthEnabled) return response.status(503).json({
      error: { code: 'GOOGLE_SIGN_IN_UNAVAILABLE', message: 'Google re-authentication is not configured on this deployment.' },
    });
    const intent = await deletionService.beginGoogleReauthentication({ userId: request.user.id, ip: request.ip });
    delete request.session.googleAccountDeletionAuthorization;
    request.session.googleDeletionIntent = intent;
    await saveSession(request);
    return passport.authenticate('google-delete-reauth', {
      scope: ['profile', 'email'],
      prompt: 'select_account',
    })(request, response, next);
  }));
  router.get('/auth/google/pending', asyncHandler(controller.googlePending));
  router.post('/auth/google/complete', asyncHandler(controller.completeGoogleSignup));
  router.post('/auth/reset-password', asyncHandler(controller.resetPassword));
  router.post('/auth/recovery-codes/regenerate', identityMiddleware, asyncHandler(controller.regenerateRecoveryCodes));
  router.post('/auth/change-password', identityMiddleware, asyncHandler(controller.changePassword));
  router.patch('/auth/profile', identityMiddleware, asyncHandler(controller.updateIdentity));

  if (settings.googleOAuthEnabled) {
    router.get('/auth/google', asyncHandler(async (request, response, next) => {
      request.session.googleAuthReturnTo = safeAuthenticatedDestination(request.query?.returnTo, settings);
      await saveSession(request);
      return passport.authenticate('google', { scope: ['profile', 'email'] })(request, response, next);
    }));
    router.get('/auth/google/callback', (request, response, next) => {
      if (request.session?.googleDeletionIntent) {
        completeGoogleDeletionCallback({ request, response, next, passport, deletionService });
      } else {
        void completeGoogleCallback({ request, response, next, passport });
      }
    });
  } else {
    const unavailable = (_request, response) => response.status(503).json({
      error: { code: 'GOOGLE_SIGN_IN_UNAVAILABLE', message: 'Google Sign-In is not configured on this deployment.' },
    });
    router.get('/auth/google', unavailable);
    router.get('/auth/google/callback', unavailable);
  }

  return router;
}
