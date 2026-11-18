import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshSystemData, isResetConfirmationReady, persistFreshSystemData, RESET_CONFIRMATION_PHRASE, TASK_SCHEDULE_SESSION_KEY } from './systemDataReset.js';
import { USER_PREFERENCES_SESSION_KEY } from './userPreferences.js';
import { getLevelFromTotalXp } from './disciplineManager.js';

const resetNow = new Date('2026-11-18T06:30:00.000Z');

test('manual reset creates an empty Origin run and preserves the permanent Member Since date', () => {
  const fresh = createFreshSystemData({
    currentDisciplineState: { memberSince: '2021-04-12', progressionRunId: 'old-run' },
    now: resetNow,
    runId: 'new-run-id',
  });

  assert.equal(fresh.disciplineState.memberSince, '2021-04-12');
  assert.equal(fresh.disciplineState.currentRunStartedDate, '2026-11-18');
  assert.equal(fresh.disciplineState.progressionRunId, 'new-run-id');
  assert.equal(fresh.disciplineState.currentRankSlug, 'origin');
  assert.equal(fresh.disciplineState.personalBestCaptureEnabled, false);
  assert.equal(fresh.disciplineState.totalXp, 0);
  assert.equal(getLevelFromTotalXp(fresh.disciplineState.totalXp), 0);
  assert.equal(fresh.disciplineState.dpBalance, 0);
  assert.equal(fresh.disciplineState.currentStreak, 0);
  assert.equal(fresh.disciplineState.longestStreak, 0);
  assert.equal(fresh.disciplineState.cycle.progress, 0);
  assert.deepEqual(fresh.disciplineState.dailyRecords, {});
  assert.deepEqual(fresh.disciplineState.xpHistory, []);
  assert.deepEqual(fresh.disciplineState.rankEntryEvents, []);
  assert.deepEqual(fresh.disciplineState.redemptionEvents, []);
  assert.equal(fresh.recoveryState.gracePoints, 3);
  assert.deepEqual(fresh.recoveryState.quests, []);
  assert.deepEqual(fresh.recoveryState.gracePointEvents, []);
  assert.deepEqual(fresh.currentSchedule.tasks, []);
  assert.deepEqual(fresh.currentSchedule.taskHistory, []);
  assert.deepEqual(fresh.currentSchedule.occurrences, {});
  assert.equal(fresh.weeklyAllowance.used, 0);
  assert.deepEqual(fresh.personalBestRecords, {});
  assert.deepEqual(fresh.emergencyPauseState.pauses, []);
  assert.deepEqual(fresh.monthlySummaries, []);
  assert.deepEqual(fresh.historyExpiryReminders, []);
  assert.equal(fresh.analysisRunBaseline.date, '2026-11-18');
  assert.equal(fresh.analysisRunBaseline.progressionRunId, 'new-run-id');
  assert.deepEqual(fresh.analysisRunBaseline.excluded.dailyRecordDates, []);
});

test('reset persistence replaces only THE SYSTEM progress and preference keys', () => {
  const values = new Map([
    ['unrelated-session', 'keep-me'],
    ['auth-session-preview', 'account-session'],
    [TASK_SCHEDULE_SESSION_KEY, 'old-progress'],
    [USER_PREFERENCES_SESSION_KEY, 'custom-preferences'],
  ]);
  const storage = {
    setItem: (key, value) => values.set(key, String(value)),
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
  };
  const fresh = createFreshSystemData({ currentDisciplineState: { memberSince: '2021-04-12' }, now: resetNow, runId: 'reset-session-run' });

  assert.equal(persistFreshSystemData(storage, fresh), true);
  assert.equal(storage.getItem('unrelated-session'), 'keep-me');
  assert.equal(storage.getItem('auth-session-preview'), 'account-session');
  assert.equal(JSON.parse(storage.getItem(TASK_SCHEDULE_SESSION_KEY)).disciplineState.progressionRunId, 'reset-session-run');
  const preferences = JSON.parse(storage.getItem(USER_PREFERENCES_SESSION_KEY));
  assert.equal(preferences.profile.displayName, 'Demo Member');
  assert.equal(preferences.appearance.voidShardCursor, true);
});

test('a new reset receives a distinct progression run identifier', () => {
  const first = createFreshSystemData({ currentDisciplineState: { memberSince: '2021-04-12' }, now: resetNow });
  const second = createFreshSystemData({ currentDisciplineState: { memberSince: '2021-04-12' }, now: resetNow });
  assert.notEqual(first.disciplineState.progressionRunId, second.disciplineState.progressionRunId);
});

test('reset confirmation is enabled only after the warning is read, exact phrase entered and final checkbox selected', () => {
  assert.equal(isResetConfirmationReady({ phrase: RESET_CONFIRMATION_PHRASE, hasReadWarning: false, finalConfirmation: true }), false);
  assert.equal(isResetConfirmationReady({ phrase: RESET_CONFIRMATION_PHRASE, hasReadWarning: true, finalConfirmation: false }), false);
  assert.equal(isResetConfirmationReady({ phrase: 'reset my system', hasReadWarning: true, finalConfirmation: true }), false);
  assert.equal(isResetConfirmationReady({ phrase: RESET_CONFIRMATION_PHRASE, hasReadWarning: true, finalConfirmation: true }), true);
});
