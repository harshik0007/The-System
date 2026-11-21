import mongoose from 'mongoose';
import DailyDisciplineRecord from '../models/DailyDisciplineRecord.js';
import DisciplinePointTransaction from '../models/DisciplinePointTransaction.js';
import EmergencyPause from '../models/EmergencyPause.js';
import GracePointTransaction from '../models/GracePointTransaction.js';
import MonthlyAnalysisReminder from '../models/MonthlyAnalysisReminder.js';
import MonthlyAnalysisSummary from '../models/MonthlyAnalysisSummary.js';
import MonthlyAnalysisWorkerCheckpoint from '../models/MonthlyAnalysisWorkerCheckpoint.js';
import ProgressionRun from '../models/ProgressionRun.js';
import RecoveryQuest from '../models/RecoveryQuest.js';
import RecoveryQuestDailyReset from '../models/RecoveryQuestDailyReset.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import User from '../models/User.js';
import XpTransaction from '../models/XpTransaction.js';
import { withMongoTransaction } from './mongoTransaction.js';
import { createNotificationWithinSession } from './notificationService.js';
import { ConflictError, HttpError, NotFoundError, ValidationError } from '../utils/httpErrors.js';
import { addIstCalendarDays, getIstDateKey, getIstMonthKey, getIstMidnightInstant } from '../utils/ist.js';
import { assertMonthKey, dateKeyRangeForInstantInterval, getDetailExpiry, getIstMonthBounds, getRetainedMonthKeys, monthDateBounds, shiftMonthKey } from '../utils/monthlyAnalysis.js';

const AGGREGATION_VERSION = 1;
const DETAIL_PAGE_MAX = 100;
const REMINDER_OFFSETS_HOURS = [168, 48, 24];
const RANK_ORDER = { origin: 0, ember: 1, surge: 2, vector: 3, apex: 4, zenith: 5, continuum: 6 };
const cents = (value) => Math.round(Number(value || 0) * 100);
const xpValue = (value) => Number(value?.toString?.() ?? value ?? 0);
const rankLabel = (slug) => ({ origin: 'Origin', ember: 'Ember', surge: 'Surge', vector: 'Vector', apex: 'Diamond', zenith: 'Zenith', continuum: 'Continuum' }[slug] || null);
const dateOf = (instant) => instant ? getIstDateKey(new Date(instant)) : null;
const within = (dateKey, start, end) => Boolean(dateKey && dateKey >= start && dateKey <= end);
const monthRange = (bounds) => ({ $gte: getIstMidnightInstant(bounds.coveredFrom), $lt: getIstMidnightInstant(addIstCalendarDays(bounds.coveredThrough, 1)) });

function validateMonth(monthKey) {
  try { return assertMonthKey(monthKey); } catch (error) { throw new ValidationError(error.message); }
}

function asOpaqueCursor(cursor) {
  if (!cursor) return null;
  try {
    const value = Buffer.from(cursor, 'base64url').toString('utf8');
    const [date, id] = value.split('|');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !mongoose.isValidObjectId(id)) throw new Error('invalid');
    return { date, id: new mongoose.Types.ObjectId(id) };
  } catch {
    throw new ValidationError('The history cursor is invalid.');
  }
}

function createCursor(occurrence) {
  return Buffer.from(`${occurrence.occurrenceDate}|${occurrence._id.toString()}`).toString('base64url');
}

function emptyDay(date) {
  return { date, tasks: null, discipline: null, xp: null };
}

function addDay(days, date) {
  if (!days.has(date)) days.set(date, emptyDay(date));
  return days.get(date);
}

