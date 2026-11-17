import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { dailyTasksDemo, dailyTaskScheduleDemo } from '../data/dailyTasksDemo.js';
import { getWeeklyChangePeriod } from '../utils/weeklyTaskChanges.js';
import { completeRecoveryQuest, createRecoveryQuestState, expireRecoveryQuest, generateRecoveryQuest } from '../utils/recoveryQuestManager.js';
import { createDisciplineState, enterHigherRank, processDailyReset as applyDailyReset, redeemGracePoint as redeemGracePointState, startProgressionRun } from '../utils/disciplineManager.js';
import { addIstCalendarDays, countRecoveryQuestsActiveOnDate, getScheduleDaySnapshot } from '../utils/disciplineActivity.js';
import { getIstDateKey } from '../utils/taskScheduleBuilder.js';

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
  const [rankUpNotice, setRankUpNotice] = useState(null);
  const scheduleRef = useRef(currentSchedule);
  const recoveryRef = useRef(recoveryState);
  const disciplineRef = useRef(disciplineState);
  scheduleRef.current = currentSchedule;
  recoveryRef.current = recoveryState;
  disciplineRef.current = disciplineState;

  useEffect(() => {
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ currentSchedule, weeklyAllowance, recoveryState, disciplineState }));
    } catch {
      // Session storage can be unavailable in private browsing; the app remains usable in memory.
    }
  }, [currentSchedule, weeklyAllowance, recoveryState, disciplineState]);

  const addRecoveryQuest = useCallback((task, options) => {
    const result = generateRecoveryQuest(recoveryRef.current, task, options);
    recoveryRef.current = result.state;
    setRecoveryState(result.state);
    return result;
  }, []);
  const completeQuest = useCallback((questId) => {
    const nextState = completeRecoveryQuest(recoveryRef.current, questId, getIstDateKey());
    recoveryRef.current = nextState;
    setRecoveryState(nextState);
  }, []);
  const expireQuest = useCallback((questId) => {
    const nextState = expireRecoveryQuest(recoveryRef.current, questId, getIstDateKey());
    recoveryRef.current = nextState;
    setRecoveryState(nextState);
  }, []);

  const processResetDate = useCallback((dateKey, todayKey = getIstDateKey()) => {
    const taskSnapshot = getScheduleDaySnapshot(scheduleRef.current, dateKey, { todayKey });
    const activeRecoveryQuestCount = countRecoveryQuestsActiveOnDate(recoveryRef.current, dateKey);
    const result = applyDailyReset(disciplineRef.current, {
      dateKey,
      ...taskSnapshot,
      activeRecoveryQuestCount,
      emergencyPause: (disciplineRef.current.emergencyPauseDates || []).includes(dateKey),
    });
    if (!result.duplicate) {
      disciplineRef.current = result.state;
      setDisciplineState(result.state);
    }
    return result;
  }, []);

  const catchUpDailyReset = useCallback(() => {
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
  }, [processResetDate]);

  useEffect(() => {
    catchUpDailyReset();
    const interval = window.setInterval(catchUpDailyReset, 30_000);
    document.addEventListener('visibilitychange', catchUpDailyReset);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', catchUpDailyReset);
    };
  }, [catchUpDailyReset]);

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
    redeemGracePoint, rankUpNotice, dismissRankUpNotice: () => setRankUpNotice(null),
  }), [currentSchedule, weeklyAllowance, recoveryState, addRecoveryQuest, completeQuest, expireQuest,
    disciplineState, processResetDate, processRankUp, beginProgressionRun, redeemGracePoint, rankUpNotice]);

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
