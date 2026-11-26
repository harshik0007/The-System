import { requireAuthenticatedUser } from './requireAuthenticatedUser.js';

const PUBLIC_GET_PATHS = new Set([
  '/auth/csrf',
  '/auth/capabilities',
  '/auth/username-availability',
  '/auth/me',
  '/auth/google/pending',
  '/auth/google',
  '/auth/google/callback',
]);

const PUBLIC_POST_PATHS = new Set([
  '/auth/signup',
  '/auth/login',
  '/auth/reset-password',
  '/auth/google/complete',
]);

function isPublicApiRoute(request) {
  const method = String(request.method || '').toUpperCase();
  const path = request.path || '';
  if (method === 'GET' || method === 'HEAD') return PUBLIC_GET_PATHS.has(path);
  if (method === 'POST') return PUBLIC_POST_PATHS.has(path);
  return false;
}

/**
 * Keep API access closed by default. Public routes are listed explicitly;
 * every other route requires a validated account session before CSRF or
 * route handling can run.
 */
export function createApiAccessGuard({ identityMiddleware = requireAuthenticatedUser } = {}) {
  return (request, response, next) => {
    if (isPublicApiRoute(request)) return next();
    return identityMiddleware(request, response, (error) => {
      if (error) return next(error);
      request.apiAccessVerified = true;
      return next();
    });
  };
}
