import mongoose from 'mongoose';
import DailyXpRecord from '../models/DailyXpRecord.js';
import DailyTaskXpAllocation from '../models/DailyTaskXpAllocation.js';
import DisciplinePointTransaction from '../models/DisciplinePointTransaction.js';
import ProgressionRun from '../models/ProgressionRun.js';
import RankEntryEvent from '../models/RankEntryEvent.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import User from '../models/User.js';
import XpTransaction from '../models/XpTransaction.js';
import { createNotificationWithinSession } from './notificationService.js';
import { PROGRESSION_CONFIGURATION, PROGRESSION_RANKS, PROGRESSION_RANK_BY_SLUG, toRankBenefitDto } from '../config/progressionConfiguration.js';
import { getIstDateKey } from '../utils/ist.js';
import { getRankProgressionOrder, getRankSlugForLevel } from '../utils/ranks.js';

export const XP_DRAIN_RATE_PER_QUEST = PROGRESSION_CONFIGURATION.xp.recoveryQuestDrainBasisPoints / 10_000;
const centsToXp = (cents) => Math.max(0, Math.round(cents)) / 100;
const xpToCents = (xp) => Math.max(0, Math.round((Number(xp) + Number.EPSILON) * 100));
const signedXpToCents = (xp) => Math.round(Number(xp) * 100);
const decimal128FromCents = (cents) => mongoose.Types.Decimal128.fromString((cents / 100).toFixed(2));
const decimalFromCents = (cents) => (cents / 100).toFixed(2);
const rankOrder = (slug) => getRankProgressionOrder(slug);

export function getXpRequirement(level) {
  const safeLevel = Math.max(0, Math.floor(Number(level) || 0));
  return Math.ceil(PROGRESSION_CONFIGURATION.xp.baseRequirement * ((1 + PROGRESSION_CONFIGURATION.xp.growthRate) ** safeLevel));
}

const cumulativeThresholdCache = [0];
export function getCumulativeXpThreshold(level) {
  const targetLevel = Math.max(0, Math.floor(Number(level) || 0));
  while (cumulativeThresholdCache.length <= targetLevel) {
    const next = cumulativeThresholdCache.at(-1) + getXpRequirement(cumulativeThresholdCache.length - 1);
    cumulativeThresholdCache.push(next);
    if (!Number.isFinite(next)) return Number.POSITIVE_INFINITY;
  }
  return cumulativeThresholdCache[targetLevel];
}

export function getLevelFromTotalXp(totalXp) {
  const xpCents = xpToCents(totalXp);
  let low = 0;
  let high = 1;
  while (getCumulativeXpThreshold(high) * 100 <= xpCents && Number.isFinite(getCumulativeXpThreshold(high)) && high < Number.MAX_SAFE_INTEGER / 2) high *= 2;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (getCumulativeXpThreshold(middle) * 100 <= xpCents) low = middle;
    else high = middle;
  }
  return low;
}

export function calculateRecoveryQuestDrainCents(level, activeQuestCount) {
  const count = Math.max(0, Math.floor(Number(activeQuestCount) || 0));
  return getXpRequirement(level) * PROGRESSION_CONFIGURATION.xp.recoveryQuestDrainBasisPoints / 100 * count;
}

export function getRankMultiplier(rankSlug) {
  return (PROGRESSION_RANK_BY_SLUG[rankSlug] || PROGRESSION_RANKS[0]).multiplierBasisPoints / 10_000;
}

export function getDailyXpCapCents(rankSlug) {
  return PROGRESSION_CONFIGURATION.dailyXpCapsCents[rankSlug] ?? PROGRESSION_CONFIGURATION.dailyXpCapsCents.origin;
}

