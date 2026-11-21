import { ValidationError } from '../utils/httpErrors.js';

/**
 * Accepts a pure validator that returns an array of human-readable issue strings.
 * Request handlers can use this helper without coupling domain validation to Express.
 */
export function validateRequest(validate) {
  if (typeof validate !== 'function') throw new TypeError('validateRequest expects a validator function.');

  return (request, _response, next) => {
    try {
      const issues = validate({
        body: request.body,
        params: request.params,
        query: request.query,
      });
      if (Array.isArray(issues) && issues.length > 0) {
        return next(new ValidationError('The request contains invalid input.', issues));
      }
      return next();
    } catch (error) {
      return next(error instanceof ValidationError ? error : new ValidationError());
    }
  };
}
