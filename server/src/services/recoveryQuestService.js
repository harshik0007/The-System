import mongoose from 'mongoose';
import GracePointTransaction from '../models/GracePointTransaction.js';
import ProgressionResetEvent from '../models/ProgressionResetEvent.js';
import ProgressionRun from '../models/ProgressionRun.js';
import DailyDisciplineRecord from '../models/DailyDisciplineRecord.js';
import RecoveryQuest from '../models/RecoveryQuest.js';
import RecoveryQuestDailyReset from '../models/RecoveryQuestDailyReset.js';
import DailyXpRecord from '../models/DailyXpRecord.js';
import EmergencyPauseMonthlyUsage from '../models/EmergencyPauseMonthlyUsage.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import TaskSchedule from '../models/TaskSchedule.js';
import User from '../models/User.js';
import { EMERGENCY_PAUSE_ALLOWANCE } from '../config/emergencyPauseConfiguration.js';
import { ConflictError, NotFoundError } from '../utils/httpErrors.js';
import { addIstCalendarDays, getIstDateKey, getIstMidnightInstant, getIstMonthKey } from '../utils/ist.js';
import { getRankProgressionOrder, getRankSlugForLevel } from '../utils/ranks.js';
import { getEmergencyPauseResumeAt, isEmergencyPauseActive } from '../utils/emergencyPauseState.js';
import { ensureTaskOccurrencesWithinSession } from './taskOccurrenceService.js';
import { withMongoTransaction } from './mongoTransaction.js';
import { createNotificationWithinSession } from './notificationService.js';
import {
  freezeRecoveryQuestsForEmergencyPause,
  isEmergencyPauseDateWithinSession,
  isEmergencyPauseInstantWithinSession,
  reconcileEmergencyPauseWithinSession,
  resumeRecoveryQuestsAfterEmergencyPause,
  processEmergencyPauseForUser,
} from './emergencyPauseService.js';
import { finalizeDailyDisciplineWithinSession, initializeDisciplineForActiveRun, initializeDisciplineProgressionWithinSession } from './disciplineService.js';
import { createFreshProgressionRunWithinSession } from './progressionRunFactory.js';
import { applyXpAdjustment, buildProgressionXpDto, calculateRecoveryQuestDrainCents, ensureDailyXpRecordWithinSession, getCumulativeXpThreshold, getLevelFromTotalXp, getXpRequirement } from './progressionXpService.js';

export { getEmergencyPauseResumeAt, isEmergencyPauseActive };

export const RECOVERY_WINDOW_HOURS = 72;
export const ACTIVE_RECOVERY_QUEST_LIMIT = 5;
const HOUR_MS = 60 * 60 * 1000;

const asPlainSnapshot = (snapshot) => ({
  taskTitle: snapshot.title,
  taskDescription: snapshot.description || '',
  accountabilityActionTitle: snapshot.accountabilityAction.title,
  accountabilityActionDescription: snapshot.accountabilityAction.description,
  taskRevision: snapshot.revision,
});

function rankOrder(slug) { return getRankProgressionOrder(slug); }

function effectiveQuestExpiryAt(quest, run, at) {
  if (quest.remainingDurationMs == null) return quest.expiresAt;
  const pauseEnd = getEmergencyPauseResumeAt(run);
  if (!pauseEnd) return null;
  const pauseStart = run.emergencyPause?.activatedAt ? new Date(run.emergencyPause.activatedAt) : null;
  if (pauseStart && new Date(at).getTime() < pauseStart.getTime()) return quest.expiresAt;
  if (new Date(at).getTime() < pauseEnd.getTime()) return null;
  return new Date(pauseEnd.getTime() + Math.max(0, Number(quest.remainingDurationMs) || 0));
}

function resetBusinessDate(at) {
  return getIstDateKey(at);
}

