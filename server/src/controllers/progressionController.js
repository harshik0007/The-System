import mongoose from 'mongoose';
import { getProgressionConfigurationDto } from '../config/progressionConfiguration.js';
import ProgressionRun from '../models/ProgressionRun.js';
import { getProgressionXpSummary, listProgressionXpTransactions } from '../services/progressionXpService.js';
import { ValidationError } from '../utils/httpErrors.js';

function assertAllowedQuery(request, allowed) {
  const unexpected = Object.keys(request.query || {}).filter((field) => !allowed.includes(field));
  if (unexpected.length) throw new ValidationError('The request contains unsupported query fields.', unexpected.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
}

export async function getXpSummary(request, response) {
  assertAllowedQuery(request, []);
  response.json({ summary: await getProgressionXpSummary(request.user.id) });
}

export async function getXpTransactions(request, response) {
  assertAllowedQuery(request, ['limit', 'before', 'beforeId']);
  const limit = request.query.limit === undefined ? 50 : Number(request.query.limit);
  const before = request.query.before || null;
  const beforeId = request.query.beforeId || null;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ValidationError('The XP transaction page size must be between 1 and 100.', [{ field: 'limit', code: 'INVALID_LIMIT' }]);
  }
  if ((before && !Number.isFinite(Date.parse(before))) || (beforeId && !mongoose.isValidObjectId(beforeId)) || Boolean(before) !== Boolean(beforeId)) {
    throw new ValidationError('The XP history cursor is invalid.', [{ field: 'before', code: 'INVALID_CURSOR' }]);
  }
  response.json(await listProgressionXpTransactions(request.user.id, { limit, before, beforeId }));
}

export async function getRanks(request, response) {
  assertAllowedQuery(request, []);
  response.json(getProgressionConfigurationDto());
}

export async function getCurrentRank(request, response) {
  assertAllowedQuery(request, []);
  const summary = await getProgressionXpSummary(request.user.id);
  response.json({ rank: summary?.currentRank || null, currentLevel: summary?.currentLevel ?? null });
}

export async function getNextRank(request, response) {
  assertAllowedQuery(request, []);
  const summary = await getProgressionXpSummary(request.user.id);
  response.json({ rank: summary?.nextRank || null, highestDefinedRankReached: summary?.highestDefinedRankReached ?? false });
}

