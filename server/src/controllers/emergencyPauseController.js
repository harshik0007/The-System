import {
  activateEmergencyPause,
  getEmergencyPauseStatus,
  resumeEmergencyPause,
} from '../services/emergencyPauseService.js';
import { ValidationError } from '../utils/httpErrors.js';

function assertAllowedQuery(request) {
  const fields = Object.keys(request.query || {});
  if (fields.length) throw new ValidationError('The Emergency Pause request does not accept query values.', fields.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
}

function assertBodyFields(request, allowed = []) {
  const allow = new Set(allowed);
  const fields = Object.keys(request.body || {}).filter((field) => !allow.has(field));
  if (fields.length) throw new ValidationError('The Emergency Pause request contains unsupported values.', fields.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
}

function idempotencyKey(request) {
  const value = request.get('Idempotency-Key');
  if (!value) throw new ValidationError('An Idempotency-Key header is required.', [{ field: 'Idempotency-Key', code: 'REQUIRED' }]);
  return value;
}

export async function getStatus(request, response) {
  assertAllowedQuery(request);
  response.json(await getEmergencyPauseStatus(request.user.id));
}

export async function activate(request, response) {
  assertAllowedQuery(request);
  assertBodyFields(request, ['durationDays']);
  const result = await activateEmergencyPause({
    userId: request.user.id,
    durationDays: request.body?.durationDays,
    idempotencyKey: idempotencyKey(request),
  });
  response.status(result.idempotentReplay ? 200 : 201).json(result);
}

export async function resume(request, response) {
  assertAllowedQuery(request);
  assertBodyFields(request);
  response.json(await resumeEmergencyPause({ userId: request.user.id, idempotencyKey: idempotencyKey(request) }));
}