export function allocateDailyTaskXp(occurrences) {
  const eligible = [...(occurrences || [])]
    .filter((occurrence) => occurrence?.status !== 'cancelled')
    .map((occurrence) => ({
      occurrence,
      occurrenceId: String(occurrence._id ?? occurrence.id ?? ''),
      taskId: String(occurrence.taskId ?? ''),
      cycleDay: Number(occurrence.cycleDay) || 0,
    }))
    .sort((left, right) => left.cycleDay - right.cycleDay
      || left.taskId.localeCompare(right.taskId)
      || left.occurrenceId.localeCompare(right.occurrenceId));

  if (!eligible.length) throw new TypeError('A daily Task XP allocation requires at least one original scheduled occurrence.');
  if (eligible.some((item) => !item.occurrenceId || !item.taskId)) throw new TypeError('Every Task XP allocation requires persisted occurrence and Task identifiers.');
  if (new Set(eligible.map((item) => item.occurrenceId)).size !== eligible.length) throw new TypeError('Duplicate Task occurrence identifiers cannot be allocated twice.');

  const poolCents = PROGRESSION_CONFIGURATION.xp.dailyTaskPoolCents;
  const shareCents = Math.floor(poolCents / eligible.length);
  const remainderCents = poolCents % eligible.length;
  const allocations = eligible.map((item, index) => ({
    occurrenceId: item.occurrence._id ?? item.occurrence.id,
    taskId: item.occurrence.taskId,
    baseXpCents: shareCents + (index < remainderCents ? 1 : 0),
  }));
  return {
    totalBaseXpCents: allocations.reduce((sum, allocation) => sum + allocation.baseXpCents, 0),
    scheduledOccurrenceCount: eligible.length,
    allocations,
  };
}

export async function ensureDailyXpRecordWithinSession({ userId, run, date, occurredAt = new Date(), session }) {
  if (!session) throw new TypeError('A daily XP record must be captured in the caller\'s transaction.');
  let record = await DailyXpRecord.findOne({ userId, date }).session(session);
  if (record) return record;
  const level = getLevelFromTotalXp(run.totalXp);
  const rankAtDayStart = getRankSlugForLevel(level);
  const capAmountCents = getDailyXpCapCents(rankAtDayStart);
  [record] = await DailyXpRecord.create([{
    userId,
    date,
    rankAtDayStart,
    capAmountCents,
    ordinaryXpCreditedCents: 0,
    sourceEvents: [],
    configurationVersion: PROGRESSION_CONFIGURATION.version,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  }], { session });
  return record;
}

export async function ensureDailyTaskXpAllocationWithinSession({ userId, run, scheduleId, date, occurredAt = new Date(), session }) {
  if (!session) throw new TypeError('A daily Task XP allocation must be created in the caller\'s transaction.');
  let allocation = await DailyTaskXpAllocation.findOne({ userId, progressionRunId: run._id, date }).session(session);
  if (allocation) return allocation;

  const occurrences = await TaskOccurrence.find({
    userId,
    progressionRunId: run._id,
    taskScheduleId: scheduleId,
    occurrenceDate: date,
    status: { $ne: 'cancelled' },
  }).session(session);
  const snapshot = allocateDailyTaskXp(occurrences);
  [allocation] = await DailyTaskXpAllocation.create([{
    userId,
    progressionRunId: run._id,
    date,
    ...snapshot,
    configurationVersion: PROGRESSION_CONFIGURATION.version,
    createdAt: occurredAt,
  }], { session });
  return allocation;
}