async function createFreshRunWithinSession({ userId, user, oldRun, sourceEventKey, occurredAt, session }) {
  const previous = await ProgressionResetEvent.findOne({ userId, sourceEventKey }).session(session);
  if (previous) return { resetEvent: previous, run: await ProgressionRun.findById(previous.newRunId).session(session), idempotentReplay: true };

  const latest = await ProgressionRun.findOne({ userId }).sort({ runNumber: -1 }).select('runNumber').session(session);
  const dateKey = resetBusinessDate(occurredAt);
  const monthKey = getIstMonthKey(occurredAt);
  oldRun.status = 'ended';
  oldRun.endedAt = occurredAt;
  oldRun.endedOn = dateKey;
  oldRun.endReason = 'automatic-grace-exhaustion';
  await oldRun.save({ session });
  if (oldRun.taskScheduleId) {
    await TaskSchedule.updateOne({ _id: oldRun.taskScheduleId, userId, progressionRunId: oldRun._id, status: 'active' }, {
      $set: { status: 'archived', effectiveEndDate: dateKey },
    }, { session });
  }

  // The partial unique index permits one active run per User. End the old run
  // before inserting its replacement; the surrounding transaction rolls both
  // changes back together if any later write fails.
  const pauseUsage = await EmergencyPauseMonthlyUsage.findOne({ userId, monthKey }).session(session);
  const newRun = await createFreshProgressionRunWithinSession({
    userId,
    runNumber: (latest?.runNumber || oldRun.runNumber) + 1,
    startedAt: occurredAt,
    emergencyPauseActivationsUsed: pauseUsage?.activationsUsed ?? oldRun.emergencyPause?.activationsUsed ?? 0,
    session,
  });
  if (pauseUsage) {
    pauseUsage.progressionRunId = newRun._id;
    await pauseUsage.save({ session });
  }

  user.resetCount += 1;
  user.lifetimeLongestStreak = Math.max(user.lifetimeLongestStreak || 0, oldRun.longestStreak || 0);
  const currentRankSlug = getRankSlugForLevel(oldRun.level);
  if (rankOrder(currentRankSlug) > rankOrder(user.highestRankAchieved)) user.highestRankAchieved = currentRankSlug;
  user.currentProgressionRunId = newRun._id;
  await user.save({ session });

  const [resetEvent] = await ProgressionResetEvent.create([{
    userId,
    previousRunId: oldRun._id,
    newRunId: newRun._id,
    reason: 'automatic-grace-exhaustion',
    sourceEventKey,
    resetCountAfter: user.resetCount,
    occurredAt,
    businessDate: dateKey,
  }], { session });
  return { resetEvent, run: newRun, idempotentReplay: false };
}

async function deductGracePointWithinSession({ userId, run, sourceId, sourceEventKey, type, occurredAt, metadata = {}, session }) {
  const existing = await GracePointTransaction.findOne({ userId, sourceEventKey }).session(session);
  if (existing) return { transaction: existing, run, reset: null, idempotentReplay: true };
  if (run.status !== 'active' || run.gracePoints < 1) throw new ConflictError('GRACE_POINT_BALANCE_INVALID', 'The active progression run has no Grace Points available to deduct.');

  const before = run.gracePoints;
  const after = before - 1;
  const updated = await ProgressionRun.updateOne({ _id: run._id, userId, status: 'active', gracePoints: before }, { $set: { gracePoints: after } }, { session, runValidators: true });
  if (updated.modifiedCount !== 1) throw new Error('The Grace Point balance changed during the deduction. Retry the transaction.');
  run.gracePoints = after;

  const [transaction] = await GracePointTransaction.create([{
    userId,
    progressionRunId: run._id,
    delta: -1,
    type,
    sourceEntity: 'recovery-quest',
    sourceId,
    sourceEventKey,
    balanceBefore: before,
    balanceAfter: after,
    occurredAt,
    metadata,
  }], { session });
  if (after > 0) return { transaction, run, reset: null, idempotentReplay: false };

  const user = await User.findById(userId).session(session);
  if (!user || String(user.currentProgressionRunId || '') !== String(run._id)) {
    throw new ConflictError('PROGRESSION_RUN_CHANGED', 'The active progression run changed during Grace Point processing.');
  }
  const reset = await createFreshRunWithinSession({
    userId,
    user,
    oldRun: run,
    sourceEventKey: `automatic-reset:${sourceEventKey}`,
    occurredAt,
    session,
  });
  return { transaction, run, reset, idempotentReplay: false };
}

async function expireQuestWithinSession({ userId, run, quest, occurredAt, session }) {
  const expiredAt = new Date(quest.expiresAt || occurredAt);
  const updated = await RecoveryQuest.findOneAndUpdate({
    _id: quest._id, userId, progressionRunId: run._id, status: 'active',
  }, { $set: { status: 'expired', expiredAt, expiresAt: expiredAt, remainingDurationMs: null, pausedAt: null } }, { new: true, session, runValidators: true });
  if (!updated) return { processed: false, reset: null };
  const result = await deductGracePointWithinSession({
    userId,
    run,
    sourceId: quest._id,
    sourceEventKey: `recovery-quest-expiry:${quest._id}`,
    type: 'recovery-quest-expiry',
    occurredAt: expiredAt,
    metadata: { sourceOccurrenceId: String(quest.sourceOccurrenceId) },
    session,
  });
  updated.gracePointTransactionId = result.transaction._id;
  await updated.save({ session });
  await createNotificationWithinSession({
    userId, progressionRunId: run._id, category: 'recovery-quests', eventType: 'recovery-quest-expired',
    title: 'Recovery Quest expired',
    description: `“${updated.sourceSnapshot.taskTitle}” reached the end of its Recovery Window. A Grace Point was processed under the existing rules.`,
    targetRoute: '/app/recovery-quests', idempotencyKey: `recovery-quest-expired:${updated._id}`,
    occurredAt: expiredAt, session,
  });
  return { processed: true, reset: result.reset };
}

