import { authService } from '../services/authService.js';
import { destroyCurrentAuthSession, ensureCsrfSession, replaceAuthSession, saveSession } from '../services/authSessionService.js';
import { ValidationError } from '../utils/httpErrors.js';
import { accountDeletionService } from '../services/accountDeletionService.js';

function assertBody(request, allowedFields) {
  const body = request.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('The request body must be an object.');
  const unknown = Object.keys(body).filter((key) => !allowedFields.includes(key));
  if (unknown.length) throw new ValidationError('The request contains unsupported fields.', unknown.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
}

function authenticatedResponse(response) {
  response.setHeader('Cache-Control', 'no-store');
}

export function createAuthController({ service = authService, deletionService = accountDeletionService } = {}) {
  return Object.freeze({
    async csrf(request, response) {
      const csrfToken = await ensureCsrfSession(request);
      response.setHeader('Cache-Control', 'no-store');
      response.status(200).json({ csrfToken });
    },

    async capabilities(_request, response) {
      response.setHeader('Cache-Control', 'no-store');
      response.status(200).json({ capabilities: await service.capabilities() });
    },

    async usernameAvailability(request, response) {
      const unknown = Object.keys(request.query || {}).filter((key) => key !== 'username');
      if (unknown.length) throw new ValidationError('The request contains unsupported query fields.', unknown.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
      response.setHeader('Cache-Control', 'no-store');
      response.status(200).json(await service.usernameAvailability(request.query?.username, request.ip));
    },

    async me(request, response) {
      const member = await service.currentMember(request.authMember);
      authenticatedResponse(response);
      response.status(200).json({ authenticated: Boolean(member), member });
    },

    async signup(request, response) {
      assertBody(request, ['firstName', 'middleName', 'lastName', 'username', 'email', 'password', 'confirmPassword', 'termsAccepted']);
      const result = await service.signup({ ...request.body, ip: request.ip });
      await replaceAuthSession({ request, response, user: result.sessionUser });
      response.setHeader('Cache-Control', 'no-store');
      response.status(201).json({
        authenticated: true,
        member: result.member,
        recoveryCodes: result.recoveryCodes,
        requiresScheduleSetup: result.requiresScheduleSetup,
      });
    },

    async login(request, response) {
      assertBody(request, ['identifier', 'email', 'password']);
      const result = request.authLoginResult;
      if (!result?.sessionUser || !result?.member) throw new ValidationError('The sign-in request was not authenticated.');
      await replaceAuthSession({ request, response, user: result.sessionUser });
      authenticatedResponse(response);
      response.status(200).json({ authenticated: true, member: result.member });
    },

    async logout(request, response) {
      await destroyCurrentAuthSession(request, response);
      response.status(200).json({ authenticated: false, message: 'Signed out.' });
    },

    async accountDeletionStatus(request, response) {
      response.setHeader('Cache-Control', 'no-store');
      const result = await deletionService.status({
        userId: request.user.id,
        authorization: request.session?.googleAccountDeletionAuthorization,
      });
      response.status(200).json(result);
    },

    async deleteAccount(request, response) {
      assertBody(request, ['confirmationPhrase', 'currentPassword']);
      const result = await deletionService.deleteAccount({
        userId: request.user.id,
        ip: request.ip,
        confirmationPhrase: request.body.confirmationPhrase,
        currentPassword: request.body.currentPassword,
        authorization: request.session?.googleAccountDeletionAuthorization,
      });
      // Data deletion is already committed atomically. Even if session-store
      // cleanup reports an error, the missing User record makes every old
      // Passport session fail closed. The exact cookie is still cleared.
      try {
        await destroyCurrentAuthSession(request, response);
      } catch (error) {
        console.error('[account-deletion-session-cleanup]', JSON.stringify({ errorName: error?.name || 'Error', code: error?.code || null }));
      }
      response.setHeader('Cache-Control', 'no-store');
      response.status(200).json(result);
    },

    async googlePending(request, response) {
      const pending = request.session?.pendingGoogleRegistration;
      const available = Boolean(pending && Number(pending.expiresAt) > Date.now());
      response.setHeader('Cache-Control', 'no-store');
      response.status(200).json({
        pending: available,
        profile: available ? { email: pending.email, firstName: pending.firstName || '', middleName: '', lastName: pending.lastName || '' } : null,
      });
    },

    async completeGoogleSignup(request, response) {
      assertBody(request, ['firstName', 'middleName', 'lastName', 'username', 'termsAccepted']);
      const result = await service.completeGoogleSignup({
        ...request.body,
        pendingRegistration: request.session?.pendingGoogleRegistration,
        ip: request.ip,
      });
      if (request.session) {
        delete request.session.pendingGoogleRegistration;
        delete request.session.pendingGoogleReturnTo;
      }
      await replaceAuthSession({ request, response, user: result.sessionUser });
      authenticatedResponse(response);
      response.status(201).json({ authenticated: true, member: result.member, requiresScheduleSetup: true });
    },

    async resetPassword(request, response) {
      assertBody(request, ['identifier', 'code', 'newPassword', 'confirmPassword']);
      const result = await service.resetPassword({ ...request.body, ip: request.ip });
      authenticatedResponse(response);
      response.status(200).json(result);
    },

    async regenerateRecoveryCodes(request, response) {
      assertBody(request, ['currentPassword']);
      const result = await service.regenerateRecoveryCodes({ userId: request.user.id, ...request.body, ip: request.ip });
      authenticatedResponse(response);
      response.status(200).json({ recoveryCodes: result.recoveryCodes });
    },

    async changePassword(request, response) {
      assertBody(request, ['currentPassword', 'newPassword', 'confirmPassword']);
      const result = await service.changePassword({ ...request.body, userId: request.user.id, ip: request.ip });
      await replaceAuthSession({ request, response, user: result.sessionUser });
      authenticatedResponse(response);
      response.status(200).json({ member: result.member, message: result.message });
    },

    async updateIdentity(request, response) {
      assertBody(request, ['username', 'firstName', 'middleName', 'lastName']);
      const result = await service.updateIdentity({ ...request.body, userId: request.user.id });
      authenticatedResponse(response);
      response.status(200).json({ member: result.member });
    },
  });
}

export const authController = createAuthController();
