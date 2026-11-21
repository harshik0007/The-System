import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import DailyDisciplineRecord from '../models/DailyDisciplineRecord.js';
import DisciplinePointTransaction from '../models/DisciplinePointTransaction.js';
import DisciplineRewardCycle from '../models/DisciplineRewardCycle.js';
import GracePointTransaction from '../models/GracePointTransaction.js';
import Notification from '../models/Notification.js';
import ProgressionRun from '../models/ProgressionRun.js';
import RecoveryQuestDailyReset from '../models/RecoveryQuestDailyReset.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import TaskSchedule from '../models/TaskSchedule.js';
import User from '../models/User.js';
import { getDisciplineSummary, initializeDisciplineProgressionWithinSession, finalizeDailyDisciplineWithinSession, redeemDisciplinePointForGracePoint } from '../services/disciplineService.js';
import { processRecoveryQuestDailyReset } from '../services/recoveryQuestService.js';
import { withMongoTransaction } from '../services/mongoTransaction.js';
import { addIstCalendarDays, getIstMidnightInstant } from '../utils/ist.js';

const shouldRun = process.env.RUN_MONGO_INTEGRATION === '1';
const disposableUserIds = new Set();

async function createFixture({ startDate = '2026-06-10', level = 0, currentRankSlug = 'origin', disciplinePoints = 0, gracePoints = 3, currentStreak = 0, longestStreak = 0, lifetimeLongestStreak = 0 } = {}) {
  const userId = new mongoose.Types.ObjectId();
  disposableUserIds.add(String(userId));
  const runId = new mongoose.Types.ObjectId();
  const user = await User.create({
    _id: userId,
    identityKind: 'account',
    emailNormalized: `m23-${userId}@example.test`,
    accountStatus: 'active',
    memberSince: startDate,
    currentProgressionRunId: runId,
    lifetimeLongestStreak,
  });
  const run = await ProgressionRun.create({
    _id: runId,
    userId,
    runNumber: 1,
    status: 'active',
    startedAt: getIstMidnightInstant(startDate),
    startedOn: startDate,
    disciplineStartedOn: startDate,
    currentRankSlug,
    level,
    totalXp: 0,
    gracePoints,
    disciplinePoints,
    currentStreak,
    longestStreak,
    recoveryQuestLastResetDate: startDate,
  });
  return { userId, user, run, startDate };
}

async function createOccurrences(fixture, date, count, completedCount = count, { statusFor = null, duplicateOf = null } = {}) {
  const scheduleId = fixture.run.taskScheduleId || new mongoose.Types.ObjectId();
  const taskIds = Array.from({ length: count }, (_, index) => new mongoose.Types.ObjectId());
  const docs = taskIds.map((taskId, index) => ({
    userId: fixture.userId,
    progressionRunId: fixture.run._id,
    taskId,
    taskScheduleId: scheduleId,
    occurrenceDate: date,
    cycleDay: 1,
    snapshot: {
      title: `Integration Task ${index + 1}`,
      description: '',
      accountabilityAction: { title: `Action ${index + 1}`, description: 'Complete the scheduled action.', weakness: '' },
      revision: 1,
    },
    status: statusFor ? statusFor(index) : index < completedCount ? 'completed' : 'scheduled',
    completedAt: index < completedCount ? getIstMidnightInstant(date) : null,
  }));
  if (duplicateOf !== null) docs.push({ ...docs[duplicateOf], _id: new mongoose.Types.ObjectId() });
  return TaskOccurrence.create(docs);
}

async function finalize(fixture, date, protectedByEmergencyPause = false) {
  return withMongoTransaction(async (session) => {
    const run = await ProgressionRun.findOne({ _id: fixture.run._id, userId: fixture.userId, status: 'active' }).session(session);
    return finalizeDailyDisciplineWithinSession({
      userId: fixture.userId,
      run,
      date,
      finalizedAt: getIstMidnightInstant(addIstCalendarDays(date, 1)),
      protectedByEmergencyPause,
      session,
    });
  });
}

