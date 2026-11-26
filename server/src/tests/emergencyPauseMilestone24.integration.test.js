import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import DailyDisciplineRecord from '../models/DailyDisciplineRecord.js';
import DailyXpRecord from '../models/DailyXpRecord.js';
import DisciplineRewardCycle from '../models/DisciplineRewardCycle.js';
import EmergencyPause from '../models/EmergencyPause.js';
import Notification from '../models/Notification.js';
import EmergencyPauseMonthlyUsage from '../models/EmergencyPauseMonthlyUsage.js';
import ProgressionRun from '../models/ProgressionRun.js';
import RecoveryQuest from '../models/RecoveryQuest.js';
import RecoveryQuestDailyReset from '../models/RecoveryQuestDailyReset.js';
import Task from '../models/Task.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import TaskSchedule from '../models/TaskSchedule.js';
import User from '../models/User.js';
import XpTransaction from '../models/XpTransaction.js';
import {
  activateEmergencyPause,
  getEmergencyPauseStatus,
  processEmergencyPauseForUser,
  resumeEmergencyPause,
} from '../services/emergencyPauseService.js';
import { getDisciplineSummary } from '../services/disciplineService.js';
import { completeCurrentRecoveryQuest, processRecoveryQuestDailyReset, processRecoveryQuestWorkerUser } from '../services/recoveryQuestService.js';
import { completeCurrentTaskOccurrence } from '../services/taskOccurrenceService.js';
import { getIstMidnightInstant } from '../utils/ist.js';

const shouldRun = process.env.RUN_MONGO_INTEGRATION === '1';
const userIds = new Set();
const activeIds = (value) => [...value].map((id) => new mongoose.Types.ObjectId(id));

async function createFixture(startDate = '2026-11-19') {
  const userId = new mongoose.Types.ObjectId();
  userIds.add(String(userId));
  const user = await User.create({
    _id: userId,
    identityKind: 'account',
    emailNormalized: `m24-${userId}@example.test`,
    accountStatus: 'active',
    memberSince: startDate,
    resetCount: 0,
    lifetimeLongestStreak: 4,
    highestRankAchieved: null,
  });
  const run = await ProgressionRun.create({
    userId,
    runNumber: 1,
    status: 'active',
    startedAt: getIstMidnightInstant(startDate),
    startedOn: startDate,
    currentRankSlug: 'origin',
    level: 0,
    totalXp: 0,
    gracePoints: 3,
    disciplinePoints: 0,
    currentStreak: 3,
    longestStreak: 4,
    disciplineStartedOn: startDate,
    recoveryQuestLastResetDate: startDate,
    emergencyPause: { active: false, allowanceMonthKey: startDate.slice(0, 7), activationsUsed: 0 },
  });
  await User.updateOne({ _id: userId }, { $set: { currentProgressionRunId: run._id } });
  return { userId, run };
}

async function createQuest({ userId, runId, activatedAt, expiresAt }) {
  return RecoveryQuest.create({
    userId,
    progressionRunId: runId,
    sourceTaskId: new mongoose.Types.ObjectId(),
    sourceOccurrenceId: new mongoose.Types.ObjectId(),
    sourceEventKey: `m24-quest-${new mongoose.Types.ObjectId()}`,
    sourceSnapshot: {
      taskTitle: 'M24 source Task',
      taskDescription: '',
      accountabilityActionTitle: 'M24 action',
      accountabilityActionDescription: 'A test-only action snapshot.',
      taskRevision: 1,
    },
    activatedAt,
    baseExpiresAt: expiresAt,
    expiresAt,
    status: 'active',
  });
}