async function applyXpLedgerChangeWithinSession({
  userId,
  progressionRunId,
  amountCents,
  type,
  sourceType = null,
  sourceEntityId = null,
  sourceEventKey,
  occurredAt,
  businessDate = getIstDateKey(occurredAt),
  baseAmountCents = null,
  multiplier = null,
  calculatedAmountCents = null,
  dailyCapAmountCents = null,
  dailyCapRemainingBeforeCents = null,
  dailyCapRemainingAfterCents = null,
  activeQuestCount = 0,
  levelRequirement = 0,
  metadata = {},
  session,
}) {
  const existing = await XpTransaction.findOne({ userId, progressionRunId, sourceEventKey }).session(session);
  if (existing) {
    return {
      transaction: existing,
      idempotentReplay: true,
      levelBefore: existing.levelBefore,
      resultingLevel: existing.resultingLevel,
      beforeXp: Number(existing.balanceBefore?.toString?.() || 0),
      afterXp: Number(existing.balanceAfter?.toString?.() || 0),
      appliedCents: signedXpToCents(existing.amount?.toString?.() || 0),
      currentRankBefore: existing.currentRankBefore,
      currentRankAfter: existing.currentRankAfter,
    };
  }

  const run = await ProgressionRun.findOne({ _id: progressionRunId, userId, status: 'active' }).session(session);
  if (!run) return { transaction: null, stopped: true, idempotentReplay: false };
  const beforeCents = xpToCents(run.totalXp);
  const appliedCents = amountCents < 0 ? -Math.min(beforeCents, Math.abs(amountCents)) : Math.max(0, amountCents);
  const afterCents = beforeCents + appliedCents;
  const beforeXp = centsToXp(beforeCents);
  const afterXp = centsToXp(afterCents);
  const levelBefore = getLevelFromTotalXp(beforeXp);
  const resultingLevel = getLevelFromTotalXp(afterXp);
  const currentRankBefore = getRankSlugForLevel(levelBefore);
  const currentRankAfter = getRankSlugForLevel(resultingLevel);

  const changed = await ProgressionRun.updateOne({
    _id: progressionRunId,
    userId,
    status: 'active',
    totalXp: run.totalXp,
  }, {
    $set: { totalXp: afterXp, level: resultingLevel, currentRankSlug: currentRankAfter },
  }, { session, runValidators: true });
  if (changed.modifiedCount !== 1 && (beforeCents !== afterCents || run.level !== resultingLevel || run.currentRankSlug !== currentRankAfter)) {
    throw new Error('The progression run changed during the XP adjustment. Retry the transaction.');
  }

  const transactionAmountCents = appliedCents;
  const [transaction] = await XpTransaction.create([{
    userId,
    progressionRunId,
    amount: decimal128FromCents(transactionAmountCents),
    type,
    sourceType,
    sourceEntityId,
    sourceEventKey,
    baseAmount: baseAmountCents === null ? null : decimal128FromCents(baseAmountCents),
    multiplier,
    calculatedAmount: calculatedAmountCents === null ? null : decimal128FromCents(calculatedAmountCents),
    actualCreditedAmount: type === 'task-completion' || (type === 'rank-entry' && appliedCents > 0) ? decimal128FromCents(appliedCents) : null,
    dailyCapAmount: dailyCapAmountCents === null ? null : decimal128FromCents(dailyCapAmountCents),
    dailyCapRemainingBefore: dailyCapRemainingBeforeCents === null ? null : decimal128FromCents(dailyCapRemainingBeforeCents),
    dailyCapRemainingAfter: dailyCapRemainingAfterCents === null ? null : decimal128FromCents(dailyCapRemainingAfterCents),
    balanceBefore: decimal128FromCents(beforeCents),
    balanceAfter: decimal128FromCents(afterCents),
    levelBefore,
    resultingLevel,
    currentRankBefore,
    currentRankAfter,
    levelRequirement,
    activeQuestCount,
    occurredAt,
    businessDate,
    metadata: { configurationVersion: PROGRESSION_CONFIGURATION.version, ...metadata },
  }], { session });

  if (resultingLevel > levelBefore) {
    await createNotificationWithinSession({
      userId, progressionRunId, category: 'rank-xp', eventType: 'level-increased',
      title: `Level ${resultingLevel} reached`, description: `Your Level increased from ${levelBefore} to ${resultingLevel}.`,
      targetRoute: '/app/discipline', idempotencyKey: `level-increased:${transaction._id}`,
      occurredAt, session,
    });
  } else if (resultingLevel < levelBefore) {
    await createNotificationWithinSession({
      userId, progressionRunId, category: 'rank-xp', eventType: 'level-decreased',
      title: `Level ${resultingLevel} reached`, description: `Your Level decreased from ${levelBefore} to ${resultingLevel} after a persisted XP adjustment.`,
      targetRoute: '/app/discipline', idempotencyKey: `level-decreased:${transaction._id}`,
      occurredAt, session,
    });
  }
  if (currentRankAfter !== currentRankBefore) {
    const fromName = PROGRESSION_RANK_BY_SLUG[currentRankBefore]?.name || currentRankBefore;
    const toName = PROGRESSION_RANK_BY_SLUG[currentRankAfter]?.name || currentRankAfter;
    const promoted = rankOrder(currentRankAfter) > rankOrder(currentRankBefore);
    await createNotificationWithinSession({
      userId, progressionRunId, category: 'rank-xp', eventType: promoted ? 'rank-promoted' : 'rank-demoted',
      title: promoted ? `${toName} Rank achieved` : `Rank adjusted to ${toName}`,
      description: promoted ? `Your current Rank advanced from ${fromName} to ${toName}.` : `Your current Rank changed from ${fromName} to ${toName} after XP recalculation. Highest Rank Achieved remains a lifetime record.`,
      targetRoute: `/ranks/${currentRankAfter}`, idempotencyKey: `rank-transition:${transaction._id}`,
      occurredAt, session,
    });
  }

  const user = await User.findById(userId).session(session);
  if (user) {
    let userChanged = false;
    if (rankOrder(currentRankAfter) > rankOrder(user.highestRankAchieved)) {
      user.highestRankAchieved = currentRankAfter;
      userChanged = true;
    }
    if (userChanged) await user.save({ session, validateModifiedOnly: true });
  }
  return { transaction, idempotentReplay: false, levelBefore, resultingLevel, beforeXp, afterXp, appliedCents, currentRankBefore, currentRankAfter };
}

