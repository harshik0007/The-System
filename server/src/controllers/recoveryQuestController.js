import mongoose from 'mongoose';
import {
  completeCurrentRecoveryQuest,
  getCurrentGracePoints,
  getCurrentProgressionSnapshot,
  listCurrentGracePointTransactions,
  listCurrentRecoveryQuests,
} from '../services/recoveryQuestService.js';
import { ValidationError, NotFoundError } from '../utils/httpErrors.js';

function questIdFrom(request) {
  const { questId } = request.params;
  if (!mongoose.isValidObjectId(questId)) throw new NotFoundError('The Recovery Quest was not found.');
  return questId;
}

function assertNoBodyFields(request) {
  const fields = Object.keys(request.body || {});
  if (fields.length) throw new ValidationError('The completion request does not accept client-supplied values.', fields.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
}

function assertAllowedQuery(request, allowed = []) {
  const allowedFields = new Set(allowed);
  const fields = Object.keys(request.query || {}).filter((field) => !allowedFields.has(field));
  if (fields.length) {
    throw new ValidationError('The request contains unsupported query fields.', fields.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
  }
}

export async function listQuests(request, response) {
  assertAllowedQuery(request);
  const result = await listCurrentRecoveryQuests(request.user.id);
  response.json(result);
}

export async function getQuest(request, response) {
  assertAllowedQuery(request);
  const questId = questIdFrom(request);
  const result = await listCurrentRecoveryQuests(request.user.id);
  const quest = result.quests.find((item) => item.id === questId);
  if (!quest) throw new NotFoundError('The Recovery Quest was not found.');
  response.json({ quest });
}

export async function completeQuest(request, response) {
  assertAllowedQuery(request);
  assertNoBodyFields(request);
  const result = await completeCurrentRecoveryQuest({ userId: request.user.id, questId: questIdFrom(request) });
  response.json(result);
}

export async function getGracePoints(request, response) {
  assertAllowedQuery(request);
  response.json(await getCurrentGracePoints(request.user.id));
}

export async function getGracePointTransactions(request, response) {
  assertAllowedQuery(request, ['limit']);
  const limit = request.query.limit === undefined ? 50 : Number(request.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || Object.keys(request.query || {}).some((key) => key !== 'limit')) {
    throw new ValidationError('The transaction-history request is invalid.', [{ field: 'limit', code: 'INVALID_LIMIT' }]);
  }
  response.json({ transactions: await listCurrentGracePointTransactions(request.user.id, { limit }) });
}

export async function getCurrentProgression(request, response) {
  assertAllowedQuery(request);
  response.json(await getCurrentProgressionSnapshot(request.user.id));
}