async function thresholdClearWithinSession({ userId, run, triggerQuest, occurredAt, session }) {
  const eventKey = `recovery-quest-threshold:${triggerQuest._id}`;
  const existing = await GracePointTransaction.findOne({ userId, sourceEventKey: eventKey }).session(session);
  if (existing) return { thresholdTriggered: true, reset: null, transaction: existing };
  const active = await RecoveryQuest.find({ userId, progressionRunId: run._id, status: 'active' }).sort({ activatedAt: 1, _id: 1 }).session(session);
  if (active.length <= ACTIVE_RECOVERY_QUEST_LIMIT) return { thresholdTriggered: false, reset: null, transaction: null };
  const questIds = active.map((quest) => quest._id);
  await RecoveryQuest.updateMany({ _id: { $in: questIds }, userId, progressionRunId: run._id, status: 'active' }, {
    $set: { status: 'threshold-cleared', thresholdClearedAt: occurredAt },
  }, { session, runValidators: true });
  const result = await deductGracePointWithinSession({
    userId,
    run,
    sourceId: triggerQuest._id,
    sourceEventKey: eventKey,
    type: 'sixth-quest-threshold',
    occurredAt,
    metadata: { clearedQuestIds: questIds.map(String), activeCountAtThreshold: active.length },
    session,
  });
  await RecoveryQuest.updateMany({ _id: { $in: questIds }, userId, progressionRunId: run._id, status: 'threshold-cleared' }, {
    $set: { thresholdTransactionId: result.transaction._id },
  }, { session });
  await createNotificationWithinSession({
    userId, progressionRunId: run._id, category: 'recovery-quests', eventType: 'recovery-quest-threshold-cleared',
    title: 'Recovery Quest threshold reached',
    description: 'The active Recovery Quests were cleared at the six-Quest threshold, with the existing Grace Point rule applied.',
    targetRoute: '/app/recovery-quests', idempotencyKey: `recovery-quest-threshold:${result.transaction._id}`,
    occurredAt, session,
  });
  return { thresholdTriggered: true, reset: result.reset, transaction: result.transaction };
}

async function processMissedOccurrencesWithinSession({ userId, run, schedule, dateKey, activatedAt, session }) {
  if (!schedule || dateKey < schedule.effectiveStartDate || (schedule.effectiveEndDate && dateKey > schedule.effectiveEndDate)) return { generated: 0, reset: null };
  await ensureTaskOccurrencesWithinSession({
    userId,
    progressionRunId: run._id,
    schedule,
    startDate: dateKey,
    endDate: dateKey,
    session,
  });
  const occurrences = await TaskOccurrence.find({
    userId,
    progressionRunId: run._id,
    taskScheduleId: schedule._id,
    occurrenceDate: dateKey,
    status: 'scheduled',
  }).sort({ cycleDay: 1, _id: 1 }).session(session);
  let generated = 0;
  for (const occurrence of occurrences) {
    const missed = await TaskOccurrence.findOneAndUpdate({ _id: occurrence._id, userId, progressionRunId: run._id, status: 'scheduled' }, {
      $set: { status: 'missed', missedAt: activatedAt },
    }, { new: true, session, runValidators: true });
    if (!missed) continue;
    await createNotificationWithinSession({
      userId, progressionRunId: run._id, category: 'tasks', eventType: 'task-finalized-missed',
      title: 'Task finalized as missed',
      description: `“${missed.snapshot.title}” was finalized as missed for ${dateKey}.`,
      targetRoute: `/app/tasks?date=${dateKey}`, idempotencyKey: `task-finalized-missed:${missed._id}`,
      occurredAt: activatedAt, session,
    });
    const action = missed.snapshot?.accountabilityAction;
    if (!action?.title || !action?.description) continue;
    const sourceEventKey = `missed-occurrence:${missed._id}`;
    const prior = await RecoveryQuest.findOne({ userId, sourceEventKey }).session(session);
    if (prior) continue;
    const expiresAt = new Date(activatedAt.getTime() + RECOVERY_WINDOW_HOURS * HOUR_MS);
    const [quest] = await RecoveryQuest.create([{
      userId,
      progressionRunId: run._id,
      sourceTaskId: missed.taskId,
      sourceOccurrenceId: missed._id,
      sourceEventKey,
      sourceSnapshot: asPlainSnapshot(missed.snapshot),
      activatedAt,
      baseExpiresAt: expiresAt,
      expiresAt,
      status: 'active',
    }], { session });
    generated += 1;
    await createNotificationWithinSession({
      userId, progressionRunId: run._id, category: 'recovery-quests', eventType: 'recovery-quest-activated',
      title: 'Recovery Quest activated',
      description: `A Recovery Quest was activated from the missed Task “${quest.sourceSnapshot.taskTitle}”.`,
      targetRoute: '/app/recovery-quests', idempotencyKey: `recovery-quest-activated:${quest._id}`,
      occurredAt: activatedAt, session,
    });
    const threshold = await thresholdClearWithinSession({ userId, run, triggerQuest: quest, occurredAt: activatedAt, session });
    if (threshold.reset) return { generated, reset: threshold.reset };
  }
  return { generated, reset: null };
}

