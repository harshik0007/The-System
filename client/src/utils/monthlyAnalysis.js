import { DISCIPLINE_TASK_MINIMUM, getRankDisciplineConfig, RANK_DISCIPLINE_CONFIG } from '../data/disciplineConfig.js';
import { RECOVERY_STATUS } from './recoveryQuestManager.js';
import { getScheduleDaySnapshot } from './disciplineActivity.js';
import { getIstDateKey } from './taskScheduleBuilder.js';
import {
  getEmergencyPauseDates,
  getEmergencyPauseDatesForRecord,
  getUniqueEmergencyPauseRecords,
  isEmergencyPauseDate,
} from './emergencyPauseManager.js';
import { getLevelFromTotalXp } from './disciplineManager.js';

const DAY_MS = 86_400_000;
const IST = 'Asia/Kolkata';
const round = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function getIstMonthKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: IST, year: 'numeric', month: '2-digit' }).formatToParts(date);
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${fields.year}-${fields.month}`;
}

export function getMonthBounds(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1, 12));
  const next = new Date(Date.UTC(year, month, 1, 12));
  const last = new Date(next.getTime() - DAY_MS);
  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, '0')}-${String(last.getUTCDate()).padStart(2, '0')}`,
    startAt: new Date(Date.UTC(year, month - 1, 1) - (5.5 * 60 * 60 * 1000)).toISOString(),
    endAt: new Date(Date.UTC(year, month, 1) - (5.5 * 60 * 60 * 1000) - 1).toISOString(),
    expiryDate: `${new Date(Date.UTC(year, month + 1, 1, 12)).getUTCFullYear()}-${String(new Date(Date.UTC(year, month + 1, 1, 12)).getUTCMonth() + 1).padStart(2, '0')}-01`,
  };
}

export function shiftIstMonth(monthKey, amount) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function listIstMonths(startDate, endDate = getIstDateKey()) {
  if (!startDate || startDate > endDate) return [];
  const start = startDate.slice(0, 7);
  const end = endDate.slice(0, 7);
  const months = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 600) {
    months.push(cursor);
    cursor = shiftIstMonth(cursor, 1);
    guard += 1;
  }
  return months;
}

export function formatMonthLabel(monthKey, locale = 'en-IN') {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: IST }).format(new Date(Date.UTC(year, month - 1, 15, 12)));
}

export function getDetailedHistoryExpiryDate(monthKey) {
  return getMonthBounds(monthKey).expiryDate;
}

export function hasDetailedTaskHistory(monthKey, todayKey = getIstDateKey()) {
  return monthKey >= shiftIstMonth(getIstMonthKey(todayKey), -1);
}

function dateOfEvent(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const stamp = Date.parse(value);
  return Number.isFinite(stamp) ? getIstDateKey(new Date(stamp)) : null;
}

function within(dateKey, start, end) {
  return Boolean(dateKey && dateKey >= start && dateKey <= end);
}

export function getEmergencyPauseRecordKey(pause) {
  return pause?.id || pause?.activationEventId || (pause?.startAt ? `legacy-pause:${pause.startAt}` : null);
}

function emergencyPauseResumeType(pause) {
  if (pause?.resumeReason === 'manual' || pause?.status === 'resumed-early') return 'early';
  if (pause?.resumeReason === 'automatic' || pause?.status === 'automatically-resumed') return 'automatic';
  return pause?.status === 'active' ? 'active' : 'unavailable';
}

/**
 * Builds month-scoped Emergency Pause metrics from the same unique records and
 * protected IST dates used by Discipline. Activation/resume events belong to
 * the IST date on which their timestamps occurred; protected days belong to
 * the IST dates intersected by each effective [start, resume) interval.
 */
export function buildEmergencyPauseMonthlyStats(state, { rangeStart, rangeEnd, now = new Date() }) {
  const records = getUniqueEmergencyPauseRecords(state);
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  const activationRecords = records.filter((pause) => within(dateOfEvent(pause.startAt), rangeStart, rangeEnd));
  const protectedDatesByRecord = new Map(records.map((pause) => [pause, getEmergencyPauseDatesForRecord(pause)]));
  const protectedDates = new Set([...protectedDatesByRecord.values()].flatMap((dates) => dates.filter((date) => within(date, rangeStart, rangeEnd))));
  const earlyResumeRecords = records.filter((pause) => emergencyPauseResumeType(pause) === 'early'
    && within(dateOfEvent(pause.actualResumeAt), rangeStart, rangeEnd));
  const automaticResumeRecords = records.filter((pause) => emergencyPauseResumeType(pause) === 'automatic'
    && within(dateOfEvent(pause.actualResumeAt), rangeStart, rangeEnd));
  const todayKey = Number.isFinite(nowMs) ? getIstDateKey(new Date(nowMs)) : null;
  const activeRecords = records.filter((pause) => {
    if (emergencyPauseResumeType(pause) !== 'active') return false;
    const scheduledEnd = Date.parse(pause.scheduledResumeAt);
    if (Number.isFinite(nowMs) && Number.isFinite(scheduledEnd) && nowMs >= scheduledEnd) return false;
    const dates = protectedDatesByRecord.get(pause) || [];
    if (dates.some((date) => within(date, rangeStart, rangeEnd))) return true;
    const startedAt = Date.parse(pause.startAt);
    return within(todayKey, rangeStart, rangeEnd) && Number.isFinite(startedAt) && startedAt <= nowMs;
  });
  const historyRecords = records.filter((pause) => {
    const dates = protectedDatesByRecord.get(pause) || [];
    return within(dateOfEvent(pause.startAt), rangeStart, rangeEnd)
      || within(dateOfEvent(pause.actualResumeAt), rangeStart, rangeEnd)
      || dates.some((date) => within(date, rangeStart, rangeEnd))
      || activeRecords.includes(pause);
  });
  const unavailableHistoryRecords = historyRecords.filter((pause) => {
    const type = emergencyPauseResumeType(pause);
    const ended = type === 'early' || type === 'automatic';
    return !pause.startAt
      || !Number.isFinite(Date.parse(pause.startAt))
      || !Number.isInteger(Number(pause.durationDays))
      || Number(pause.durationDays) <= 0
      || !Number.isFinite(Date.parse(pause.scheduledResumeAt))
      || (ended && !Number.isFinite(Date.parse(pause.actualResumeAt)));
  });
  const ids = (items) => items.map(getEmergencyPauseRecordKey).filter(Boolean);

  return {
    used: activationRecords.length,
    monthlyUsage: activationRecords.length,
    totalPauseDays: protectedDates.size,
    pauseEventIds: ids(activationRecords),
    activationEventIds: activationRecords.map((pause) => pause.activationEventId || getEmergencyPauseRecordKey(pause)).filter(Boolean),
    earlyResumeCount: earlyResumeRecords.length,
    earlyResumeEventIds: earlyResumeRecords.map((pause) => pause.resumeEventId || getEmergencyPauseRecordKey(pause)).filter(Boolean),
    automaticResumeCount: automaticResumeRecords.length,
    automaticResumeEventIds: automaticResumeRecords.map((pause) => pause.resumeEventId || getEmergencyPauseRecordKey(pause)).filter(Boolean),
    activeCount: activeRecords.length,
    activePauseIds: ids(activeRecords),
    historyRecordIds: ids(historyRecords),
    unavailableHistoryCount: unavailableHistoryRecords.length,
  };
}

