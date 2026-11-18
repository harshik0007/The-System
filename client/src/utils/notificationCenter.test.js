import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultUserPreferences } from './userPreferences.js';
import {
  appendNewNotificationEvents,
  buildNotificationCandidates,
  createEmptyNotificationStore,
  filterNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  NOTIFICATIONS_SESSION_KEY,
} from './notificationCenter.js';

const runId = 'run-test-18';

function fixture() {
  return {
    currentSchedule: {
      cycleLength: 7,
      startDate: '2026-11-09',
      source: 'created',
      tasks: [{ id: 'task-1', name: 'Read for 20 minutes', cycleDays: [1, 2, 3, 4, 5, 6, 7] }],
      occurrences: {
        [`task-1:7:2026-11-15`]: { status: 'missed', progressionRunId: runId, snapshot: { name: 'Read for 20 minutes' } },
        [`task-1:3:2026-11-18`]: { status: 'missed', progressionRunId: runId, snapshot: { name: 'Current unfinished task' } },
      },
    },
    recoveryState: {
      quests: [
        { id: 'quest-1', status: 'expired', originalTaskName: 'Read for 20 minutes', accountabilityActionTitle: 'Read one page', expiryDate: '2026-11-15' },
        { id: 'quest-2', status: 'threshold-cleared', originalTaskName: 'Walk', accountabilityActionTitle: 'Walk for five minutes' },
      ],
      activity: [
        { id: 'activity-1', progressionRunId: runId, kind: 'generated', date: '2026-11-14', questId: 'quest-1' },
        { id: 'activity-2', progressionRunId: runId, kind: 'completed', date: '2026-11-14', questId: 'quest-1', detail: 'The Accountability Action was completed.' },
      ],
      gracePointEvents: [
        { id: 'grace-expiry-1', progressionRunId: runId, kind: 'expiry', date: '2026-11-15', questId: 'quest-1', appliedAmount: 1 },
        { id: 'grace-threshold-1', progressionRunId: runId, kind: 'threshold', date: '2026-11-16', appliedAmount: 1 },
      ],
    },
    disciplineState: {
      progressionRunId: runId,
      dailyRecords: {
        '2026-11-15': { progressionRunId: runId, hasDailyResetRecord: true, scheduledTaskCount: 1, completedTaskCount: 0, qualifies: false, streakBefore: 2, emergencyPause: false },
        '2026-11-18': { progressionRunId: runId, hasDailyResetRecord: false, scheduledTaskCount: 1, completedTaskCount: 0, qualifies: false, emergencyPause: false },
      },
      dpEvents: [{ id: 'dp-1', progressionRunId: runId, kind: 'recurring', date: '2026-11-14', amount: 0.25, title: 'Origin Discipline cycle reward' }],
      rankEntryEvents: [{ id: 'rank-1', progressionRunId: runId, date: '2026-11-14', rankNumber: 6, rankName: 'Ember', rankSlug: 'ember', dpAwarded: 0.1 }],
      dailyRankXpEvents: [],
      levelDownEvents: [],
      xpDrainEvents: [],
      xpHistory: [],
    },
    emergencyPauseState: { pauses: [] },
    monthlySummaries: [],
    historyExpiryReminders: [{ id: 'history-expiry:run-test-18:2026-10:7d', monthKey: '2026-10', monthLabel: 'October 2026', timing: '7d', timingLabel: '7 days', createdDate: '2026-11-18', expiryDate: '2026-11-25' }],
  };
}

test('candidate generation uses finalized records and distinguishes threshold clearing from individual expiry', () => {
  const candidates = buildNotificationCandidates(fixture());
  const types = candidates.map((item) => item.eventType);
  assert.ok(types.includes('missed-task'));
  assert.equal(candidates.filter((item) => item.eventType === 'missed-task').length, 1);
  assert.equal(types.includes('recovery-quest-threshold'), true);
  assert.equal(types.includes('grace-point-deduction'), true);
  assert.equal(candidates.find((item) => item.eventType === 'recovery-quest-threshold').description.includes('not individual expiry'), true);
  assert.equal(types.includes('discipline-streak-broken'), true);
  assert.equal(types.includes('monthly-summary-available'), false);
});

test('a protected finalized day does not create a missed-task alert', () => {
  const source = fixture();
  source.disciplineState.dailyRecords['2026-11-15'].emergencyPause = true;
  const candidates = buildNotificationCandidates(source);
  assert.equal(candidates.some((item) => item.eventType === 'missed-task'), false);
  assert.equal(candidates.some((item) => item.eventType === 'discipline-streak-broken'), false);
});

test('disabled event preferences are recorded as evaluated and cannot backfill later', () => {
  const candidates = buildNotificationCandidates(fixture());
  const candidate = candidates.find((item) => item.eventType === 'recovery-quest-generated');
  const prefs = createDefaultUserPreferences();
  prefs.notifications.recoveryQuestGenerated = false;
  const initial = createEmptyNotificationStore(runId);
  const disabled = appendNewNotificationEvents(initial, [candidate], prefs, new Date('2026-11-18T10:00:00Z'));
  assert.equal(disabled.notifications.length, 0);
  assert.ok(disabled.evaluatedEventIds.includes(candidate.id));
  prefs.notifications.recoveryQuestGenerated = true;
  const enabledLater = appendNewNotificationEvents(disabled, [candidate], prefs, new Date('2026-11-18T10:01:00Z'));
  assert.equal(enabledLater.notifications.length, 0);
});

test('notification creation is idempotent and read actions preserve records', () => {
  const candidate = buildNotificationCandidates(fixture()).find((item) => item.eventType === 'missed-task');
  const prefs = createDefaultUserPreferences();
  const once = appendNewNotificationEvents(createEmptyNotificationStore(runId), [candidate], prefs, new Date('2026-11-18T10:00:00Z'));
  const twice = appendNewNotificationEvents(once, [candidate], prefs, new Date('2026-11-18T10:01:00Z'));
  assert.equal(twice.notifications.length, 1);
  const readOne = markNotificationAsRead(twice, candidate.id, '2026-11-18T10:02:00Z');
  assert.equal(readOne.notifications[0].isRead, true);
  assert.equal(readOne.notifications[0].readAt, '2026-11-18T10:02:00Z');
  assert.equal(filterNotifications(readOne.notifications, 'unread').length, 0);
  assert.equal(getUnreadNotificationCount(readOne.notifications), 0);
  assert.equal(markAllNotificationsAsRead(readOne).notifications.length, 1);
});

test('notification storage uses a THE SYSTEM session key', () => {
  assert.equal(NOTIFICATIONS_SESSION_KEY, 'the-system-notification-center-v1');
});