async function processDailyResetWithinSession({ userId, run, resetDate, resetAt, protectedTaskDate = false, session }) {
  const dailyExisting = await RecoveryQuestDailyReset.findOne({ userId, progressionRunId: run._id, date: resetDate }).session(session);
  if (dailyExisting) return { processed: false, reset: null };
  const activeCandidates = await RecoveryQuest.find({
    userId,
    progressionRunId: run._id,
    status: 'active',
    activatedAt: { $lt: resetAt },
  }).sort({ activatedAt: 1, _id: 1 }).session(session);
  const active = activeCandidates.filter((quest) => {
    const expiryAt = effectiveQuestExpiryAt(quest, run, resetAt);
    return expiryAt && expiryAt.getTime() > resetAt.getTime();
  });
  const levelBefore = getLevelFromTotalXp(run.totalXp);
  const requirement = getXpRequirement(levelBefore);
  const drainCents = calculateRecoveryQuestDrainCents(levelBefore, active.length);
  let xpTransaction = null;
  if (active.length && drainCents > 0) {
    const result = await applyXpAdjustment({
      userId,
      progressionRunId: run._id,
      amountCents: -drainCents,
      sourceEventKey: `recovery-quest-drain:${run._id}:${resetDate}`,
      occurredAt: resetAt,
      activeQuestCount: active.length,
      levelRequirement: requirement,
      businessDate: resetDate,
      metadata: { resetDate },
      session,
    });
    xpTransaction = result.transaction;
    if (result.stopped) return { processed: false, reset: null };
    run.totalXp = result.afterXp;
    run.level = result.resultingLevel;
    run.currentRankSlug = getRankSlugForLevel(result.resultingLevel);
  } else {
    run.level = levelBefore;
    run.currentRankSlug = getRankSlugForLevel(levelBefore);
  }

  const [dailyRecord] = await RecoveryQuestDailyReset.create([{
    userId,
    progressionRunId: run._id,
    date: resetDate,
    status: 'completed',
    protectedTaskDate,
    activeQuestCount: active.length,
    xpTransactionId: xpTransaction?._id || null,
    processedAt: resetAt,
  }], { session });

  const schedule = await TaskSchedule.findOne({ userId, progressionRunId: run._id, status: 'active' }).session(session);
  const missedResult = protectedTaskDate
    ? { generated: 0, reset: null }
    : await processMissedOccurrencesWithinSession({
      userId,
      run,
      schedule,
      dateKey: addIstCalendarDays(resetDate, -1),
      activatedAt: resetAt,
      session,
    });
  run.recoveryQuestLastResetDate = resetDate;
  let disciplineResult = null;
  if (!missedResult.reset) {
    await run.save({ session });
    disciplineResult = await finalizeDailyDisciplineWithinSession({
      userId,
      run,
      date: addIstCalendarDays(resetDate, -1),
      finalizedAt: resetAt,
      protectedByEmergencyPause: protectedTaskDate,
      sourceDailyResetId: dailyRecord._id,
      session,
    });
  }
  return { processed: true, paused: false, activeQuestCount: active.length, generated: missedResult.generated, dailyRecord, disciplineRecord: disciplineResult?.record || null, reset: missedResult.reset };
}

export { freezeRecoveryQuestsForEmergencyPause, resumeRecoveryQuestsAfterEmergencyPause };

