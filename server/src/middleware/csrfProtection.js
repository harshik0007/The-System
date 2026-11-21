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

export function createCsrfProtection({ trustedOrigins = config.trustedOrigins, nodeEnv = config.nodeEnv, testIdentityInjected = false } = {}) {
  const allowlist = new Set(trustedOrigins || []);
  return function csrfProtection(request, _response, next) {
    if (SAFE_METHODS.has(request.method)) return next();
    if (nodeEnv === 'test' && testIdentityInjected) return next();

    const origin = requestOrigin(request);
    if (!origin || !allowlist.has(origin)) return next(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'This request origin is not allowed.'));
    const supplied = request.get?.('X-CSRF-Token') || request.headers?.['x-csrf-token'];
    const expected = request.session?.csrfToken;
    if (!sessionSecurity.csrfTokenMatches(expected, supplied)) {
      return next(new HttpError(403, 'INVALID_CSRF_TOKEN', 'Refresh the page and try again.'));
    }
    return next();
  };
}
