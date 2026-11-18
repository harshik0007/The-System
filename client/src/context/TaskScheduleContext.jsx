import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { dailyTasksDemo, dailyTaskScheduleDemo } from '../data/dailyTasksDemo.js';
import { dashboardDemo } from '../data/dashboardDemo.js';
import { getWeeklyChangePeriod } from '../utils/weeklyTaskChanges.js';
import { completeRecoveryQuest, createRecoveryQuestState, expireRecoveryQuest, generateRecoveryQuest } from '../utils/recoveryQuestManager.js';
import { createDisciplineState, enterHigherRank, getLevelFromTotalXp, normalizeHighestRankAchieved, processDailyReset as applyDailyReset, redeemGracePoint as redeemGracePointState, startProgressionRun } from '../utils/disciplineManager.js';
import { addIstCalendarDays, countRecoveryQuestsActiveOnDate, getScheduleDaySnapshot } from '../utils/disciplineActivity.js';
import { getIstDateKey } from '../utils/taskScheduleBuilder.js';
import { updateMemberPersonalBestRecord } from '../utils/personalBestRecords.js';
import { getIstMonthKey, listIstMonths, buildMonthlySummary, createHistoryExpiryReminders, shiftIstMonth } from '../utils/monthlyAnalysis.js';
import {
  activateEmergencyPause as activatePauseState,
  createEmergencyPauseState,
  getActiveEmergencyPause,
  isEmergencyPauseDate,
  reconcileEmergencyPause,
  resumeEmergencyPause as resumePauseState,
} from '../utils/emergencyPauseManager.js';

const TaskScheduleContext = createContext(null);
const SESSION_KEY = 'the-system-discipline-demo-v1';

function createInitialSchedule() {
  return {
    cycleLength: dailyTaskScheduleDemo.cycleLength,
    startDate: dailyTaskScheduleDemo.cycleDayOneDate,
    source: 'demo',
    tasks: dailyTasksDemo.map((task) => ({ ...task, cycleDays: [1, 2, 3, 4, 5, 6, 7], actionTitle: task.accountabilityAction, actionDescription: task.accountabilityActionDescription || '', weakness: '' })),
    taskHistory: [],
    occurrences: {},
  };
}

