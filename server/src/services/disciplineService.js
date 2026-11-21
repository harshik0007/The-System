import mongoose from 'mongoose';
import DailyDisciplineRecord from '../models/DailyDisciplineRecord.js';
import DisciplinePointTransaction from '../models/DisciplinePointTransaction.js';
import DisciplineRewardCycle from '../models/DisciplineRewardCycle.js';
import GracePointTransaction from '../models/GracePointTransaction.js';
import ProgressionRun from '../models/ProgressionRun.js';
import RecoveryQuestDailyReset from '../models/RecoveryQuestDailyReset.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import TaskSchedule from '../models/TaskSchedule.js';
import User from '../models/User.js';
import { PROGRESSION_CONFIGURATION, PROGRESSION_RANK_BY_SLUG, toRankBenefitDto } from '../config/progressionConfiguration.js';
import { ConflictError, NotFoundError } from '../utils/httpErrors.js';
import { addIstCalendarDays, getIstDateKey, isValidIstDateKey } from '../utils/ist.js';
import { isEmergencyPauseActive } from '../utils/emergencyPauseState.js';
import { getRankSlugForLevel } from '../utils/ranks.js';
import { calculateRewardCycleProgress, calculateStreakResult, getDailyQualificationStatus, REQUIRED_DAILY_COMPLETIONS } from '../utils/disciplineRules.js';
import { deriveDisciplineRewardCycleCalendar, getDisciplineRewardCycleCalendarStatus, initializeDisciplineRewardCycleCalendar } from '../utils/disciplineRewardCycleCalendar.js';
import { ensureTaskOccurrencesWithinSession } from './taskOccurrenceService.js';
import { withMongoTransaction } from './mongoTransaction.js';
import { createNotificationWithinSession } from './notificationService.js';
import { isEmergencyPauseDateWithinSession } from './emergencyPauseService.js';

export const DISCIPLINE_TASK_MINIMUM = REQUIRED_DAILY_COMPLETIONS;
export const DP_WALLET_CAP_CENTS = PROGRESSION_CONFIGURATION.disciplinePointWalletCapCents;
export const DP_REDEMPTION_COOLDOWN_MS = 72 * 60 * 60 * 1000;

const centsFromDp = (value) => Math.max(0, Math.round((Number(value) + Number.EPSILON) * 100));
const dpFromCents = (value) => Math.max(0, Math.round(value)) / 100;
const iso = (value) => value ? new Date(value).toISOString() : null;

function cycleConfig(rankSlug) {
  const rank = PROGRESSION_RANK_BY_SLUG[rankSlug] || PROGRESSION_RANK_BY_SLUG.origin;
  return {
    rank,
    requiredQualifyingDays: rank.recurringDpPreview.qualifyingDays,
    rewardAmountCents: rank.recurringDpPreview.rewardDpCents,
  };
}

function nextRewardCycleDto(rankSlug) {
  const { rank, requiredQualifyingDays, rewardAmountCents } = cycleConfig(rankSlug);
  return {
    rank: { slug: rank.slug, number: rank.number, name: rank.name },
    requiredQualifyingDays,
    rewardAmount: dpFromCents(rewardAmountCents).toFixed(2),
  };
}

function mirrorRewardCycle(run, cycle) {
  run.rewardCycle = {
    cycleNumber: cycle.cycleNumber,
    qualifiedDays: cycle.completedQualifyingDays,
    rewardCycleId: cycle._id,
    rankSlug: cycle.rankSlug,
    requiredQualifyingDays: cycle.requiredQualifyingDays,
    rewardDpCents: cycle.rewardAmountCents,
    startedOn: cycle.startDate,
  };
}

