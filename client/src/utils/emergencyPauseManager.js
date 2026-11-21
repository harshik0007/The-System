import { getIstDateKey } from './taskScheduleBuilder.js';

// Temporary development allowance requested for Emergency Pause testing.
// Restore this to 2 during the final product optimization pass.
export const EMERGENCY_PAUSES_PER_MONTH = 10;
export const EMERGENCY_PAUSE_MIN_DAYS = 1;
export const EMERGENCY_PAUSE_MAX_DAYS = 7;
export const EMERGENCY_PAUSE_DAY_MS = 24 * 60 * 60 * 1000;

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

export function getUniqueEmergencyPauseRecords(state) {
  const records = [];
  const indexByIdentity = new Map();
  (state?.pauses || []).forEach((pause) => {
    const identities = [pause.id && `pause:${pause.id}`, pause.activationEventId && `activation:${pause.activationEventId}`].filter(Boolean);
    const matchedIndexes = [...new Set(identities.map((identity) => indexByIdentity.get(identity)).filter((index) => index !== undefined))];
    if (!matchedIndexes.length) {
      const index = records.push(pause) - 1;
      identities.forEach((identity) => indexByIdentity.set(identity, index));
      return;
    }

    const targetIndex = Math.max(...matchedIndexes);
    records[targetIndex] = pause;
    for (const [identity, index] of indexByIdentity) {
      if (matchedIndexes.includes(index)) indexByIdentity.set(identity, targetIndex);
    }
    matchedIndexes.filter((index) => index !== targetIndex).forEach((index) => { records[index] = null; });
    identities.forEach((identity) => indexByIdentity.set(identity, targetIndex));
  });
  return records.filter(Boolean);
}

export function getEmergencyPauseMonthlyUsage(state, now = Date.now()) {
  const month = getIstMonthKey(now);
  return new Set(getUniqueEmergencyPauseRecords(state)
    .filter((pause) => pause.activationMonth === month && pause.activationEventId)
    .map((pause) => pause.activationEventId)).size;
}

export function getActiveEmergencyPause(state, now = Date.now()) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  return getUniqueEmergencyPauseRecords(state).find((pause) => pause.status === 'active'
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

export function isEmergencyPauseDate(state, dateKey) {
  if (!dateKey) return false;
  return getUniqueEmergencyPauseRecords(state).some((pause) => getEmergencyPauseDatesForRecord(pause).includes(dateKey));
}

export function getEmergencyPauseDatesForRecord(pause) {
  if (!pause?.startAt) return [];
  // If a completed pause lost its actual resume timestamp, the scheduled end
  // cannot stand in for a known early or automatic resume.
  const resumeTypeIsRecorded = pause.status === 'resumed-early' || pause.status === 'automatically-resumed'
    || pause.resumeReason === 'manual' || pause.resumeReason === 'automatic';
  if (resumeTypeIsRecorded && !pause.actualResumeAt) return [];
  const start = Date.parse(pause.startAt);
  const end = Date.parse(pause.actualResumeAt || pause.scheduledResumeAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];

  // Pause intervals are half-open [start, end): a resume at IST midnight does not protect the new date.
  const dates = [];
  let dateKey = getIstDateKey(new Date(start));
  const finalDateKey = getIstDateKey(new Date(end - 1));
  let guard = 0;
  while (dateKey <= finalDateKey && guard < 9) {
    dates.push(dateKey);
    const date = new Date(`${dateKey}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    dateKey = getIstDateKey(date);
    guard += 1;
  }
  return dates;
}

export function getEmergencyPauseDates(state) {
  return [...new Set(getUniqueEmergencyPauseRecords(state).flatMap(getEmergencyPauseDatesForRecord))].sort();
}
