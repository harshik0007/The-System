import { config } from '../config/env.js';
import { sessionSecurity } from '../services/authSessionService.js';
import { HttpError } from '../utils/httpErrors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function requestOrigin(request) {
  const origin = request.get?.('Origin') || request.headers?.origin;
  if (typeof origin === 'string') return origin;
  const referer = request.get?.('Referer') || request.headers?.referer;
  if (!referer) return '';
  try { return new URL(referer).origin; } catch { return ''; }
}

function hasSessionCookie(request) {
  const cookieHeader = request.headers?.cookie;
  if (typeof cookieHeader !== 'string') return false;
  const cookiePrefix = `${config.authSessionCookieName}=`;
  return cookieHeader.split(';').some((cookie) => cookie.trim().startsWith(cookiePrefix));
}

function logCsrfRejection(request, category, { originPresent = false, csrfHeaderPresent = false } = {}) {
  // Keep this diagnostic useful for request-ID lookups without recording
  // origins, cookies, session IDs, CSRF values, or request bodies.
  console.warn('[csrf-rejected]', JSON.stringify({
    requestId: request.requestId || 'unknown',
    method: request.method || 'UNKNOWN',
    path: request.path || 'unknown',
    category,
    originPresent,
    sessionCookiePresent: hasSessionCookie(request),
    sessionTokenPresent: typeof request.session?.csrfToken === 'string',
    csrfHeaderPresent,
    requestSecure: Boolean(request.secure),
    forwardedProtoHttps: String(request.get?.('X-Forwarded-Proto') || request.headers?.['x-forwarded-proto'] || '')
      .split(',')[0].trim().toLowerCase() === 'https',
  }));
}

export function createCsrfProtection({ trustedOrigins = config.trustedOrigins, nodeEnv = config.nodeEnv, testIdentityInjected = false } = {}) {
  const allowlist = new Set(trustedOrigins || []);
  return function csrfProtection(request, _response, next) {
    if (SAFE_METHODS.has(request.method)) return next();
    if (nodeEnv === 'test' && testIdentityInjected) return next();

    const origin = requestOrigin(request);
    if (!origin || !allowlist.has(origin)) {
      logCsrfRejection(request, 'origin_not_allowed', { originPresent: Boolean(origin) });
      return next(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'This request origin is not allowed.'));
    }
    const supplied = request.get?.('X-CSRF-Token') || request.headers?.['x-csrf-token'];
    const expected = request.session?.csrfToken;
    if (!sessionSecurity.csrfTokenMatches(expected, supplied)) {
      const category = !supplied
        ? 'missing_csrf_header'
        : !hasSessionCookie(request)
          ? 'missing_session_cookie'
          : !expected
            ? 'session_token_missing'
            : 'token_mismatch';
      logCsrfRejection(request, category, { originPresent: true, csrfHeaderPresent: Boolean(supplied) });
      return next(new HttpError(403, 'INVALID_CSRF_TOKEN', 'Refresh the page and try again.'));
    }
    return next();
  };
}