/** Creates one rank-snapshotted recurring reward cycle inside its caller's transaction. */
export async function ensureActiveDisciplineRewardCycleWithinSession({ userId, run, startDate, session }) {
  if (!session) throw new TypeError('Discipline reward-cycle writes require the caller transaction.');
  let cycle = await DisciplineRewardCycle.findOne({ userId, progressionRunId: run._id, status: 'active' }).session(session);
  if (cycle) {
    if (initializeDisciplineRewardCycleCalendar(cycle)) await cycle.save({ session });
    mirrorRewardCycle(run, cycle);
    return cycle;
  }

  const latest = await DisciplineRewardCycle.findOne({ userId, progressionRunId: run._id }).sort({ cycleNumber: -1 }).select('cycleNumber').session(session);
  const number = (latest?.cycleNumber || 0) + 1;
  const rankSlug = getRankSlugForLevel(run.level);
  const { rank, requiredQualifyingDays, rewardAmountCents } = cycleConfig(rankSlug);
  [cycle] = await DisciplineRewardCycle.create([{
    userId,
    progressionRunId: run._id,
    cycleNumber: number,
    rankSlug,
    rankNumber: rank.number,
    rankName: rank.name,
    requiredQualifyingDays,
    completedQualifyingDays: 0,
    rewardAmountCents,
    startDate,
    ...deriveDisciplineRewardCycleCalendar({ startDate, requiredQualifyingDays }),
    status: 'active',
    configurationVersion: PROGRESSION_CONFIGURATION.version,
  }], { session });
  run.disciplineStartedOn ||= startDate;
  mirrorRewardCycle(run, cycle);
  await run.save({ session });
  return cycle;
}

/** Initial run setup is atomic with the run creation/reset that called it. */
export async function startDisciplineForNewRunWithinSession({ userId, run, startDate = run.startedOn, session }) {
  run.disciplineStartedOn = startDate;
  return ensureActiveDisciplineRewardCycleWithinSession({ userId, run, startDate, session });
}

export async function initializeDisciplineProgressionWithinSession({ userId, run, activationDate, session }) {
  if (!run.disciplineStartedOn) run.disciplineStartedOn = activationDate;
  await ensureActiveDisciplineRewardCycleWithinSession({ userId, run, startDate: run.disciplineStartedOn, session });
  if (run.isModified()) await run.save({ session });
}

export async function initializeDisciplineForActiveRun(userId, { now = new Date() } = {}) {
  const activationDate = getIstDateKey(now);
  return withMongoTransaction(async (session) => {
    const user = await User.findById(userId).session(session);
    const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).session(session);
    if (!user || !run || String(user.currentProgressionRunId || '') !== String(run._id)) return null;
    await initializeDisciplineProgressionWithinSession({ userId, run, activationDate, session });
    return String(run._id);
  });
}

function cycleDto(cycle, now = new Date()) {
  if (!cycle) return null;
  const calendar = getDisciplineRewardCycleCalendarStatus(cycle, now);
  return {
    id: String(cycle._id),
    progressionRunId: String(cycle.progressionRunId),
    cycleNumber: cycle.cycleNumber,
    rank: { slug: cycle.rankSlug, number: cycle.rankNumber, name: cycle.rankName },
    requiredQualifyingDays: cycle.requiredQualifyingDays,
    completedQualifyingDays: cycle.completedQualifyingDays,
    remainingQualifyingDays: Math.max(0, cycle.requiredQualifyingDays - cycle.completedQualifyingDays),
    cycleStartedAt: iso(calendar.cycleStartedAt),
    baselineTargetDate: calendar.baselineTargetDate,
    baselineTargetAt: iso(calendar.baselineTargetAt),
    calendarDaysRemaining: calendar.calendarDaysRemaining,
    calendarTargetPassed: calendar.calendarTargetPassed,
    calendarStatus: calendar.calendarStatus,
    rewardAmount: dpFromCents(cycle.rewardAmountCents).toFixed(2),
    actualCreditedAmount: cycle.actualCreditedCents == null ? null : dpFromCents(cycle.actualCreditedCents).toFixed(2),
    startDate: cycle.startDate,
    completionDate: cycle.completionDate,
    completedAt: iso(cycle.completedAt),
    status: cycle.status,
  };
}

function occurrenceCounts(occurrences) {
  const unique = new Map();
  for (const occurrence of occurrences) {
    if (occurrence.status === 'cancelled') continue;
    // One original Task can contribute only one occurrence per IST date/run.
    // Deduplicate by Task ID as a defense for legacy data created before the
    // unique occurrence index was installed.
    unique.set(String(occurrence.taskId || occurrence._id), occurrence);
  }
  const list = [...unique.values()];
  return {
    occurrences: list,
    scheduled: list.length,
    completed: list.filter((occurrence) => occurrence.status === 'completed').length,
  };
}

