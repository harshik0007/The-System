import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { taskApi } from '../services/taskApi.js';
import { loadCoreTaskRequests } from './taskBackendLoader.js';

const TaskBackendContext = createContext(null);
const EMPTY_ALLOWANCE = Object.freeze({ maximum: 0, used: 0, remaining: 0, weekStart: null, nextResetAt: null, rangeLabel: 'Monday–Sunday · IST', nextResetLabel: 'the next Monday' });

function dateLabel(dateKey) {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function resetLabel(instant) {
  if (!instant) return 'the next Monday';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(instant));
}

function adaptAllowance(data) {
  return {
    ...EMPTY_ALLOWANCE,
    ...data,
    rangeLabel: data.weekStart ? `Week of ${dateLabel(data.weekStart)}` : EMPTY_ALLOWANCE.rangeLabel,
    nextResetLabel: resetLabel(data.nextResetAt),
  };
}

export function TaskBackendProvider({ children }) {
  const location = useLocation();
  const { pathname } = location;
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [allowance, setAllowance] = useState(EMPTY_ALLOWANCE);
  const [allowanceLoaded, setAllowanceLoaded] = useState(false);
  const [todayDate, setTodayDate] = useState(null);
  const [todayCycleDay, setTodayCycleDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorInfo, setErrorInfo] = useState(null);
  const [recoveryQuests, setRecoveryQuests] = useState([]);
  const [gracePoints, setGracePoints] = useState(null);
  const [gracePointTransactions, setGracePointTransactions] = useState([]);
  const [progression, setProgression] = useState(null);
  const [disciplineSummary, setDisciplineSummary] = useState(null);
  const [disciplineCalendar, setDisciplineCalendar] = useState(null);
  const [disciplineTransactions, setDisciplineTransactions] = useState([]);
  const [disciplineError, setDisciplineError] = useState('');
  const [progressionResetNotice, setProgressionResetNotice] = useState(null);
  const [recoveryLoading, setRecoveryLoading] = useState(true);
  const [recoveryError, setRecoveryError] = useState('');
  const [emergencyPause, setEmergencyPause] = useState(null);
  const [emergencyPauseLoading, setEmergencyPauseLoading] = useState(false);
  const [emergencyPauseError, setEmergencyPauseError] = useState('');
  const requestIdRef = useRef(0);
  const controllerRef = useRef(null);
  const recoveryControllerRef = useRef(null);
  const recoveryRequestIdRef = useRef(0);
  const lastProgressionRunIdRef = useRef(null);
  const onboardingRunIdRef = useRef(null);
  const resetBroadcastRunIdRef = useRef(null);
  const progressionThemeSnapshotRef = useRef(null);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError('');
    setErrorInfo(null);

    try {
      const [scheduleResult, tasksResult, allowanceResult] = await loadCoreTaskRequests(taskApi, controller.signal);
      if (requestId !== requestIdRef.current) return;

      const failures = [];
      let currentSchedule = null;
      let currentDate = null;

      if (scheduleResult.status === 'fulfilled') {
        const scheduleResponse = scheduleResult.value;
        currentSchedule = scheduleResponse.schedule || null;
        currentDate = scheduleResponse.todayDate || null;
        setSchedule(currentSchedule);
        setTodayDate(currentDate);
        setTodayCycleDay(scheduleResponse.todayCycleDay ?? currentSchedule?.todayCycleDay ?? null);
      } else {
        failures.push(scheduleResult.reason);
      }

      if (tasksResult.status === 'fulfilled') setTasks(tasksResult.value.tasks || []);
      else failures.push(tasksResult.reason);

      if (allowanceResult.status === 'fulfilled') {
        setAllowance(adaptAllowance(allowanceResult.value));
        setAllowanceLoaded(true);
      }
      else failures.push(allowanceResult.reason);

      if (scheduleResult.status === 'fulfilled' && currentSchedule && currentDate) {
        try {
          await taskApi.ensureOccurrences(currentDate, currentDate, { signal: controller.signal });
          const occurrenceResponse = await taskApi.occurrences(currentDate, currentDate, { signal: controller.signal });
          if (requestId === requestIdRef.current) setOccurrences(occurrenceResponse.occurrences || []);
        } catch (occurrenceError) {
          if (occurrenceError?.name !== 'AbortError') failures.push(occurrenceError);
        }
      } else if (scheduleResult.status === 'fulfilled') {
        setOccurrences([]);
      }

      if (requestId !== requestIdRef.current) return;
      const failure = failures.find((item) => item?.name !== 'AbortError');
      if (failure) {
        setError(failure?.message || 'Some Task data could not be loaded.');
        setErrorInfo({
          status: Number.isFinite(failure?.status) ? failure.status : null,
          code: failure?.code || 'REQUEST_FAILED',
          requestId: failure?.requestId || null,
          details: Array.isArray(failure?.details) ? failure.details : [],
        });
      }
    } catch (requestError) {
      if (requestError?.name === 'AbortError' || requestId !== requestIdRef.current) return;
      setError(requestError?.message || 'Task data could not be loaded.');
      setErrorInfo({
        status: Number.isFinite(requestError?.status) ? requestError.status : null,
        code: requestError?.code || 'REQUEST_FAILED',
        requestId: requestError?.requestId || null,
        details: Array.isArray(requestError?.details) ? requestError.details : [],
      });
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  const refreshRecovery = useCallback(async () => {
    const requestId = ++recoveryRequestIdRef.current;
    recoveryControllerRef.current?.abort();
    const controller = new AbortController();
    recoveryControllerRef.current = controller;
    setRecoveryLoading(true);
    setRecoveryError('');
    try {
      const isDisciplineRoute = pathname === '/app/discipline';
      const needsDisciplineCalendar = isDisciplineRoute || pathname === '/app/profile';
      const requests = [
        ['quests', taskApi.recoveryQuests({ signal: controller.signal })],
        ['emergencyPause', taskApi.emergencyPauseStatus({ signal: controller.signal })],
        ['gracePoints', taskApi.gracePoints({ signal: controller.signal })],
        ['graceTransactions', taskApi.gracePointTransactions(50, { signal: controller.signal })],
        ['progression', taskApi.currentProgression({ signal: controller.signal })],
        ['disciplineSummary', taskApi.disciplineSummary({ signal: controller.signal })],
      ];
      if (needsDisciplineCalendar) requests.push(['disciplineCalendar', taskApi.disciplineCalendar({}, { signal: controller.signal })]);
      if (isDisciplineRoute) requests.push(['disciplineTransactions', taskApi.disciplineTransactions(50, { signal: controller.signal })]);
      const settled = await Promise.allSettled(requests.map(([, request]) => request));
      const results = Object.fromEntries(requests.map(([key], index) => [key, settled[index]]));
      if (requestId !== recoveryRequestIdRef.current) return;
      const baseFailure = ['quests', 'gracePoints', 'graceTransactions', 'progression']
        .map((key) => results[key]).find((result) => result?.status === 'rejected' && result.reason?.name !== 'AbortError');
      const pauseFailure = results.emergencyPause?.status === 'rejected' && results.emergencyPause.reason?.name !== 'AbortError'
        ? results.emergencyPause.reason : null;
      const disciplineFailure = ['disciplineSummary', ...(needsDisciplineCalendar ? ['disciplineCalendar'] : []), ...(isDisciplineRoute ? ['disciplineTransactions'] : [])]
        .map((key) => results[key]).find((result) => result?.status === 'rejected' && result.reason?.name !== 'AbortError');
      if (results.quests.status === 'fulfilled') setRecoveryQuests(results.quests.value.quests || []);
      if (results.emergencyPause.status === 'fulfilled') setEmergencyPause(results.emergencyPause.value);
      // A failed refresh is not proof that the server ended a pause. Retain
      // the last server-confirmed status so route changes and short network
      // hiccups do not flicker or restart the application-wide atmosphere.
      setEmergencyPauseError(pauseFailure?.message || '');
      if (results.gracePoints.status === 'fulfilled') setGracePoints(results.gracePoints.value);
      if (results.graceTransactions.status === 'fulfilled') setGracePointTransactions(results.graceTransactions.value.transactions || []);
      if (results.disciplineSummary.status === 'fulfilled') setDisciplineSummary(results.disciplineSummary.value.summary || null);
      if (needsDisciplineCalendar && results.disciplineCalendar.status === 'fulfilled') setDisciplineCalendar(results.disciplineCalendar.value);
      if (isDisciplineRoute && results.disciplineTransactions.status === 'fulfilled') setDisciplineTransactions(results.disciplineTransactions.value.transactions || []);
      setDisciplineError(disciplineFailure?.reason?.message || '');
      if (results.progression.status === 'fulfilled') {
        const nextProgression = results.progression.value;
        setProgression(nextProgression);
        const run = nextProgression.progression;
        const nextRunId = run?.id || null;
        const themeSnapshot = run ? `${run.id}:${run.level}:${run.currentRankSlug}` : 'no-active-run';
        if (progressionThemeSnapshotRef.current && progressionThemeSnapshotRef.current !== themeSnapshot) {
          window.dispatchEvent(new CustomEvent('system:progression-theme-state-changed', { detail: { runId: run?.id || null, level: run?.level ?? 0 } }));
        }
        progressionThemeSnapshotRef.current = themeSnapshot;
        const previousRunId = lastProgressionRunIdRef.current;
        if (nextRunId) lastProgressionRunIdRef.current = nextRunId;

        const resetEventMatchesRun = nextProgression.recentReset?.newProgressionRunId === nextRunId;
        const runChanged = Boolean(previousRunId && previousRunId !== nextRunId);
        if (nextRunId && (runChanged || resetEventMatchesRun) && resetBroadcastRunIdRef.current !== nextRunId) {
          resetBroadcastRunIdRef.current = nextRunId;
          const resetDetail = {
            runId: nextRunId,
            resetCount: nextProgression.resetCount,
            highestRankAchieved: nextProgression.highestRankAchieved,
            lifetimeLongestStreak: nextProgression.lifetimeLongestStreak,
            memberSince: nextProgression.memberSince,
            recentReset: nextProgression.recentReset,
          };
          setProgressionResetNotice(resetDetail);
          window.dispatchEvent(new CustomEvent('system:progression-reset', { detail: resetDetail }));
          setSchedule(null);
          setTasks([]);
          setOccurrences([]);
          setTodayDate(null);
          setTodayCycleDay(null);
          setAllowance(EMPTY_ALLOWANCE);
          setAllowanceLoaded(false);
          void refresh();
        }

        if (nextRunId && run?.requiresScheduleSetup && onboardingRunIdRef.current !== nextRunId) {
          onboardingRunIdRef.current = nextRunId;
          if (runChanged || resetEventMatchesRun) {
            if (location.pathname !== '/app/tasks/create') {
              const isManualReset = resetEventMatchesRun && nextProgression.recentReset?.reason === 'manual-reset-and-restart';
              navigate('/app/tasks/create', { replace: true, state: isManualReset
                ? { manualProgressionReset: true, resetCount: nextProgression.resetCount, recentReset: nextProgression.recentReset }
                : resetEventMatchesRun
                  ? { automaticProgressionReset: true, resetCount: nextProgression.resetCount, recentReset: nextProgression.recentReset }
                  : { scheduleSetupRequired: true },
              });
            }
          } else if (location.pathname !== '/app/tasks/create') {
            navigate('/app/tasks/create', {
              replace: true,
              state: resetEventMatchesRun && nextProgression.recentReset?.reason === 'manual-reset-and-restart'
                ? { manualProgressionReset: true, resetCount: nextProgression.resetCount, recentReset: nextProgression.recentReset }
                : resetEventMatchesRun
                ? { automaticProgressionReset: true, resetCount: nextProgression.resetCount, recentReset: nextProgression.recentReset }
                : { scheduleSetupRequired: true },
            });
          }
        }
      }
      if (baseFailure) setRecoveryError(baseFailure.reason?.message || 'Recovery Quest data could not be loaded.');
    } catch (requestError) {
      if (requestError?.name !== 'AbortError' && requestId === recoveryRequestIdRef.current) setRecoveryError(requestError?.message || 'Recovery Quest data could not be loaded.');
    } finally {
      if (requestId === recoveryRequestIdRef.current) setRecoveryLoading(false);
    }
  }, [location.pathname, navigate, refresh]);

  const completeRecoveryQuest = useCallback(async (questId) => {
    const result = await taskApi.completeRecoveryQuest(questId);
    await refreshRecovery();
    return result;
  }, [refreshRecovery]);

  const activateEmergencyPause = useCallback(async (durationDays) => {
    setEmergencyPauseLoading(true);
    setEmergencyPauseError('');
    try {
      const result = await taskApi.activateEmergencyPause(durationDays);
      window.dispatchEvent(new CustomEvent('system:emergency-pause-activation-confirmed'));
      await refreshRecovery();
      return result;
    } catch (requestError) {
      setEmergencyPauseError(requestError?.message || 'Emergency Pause could not be activated.');
      await refreshRecovery();
      throw requestError;
    } finally {
      setEmergencyPauseLoading(false);
    }
  }, [refreshRecovery]);

  const resumeEmergencyPause = useCallback(async () => {
    setEmergencyPauseLoading(true);
    setEmergencyPauseError('');
    try {
      const result = await taskApi.resumeEmergencyPause();
      setEmergencyPause(result);
      window.dispatchEvent(new CustomEvent('system:emergency-pause-resume-confirmed'));
      await refreshRecovery();
      return result;
    } catch (requestError) {
      setEmergencyPauseError(requestError?.message || 'Emergency Pause could not be resumed.');
      await refreshRecovery();
      throw requestError;
    } finally {
      setEmergencyPauseLoading(false);
    }
  }, [refreshRecovery]);

  const redeemDisciplinePoint = useCallback(async (idempotencyKey) => {
    const result = await taskApi.redeemDisciplinePoint(idempotencyKey);
    await refreshRecovery();
    return result;
  }, [refreshRecovery]);

  useEffect(() => {
    if (pathname !== '/app/tasks' && pathname !== '/app/tasks/create' && pathname !== '/app/dashboard' && pathname !== '/app/discipline' && pathname !== '/app/profile' && pathname !== '/app') return undefined;
    // React StrictMode replays effects in development. Deferring the initial load
    // lets its first setup be canceled before it can issue duplicate requests.
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => {
      window.clearTimeout(timer);
      controllerRef.current?.abort();
    };
  }, [pathname, refresh]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    if (!pathname.startsWith('/app')) return undefined;
    let active = true;
    const load = () => { if (active) void refreshRecovery(); };
    const timer = window.setTimeout(load, 0);
    const interval = window.setInterval(load, 15_000);
    const syncOnReturn = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', syncOnReturn);
    document.addEventListener('visibilitychange', syncOnReturn);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener('focus', syncOnReturn);
      document.removeEventListener('visibilitychange', syncOnReturn);
      recoveryControllerRef.current?.abort();
    };
  }, [pathname, refreshRecovery]);

  useEffect(() => () => recoveryControllerRef.current?.abort(), []);

  const value = useMemo(() => ({
    schedule,
    tasks,
    occurrences,
    allowance,
    allowanceLoaded,
    todayDate,
    todayCycleDay,
    todayLabel: dateLabel(todayDate),
    loading,
    error,
    errorInfo,
    recoveryQuests,
    gracePoints,
    gracePointTransactions,
    progression,
    disciplineSummary,
    disciplineCalendar,
    disciplineTransactions,
    disciplineError,
    progressionResetNotice,
    recoveryLoading,
    recoveryError,
    emergencyPause,
    emergencyPauseLoading,
    emergencyPauseError,
    activateEmergencyPause,
    resumeEmergencyPause,
    refreshRecovery,
    completeRecoveryQuest,
    redeemDisciplinePoint,
    refresh,
    clearError: () => { setError(''); setErrorInfo(null); },
  }), [schedule, tasks, occurrences, allowance, allowanceLoaded, todayDate, todayCycleDay, loading, error, errorInfo, recoveryQuests, gracePoints, gracePointTransactions, progression, disciplineSummary, disciplineCalendar, disciplineTransactions, disciplineError, progressionResetNotice, recoveryLoading, recoveryError, emergencyPause, emergencyPauseLoading, emergencyPauseError, activateEmergencyPause, resumeEmergencyPause, refreshRecovery, completeRecoveryQuest, redeemDisciplinePoint, refresh]);

  return <TaskBackendContext.Provider value={value}>{children}</TaskBackendContext.Provider>;
}

export function useTaskBackend() {
  const context = useContext(TaskBackendContext);
  if (!context) throw new Error('useTaskBackend must be used within TaskBackendProvider.');
  return context;
}
