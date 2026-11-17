import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { dailyTasksDemo, dailyTaskScheduleDemo } from '../data/dailyTasksDemo.js';
import { getWeeklyChangePeriod } from '../utils/weeklyTaskChanges.js';
import { completeRecoveryQuest, createRecoveryQuestState, expireRecoveryQuest, generateRecoveryQuest } from '../utils/recoveryQuestManager.js';
import { createDisciplineState, enterHigherRank, processDailyReset as applyDailyReset, redeemGracePoint as redeemGracePointState, startProgressionRun } from '../utils/disciplineManager.js';
import { addIstCalendarDays, countRecoveryQuestsActiveOnDate, getScheduleDaySnapshot } from '../utils/disciplineActivity.js';
import { getIstDateKey } from '../utils/taskScheduleBuilder.js';
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

export function TaskScheduleProvider({ children }) {
  const [initialState] = useState(readSessionState);
  const [currentSchedule, setCurrentSchedule] = useState(() => initialState?.currentSchedule || createInitialSchedule());
  const [weeklyAllowance, setWeeklyAllowance] = useState(() => initialState?.weeklyAllowance || ({
    maximum: dailyTaskScheduleDemo.taskChangesAllowed,
    used: dailyTaskScheduleDemo.taskChangesUsed,
    weekStartDate: getWeeklyChangePeriod(dailyTaskScheduleDemo.taskChangesWeekDate).weekStartDate,
  }));
  const [recoveryState, setRecoveryState] = useState(() => initialState?.recoveryState || createInitialRecoveryState());
  const [disciplineState, setDisciplineState] = useState(() => initialState?.disciplineState || ({
    ...createInitialDiscipline(),
  }));
  const [emergencyPauseState, setEmergencyPauseState] = useState(() => initialState?.emergencyPauseState || createEmergencyPauseState());
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
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ currentSchedule, weeklyAllowance, recoveryState, disciplineState, emergencyPauseState }));
    } catch {
      // Session storage can be unavailable in private browsing; the app remains usable in memory.
    }
  }, [currentSchedule, weeklyAllowance, recoveryState, disciplineState, emergencyPauseState]);

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
    const result = generateRecoveryQuest(recoveryRef.current, task, options);
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

  const processRankUp = useCallback((rankSlug) => {
    const result = enterHigherRank(disciplineRef.current, rankSlug, getIstDateKey());
    if (result.event) {
      disciplineRef.current = result.state;
      setDisciplineState(result.state);
      setRankUpNotice(result.event);
    }
    return result;
  }, []);
  const beginProgressionRun = useCallback((options) => {
    const nextState = startProgressionRun(disciplineRef.current, options);
    disciplineRef.current = nextState;
    setDisciplineState(nextState);
    return nextState;
  }, []);
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
    disciplineState, processResetDate, processRankUp, beginProgressionRun,
    emergencyPauseState,
    activeEmergencyPause: getActiveEmergencyPause(emergencyPauseState, Date.now()),
    isEmergencyPauseActive: Boolean(getActiveEmergencyPause(emergencyPauseState, Date.now())),
    isScheduledTaskActivitySuspended,
    activateEmergencyPause,
    resumeEmergencyPauseEarly,
    redeemGracePoint, rankUpNotice, dismissRankUpNotice: () => setRankUpNotice(null),
  }), [currentSchedule, weeklyAllowance, recoveryState, addRecoveryQuest, completeQuest, expireQuest,
    disciplineState, processResetDate, processRankUp, beginProgressionRun, redeemGracePoint, rankUpNotice,
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