async function awardRankEntryWithinSession({ userId, run, rank, sourceXpTransaction, occurredAt, businessDate, session }) {
  const existing = await RankEntryEvent.findOne({ userId, progressionRunId: run._id, rankSlug: rank.slug }).session(session);
  if (existing) return null;

  const configuredXpRewardCents = rank.entryXpCents ?? 0;
  const xpRewardConfigured = rank.entryXpCents !== null;
  // Rank-entry XP is exempt from the daily Rank cap, so the configured amount
  // is also the amount actually credited by this transaction.
  const creditedXpRewardCents = configuredXpRewardCents;
  const configuredDpRewardCents = rank.entryDpCents;
  const balanceBeforeCents = xpToCents(run.disciplinePoints);
  const creditedDpRewardCents = Math.min(configuredDpRewardCents, Math.max(0, PROGRESSION_CONFIGURATION.disciplinePointWalletCapCents - balanceBeforeCents));
  const balanceAfterCents = balanceBeforeCents + creditedDpRewardCents;

  const [event] = await RankEntryEvent.create([{
    userId,
    progressionRunId: run._id,
    rankSlug: rank.slug,
    sourceEventKey: `rank-entry:${run._id}:${rank.slug}`,
    sourceXpTransactionId: sourceXpTransaction?._id || null,
    configuredXpRewardCents,
    xpRewardConfigured,
    creditedXpRewardCents: configuredXpRewardCents,
    configuredDpRewardCents,
    creditedDpRewardCents,
    occurredAt,
    businessDate,
    configurationVersion: PROGRESSION_CONFIGURATION.version,
  }], { session });

  if (creditedXpRewardCents > 0 || creditedDpRewardCents > 0) {
    await createNotificationWithinSession({
      userId, progressionRunId: run._id, category: 'rank-xp', eventType: 'rank-entry-reward-credited',
      title: `${rank.name} Rank-entry reward credited`,
      description: `Entering ${rank.name} credited ${decimalFromCents(creditedXpRewardCents)} XP and ${decimalFromCents(creditedDpRewardCents)} Discipline Points under the configured reward.`,
      targetRoute: `/ranks/${rank.slug}`, idempotencyKey: `rank-entry-reward-notice:${event._id}`,
      occurredAt, session,
    });
  }

  if (creditedDpRewardCents > 0) {
    const changed = await ProgressionRun.updateOne({ _id: run._id, userId, status: 'active', disciplinePoints: run.disciplinePoints }, {
      $set: { disciplinePoints: centsToXp(balanceAfterCents) },
    }, { session, runValidators: true });
    if (changed.modifiedCount !== 1) throw new Error('The Discipline Point balance changed during the Rank-entry reward. Retry the transaction.');
    run.disciplinePoints = centsToXp(balanceAfterCents);
    const [dpTransaction] = await DisciplinePointTransaction.create([{
      userId,
      progressionRunId: run._id,
      deltaCents: creditedDpRewardCents,
      calculatedDeltaCents: configuredDpRewardCents,
      type: 'rank-entry',
      sourceEntity: 'rank-entry',
      sourceId: event._id,
      sourceEventKey: `rank-entry-dp:${run._id}:${rank.slug}`,
      balanceBeforeCents,
      balanceAfterCents,
      businessDate,
      occurredAt,
      metadata: { rankSlug: rank.slug, configuredRewardCents: configuredDpRewardCents, actualCreditedCents: creditedDpRewardCents, configurationVersion: PROGRESSION_CONFIGURATION.version },
    }], { session });
    event.disciplinePointTransactionId = dpTransaction._id;
  }

  let xpTransaction = null;
  if (configuredXpRewardCents > 0) {
    const reward = await applyXpLedgerChangeWithinSession({
      userId,
      progressionRunId: run._id,
      amountCents: configuredXpRewardCents,
      type: 'rank-entry',
      sourceType: 'rank-entry',
      sourceEntityId: event._id,
      sourceEventKey: `rank-entry-xp:${run._id}:${rank.slug}`,
      occurredAt,
      businessDate,
      baseAmountCents: configuredXpRewardCents,
      multiplier: 1,
      calculatedAmountCents: configuredXpRewardCents,
      metadata: { rankSlug: rank.slug, dailyCapExempt: true },
      session,
    });
    if (reward.stopped) throw new Error('The active progression run changed during a Rank-entry XP reward.');
    xpTransaction = reward.transaction;
    run.totalXp = reward.afterXp;
    run.level = reward.resultingLevel;
    run.currentRankSlug = getRankSlugForLevel(reward.resultingLevel);
    event.xpTransactionId = xpTransaction._id;
  }

  await RankEntryEvent.updateOne({ _id: event._id, userId }, {
    $set: {
      ...(event.xpTransactionId ? { xpTransactionId: event.xpTransactionId } : {}),
      ...(event.disciplinePointTransactionId ? { disciplinePointTransactionId: event.disciplinePointTransactionId } : {}),
    },
  }, { session });

  return {
    id: String(event._id),
    rankSlug: rank.slug,
    rankName: rank.name,
    xpRewardConfigured,
    configuredXpReward: xpRewardConfigured ? decimalFromCents(configuredXpRewardCents) : null,
    creditedXpReward: decimalFromCents(configuredXpRewardCents),
    configuredDpReward: decimalFromCents(configuredDpRewardCents),
    creditedDpReward: decimalFromCents(creditedDpRewardCents),
    occurredAt: occurredAt.toISOString(),
  };
}