function filterRunEvents(items, excludedIds, progressionRunId, runStartDate, getDate = (item) => item.date) {
  const excluded = new Set(excludedIds || []);
  return (items || []).filter((item) => {
    const eventDate = dateOfEvent(getDate(item));
    return (item.progressionRunId === progressionRunId || !excluded.has(item.id)) && (!eventDate || eventDate >= runStartDate);
  });
}

function makeRunSources({ disciplineState, schedule, recoveryState, emergencyPauseState, progressionRunId, runStartDate, runBaseline }) {
  const excluded = runBaseline?.excluded || {};
  const discipline = {
    ...disciplineState,
    dailyRecords: Object.fromEntries(Object.entries(disciplineState?.dailyRecords || {}).filter(([date, record]) => !excluded.dailyRecordDates?.includes(date) || record.progressionRunId === progressionRunId)),
    xpHistory: filterRunEvents(disciplineState?.xpHistory, excluded.xpEventIds, progressionRunId, runStartDate),
    dpEvents: filterRunEvents(disciplineState?.dpEvents, excluded.dpEventIds, progressionRunId, runStartDate),
    rankEntryEvents: filterRunEvents(disciplineState?.rankEntryEvents, excluded.rankEventIds, progressionRunId, runStartDate),
    dailyRankXpEvents: filterRunEvents(disciplineState?.dailyRankXpEvents, excluded.dailyRankEventIds, progressionRunId, runStartDate),
    levelDownEvents: filterRunEvents(disciplineState?.levelDownEvents, excluded.levelEventIds, progressionRunId, runStartDate),
    redemptionEvents: filterRunEvents(disciplineState?.redemptionEvents, excluded.redemptionEventIds, progressionRunId, runStartDate),
  };
  const quests = (recoveryState?.quests || []).filter((quest) => quest.progressionRunId === progressionRunId
    || (quest.activationDate >= runStartDate && !excluded.recoveryQuestIds?.includes(quest.id)));
  const questIds = new Set(quests.map((quest) => quest.id));
  const recovery = {
    ...recoveryState,
    quests,
    gracePointEvents: filterRunEvents(recoveryState?.gracePointEvents, excluded.graceEventIds, progressionRunId, runStartDate),
    activity: (recoveryState?.activity || []).filter((event) => event.progressionRunId === progressionRunId || (questIds.has(event.questId) && !excluded.recoveryActivityIds?.includes(event.id))),
  };
  const occurrences = Object.fromEntries(Object.entries(schedule?.occurrences || {}).filter(([key, item]) => item.progressionRunId === progressionRunId || !excluded.occurrenceKeys?.includes(key)));
  return { discipline, schedule: { ...schedule, occurrences }, recovery, emergencyPauseState };
}

function eventDaysInMonth(items, getDate = (item) => item.date, start, end) {
  return (items || []).filter((item) => within(dateOfEvent(getDate(item)), start, end));
}

function emptyDistribution() {
  return { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, moreThanSeven: 0 };
}

function dayAtNoon(dateKey) {
  return new Date(`${dateKey}T12:00:00Z`);
}