function redemptionDto(run, now) {
  const cooldownUntil = run?.dpRedemptionCooldownUntil || null;
  const remainingMs = Math.max(0, cooldownUntil ? new Date(cooldownUntil).getTime() - now.getTime() : 0);
  const dpCents = centsFromDp(run?.disciplinePoints || 0);
  return {
    cooldownHours: DP_REDEMPTION_COOLDOWN_MS / (60 * 60 * 1000),
    lastRedeemedAt: iso(run?.dpRedemptionLastAt),
    availableAt: iso(cooldownUntil),
    remainingMs,
    eligible: Boolean(run && dpCents >= 100 && remainingMs === 0),
    exchange: { disciplinePoints: '1.00', gracePoints: 1 },
  };
}

export async function getDisciplineSummary(userId, { now = new Date() } = {}) {
  const instant = new Date(now);
  const today = getIstDateKey(instant);
  return withMongoTransaction(async (session) => {
    const user = await User.findById(userId).session(session);
    if (!user) throw new NotFoundError('The Member identity was not found.');
    const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).session(session);
    if (!run || String(user.currentProgressionRunId || '') !== String(run._id)) {
      return {
        progressionRunId: null,
        memberSince: user.memberSince,
        disciplineStartedOn: null,
        currentStreak: 0,
        runLongestStreak: 0,
        lifetimeLongestStreak: user.lifetimeLongestStreak,
        totalQualifyingDays: 0,
        totalCompletedScheduledTasks: 0,
        dpBalance: '0.00',
        disciplinePointWalletCap: dpFromCents(DP_WALLET_CAP_CENTS).toFixed(2),
        gracePointBalance: 0,
        currentRank: null,
        today: { date: today, status: 'in-progress', scheduledOriginalTaskCount: 0, completedOriginalTaskCount: 0, requiredTaskCount: DISCIPLINE_TASK_MINIMUM, emergencyPauseProtected: false },
        activeRewardCycle: null,
        nextCycleRank: null,
        nextRewardCycle: null,
        redemption: redemptionDto(null, instant),
        emergencyPauseActive: false,
        recentDpTransactions: [],
      };
    }

    await initializeDisciplineProgressionWithinSession({ userId, run, activationDate: today, session });
    const schedule = run.taskScheduleId
      ? await TaskSchedule.findOne({ _id: run.taskScheduleId, userId, progressionRunId: run._id }).session(session)
      : null;
    if (schedule?.status === 'active') {
      await ensureTaskOccurrencesWithinSession({ userId, progressionRunId: run._id, schedule, startDate: today, endDate: today, session });
    }
    const occurrenceRows = await TaskOccurrence.find({ userId, progressionRunId: run._id, occurrenceDate: today }).session(session);
    const todayCounts = occurrenceCounts(occurrenceRows);
    const todayRecord = await DailyDisciplineRecord.findOne({ userId, progressionRunId: run._id, date: today }).session(session);
    const pauseActive = isEmergencyPauseActive(run, instant);
    const todayProtected = await isEmergencyPauseDateWithinSession({ userId, progressionRunId: run._id, date: today, run, session });
    const todayStatus = todayRecord?.qualificationStatus
      || (todayProtected ? 'emergency-pause-protected' : 'in-progress');

    const records = await DailyDisciplineRecord.find({ userId, progressionRunId: run._id }).select('date completedOriginalTaskCount qualificationStatus').session(session);
    const totalQualifyingDays = records.filter((record) => record.qualificationStatus === 'qualified').length;
    const totalCompletedScheduledTasks = records
      .filter((record) => record.date !== today)
      .reduce((sum, record) => sum + record.completedOriginalTaskCount, todayRecord?.completedOriginalTaskCount ?? todayCounts.completed);
    const activeCycle = await DisciplineRewardCycle.findOne({ userId, progressionRunId: run._id, status: 'active' }).session(session);
    const currentRankSlug = getRankSlugForLevel(run.level);
    const currentRank = PROGRESSION_RANK_BY_SLUG[currentRankSlug];
    const nextRank = PROGRESSION_RANK_BY_SLUG[
      currentRankSlug === 'continuum' ? 'continuum' : PROGRESSION_CONFIGURATION.ranks[PROGRESSION_CONFIGURATION.ranks.findIndex((item) => item.slug === currentRankSlug) + 1]?.slug
    ] || currentRank;
    const recentDpTransactions = await DisciplinePointTransaction.find({ userId, progressionRunId: run._id })
      .sort({ occurredAt: -1, _id: -1 }).limit(4).session(session);

    return {
      progressionRunId: String(run._id),
      memberSince: user.memberSince,
      disciplineStartedOn: run.disciplineStartedOn,
      runNumber: run.runNumber,
      currentStreak: run.currentStreak,
      runLongestStreak: run.longestStreak,
      lifetimeLongestStreak: user.lifetimeLongestStreak,
      totalQualifyingDays,
      totalCompletedScheduledTasks,
      dpBalance: dpFromCents(centsFromDp(run.disciplinePoints)).toFixed(2),
      disciplinePointWalletCap: dpFromCents(DP_WALLET_CAP_CENTS).toFixed(2),
      gracePointBalance: run.gracePoints,
      currentRank: toRankBenefitDto(currentRank),
      today: {
        date: today,
        status: todayStatus,
        scheduledOriginalTaskCount: todayRecord?.scheduledOriginalTaskCount ?? todayCounts.scheduled,
        completedOriginalTaskCount: todayRecord?.completedOriginalTaskCount ?? todayCounts.completed,
        requiredTaskCount: DISCIPLINE_TASK_MINIMUM,
        emergencyPauseProtected: todayStatus === 'emergency-pause-protected',
        finalizedAt: iso(todayRecord?.finalizedAt),
      },
      activeRewardCycle: cycleDto(activeCycle, instant),
      nextCycleRank: { slug: nextRank.slug, number: nextRank.number, name: nextRank.name },
      nextRewardCycle: nextRewardCycleDto(currentRankSlug),
      redemption: redemptionDto(run, instant),
      emergencyPauseActive: pauseActive,
      emergencyPauseResumesAt: iso(run.emergencyPause?.resumesAt),
      recentDpTransactions: recentDpTransactions.map((event) => ({
        id: String(event._id),
        type: event.type,
        delta: dpFromCents(event.deltaCents).toFixed(2),
        calculatedDelta: event.calculatedDeltaCents == null ? null : dpFromCents(Math.abs(event.calculatedDeltaCents)).toFixed(2),
        businessDate: event.businessDate,
        occurredAt: event.occurredAt.toISOString(),
        metadata: event.metadata || {},
      })),
    };
  });
}