export async function listCurrentRecoveryQuests(userId, { now = new Date() } = {}) {
  let run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 });
  if (!run) return { progressionRunId: null, emergencyPauseActive: false, quests: [] };
  const paused = isEmergencyPauseActive(run, now);
  const quests = await RecoveryQuest.find({ userId, progressionRunId: run._id }).sort({ activatedAt: -1, _id: -1 });
  return {
    progressionRunId: String(run._id),
    emergencyPauseActive: paused,
    quests: quests.map((quest) => {
      const remainingWhilePaused = quest.remainingDurationMs ?? Math.max(0, quest.expiresAt.getTime() - new Date(run.emergencyPause?.activatedAt || now).getTime());
      const displayQuest = paused && quest.status === 'active' && quest.remainingDurationMs == null
        ? { ...quest.toObject(), remainingDurationMs: remainingWhilePaused }
        : quest;
      const pauseEnd = paused ? getEmergencyPauseResumeAt(run) : null;
      const effectiveExpiry = paused && quest.status === 'active' && pauseEnd
        ? new Date(pauseEnd.getTime() + Math.max(0, Number(displayQuest.remainingDurationMs) || 0))
        : effectiveQuestExpiryAt(displayQuest, run, now) || quest.expiresAt;
      return ({
      id: String(quest._id),
      progressionRunId: String(quest.progressionRunId),
      sourceTaskId: String(quest.sourceTaskId),
      sourceOccurrenceId: String(quest.sourceOccurrenceId),
      sourceTaskName: quest.sourceSnapshot.taskTitle,
      sourceTaskDescription: quest.sourceSnapshot.taskDescription,
      accountabilityActionTitle: quest.sourceSnapshot.accountabilityActionTitle,
      accountabilityActionDescription: quest.sourceSnapshot.accountabilityActionDescription,
      taskRevision: quest.sourceSnapshot.taskRevision,
      activatedAt: quest.activatedAt.toISOString(),
      expiresAt: effectiveExpiry.toISOString(),
      remainingMs: paused && quest.remainingDurationMs != null
        ? quest.remainingDurationMs
        : paused && quest.status === 'active' ? remainingWhilePaused : Math.max(0, effectiveExpiry.getTime() - new Date(now).getTime()),
      status: quest.status,
      completedAt: quest.completedAt?.toISOString?.() || null,
      expiredAt: quest.expiredAt?.toISOString?.() || null,
      thresholdClearedAt: quest.thresholdClearedAt?.toISOString?.() || null,
      gracePointTransactionId: quest.gracePointTransactionId ? String(quest.gracePointTransactionId) : null,
      thresholdTransactionId: quest.thresholdTransactionId ? String(quest.thresholdTransactionId) : null,
    });
    }),
  };
}

export async function completeCurrentRecoveryQuest({ userId, questId, now = new Date() }) {
  if (!mongoose.isValidObjectId(questId)) throw new NotFoundError('The Recovery Quest was not found.');
  return withMongoTransaction(async (session) => {
    const user = await User.findById(userId).session(session);
    const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).session(session);
    if (!user || !run || String(user.currentProgressionRunId || '') !== String(run._id)) throw new NotFoundError('An active progression run was not found.');
    const pause = await reconcileEmergencyPauseWithinSession({ userId, run, now: new Date(now), session });
    if (pause.active) throw new ConflictError('EMERGENCY_PAUSE_ACTIVE', 'Recovery Quests are frozen during Emergency Pause.');
    const quest = await RecoveryQuest.findOne({ _id: questId, userId, progressionRunId: run._id }).session(session);
    if (!quest) throw new NotFoundError('The Recovery Quest was not found.');
    if (quest.status !== 'active') throw new ConflictError('RECOVERY_QUEST_NOT_ACTIVE', 'Only an active Recovery Quest can be completed.');
    if (quest.expiresAt.getTime() <= new Date(now).getTime()) throw new ConflictError('RECOVERY_QUEST_EXPIRED', 'This Recovery Quest has expired and cannot be completed.');
    quest.status = 'completed';
    quest.completedAt = now;
    quest.remainingDurationMs = null;
    quest.pausedAt = null;
    await quest.save({ session });
    await createNotificationWithinSession({
      userId, progressionRunId: run._id, category: 'recovery-quests', eventType: 'recovery-quest-completed',
      title: 'Recovery Quest completed',
      description: `The Recovery Quest from “${quest.sourceSnapshot.taskTitle}” was completed.`,
      targetRoute: '/app/recovery-quests', idempotencyKey: `recovery-quest-completed:${quest._id}`,
      occurredAt: now, session,
    });
    return { questId: String(quest._id), status: quest.status, completedAt: quest.completedAt.toISOString(), idempotentReplay: false };
  });
}

