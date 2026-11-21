import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNotificationDateTime, NOTIFICATION_CATEGORIES, resolveNotificationDestination } from './notificationCenter.js';

test('the centre exposes all six canonical notification categories', () => {
  assert.deepEqual(NOTIFICATION_CATEGORIES.map(({ id }) => id), [
    'tasks', 'recovery-quests', 'discipline', 'rank-xp', 'emergency-pause', 'monthly-retention',
  ]);
});

test('notification navigation accepts only supported internal section and Rank routes', () => {
  assert.equal(resolveNotificationDestination({ targetRoute: '/app/tasks?date=2026-11-19' }), '/app/tasks?date=2026-11-19');
  assert.equal(resolveNotificationDestination({ targetRoute: '/ranks/continuum' }), '/ranks/continuum');
  assert.equal(resolveNotificationDestination({ targetRoute: 'https://example.com' }), null);
  assert.equal(resolveNotificationDestination({ targetRoute: '/app/settings?redirect=https://example.com' }), null);
  assert.equal(resolveNotificationDestination({ targetRoute: '/app/tasks#external' }), null);
});

test('notification timestamps use IST formatting and handle unavailable values', () => {
  assert.equal(formatNotificationDateTime(null), 'Time unavailable');
  assert.match(formatNotificationDateTime('2026-11-19T00:00:00.000Z'), /19 Nov 2026/);
});
