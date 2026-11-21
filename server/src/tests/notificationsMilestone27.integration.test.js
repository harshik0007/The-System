import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import Notification from '../models/Notification.js';
import ProgressionRun from '../models/ProgressionRun.js';
import User from '../models/User.js';
import { createNotificationWithinSession, getNotificationPreferences, getUnreadNotificationCount, listNotifications, markAllNotificationsRead } from '../services/notificationService.js';
import { withMongoTransaction } from '../services/mongoTransaction.js';

const shouldRun = process.env.RUN_MONGO_INTEGRATION === '1';

test('M27 notifications persist, filter, deduplicate concurrently, respect category preferences and enforce ownership', { skip: !shouldRun, timeout: 120_000 }, async (t) => {
  const isolatedUri = new URL(config.mongoUri);
  isolatedUri.pathname = `/the_system_m27_${process.pid}_${Date.now()}`;
  await connectDatabase(isolatedUri.toString());
  assert.equal(mongoose.connection.readyState, 1, 'MongoDB replica set must be connected');
  t.after(async () => {
    try { await mongoose.connection.dropDatabase(); } finally { await disconnectDatabase(); }
  });
  await Promise.all([Notification.init(), User.init()]);

  const user = await User.create({ identityKind: 'account', accountStatus: 'active', memberSince: '2026-11-01' });
  const other = await User.create({ identityKind: 'account', accountStatus: 'active', memberSince: '2026-11-01' });
  const run = await ProgressionRun.create({
    userId: user._id, runNumber: 1, status: 'active', startedAt: new Date('2026-11-01T00:00:00.000Z'), startedOn: '2026-11-01',
    currentRankSlug: 'origin', level: 0, totalXp: 0, gracePoints: 3, disciplinePoints: 0, currentStreak: 0, longestStreak: 0,
  });
  user.currentProgressionRunId = run._id;
  await user.save();

  assert.deepEqual((await getNotificationPreferences(user._id)).categories, {
    tasks: true, 'recovery-quests': true, discipline: true, 'rank-xp': true, 'emergency-pause': true, 'monthly-retention': true,
  }, 'new members receive enabled defaults for all six categories');

  const first = await withMongoTransaction((session) => createNotificationWithinSession({
    userId: user._id, progressionRunId: run._id, category: 'tasks', eventType: 'task-completed',
    title: 'Task completed', description: 'The saved Task completion is recorded.', targetRoute: '/app/tasks',
    idempotencyKey: 'task-completed:source-1', occurredAt: new Date('2026-11-18T10:00:00.000Z'), session,
  }));
  assert.equal(first.created, true);

  const duplicateResults = await Promise.all([1, 2].map(() => withMongoTransaction((session) => createNotificationWithinSession({
    userId: user._id, progressionRunId: run._id, category: 'discipline', eventType: 'discipline-day-qualified',
    title: 'Discipline day qualified', description: 'A finalized date qualified.', targetRoute: '/app/discipline',
    idempotencyKey: 'discipline-finalized:source-1', session,
  }))));
  assert.equal(duplicateResults.filter((item) => item.created).length, 1);
  assert.equal(await Notification.countDocuments({ userId: user._id, idempotencyKey: 'discipline-finalized:source-1' }), 1);

  await withMongoTransaction(async (session) => {
    await createNotificationWithinSession({
      userId: user._id, progressionRunId: run._id, category: 'rank-xp', eventType: 'level-increased',
      title: 'Level 1 reached', description: 'Progression changed.', targetRoute: '/app/discipline',
      idempotencyKey: 'rollback-notice:source-1', session,
    });
    throw new Error('force transaction rollback');
  }).catch(() => {});
  assert.equal(await Notification.countDocuments({ userId: user._id, idempotencyKey: 'rollback-notice:source-1' }), 0);

  const firstPage = await listNotifications(user._id, { category: 'tasks', readState: 'unread', limit: 1 });
  assert.equal(firstPage.notifications.length, 1);
  assert.equal(firstPage.notifications[0].category, 'tasks');

  const app = createApp({
    nodeEnv: 'test', databaseReady: () => mongoose.connection.readyState === 1, corsOrigins: [],
    testIdentityMiddleware: (request, _response, next) => { request.user = { id: String(user._id), identityKind: 'account' }; request.authSession = { authenticated: true }; next(); },
  });
  let server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  t.after(async () => { if (server?.listening) await new Promise((resolve) => server.close(resolve)); });

  let response = await fetch(`${base}/notifications/unread-count`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.unreadCount, 2);
  response = await fetch(`${base}/notifications?category=tasks&readState=unread&limit=10`);
  const listResult = await response.json();
  assert.equal(response.status, 200);
  assert.equal(listResult.data.notifications.length, 1);
  response = await fetch(`${base}/notifications?userId=${other._id}&readState=all&limit=10`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.notifications.length, 2, 'list retrieval ignores caller-supplied member identifiers');
  const notificationId = listResult.data.notifications[0].id;

  response = await fetch(`${base}/notifications/${notificationId}/read`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.unreadCount, 1);

  response = await fetch(`${base}/notifications/categories`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data.categories.map(({ id }) => id), [
    'tasks', 'recovery-quests', 'discipline', 'rank-xp', 'emergency-pause', 'monthly-retention',
  ]);
  response = await fetch(`${base}/notifications?category=not-a-category`);
  assert.equal(response.status, 400);

  const previouslyStoredCount = await Notification.countDocuments({ userId: user._id });
  response = await fetch(`${base}/notifications/${notificationId}/read`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 200, 'repeated mark-read is idempotent');

  response = await fetch(`${base}/notification-preferences`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: { tasks: false, 'recovery-quests': true, discipline: true, 'rank-xp': true, 'emergency-pause': true, 'monthly-retention': true } }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.categories.tasks, false);
  assert.equal(await Notification.countDocuments({ userId: user._id }), previouslyStoredCount,
    'disabling a category does not remove already stored notification history');
  const disabled = await withMongoTransaction((session) => createNotificationWithinSession({
    userId: user._id, progressionRunId: run._id, category: 'tasks', eventType: 'task-schedule-created',
    title: 'Schedule created', description: 'New schedule.', targetRoute: '/app/tasks', idempotencyKey: 'disabled-category:source-1', session,
  }));
  assert.equal(disabled.disabled, true);
  assert.equal(await Notification.countDocuments({ userId: user._id, idempotencyKey: 'disabled-category:source-1' }), 0);

  response = await fetch(`${base}/notification-preferences`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: { tasks: true, 'recovery-quests': true, discipline: true, 'rank-xp': true, 'emergency-pause': true, 'monthly-retention': true } }) });
  assert.equal(response.status, 200);
  assert.equal(await Notification.countDocuments({ userId: user._id }), previouslyStoredCount,
    're-enabling a category does not replay a suppressed historical event');

  const ownedByOther = await Notification.create({
    userId: other._id, category: 'tasks', eventType: 'task-completed', title: 'Other member Task', description: 'Private.',
    targetRoute: '/app/tasks', idempotencyKey: 'other-user:source-1',
  });
  response = await fetch(`${base}/notifications/${ownedByOther._id}/read`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 404);
  assert.equal((await Notification.findById(ownedByOther._id)).readAt, null);

  await new Promise((resolve) => server.close(resolve));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const restartedBase = `http://127.0.0.1:${server.address().port}/api/v1`;
  response = await fetch(`${restartedBase}/notifications?readState=all&limit=10`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.notifications.length, 2, 'persisted records survive an application server restart');

  await markAllNotificationsRead(user._id);
  assert.equal((await getUnreadNotificationCount(user._id)).unreadCount, 0);
  await markAllNotificationsRead(user._id);
  assert.equal((await getUnreadNotificationCount(user._id)).unreadCount, 0, 'repeated mark-all remains idempotent');
});
