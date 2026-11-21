import {
  getActiveDisciplineRewardCycle,
  getDisciplineCalendar,
  getDisciplineSummary,
  getDisciplinePointWallet,
  isValidDisciplineDateRange,
  listDisciplinePointTransactions,
  redeemDisciplinePointForGracePoint,
} from '../services/disciplineService.js';
import { ValidationError } from '../utils/httpErrors.js';

function assertAllowedQuery(request, allowed = []) {
  const unexpected = Object.keys(request.query || {}).filter((field) => !allowed.includes(field));
  if (unexpected.length) {
    throw new ValidationError('The request contains unsupported query fields.', unexpected.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
  }
}

function parseLimit(value, field = 'limit') {
  const limit = value === undefined ? 50 : Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ValidationError('The page size must be between 1 and 100.', [{ field, code: 'INVALID_LIMIT' }]);
  }
  return limit;
}

export async function getSummary(request, response) {
  assertAllowedQuery(request);
  response.json({ summary: await getDisciplineSummary(request.user.id) });
}

export async function getCalendar(request, response) {
  assertAllowedQuery(request, ['startDate', 'endDate']);
  const { startDate, endDate } = request.query;
  if (Boolean(startDate) !== Boolean(endDate) || (startDate && !isValidDisciplineDateRange(startDate, endDate))) {
    throw new ValidationError('Provide a valid inclusive IST date range of no more than 365 days.', [
      { field: 'startDate', code: 'INVALID_DATE_RANGE' },
      { field: 'endDate', code: 'INVALID_DATE_RANGE' },
    ]);
  }
  response.json(await getDisciplineCalendar(request.user.id, { startDate, endDate }));
}

export async function getRewardCycle(request, response) {
  assertAllowedQuery(request);
  response.json(await getActiveDisciplineRewardCycle(request.user.id));
}

export async function getTransactions(request, response) {
  assertAllowedQuery(request, ['limit']);
  response.json(await listDisciplinePointTransactions(request.user.id, { limit: parseLimit(request.query.limit) }));
}

export async function getWallet(request, response) {
  assertAllowedQuery(request);
  response.json(await getDisciplinePointWallet(request.user.id));
}

export async function redeem(request, response) {
  assertAllowedQuery(request);
  const unexpectedBodyFields = Object.keys(request.body || {});
  if (unexpectedBodyFields.length) {
    throw new ValidationError('The redemption request does not accept client-supplied values.', unexpectedBodyFields.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
  }
  const idempotencyKey = request.get('Idempotency-Key');
  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8 || idempotencyKey.trim().length > 160) {
    throw new ValidationError('A unique Idempotency-Key between 8 and 160 characters is required.', [{ field: 'Idempotency-Key', code: 'INVALID_IDEMPOTENCY_KEY' }]);
  }
  response.status(200).json(await redeemDisciplinePointForGracePoint({ userId: request.user.id, idempotencyKey }));
}

