import { getIstDateKey } from './taskScheduleBuilder.js';

export const EMERGENCY_PAUSES_PER_MONTH = 2;
export const EMERGENCY_PAUSE_MIN_DAYS = 1;
export const EMERGENCY_PAUSE_MAX_DAYS = 7;
export const EMERGENCY_PAUSE_DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export function createEmergencyPauseState() {
  return { version: 1, pauses: [] };
}

export function getIstMonthKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit',
  }).formatToParts(value instanceof Date ? value : new Date(value));
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}`;
}

export function getEmergencyPauseMonthlyUsage(state, now = Date.now()) {
  const month = getIstMonthKey(now);
  return new Set((state?.pauses || [])
    .filter((pause) => pause.activationMonth === month && pause.activationEventId)
    .map((pause) => pause.activationEventId)).size;
}

export function getActiveEmergencyPause(state, now = Date.now()) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  return (state?.pauses || []).find((pause) => pause.status === 'active'
    && Number.isFinite(Date.parse(pause.scheduledResumeAt))
    && nowMs < Date.parse(pause.scheduledResumeAt)) || null;
}

export function getEmergencyPauseRemainingMs(pause, now = Date.now()) {
  if (!pause || pause.status !== 'active') return 0;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  return Math.max(0, Date.parse(pause.scheduledResumeAt) - nowMs);
}

function getQuestSnapshots(recoveryState, pauseId, startedAt) {
  return (recoveryState?.quests || [])
    .filter((quest) => quest.status === 'active')
    .map((quest) => {
      const remainingDays = Math.max(0, Number(quest.remainingDays) || 0);
      return {
        questId: quest.id,
        pauseId,
        capturedAt: startedAt,
        remainingDays,
        remainingDurationMs: remainingDays * EMERGENCY_PAUSE_DAY_MS,
        recoveryDay: quest.recoveryDay,
        recoveryWindowDays: quest.recoveryWindowDays,
      };
    });
}

export function activateEmergencyPause(state, recoveryState, durationDays, now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();
  const reconciled = reconcileEmergencyPause(state, recoveryState, nowDate);
  const baseState = reconciled.state;
  const normalizedDays = Number(durationDays);
  const activePause = getActiveEmergencyPause(baseState, nowMs);
  if (!Number.isInteger(normalizedDays) || normalizedDays < EMERGENCY_PAUSE_MIN_DAYS || normalizedDays > EMERGENCY_PAUSE_MAX_DAYS) {
    return { ...reconciled, error: 'invalid-duration', pause: null };
  }
  if (activePause) return { ...reconciled, error: 'already-active', pause: activePause };
  const usage = getEmergencyPauseMonthlyUsage(baseState, nowDate);
  if (usage >= EMERGENCY_PAUSES_PER_MONTH) return { ...reconciled, error: 'monthly-limit', pause: null };

  const startAt = nowDate.toISOString();
  const pauseId = `pause-${nowMs.toString(36)}-${(baseState.pauses || []).length + 1}`;
  const pause = {
    id: pauseId,
    startAt,
    durationDays: normalizedDays,
    scheduledResumeAt: new Date(nowMs + normalizedDays * EMERGENCY_PAUSE_DAY_MS).toISOString(),
    actualResumeAt: null,
    status: 'active',
    activationMonth: getIstMonthKey(nowDate),
    activationEventId: `pause-activation:${pauseId}`,
    resumeEventId: null,
    resumeReason: null,
    recoveryQuestRemainingSnapshots: getQuestSnapshots(recoveryState, pauseId, startAt),
  };
  return {
    state: { ...baseState, pauses: [...(baseState.pauses || []), pause] },
    recoveryState,
    pause,
    error: null,
    changed: true,
  };
}

export function resumeEmergencyPause(state, now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const current = getActiveEmergencyPause(state, nowDate);
  if (!current) {
    const reconciled = reconcileEmergencyPause(state, null, nowDate);
    return { ...reconciled, pause: null, error: 'not-active' };
  }
  const resumed = {
    ...current,
    status: 'resumed-early',
    actualResumeAt: nowDate.toISOString(),
    resumeReason: 'manual',
    resumeEventId: `pause-resume:${current.id}`,
  };
  return {
    state: { ...state, pauses: state.pauses.map((pause) => pause.id === current.id ? resumed : pause) },
    pause: resumed,
    error: null,
    changed: true,
  };
}

export function reconcileEmergencyPause(state, recoveryState, now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();
  const expired = (state?.pauses || []).find((pause) => pause.status === 'active'
    && Number.isFinite(Date.parse(pause.scheduledResumeAt))
    && nowMs >= Date.parse(pause.scheduledResumeAt));
  if (!expired) return { state: state || createEmergencyPauseState(), recoveryState, pause: getActiveEmergencyPause(state, nowMs), changed: false };
  const resumed = {
    ...expired,
    status: 'automatically-resumed',
    actualResumeAt: expired.scheduledResumeAt,
    resumeReason: 'automatic',
    resumeEventId: `pause-resume:${expired.id}`,
  };
  return {
    state: { ...state, pauses: state.pauses.map((pause) => pause.id === expired.id ? resumed : pause) },
    recoveryState,
    pause: resumed,
    changed: true,
  };
}

function istDayStart(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day) - IST_OFFSET_MS;
}

export function isEmergencyPauseDate(state, dateKey) {
  if (!dateKey) return false;
  const dayStart = istDayStart(dateKey);
  const dayEnd = dayStart + EMERGENCY_PAUSE_DAY_MS;
  return (state?.pauses || []).some((pause) => {
    if (!pause.startAt || !pause.scheduledResumeAt) return false;
    const start = Date.parse(pause.startAt);
    const end = Date.parse(pause.actualResumeAt || pause.scheduledResumeAt);
    return Number.isFinite(start) && Number.isFinite(end) && start < dayEnd && end > dayStart;
  });
}

export function getEmergencyPauseDates(state) {
  const dates = new Set();
  (state?.pauses || []).forEach((pause) => {
    if (!pause.startAt || !pause.scheduledResumeAt) return;
    const start = Date.parse(pause.startAt);
    const end = Date.parse(pause.actualResumeAt || pause.scheduledResumeAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    let dateKey = getIstDateKey(new Date(start));
    const finalDateKey = getIstDateKey(new Date(Math.max(start, end - 1)));
    let guard = 0;
    while (dateKey <= finalDateKey && guard < 9) {
      dates.add(dateKey);
      const date = new Date(`${dateKey}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + 1);
      dateKey = getIstDateKey(date);
      guard += 1;
    }
  });
  return [...dates].sort();
}
