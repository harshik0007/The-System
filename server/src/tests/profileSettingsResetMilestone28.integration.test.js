import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { once } from 'node:events';
import { createApp } from '../app.js';
import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import DisciplineRewardCycle from '../models/DisciplineRewardCycle.js';
import EmergencyPause from '../models/EmergencyPause.js';
import EmergencyPauseMonthlyUsage from '../models/EmergencyPauseMonthlyUsage.js';
import GracePointTransaction from '../models/GracePointTransaction.js';
import MonthlyAnalysisSummary from '../models/MonthlyAnalysisSummary.js';
import Notification from '../models/Notification.js';
import ProgressionResetEvent from '../models/ProgressionResetEvent.js';
import ProgressionRun from '../models/ProgressionRun.js';
import RankEntryEvent from '../models/RankEntryEvent.js';
import RecoveryQuest from '../models/RecoveryQuest.js';
import DailyDisciplineRecord from '../models/DailyDisciplineRecord.js';
import Task from '../models/Task.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import TaskSchedule from '../models/TaskSchedule.js';
import User from '../models/User.js';
import XpTransaction from '../models/XpTransaction.js';
import { getAccountSettings, getManualResetPreview, manualResetAndRestart } from '../services/accountSettingsService.js';
import { getPublicMemberProfile } from '../services/leaderboardService.js';
import { getEmergencyPauseStatus } from '../services/emergencyPauseService.js';
import { getNotificationPreferences } from '../services/notificationService.js';
import { getCumulativeXpThreshold } from '../services/progressionXpService.js';
import { getIstMidnightInstant } from '../utils/ist.js';

const shouldRun = process.env.RUN_MONGO_INTEGRATION === '1';