function makeTimeline({ start, end, disciplineState, schedule, recoveryState, emergencyPauseState, todayKey, xpEvents, dpEvents, redemptionEvents, graceEvents }) {
  const dateSet = new Set();
  Object.keys(disciplineState?.dailyRecords || {}).filter((date) => within(date, start, end)).forEach((date) => dateSet.add(date));
  for (const list of [xpEvents, dpEvents, redemptionEvents, graceEvents, recoveryState?.activity || []]) {
    (list || []).forEach((event) => {
      const date = dateOfEvent(event.date || event.at);
      if (within(date, start, end)) dateSet.add(date);
    });
  }
  (recoveryState?.quests || []).forEach((quest) => [quest.activationDate, quest.completedDate, quest.expiryDate, quest.clearedDate].forEach((date) => {
    if (within(date, start, end)) dateSet.add(date);
  }));
  getEmergencyPauseDates(emergencyPauseState).filter((date) => within(date, start, end)).forEach((date) => dateSet.add(date));
  if (within(todayKey, start, end)) dateSet.add(todayKey);

  return [...dateSet].sort().map((date) => {
    const saved = disciplineState?.dailyRecords?.[date] || null;
    const paused = Boolean(saved?.emergencyPause || isEmergencyPauseDate(emergencyPauseState, date));
    const current = date === todayKey && !saved && !paused ? getScheduleDaySnapshot(schedule, date, { todayKey }) : null;
    const scheduled = saved?.hasDailyResetRecord ? Number(saved.scheduledTaskCount) : current?.scheduledTaskCount ?? null;
    const completed = saved?.hasDailyResetRecord ? Number(saved.completedTaskCount) : current?.completedTaskCount ?? null;
    const finalized = Boolean(saved?.hasDailyResetRecord);
    const missed = finalized && scheduled !== null ? Math.max(0, scheduled - completed) : null;
    const pending = !finalized && scheduled !== null ? Math.max(0, scheduled - completed) : null;
    const quests = (recoveryState?.quests || []).filter((quest) => [quest.activationDate, quest.completedDate, quest.expiryDate, quest.clearedDate].some((candidate) => candidate === date));
    const xps = eventDaysInMonth(xpEvents, (item) => item.date, date, date);
    const dps = eventDaysInMonth(dpEvents, (item) => item.date, date, date);
    const redemptions = eventDaysInMonth(redemptionEvents, (item) => item.date || item.at, date, date);
    const gps = eventDaysInMonth(graceEvents, (item) => item.date, date, date);
    const dailyRankBonus = xps.filter((event) => event.kind === 'daily-rank-bonus').reduce((sum, event) => sum + Math.max(0, Number(event.amount) || 0), 0);
    const xpDrain = xps.filter((event) => Number(event.amount) < 0).reduce((sum, event) => sum + Math.abs(Number(event.amount)), 0);
    const protectedDay = paused;
    const qualifies = saved ? saved.qualificationStatus === 'qualified' || saved.qualificationStatus === 'emergency-pause-protected' : current?.completedTaskCount >= DISCIPLINE_TASK_MINIMUM;
    return {
      date,
      task: scheduled === null ? null : { scheduled, completed, missed, pending, finalized, completionPercent: scheduled ? Math.round((completed / scheduled) * 100) : 0 },
      discipline: { status: protectedDay ? 'protected' : saved?.qualificationStatus === 'qualified' || (!saved && qualifies) ? 'qualified' : saved?.hasDailyResetRecord ? 'not-qualified' : date === todayKey ? 'in-progress' : 'unavailable', streakBreak: Boolean(saved?.hasDailyResetRecord && !saved.qualifies && !protectedDay), protected: protectedDay, qualifies: Boolean(qualifies) },
      quests: {
        generated: quests.filter((quest) => quest.activationDate === date).length,
        completed: quests.filter((quest) => quest.completedDate === date).length,
        expired: quests.filter((quest) => quest.expiryDate === date).length,
        thresholdCleared: quests.filter((quest) => quest.clearedDate === date).length,
        activeAtEnd: (recoveryState?.quests || []).filter((quest) => quest.activationDate <= date && (!quest.completedDate || quest.completedDate > date) && (!quest.expiryDate || quest.expiryDate > date) && (!quest.clearedDate || quest.clearedDate > date)).length,
        frozen: protectedDay,
      },
      xp: xps.length ? { earned: round(xps.filter((event) => Number(event.amount) > 0).reduce((sum, event) => sum + Number(event.amount), 0)), drained: round(xpDrain), recoveryQuestDrain: round(xps.filter((event) => event.kind === 'recovery-drain').reduce((sum, event) => sum + Math.abs(Number(event.amount) || 0), 0)), dailyRankBonus: round(dailyRankBonus), net: round(xps.reduce((sum, event) => sum + (Number(event.amount) || 0), 0)), levelAfterReset: saved?.levelAfterReset ?? null } : null,
      balances: { dpEventIds: dps.map((event) => event.id), redemptionEventIds: redemptions.map((event) => event.id), graceEventIds: gps.map((event) => event.id) },
      hasResetRecord: finalized,
    };
  });
}

