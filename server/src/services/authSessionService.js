import session from 'express-session';
import MongoStore from 'connect-mongo';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import User from '../models/User.js';
import { config } from '../config/env.js';
import { ServiceUnavailableError } from '../utils/httpErrors.js';

export const AUTH_SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
export const AUTH_SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = Math.floor(AUTH_SESSION_ABSOLUTE_MS / 1000);
const developmentSecret = randomBytes(48).toString('base64url');
let sharedMongoSessionStore;

function digest(value) {
  return createHash('sha256').update(String(value)).digest();
}

function tokenMatches(expected, supplied) {
  if (typeof expected !== 'string' || typeof supplied !== 'string' || supplied.length > 256) return false;
  return timingSafeEqual(digest(expected), digest(supplied));
}

function callSessionMethod(sessionObject, method) {
  return new Promise((resolve, reject) => sessionObject[method]((error) => error ? reject(error) : resolve()));
}

export function createExpressSessionMiddleware({
  nodeEnv = config.nodeEnv,
  sessionSecret = config.authSessionSecret,
  mongoUri = config.mongoUri,
  store: providedStore,
} = {}) {
  if (!providedStore && nodeEnv !== 'test' && !sharedMongoSessionStore) {
    sharedMongoSessionStore = MongoStore.create({
      mongoUrl: mongoUri,
      collectionName: 'sessions',
      ttl: SESSION_TTL_SECONDS,
      autoRemove: 'native',
    });
  }
  const store = providedStore || (nodeEnv === 'test' ? undefined : sharedMongoSessionStore);
  const secret = sessionSecret || (nodeEnv === 'production' ? undefined : developmentSecret);
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('AUTH_SESSION_SECRET must contain at least 32 bytes.');

  const middleware = session({
    name: config.authSessionCookieName,
    secret,
    ...(store ? { store } : {}),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: nodeEnv === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: AUTH_SESSION_IDLE_MS,
    },
  });
  store?.on?.('error', (error) => {
    console.error('[auth-session-store]', JSON.stringify({ name: error?.name || 'Error', code: error?.code || null }));
  });
  return middleware;
}

export async function saveSession(request) {
  if (!request.session) throw new ServiceUnavailableError('The authentication session is unavailable.');
  await callSessionMethod(request.session, 'save');
}

export async function replaceAuthSession({ request, response, user, now = new Date() }) {
  if (!user?._id) throw new TypeError('A verified account is required to create an authenticated session.');
  if (!request.session) throw new ServiceUnavailableError('The authentication session is unavailable.');
  if (typeof request.logIn !== 'function') throw new ServiceUnavailableError('Passport authentication is unavailable.');
  await new Promise((resolve, reject) => request.logIn(user, { session: true }, (error) => error ? reject(error) : resolve()));
  request.session.auth = {
    userId: String(user._id),
    authVersion: Number.isInteger(user.authVersion) ? user.authVersion : 0,
    issuedAt: now.getTime(),
  };
  request.session.csrfToken = randomBytes(32).toString('base64url');
  await saveSession(request);
  request.user = Object.freeze({ id: String(user._id), identityKind: 'account' });
  request.authMember = user;
  request.authSession = { authenticated: true, csrfToken: request.session.csrfToken || null };
  response.setHeader('Cache-Control', 'no-store');
}

export async function destroyCurrentAuthSession(request, response) {
  const hadAuthenticatedUser = Boolean(request.user);
  const hadSession = Boolean(request.session);
  let logoutError;
  let destroyError;
  try {
    if (typeof request.logout === 'function' && request.user) {
      await new Promise((resolve, reject) => request.logout((error) => error ? reject(error) : resolve()));
    }
  } catch (error) {
    logoutError = error;
  }
  try {
    if (request.session) await callSessionMethod(request.session, 'destroy');
  } catch (error) {
    destroyError = error;
  } finally {
    // Keep these options aligned with the session middleware. No unrelated
    // browser cookies are touched.
    response.clearCookie(config.authSessionCookieName, {
      path: '/', httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax',
    });
    request.authSession = null;
    request.authMember = null;
    request.user = undefined;
    response.setHeader('Cache-Control', 'no-store');
  }
  // The session store is the source of truth. Passport's callback may report
  // that it could not remove its user field after the store has already failed
  // or gone away; a successful session destroy still makes the old cookie
  // unusable. Only fail the request when the session itself could not be
  // destroyed (or when an authenticated request unexpectedly had no session).
  if (destroyError) throw destroyError;
  if (logoutError && hadAuthenticatedUser && !hadSession) throw logoutError;
}

export async function ensureCsrfSession(request) {
  if (!request.session) throw new ServiceUnavailableError('The authentication session is unavailable.');
  if (typeof request.session.csrfToken !== 'string') {
    request.session.csrfToken = randomBytes(32).toString('base64url');
    await saveSession(request);
  }
  return request.session.csrfToken;
}

export function createAuthSessionMiddleware({ now = () => new Date() } = {}) {
  return async function resolveAuthenticatedMember(request, response, next) {
    request.authSession = null;
    request.authMember = null;
    const sessionAuth = request.session?.auth;
    const passportUser = request.user;
    if (!sessionAuth?.userId) {
      request.authSession = request.session ? { authenticated: false, csrfToken: request.session.csrfToken || null } : null;
      return next();
    }

    try {
      if (!passportUser?.id || String(passportUser.id) !== String(sessionAuth.userId)) {
        await callSessionMethod(request.session, 'destroy');
        response.clearCookie(config.authSessionCookieName, { path: '/', httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax' });
        request.user = undefined;
        request.authSession = null;
        return next();
      }
      const issuedAt = Number(sessionAuth.issuedAt);
      if (!Number.isFinite(issuedAt) || now().getTime() - issuedAt > AUTH_SESSION_ABSOLUTE_MS) {
        await callSessionMethod(request.session, 'destroy');
        response.clearCookie(config.authSessionCookieName, { path: '/', httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax' });
        request.user = undefined;
        request.authMember = null;
        return next();
      }
      const user = passportUser;
      if (!user || user.accountStatus !== 'active' || (user.authVersion || 0) !== sessionAuth.authVersion) {
        await callSessionMethod(request.session, 'destroy');
        response.clearCookie(config.authSessionCookieName, { path: '/', httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax' });
        request.user = undefined;
        request.authMember = null;
        request.authSession = null;
        return next();
      }
      request.user = Object.freeze({ id: String(user._id || user.id), identityKind: 'account' });
      request.authMember = user;
      request.authSession = {
        authenticated: true,
        csrfToken: request.session.csrfToken || null,
      };
      response.setHeader('Cache-Control', 'no-store');
      return next();
    } catch {
      return next(new ServiceUnavailableError('Session verification is temporarily unavailable.'));
    }
  };
}

export const createAuthIdentityMiddleware = createAuthSessionMiddleware;

export const sessionSecurity = Object.freeze({
  idleTimeoutMs: AUTH_SESSION_IDLE_MS,
  absoluteLifetimeMs: AUTH_SESSION_ABSOLUTE_MS,
  cookieName: config.authSessionCookieName,
  csrfTokenMatches: tokenMatches,
});