function readSessionState() {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function createInitialRecoveryState() {
  return createRecoveryQuestState(dailyTasksDemo, getIstDateKey());
}

function nextDay(dateKey) {
  return addIstCalendarDays(dateKey, 1);
}

function captureAnalysisRunBaseline(discipline, recovery, schedule, date) {
  const ids = (items) => (items || []).map((item) => item.id).filter(Boolean);
  return {
    progressionRunId: discipline.progressionRunId,
    date,
    totalXp: discipline.totalXp,
    level: getLevelFromTotalXp(discipline.totalXp),
    dpBalance: discipline.dpBalance,
    gracePoints: recovery.gracePoints,
    rankSlug: discipline.currentRankSlug,
    streak: discipline.currentStreak,
    cycleProgress: discipline.cycle?.progress ?? null,
    excluded: {
      dailyRecordDates: Object.keys(discipline.dailyRecords || {}),
      xpEventIds: ids(discipline.xpHistory),
      dpEventIds: ids(discipline.dpEvents),
      rankEventIds: ids(discipline.rankEntryEvents),
      dailyRankEventIds: ids(discipline.dailyRankXpEvents),
      levelEventIds: ids(discipline.levelDownEvents),
      redemptionEventIds: ids(discipline.redemptionEvents),
      recoveryQuestIds: ids(recovery.quests),
      graceEventIds: ids(recovery.gracePointEvents),
      recoveryActivityIds: ids(recovery.activity),
      occurrenceKeys: Object.keys(schedule.occurrences || {}),
    },
  };
}

export function TaskScheduleProvider({ children }) {
  const [initialState] = useState(readSessionState);
  const [currentSchedule, setCurrentSchedule] = useState(() => initialState?.currentSchedule || createInitialSchedule());
  const [weeklyAllowance, setWeeklyAllowance] = useState(() => initialState?.weeklyAllowance || ({
    maximum: dailyTaskScheduleDemo.taskChangesAllowed,
    used: dailyTaskScheduleDemo.taskChangesUsed,
    weekStartDate: getWeeklyChangePeriod(dailyTaskScheduleDemo.taskChangesWeekDate).weekStartDate,
  }));
  const [recoveryState, setRecoveryState] = useState(() => initialState?.recoveryState || createInitialRecoveryState());
  const [disciplineState, setDisciplineState] = useState(() => normalizeHighestRankAchieved(initialState?.disciplineState || createInitialDiscipline()));
  const [personalBestRecords, setPersonalBestRecords] = useState(() => initialState?.personalBestRecords || {});
  const [emergencyPauseState, setEmergencyPauseState] = useState(() => initialState?.emergencyPauseState || createEmergencyPauseState());
  const [monthlySummaries, setMonthlySummaries] = useState(() => initialState?.monthlySummaries || []);
  const [historyExpiryReminders, setHistoryExpiryReminders] = useState(() => initialState?.historyExpiryReminders || []);
  const [analysisRunBaseline, setAnalysisRunBaseline] = useState(() => initialState?.analysisRunBaseline || (initialState ? null : captureAnalysisRunBaseline(disciplineState, recoveryState, currentSchedule, disciplineState.memberSince)));
  const [rankUpNotice, setRankUpNotice] = useState(null);
  const scheduleRef = useRef(currentSchedule);
  const recoveryRef = useRef(recoveryState);
  const disciplineRef = useRef(disciplineState);
  const emergencyPauseRef = useRef(emergencyPauseState);
  scheduleRef.current = currentSchedule;
  recoveryRef.current = recoveryState;
  disciplineRef.current = disciplineState;
  emergencyPauseRef.current = emergencyPauseState;

  useEffect(() => {
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ currentSchedule, weeklyAllowance, recoveryState, disciplineState, personalBestRecords, emergencyPauseState, monthlySummaries, historyExpiryReminders, analysisRunBaseline }));
    } catch {
      // Session storage can be unavailable in private browsing; the app remains usable in memory.
    }
  }, [currentSchedule, weeklyAllowance, recoveryState, disciplineState, personalBestRecords, emergencyPauseState, monthlySummaries, historyExpiryReminders, analysisRunBaseline]);

  useEffect(() => {
    const todayKey = getIstDateKey();
    const currentMonth = getIstMonthKey(todayKey);
    const runStartDate = analysisRunBaseline?.date || disciplineState.memberSince || todayKey;
    const months = listIstMonths(runStartDate, todayKey);
    if (!months.length) return;
    const generatedAt = new Date().toISOString();
    setMonthlySummaries((existing) => {
      let next = [...existing];
      for (const monthKey of months) {
        const id = `${disciplineState.progressionRunId}:${monthKey}`;
        const previous = next.find((summary) => summary.id === id);
        if (previous?.status === 'finalized') continue;
        const summary = buildMonthlySummary({
          monthKey,
          todayKey,
          disciplineState,
          schedule: currentSchedule,
          recoveryState,
          emergencyPauseState,
          progressionRunId: disciplineState.progressionRunId,
          runStartDate,
          runBaseline: analysisRunBaseline,
          generatedAt: previous?.generatedAt || generatedAt,
        });
        // Aggregate summaries intentionally do not retain task-level names or quest snapshots.
        summary.taskStats.missedTaskDetails = null;
        summary.recoveryStats.quests = [];
        if (previous) next = next.map((item) => item.id === id ? summary : item);
        else next.push(summary);
      }
      return JSON.stringify(next) === JSON.stringify(existing) ? existing : next;
    });

    // Detailed task occurrences are retained for the current and immediately preceding IST month.
    const detailFloor = `${shiftIstMonth(currentMonth, -1)}-01`;
    setCurrentSchedule((current) => {
      const entries = Object.entries(current.occurrences || {});
      const retained = entries.filter(([key]) => key.split(':').at(-1) >= detailFloor);
      if (retained.length === entries.length) return current;
      return { ...current, occurrences: Object.fromEntries(retained) };
    });
  }, [currentSchedule, recoveryState, disciplineState, emergencyPauseState, analysisRunBaseline]);

  useEffect(() => {
    const todayKey = getIstDateKey();
    setHistoryExpiryReminders((existing) => {
      const active = existing.filter((reminder) => reminder.expiryDate > todayKey);
      const next = createHistoryExpiryReminders(monthlySummaries, active, todayKey);
      return JSON.stringify(next) === JSON.stringify(existing) ? existing : next;
    });
  }, [monthlySummaries]);

  const reconcilePause = useCallback((now = Date.now()) => {
    const result = reconcileEmergencyPause(emergencyPauseRef.current, recoveryRef.current, now);
    if (result.changed || result.state !== emergencyPauseRef.current) {
      emergencyPauseRef.current = result.state;
      setEmergencyPauseState(result.state);
    }
    return result;
  }, []);

  const isScheduledTaskActivitySuspended = useCallback(() => Boolean(getActiveEmergencyPause(emergencyPauseRef.current, Date.now())), []);

  const addRecoveryQuest = useCallback((task, options) => {
    if (getActiveEmergencyPause(emergencyPauseRef.current, Date.now())) {
      return { state: recoveryRef.current, quest: null, thresholdTriggered: false, duplicate: false, paused: true };
    }
    const result = generateRecoveryQuest(recoveryRef.current, task, { ...options, progressionRunId: disciplineRef.current.progressionRunId });
    recoveryRef.current = result.state;
    setRecoveryState(result.state);
    return result;
  }, []);
  const completeQuest = useCallback((questId) => {
    if (getActiveEmergencyPause(emergencyPauseRef.current, Date.now())) return { success: false, paused: true };
    const nextState = completeRecoveryQuest(recoveryRef.current, questId, getIstDateKey());
    const changed = nextState !== recoveryRef.current;
    recoveryRef.current = nextState;
    setRecoveryState(nextState);
    return { success: changed, paused: false };
  }, []);
  const expireQuest = useCallback((questId) => {
    if (getActiveEmergencyPause(emergencyPauseRef.current, Date.now())) return { success: false, paused: true };
    const nextState = expireRecoveryQuest(recoveryRef.current, questId, getIstDateKey());
    const changed = nextState !== recoveryRef.current;
    recoveryRef.current = nextState;
    setRecoveryState(nextState);
    return { success: changed, paused: false };
  }, []);

  const processResetDate = useCallback((dateKey, todayKey = getIstDateKey()) => {
    const taskSnapshot = getScheduleDaySnapshot(scheduleRef.current, dateKey, { todayKey });
    const activeRecoveryQuestCount = countRecoveryQuestsActiveOnDate(recoveryRef.current, dateKey);
    const result = applyDailyReset(disciplineRef.current, {
      dateKey,
      ...taskSnapshot,
      activeRecoveryQuestCount,
      emergencyPause: isEmergencyPauseDate(emergencyPauseRef.current, dateKey),
    });
    if (!result.duplicate) {
      disciplineRef.current = result.state;
      setDisciplineState(result.state);
    }
    return result;
  }, []);

  const catchUpDailyReset = useCallback(() => {
    reconcilePause(Date.now());
    const todayKey = getIstDateKey();
    let observedDate = disciplineRef.current.lastObservedDate || todayKey;
    if (observedDate >= todayKey) return;
    let guard = 0;
    while (observedDate < todayKey && guard < 3660) {
      processResetDate(observedDate, todayKey);
      observedDate = nextDay(observedDate);
      guard += 1;
    }
    const latest = { ...disciplineRef.current, lastObservedDate: todayKey };
    disciplineRef.current = latest;
    setDisciplineState(latest);
  }, [processResetDate, reconcilePause]);

  useEffect(() => {
    catchUpDailyReset();
    const interval = window.setInterval(catchUpDailyReset, 30_000);
    const syncOnReturn = () => {
      if (document.visibilityState === 'hidden') return;
      catchUpDailyReset();
    };
    document.addEventListener('visibilitychange', syncOnReturn);
    window.addEventListener('focus', syncOnReturn);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', syncOnReturn);
      window.removeEventListener('focus', syncOnReturn);
    };
  }, [catchUpDailyReset]);

  useEffect(() => {
    const activePause = getActiveEmergencyPause(emergencyPauseState, Date.now());
    if (!activePause) return undefined;
    const delay = Math.max(0, Date.parse(activePause.scheduledResumeAt) - Date.now() + 20);
    const timeout = window.setTimeout(() => catchUpDailyReset(), delay);
    return () => window.clearTimeout(timeout);
  }, [emergencyPauseState, catchUpDailyReset]);

  const activateEmergencyPause = useCallback((durationDays) => {
    const now = new Date();
    const reconciled = reconcileEmergencyPause(emergencyPauseRef.current, recoveryRef.current, now);
    emergencyPauseRef.current = reconciled.state;
    if (reconciled.changed) setEmergencyPauseState(reconciled.state);
    const result = activatePauseState(reconciled.state, recoveryRef.current, durationDays, now);
    emergencyPauseRef.current = result.state;
    if (result.changed || result.state !== emergencyPauseState) setEmergencyPauseState(result.state);
    return result;
  }, [emergencyPauseState]);

  const resumeEmergencyPauseEarly = useCallback(() => {
    const now = new Date();
    const reconciled = reconcileEmergencyPause(emergencyPauseRef.current, recoveryRef.current, now);
    emergencyPauseRef.current = reconciled.state;
    if (reconciled.changed) setEmergencyPauseState(reconciled.state);
    const result = resumePauseState(reconciled.state, now);
    if (!result.error) {
      emergencyPauseRef.current = result.state;
      setEmergencyPauseState(result.state);
    }
    return result;
  }, []);

  const updatePersonalBestRecords = useCallback((memberId, snapshot) => {
    setPersonalBestRecords((current) => updateMemberPersonalBestRecord(current, memberId, snapshot));
  }, []);

  const processRankUp = useCallback((rankSlug) => {
    const result = enterHigherRank(disciplineRef.current, rankSlug, getIstDateKey());
    if (result.event) {
      disciplineRef.current = result.state;
      setDisciplineState(result.state);
      updatePersonalBestRecords(dashboardDemo.member.memberId, { highestRankAchieved: result.state.highestRankAchieved });
      setRankUpNotice(result.event);
    }
    return result;
  }, [updatePersonalBestRecords]);
  const beginProgressionRun = useCallback((options) => {
    const nextState = startProgressionRun(disciplineRef.current, options);
    const endedAt = getIstDateKey();
    const oldState = disciplineRef.current;
    const oldRunId = oldState.progressionRunId;
    const oldStartDate = analysisRunBaseline?.date || oldState.memberSince || endedAt;
    const now = new Date().toISOString();
    const archived = listIstMonths(oldStartDate, endedAt).map((monthKey) => {
      const summary = buildMonthlySummary({
        monthKey,
        todayKey: endedAt,
        disciplineState: oldState,
        schedule: scheduleRef.current,
        recoveryState: recoveryRef.current,
        emergencyPauseState: emergencyPauseRef.current,
        progressionRunId: oldRunId,
        runStartDate: oldStartDate,
        runBaseline: analysisRunBaseline,
        runEndDate: endedAt,
        generatedAt: now,
        forceFinalized: true,
      });
      summary.taskStats.missedTaskDetails = null;
      summary.recoveryStats.quests = [];
      return summary;
    });
    setMonthlySummaries((current) => {
      const byId = new Map(current.map((summary) => [summary.id, summary]));
      archived.forEach((summary) => {
        const existing = byId.get(summary.id);
        if (existing?.status !== 'finalized') byId.set(summary.id, summary);
      });
      return [...byId.values()];
    });
    disciplineRef.current = nextState;
    setDisciplineState(nextState);
    setAnalysisRunBaseline(captureAnalysisRunBaseline(nextState, recoveryRef.current, scheduleRef.current, endedAt));
    return nextState;
  }, [analysisRunBaseline]);
  const redeemGracePoint = useCallback(() => {
    const result = redeemGracePointState(disciplineRef.current, recoveryRef.current, Date.now());
    if (result.success) {
      disciplineRef.current = result.state;
      recoveryRef.current = result.recoveryState;
      setDisciplineState(result.state);
      setRecoveryState(result.recoveryState);
    }
    return result;
  }, []);

  const value = useMemo(() => ({
    currentSchedule, setCurrentSchedule, weeklyAllowance, setWeeklyAllowance,
    recoveryState, addRecoveryQuest, completeQuest, expireQuest,
    disciplineState, personalBestRecords, updatePersonalBestRecords, processResetDate, processRankUp, beginProgressionRun,
    monthlySummaries, historyExpiryReminders,
    analysisRunBaseline,
    emergencyPauseState,
    activeEmergencyPause: getActiveEmergencyPause(emergencyPauseState, Date.now()),
    isEmergencyPauseActive: Boolean(getActiveEmergencyPause(emergencyPauseState, Date.now())),
    isScheduledTaskActivitySuspended,
    activateEmergencyPause,
    resumeEmergencyPauseEarly,
    redeemGracePoint, rankUpNotice, dismissRankUpNotice: () => setRankUpNotice(null),
  }), [currentSchedule, weeklyAllowance, recoveryState, addRecoveryQuest, completeQuest, expireQuest,
    disciplineState, personalBestRecords, updatePersonalBestRecords, processResetDate, processRankUp, beginProgressionRun, monthlySummaries, historyExpiryReminders, analysisRunBaseline, redeemGracePoint, rankUpNotice,
    emergencyPauseState, activateEmergencyPause, resumeEmergencyPauseEarly, isScheduledTaskActivitySuspended]);

  return <TaskScheduleContext.Provider value={value}>{children}</TaskScheduleContext.Provider>;
}

function createInitialDiscipline() {
  // Keep the current application preview identity and XP snapshot, but make the rules configurable and shared.
  return createDisciplineState();
}

export function useTaskSchedule() {
  const context = useContext(TaskScheduleContext);
  if (!context) throw new Error('useTaskSchedule must be used within TaskScheduleProvider.');
  return context;
}