function buildTaskStats({ records, pauseDates, schedule, recoveryState, todayKey, rangeStart, rangeEnd, detailedAvailable }) {
  const finalized = records.filter((record) => record.hasDailyResetRecord && Number(record.scheduledTaskCount) > 0 && !record.emergencyPause && !pauseDates.has(record.date));
  const pausedRecords = records.filter((record) => record.hasDailyResetRecord && (record.emergencyPause || pauseDates.has(record.date)));
  const scheduledFinalized = finalized.reduce((sum, record) => sum + Number(record.scheduledTaskCount || 0), 0);
  const completedFinalized = finalized.reduce((sum, record) => sum + Number(record.completedTaskCount || 0), 0);
  const distribution = emptyDistribution();
  finalized.forEach((record) => {
    const count = Math.max(0, Number(record.completedTaskCount) || 0);
    if (count > 7) distribution.moreThanSeven += 1;
    else distribution[String(count)] += 1;
  });
  const currentSnapshot = within(todayKey, rangeStart, rangeEnd) && !pauseDates.has(todayKey) && !records.some((record) => record.date === todayKey && record.hasDailyResetRecord)
    ? getScheduleDaySnapshot(schedule, todayKey, { todayKey })
    : null;
  const currentTaskList = currentSnapshot?.tasks || [];
  const currentCompleted = currentTaskList.filter((task) => task.status === 'completed').length;
  // A task marked incomplete today is still part of an unfinished date until the IST reset finalizes it.
  const currentPending = currentTaskList.filter((task) => task.status !== 'completed').length;
  const currentScheduled = currentTaskList.length;
  const allCompleted = completedFinalized + currentCompleted;
  const missed = finalized.reduce((sum, record) => sum + Math.max(0, Number(record.scheduledTaskCount || 0) - Number(record.completedTaskCount || 0)), 0);
  const eligibleDays = finalized.length;
  const best = [...finalized].sort((a, b) => Number(b.completedTaskCount) - Number(a.completedTaskCount) || a.date.localeCompare(b.date))[0] || null;
  const worst = [...finalized].sort((a, b) => Number(a.completedTaskCount) - Number(b.completedTaskCount) || a.date.localeCompare(b.date))[0] || null;
  const daysByCompleted = finalized.map((record) => ({ date: record.date, completed: Number(record.completedTaskCount) || 0, scheduled: Number(record.scheduledTaskCount) || 0, missed: Math.max(0, Number(record.scheduledTaskCount || 0) - Number(record.completedTaskCount || 0)) }));
  const dayEvents = detailedAvailable ? (schedule?.occurrences ? Object.entries(schedule.occurrences).flatMap(([key, item]) => {
    const date = key.split(':').at(-1);
    if (!within(date, rangeStart, rangeEnd) || item?.status !== 'missed') return [];
    const [taskId, cycleDay] = key.split(':');
    const definition = schedule.tasks?.find((task) => task.id === taskId) || schedule.taskHistory?.filter((task) => task.id === taskId).sort((a, b) => a.changedAt.localeCompare(b.changedAt)).at(-1) || {};
    return [{ id: key, date, taskId, cycleDay: Number(cycleDay) || null, taskName: item.snapshot?.name || definition.name || 'Task detail unavailable', actionTitle: item.snapshot?.actionTitle || definition.actionTitle || '', questStatus: (recoveryState?.quests || []).find((quest) => quest.occurrenceKey === key)?.status || null }];
  }) : []) : null;
  return {
    scheduled: scheduledFinalized + currentScheduled,
    completed: allCompleted,
    finalizedScheduled: scheduledFinalized,
    finalizedCompleted: completedFinalized,
    missed,
    pending: currentPending,
    completionRate: scheduledFinalized ? round((completedFinalized / scheduledFinalized) * 100) : null,
    averageCompletedPerEligibleDay: eligibleDays ? round(completedFinalized / eligibleDays) : null,
    averageMissedPerEligibleDay: eligibleDays ? round((scheduledFinalized - completedFinalized) / eligibleDays) : null,
    eligibleDays,
    scheduledDays: finalized.length + (currentScheduled > 0 ? 1 : 0),
    protectedDays: pausedRecords.length,
    distribution,
    bestDay: best ? { date: best.date, completed: Number(best.completedTaskCount), scheduled: Number(best.scheduledTaskCount) } : null,
    lowestDay: worst ? { date: worst.date, completed: Number(worst.completedTaskCount), scheduled: Number(worst.scheduledTaskCount) } : null,
    exactlyFiveDays: finalized.filter((record) => Number(record.completedTaskCount) === 5).length,
    exactlySixDays: finalized.filter((record) => Number(record.completedTaskCount) === 6).length,
    exactlySevenDays: finalized.filter((record) => Number(record.completedTaskCount) === 7).length,
    moreThanSevenDays: finalized.filter((record) => Number(record.completedTaskCount) > 7).length,
    finalizedDaySeries: daysByCompleted,
    missedTaskDetails: dayEvents,
    taskDetailsAvailable: detailedAvailable,
  };
}

function getXpStats(disciplineState, xpEvents, rangeStart, rangeEnd, currentMonth, todayKey, runBaseline) {
  const eventPriority = (event) => event.kind === 'recovery-drain' ? 0 : event.kind === 'daily-rank-bonus' ? 1 : 2;
  const ordered = [...(disciplineState?.xpHistory || [])].filter((event) => event.date && event.date >= (runBaseline?.date || disciplineState?.memberSince) && event.date <= todayKey).sort((a, b) => a.date.localeCompare(b.date) || eventPriority(a) - eventPriority(b));
  const runStart = runBaseline?.date || disciplineState?.memberSince;
  const hasBaseline = Number.isFinite(Number(runBaseline?.totalXp));
  const baseline = hasBaseline ? Number(runBaseline.totalXp) : null;
  const priorEvents = ordered.filter((event) => event.date < rangeStart);
  const inRange = ordered.filter((event) => event.date >= rangeStart && event.date <= rangeEnd);
  const startBalance = priorEvents.length
    ? Number(priorEvents.at(-1).totalAfter)
    : hasBaseline && rangeStart >= runStart ? baseline : inRange[0] && Number.isFinite(Number(inRange[0].totalAfter)) ? Number(inRange[0].totalAfter) - (Number(inRange[0].amount) || 0) : null;
  const endBalance = currentMonth
    ? Number(disciplineState.totalXp)
    : inRange.length && Number.isFinite(Number(inRange.at(-1).totalAfter))
      ? Number(inRange.at(-1).totalAfter)
      : priorEvents.length ? Number(priorEvents.at(-1).totalAfter) : hasBaseline && rangeEnd >= runStart ? baseline : null;
  const hasStart = Number.isFinite(startBalance);
  const hasEnd = Number.isFinite(endBalance);
  const earnedEvents = xpEvents.filter((event) => Number(event.amount) > 0);
  const drainedEvents = xpEvents.filter((event) => Number(event.amount) < 0);
  const eventHistoryAvailable = hasBaseline || ordered.length > 0;
  const earned = eventHistoryAvailable ? round(earnedEvents.reduce((sum, event) => sum + Number(event.amount), 0)) : null;
  const drained = eventHistoryAvailable ? round(drainedEvents.reduce((sum, event) => sum + Math.abs(Number(event.amount)), 0)) : null;
  const records = Object.values(disciplineState?.dailyRecords || {}).filter((record) => record.date <= rangeEnd && record.hasDailyResetRecord).sort((a, b) => a.date.localeCompare(b.date));
  const priorLevelRecord = records.filter((record) => record.date < rangeStart && Number.isFinite(Number(record.levelAfterReset))).at(-1);
  const monthLevelRecords = records.filter((record) => record.date >= rangeStart && record.date <= rangeEnd && Number.isFinite(Number(record.levelAfterReset)));
  const endingLevel = currentMonth ? getLevelFromTotalXp(disciplineState.totalXp) : monthLevelRecords.at(-1)?.levelAfterReset ?? null;
  const startingLevel = priorLevelRecord?.levelAfterReset ?? (runBaseline?.date?.slice(0, 7) === rangeStart.slice(0, 7) ? runBaseline.level : null);
  return {
    startingXp: hasStart ? round(startBalance) : null,
    endingXp: hasEnd ? round(endBalance) : null,
    earned,
    drained,
    net: eventHistoryAvailable ? round(earned - drained) : null,
    dailyRankBonus: eventHistoryAvailable ? round(xpEvents.filter((event) => event.kind === 'daily-rank-bonus').reduce((sum, event) => sum + Number(event.amount || 0), 0)) : null,
    recoveryQuestDrain: eventHistoryAvailable ? round(xpEvents.filter((event) => event.kind === 'recovery-drain').reduce((sum, event) => sum + Math.abs(Number(event.amount || 0)), 0)) : null,
    recoveryDrainEvents: xpEvents.filter((event) => event.kind === 'recovery-drain').length,
    dailyRankBonusEvents: xpEvents.filter((event) => event.kind === 'daily-rank-bonus').length,
    startingLevel,
    endingLevel,
    levelsGained: null,
    levelsLost: (disciplineState?.levelDownEvents || []).filter((event) => event.date >= rangeStart && event.date <= rangeEnd).length,
    levelEventIds: (disciplineState?.levelDownEvents || []).filter((event) => event.date >= rangeStart && event.date <= rangeEnd).map((event) => event.id),
    eventHistoryAvailable,
  };
}