export async function getDisciplineCalendar(userId, { startDate, endDate, now = new Date() } = {}) {
  const today = getIstDateKey(now);
  const end = endDate || today;
  const start = startDate || addIstCalendarDays(end, -364);
  if (!isValidIstDateKey(start) || !isValidIstDateKey(end) || start > end) throw new TypeError('A valid inclusive IST calendar date range is required.');
  const user = await User.findById(userId).select('currentProgressionRunId memberSince');
  const run = user?.currentProgressionRunId
    ? await ProgressionRun.findOne({ _id: user.currentProgressionRunId, userId, status: 'active' }).select('_id')
    : null;
  if (!run) return { progressionRunId: null, memberSince: user?.memberSince || null, startDate: start, endDate: end, records: [] };
  const records = await DailyDisciplineRecord.find({ userId, progressionRunId: run._id, date: { $gte: start, $lte: end } }).sort({ date: 1 });
  return {
    progressionRunId: String(run._id),
    memberSince: user.memberSince,
    startDate: start,
    endDate: end,
    records: records.map((record) => ({
      id: String(record._id),
      progressionRunId: String(record.progressionRunId),
      date: record.date,
      scheduledTaskCount: record.scheduledOriginalTaskCount,
      completedTaskCount: record.completedOriginalTaskCount,
      completionPercent: record.scheduledOriginalTaskCount ? Math.round(record.completedOriginalTaskCount / record.scheduledOriginalTaskCount * 100) : 0,
      qualificationStatus: record.qualificationStatus,
      qualifies: record.qualificationStatus === 'qualified',
      emergencyPause: record.protectedByEmergencyPause,
      finalizedAt: record.finalizedAt.toISOString(),
      streakBefore: record.currentStreakBefore,
      streakAfter: record.currentStreakAfter,
      longestStreak: record.runLongestStreakAfter,
      xpDrained: null,
      dailyRankXpAwarded: null,
      dpRewardAwarded: null,
      hasDailyResetRecord: true,
    })),
  };
}

