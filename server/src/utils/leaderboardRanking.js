import { getRankProgressionOrder } from './ranks.js';

export const LEADERBOARD_CATEGORIES = Object.freeze(['overall', 'discipline', 'xp']);

function asNonNegativeBigInt(value, field) {
  if (typeof value === 'bigint' && value >= 0n) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  if (value && typeof value.toString === 'function' && /^\d+$/.test(value.toString())) return BigInt(value.toString());
  throw new TypeError(`${field} must be a non-negative integer within the supported storage range.`);
}

export function compareExactTieBreakDescending(left, right) {
  const leftCompleted = asNonNegativeBigInt(left.completedOriginalTaskCount ?? 0, 'completedOriginalTaskCount');
  const rightCompleted = asNonNegativeBigInt(right.completedOriginalTaskCount ?? 0, 'completedOriginalTaskCount');
  const leftQuests = asNonNegativeBigInt(left.totalRecoveryQuestCount ?? 0, 'totalRecoveryQuestCount') + 1n;
  const rightQuests = asNonNegativeBigInt(right.totalRecoveryQuestCount ?? 0, 'totalRecoveryQuestCount') + 1n;
  const leftProduct = leftCompleted * rightQuests;
  const rightProduct = rightCompleted * leftQuests;
  return leftProduct === rightProduct ? 0 : leftProduct > rightProduct ? -1 : 1;
}

function numeric(value) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function compareDescending(left, right) {
  const a = numeric(left);
  const b = numeric(right);
  return a === b ? 0 : a > b ? -1 : 1;
}

export function comparePrimaryMetrics(left, right, category) {
  if (!LEADERBOARD_CATEGORIES.includes(category)) throw new TypeError('Unknown leaderboard category.');
  if (category === 'overall') {
    return compareDescending(getRankProgressionOrder(left.currentRankSlug), getRankProgressionOrder(right.currentRankSlug))
      || compareDescending(left.level, right.level)
      || compareDescending(left.totalXpCents ?? Math.round(numeric(left.totalXp) * 100), right.totalXpCents ?? Math.round(numeric(right.totalXp) * 100));
  }
  if (category === 'discipline') {
    return compareDescending(left.currentStreak, right.currentStreak)
      || compareDescending(left.longestStreak, right.longestStreak);
  }
  return compareDescending(left.totalXpCents ?? Math.round(numeric(left.totalXp) * 100), right.totalXpCents ?? Math.round(numeric(right.totalXp) * 100));
}

function stableMemberOrder(left, right) {
  const leftName = String(left.username || '').trim().toLowerCase();
  const rightName = String(right.username || '').trim().toLowerCase();
  if (leftName !== rightName) return leftName < rightName ? -1 : 1;
  const leftHandle = String(left.publicHandle || '');
  const rightHandle = String(right.publicHandle || '');
  return leftHandle === rightHandle ? 0 : leftHandle < rightHandle ? -1 : 1;
}

export function compareLeaderboardRows(left, right, category) {
  return comparePrimaryMetrics(left, right, category)
    || compareExactTieBreakDescending(left, right)
    || stableMemberOrder(left, right);
}

export function rankLeaderboardRows(rows, category) {
  const sorted = [...rows].sort((left, right) => compareLeaderboardRows(left, right, category));
  let competitionRank = 0;
  let previous = null;
  return sorted.map((row, index) => {
    if (!previous
      || comparePrimaryMetrics(previous, row, category) !== 0
      || compareExactTieBreakDescending(previous, row) !== 0) competitionRank = index + 1;
    previous = row;
    return { ...row, competitionRank };
  });
}

export function toSafeTieBreakDto(row) {
  return {
    completedOriginalTasks: asNonNegativeBigInt(row.completedOriginalTaskCount ?? 0, 'completedOriginalTaskCount').toString(),
    totalRecoveryQuests: asNonNegativeBigInt(row.totalRecoveryQuestCount ?? 0, 'totalRecoveryQuestCount').toString(),
  };
}

export function calculateNextPersonalBest(previous, currentPosition, achievedOn) {
  const current = Number.isSafeInteger(currentPosition) && currentPosition > 0 ? currentPosition : null;
  const previousBest = Number.isSafeInteger(previous?.bestPosition) && previous.bestPosition > 0 ? previous.bestPosition : null;
  const improved = current !== null && (previousBest === null || current < previousBest);
  return {
    currentPosition: current,
    bestPosition: improved ? current : previousBest,
    achievedOn: improved ? achievedOn : previous?.achievedOn || null,
  };
}