function getBalanceAtMonth({ initial, events, dateKey, amount = (event) => Number(event.amount) || 0, after = (event) => event.balanceAfter ?? event.totalAfter }) {
  if (!Number.isFinite(Number(initial))) return null;
  let value = Number(initial);
  const days = [...events].filter((item) => item.date <= dateKey).reduce((groups, item) => {
    groups.set(item.date, [...(groups.get(item.date) || []), item]);
    return groups;
  }, new Map());
  for (const group of days.values()) {
    let remaining = [...group];
    while (remaining.length) {
      const matchingIndex = remaining.findIndex((event) => {
        const before = event.balanceBefore ?? event.dpBalanceBefore ?? event.gracePointsBefore;
        return Number.isFinite(Number(before)) && Math.abs(Number(before) - value) < 0.011;
      });
      const [event] = remaining.splice(matchingIndex >= 0 ? matchingIndex : 0, 1);
      const recordedAfter = after(event);
      if (Number.isFinite(Number(recordedAfter))) value = Number(recordedAfter);
      else value += amount(event);
    }
  }
  return round(value);
}

export function buildMonthlySummary({
  monthKey,
  todayKey = getIstDateKey(),
  disciplineState,
  schedule,
  recoveryState,
  emergencyPauseState,
  progressionRunId = disciplineState?.progressionRunId || 'current-run',
  runStartDate = disciplineState?.memberSince || todayKey,
  runBaseline = null,
  runEndDate = null,
  generatedAt = new Date().toISOString(),
  forceFinalized = false,
}) {
  const bounds = getMonthBounds(monthKey);
  const rawEnd = runEndDate && runEndDate < bounds.endDate ? runEndDate : bounds.endDate;
  const rangeStart = runStartDate > bounds.startDate ? runStartDate : bounds.startDate;
  const rangeEnd = rawEnd > todayKey && !forceFinalized ? todayKey : rawEnd;
  const finalizedMonth = monthKey < getIstMonthKey(todayKey) || forceFinalized || Boolean(runEndDate);
  const status = finalizedMonth ? 'finalized' : 'partial';
  const detailedAvailable = hasDetailedTaskHistory(monthKey, todayKey);
  const sources = makeRunSources({ disciplineState, schedule, recoveryState, emergencyPauseState, progressionRunId, runStartDate, runBaseline });
  const dataDiscipline = sources.discipline;
  const dataSchedule = sources.schedule;
  const dataRecovery = sources.recovery;
  const rawPauseState = sources.emergencyPauseState;
  const dataPauses = { ...rawPauseState, pauses: getUniqueEmergencyPauseRecords(rawPauseState) };
  const dailyRecords = Object.values(dataDiscipline.dailyRecords || {}).filter((record) => within(record.date, rangeStart, rangeEnd));
  const pauseDates = new Set(getEmergencyPauseDates(dataPauses).filter((date) => within(date, rangeStart, rangeEnd)));
  const xpEvents = eventDaysInMonth(dataDiscipline.xpHistory || [], (event) => event.date, rangeStart, rangeEnd);
  const dpEvents = eventDaysInMonth(dataDiscipline.dpEvents || [], (event) => event.date, rangeStart, rangeEnd);
  const redemptions = eventDaysInMonth(dataDiscipline.redemptionEvents || [], (event) => event.date || event.at, rangeStart, rangeEnd);
  const graceEvents = eventDaysInMonth(dataRecovery.gracePointEvents || [], (event) => event.date, rangeStart, rangeEnd);
  const runStart = runBaseline?.date || runStartDate;
  const monthQuests = (dataRecovery.quests || []).filter((quest) => quest.activationDate >= runStart && ([quest.activationDate, quest.completedDate, quest.expiryDate, quest.clearedDate].some((date) => within(date, rangeStart, rangeEnd)) || (quest.status === RECOVERY_STATUS.ACTIVE && quest.activationDate <= rangeEnd)));
  const taskStats = buildTaskStats({ records: dailyRecords, pauseDates, schedule: dataSchedule, recoveryState: dataRecovery, todayKey, rangeStart, rangeEnd, detailedAvailable });
  const allRecords = Object.values(dataDiscipline.dailyRecords || {}).filter((record) => record.date >= (runBaseline?.date || runStartDate) && record.date <= rangeEnd && record.hasDailyResetRecord).sort((a, b) => a.date.localeCompare(b.date));
  const monthRecords = allRecords.filter((record) => within(record.date, rangeStart, rangeEnd));
  const nonProtectedRecords = monthRecords.filter((record) => !record.emergencyPause && !pauseDates.has(record.date));
  const qualifyingDays = nonProtectedRecords.filter((record) => record.qualificationStatus === 'qualified' || record.qualifies).length;
  const nonQualifyingDays = nonProtectedRecords.filter((record) => record.qualificationStatus === 'not-qualified' || (!record.qualifies && record.hasDailyResetRecord)).length;
  let streak = rangeStart === (runBaseline?.date || runStartDate) ? Number(runBaseline?.streak) || 0 : 0;
  let streakBefore = streak;
  let longest = streak;
  let breaks = 0;
  let sawMonthRecord = false;
  let previousRecordDate = null;
  for (const record of allRecords) {
    if (previousRecordDate && addIstDays(record.date, -1) !== previousRecordDate) streak = 0;
    const protectedDay = Boolean(record.emergencyPause || isEmergencyPauseDate(dataPauses, record.date));
    const qualifies = Boolean(record.qualifies || protectedDay);
    if (record.date < rangeStart) {
      streak = qualifies ? streak + 1 : 0;
      previousRecordDate = record.date;
      continue;
    }
    if (!sawMonthRecord) { streakBefore = streak; sawMonthRecord = true; }
    if (qualifies) streak += 1;
    else { if (streak > 0) breaks += 1; streak = 0; }
    longest = Math.max(longest, streak);
    previousRecordDate = record.date;
  }
  const streakEnd = monthKey === getIstMonthKey(todayKey) && !runEndDate ? Number(disciplineState?.currentStreak) : streak;
  const rankEvents = (dataDiscipline.rankEntryEvents || []).filter((event) => event.progressionRunId === progressionRunId && within(event.date, rangeStart, rangeEnd)).sort((a, b) => a.date.localeCompare(b.date));
  const recurringEvents = dpEvents.filter((event) => event.kind === 'recurring').map((event) => {
    const number = event.title?.match(/Rank\s+(\d+)/i)?.[1];
    const config = Object.values(RANK_DISCIPLINE_CONFIG).find((item) => item.number === number);
    return { ...event, rankNumber: number || null, rankName: config?.name || event.title?.match(/Rank\s+\d+\s+(.+?)\s+Discipline/i)?.[1] || 'Rank configuration unavailable', requiredDays: config?.cycleDays ?? null };
  });
  const entryEvents = dpEvents.filter((event) => event.kind === 'rank-entry');
  const currentRank = getRankDisciplineConfig(disciplineState?.currentRankSlug);
  const rankEventBefore = [...(dataDiscipline.rankEntryEvents || [])].filter((event) => event.progressionRunId === progressionRunId && event.date < rangeStart).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const startRankSlug = rankEventBefore?.rankSlug || (runBaseline?.rankSlug || (rangeStart === runStartDate ? disciplineState?.currentRankSlug : null));
  const startRank = startRankSlug ? getRankDisciplineConfig(startRankSlug) : null;
  const pauseEvents = (dataPauses?.pauses || []).filter((pause) => within(dateOfEvent(pause.startAt), rangeStart, rangeEnd));
  const pauseStats = buildEmergencyPauseMonthlyStats(dataPauses, { rangeStart, rangeEnd, now: generatedAt });
  const xpStats = getXpStats(dataDiscipline, xpEvents, rangeStart, rangeEnd, monthKey === getIstMonthKey(todayKey) && !runEndDate, todayKey, runBaseline);
  const questGenerated = monthQuests.filter((quest) => within(quest.activationDate, rangeStart, rangeEnd)).length;
  const questCompleted = monthQuests.filter((quest) => within(quest.completedDate, rangeStart, rangeEnd)).length;
  const questExpired = monthQuests.filter((quest) => within(quest.expiryDate, rangeStart, rangeEnd)).length;
  const questCleared = monthQuests.filter((quest) => within(quest.clearedDate, rangeStart, rangeEnd)).length;
  const resolved = questCompleted + questExpired + questCleared;
  const activeAt = (date) => (dataRecovery?.quests || []).filter((quest) => quest.activationDate <= date && (!quest.completedDate || quest.completedDate > date) && (!quest.expiryDate || quest.expiryDate > date) && (!quest.clearedDate || quest.clearedDate > date));
  const questsAtStart = activeAt(dateKeyBefore(rangeStart)).length;
  const questsAtEnd = activeAt(rangeEnd).length;
  const frozenAtEnd = questsAtEnd > 0 && isEmergencyPauseDate(dataPauses, rangeEnd);
  const xpDrain = round(xpEvents.filter((event) => event.kind === 'recovery-drain').reduce((sum, event) => sum + Math.abs(Number(event.amount || 0)), 0));
  const graceAdded = round(redemptions.reduce((sum, event) => sum + Number(event.gracePointsAdded || 0), 0));
  const graceExpiry = round(graceEvents.filter((event) => event.kind === 'expiry').reduce((sum, event) => sum + Number(event.appliedAmount || 0), 0));
  const graceThreshold = round(graceEvents.filter((event) => event.kind === 'threshold').reduce((sum, event) => sum + Number(event.appliedAmount || 0), 0));
  const allDpEvents = (dataDiscipline?.dpEvents || []).filter((event) => event.date >= runStart);
  const allRedemptions = (dataDiscipline?.redemptionEvents || []).filter((event) => event.date >= runStart);
  const initialDp = Number(runBaseline?.dpBalance);
  const initialGrace = Number(runBaseline?.gracePoints);
  const combinedDpEvents = [...allDpEvents, ...allRedemptions.map((event) => ({ ...event, amount: -Number(event.dpSpent || 0), balanceBefore: event.dpBalanceBefore, balanceAfter: event.dpBalanceAfter }))];
  const startingDp = getBalanceAtMonth({ initial: initialDp, events: combinedDpEvents, dateKey: dateKeyBefore(rangeStart), after: (event) => event.balanceAfter ?? event.dpBalanceAfter });
  const endingDp = getBalanceAtMonth({ initial: initialDp, events: combinedDpEvents, dateKey: rangeEnd, after: (event) => event.balanceAfter ?? event.dpBalanceAfter });
  const gpEventsWithRedemptions = [
    ...(dataRecovery?.gracePointEvents || []).filter((event) => event.date >= runStart),
    ...(dataDiscipline?.redemptionEvents || []).filter((event) => event.date >= runStart).map((event) => ({ ...event, id: `grace-${event.id}`, amount: Number(event.gracePointsAdded || 0), balanceBefore: event.gracePointsBefore, balanceAfter: event.gracePointsAfter })),
  ];
  const startingGrace = getBalanceAtMonth({ initial: initialGrace, events: gpEventsWithRedemptions, dateKey: dateKeyBefore(rangeStart), after: (event) => event.balanceAfter });
  let endingGrace = getBalanceAtMonth({ initial: initialGrace, events: gpEventsWithRedemptions, dateKey: rangeEnd, after: (event) => event.balanceAfter });
  let currentEndingDp = endingDp;
  if (monthKey === getIstMonthKey(todayKey) && !runEndDate) {
    currentEndingDp = Number(dataDiscipline?.dpBalance);
    endingGrace = Number(dataRecovery?.gracePoints);
  }
  const timeline = makeTimeline({ start: rangeStart, end: rangeEnd, disciplineState: dataDiscipline, schedule: dataSchedule, recoveryState: dataRecovery, emergencyPauseState: dataPauses, todayKey, xpEvents, dpEvents, redemptionEvents: redemptions, graceEvents });
  const activeRunTasks = taskStats.scheduled > 0 || dailyRecords.length > 0;
  const hasData = activeRunTasks || monthQuests.length > 0 || xpEvents.length > 0 || dpEvents.length > 0 || graceEvents.length > 0 || pauseStats.used > 0 || pauseStats.totalPauseDays > 0 || pauseStats.activeCount > 0 || rankEvents.length > 0;
  const label = `${formatMonthLabel(monthKey)}${status === 'partial' ? ' · Partial' : ''}`;

  return {
    id: `${progressionRunId}:${monthKey}`,
    progressionRunId,
    year: Number(monthKey.slice(0, 4)),
    month: Number(monthKey.slice(5, 7)),
    monthKey,
    monthLabel: label,
    monthStart: bounds.startAt,
    monthEnd: bounds.endAt,
    rangeStart,
    rangeEnd,
    runStartDate,
    status,
    generatedAt,
    detailedHistoryExpiresAt: bounds.expiryDate,
    availability: { hasData, detailedTaskHistory: detailedAvailable, reason: detailedAvailable ? null : 'Detailed task history expires after the current and immediately preceding calendar months. Aggregate monthly records remain available.' },
    sourceIds: {
      dailyRecordDates: dailyRecords.map((record) => record.date),
      xpEventIds: xpEvents.map((event) => event.id),
      recoveryQuestIds: monthQuests.filter((quest) => within(quest.activationDate, rangeStart, rangeEnd) || within(quest.completedDate, rangeStart, rangeEnd) || within(quest.expiryDate, rangeStart, rangeEnd) || within(quest.clearedDate, rangeStart, rangeEnd)).map((quest) => quest.id),
      disciplinePointEventIds: dpEvents.map((event) => event.id),
      gracePointEventIds: graceEvents.map((event) => event.id),
      recurringDpEventIds: recurringEvents.map((event) => event.id),
      rankEntryDpEventIds: entryEvents.map((event) => event.id),
      redemptionEventIds: redemptions.map((event) => event.id),
      dailyRankEventIds: (dataDiscipline.dailyRankXpEvents || []).filter((event) => within(event.date, rangeStart, rangeEnd)).map((event) => event.id),
      levelDownEventIds: (dataDiscipline.levelDownEvents || []).filter((event) => within(event.date, rangeStart, rangeEnd)).map((event) => event.id),
      recoveryActivityIds: (dataRecovery.activity || []).filter((event) => within(event.date, rangeStart, rangeEnd)).map((event) => event.id),
      xpDrainEventIds: (dataDiscipline.xpDrainEvents || []).filter((event) => within(event.date, rangeStart, rangeEnd)).map((event) => event.id),
      rankEventIds: rankEvents.map((event) => event.id),
      emergencyPauseIds: pauseEvents.map((pause) => getEmergencyPauseRecordKey(pause)).filter(Boolean),
      emergencyPauseHistoryIds: pauseStats.historyRecordIds,
    },
    taskStats,
    disciplineStats: {
      qualifyingDays,
      nonQualifyingDays,
      protectedDays: pauseDates.size,
      eligibleNonPausedDays: nonProtectedRecords.filter((record) => Number(record.scheduledTaskCount) > 0).length,
      qualificationRate: nonProtectedRecords.filter((record) => Number(record.scheduledTaskCount) > 0).length ? round(qualifyingDays / nonProtectedRecords.filter((record) => Number(record.scheduledTaskCount) > 0).length * 100) : null,
      streakBreaks: breaks,
      longestStreak: longest,
      startingStreak: streakBefore,
      endingStreak: streakEnd,
      currentStreak: monthKey === getIstMonthKey(todayKey) ? disciplineState?.currentStreak ?? null : null,
      recurringRewardCount: recurringEvents.length,
      recurringDpAwarded: round(recurringEvents.reduce((sum, event) => sum + Number(event.amount || 0), 0)),
      recurringEventIds: recurringEvents.map((event) => event.id),
      rewardCycleStartProgress: rangeStart === runStartDate ? runBaseline?.cycleProgress ?? null : null,
      rewardCycleEndProgress: monthKey === getIstMonthKey(todayKey) && !runEndDate ? disciplineState?.cycle?.progress ?? null : null,
    },
    recoveryStats: {
      generated: questGenerated,
      activeAtStart: questsAtStart,
      completed: questCompleted,
      individuallyExpired: questExpired,
      thresholdCleared: questCleared,
      activeAtEnd: questsAtEnd,
      frozenAtEnd,
      resolvedCompletionRate: resolved ? round(questCompleted / resolved * 100) : null,
      resolvedOutcomes: resolved,
      xpDrained: xpDrain,
      xpDrainDays: xpEvents.filter((event) => event.kind === 'recovery-drain' && Number(event.amount) < 0).length,
      largestDailyXpDrain: xpEvents.filter((event) => event.kind === 'recovery-drain').reduce((max, event) => Math.max(max, Math.abs(Number(event.amount) || 0)), 0),
      graceExpiryDeductions: graceExpiry,
      graceThresholdDeductions: graceThreshold,
      questIds: monthQuests.filter((quest) => within(quest.activationDate, rangeStart, rangeEnd) || within(quest.completedDate, rangeStart, rangeEnd) || within(quest.expiryDate, rangeStart, rangeEnd) || within(quest.clearedDate, rangeStart, rangeEnd)).map((quest) => quest.id),
      averageCompletionDays: null,
    },
    xpStats,
    graceStats: {
      startingBalance: Number.isFinite(startingGrace) ? startingGrace : null,
      added: graceAdded,
      expiryDeductions: graceExpiry,
      thresholdDeductions: graceThreshold,
      endingBalance: Number.isFinite(endingGrace) ? endingGrace : null,
      eventIds: [...graceEvents.map((event) => event.id), ...redemptions.map((event) => `grace-${event.id}`)],
    },
    dpStats: {
      startingBalance: Number.isFinite(startingDp) ? startingDp : null,
      recurringAwarded: round(recurringEvents.reduce((sum, event) => sum + Number(event.amount || 0), 0)),
      rankEntryAwarded: round(entryEvents.reduce((sum, event) => sum + Number(event.amount || 0), 0)),
      redeemed: round(redemptions.reduce((sum, event) => sum + Number(event.dpSpent || 0), 0)),
      endingBalance: Number.isFinite(currentEndingDp) ? currentEndingDp : null,
      eventIds: [...dpEvents.map((event) => event.id), ...redemptions.map((event) => event.id)],
      currentBalance: monthKey === getIstMonthKey(todayKey) ? Number(disciplineState?.dpBalance) : null,
    },
    rankStats: {
      startingRank: startRank ? { slug: startRank.id, number: startRank.number, name: startRank.name } : null,
      endingRank: monthKey === getIstMonthKey(todayKey) || (runEndDate && monthKey === getIstMonthKey(runEndDate)) ? { slug: currentRank.id, number: currentRank.number, name: currentRank.name } : rankEvents.at(-1) ? { slug: rankEvents.at(-1).rankSlug, number: rankEvents.at(-1).rankNumber, name: rankEvents.at(-1).rankName } : startRank ? { slug: startRank.id, number: startRank.number, name: startRank.name } : null,
      rankUps: rankEvents.length,
      eventIds: rankEvents.map((event) => event.id),
      dailyRankEventIds: (dataDiscipline.dailyRankXpEvents || []).filter((event) => within(event.date, rangeStart, rangeEnd)).map((event) => event.id),
    },
    pauseStats,
    timeline,
  };
}