export async function getActiveDisciplineRewardCycle(userId, { now = new Date() } = {}) {
  await getDisciplineSummary(userId, { now });
  const user = await User.findById(userId).select('currentProgressionRunId');
  const run = user?.currentProgressionRunId
    ? await ProgressionRun.findOne({ _id: user.currentProgressionRunId, userId, status: 'active' }).select('_id currentRankSlug level')
    : null;
  if (!run) return { progressionRunId: null, activeCycle: null, nextCycleRank: null, nextRewardCycle: null };
  const cycle = await DisciplineRewardCycle.findOne({ userId, progressionRunId: run._id, status: 'active' });
  const nextRank = PROGRESSION_RANK_BY_SLUG[getRankSlugForLevel(run.level)];
  return {
    progressionRunId: String(run._id),
    activeCycle: cycleDto(cycle, now),
    nextCycleRank: { slug: nextRank.slug, number: nextRank.number, name: nextRank.name },
    nextRewardCycle: nextRewardCycleDto(nextRank.slug),
  };
}

export async function listDisciplinePointTransactions(userId, { limit = 50 } = {}) {
  const user = await User.findById(userId).select('currentProgressionRunId');
  const run = user?.currentProgressionRunId
    ? await ProgressionRun.findOne({ _id: user.currentProgressionRunId, userId, status: 'active' }).select('_id')
    : null;
  if (!run) return { progressionRunId: null, transactions: [] };
  const events = await DisciplinePointTransaction.find({ userId, progressionRunId: run._id }).sort({ occurredAt: -1, _id: -1 }).limit(limit);
  return {
    progressionRunId: String(run._id),
    transactions: events.map((event) => ({
      id: String(event._id),
      progressionRunId: String(event.progressionRunId),
      type: event.type,
      deltaCents: event.deltaCents,
      delta: dpFromCents(event.deltaCents).toFixed(2),
      calculatedDeltaCents: event.calculatedDeltaCents,
      calculatedDelta: event.calculatedDeltaCents == null ? null : dpFromCents(Math.abs(event.calculatedDeltaCents)).toFixed(2),
      balanceBefore: dpFromCents(event.balanceBeforeCents).toFixed(2),
      balanceAfter: dpFromCents(event.balanceAfterCents).toFixed(2),
      businessDate: event.businessDate,
      occurredAt: event.occurredAt.toISOString(),
      metadata: event.metadata || {},
    })),
  };
}

export async function getDisciplinePointWallet(userId) {
  const user = await User.findById(userId).select('currentProgressionRunId');
  const run = user?.currentProgressionRunId
    ? await ProgressionRun.findOne({ _id: user.currentProgressionRunId, userId, status: 'active' }).select('_id disciplinePoints')
    : null;
  return { progressionRunId: run ? String(run._id) : null, balance: dpFromCents(centsFromDp(run?.disciplinePoints || 0)).toFixed(2), maximum: dpFromCents(DP_WALLET_CAP_CENTS).toFixed(2) };
}

