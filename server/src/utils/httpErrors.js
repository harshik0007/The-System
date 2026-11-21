export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends HttpError {
  constructor(message = 'The request contains invalid input.', details = []) {
    super(400, 'VALIDATION_ERROR', message);
    this.name = 'ValidationError';
    this.details = Array.isArray(details) ? details : [];
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'The requested resource was not found.') {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Sign in to continue.') {
    super(401, 'UNAUTHENTICATED', message);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends HttpError {
  constructor(code = 'CONFLICT', message = 'The request conflicts with the current resource state.') {
    super(409, code, message);
    this.name = 'ConflictError';
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message = 'The requested service is not available.') {
    super(503, 'SERVICE_UNAVAILABLE', message);
    this.name = 'ServiceUnavailableError';
  }
}