async function startApiServer(userId) {
  const app = createApp({
    nodeEnv: 'test',
    databaseReady: () => mongoose.connection.readyState === 1,
    corsOrigins: [],
    testIdentityMiddleware: (request, _response, next) => {
      request.user = { id: String(userId), identityKind: 'development-seed' };
      next();
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  return { server, base: `http://127.0.0.1:${server.address().port}/api/v1` };
}

test('M24 Emergency Pause is transactional across API activation, Quest freeze, resume, allowance, and IST rollover', { skip: !shouldRun, timeout: 120_000 }, async (t) => {
  const isolatedUri = new URL(config.mongoUri);
  isolatedUri.pathname = `/the_system_m24_${process.pid}_${Date.now()}`;
  await connectDatabase(isolatedUri.toString());
  t.after(async () => {
    const ids = activeIds(userIds);
    try {
      await Promise.all([
        EmergencyPause.deleteMany({ userId: { $in: ids } }),
        EmergencyPauseMonthlyUsage.deleteMany({ userId: { $in: ids } }),
        RecoveryQuest.deleteMany({ userId: { $in: ids } }),
        RecoveryQuestDailyReset.deleteMany({ userId: { $in: ids } }),
        XpTransaction.deleteMany({ userId: { $in: ids } }),
        TaskOccurrence.deleteMany({ userId: { $in: ids } }),
        TaskSchedule.deleteMany({ userId: { $in: ids } }),
        Task.deleteMany({ userId: { $in: ids } }),
        DailyDisciplineRecord.deleteMany({ userId: { $in: ids } }),
        DisciplineRewardCycle.deleteMany({ userId: { $in: ids } }),
        DailyXpRecord.deleteMany({ userId: { $in: ids } }),
        ProgressionRun.deleteMany({ userId: { $in: ids } }),
        User.deleteMany({ _id: { $in: ids } }),
      ]);
    } finally {
      try { await mongoose.connection.dropDatabase(); } finally { await disconnectDatabase(); }
    }
  });
  await Promise.all([EmergencyPause.init(), EmergencyPauseMonthlyUsage.init()]);

  const start = new Date('2026-11-19T03:15:00.000Z');
  const fixture = await createFixture('2026-11-19');
  const cycleBeforePause = (await getDisciplineSummary(fixture.userId, { now: start })).activeRewardCycle;
  assert.equal(cycleBeforePause.calendarDaysRemaining, 30);
  const baselineBeforePause = cycleBeforePause.baselineTargetAt;
  await DisciplineRewardCycle.updateOne({ _id: cycleBeforePause.id }, { $set: { completedQualifyingDays: 12 } });
  await ProgressionRun.updateOne({ _id: fixture.run._id }, { $set: { 'rewardCycle.qualifiedDays': 12 } });
  const schedule = await TaskSchedule.create({
    userId: fixture.userId,
    progressionRunId: fixture.run._id,
    cycleLength: 1,
    cycleAnchorDate: '2026-11-19',
    status: 'active',
    version: 1,
    effectiveStartDate: '2026-11-19',
    idempotencyKey: 'm24-task-schedule-0001',
  });
  const task = await Task.create({
    userId: fixture.userId,
    progressionRunId: fixture.run._id,
    taskScheduleId: schedule._id,
    title: 'Pause regression Task',
    cycleDays: [1],
    accountabilityAction: { title: 'Pause action', description: 'Test action.' },
    revision: 1,
    status: 'active',
    effectiveDate: '2026-11-19',
    createdEffectiveDate: '2026-11-19',
  });
  const occurrence = await TaskOccurrence.create({
    userId: fixture.userId,
    progressionRunId: fixture.run._id,
    taskId: task._id,
    taskScheduleId: schedule._id,
    occurrenceDate: '2026-11-19',
    cycleDay: 1,
    snapshot: { title: task.title, description: '', accountabilityAction: task.accountabilityAction.toObject(), revision: 1 },
    status: 'scheduled',
  });
  await ProgressionRun.updateOne({ _id: fixture.run._id }, { $set: { taskScheduleId: schedule._id } });
  const quest = await createQuest({
    userId: fixture.userId,
    runId: fixture.run._id,
    activatedAt: start,
    expiresAt: new Date(start.getTime() + 30 * 60 * 60 * 1000),
  });
  for (let index = 0; index < 4; index += 1) {
    await createQuest({
      userId: fixture.userId,
      runId: fixture.run._id,
      activatedAt: start,
      expiresAt: new Date(start.getTime() + (36 + index) * 60 * 60 * 1000),
    });
  }
  const { server, base } = await startApiServer(fixture.userId);

  try {
    const invalidDuration = await fetch(`${base}/emergency-pause/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'm24-invalid-duration-1' },
      body: JSON.stringify({ durationDays: 8 }),
    });
    assert.equal(invalidDuration.status, 400);

    const activated = await activateEmergencyPause({
      userId: fixture.userId,
      durationDays: 1,
      idempotencyKey: 'm24-activate-first-0001',
      now: start,
    });
    assert.equal(activated.isActive, true);
    assert.equal(activated.activationsUsed, 1);
    assert.equal(activated.activationsRemaining, 9);
    assert.equal(await Notification.countDocuments({ userId: fixture.userId, eventType: 'emergency-pause-activated' }), 1);
    assert.equal(activated.pause.recoveryQuestSnapshots.length, 5);
    const remainingByQuest = new Map(activated.pause.recoveryQuestSnapshots.map((snapshot) => [snapshot.questId, snapshot.remainingDurationMs]));
    assert.equal(remainingByQuest.get(String(quest._id)), 30 * 60 * 60 * 1000);
    assert.deepEqual([...remainingByQuest.values()].sort((left, right) => left - right), [30, 36, 37, 38, 39].map((hours) => hours * 60 * 60 * 1000));

    const replay = await activateEmergencyPause({
      userId: fixture.userId,
      durationDays: 1,
      idempotencyKey: 'm24-activate-first-0001',
      now: new Date(start.getTime() + 2 * 60_000),
    });
    assert.equal(replay.idempotentReplay, true);
    assert.equal(replay.activationsUsed, 1);

    const clientAuthority = await fetch(`${base}/emergency-pause/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'm24-client-fields-0001' },
      body: JSON.stringify({ durationDays: 1, userId: 'another-user', startedAt: '2020-01-01T00:00:00.000Z' }),
    });
    assert.equal(clientAuthority.status, 400);
    const statusResponse = await fetch(`${base}/emergency-pause`);
    assert.equal(statusResponse.status, 200);
    assert.equal((await statusResponse.json()).allowance, 2);

    await assert.rejects(completeCurrentRecoveryQuest({ userId: fixture.userId, questId: quest._id, now: start }), (error) => error.code === 'EMERGENCY_PAUSE_ACTIVE');
    await assert.rejects(completeCurrentTaskOccurrence({ userId: fixture.userId, occurrenceId: occurrence._id, submission: { note: '', fileName: '' }, idempotencyKey: 'm24-task-complete-0001', now: start }), (error) => error.code === 'EMERGENCY_PAUSE_ACTIVE');

    const pausedResetAt = getIstMidnightInstant('2026-11-20');
    const reset = await processRecoveryQuestDailyReset({ userId: fixture.userId, resetDate: '2026-11-20', now: new Date(pausedResetAt.getTime() + 15 * 60_000) });
    assert.equal(reset.paused, true);
    const pausedDaily = await RecoveryQuestDailyReset.findOne({ userId: fixture.userId, date: '2026-11-20' });
    assert.equal(pausedDaily.status, 'skipped-emergency-pause');
    assert.equal(pausedDaily.protectedTaskDate, true);
    assert.equal(await RecoveryQuest.countDocuments({ userId: fixture.userId, progressionRunId: fixture.run._id, status: 'active' }), 5, 'Protected missed Tasks cannot generate a sixth Quest or trigger threshold clearing.');
    assert.equal((await ProgressionRun.findById(fixture.run._id)).gracePoints, 3);
    assert.equal(await XpTransaction.countDocuments({ userId: fixture.userId }), 0);
    const cycleDuringPause = (await getDisciplineSummary(fixture.userId, { now: new Date(pausedResetAt.getTime() + 15 * 60_000) })).activeRewardCycle;
    assert.equal(cycleDuringPause.calendarDaysRemaining, 29, 'Calendar countdown advances across IST midnight while Pause is active.');
    assert.equal(cycleDuringPause.completedQualifyingDays, 12, 'Pause preserves already-earned qualified-day progress.');
    assert.equal(cycleDuringPause.baselineTargetAt, baselineBeforePause, 'Pause does not move the saved target.');
    const protectedDiscipline = await DailyDisciplineRecord.findOne({ userId: fixture.userId, date: '2026-11-19' });
    assert.equal(protectedDiscipline.qualificationStatus, 'emergency-pause-protected');
    assert.equal(protectedDiscipline.currentStreakAfter, 3);
    assert.equal(protectedDiscipline.rewardCycleProgressAfter, protectedDiscipline.rewardCycleProgressBefore);
    assert.equal(protectedDiscipline.rewardCycleProgressBefore, 12, 'Existing qualified-day progress enters the protected date unchanged.');

    const earlyResumeAt = new Date('2026-11-19T20:00:00.000Z');
    const resumed = await resumeEmergencyPause({ userId: fixture.userId, idempotencyKey: 'm24-resume-first-0001', now: earlyResumeAt });
    assert.equal(resumed.isActive, false);
    assert.equal(resumed.activationsUsed, 1);
    const resumedReplay = await resumeEmergencyPause({ userId: fixture.userId, idempotencyKey: 'm24-resume-first-0001', now: new Date(earlyResumeAt.getTime() + 30_000) });
    assert.equal(resumedReplay.idempotentReplay, true);
    assert.equal(resumedReplay.activationsUsed, 1);
    const restoredQuest = await RecoveryQuest.findById(quest._id);
    assert.equal(restoredQuest.remainingDurationMs, null);
    assert.equal(restoredQuest.expiresAt.getTime(), earlyResumeAt.getTime() + 30 * 60 * 60 * 1000);
    const endedRecord = await EmergencyPause.findOne({ userId: fixture.userId, idempotencyKey: 'm24-activate-first-0001' });
    assert.equal(endedRecord.endReason, 'early-resume');
    assert.equal(endedRecord.actualEndAt.getTime(), earlyResumeAt.getTime());
    assert.equal(await Notification.countDocuments({ userId: fixture.userId, eventType: 'emergency-pause-resumed-early' }), 1);
    const cycleAfterEarlyResume = (await getDisciplineSummary(fixture.userId, { now: earlyResumeAt })).activeRewardCycle;
    assert.equal(cycleAfterEarlyResume.baselineTargetAt, baselineBeforePause, 'Early resume does not restart or extend the target.');

    await activateEmergencyPause({ userId: fixture.userId, durationDays: 1, idempotencyKey: 'm24-activate-second-0001', now: new Date(earlyResumeAt.getTime() + 60_000) });
    await resumeEmergencyPause({ userId: fixture.userId, idempotencyKey: 'm24-resume-second-0001', now: new Date(earlyResumeAt.getTime() + 120_000) });
    assert.equal((await getEmergencyPauseStatus(fixture.userId, { now: new Date(earlyResumeAt.getTime() + 180_000) })).activationsUsed, 2);
    await ProgressionRun.updateOne({ _id: fixture.run._id }, { $set: { 'emergencyPause.allowanceMonthKey': '2026-11', 'emergencyPause.activationsUsed': 0 } });
    assert.equal((await getEmergencyPauseStatus(fixture.userId, { now: new Date(earlyResumeAt.getTime() + 180_000) })).activationsUsed, 2);
    assert.equal((await ProgressionRun.findById(fixture.run._id)).emergencyPause.activationsUsed, 2, 'The member-scoped month ledger repairs a stale run allowance mirror.');
    const allowanceLimitAt = new Date(earlyResumeAt.getTime() + 3 * 60_000);
    const exhaustedStatus = await getEmergencyPauseStatus(fixture.userId, { now: allowanceLimitAt });
    assert.equal(exhaustedStatus.activationsUsed, 2);
    assert.equal(exhaustedStatus.activationsRemaining, 0);
    await assert.rejects(activateEmergencyPause({ userId: fixture.userId, durationDays: 1, idempotencyKey: 'm24-activate-third-0001', now: allowanceLimitAt }), (error) => error.code === 'EMERGENCY_PAUSE_MONTHLY_LIMIT');

    const workerFixture = await createFixture('2026-11-18');
    const workerCycleBaseline = (await getDisciplineSummary(workerFixture.userId, { now: getIstMidnightInstant('2026-11-18') })).activeRewardCycle.baselineTargetAt;
    await ProgressionRun.updateOne({ _id: workerFixture.run._id }, { $set: { level: 1, totalXp: 100 } });
    const workerPauseStart = new Date(getIstMidnightInstant('2026-11-18').getTime() + 12 * 60 * 60 * 1000);
    const workerQuest = await createQuest({
      userId: workerFixture.userId,
      runId: workerFixture.run._id,
      activatedAt: workerPauseStart,
      expiresAt: new Date(workerPauseStart.getTime() + 30 * 60 * 60 * 1000),
    });
    await activateEmergencyPause({ userId: workerFixture.userId, durationDays: 1, idempotencyKey: 'm24-worker-pause-0001', now: workerPauseStart });
    const workerNow = new Date(workerPauseStart.getTime() + 48 * 60 * 60 * 1000);
    const workerResult = await processRecoveryQuestWorkerUser({ userId: workerFixture.userId, now: workerNow });
    assert.equal(workerResult.processed, 2, 'Worker catch-up finalizes the paused reset and then the next eligible reset.');
    const workerPauseRecord = await EmergencyPause.findOne({ userId: workerFixture.userId, idempotencyKey: 'm24-worker-pause-0001' });
    assert.equal(await Notification.countDocuments({ userId: workerFixture.userId, eventType: 'emergency-pause-automatically-resumed' }), 1);
    assert.equal(await Notification.countDocuments({ userId: workerFixture.userId, idempotencyKey: `emergency-pause-ended:${workerPauseRecord._id}` }), 1,
      'Automatic resume retries do not duplicate the notification.');
    const pausedDateReset = await RecoveryQuestDailyReset.findOne({ userId: workerFixture.userId, date: '2026-11-19' });
    assert.equal(pausedDateReset.status, 'skipped-emergency-pause');
    assert.equal(pausedDateReset.protectedTaskDate, true);
    const resumedDateReset = await RecoveryQuestDailyReset.findOne({ userId: workerFixture.userId, date: '2026-11-20' });
    assert.equal(resumedDateReset.status, 'completed');
    assert.equal(resumedDateReset.activeQuestCount, 1);
    const workerDrain = await XpTransaction.findOne({ userId: workerFixture.userId, businessDate: '2026-11-20' });
    assert.equal(workerDrain.amount.toString(), '-7.35', 'No paused-day catch-up drain occurs; the normal drain resumes at the next eligible reset.');
    const preservedWorkerQuest = await RecoveryQuest.findById(workerQuest._id);
    assert.equal(preservedWorkerQuest.expiresAt.getTime(), workerPauseStart.getTime() + 24 * 60 * 60 * 1000 + 30 * 60 * 60 * 1000);
    assert.equal(preservedWorkerQuest.status, 'active');
    assert.equal((await getDisciplineSummary(workerFixture.userId, { now: workerNow })).activeRewardCycle.baselineTargetAt, workerCycleBaseline, 'Automatic resume preserves the target.');

    const rolloverFixture = await createFixture('2026-11-30');
    const beforeBoundary = new Date('2026-11-30T18:00:00.000Z'); // 23:30 IST on 30 November.
    const rolloverCycleBaseline = (await getDisciplineSummary(rolloverFixture.userId, { now: beforeBoundary })).activeRewardCycle.baselineTargetAt;
    const rolloverActivation = await activateEmergencyPause({ userId: rolloverFixture.userId, durationDays: 7, idempotencyKey: 'm24-rollover-activate-0001', now: beforeBoundary });
    const boundary = getIstMidnightInstant('2026-12-01');
    assert.equal(rolloverActivation.pause.effectiveEndAt, boundary.toISOString());
    assert.equal(rolloverActivation.pause.durationDays, 7);
    const automatic = await processEmergencyPauseForUser({ userId: rolloverFixture.userId, now: new Date(boundary.getTime() + 3 * 60 * 60 * 1000) });
    assert.equal(automatic.processed, true);
    assert.equal((await processEmergencyPauseForUser({ userId: rolloverFixture.userId, now: new Date(boundary.getTime() + 4 * 60 * 60 * 1000) })).processed, false);
    const rolloverRecord = await EmergencyPause.findOne({ userId: rolloverFixture.userId });
    assert.equal(rolloverRecord.endReason, 'monthly-boundary');
    assert.equal(rolloverRecord.actualEndAt.getTime(), boundary.getTime());
    assert.equal((await EmergencyPauseMonthlyUsage.findOne({ userId: rolloverFixture.userId, monthKey: '2026-11' })).activationsUsed, 1);
    assert.equal((await getEmergencyPauseStatus(rolloverFixture.userId, { now: new Date(boundary.getTime() + 4 * 60 * 60 * 1000) })).activationsUsed, 0);
    assert.equal((await getDisciplineSummary(rolloverFixture.userId, { now: new Date(boundary.getTime() + 4 * 60 * 60 * 1000) })).activeRewardCycle.baselineTargetAt, rolloverCycleBaseline, 'Monthly-boundary resume preserves the same baseline.');

    const raceFixture = await createFixture('2026-11-19');
    await activateEmergencyPause({ userId: raceFixture.userId, durationDays: 1, idempotencyKey: 'm24-race-first-0001', now: start });
    await resumeEmergencyPause({ userId: raceFixture.userId, idempotencyKey: 'm24-race-resume-001', now: new Date(start.getTime() + 60_000) });
    const concurrent = await Promise.allSettled([
      activateEmergencyPause({ userId: raceFixture.userId, durationDays: 1, idempotencyKey: 'm24-race-second-001', now: new Date(start.getTime() + 120_000) }),
      activateEmergencyPause({ userId: raceFixture.userId, durationDays: 1, idempotencyKey: 'm24-race-third-001', now: new Date(start.getTime() + 120_000) }),
    ]);
    assert.equal(concurrent.filter((item) => item.status === 'fulfilled').length, 1);
    const raceUsage = await EmergencyPauseMonthlyUsage.findOne({ userId: raceFixture.userId, monthKey: '2026-11' });
    assert.equal(raceUsage.activationsUsed, 2);
    assert.equal(await EmergencyPause.countDocuments({ userId: raceFixture.userId, status: 'active' }), 1);

    const apiFixture = await createFixture('2026-11-19');
    const api = await startApiServer(apiFixture.userId);
    try {
      const apiActivation = await fetch(`${api.base}/emergency-pause/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'm24-api-activate-0001' },
        body: JSON.stringify({ durationDays: 7 }),
      });
      assert.equal(apiActivation.status, 201);
      assert.equal((await apiActivation.json()).activationsUsed, 1);
      const apiResume = await fetch(`${api.base}/emergency-pause/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'm24-api-resume-0001' },
        body: JSON.stringify({}),
      });
      assert.equal(apiResume.status, 200);
      const apiResumeData = await apiResume.json();
      assert.equal(apiResumeData.isActive, false);
      assert.equal(apiResumeData.activationsUsed, 1);
    } finally {
      await new Promise((resolve) => api.server.close(resolve));
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