test('M28 account preferences, public privacy and manual reset preserve account/history while starting a fresh run', { skip: !shouldRun, timeout: 120_000 }, async (t) => {
  const isolatedUri = new URL(config.mongoUri);
  isolatedUri.pathname = `/the_system_m28_${process.pid}_${Date.now()}`;
  await connectDatabase(isolatedUri.toString());
  assert.equal(mongoose.connection.readyState, 1, 'A local MongoDB replica set must be connected.');
  t.after(async () => { await mongoose.connection.dropDatabase(); await disconnectDatabase(); });

  const userId = new mongoose.Types.ObjectId();
  const username = `m28_member_${userId.toString().slice(-6)}`;
  const user = await User.create({
    identityKind: 'account', username, usernameNormalized: username, emailNormalized: `m28-${userId}@example.test`, accountStatus: 'active',
    memberSince: '2026-01-05', publicHandle: `m28-${new mongoose.Types.ObjectId().toString().slice(-8)}`,
    resetCount: 4, lifetimeLongestStreak: 28, highestRankAchieved: 'continuum',
    personalBestRecords: {
      overall: { bestPosition: 1, achievedOn: '2026-10-01' },
      discipline: { bestPosition: 2, achievedOn: '2026-10-02' },
      xp: { bestPosition: 3, achievedOn: '2026-10-03' },
    },
    privacy: { publicProfile: true, activityMap: false, personalBest: false, currentRank: false, level: false, progressionStats: false, currentStreak: false, longestStreak: false, disciplinePointBalance: false, gracePointBalance: false },
    appearancePreferences: { voidShardCursor: false, clickRipple: true, nonessentialAnimations: false, reduceDecorativeEffects: true },
    accessibilityPreferences: { reduceMotion: true }, accountPreferencesInitialized: true,
    notificationPreferences: { categories: { tasks: false, 'recovery-quests': true, discipline: true, 'rank-xp': true, 'emergency-pause': true, 'monthly-retention': true } },
  });
  const originalCreatedAt = user.createdAt.getTime();
  const startedAt = getIstMidnightInstant('2026-11-01');
  const run = await ProgressionRun.create({
    userId: user._id, runNumber: 1, status: 'active', startedAt, startedOn: '2026-11-01', currentRankSlug: 'continuum', level: 100,
    totalXp: getCumulativeXpThreshold(100) + 123.45, gracePoints: 1, disciplinePoints: 3.5, currentStreak: 9, longestStreak: 14, taskScheduleId: null,
    emergencyPause: { active: false, allowanceMonthKey: '2026-11', activationsUsed: 1 }, recoveryQuestLastResetDate: '2026-11-01',
  });
  const schedule = await TaskSchedule.create({
    userId: user._id, progressionRunId: run._id, cycleLength: 1, cycleAnchorDate: '2026-11-01', status: 'active', version: 1,
    effectiveStartDate: '2026-11-01', idempotencyKey: `m28-schedule-${user._id}`,
  });
  run.taskScheduleId = schedule._id;
  run.emergencyPause.active = true;
  run.emergencyPause.pauseId = new mongoose.Types.ObjectId();
  run.emergencyPause.selectedDurationDays = 3;
  run.emergencyPause.activatedAt = new Date('2026-11-18T06:00:00.000Z');
  run.emergencyPause.resumesAt = new Date('2026-11-21T06:00:00.000Z');
  await run.save();
  await User.updateOne({ _id: user._id }, { $set: { currentProgressionRunId: run._id } });

  const task = await Task.create({
    userId: user._id, progressionRunId: run._id, taskScheduleId: schedule._id, title: 'Archived run task', description: '',
    cycleDays: [1], accountabilityAction: { title: 'Original action', description: 'Complete the action.' }, revision: 1,
    status: 'active', effectiveDate: '2026-11-01', createdEffectiveDate: '2026-11-01', idempotencyKey: `m28-task-${user._id}`,
  });
  const occurrence = await TaskOccurrence.create({
    userId: user._id, progressionRunId: run._id, taskId: task._id, taskScheduleId: schedule._id, occurrenceDate: '2026-11-18', cycleDay: 1,
    snapshot: { title: task.title, description: '', accountabilityAction: { title: 'Original action', description: 'Complete the action.', weakness: '' }, revision: 1 }, status: 'completed', completedAt: new Date('2026-11-18T10:00:00.000Z'),
  });
  const quest = await RecoveryQuest.create({
    userId: user._id, progressionRunId: run._id, sourceTaskId: task._id, sourceOccurrenceId: occurrence._id,
    sourceEventKey: `m28-quest-${user._id}`, sourceSnapshot: { taskTitle: task.title, taskDescription: '', accountabilityActionTitle: 'Original action', accountabilityActionDescription: 'Complete the action.', taskRevision: 1 },
    activatedAt: new Date('2026-11-17T10:00:00.000Z'), baseExpiresAt: new Date('2026-11-20T10:00:00.000Z'), expiresAt: new Date('2026-11-20T10:00:00.000Z'),
    remainingDurationMs: 86_400_000, pausedAt: new Date('2026-11-18T06:00:00.000Z'), status: 'active',
  });
  const pause = await EmergencyPause.create({
    _id: run.emergencyPause.pauseId, userId: user._id, progressionRunId: run._id, activationMonthKey: '2026-11', idempotencyKey: `m28-pause-${user._id}`,
    durationDays: 3, startedAt: run.emergencyPause.activatedAt, selectedEndAt: run.emergencyPause.resumesAt, effectiveEndAt: run.emergencyPause.resumesAt,
    scheduledEndReason: 'selected-duration', recoveryQuestSnapshots: [{ questId: quest._id, remainingDurationMs: 86_400_000 }], status: 'active',
  });
  await EmergencyPauseMonthlyUsage.create({ userId: user._id, monthKey: '2026-11', progressionRunId: run._id, activationsUsed: 1 });
  await DisciplineRewardCycle.create({
    userId: user._id, progressionRunId: run._id, cycleNumber: 1, rankSlug: 'continuum', rankNumber: '01', rankName: 'Continuum',
    requiredQualifyingDays: 20, completedQualifyingDays: 9, rewardAmountCents: 100, startDate: '2026-11-01', status: 'active', configurationVersion: 'm28-test',
  });
  await MonthlyAnalysisSummary.create({
    userId: user._id, progressionRunId: run._id, monthKey: '2026-10', monthStartAt: new Date('2026-10-01T00:00:00.000Z'),
    monthEndAt: new Date('2026-11-01T00:00:00.000Z'), coveredFrom: '2026-10-01', coveredThrough: '2026-10-31',
    status: 'finalized', aggregationVersion: 1, hasData: true, metrics: { tasks: { completed: 1 } }, sourceCounts: {},
    createdAt: new Date('2026-11-01T00:00:00.000Z'), updatedAt: new Date('2026-11-01T00:00:00.000Z'),
  });
  const [xpTransaction] = await XpTransaction.create([{
    userId: user._id, progressionRunId: run._id, amount: mongoose.Types.Decimal128.fromString('1.00'), type: 'rank-entry', sourceType: 'rank-entry',
    sourceEventKey: `m28-rank-xp-${user._id}`, balanceBefore: mongoose.Types.Decimal128.fromString('1.00'), balanceAfter: mongoose.Types.Decimal128.fromString('2.00'),
    levelBefore: 100, resultingLevel: 100, levelRequirement: 0, activeQuestCount: 0, occurredAt: startedAt, businessDate: '2026-11-01',
  }]);
  await RankEntryEvent.create({
    userId: user._id, progressionRunId: run._id, rankSlug: 'continuum', sourceEventKey: `m28-rank-${user._id}`, sourceXpTransactionId: xpTransaction._id,
    xpRewardConfigured: false, occurredAt: startedAt, businessDate: '2026-11-01', configurationVersion: 'm28-test',
  });
  await Notification.create({
    userId: user._id, progressionRunId: run._id, category: 'discipline', eventType: 'discipline-qualified', title: 'Day qualified',
    description: 'Existing notification remains in history.', targetRoute: '/app/discipline', idempotencyKey: `m28-notification-${user._id}`, createdAt: startedAt,
  });

  const app = createApp({ nodeEnv: 'test', databaseReady: () => true, corsOrigins: [], testIdentityMiddleware: (request, _response, next) => {
    request.user = { id: String(user._id), identityKind: 'account' }; request.authSession = { authenticated: true };
    next();
  } });
  const apiServer = app.listen(0, '127.0.0.1');
  await once(apiServer, 'listening');
  t.after(async () => { if (apiServer.listening) await new Promise((resolve) => apiServer.close(resolve)); });
  const base = `http://127.0.0.1:${apiServer.address().port}/api/v1`;
  const getJson = async (path) => { const response = await fetch(`${base}${path}`); return { response, body: await response.json() }; };
  const putJson = async (path, body) => { const response = await fetch(`${base}${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { response, body: await response.json() }; };

  let { response, body } = await getJson('/account/settings');
  assert.equal(response.status, 200);
  assert.equal(body.settings.account.resetCount, 4);
  assert.equal(body.settings.account.lifetimeLongestStreak, 28);
  assert.equal(body.settings.appearance.voidShardCursor, false);
  assert.equal(body.settings.accessibility.reduceMotion, true);
  assert.equal(JSON.stringify(body).includes(String(user._id)), false);
  assert.equal(JSON.stringify(body).includes(user.emailNormalized), false);
  assert.equal(JSON.stringify(body).includes('passwordHash'), false);
  assert.deepEqual(body.settings.notificationPreferences.categories.tasks, false);

  ({ response, body } = await putJson('/account/preferences', { appearance: { voidShardCursor: true, clickRipple: false, nonessentialAnimations: true, reduceDecorativeEffects: false } }));
  assert.equal(response.status, 200);
  assert.equal(body.settings.appearance.voidShardCursor, true);
  assert.equal(body.settings.appearance.clickRipple, false);
  const accessibilityUpdate = await putJson('/account/preferences', { accessibility: { reduceMotion: null } });
  assert.equal(accessibilityUpdate.response.status, 200);
  assert.equal(accessibilityUpdate.body.settings.accessibility.reduceMotion, null);
  ({ response } = await putJson('/account/preferences', { accessibility: { reduceMotion: null }, userId: String(new mongoose.Types.ObjectId()) }));
  assert.equal(response.status, 400, 'account preference endpoints reject client-selected identity fields');

  const profileSettings = await fetch(`${base}/leaderboard/profile-settings`);
  assert.equal(profileSettings.status, 200);
  const oldProfileUpdate = await putJson('/leaderboard/profile-settings', {
    displayName: 'M28 Updated', avatarMark: 'spark', privacy: {
      publicProfile: true, fullName: true, activityMap: false, personalBest: false, currentRank: false, level: false,
      progressionStats: false, currentStreak: false, longestStreak: false, disciplinePointBalance: false, gracePointBalance: false,
    },
  });
  assert.equal(oldProfileUpdate.response.status, 400, 'the legacy displayName field is rejected by the profile-settings API');
  const profileUpdate = await putJson('/leaderboard/profile-settings', {
    avatarMark: 'spark', privacy: {
      publicProfile: true, fullName: true, activityMap: false, personalBest: false, currentRank: false, level: false,
      progressionStats: false, currentStreak: false, longestStreak: false, disciplinePointBalance: false, gracePointBalance: false,
    },
  });
  assert.equal(profileUpdate.response.status, 200);
  let publicProfile = await getJson(`/leaderboard/profiles/${user.publicHandle}`);
  assert.equal(publicProfile.response.status, 200);
  assert.equal(publicProfile.body.profile.resetCount, 4, 'Reset Count has no privacy toggle');
  assert.equal(publicProfile.body.profile.currentRank, null);
  assert.equal(publicProfile.body.profile.activityMap, null);
  assert.equal(JSON.stringify(publicProfile.body).includes(user.emailNormalized), false);
  assert.equal(JSON.stringify(publicProfile.body).includes(String(user._id)), false);

  const preferencesResponse = await getNotificationPreferences(user._id);
  assert.equal(preferencesResponse.categories.tasks, false, 'M27 notification categories remain in the shared preference store');
  assert.equal(await Notification.countDocuments({ userId: user._id }), 1);

  const preview = await getManualResetPreview(user._id);
  assert.equal(preview.expectedRunNumber, 1);
  await assert.rejects(manualResetAndRestart({ userId: user._id, confirmationPhrase: 'reset', expectedRunNumber: 1, idempotencyKey: 'm28-invalid-phrase' }), /Type RESET/);
  await assert.rejects(manualResetAndRestart({ userId: user._id, confirmationPhrase: 'RESET', expectedRunNumber: 1, idempotencyKey: 'short' }), /Idempotency-Key/);
  const wrongPayload = await fetch(`${base}/account/reset-and-restart`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'm28-api-wrong', 'X-User-Id': String(new mongoose.Types.ObjectId()) }, body: JSON.stringify({ confirmationPhrase: 'NO', expectedRunNumber: 1 }) });
  assert.equal(wrongPayload.status, 400);

  const resetPayload = JSON.stringify({ confirmationPhrase: 'RESET', expectedRunNumber: 1 });
  const idempotencyKey = 'm28-success-reset-key-001';
  const resetResponse = await fetch(`${base}/account/reset-and-restart`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: resetPayload });
  const resetBody = await resetResponse.json();
  assert.equal(resetResponse.status, 200, JSON.stringify(resetBody));
  const { reset } = resetBody;
  assert.equal(reset.idempotentReplay, false);
  assert.equal(reset.currentRank, 'origin');
  assert.equal(reset.level, 0);
  assert.equal(reset.totalXp, 0);
  assert.equal(reset.gracePoints, 3);
  assert.equal(reset.disciplinePoints, 0);
  assert.equal(reset.resetCount, 4);
  assert.equal(reset.requiresScheduleSetup, true);

  const replayResponse = await fetch(`${base}/account/reset-and-restart`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: resetPayload });
  assert.equal(replayResponse.status, 200);
  const replay = (await replayResponse.json()).reset;
  assert.equal(replay.idempotentReplay, true);
  assert.equal(await ProgressionRun.countDocuments({ userId: user._id, status: 'active' }), 1);
  assert.equal(await ProgressionRun.countDocuments({ userId: user._id }), 2);

  const updatedUser = await User.findById(user._id).lean();
  const newRun = await ProgressionRun.findOne({ _id: updatedUser.currentProgressionRunId }).lean();
  assert.equal(updatedUser.createdAt.getTime(), originalCreatedAt);
  assert.equal(updatedUser.memberSince, '2026-01-05');
  assert.equal(updatedUser.resetCount, 4);
  assert.equal(updatedUser.lifetimeLongestStreak, 28);
  assert.equal(updatedUser.username, username);
  assert.equal(updatedUser.avatarMark, 'spark');
  assert.equal(updatedUser.privacy.activityMap, false);
  assert.equal(updatedUser.appearancePreferences.clickRipple, false);
  assert.equal(updatedUser.accessibilityPreferences.reduceMotion, null);
  assert.equal(updatedUser.notificationPreferences.categories.tasks, false);
  assert.equal(updatedUser.highestRankAchieved, null);
  assert.deepEqual(updatedUser.personalBestRecords, { overall: {}, discipline: {}, xp: {} });
  assert.equal(newRun.runNumber, 2);
  assert.equal(newRun.status, 'active');
  assert.equal(newRun.currentRankSlug, 'origin');
  assert.equal(newRun.level, 0);
  assert.equal(Number(newRun.totalXp), 0);
  assert.equal(newRun.gracePoints, 3);
  assert.equal(newRun.disciplinePoints, 0);
  assert.equal(newRun.currentStreak, 0);
  assert.equal(newRun.longestStreak, 0);
  assert.equal(newRun.taskScheduleId, null);
  assert.equal(newRun.dpRedemptionCooldownUntil, null);
  assert.equal(newRun.emergencyPause.active, false);
  assert.equal(newRun.emergencyPause.activationsUsed, 0);
  assert.equal(newRun.rewardCycle.cycleNumber, 1);
  assert.equal(newRun.rewardCycle.qualifiedDays, 0);
  assert.equal(newRun.requiresScheduleSetup, undefined);
  assert.equal(await Task.countDocuments({ userId: user._id, progressionRunId: newRun._id }), 0);
  assert.equal(await TaskOccurrence.countDocuments({ userId: user._id, progressionRunId: newRun._id }), 0);
  assert.equal(await RecoveryQuest.countDocuments({ userId: user._id, progressionRunId: newRun._id }), 0);
  assert.equal(await DailyDisciplineRecord.countDocuments({ userId: user._id, progressionRunId: newRun._id }), 0);
  assert.equal(await GracePointTransaction.countDocuments({ userId: user._id, progressionRunId: newRun._id }), 0);
  assert.equal(await XpTransaction.countDocuments({ userId: user._id, progressionRunId: newRun._id }), 0);
  assert.equal(await DisciplineRewardCycle.countDocuments({ userId: user._id, progressionRunId: newRun._id, status: 'active', completedQualifyingDays: 0 }), 1);
  assert.equal(await TaskSchedule.countDocuments({ _id: schedule._id, status: 'archived', progressionRunId: run._id }), 1);
  assert.equal(await Task.countDocuments({ _id: task._id, progressionRunId: run._id }), 1);
  assert.equal(await TaskOccurrence.countDocuments({ _id: occurrence._id, progressionRunId: run._id }), 1);
  assert.equal((await TaskOccurrence.findById(occurrence._id).lean()).snapshot.accountabilityAction.title, 'Original action');
  const endedQuest = await RecoveryQuest.findById(quest._id).lean();
  const endedPause = await EmergencyPause.findById(pause._id).lean();
  assert.equal(endedQuest.status, 'run-ended', 'the old active Quest is explicitly deactivated by manual reset without becoming an expiry/threshold penalty');
  assert.equal(endedQuest.runEndedAt.getTime(), endedPause.actualEndAt.getTime(), 'the old-run Quest and Pause share the actual reset instant');
  assert.equal(endedQuest.remainingDurationMs, 86_400_000, 'the frozen Recovery Window snapshot remains available in history');
  assert.equal(endedQuest.pausedAt.getTime(), run.emergencyPause.activatedAt.getTime());
  assert.equal(endedPause.status, 'ended');
  assert.equal(endedPause.endReason, 'manual-reset');
  assert.ok(endedPause.actualEndAt);
  assert.equal(await EmergencyPause.countDocuments({ userId: user._id, status: 'active' }), 0);
  assert.equal(await EmergencyPauseMonthlyUsage.findOne({ userId: user._id, monthKey: '2026-11' }).then((item) => item.activationsUsed), 0);
  assert.equal(await MonthlyAnalysisSummary.countDocuments({ userId: user._id, progressionRunId: run._id, monthKey: '2026-10' }), 1);
  assert.equal(await RankEntryEvent.countDocuments({ userId: user._id, progressionRunId: run._id }), 1, 'immutable Rank-entry history remains on the archived run');
  assert.equal(await ProgressionResetEvent.countDocuments({ userId: user._id, reason: 'manual-reset-and-restart' }), 1);
  assert.equal(await Notification.countDocuments({ userId: user._id }), 1, 'manual reset does not delete M27 notification history');
  const { processDueRecoveryQuestExpiry } = await import('../services/recoveryQuestService.js');
  assert.equal((await processDueRecoveryQuestExpiry({ userId: user._id, cutoff: new Date('2026-12-01T00:00:00.000Z') })).processed, false, 'an old-run worker cannot process an ended-run Quest');

  const afterResetSettings = await getAccountSettings(user._id);
  assert.equal(afterResetSettings.progression.currentRank.slug, 'origin');
  assert.deepEqual(afterResetSettings.achievements.rankBadges, ['origin']);
  assert.equal(afterResetSettings.achievements.highestRankAchieved, null);
  assert.deepEqual(afterResetSettings.achievements.personalBestRecords.overall, { bestPosition: null, achievedOn: null });
  publicProfile = await getPublicMemberProfile({ requesterId: String(user._id), publicHandle: 'me', now: new Date('2026-11-19T08:00:00.000Z') });
  assert.equal(publicProfile.resetCount, 4);
  assert.equal(publicProfile.currentRank, null, 'saved privacy continues to control the new run public profile');
  assert.equal((await getEmergencyPauseStatus(user._id, { now: new Date('2026-11-19T08:00:00.000Z') })).activationsUsed, 0);
  assert.equal((await getNotificationPreferences(user._id)).categories.tasks, false);

  const concurrentUser = await User.create({ identityKind: 'account', accountStatus: 'active', memberSince: '2026-11-01' });
  const concurrentRun = await ProgressionRun.create({ userId: concurrentUser._id, runNumber: 1, status: 'active', startedAt, startedOn: '2026-11-01' });
  concurrentUser.currentProgressionRunId = concurrentRun._id;
  await concurrentUser.save();
  const concurrentResults = await Promise.all([1, 2].map(() => manualResetAndRestart({
    userId: concurrentUser._id, confirmationPhrase: 'RESET', expectedRunNumber: 1, idempotencyKey: 'm28-concurrent-reset-key',
  })));
  assert.equal(concurrentResults.filter((item) => !item.idempotentReplay).length, 1);
  assert.equal(await ProgressionRun.countDocuments({ userId: concurrentUser._id, status: 'active' }), 1);
  assert.equal(await ProgressionResetEvent.countDocuments({ userId: concurrentUser._id, reason: 'manual-reset-and-restart' }), 1);
});

test('M28 reset key hashing supports the maximum header length without violating audit schema limits', { skip: !shouldRun, timeout: 120_000 }, async (t) => {
  const isolatedUri = new URL(config.mongoUri);
  isolatedUri.pathname = `/the_system_m28_key_${process.pid}_${Date.now()}`;
  await connectDatabase(isolatedUri.toString());
  assert.equal(mongoose.connection.readyState, 1);
  t.after(async () => { await mongoose.connection.dropDatabase(); await disconnectDatabase(); });
  const user = await User.create({ identityKind: 'account', accountStatus: 'active', memberSince: '2026-11-01' });
  const run = await ProgressionRun.create({ userId: user._id, runNumber: 1, status: 'active', startedAt: new Date('2026-11-01T00:00:00.000Z'), startedOn: '2026-11-01' });
  user.currentProgressionRunId = run._id;
  await user.save();
  const result = await manualResetAndRestart({ userId: user._id, confirmationPhrase: 'RESET', expectedRunNumber: 1, idempotencyKey: 'x'.repeat(160) });
  assert.equal(result.idempotentReplay, false);
  const event = await ProgressionResetEvent.findById(result.resetEventId).lean();
  assert.ok(event.sourceEventKey.length <= 160);
});
