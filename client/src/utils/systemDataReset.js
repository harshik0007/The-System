import { dailyTasksDemo } from '../data/dailyTasksDemo.js';
import { createDefaultUserPreferences, USER_PREFERENCES_SESSION_KEY } from './userPreferences.js';
import { createEmergencyPauseState } from './emergencyPauseManager.js';
import { createDisciplineState, getLevelFromTotalXp } from './disciplineManager.js';
import { createRecoveryQuestState } from './recoveryQuestManager.js';
import { getIstDateKey } from './taskScheduleBuilder.js';
import { getWeeklyChangePeriod } from './weeklyTaskChanges.js';
import { createEmptyNotificationStore, NOTIFICATIONS_SESSION_KEY } from './notificationCenter.js';

export const TASK_SCHEDULE_SESSION_KEY = 'the-system-discipline-demo-v1';
export const RESET_CONFIRMATION_PHRASE = 'RESET MY SYSTEM';

export function isResetConfirmationReady({ phrase, hasReadWarning, finalConfirmation } = {}) {
  return hasReadWarning === true
    && finalConfirmation === true
    && phrase === RESET_CONFIRMATION_PHRASE;
}

function createRunId(dateKey) {
  const suffix = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `run-${dateKey}-${suffix}`;
}

export function createFreshSystemData({ currentDisciplineState, now = new Date(), runId } = {}) {
  const dateKey = getIstDateKey(now);
  const progressionRunId = runId || createRunId(dateKey);
  const memberSince = currentDisciplineState?.memberSince || dateKey;
  const schedule = {
    cycleLength: null,
    startDate: dateKey,
    source: 'empty',
    tasks: [],
    taskHistory: [],
    occurrences: {},
  };
  const discipline = {
    ...createDisciplineState({ now, rankSlug: 'origin', totalXp: 0, dpBalance: 0 }),
    memberSince,
    currentRunStartedDate: dateKey,
    progressionRunId,
    personalBestCaptureEnabled: false,
  };
  const recovery = createRecoveryQuestState([], dateKey);
  const runBaseline = {
    progressionRunId,
    date: dateKey,
    totalXp: 0,
    level: getLevelFromTotalXp(0),
    dpBalance: 0,
    gracePoints: recovery.gracePoints,
    rankSlug: 'origin',
    streak: 0,
    cycleProgress: 0,
    excluded: {
      dailyRecordDates: [],
      xpEventIds: [],
      dpEventIds: [],
      rankEventIds: [],
      dailyRankEventIds: [],
      levelEventIds: [],
      redemptionEventIds: [],
      recoveryQuestIds: [],
      graceEventIds: [],
      recoveryActivityIds: [],
      occurrenceKeys: [],
    },
  };

  return {
    currentSchedule: schedule,
    weeklyAllowance: {
      maximum: dailyTasksDemo.taskChangesAllowed,
      used: 0,
      weekStartDate: getWeeklyChangePeriod(dateKey).weekStartDate,
    },
    recoveryState: recovery,
    disciplineState: discipline,
    personalBestRecords: {},
    emergencyPauseState: createEmergencyPauseState(),
    monthlySummaries: [],
    historyExpiryReminders: [],
    analysisRunBaseline: runBaseline,
  };
}

export function persistFreshSystemData(storage, freshData) {
  if (!storage) return false;
  try {
    storage.setItem(TASK_SCHEDULE_SESSION_KEY, JSON.stringify(freshData));
    storage.setItem(USER_PREFERENCES_SESSION_KEY, JSON.stringify(createDefaultUserPreferences()));
    storage.setItem(NOTIFICATIONS_SESSION_KEY, JSON.stringify(createEmptyNotificationStore(freshData.disciplineState.progressionRunId)));
    return true;
  } catch {
    return false;
  }
}