export async function processRankTransitionsWithinSession({ userId, run, fromLevel, sourceXpTransaction, occurredAt, businessDate = getIstDateKey(occurredAt), session }) {
  if (!session || !sourceXpTransaction) throw new TypeError('Rank transitions require the XP transaction and its MongoDB transaction.');
  const rewards = [];
  let processedOrder = rankOrder(getRankSlugForLevel(fromLevel));

  while (processedOrder < rankOrder(getRankSlugForLevel(run.level))) {
    processedOrder += 1;
    const rank = PROGRESSION_RANKS[processedOrder];
    const reward = await awardRankEntryWithinSession({ userId, run, rank, sourceXpTransaction, occurredAt, businessDate, session });
    if (reward) rewards.push(reward);
    // Rank-entry XP may cross additional Rank gates. Re-check the live run on
    // every iteration so all crossed rewards are processed in ascending order.
    run.currentRankSlug = getRankSlugForLevel(run.level);
  }

  const finalRankSlug = getRankSlugForLevel(run.level);
  run.currentRankSlug = finalRankSlug;
  const user = await User.findById(userId).session(session);
  if (user && rankOrder(finalRankSlug) > rankOrder(user.highestRankAchieved)) {
    user.highestRankAchieved = finalRankSlug;
    await user.save({ session });
  }
  return rewards;
}

/** Apply an idempotent negative XP adjustment in the caller's transaction. */
export async function applyXpAdjustment({
  userId,
  progressionRunId,
  amountCents,
  type = 'recovery-quest-drain',
  sourceEventKey,
  occurredAt,
  businessDate = getIstDateKey(occurredAt),
  activeQuestCount = 0,
  levelRequirement = 0,
  metadata = {},
  session,
}) {
  if (!Number.isInteger(amountCents) || amountCents > 0) throw new TypeError('XP adjustments must be a non-positive integer number of cents.');
  if (!session || !sourceEventKey) throw new TypeError('XP adjustments require a transaction session and an idempotency key.');
  return applyXpLedgerChangeWithinSession({
    userId,
    progressionRunId,
    amountCents,
    type,
    sourceType: type === 'recovery-quest-drain' ? 'recovery-quest' : null,
    sourceEventKey,
    occurredAt,
    businessDate,
    activeQuestCount,
    levelRequirement,
    metadata,
    session,
  });
}