async function cleanup() {
  const userIds = [...disposableUserIds].map((id) => new mongoose.Types.ObjectId(id));
  if (!userIds.length) return;
  await Promise.all([
    DailyDisciplineRecord.deleteMany({ userId: { $in: userIds } }),
    DisciplinePointTransaction.deleteMany({ userId: { $in: userIds } }),
    DisciplineRewardCycle.deleteMany({ userId: { $in: userIds } }),
    GracePointTransaction.deleteMany({ userId: { $in: userIds } }),
    RecoveryQuestDailyReset.deleteMany({ userId: { $in: userIds } }),
    TaskOccurrence.deleteMany({ userId: { $in: userIds } }),
    TaskSchedule.deleteMany({ userId: { $in: userIds } }),
    ProgressionRun.deleteMany({ userId: { $in: userIds } }),
    User.deleteMany({ _id: { $in: userIds } }),
  ]);
  disposableUserIds.clear();
}

test('M23 Discipline finalization, cycles, DP wallet/redemption and daily reset integration use disposable replica-set data', { skip: !shouldRun, timeout: 120_000 }, async (t) => {
  await connectDatabase();
  t.after(async () => {
    await cleanup();
    await disconnectDatabase();
  });
  assert.equal(mongoose.connection.readyState, 1, 'A real MongoDB replica set connection is required.');

  // The existing daily orchestrator finalizes the preceding IST date after
  // occurrence processing, and retrying the reset cannot award a second day.
  const workerFixture = await createFixture({ startDate: '2026-06-10' });
  const schedule = await TaskSchedule.create({
    userId: workerFixture.userId,
    progressionRunId: workerFixture.run._id,
    cycleLength: 1,
    cycleAnchorDate: workerFixture.startDate,
    status: 'active',
    version: 1,
    effectiveStartDate: workerFixture.startDate,
    idempotencyKey: `m23-schedule-${workerFixture.userId}`,
  });
  workerFixture.run.taskScheduleId = schedule._id;
  await workerFixture.run.save();
  await createOccurrences(workerFixture, workerFixture.startDate, 7, 5, { statusFor: (index) => index < 5 ? 'completed' : 'missed' });
  const resetDate = addIstCalendarDays(workerFixture.startDate, 1);
  const resetNow = new Date(getIstMidnightInstant(resetDate).getTime() + 1);
  const firstReset = await processRecoveryQuestDailyReset({ userId: workerFixture.userId, resetDate, now: resetNow });
  assert.equal(firstReset.disciplineRecord.qualificationStatus, 'qualified');
  assert.equal(firstReset.disciplineRecord.completedOriginalTaskCount, 5);
  const repeatedReset = await processRecoveryQuestDailyReset({ userId: workerFixture.userId, resetDate, now: resetNow });
  assert.equal(repeatedReset.disciplineRecord.qualificationStatus, 'qualified');
  assert.equal(await DailyDisciplineRecord.countDocuments({ userId: workerFixture.userId, progressionRunId: workerFixture.run._id, date: workerFixture.startDate }), 1);
  assert.equal((await ProgressionRun.findById(workerFixture.run._id)).currentStreak, 1);

  // Boundary completion counts and streak behavior come only from persisted
  // original TaskOccurrence rows; an unqualified day breaks streak but not the
  // accumulated qualifying-day count for the recurring reward cycle.
  const dailyFixture = await createFixture({ startDate: '2026-07-01' });
  const completionCounts = [0, 1, 4, 5, 6, 7, 10];
  let date = dailyFixture.startDate;
  for (const completedCount of completionCounts) {
    await createOccurrences(dailyFixture, date, 10, completedCount);
    const result = await finalize(dailyFixture, date);
    assert.equal(result.record.completedOriginalTaskCount, completedCount);
    assert.equal(result.record.qualificationStatus, completedCount >= 5 ? 'qualified' : 'not-qualified');
    date = addIstCalendarDays(date, 1);
  }
  let dailyRun = await ProgressionRun.findById(dailyFixture.run._id);
  let dailyUser = await User.findById(dailyFixture.userId);
  assert.equal(dailyRun.currentStreak, 4);
  assert.equal(dailyRun.longestStreak, 4);
  assert.equal(dailyUser.lifetimeLongestStreak, 4);
  assert.equal(dailyRun.rewardCycle.qualifiedDays, 4);
  assert.ok(await Notification.exists({ userId: dailyFixture.userId, eventType: 'discipline-day-qualified' }));
  assert.ok(await Notification.exists({ userId: dailyFixture.userId, eventType: 'discipline-day-not-qualified' }));
  await createOccurrences(dailyFixture, date, 10, 10);
  const paused = await finalize(dailyFixture, date, true);
  assert.equal(paused.record.qualificationStatus, 'emergency-pause-protected');
  dailyRun = await ProgressionRun.findById(dailyFixture.run._id);
  assert.equal(dailyRun.currentStreak, 4);
  assert.equal(dailyRun.rewardCycle.qualifiedDays, 4);
  date = addIstCalendarDays(date, 1);
  await createOccurrences(dailyFixture, date, 10, 4);
  await finalize(dailyFixture, date);
  dailyRun = await ProgressionRun.findById(dailyFixture.run._id);
  dailyUser = await User.findById(dailyFixture.userId);
  assert.equal(dailyRun.currentStreak, 0);
  assert.equal(dailyRun.longestStreak, 4);
  assert.equal(dailyUser.lifetimeLongestStreak, 4);
  assert.equal(dailyRun.rewardCycle.qualifiedDays, 4);
  const duplicateDate = addIstCalendarDays(date, 1);
  await createOccurrences(dailyFixture, duplicateDate, 10, 5);
  assert.equal((await finalize(dailyFixture, duplicateDate)).duplicate, false);
  assert.equal((await finalize(dailyFixture, duplicateDate)).duplicate, true);
  assert.equal((await ProgressionRun.findById(dailyFixture.run._id)).currentStreak, 1);

  // A cycle keeps its start Rank through a Rank-up, awards once, respects the
  // four-DP cap, and opens the next cycle using the Rank then held.
  const cycleFixture = await createFixture({ startDate: '2026-08-01', disciplinePoints: 3.8 });
  await withMongoTransaction(async (session) => initializeDisciplineProgressionWithinSession({
    userId: cycleFixture.userId,
    run: await ProgressionRun.findById(cycleFixture.run._id).session(session),
    activationDate: cycleFixture.startDate,
    session,
  }));
  let cycleDate = cycleFixture.startDate;
  for (let index = 0; index < 30; index += 1) {
    await createOccurrences(cycleFixture, cycleDate, 5, 5);
    await finalize(cycleFixture, cycleDate);
    if (index === 0) {
      await ProgressionRun.updateOne({ _id: cycleFixture.run._id }, { $set: { level: 10, currentRankSlug: 'ember' } });
    }
    cycleDate = addIstCalendarDays(cycleDate, 1);
  }
  const cyclesAfterOrigin = await DisciplineRewardCycle.find({ userId: cycleFixture.userId, progressionRunId: cycleFixture.run._id }).sort({ cycleNumber: 1 });
  assert.equal(cyclesAfterOrigin.length, 2);
  assert.equal(cyclesAfterOrigin[0].rankSlug, 'origin');
  assert.equal(cyclesAfterOrigin[0].requiredQualifyingDays, 30);
  assert.equal(cyclesAfterOrigin[0].actualCreditedCents, 20, 'Only the remaining wallet capacity is credited.');
  assert.equal(cyclesAfterOrigin[1].rankSlug, 'ember');
  assert.equal(cyclesAfterOrigin[1].requiredQualifyingDays, 35);
  assert.equal(cyclesAfterOrigin[1].rewardAmountCents, 40);
  assert.equal((await ProgressionRun.findById(cycleFixture.run._id)).disciplinePoints, 4);
  assert.equal(await DisciplinePointTransaction.countDocuments({ userId: cycleFixture.userId, progressionRunId: cycleFixture.run._id, sourceEventKey: `discipline-cycle-reward:${cycleFixture.run._id}:1` }), 1);

  // Initial persisted cycle snapshots use the approved Rank requirements and
  // rewards for every Rank, not a client-side preview table.
  const rankCycleCases = [
    ['origin', 0, 30, 25],
    ['ember', 10, 35, 40],
    ['surge', 20, 40, 50],
    ['vector', 35, 45, 60],
    ['apex', 50, 50, 70],
    ['zenith', 75, 55, 80],
    ['continuum', 100, 60, 90],
  ];
  for (const [rankSlug, level, qualifyingDays, rewardCents] of rankCycleCases) {
    const rankFixture = await createFixture({ startDate: '2026-08-01', level, currentRankSlug: rankSlug });
    await withMongoTransaction(async (session) => initializeDisciplineProgressionWithinSession({
      userId: rankFixture.userId,
      run: await ProgressionRun.findById(rankFixture.run._id).session(session),
      activationDate: rankFixture.startDate,
      session,
    }));
    const storedCycle = await DisciplineRewardCycle.findOne({ userId: rankFixture.userId, progressionRunId: rankFixture.run._id, status: 'active' });
    assert.equal(storedCycle.rankSlug, rankSlug);
    assert.equal(storedCycle.requiredQualifyingDays, qualifyingDays);
    assert.equal(storedCycle.rewardAmountCents, rewardCents);
  }

  // Reaching the calendar target never completes a cycle by itself. Only the
  // final genuinely finalized qualifying date credits the snapshotted reward.
  const awaitingFixture = await createFixture({ startDate: '2026-06-01' });
  await withMongoTransaction(async (session) => initializeDisciplineProgressionWithinSession({
    userId: awaitingFixture.userId,
    run: await ProgressionRun.findById(awaitingFixture.run._id).session(session),
    activationDate: awaitingFixture.startDate,
    session,
  }));
  const awaitingCycle = await DisciplineRewardCycle.findOne({ userId: awaitingFixture.userId, progressionRunId: awaitingFixture.run._id, status: 'active' });
  assert.equal(awaitingCycle.cycleStartedAt.toISOString(), getIstMidnightInstant('2026-06-01').toISOString());
  assert.equal(awaitingCycle.baselineTargetDate, '2026-07-01');
  assert.equal(awaitingCycle.baselineTargetAt.toISOString(), getIstMidnightInstant('2026-07-01').toISOString());
  await DisciplineRewardCycle.updateOne({ _id: awaitingCycle._id }, {
    $set: { completedQualifyingDays: 29 },
    $unset: { cycleStartedAt: 1, baselineTargetDate: 1, baselineTargetAt: 1 },
  });
  await ProgressionRun.updateOne({ _id: awaitingFixture.run._id }, { $set: { 'rewardCycle.qualifiedDays': 29 } });
  const atBaseline = await getDisciplineSummary(awaitingFixture.userId, { now: getIstMidnightInstant('2026-07-01') });
  assert.equal(atBaseline.activeRewardCycle.calendarDaysRemaining, 0);
  assert.equal(atBaseline.activeRewardCycle.calendarStatus, 'awaiting-qualification');
  assert.equal(atBaseline.activeRewardCycle.remainingQualifyingDays, 1);
  const migratedAwaitingCycle = await DisciplineRewardCycle.findById(awaitingCycle._id);
  assert.equal(migratedAwaitingCycle.cycleStartedAt.toISOString(), getIstMidnightInstant('2026-06-01').toISOString());
  assert.equal(migratedAwaitingCycle.baselineTargetDate, '2026-07-01');
  assert.equal(migratedAwaitingCycle.completedQualifyingDays, 29, 'Lazy migration preserves earned progress.');
  assert.equal(migratedAwaitingCycle.rankSlug, 'origin');
  assert.equal(migratedAwaitingCycle.requiredQualifyingDays, 30);
  assert.equal(migratedAwaitingCycle.rewardAmountCents, 25);
  assert.equal(await DisciplineRewardCycle.countDocuments({ userId: awaitingFixture.userId, progressionRunId: awaitingFixture.run._id, status: 'active' }), 1);
  assert.equal(await DisciplinePointTransaction.countDocuments({ userId: awaitingFixture.userId, progressionRunId: awaitingFixture.run._id, type: 'recurring-discipline-cycle' }), 0);

  await createOccurrences(awaitingFixture, '2026-07-01', 7, 5);
  const completedAtTarget = await finalize(awaitingFixture, '2026-07-01');
  assert.equal(completedAtTarget.cycleReward.configuredRewardCents, 25);
  const awaitingCyclesAfterReward = await DisciplineRewardCycle.find({ userId: awaitingFixture.userId, progressionRunId: awaitingFixture.run._id }).sort({ cycleNumber: 1 });
  assert.equal(awaitingCyclesAfterReward[0].status, 'completed');
  assert.equal(awaitingCyclesAfterReward[0].completedQualifyingDays, 30);
  assert.equal(awaitingCyclesAfterReward[0].actualCreditedCents, 25);
  assert.equal(awaitingCyclesAfterReward[1].status, 'active');
  assert.equal(awaitingCyclesAfterReward[1].startDate, '2026-07-02');
  assert.equal(awaitingCyclesAfterReward[1].baselineTargetDate, '2026-08-01');
  assert.equal(await DisciplinePointTransaction.countDocuments({ userId: awaitingFixture.userId, progressionRunId: awaitingFixture.run._id, type: 'recurring-discipline-cycle' }), 1);
  assert.equal(await Notification.countDocuments({ userId: awaitingFixture.userId, eventType: 'discipline-cycle-reward-credited' }), 1);

  // A 1:1 redemption commits both ledgers together, retries idempotently, and
  // only becomes available at the exact end of the rolling 72-hour window.
  const redemptionFixture = await createFixture({ startDate: '2026-09-01', disciplinePoints: 2, gracePoints: 2 });
  const redemptionNow = new Date('2026-09-01T04:00:00.000Z');
  const redemptionKey = `m23-redemption-${redemptionFixture.userId}`;
  const redeemed = await redeemDisciplinePointForGracePoint({ userId: redemptionFixture.userId, idempotencyKey: redemptionKey, now: redemptionNow });
  assert.equal(redeemed.disciplinePointBalance, '1.00');
  assert.equal(redeemed.gracePointBalance, 3);
  assert.equal(redeemed.availableAt, new Date(redemptionNow.getTime() + 72 * 60 * 60 * 1000).toISOString());
  const replay = await redeemDisciplinePointForGracePoint({ userId: redemptionFixture.userId, idempotencyKey: redemptionKey, now: new Date(redemptionNow.getTime() + 60_000) });
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.disciplinePointBalance, '1.00');
  await assert.rejects(
    redeemDisciplinePointForGracePoint({ userId: redemptionFixture.userId, idempotencyKey: `m23-too-soon-${redemptionFixture.userId}`, now: new Date(redemptionNow.getTime() + 71 * 60 * 60 * 1000) }),
    (error) => error.code === 'DP_REDEMPTION_COOLDOWN',
  );
  const unchangedCooldownRun = await ProgressionRun.findById(redemptionFixture.run._id);
  assert.equal(unchangedCooldownRun.disciplinePoints, 1);
  assert.equal(unchangedCooldownRun.gracePoints, 3);
  assert.equal(unchangedCooldownRun.dpRedemptionCooldownUntil.getTime(), new Date(redemptionNow.getTime() + 72 * 60 * 60 * 1000).getTime());
  const redeemedAgain = await redeemDisciplinePointForGracePoint({ userId: redemptionFixture.userId, idempotencyKey: `m23-after-72h-${redemptionFixture.userId}`, now: new Date(redemptionNow.getTime() + 72 * 60 * 60 * 1000) });
  assert.equal(redeemedAgain.disciplinePointBalance, '0.00');
  assert.equal(redeemedAgain.gracePointBalance, 4);
  assert.equal(await DisciplinePointTransaction.countDocuments({ userId: redemptionFixture.userId, type: 'dp-redemption' }), 2);
  assert.equal(await GracePointTransaction.countDocuments({ userId: redemptionFixture.userId, type: 'dp-redemption' }), 2);

  // Two independent redemption keys racing against a one-point wallet still
  // result in only one successful exchange and one pair of ledger entries.
  const concurrentFixture = await createFixture({ startDate: '2026-09-10', disciplinePoints: 1, gracePoints: 0 });
  const concurrentResults = await Promise.allSettled([
    redeemDisciplinePointForGracePoint({ userId: concurrentFixture.userId, idempotencyKey: `m23-race-a-${concurrentFixture.userId}`, now: redemptionNow }),
    redeemDisciplinePointForGracePoint({ userId: concurrentFixture.userId, idempotencyKey: `m23-race-b-${concurrentFixture.userId}`, now: redemptionNow }),
  ]);
  assert.equal(concurrentResults.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(concurrentResults.filter((result) => result.status === 'rejected').length, 1);
  const concurrentRun = await ProgressionRun.findById(concurrentFixture.run._id);
  assert.equal(concurrentRun.disciplinePoints, 0);
  assert.equal(concurrentRun.gracePoints, 1);
  assert.ok(concurrentRun.dpRedemptionCooldownUntil);
  assert.equal(await DisciplinePointTransaction.countDocuments({ userId: concurrentFixture.userId, type: 'dp-redemption' }), 1);
  assert.equal(await GracePointTransaction.countDocuments({ userId: concurrentFixture.userId, type: 'dp-redemption' }), 1);

  const insufficientFixture = await createFixture({ startDate: '2026-10-01', disciplinePoints: 0, gracePoints: 1 });
  await assert.rejects(
    redeemDisciplinePointForGracePoint({ userId: insufficientFixture.userId, idempotencyKey: `m23-insufficient-${insufficientFixture.userId}` }),
    (error) => error.code === 'INSUFFICIENT_DISCIPLINE_POINTS',
  );
  const unchangedRun = await ProgressionRun.findById(insufficientFixture.run._id);
  assert.equal(unchangedRun.disciplinePoints, 0);
  assert.equal(unchangedRun.gracePoints, 1);
  assert.equal(unchangedRun.dpRedemptionCooldownUntil, null);
  assert.equal(await DisciplinePointTransaction.countDocuments({ userId: insufficientFixture.userId }), 0);

  // Exercise the approved HTTP surface against isolated replica-set data and
  // ensure client-supplied identity cannot cross the resolved user boundary.
  const apiFixture = await createFixture({ startDate: '2026-10-15', disciplinePoints: 1.25, gracePoints: 2 });
  const app = createApp({
    nodeEnv: 'test',
    databaseReady: () => true,
    testIdentityMiddleware: (request, _response, next) => {
      request.user = { id: String(apiFixture.userId), identityKind: 'test-only' };
      next();
    },
  });
  const apiServer = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    apiServer.once('listening', resolve);
    apiServer.once('error', reject);
  });
  try {
    const apiBase = `http://127.0.0.1:${apiServer.address().port}/api/v1`;
    const [summaryResponse, calendarResponse, cycleResponse, ledgerResponse, walletResponse] = await Promise.all([
      fetch(`${apiBase}/discipline/summary`),
      fetch(`${apiBase}/discipline/calendar`),
      fetch(`${apiBase}/discipline/reward-cycle`),
      fetch(`${apiBase}/discipline/transactions`),
      fetch(`${apiBase}/discipline-points`),
    ]);
    for (const response of [summaryResponse, calendarResponse, cycleResponse, ledgerResponse, walletResponse]) assert.equal(response.status, 200);
    const summaryBody = await summaryResponse.json();
    assert.equal(summaryBody.summary.lifetimeLongestStreak, 0);
    assert.equal(summaryBody.summary.dpBalance, '1.25');
    assert.equal(summaryBody.summary.disciplinePointWalletCap, '4.00');
    assert.equal(summaryBody.summary.currentRank.multiplierLabel, '1.00×');
    assert.equal(summaryBody.summary.currentRank.entryDp, '0.00');
    assert.deepEqual(summaryBody.summary.nextRewardCycle, {
      rank: { slug: 'origin', number: '07', name: 'Origin' },
      requiredQualifyingDays: 30,
      rewardAmount: '0.25',
    });
    assert.equal((await calendarResponse.json()).records.length, 0);
    const cycleBody = await cycleResponse.json();
    assert.equal(cycleBody.activeCycle.rank.slug, 'origin');
    assert.equal(cycleBody.nextRewardCycle.requiredQualifyingDays, 30);
    assert.equal(cycleBody.nextRewardCycle.rewardAmount, '0.25');
    assert.deepEqual((await ledgerResponse.json()).transactions, []);
    const walletBody = await walletResponse.json();
    assert.equal(walletBody.balance, '1.25');
    assert.equal(walletBody.maximum, '4.00');

    const forbiddenIdentityQuery = await fetch(`${apiBase}/discipline/summary?userId=${workerFixture.userId}`);
    assert.equal(forbiddenIdentityQuery.status, 400);
    const headers = { 'Content-Type': 'application/json', 'Idempotency-Key': `m23-http-${apiFixture.userId}` };
    const redeemResponse = await fetch(`${apiBase}/discipline-points/redeem`, { method: 'POST', headers, body: '{}' });
    assert.equal(redeemResponse.status, 200);
    assert.equal((await redeemResponse.json()).gracePointBalance, 3);
    const retryResponse = await fetch(`${apiBase}/discipline-points/redeem`, { method: 'POST', headers, body: '{}' });
    assert.equal(retryResponse.status, 200);
    assert.equal((await retryResponse.json()).idempotentReplay, true);
    const apiRun = await ProgressionRun.findById(apiFixture.run._id);
    assert.equal(apiRun.disciplinePoints, 0.25);
    assert.equal(apiRun.gracePoints, 3);
    assert.equal(await DisciplinePointTransaction.countDocuments({ userId: apiFixture.userId, type: 'dp-redemption' }), 1);
    assert.equal(await GracePointTransaction.countDocuments({ userId: apiFixture.userId, type: 'dp-redemption' }), 1);
  } finally {
    await new Promise((resolve) => apiServer.close(resolve));
  }
});