export async function redeemDisciplinePointForGracePoint({ userId, idempotencyKey, now = new Date() }) {
  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8 || idempotencyKey.trim().length > 160) {
    throw new TypeError('An idempotency key between 8 and 160 characters is required.');
  }
  const key = idempotencyKey.trim();
  const sourceEventKey = `dp-redemption:${key}`;
  const occurredAt = new Date(now);
  const availableAt = new Date(occurredAt.getTime() + DP_REDEMPTION_COOLDOWN_MS);

  return withMongoTransaction(async (session) => {
    const user = await User.findById(userId).session(session);
    const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).session(session);
    if (!user || !run || String(user.currentProgressionRunId || '') !== String(run._id)) throw new ConflictError('ACTIVE_PROGRESSION_REQUIRED', 'An active Progression Run is required to redeem Discipline Points.');

    const existingDp = await DisciplinePointTransaction.findOne({ userId, sourceEventKey }).session(session);
    if (existingDp) {
      const existingGp = await GracePointTransaction.findOne({ userId, sourceEventKey }).session(session);
      if (!existingGp) throw new Error('The stored Discipline Point redemption is missing its Grace Point ledger entry.');
      return {
        idempotentReplay: true,
        disciplinePointBalance: dpFromCents(existingDp.balanceAfterCents).toFixed(2),
        gracePointBalance: existingGp.balanceAfter,
        redeemedAt: existingDp.occurredAt.toISOString(),
        availableAt: existingDp.metadata?.cooldownUntil || null,
      };
    }

    const dpBefore = centsFromDp(run.disciplinePoints);
    if (dpBefore < 100) throw new ConflictError('INSUFFICIENT_DISCIPLINE_POINTS', 'At least 1.00 Discipline Point is required for redemption.');
    if (run.dpRedemptionCooldownUntil && run.dpRedemptionCooldownUntil.getTime() > occurredAt.getTime()) {
      throw new ConflictError('DP_REDEMPTION_COOLDOWN', 'The 72-hour Discipline Point redemption cooldown is still active.');
    }

    const graceBefore = run.gracePoints;
    const dpAfter = dpBefore - 100;
    const graceAfter = graceBefore + 1;
    const changed = await ProgressionRun.updateOne({
      _id: run._id,
      userId,
      status: 'active',
      disciplinePoints: run.disciplinePoints,
      gracePoints: graceBefore,
      dpRedemptionCooldownUntil: run.dpRedemptionCooldownUntil,
    }, {
      $set: {
        disciplinePoints: dpFromCents(dpAfter),
        gracePoints: graceAfter,
        dpRedemptionLastAt: occurredAt,
        dpRedemptionCooldownUntil: availableAt,
      },
    }, { session, runValidators: true });
    if (changed.modifiedCount !== 1) throw new ConflictError('REDEMPTION_STATE_CHANGED', 'The balances changed before redemption completed. Refresh and try again.');

    const metadata = { idempotencyKey: key, exchangeRate: '1 DP = 1 GP', cooldownUntil: availableAt.toISOString() };
    await DisciplinePointTransaction.create([{
      userId,
      progressionRunId: run._id,
      deltaCents: -100,
      calculatedDeltaCents: -100,
      type: 'dp-redemption',
      sourceEntity: 'dp-redemption',
      sourceId: run._id,
      sourceEventKey,
      balanceBeforeCents: dpBefore,
      balanceAfterCents: dpAfter,
      businessDate: getIstDateKey(occurredAt),
      occurredAt,
      metadata,
    }], { session });
    await GracePointTransaction.create([{
      userId,
      progressionRunId: run._id,
      delta: 1,
      type: 'dp-redemption',
      sourceEntity: 'dp-redemption',
      sourceId: run._id,
      sourceEventKey,
      balanceBefore: graceBefore,
      balanceAfter: graceAfter,
      occurredAt,
      metadata,
    }], { session });

    return {
      idempotentReplay: false,
      disciplinePointBalance: dpFromCents(dpAfter).toFixed(2),
      gracePointBalance: graceAfter,
      redeemedAt: occurredAt.toISOString(),
      availableAt: availableAt.toISOString(),
    };
  });
}