export async function applyEligibleTaskXpRewardWithinSession({ userId, run, occurrence, allocation, dailyRecord, occurredAt, session }) {
  if (!session || !dailyRecord) throw new TypeError('Task XP awards require the completion transaction and captured daily cap.');
  const sourceEventKey = `task-completion:${occurrence._id}`;
  const existing = await XpTransaction.findOne({ userId, progressionRunId: run._id, sourceEventKey }).session(session);
  if (existing) return { transaction: existing, idempotentReplay: true, rankEntryRewards: [], creditedXp: existing.amount.toString() };

  const fromLevel = getLevelFromTotalXp(run.totalXp);
  const currentRankSlug = getRankSlugForLevel(fromLevel);
  const multiplierBasisPoints = PROGRESSION_RANK_BY_SLUG[currentRankSlug].multiplierBasisPoints;
  const baseXpCents = allocation.baseXpCents;
  const calculatedXpCents = Math.floor((baseXpCents * multiplierBasisPoints + 5_000) / 10_000);
  const capRemainingBeforeCents = Math.max(0, dailyRecord.capAmountCents - dailyRecord.ordinaryXpCreditedCents);
  const actualXpCents = Math.min(calculatedXpCents, capRemainingBeforeCents);
  const reward = await applyXpLedgerChangeWithinSession({
    userId,
    progressionRunId: run._id,
    amountCents: actualXpCents,
    type: 'task-completion',
    sourceType: 'task-occurrence',
    sourceEntityId: occurrence._id,
    sourceEventKey,
    occurredAt,
    businessDate: occurrence.occurrenceDate,
    baseAmountCents: baseXpCents,
    multiplier: multiplierBasisPoints / 10_000,
    calculatedAmountCents: calculatedXpCents,
    dailyCapAmountCents: dailyRecord.capAmountCents,
    dailyCapRemainingBeforeCents: capRemainingBeforeCents,
    dailyCapRemainingAfterCents: capRemainingBeforeCents - actualXpCents,
    levelRequirement: getXpRequirement(fromLevel),
    metadata: { occurrenceId: String(occurrence._id), allocationId: String(allocation._id), capRankAtDayStart: dailyRecord.rankAtDayStart },
    session,
  });
  if (reward.stopped) throw new Error('The active progression run changed during Task XP award processing.');
  if (reward.idempotentReplay) return { ...reward, rankEntryRewards: [], creditedXp: decimalFromCents(reward.appliedCents) };

  const updatedDaily = await DailyXpRecord.updateOne({
    _id: dailyRecord._id,
    userId,
    date: occurrence.occurrenceDate,
    ordinaryXpCreditedCents: dailyRecord.ordinaryXpCreditedCents,
  }, {
    $inc: { ordinaryXpCreditedCents: actualXpCents },
    $push: { sourceEvents: { eventKey: sourceEventKey, xpTransactionId: reward.transaction._id } },
    $set: { updatedAt: occurredAt },
  }, { session, runValidators: true });
  if (updatedDaily.modifiedCount !== 1) throw new Error('The daily XP cap changed during Task XP award processing. Retry the transaction.');

  run.totalXp = reward.afterXp;
  run.level = reward.resultingLevel;
  run.currentRankSlug = getRankSlugForLevel(reward.resultingLevel);
  const rankEntryRewards = await processRankTransitionsWithinSession({
    userId,
    run,
    fromLevel: reward.levelBefore,
    sourceXpTransaction: reward.transaction,
    occurredAt,
    businessDate: occurrence.occurrenceDate,
    session,
  });
  const capRemainingAfterCents = Math.max(0, dailyRecord.capAmountCents - dailyRecord.ordinaryXpCreditedCents - actualXpCents);
  return {
    ...reward,
    idempotentReplay: false,
    baseXp: decimalFromCents(baseXpCents),
    multiplier: multiplierBasisPoints / 10_000,
    calculatedXp: decimalFromCents(calculatedXpCents),
    creditedXp: decimalFromCents(actualXpCents),
    dailyCap: decimalFromCents(dailyRecord.capAmountCents),
    dailyXpCredited: decimalFromCents(dailyRecord.ordinaryXpCreditedCents + actualXpCents),
    dailyXpRemaining: decimalFromCents(capRemainingAfterCents),
    capped: actualXpCents < calculatedXpCents,
    rankEntryRewards,
  };
}