export async function getCurrentGracePoints(userId) {
  const user = await User.findById(userId).select('currentProgressionRunId');
  const run = user?.currentProgressionRunId
    ? await ProgressionRun.findOne({ _id: user.currentProgressionRunId, userId, status: 'active' })
    : await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 });
  return { progressionRunId: run ? String(run._id) : null, balance: run?.gracePoints ?? 3 };
}

export async function listCurrentGracePointTransactions(userId, { limit = 50 } = {}) {
  const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).select('_id');
  if (!run) return [];
  const transactions = await GracePointTransaction.find({ userId, progressionRunId: run._id }).sort({ occurredAt: -1, _id: -1 }).limit(limit);
  return transactions.map((event) => ({
    id: String(event._id), progressionRunId: String(event.progressionRunId), delta: event.delta, type: event.type,
    sourceEntity: event.sourceEntity, sourceId: String(event.sourceId), sourceEventKey: event.sourceEventKey,
    balanceBefore: event.balanceBefore, balanceAfter: event.balanceAfter, occurredAt: event.occurredAt.toISOString(), metadata: event.metadata || {},
  }));
}

export async function getCurrentProgressionSnapshot(userId, { now = new Date() } = {}) {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('The Member identity was not found.');
  const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 });
  if (!run) return { progression: null, resetCount: user.resetCount, lifetimeLongestStreak: user.lifetimeLongestStreak, highestRankAchieved: user.highestRankAchieved, memberSince: user.memberSince, recentReset: null };
  const pauseActive = isEmergencyPauseActive(run, now);
  const today = getIstDateKey(now);
  const dailyXpRecord = await DailyXpRecord.findOne({ userId, progressionRunId: run._id, date: today });
  const xpSummary = buildProgressionXpDto({ run, dailyRecord: dailyXpRecord, date: today });
  const [recentReset] = await ProgressionResetEvent.find({ userId }).sort({ occurredAt: -1 }).limit(1);
  return {
    progression: {
      id: String(run._id),
      runNumber: run.runNumber,
      currentRankSlug: run.currentRankSlug,
      level: run.level,
      totalXp: Number(run.totalXp),
      nextLevelRequirement: getXpRequirement(run.level),
      levelXpEarned: Math.max(0, Math.round((Number(run.totalXp) - getCumulativeXpThreshold(run.level)) * 100) / 100),
      levelProgressPercent: Math.min(100, Math.max(0, Math.floor(((Number(run.totalXp) - getCumulativeXpThreshold(run.level)) / getXpRequirement(run.level)) * 100))),
      gracePoints: run.gracePoints,
      disciplinePoints: run.disciplinePoints,
      currentStreak: run.currentStreak,
      longestStreak: run.longestStreak,
      taskScheduleId: run.taskScheduleId ? String(run.taskScheduleId) : null,
      requiresScheduleSetup: !run.taskScheduleId,
      emergencyPauseActive: pauseActive,
      emergencyPauseResumesAt: getEmergencyPauseResumeAt(run)?.toISOString?.() || null,
      emergencyPauseAllowanceUsed: run.emergencyPause?.activationsUsed || 0,
      emergencyPauseAllowance: EMERGENCY_PAUSE_ALLOWANCE,
      startedAt: run.startedAt.toISOString(),
      startedOn: run.startedOn,
      xpSummary,
    },
    resetCount: user.resetCount,
    lifetimeLongestStreak: user.lifetimeLongestStreak,
    highestRankAchieved: user.highestRankAchieved,
    memberSince: user.memberSince,
    recentReset: recentReset ? {
      id: String(recentReset._id),
      reason: recentReset.reason,
      occurredAt: recentReset.occurredAt.toISOString(),
      resetCount: recentReset.resetCountAfter ?? user.resetCount,
      newProgressionRunId: String(recentReset.newRunId),
    } : null,
  };
}