export async function finalizeDailyDisciplineWithinSession({
  userId,
  run,
  date,
  finalizedAt,
  protectedByEmergencyPause = false,
  sourceDailyResetId = null,
  session,
}) {
  if (!session) throw new TypeError('Daily Discipline finalization requires the caller transaction.');
  const existing = await DailyDisciplineRecord.findOne({ userId, progressionRunId: run._id, date }).session(session);
  if (existing) return { record: existing, duplicate: true };

  if (run.status !== 'active') return { record: null, stopped: true };
  const user = await User.findById(userId).session(session);
  if (!user || String(user.currentProgressionRunId || '') !== String(run._id)) return { record: null, stopped: true };
  if (!run.disciplineStartedOn || date < run.disciplineStartedOn) return { record: null, ignored: true, beforeDisciplineStart: true };

  const occurrences = await TaskOccurrence.find({
    userId,
    progressionRunId: run._id,
    occurrenceDate: date,
    status: { $ne: 'cancelled' },
  }).sort({ cycleDay: 1, taskId: 1, _id: 1 }).session(session);
  const counts = occurrenceCounts(occurrences);
  const cycle = await ensureActiveDisciplineRewardCycleWithinSession({ userId, run, startDate: run.disciplineStartedOn, session });
  const streakBefore = run.currentStreak;
  const cycleProgressBefore = cycle.completedQualifyingDays;
  const qualificationStatus = getDailyQualificationStatus(counts.completed, protectedByEmergencyPause);
  const qualifies = qualificationStatus === 'qualified';
  const streakResult = calculateStreakResult({
    currentStreak: streakBefore,
    longestStreak: run.longestStreak,
    lifetimeLongestStreak: user.lifetimeLongestStreak || 0,
    qualifies,
    protectedByEmergencyPause,
  });
  const streakAfter = streakResult.currentStreakAfter;
  const runLongestAfter = streakResult.runLongestStreakAfter;
  const lifetimeLongestAfter = streakResult.lifetimeLongestStreakAfter;
  const cycleProgressAfter = calculateRewardCycleProgress({
    completedQualifyingDays: cycleProgressBefore,
    requiredQualifyingDays: cycle.requiredQualifyingDays,
    qualifies,
    protectedByEmergencyPause,
  });
  let completedCycle = null;

  if (!protectedByEmergencyPause && qualifies && cycleProgressAfter >= cycle.requiredQualifyingDays) {
    const configuredRewardCents = cycle.rewardAmountCents;
    const balanceBeforeCents = centsFromDp(run.disciplinePoints);
    const actualCreditedCents = Math.min(configuredRewardCents, Math.max(0, DP_WALLET_CAP_CENTS - balanceBeforeCents));
    const balanceAfterCents = balanceBeforeCents + actualCreditedCents;
    cycle.status = 'completed';
    cycle.completedQualifyingDays = cycle.requiredQualifyingDays;
    cycle.actualCreditedCents = actualCreditedCents;
    cycle.completionDate = date;
    cycle.completedAt = new Date(finalizedAt);
    run.disciplinePoints = dpFromCents(balanceAfterCents);

    const sourceEventKey = `discipline-cycle-reward:${run._id}:${cycle.cycleNumber}`;
    const [transaction] = await DisciplinePointTransaction.create([{
      userId,
      progressionRunId: run._id,
      deltaCents: actualCreditedCents,
      calculatedDeltaCents: configuredRewardCents,
      type: 'recurring-discipline-cycle',
      sourceEntity: 'discipline-cycle',
      sourceId: cycle._id,
      sourceEventKey,
      balanceBeforeCents,
      balanceAfterCents,
      businessDate: date,
      occurredAt: finalizedAt,
      metadata: {
        cycleNumber: cycle.cycleNumber,
        rankSlug: cycle.rankSlug,
        configuredRewardCents,
        actualCreditedCents,
        walletCapCents: DP_WALLET_CAP_CENTS,
        configurationVersion: PROGRESSION_CONFIGURATION.version,
      },
    }], { session });
    cycle.rewardTransactionId = transaction._id;
    completedCycle = { rank: cycle.rankSlug, configuredRewardCents, actualCreditedCents };
    await createNotificationWithinSession({
      userId, progressionRunId: run._id, category: 'discipline', eventType: 'discipline-cycle-reward-credited',
      title: actualCreditedCents > 0 ? 'Discipline reward cycle completed' : 'Discipline reward cycle completed',
      description: actualCreditedCents > 0
        ? `The ${cycle.rankName} Discipline reward cycle completed. ${dpFromCents(actualCreditedCents).toFixed(2)} Discipline Points were credited.`
        : `The ${cycle.rankName} Discipline reward cycle completed, but no Discipline Points were credited because the wallet was at its cap.`,
      targetRoute: '/app/discipline', idempotencyKey: `discipline-cycle-notice:${transaction._id}`,
      occurredAt: finalizedAt, session,
    });
    await cycle.save({ session });
  } else {
    cycle.completedQualifyingDays = cycleProgressAfter;
    await cycle.save({ session });
  }

  run.currentStreak = streakAfter;
  run.longestStreak = runLongestAfter;
  run.lastFinalizedDisciplineDate = date;
  user.lifetimeLongestStreak = lifetimeLongestAfter;

  if (completedCycle) {
    const nextDate = addIstCalendarDays(date, 1);
    const nextCycle = await ensureActiveDisciplineRewardCycleWithinSession({ userId, run, startDate: nextDate, session });
    mirrorRewardCycle(run, nextCycle);
  } else {
    mirrorRewardCycle(run, cycle);
  }
  await Promise.all([run.save({ session }), user.save({ session })]);

  const [record] = await DailyDisciplineRecord.create([{
    userId,
    progressionRunId: run._id,
    date,
    scheduledOriginalTaskCount: counts.scheduled,
    completedOriginalTaskCount: counts.completed,
    qualificationStatus,
    protectedByEmergencyPause,
    finalizedAt,
    currentStreakBefore: streakBefore,
    currentStreakAfter: streakAfter,
    runLongestStreakAfter: runLongestAfter,
    lifetimeLongestStreakAfter: lifetimeLongestAfter,
    rewardCycleId: cycle._id,
    rewardCycleProgressBefore: cycleProgressBefore,
    rewardCycleProgressAfter: cycleProgressAfter,
    sourceOccurrenceIds: counts.occurrences.map((occurrence) => occurrence._id),
    sourceDailyResetId,
    sourceEventKey: `discipline-day:${run._id}:${date}`,
  }], { session });

  if (!protectedByEmergencyPause) {
    const qualified = qualificationStatus === 'qualified';
    await createNotificationWithinSession({
      userId, progressionRunId: run._id, category: 'discipline',
      eventType: qualified ? 'discipline-day-qualified' : 'discipline-day-not-qualified',
      title: qualified ? 'Discipline day qualified' : 'Discipline day finalized',
      description: qualified
        ? `${counts.completed} of ${counts.scheduled} scheduled Tasks were completed on ${date}. The day qualified for Discipline.`
        : `${counts.completed} of ${counts.scheduled} scheduled Tasks were completed on ${date}. The finalized day did not qualify for Discipline.`,
      targetRoute: `/app/discipline?date=${date}`, idempotencyKey: `discipline-day-notice:${record._id}`,
      occurredAt: finalizedAt, session,
    });
  }

  return { record, duplicate: false, cycleReward: completedCycle };
}

export async function listDisciplineRewardCycles(userId, { limit = 50, now = new Date() } = {}) {
  await initializeDisciplineForActiveRun(userId, { now });
  const user = await User.findById(userId).select('currentProgressionRunId');
  const run = user?.currentProgressionRunId
    ? await ProgressionRun.findOne({ _id: user.currentProgressionRunId, userId, status: 'active' }).select('_id')
    : null;
  if (!run) return { progressionRunId: null, activeCycle: null, cycles: [] };
  const cycles = await DisciplineRewardCycle.find({ userId, progressionRunId: run._id }).sort({ cycleNumber: -1 }).limit(limit);
  return {
    progressionRunId: String(run._id),
    activeCycle: cycleDto(cycles.find((cycle) => cycle.status === 'active'), now),
    cycles: cycles.map((cycle) => cycleDto(cycle, now)),
  };
}

export function isValidDisciplineDateRange(startDate, endDate) {
  if (!isValidIstDateKey(startDate) || !isValidIstDateKey(endDate) || startDate > endDate) return false;
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const difference = (Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000;
  return Number.isInteger(difference) && difference <= 364;
}

export function isValidObjectId(value) {
  return mongoose.isValidObjectId(value);
}