export function toXpTransactionDto(transaction) {
  return {
    id: String(transaction._id),
    progressionRunId: String(transaction.progressionRunId),
    amount: transaction.amount?.toString?.() || '0.00',
    type: transaction.type,
    sourceType: transaction.sourceType || null,
    sourceEntityId: transaction.sourceEntityId ? String(transaction.sourceEntityId) : null,
    sourceEventKey: transaction.sourceEventKey,
    baseAmount: transaction.baseAmount?.toString?.() || null,
    multiplier: transaction.multiplier,
    calculatedAmount: transaction.calculatedAmount?.toString?.() || null,
    actualCreditedAmount: transaction.actualCreditedAmount?.toString?.() || null,
    dailyCapAmount: transaction.dailyCapAmount?.toString?.() || null,
    dailyCapRemainingBefore: transaction.dailyCapRemainingBefore?.toString?.() || null,
    dailyCapRemainingAfter: transaction.dailyCapRemainingAfter?.toString?.() || null,
    balanceBefore: transaction.balanceBefore?.toString?.() || '0.00',
    balanceAfter: transaction.balanceAfter?.toString?.() || '0.00',
    levelBefore: transaction.levelBefore,
    resultingLevel: transaction.resultingLevel,
    currentRankBefore: transaction.currentRankBefore || null,
    currentRankAfter: transaction.currentRankAfter || null,
    occurredAt: transaction.occurredAt.toISOString(),
    businessDate: transaction.businessDate || null,
    metadata: transaction.metadata || {},
  };
}

export function buildProgressionXpDto({ run, dailyRecord = null, date = getIstDateKey() }) {
  const totalXp = Number(run.totalXp) || 0;
  const currentLevel = getLevelFromTotalXp(totalXp);
  const currentRankSlug = getRankSlugForLevel(currentLevel);
  const currentRankIndex = rankOrder(currentRankSlug);
  const currentRank = PROGRESSION_RANK_BY_SLUG[currentRankSlug];
  const xpProgressCents = Math.max(0, xpToCents(totalXp) - getCumulativeXpThreshold(currentLevel) * 100);
  const xpRequirement = getXpRequirement(currentLevel);
  const capAmountCents = dailyRecord?.capAmountCents ?? getDailyXpCapCents(currentRankSlug);
  const creditedCents = dailyRecord?.ordinaryXpCreditedCents ?? 0;
  const nextRank = PROGRESSION_RANKS[currentRankIndex + 1] || null;

  return {
    configurationVersion: PROGRESSION_CONFIGURATION.version,
    currentLevel,
    totalXp: decimalFromCents(xpToCents(totalXp)),
    xpProgress: decimalFromCents(xpProgressCents),
    xpRequirement,
    xpRemaining: decimalFromCents(Math.max(0, xpRequirement * 100 - xpProgressCents)),
    levelProgressPercent: Math.min(100, Math.max(0, Math.floor((xpProgressCents / (xpRequirement * 100)) * 100))),
    currentRank: toRankBenefitDto(currentRank),
    dailyXp: {
      date,
      captured: Boolean(dailyRecord),
      rankAtDayStart: dailyRecord?.rankAtDayStart ?? currentRankSlug,
      capAmount: decimalFromCents(capAmountCents),
      credited: decimalFromCents(creditedCents),
      remaining: decimalFromCents(Math.max(0, capAmountCents - creditedCents)),
      capAmountCents,
      creditedCents,
      remainingCents: Math.max(0, capAmountCents - creditedCents),
    },
    nextRank: toRankBenefitDto(nextRank),
    highestDefinedRankReached: nextRank === null,
  };
}

export async function getProgressionXpSummary(userId, { now = new Date() } = {}) {
  const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 });
  if (!run) return null;
  const date = getIstDateKey(now);
  const dailyRecord = await DailyXpRecord.findOne({ userId, date });
  return buildProgressionXpDto({ run, dailyRecord, date });
}

export async function listProgressionXpTransactions(userId, { limit = 50, before = null, beforeId = null } = {}) {
  const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).select('_id');
  if (!run) return { transactions: [], nextCursor: null };
  const filter = { userId, progressionRunId: run._id };
  if (before && beforeId) {
    filter.$or = [
      { occurredAt: { $lt: new Date(before) } },
      { occurredAt: new Date(before), _id: { $lt: beforeId } },
    ];
  } else if (before) filter.occurredAt = { $lt: new Date(before) };
  const records = await XpTransaction.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(limit + 1);
  const hasMore = records.length > limit;
  const transactions = records.slice(0, limit);
  return {
    transactions: transactions.map(toXpTransactionDto),
    nextCursor: hasMore ? { occurredAt: transactions.at(-1).occurredAt.toISOString(), id: String(transactions.at(-1)._id) } : null,
  };
}