export async function processDueRecoveryQuestExpiry({ userId, cutoff = new Date() }) {
  return withMongoTransaction(async (session) => {
    const user = await User.findById(userId).session(session);
    const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).session(session);
    if (!user || !run || String(user.currentProgressionRunId || '') !== String(run._id)) return { processed: false, reset: null };
    const pause = await reconcileEmergencyPauseWithinSession({ userId, run, now: new Date(cutoff), session });
    if (pause.active) return { processed: false, paused: true, reset: null };
    const quest = await RecoveryQuest.findOne({
      userId,
      progressionRunId: run._id,
      status: 'active',
      expiresAt: { $lte: cutoff },
      remainingDurationMs: null,
    }).sort({ expiresAt: 1, _id: 1 }).session(session);
    if (!quest) return { processed: false, reset: null };
    const result = await expireQuestWithinSession({ userId, run, quest, occurredAt: new Date(cutoff), session });
    return { ...result, questId: String(quest._id), resetCount: result.reset?.resetEvent?.resetCountAfter || null };
  });
}

export async function processRecoveryQuestDailyReset({ userId, resetDate, now = new Date() }) {
  const resetAt = getIstMidnightInstant(resetDate);
  if (resetAt.getTime() > new Date(now).getTime()) return { processed: false, future: true };
  return withMongoTransaction(async (session) => {
    const user = await User.findById(userId).session(session);
    const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).session(session);
    if (!user || !run || String(user.currentProgressionRunId || '') !== String(run._id)) return { processed: false, reset: null };
    await reconcileEmergencyPauseWithinSession({ userId, run, now: new Date(now), session });
    await initializeDisciplineProgressionWithinSession({ userId, run, activationDate: getIstDateKey(now), session });
    const lastResetDate = run.recoveryQuestLastResetDate || run.startedOn;
    if (resetDate <= lastResetDate) {
      const disciplineRecord = await DailyDisciplineRecord.findOne({
        userId,
        progressionRunId: run._id,
        date: addIstCalendarDays(resetDate, -1),
      }).session(session);
      return { processed: false, duplicate: true, disciplineRecord, reset: null };
    }
    const priorReset = await RecoveryQuestDailyReset.findOne({ userId, progressionRunId: run._id, date: resetDate }).session(session);
    if (priorReset) {
      const priorTaskDate = addIstCalendarDays(resetDate, -1);
      const protectedTaskDate = Boolean(priorReset.protectedTaskDate || priorReset.status === 'skipped-emergency-pause');
      const schedule = run.taskScheduleId
        ? await TaskSchedule.findOne({ _id: run.taskScheduleId, userId, progressionRunId: run._id }).session(session)
        : null;
      if (schedule?.status === 'active' && !protectedTaskDate) {
        await ensureTaskOccurrencesWithinSession({ userId, progressionRunId: run._id, schedule, startDate: priorTaskDate, endDate: priorTaskDate, session });
      }
      const disciplineResult = await finalizeDailyDisciplineWithinSession({
        userId,
        run,
        date: priorTaskDate,
        finalizedAt: priorReset.processedAt || resetAt,
        protectedByEmergencyPause: protectedTaskDate,
        sourceDailyResetId: priorReset._id,
        session,
      });
      run.recoveryQuestLastResetDate = resetDate;
      await run.save({ session });
      return { processed: false, duplicate: true, disciplineRecord: disciplineResult?.record || null, reset: null };
    }
    // Freeze the daily cap tier from the Rank held at midnight, before any
    // XP drain, Quest-expiry reset, or later Task reward can change current Rank.
    await ensureDailyXpRecordWithinSession({ userId, run, date: resetDate, occurredAt: resetAt, session });
    const priorTaskDate = addIstCalendarDays(resetDate, -1);
    const protectedTaskDate = await isEmergencyPauseDateWithinSession({ userId, progressionRunId: run._id, date: priorTaskDate, run, session });
    const pauseAtReset = await isEmergencyPauseInstantWithinSession({ userId, progressionRunId: run._id, instant: resetAt, run, session });
    if (pauseAtReset) {
      const [pausedRecord] = await RecoveryQuestDailyReset.create([{
        userId, progressionRunId: run._id, date: resetDate, status: 'skipped-emergency-pause', protectedTaskDate, activeQuestCount: 0, processedAt: resetAt,
      }], { session });
      if (!protectedTaskDate) {
        const schedule = run.taskScheduleId
          ? await TaskSchedule.findOne({ _id: run.taskScheduleId, userId, progressionRunId: run._id }).session(session)
          : null;
        if (schedule?.status === 'active') {
          await ensureTaskOccurrencesWithinSession({ userId, progressionRunId: run._id, schedule, startDate: priorTaskDate, endDate: priorTaskDate, session });
        }
      }
      const disciplineResult = await finalizeDailyDisciplineWithinSession({
        userId,
        run,
        date: priorTaskDate,
        finalizedAt: resetAt,
        protectedByEmergencyPause: protectedTaskDate,
        sourceDailyResetId: pausedRecord._id,
        session,
      });
      run.recoveryQuestLastResetDate = resetDate;
      await run.save({ session });
      return { processed: true, paused: true, disciplineRecord: disciplineResult?.record || null, reset: null };
    }
    // Expiries at or before this reset precede drain and missed-task generation.
    const activeQuests = await RecoveryQuest.find({ userId, progressionRunId: run._id, status: 'active' }).sort({ activatedAt: 1, _id: 1 }).session(session);
    const dueQuests = activeQuests
      .map((quest) => ({ quest, expiresAt: effectiveQuestExpiryAt(quest, run, resetAt) }))
      .filter(({ expiresAt }) => expiresAt && expiresAt.getTime() <= resetAt.getTime())
      .sort((left, right) => left.expiresAt - right.expiresAt || String(left.quest._id).localeCompare(String(right.quest._id)));
    for (const { quest, expiresAt } of dueQuests) {
      quest.expiresAt = expiresAt;
      quest.remainingDurationMs = null;
      quest.pausedAt = null;
      const expiry = await expireQuestWithinSession({ userId, run, quest, occurredAt: resetAt, session });
      if (expiry.reset) return { processed: true, reset: expiry.reset, stoppedOldRun: true };
    }
    return processDailyResetWithinSession({ userId, run, resetDate, resetAt, protectedTaskDate, session });
  });
}

