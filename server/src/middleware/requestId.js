import { randomUUID } from 'node:crypto';

export function requestIdMiddleware(_request, response, next) {
  const requestId = randomUUID();
  _request.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
}
