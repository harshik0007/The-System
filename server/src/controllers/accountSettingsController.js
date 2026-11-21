import {
  getAccountSettings,
  getManualResetPreview,
  manualResetAndRestart,
  updateAccountPreferences,
} from '../services/accountSettingsService.js';
import { ValidationError } from '../utils/httpErrors.js';

function assertNoQuery(request) {
  const unexpected = Object.keys(request.query || {});
  if (unexpected.length) throw new ValidationError('The request contains unsupported query fields.', unexpected.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
}

function assertAllowedBody(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('The request body must be an object.');
  const unexpected = Object.keys(body).filter((field) => !allowed.includes(field));
  if (unexpected.length) throw new ValidationError('The request contains unsupported fields.', unexpected.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
}

export async function getSettings(request, response) {
  assertNoQuery(request);
  response.set('Cache-Control', 'private, no-store');
  response.json({ settings: await getAccountSettings(request.user.id) });
}

export async function savePreferences(request, response) {
  assertNoQuery(request);
  assertAllowedBody(request.body, ['appearance', 'accessibility']);
  response.set('Cache-Control', 'private, no-store');
  response.json({ settings: await updateAccountPreferences(request.user.id, request.body) });
}

export async function resetPreview(request, response) {
  assertNoQuery(request);
  response.set('Cache-Control', 'private, no-store');
  response.json({ preview: await getManualResetPreview(request.user.id) });
}

export async function resetAndRestart(request, response) {
  assertNoQuery(request);
  assertAllowedBody(request.body, ['confirmationPhrase', 'expectedRunNumber']);
  response.set('Cache-Control', 'private, no-store');
  response.json({ reset: await manualResetAndRestart({
    userId: request.user.id,
    confirmationPhrase: request.body.confirmationPhrase,
    expectedRunNumber: request.body.expectedRunNumber,
    idempotencyKey: request.get('Idempotency-Key'),
  }) });
}