function summarizeTaskDays(occurrenceGroups, records, start, end) {
  const occurrenceMap = new Map();
  for (const row of occurrenceGroups) {
    const date = row._id.date;
    const entry = occurrenceMap.get(date) || { scheduled: 0, completed: 0, missed: 0, incomplete: 0, occurrenceCount: 0 };
    const count = row.count;
    if (row._id.status !== 'cancelled') {
      entry.scheduled += count;
      entry.occurrenceCount += count;
      if (row._id.status === 'completed') entry.completed += count;
      else if (row._id.status === 'missed') entry.missed += count;
      else entry.incomplete += count;
    }
    occurrenceMap.set(date, entry);
  }
  const recordMap = new Map(records.map((record) => [record.date, record]));
  const dates = new Set([...occurrenceMap.keys(), ...recordMap.keys()]);
  const result = [];
  for (const date of dates) {
    if (!within(date, start, end)) continue;
    const occurrence = occurrenceMap.get(date) || { scheduled: 0, completed: 0, missed: 0, incomplete: 0, occurrenceCount: 0 };
    const record = recordMap.get(date);
    const finalized = Boolean(record);
    const scheduled = finalized ? record.scheduledOriginalTaskCount : occurrence.scheduled;
    const completed = finalized ? record.completedOriginalTaskCount : occurrence.completed;
    const missed = finalized ? Math.max(0, scheduled - completed) : occurrence.missed;
    const incomplete = finalized ? 0 : Math.max(0, scheduled - completed - missed);
    result.push({ date, scheduled, completed, missed, incomplete, finalized, protected: Boolean(record?.protectedByEmergencyPause), occurrenceCount: occurrence.occurrenceCount });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

async function findBalanceBefore(Model, query, beforeField, dateBound, projection) {
  return Model.findOne({ ...query, [beforeField]: { $lt: dateBound } }).sort({ [beforeField]: -1, _id: -1 }).select(projection).lean();
}

async function buildSummary({ userId, run, monthKey, now = new Date() }) {
  validateMonth(monthKey);
  const currentMonth = getIstMonthKey(now);
  if (monthKey > currentMonth) throw new ValidationError('A future month cannot be reported.');
  const bounds = monthDateBounds(monthKey, run.startedOn, now, run.endedOn);
  if (bounds.coveredFrom > bounds.coveredThrough || bounds.coveredFrom > (run.endedOn || getIstDateKey(now))) {
    throw new NotFoundError('This month is outside the selected Progression Run.');
  }
  const dateQuery = { userId, progressionRunId: run._id };
  const taskMatch = { ...dateQuery, occurrenceDate: { $gte: bounds.coveredFrom, $lte: bounds.coveredThrough } };
  const occurrenceGroups = await TaskOccurrence.aggregate([
    { $match: taskMatch },
    { $group: { _id: { date: '$occurrenceDate', status: '$status' }, count: { $sum: 1 } } },
    { $sort: { '_id.date': 1, '_id.status': 1 } },
  ]);
  const disciplineRecords = await DailyDisciplineRecord.find({ ...dateQuery, date: { $gte: bounds.coveredFrom, $lte: bounds.coveredThrough } }).sort({ date: 1 }).lean();
  const taskDays = summarizeTaskDays(occurrenceGroups, disciplineRecords, bounds.coveredFrom, bounds.coveredThrough);
  const taskCounts = taskDays.reduce((sum, day) => ({
    scheduled: sum.scheduled + (day.scheduled ?? 0), completed: sum.completed + (day.completed ?? 0),
    missed: sum.missed + (day.missed ?? 0), incomplete: sum.incomplete + (day.incomplete ?? 0),
  }), { scheduled: 0, completed: 0, missed: 0, incomplete: 0 });
  const hasTaskEvidence = occurrenceGroups.some((item) => item._id.status !== 'cancelled') || disciplineRecords.length > 0;
  const taskStats = {
    ...Object.fromEntries(Object.entries(taskCounts).map(([key, value]) => [key, hasTaskEvidence ? value : null])),
    completionRate: taskCounts.scheduled ? Math.round(taskCounts.completed / taskCounts.scheduled * 10_000) / 100 : hasTaskEvidence ? null : null,
    scheduledDays: taskDays.filter((day) => day.scheduled > 0).length,
    completedOriginalTasks: taskCounts.completed,
    eligibleDays: disciplineRecords.filter((record) => !record.protectedByEmergencyPause && record.scheduledOriginalTaskCount > 0).length,
  };

  const previousDiscipline = await DailyDisciplineRecord.findOne({ ...dateQuery, date: { $lt: bounds.coveredFrom } }).sort({ date: -1 }).select('date currentStreakAfter runLongestStreakAfter').lean();
  const monthlyDiscipline = disciplineRecords;
  const qualified = monthlyDiscipline.filter((record) => record.qualificationStatus === 'qualified').length;
  const nonQualified = monthlyDiscipline.filter((record) => record.qualificationStatus === 'not-qualified').length;
  const protectedRecordDates = monthlyDiscipline.filter((record) => record.protectedByEmergencyPause || record.qualificationStatus === 'emergency-pause-protected').map((record) => record.date);
  const firstDiscipline = monthlyDiscipline[0];
  const lastDiscipline = monthlyDiscipline.at(-1);
  let breaks = 0;
  for (const record of monthlyDiscipline) if (record.qualificationStatus === 'not-qualified' && record.currentStreakBefore > 0) breaks += 1;
  const disciplineStats = {
    qualifyingDays: qualified,
    nonQualifyingDays: nonQualified,
    protectedDays: null,
    qualificationRate: qualified + nonQualified ? Math.round(qualified / (qualified + nonQualified) * 10_000) / 100 : null,
    currentStreak: monthKey === currentMonth && run.status === 'active' ? run.currentStreak : lastDiscipline?.currentStreakAfter ?? null,
    startingStreak: firstDiscipline?.currentStreakBefore ?? (previousDiscipline ? previousDiscipline.currentStreakAfter : bounds.coveredFrom === run.startedOn ? 0 : null),
    endingStreak: lastDiscipline?.currentStreakAfter ?? (monthKey === currentMonth && run.status === 'active' ? run.currentStreak : null),
    longestStreak: monthlyDiscipline.length ? Math.max(...monthlyDiscipline.map((record) => record.runLongestStreakAfter)) : null,
    streakBreaks: breaks,
  };

  const xpDateRange = { $gte: getIstMidnightInstant(bounds.coveredFrom), $lt: getIstMidnightInstant(addIstCalendarDays(bounds.coveredThrough, 1)) };
  const inBusinessDateRange = { $gte: bounds.coveredFrom, $lte: bounds.coveredThrough };
  const xpTransactions = await XpTransaction.find({ ...dateQuery, $or: [
    { businessDate: inBusinessDateRange }, { businessDate: null, occurredAt: xpDateRange },
  ] }).sort({ businessDate: 1, occurredAt: 1, _id: 1 }).select('amount type balanceBefore balanceAfter levelBefore resultingLevel currentRankBefore currentRankAfter occurredAt businessDate sourceEventKey').lean();
  const beforeXp = await XpTransaction.findOne({ ...dateQuery, $or: [
    { businessDate: { $lt: bounds.coveredFrom } }, { businessDate: null, occurredAt: { $lt: getIstMidnightInstant(bounds.coveredFrom) } },
  ] }).sort({ businessDate: -1, occurredAt: -1, _id: -1 }).select('balanceAfter levelBefore resultingLevel currentRankAfter currentRankBefore').lean();
  const asOfEnd = await XpTransaction.findOne({ ...dateQuery, $or: [
    { businessDate: { $lte: bounds.coveredThrough } }, { businessDate: null, occurredAt: { $lt: xpDateRange.$lt } },
  ] }).sort({ businessDate: -1, occurredAt: -1, _id: -1 }).select('balanceAfter resultingLevel currentRankAfter').lean();
  const xpStarting = xpTransactions[0]?.balanceBefore != null ? xpValue(xpTransactions[0].balanceBefore) : beforeXp?.balanceAfter != null ? xpValue(beforeXp.balanceAfter) : 0;
  const xpEnding = asOfEnd?.balanceAfter != null ? xpValue(asOfEnd.balanceAfter) : 0;
  const monthCurrentActive = monthKey === currentMonth && run.status === 'active';
  const xpEarned = xpTransactions.reduce((sum, event) => sum + Math.max(0, xpValue(event.amount)), 0);
  const xpDrained = xpTransactions.reduce((sum, event) => sum + Math.max(0, -xpValue(event.amount)), 0);
  const rankTransitions = xpTransactions.filter((event) => event.currentRankBefore && event.currentRankAfter && event.currentRankBefore !== event.currentRankAfter).map((event) => ({
    date: event.businessDate || dateOf(event.occurredAt), from: event.currentRankBefore, to: event.currentRankAfter,
  }));
  const xpStats = {
    earned: xpTransactions.length || beforeXp || hasTaskEvidence ? Math.round(xpEarned * 100) / 100 : null,
    drained: xpTransactions.length || beforeXp || hasTaskEvidence ? Math.round(xpDrained * 100) / 100 : null,
    net: xpTransactions.length || beforeXp || hasTaskEvidence ? Math.round((xpEarned - xpDrained) * 100) / 100 : null,
    startingXp: xpTransactions.length || beforeXp || bounds.coveredFrom === run.startedOn ? xpStarting : null,
    endingXp: monthCurrentActive ? run.totalXp : xpTransactions.length || beforeXp ? xpEnding : bounds.coveredFrom === run.startedOn ? 0 : null,
    startingLevel: xpTransactions[0]?.levelBefore ?? beforeXp?.resultingLevel ?? (bounds.coveredFrom === run.startedOn ? 0 : null),
    endingLevel: monthCurrentActive ? run.level : asOfEnd?.resultingLevel ?? (bounds.coveredFrom === run.startedOn ? 0 : null),
    startingRank: xpTransactions[0]?.currentRankBefore || beforeXp?.currentRankAfter || (bounds.coveredFrom === run.startedOn ? 'origin' : null),
    endingRank: monthCurrentActive ? run.currentRankSlug : asOfEnd?.currentRankAfter || beforeXp?.currentRankAfter || (bounds.coveredFrom === run.startedOn ? 'origin' : null),
    levelsLost: xpTransactions.reduce((sum, event) => sum + Math.max(0, event.levelBefore - event.resultingLevel), 0),
    rankTransitions,
    rankUps: rankTransitions.filter((event) => RANK_ORDER[event.to] > RANK_ORDER[event.from]).length,
    daily: xpTransactions.reduce((result, event) => {
      const date = event.businessDate || dateOf(event.occurredAt);
      if (!within(date, bounds.coveredFrom, bounds.coveredThrough)) return result;
      const day = result.get(date) || { earned: 0, drained: 0, net: 0 };
      const amount = xpValue(event.amount);
      day.earned += Math.max(0, amount);
      day.drained += Math.max(0, -amount);
      day.net += amount;
      result.set(date, day);
      return result;
    }, new Map()),
  };
  xpStats.daily = [...xpStats.daily].map(([date, value]) => ({ date, earned: Math.round(value.earned * 100) / 100, drained: Math.round(value.drained * 100) / 100, net: Math.round(value.net * 100) / 100 })).sort((a, b) => a.date.localeCompare(b.date));

  const questStart = getIstMidnightInstant(bounds.coveredFrom);
  const questEnd = getIstMidnightInstant(addIstCalendarDays(bounds.coveredThrough, 1));
  const questRange = { ...dateQuery, activatedAt: { $lt: questEnd } };
  const questsGenerated = await RecoveryQuest.countDocuments({ ...dateQuery, activatedAt: { $gte: questStart, $lt: questEnd } });
  const questsCompleted = await RecoveryQuest.countDocuments({ ...dateQuery, completedAt: { $gte: questStart, $lt: questEnd } });
  const questsExpired = await RecoveryQuest.countDocuments({ ...dateQuery, expiredAt: { $gte: questStart, $lt: questEnd } });
  const questsCleared = await RecoveryQuest.countDocuments({ ...dateQuery, thresholdClearedAt: { $gte: questStart, $lt: questEnd } });
  const endInstant = questEnd;
  const activeAtEnd = await RecoveryQuest.countDocuments({ ...questRange, $or: [
    { completedAt: null }, { completedAt: { $gte: endInstant } },
  ], $and: [
    { $or: [{ expiredAt: null }, { expiredAt: { $gte: endInstant } }] },
    { $or: [{ thresholdClearedAt: null }, { thresholdClearedAt: { $gte: endInstant } }] },
    { $or: [{ runEndedAt: null }, { runEndedAt: { $gte: endInstant } }] },
  ] });
  const recoveryStats = { generated: questsGenerated, completed: questsCompleted, expired: questsExpired, thresholdCleared: questsCleared, activeAtEnd };

  const graceRange = { $gte: questStart, $lt: questEnd };
  const graceEvents = await GracePointTransaction.find({ ...dateQuery, occurredAt: graceRange }).sort({ occurredAt: 1 }).select('delta type balanceBefore balanceAfter occurredAt').lean();
  const previousGrace = await findBalanceBefore(GracePointTransaction, dateQuery, 'occurredAt', questStart, 'balanceAfter');
  const endingGrace = graceEvents.at(-1)?.balanceAfter ?? previousGrace?.balanceAfter ?? 3;
  const graceStats = {
    added: graceEvents.reduce((sum, item) => sum + Math.max(0, item.delta), 0),
    expiryDeductions: Math.abs(graceEvents.filter((item) => item.type === 'recovery-quest-expiry').reduce((sum, item) => sum + Math.min(0, item.delta), 0)),
    thresholdDeductions: Math.abs(graceEvents.filter((item) => item.type === 'sixth-quest-threshold').reduce((sum, item) => sum + Math.min(0, item.delta), 0)),
    startingBalance: graceEvents[0]?.balanceBefore ?? previousGrace?.balanceAfter ?? (bounds.coveredFrom === run.startedOn ? 3 : null),
    endingBalance: monthCurrentActive ? run.gracePoints : endingGrace,
  };

  const dpEvents = await DisciplinePointTransaction.find({ ...dateQuery, occurredAt: graceRange }).sort({ occurredAt: 1 }).select('deltaCents type balanceBeforeCents balanceAfterCents occurredAt').lean();
  const previousDp = await findBalanceBefore(DisciplinePointTransaction, dateQuery, 'occurredAt', questStart, 'balanceAfterCents');
  const dpStats = {
    earned: dpEvents.filter((event) => event.deltaCents > 0 && event.type !== 'dp-redemption').reduce((sum, event) => sum + event.deltaCents, 0) / 100,
    recurringAwarded: dpEvents.filter((event) => event.type === 'recurring-discipline-cycle').reduce((sum, event) => sum + Math.max(0, event.deltaCents), 0) / 100,
    rankEntryAwarded: dpEvents.filter((event) => event.type === 'rank-entry').reduce((sum, event) => sum + Math.max(0, event.deltaCents), 0) / 100,
    redeemed: Math.abs(dpEvents.filter((event) => event.type === 'dp-redemption').reduce((sum, event) => sum + Math.min(0, event.deltaCents), 0)) / 100,
    startingBalance: (dpEvents[0]?.balanceBeforeCents ?? previousDp?.balanceAfterCents ?? (bounds.coveredFrom === run.startedOn ? 0 : null)) == null ? null : (dpEvents[0]?.balanceBeforeCents ?? previousDp?.balanceAfterCents ?? 0) / 100,
    endingBalance: monthCurrentActive ? run.disciplinePoints : dpEvents.at(-1)?.balanceAfterCents != null ? dpEvents.at(-1).balanceAfterCents / 100 : previousDp?.balanceAfterCents != null ? previousDp.balanceAfterCents / 100 : bounds.coveredFrom === run.startedOn ? 0 : null,
    recurringCyclesCompleted: dpEvents.filter((event) => event.type === 'recurring-discipline-cycle').length,
  };

  const pauses = await EmergencyPause.find({ ...dateQuery, startedAt: { $gte: questStart, $lt: questEnd } }).sort({ startedAt: 1 }).select('activationMonthKey durationDays startedAt selectedEndAt effectiveEndAt actualEndAt endReason status').lean();
  const protectedResetRows = await RecoveryQuestDailyReset.find({ ...dateQuery, date: { $gte: bounds.coveredFrom, $lte: bounds.coveredThrough }, protectedTaskDate: true }).select('date').lean();
  const protectedDates = new Set([
    ...protectedRecordDates,
    ...protectedResetRows.map((item) => item.date),
  ]);
  for (const pause of await EmergencyPause.find({ ...dateQuery, startedAt: { $lt: questEnd }, $or: [{ actualEndAt: null }, { actualEndAt: { $gt: questStart } }] }).select('startedAt effectiveEndAt actualEndAt').lean()) {
    const end = pause.actualEndAt || (new Date(pause.effectiveEndAt) < now ? pause.effectiveEndAt : now);
    dateKeyRangeForInstantInterval(pause.startedAt, end).filter((date) => within(date, bounds.coveredFrom, bounds.coveredThrough)).forEach((date) => protectedDates.add(date));
  }
  const protectedMonthDates = [...protectedDates].sort();
  disciplineStats.protectedDays = protectedMonthDates.length;
  const pauseStats = {
    activations: pauses.filter((pause) => pause.activationMonthKey === monthKey).length,
    records: pauses.map((pause) => ({
      activatedAt: pause.startedAt,
      selectedDurationDays: pause.durationDays,
      actualEndAt: pause.actualEndAt,
      effectiveEndAt: pause.effectiveEndAt,
      endReason: pause.endReason,
      durationMinutes: Math.max(0, Math.floor(((pause.actualEndAt || (new Date(pause.effectiveEndAt) < now ? pause.effectiveEndAt : now)) - pause.startedAt) / 60_000)),
    })),
    protectedDates: protectedMonthDates,
  };

  const dailyMap = new Map();
  for (const day of taskDays) {
    const item = addDay(dailyMap, day.date);
    item.tasks = { scheduled: day.scheduled, completed: day.completed, missed: day.missed, incomplete: day.incomplete, finalized: day.finalized };
    item.discipline = day.protected ? { status: 'protected', protected: true } : null;
  }
  for (const record of disciplineRecords) {
    const item = addDay(dailyMap, record.date);
    item.discipline = { status: record.qualificationStatus === 'emergency-pause-protected' ? 'protected' : record.qualificationStatus, protected: record.protectedByEmergencyPause };
    item.tasks ||= { scheduled: record.scheduledOriginalTaskCount, completed: record.completedOriginalTaskCount, missed: Math.max(0, record.scheduledOriginalTaskCount - record.completedOriginalTaskCount), incomplete: 0, finalized: true };
  }
  for (const date of protectedMonthDates) {
    const item = addDay(dailyMap, date);
    item.discipline = { status: 'protected', protected: true };
  }
  for (const xpDay of xpStats.daily) {
    const item = addDay(dailyMap, xpDay.date);
    item.xp = { earned: xpDay.earned, drained: xpDay.drained, net: xpDay.net };
  }
  if (monthKey === currentMonth && within(getIstDateKey(now), bounds.coveredFrom, bounds.coveredThrough)) {
    const today = getIstDateKey(now);
    const item = dailyMap.get(today);
    if (item && !item.discipline) item.discipline = { status: 'in-progress', protected: false };
  }
  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const sourceCounts = {
    taskOccurrences: occurrenceGroups.reduce((sum, item) => sum + item.count, 0),
    disciplineRecords: disciplineRecords.length,
    xpTransactions: xpTransactions.length,
    recoveryQuestEvents: questsGenerated + questsCompleted + questsExpired + questsCleared,
    graceTransactions: graceEvents.length,
    dpTransactions: dpEvents.length,
    pauseActivations: pauses.filter((pause) => pause.activationMonthKey === monthKey).length,
  };
  const hasData = sourceCounts.taskOccurrences > 0 || sourceCounts.disciplineRecords > 0 || sourceCounts.xpTransactions > 0 || sourceCounts.recoveryQuestEvents > 0 || sourceCounts.graceTransactions > 0 || sourceCounts.dpTransactions > 0 || sourceCounts.pauseActivations > 0 || protectedMonthDates.length > 0;
  const monthBounds = getIstMonthBounds(monthKey);
  return {
    userId,
    progressionRunId: run._id,
    monthKey,
    monthStartAt: monthBounds.startAt,
    monthEndAt: monthBounds.endAt,
    coveredFrom: bounds.coveredFrom,
    coveredThrough: bounds.coveredThrough,
    status: bounds.partial ? 'partial' : 'finalized',
    aggregationVersion: AGGREGATION_VERSION,
    hasData,
    metrics: {
      tasks: taskStats,
      discipline: disciplineStats,
      xp: xpStats,
      recovery: recoveryStats,
      gracePoints: graceStats,
      disciplinePoints: dpStats,
      emergencyPause: pauseStats,
      daily,
    },
    sourceCounts,
    updatedAt: now,
  };
}

async function persistSummary({ userId, run, monthKey, now }) {
  // HTTP identity middleware provides string IDs. Mongoose casts regular
  // queries, but aggregate pipelines keep strings as-is and fail to match
  // ObjectId-backed occurrence records.
  const normalizedUserId = userId instanceof mongoose.Types.ObjectId
    ? userId
    : new mongoose.Types.ObjectId(userId);
  const summaryData = await buildSummary({ userId: normalizedUserId, run, monthKey, now });
  const selector = { userId: normalizedUserId, progressionRunId: run._id, monthKey };
  try {
    await MonthlyAnalysisSummary.updateOne(selector, { $set: summaryData, $setOnInsert: { createdAt: now } }, { upsert: true, runValidators: true });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  const saved = await MonthlyAnalysisSummary.findOne(selector).lean();
  if (!saved || saved.aggregationVersion !== AGGREGATION_VERSION || saved.sourceCounts?.taskOccurrences !== summaryData.sourceCounts.taskOccurrences || saved.coveredFrom !== summaryData.coveredFrom || saved.coveredThrough !== summaryData.coveredThrough) {
    throw new Error(`Monthly summary persistence verification failed for ${monthKey}.`);
  }
  return saved;
}

async function resolveCurrent(userId) {
  const user = await User.findById(userId).select('currentProgressionRunId memberSince').lean();
  if (!user?.currentProgressionRunId) return { user, run: null };
  const run = await ProgressionRun.findOne({ _id: user.currentProgressionRunId, userId }).lean();
  if (!run) throw new NotFoundError('The current Progression Run was not found.');
  return { user, run };
}

function summaryDto(summary, now = new Date()) {
  if (!summary) return null;
  return {
    monthKey: summary.monthKey,
    monthStart: summary.coveredFrom,
    monthEnd: summary.coveredThrough,
    monthStartAt: summary.monthStartAt,
    monthEndAt: summary.monthEndAt,
    status: summary.status,
    hasData: summary.hasData,
    detailedHistoryAvailable: getRetainedMonthKeys(now).includes(summary.monthKey),
    detailExpiresAt: getDetailExpiry(summary.monthKey),
    metrics: summary.metrics,
    coverage: { from: summary.coveredFrom, through: summary.coveredThrough, aggregationVersion: summary.aggregationVersion },
  };
}

export async function getMonthlySummary(userId, monthKey, { now = new Date() } = {}) {
  validateMonth(monthKey);
  const { run } = await resolveCurrent(userId);
  if (!run) return null;
  if (!isSummaryMonthAvailable(monthKey, now)) {
    throw new ValidationError('A future month cannot be reported.');
  }
  if (!getRetainedMonthKeys(now).includes(monthKey)) {
    const existing = await MonthlyAnalysisSummary.findOne({ userId, progressionRunId: run._id, monthKey }).lean();
    if (!existing) throw new NotFoundError('The aggregate summary for this month is not available.');
    return summaryDto(existing, now);
  }
  const summary = await persistSummary({ userId, run, monthKey, now });
  return summaryDto(summary, now);
}

function isSummaryMonthAvailable(monthKey, now) {
  return monthKey <= getIstMonthKey(now);
}

export async function getCurrentMonthlyAnalysis(userId, { now = new Date() } = {}) {
  return getMonthlySummary(userId, getIstMonthKey(now), { now });
}

export async function getPreviousMonthlyAnalysis(userId, { now = new Date() } = {}) {
  const previousMonth = shiftMonthKey(getIstMonthKey(now), -1);
  const { run } = await resolveCurrent(userId);
  if (!run || previousMonth < run.startedOn.slice(0, 7)) return null;
  return getMonthlySummary(userId, previousMonth, { now });
}

export async function getAvailableMonthlySummaries(userId, { now = new Date() } = {}) {
  const { run } = await resolveCurrent(userId);
  if (!run) return { progressionRun: null, months: [] };
  const months = await MonthlyAnalysisSummary.find({ userId, progressionRunId: run._id }).sort({ monthKey: 1 }).select('monthKey status hasData coveredFrom coveredThrough updatedAt').lean();
  const currentMonth = getIstMonthKey(now);
  const mapped = months.map((item) => ({
    monthKey: item.monthKey, status: item.status, hasData: item.hasData,
    coveredFrom: item.coveredFrom, coveredThrough: item.coveredThrough,
    detailAvailable: getRetainedMonthKeys(now).includes(item.monthKey),
    detailExpiresAt: getDetailExpiry(item.monthKey),
  }));
  return { runNumber: run.runNumber, currentMonth, months: mapped };
}

export async function getMonthlyDetails(userId, monthKey, { now = new Date(), limit = 50, cursor = null } = {}) {
  validateMonth(monthKey);
  if (!getRetainedMonthKeys(now).includes(monthKey)) {
    throw new HttpError(410, 'DETAIL_HISTORY_EXPIRED', 'Detailed Task history has expired for this month.');
  }
  const { run } = await resolveCurrent(userId);
  if (!run) throw new NotFoundError('The current Progression Run was not found.');
  if (run.status === 'ended' && monthKey > run.endedOn.slice(0, 7)) throw new NotFoundError('This month is outside the current Progression Run.');
  const summary = await MonthlyAnalysisSummary.findOne({ userId, progressionRunId: run._id, monthKey }).select('_id').lean();
  // Do not fabricate rows for months that predate this run.
  if (!summary && monthKey < run.startedOn.slice(0, 7)) throw new NotFoundError('This month is outside the current Progression Run.');
  const bounds = getIstMonthBounds(monthKey);
  const startDate = run.startedOn > bounds.startDate ? run.startedOn : bounds.startDate;
  const coveredEnd = monthKey === getIstMonthKey(now) ? getIstDateKey(now) : addIstCalendarDays(bounds.endDate, -1);
  const filter = { userId, progressionRunId: run._id, occurrenceDate: { $gte: startDate, $lte: coveredEnd } };
  const decoded = asOpaqueCursor(cursor);
  if (decoded) filter.$or = [
    { occurrenceDate: { $gt: decoded.date } },
    { occurrenceDate: decoded.date, _id: { $gt: decoded.id } },
  ];
  const safeLimit = Math.max(1, Math.min(DETAIL_PAGE_MAX, Number.parseInt(limit, 10) || 50));
  const rows = await TaskOccurrence.find(filter).sort({ occurrenceDate: 1, _id: 1 }).limit(safeLimit + 1).lean();
  const hasMore = rows.length > safeLimit;
  const page = rows.slice(0, safeLimit);
  return {
    monthKey,
    detailExpiresAt: getDetailExpiry(monthKey),
    items: page.map((item) => ({
      date: item.occurrenceDate,
      cycleDay: item.cycleDay,
      status: item.status,
      title: item.snapshot.title,
      description: item.snapshot.description,
      accountabilityAction: item.snapshot.accountabilityAction,
      taskRevision: item.snapshot.revision,
      completedAt: item.completedAt,
      missedAt: item.missedAt,
    })),
    nextCursor: hasMore ? createCursor(page.at(-1)) : null,
  };
}

export async function compareMonthlySummaries(userId, firstMonth, secondMonth, { now = new Date() } = {}) {
  validateMonth(firstMonth);
  validateMonth(secondMonth);
  if (firstMonth === secondMonth) throw new ValidationError('Choose two different months to compare.');
  const { run } = await resolveCurrent(userId);
  if (!run) throw new NotFoundError('The current Progression Run was not found.');
  const [first, second] = await Promise.all([
    MonthlyAnalysisSummary.findOne({ userId, progressionRunId: run._id, monthKey: firstMonth }).lean(),
    MonthlyAnalysisSummary.findOne({ userId, progressionRunId: run._id, monthKey: secondMonth }).lean(),
  ]);
  if (!first || !second) throw new NotFoundError('Both months must be available in the current Progression Run.');
  if (String(first.progressionRunId) !== String(second.progressionRunId) || String(first.progressionRunId) !== String(run._id)) throw new ConflictError('CROSS_RUN_COMPARISON', 'Months from different Progression Runs cannot be compared.');
  const metricPaths = [
    ['Scheduled Tasks', 'tasks.scheduled'], ['Completed Tasks', 'tasks.completed'], ['Missed Tasks', 'tasks.missed'], ['Task completion rate', 'tasks.completionRate'],
    ['Qualified Discipline days', 'discipline.qualifyingDays'], ['Non-qualified Discipline days', 'discipline.nonQualifyingDays'],
    ['XP earned', 'xp.earned'], ['XP drained', 'xp.drained'], ['Net XP', 'xp.net'], ['Recovery Quests generated', 'recovery.generated'],
    ['Recovery Quests completed', 'recovery.completed'], ['Recovery Quests expired', 'recovery.expired'], ['Recovery Quests threshold-cleared', 'recovery.thresholdCleared'],
    ['Grace Points added', 'gracePoints.added'], ['Grace Points deducted on Quest expiry', 'gracePoints.expiryDeductions'], ['Grace Points deducted at threshold', 'gracePoints.thresholdDeductions'],
    ['Discipline Points earned', 'disciplinePoints.earned'], ['Discipline Points redeemed', 'disciplinePoints.redeemed'], ['Emergency Pause activations', 'emergencyPause.activations'], ['Protected dates', 'discipline.protectedDays'],
  ];
  const readPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
  const metrics = metricPaths.map(([label, path]) => {
    const a = readPath(first.metrics, path);
    const b = readPath(second.metrics, path);
    if (!Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) return { label, first: a ?? null, second: b ?? null, difference: null, percentChange: null };
    const difference = Math.round((Number(b) - Number(a)) * 100) / 100;
    return { label, first: Number(a), second: Number(b), difference, percentChange: Number(a) === 0 ? null : Math.round((difference / Math.abs(Number(a))) * 10_000) / 100 };
  });
  return { runNumber: run.runNumber, first: summaryDto(first, now), second: summaryDto(second, now), metrics };
}

export async function getMonthlyReminders(userId, { now = new Date() } = {}) {
  const { run } = await resolveCurrent(userId);
  if (!run) return [];
  const retainedMonths = getRetainedMonthKeys(now);
  for (const monthKey of retainedMonths) {
    if (monthKey.slice(0, 7) < run.startedOn.slice(0, 7)) continue;
    const monthBounds = getIstMonthBounds(monthKey);
    if (monthBounds.startDate > (run.endedOn || getIstDateKey(now))) continue;
    const occurrenceExists = await TaskOccurrence.exists({ userId, progressionRunId: run._id, occurrenceDate: { $gte: monthBounds.startDate, $lt: monthBounds.endDate }, status: { $ne: 'cancelled' } });
    if (!occurrenceExists) continue;
    const expiryAt = getDetailExpiry(monthKey);
    if (now >= expiryAt) continue;
    for (const offsetHours of REMINDER_OFFSETS_HOURS) {
      const remindAt = new Date(expiryAt.getTime() - offsetHours * 3_600_000);
      await MonthlyAnalysisReminder.updateOne({ userId, progressionRunId: run._id, monthKey, offsetHours }, {
        $setOnInsert: { userId, progressionRunId: run._id, monthKey, offsetHours, expiryAt, remindAt, createdAt: now },
      }, { upsert: true });
    }
  }
  const delivery = await deliverDueExpiryNotifications({ userId, run, now });
  const available = await MonthlyAnalysisReminder.find({
    userId,
    progressionRunId: run._id,
    monthKey: { $in: retainedMonths },
    expiryAt: { $gt: now },
    $or: [{ remindAt: { $gt: now } }, { remindAt: { $lte: now }, surfacedAt: null }],
  }).sort({ expiryAt: 1, offsetHours: -1 }).lean();
  const reminders = [];
  for (const item of available) {
    reminders.push({
      monthKey: item.monthKey,
      reminder: `${item.offsetHours === 168 ? '7 days' : `${item.offsetHours} hours`}`,
      remindAt: item.remindAt,
      expiresAt: item.expiryAt,
      status: item.remindAt <= now ? 'due' : 'upcoming',
      surfacedAt: item.surfacedAt || null,
    });
  }
  // Preserve the existing M25 contract: a due reminder is returned once to
  // the caller that first surfaces it, while its persistent inbox notice is
  // created in the same claim transaction.
  for (const item of delivery.records) {
    reminders.push({
      monthKey: item.monthKey,
      reminder: item.offsetHours === 168 ? '7 days' : `${item.offsetHours} hours`,
      remindAt: item.remindAt,
      expiresAt: item.expiryAt,
      status: 'due',
      surfacedAt: item.surfacedAt || now,
    });
  }
  reminders.sort((left, right) => left.expiresAt - right.expiresAt || right.remindAt - left.remindAt);
  return reminders;
}

async function deliverDueExpiryNotifications({ userId, run, now }) {
  const due = await MonthlyAnalysisReminder.find({
    userId, progressionRunId: run._id, remindAt: { $lte: now }, expiryAt: { $gt: now }, surfacedAt: null,
  }).sort({ remindAt: 1, _id: 1 }).limit(30).lean();
  const delivered = [];
  for (const reminder of due) {
    const summary = await MonthlyAnalysisSummary.findOne({ userId, progressionRunId: run._id, monthKey: reminder.monthKey }).lean();
    const verified = summary?.aggregationVersion === AGGREGATION_VERSION
      && summary.status === 'finalized'
      && summary.sourceCounts?.taskOccurrences != null;
    if (!verified) {
      // Build and verify the retained aggregate before delivering the reminder
      // or allowing the existing worker to remove old occurrence details.
      await persistSummary({ userId, run, monthKey: reminder.monthKey, now });
    }
    const claimed = await withMongoTransaction(async (session) => {
      const record = await MonthlyAnalysisReminder.findOneAndUpdate({
        _id: reminder._id, userId, progressionRunId: run._id,
        surfacedAt: null, remindAt: { $lte: now }, expiryAt: { $gt: now },
      }, { $set: { surfacedAt: now } }, { new: true, session });
      if (!record) return false;
      const offsetLabel = record.offsetHours === 168 ? '7 days' : `${record.offsetHours} hours`;
      await createNotificationWithinSession({
        userId, progressionRunId: run._id, category: 'monthly-retention', eventType: `monthly-history-expiry-${record.offsetHours}h`,
        title: `${record.monthKey} detailed history expires in ${offsetLabel}`,
        description: `Detailed Task history for ${record.monthKey} is scheduled to expire at ${new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata', timeZoneName: 'short' }).format(record.expiryAt)}. Its aggregate Monthly Analysis summary is retained.`,
        targetRoute: `/app/monthly-analysis?month=${record.monthKey}`,
        idempotencyKey: `monthly-history-expiry:${record._id}`, occurredAt: record.remindAt, createdAt: now, session,
      });
      return record;
    });
    if (claimed) delivered.push({
      monthKey: claimed.monthKey,
      offsetHours: claimed.offsetHours,
      remindAt: claimed.remindAt,
      expiryAt: claimed.expiryAt,
      surfacedAt: claimed.surfacedAt,
    });
  }
  return { count: delivered.length, records: delivered };
}

export async function listMonthlyDetailsForPdf(userId, monthKey, { now = new Date() } = {}) {
  if (!getRetainedMonthKeys(now).includes(monthKey)) return { available: false, items: [] };
  const first = await getMonthlyDetails(userId, monthKey, { now, limit: DETAIL_PAGE_MAX });
  const items = [...first.items];
  let cursor = first.nextCursor;
  while (cursor) {
    const next = await getMonthlyDetails(userId, monthKey, { now, limit: DETAIL_PAGE_MAX, cursor });
    items.push(...next.items);
    cursor = next.nextCursor;
  }
  return { available: true, items };
}

export async function runMonthlyAnalysisForRun({ run, now = new Date(), monthsPerRun = 18, deleteBatchSize = 500, logger = console }) {
  const userId = run.userId;
  const latestMonth = getIstMonthKey(now);
  const runLatestMonth = run.endedOn && run.endedOn.slice(0, 7) < latestMonth ? run.endedOn.slice(0, 7) : latestMonth;
  const previousMonth = shiftMonthKey(latestMonth, -1);
  let checkpoint = await MonthlyAnalysisWorkerCheckpoint.findOne({ progressionRunId: run._id }).lean();
  let monthKey = checkpoint?.nextMonthKey || run.startedOn.slice(0, 7);
  let processedMonths = 0;
  while (monthKey < previousMonth && monthKey <= runLatestMonth && processedMonths < monthsPerRun) {
    const existing = await MonthlyAnalysisSummary.findOne({ userId, progressionRunId: run._id, monthKey }).lean();
    const summary = existing?.aggregationVersion === AGGREGATION_VERSION && existing.sourceCounts?.taskOccurrences != null
      ? existing
      : await persistSummary({ userId, run, monthKey, now });
    processedMonths += 1;
    if (!summary || summary.aggregationVersion !== AGGREGATION_VERSION || summary.sourceCounts?.taskOccurrences == null) throw new Error(`Monthly Task history was retained because ${monthKey} summary did not verify.`);
    const bounds = getIstMonthBounds(monthKey);
    const filter = { userId, progressionRunId: run._id, occurrenceDate: { $gte: bounds.startDate, $lt: bounds.endDate } };
    let ids = [];
    const taskCursor = TaskOccurrence.find(filter).sort({ _id: 1 }).select('_id').cursor({ batchSize: deleteBatchSize });
    for await (const item of taskCursor) {
      ids.push(item._id);
      if (ids.length >= deleteBatchSize) {
        await TaskOccurrence.deleteMany({ userId, progressionRunId: run._id, _id: { $in: ids } });
        ids = [];
      }
    }
    if (ids.length) await TaskOccurrence.deleteMany({ userId, progressionRunId: run._id, _id: { $in: ids } });
    const remainder = await TaskOccurrence.countDocuments(filter);
    if (remainder) throw new Error(`Monthly Task history cleanup did not finish for ${monthKey}; summary remains intact.`);
    monthKey = shiftMonthKey(monthKey, 1);
    await MonthlyAnalysisWorkerCheckpoint.updateOne({ progressionRunId: run._id }, {
      $set: { nextMonthKey: monthKey, updatedAt: now },
      $setOnInsert: { userId, progressionRunId: run._id },
    }, { upsert: true });
  }
  // Keep the active and immediately previous months current; older months are immutable aggregates.
  for (const currentKey of [previousMonth, latestMonth]) {
    if (currentKey >= run.startedOn.slice(0, 7) && currentKey <= runLatestMonth) await persistSummary({ userId, run, monthKey: currentKey, now });
  }
  await scheduleRunReminders({ userId, run, now });
  const expiryNotificationDelivery = await deliverDueExpiryNotifications({ userId, run, now });
  return { runId: String(run._id), processedMonths, expiryNotificationsDelivered: expiryNotificationDelivery.count, nextMonth: monthKey <= latestMonth ? monthKey : null };
}

async function scheduleRunReminders({ userId, run, now }) {
  const retained = getRetainedMonthKeys(now);
  for (const monthKey of retained) {
    if (monthKey < run.startedOn.slice(0, 7) || now >= getDetailExpiry(monthKey)) continue;
    const exists = await TaskOccurrence.exists({ userId, progressionRunId: run._id, occurrenceDate: { $gte: `${monthKey}-01`, $lt: getIstMonthBounds(monthKey).endDate }, status: { $ne: 'cancelled' } });
    if (!exists) continue;
    const expiryAt = getDetailExpiry(monthKey);
    for (const offsetHours of REMINDER_OFFSETS_HOURS) {
      const remindAt = new Date(expiryAt.getTime() - offsetHours * 3_600_000);
      await MonthlyAnalysisReminder.updateOne({ userId, progressionRunId: run._id, monthKey, offsetHours }, { $setOnInsert: { userId, progressionRunId: run._id, monthKey, expiryAt, offsetHours, remindAt, createdAt: now } }, { upsert: true });
    }
  }
}

export async function runMonthlyAnalysisWorkerOnce({ now = new Date(), logger = console, runQuery = () => ProgressionRun.find({}).sort({ userId: 1, runNumber: 1 }).cursor({ batchSize: 25 }) } = {}) {
  let processedRuns = 0;
  const failures = [];
  const cursor = await runQuery();
  for await (const run of cursor) {
    try {
      await runMonthlyAnalysisForRun({ run, now, logger });
      processedRuns += 1;
    } catch (error) {
      failures.push(String(run._id));
      logger.error?.(`[monthly-analysis-run-error] ${JSON.stringify({ runId: String(run._id), name: error?.name || 'Error', message: error?.message || 'Monthly processing failed.' })}`);
    }
  }
  return { processedRuns, failures };
}

export { buildSummary as buildMonthlyAnalysisSummary, getDetailExpiry, getIstMonthBounds, rankLabel };