export async function processRecoveryQuestResetForUser({ userId, now = new Date() }) {
  const current = new Date(now);
  const today = getIstDateKey(current);
  let processed = 0;
  let reset = null;
  // Reset date represents the IST midnight at the beginning of that date.
  for (let guard = 0; guard < 3700; guard += 1) {
    const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).select('recoveryQuestLastResetDate startedOn');
    if (!run) break;
    const last = run.recoveryQuestLastResetDate || run.startedOn;
    const nextDate = addIstCalendarDays(last, 1);
    if (nextDate > today || getIstMidnightInstant(nextDate).getTime() > current.getTime()) break;
    const result = await processRecoveryQuestDailyReset({ userId, resetDate: nextDate, now: current });
    if (result.processed) processed += 1;
    if (result.reset) { reset = result.reset; break; }
    if (!result.processed && !result.duplicate) break;
  }
  return { processed, reset };
}

export async function processRecoveryQuestWorkerUser({ userId, now = new Date() }) {
  const current = new Date(now);
  const pauseTransition = await processEmergencyPauseForUser({ userId, now: current });
  await initializeDisciplineForActiveRun(userId, { now: current });
  const due = await processRecoveryQuestResetForUser({ userId, now: current });
  if (due.reset) return { ...due, pauseTransition };
  let expiries = 0;
  for (let guard = 0; guard < 1000; guard += 1) {
    const result = await processDueRecoveryQuestExpiry({ userId, cutoff: current });
    if (!result.processed) {
      if (result.reset) return { ...due, reset: result.reset, expiries, pauseTransition };
      break;
    }
    expiries += 1;
    if (result.reset) return { ...due, reset: result.reset, expiries, pauseTransition };
  }
  return { ...due, expiries, pauseTransition };
}

export function toRecoveryQuestDto(quest, now = new Date(), paused = false) {
  return {
    id: String(quest._id),
    progressionRunId: String(quest.progressionRunId),
    sourceTaskId: String(quest.sourceTaskId),
    sourceOccurrenceId: String(quest.sourceOccurrenceId),
    sourceTaskName: quest.sourceSnapshot.taskTitle,
    sourceTaskDescription: quest.sourceSnapshot.taskDescription,
    accountabilityActionTitle: quest.sourceSnapshot.accountabilityActionTitle,
    accountabilityActionDescription: quest.sourceSnapshot.accountabilityActionDescription,
    taskRevision: quest.sourceSnapshot.taskRevision,
    activatedAt: quest.activatedAt.toISOString(),
    expiresAt: quest.expiresAt.toISOString(),
    remainingMs: paused && quest.remainingDurationMs != null ? quest.remainingDurationMs : Math.max(0, quest.expiresAt.getTime() - new Date(now).getTime()),
    status: quest.status,
    completedAt: quest.completedAt?.toISOString?.() || null,
    expiredAt: quest.expiredAt?.toISOString?.() || null,
    thresholdClearedAt: quest.thresholdClearedAt?.toISOString?.() || null,
    gracePointTransactionId: quest.gracePointTransactionId ? String(quest.gracePointTransactionId) : null,
    thresholdTransactionId: quest.thresholdTransactionId ? String(quest.thresholdTransactionId) : null,
  };
}
