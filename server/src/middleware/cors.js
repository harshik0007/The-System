import { HttpError } from '../utils/httpErrors.js';

export function createCorsMiddleware(allowedOrigins = []) {
  const allowlist = new Set(allowedOrigins);

  return (request, response, next) => {
    const origin = request.get('Origin');
    if (origin && allowlist.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id, X-CSRF-Token, Idempotency-Key');
      response.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
    } else if (origin && allowlist.size > 0) {
      console.warn('[cors-rejected]', JSON.stringify({
        requestId: request.requestId || 'unknown',
        method: request.method || 'UNKNOWN',
        path: request.path || 'unknown',
        category: 'origin_not_allowed',
      }));
      return next(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'This request origin is not allowed.'));
    }

    if (request.method === 'OPTIONS') return response.sendStatus(origin && allowlist.has(origin) ? 204 : 403);
    return next();
  };
}
