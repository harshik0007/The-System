import { HttpError, NotFoundError } from '../utils/httpErrors.js';

export function notFoundHandler(_request, _response, next) {
  next(new NotFoundError());
}

function normalizeError(error) {
  if (error instanceof HttpError) return error;
  if (error?.type === 'entity.too.large') return new HttpError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
  if (error?.type === 'entity.parse.failed') return new HttpError(400, 'INVALID_JSON', 'The request body must be valid JSON.');
  if (error?.name === 'ValidationError' && error?.errors) return new HttpError(400, 'VALIDATION_ERROR', 'The request contains invalid input.');
  if (error?.code === 11000) return new HttpError(409, 'CONFLICT', 'A record with those details already exists.');
  return new HttpError(500, 'INTERNAL_ERROR', 'An unexpected server error occurred.');
}

function redactDiagnostic(value) {
  return String(value || '')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, '[redacted MongoDB URI]')
    .replace(/\bBearer\s+[^\s"'`]+/gi, 'Bearer [redacted]')
    .replace(/((?:password|secret|token|api[_-]?key)=)[^&\s]+/gi, '$1[redacted]');
}

function logInternalError(error, request) {
  const route = request.route?.path
    ? `${request.baseUrl || ''}${request.route.path}`
    : request.path || 'unknown route';
  const diagnostics = {
    requestId: request.requestId || 'unknown',
    method: request.method || 'UNKNOWN',
    route,
    errorName: error?.name || 'Error',
    message: redactDiagnostic(error?.message || 'No error message provided.'),
  };
  if (process.env.NODE_ENV === 'development' && error?.stack) {
    diagnostics.stack = redactDiagnostic(error.stack);
  }
  console.error('[api-error]', JSON.stringify(diagnostics));
}

export function errorHandler(error, request, response, _next) {
  if (response.headersSent) return;
  const safeError = normalizeError(error);
  if (safeError.status >= 500) logInternalError(error, request);
  const payload = {
    error: {
      code: safeError.code,
      message: safeError.message,
      requestId: request.requestId || null,
    },
  };
  if (safeError.details?.length) payload.error.details = safeError.details;
  response.status(safeError.status).json(payload);
}