function dateKeyBefore(dateKey) {
  const date = dayAtNoon(dateKey);
  date.setUTCDate(date.getUTCDate() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function createHistoryExpiryReminders(summaries, existing = [], todayKey = getIstDateKey()) {
  const known = new Set(existing.map((item) => item.id));
  const due = [];
  for (const summary of summaries) {
    if (!summary.availability?.hasData || summary.status !== 'finalized' || !summary.availability.detailedTaskHistory) continue;
    const expiry = summary.detailedHistoryExpiresAt;
    const timings = [
      { key: '7d', days: 7, label: '7 days' },
      { key: '48h', days: 2, label: '48 hours' },
      { key: '24h', days: 1, label: '24 hours' },
    ];
    for (const timing of timings) {
      const reminderDate = addIstDays(expiry, -timing.days);
      const id = `history-expiry:${summary.progressionRunId}:${summary.monthKey}:${timing.key}`;
      if (reminderDate === todayKey && !known.has(id)) {
        due.push({ id, monthKey: summary.monthKey, monthLabel: formatMonthLabel(summary.monthKey), expiryDate: expiry, timing: timing.key, timingLabel: timing.label, createdDate: todayKey, title: `${summary.monthLabel.replace(' · Partial', '')} detail expires soon`, detail: `Detailed task history expires on ${formatDateKey(expiry)}. Your aggregate monthly summary will remain available.` });
        known.add(id);
      }
    }
  }
  return [...existing, ...due];
}

export function addIstDays(dateKey, amount) {
  const date = dayAtNoon(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function formatDateKey(dateKey, locale = 'en-IN') {
  if (!dateKey) return 'Data unavailable';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: IST }).format(dayAtNoon(dateKey));
}

