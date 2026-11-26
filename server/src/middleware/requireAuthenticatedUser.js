import { UnauthorizedError } from '../utils/httpErrors.js';

export function requireAuthenticatedUser(request, _response, next) {
  if (request.apiAccessVerified) return next();
  if (!request.authSession?.authenticated || !request.user?.id) {
    return next(new UnauthorizedError());
  }
  return next();
}
