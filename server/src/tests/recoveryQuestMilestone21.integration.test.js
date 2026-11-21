import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import GracePointTransaction from '../models/GracePointTransaction.js';
import Notification from '../models/Notification.js';
import ProgressionResetEvent from '../models/ProgressionResetEvent.js';
import ProgressionRun from '../models/ProgressionRun.js';
import RecoveryQuest from '../models/RecoveryQuest.js';
import RecoveryQuestDailyReset from '../models/RecoveryQuestDailyReset.js';
import Task from '../models/Task.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import TaskSchedule from '../models/TaskSchedule.js';
import User from '../models/User.js';
import XpTransaction from '../models/XpTransaction.js';
import DailyXpRecord from '../models/DailyXpRecord.js';
import EmergencyPause from '../models/EmergencyPause.js';
import EmergencyPauseMonthlyUsage from '../models/EmergencyPauseMonthlyUsage.js';
import {
  completeCurrentRecoveryQuest,
  freezeRecoveryQuestsForEmergencyPause,
  listCurrentRecoveryQuests,
  processDueRecoveryQuestExpiry,
  processRecoveryQuestDailyReset,
  resumeRecoveryQuestsAfterEmergencyPause,
} from '../services/recoveryQuestService.js';
import { activateEmergencyPause, resumeEmergencyPause } from '../services/emergencyPauseService.js';
import { getCumulativeXpThreshold } from '../services/progressionXpService.js';
import { getIstDateKey, getIstMidnightInstant } from '../utils/ist.js';

const shouldRun = process.env.RUN_MONGO_INTEGRATION === '1';
const day = (dateKey) => getIstMidnightInstant(dateKey);
const addMs = (date, amount) => new Date(date.getTime() + amount);
const disposableIds = new Set();

async function createFixture({
  startDate = '2026-06-10',
  taskCount = 0,
  scheduledIndexes = [],
  runOverrides = {},
  userOverrides = {},
  makeSchedule = taskCount > 0,
  scheduleEndDate = null,
} = {}) {
  const userId = new mongoose.Types.ObjectId();
  disposableIds.add(String(userId));
  const user = await User.create({
    _id: userId,
    identityKind: 'account',
    emailNormalized: `m21-${userId}@example.test`,
    accountStatus: 'active',
    memberSince: startDate,
    resetCount: 0,
    lifetimeLongestStreak: 0,
    highestRankAchieved: null,
    ...userOverrides,
  });
  const run = await ProgressionRun.create({
    userId,
    runNumber: 1,
    status: 'active',
    startedAt: day(startDate),
    startedOn: startDate,
    currentRankSlug: 'origin',
    level: 0,
    totalXp: 0,
    gracePoints: 3,
    disciplinePoints: 0,
    currentStreak: 0,
    longestStreak: 0,
    taskScheduleId: null,
    emergencyPause: { active: false, allowanceMonthKey: startDate.slice(0, 7), activationsUsed: 0 },
    recoveryQuestLastResetDate: startDate,
    ...runOverrides,
  });
  await User.updateOne({ _id: userId }, { $set: { currentProgressionRunId: run._id } });

  let schedule = null;
  let tasks = [];
  let occurrences = [];
  if (makeSchedule) {
    schedule = await TaskSchedule.create({
      userId,
      progressionRunId: run._id,
      cycleLength: 1,
      cycleAnchorDate: startDate,
      status: 'active',
      version: 1,
      effectiveStartDate: startDate,
      effectiveEndDate: scheduleEndDate,
      idempotencyKey: `m21-schedule-${userId}`,
    });
    run.taskScheduleId = schedule._id;
    await run.save();
    tasks = await Task.create(Array.from({ length: taskCount }, (_, index) => ({
      userId,
      progressionRunId: run._id,
      taskScheduleId: schedule._id,
      title: `Fixture Task ${index + 1}`,
      description: `Task description ${index + 1}`,
      cycleDays: [1],
      accountabilityAction: {
        title: `Action ${index + 1}`,
        description: `Action details ${index + 1}`,
      },
      revision: 1,
      status: 'active',
      effectiveDate: startDate,
      createdEffectiveDate: startDate,
    })));
    occurrences = await TaskOccurrence.create(tasks.map((task, index) => ({
      userId,
      progressionRunId: run._id,
      taskId: task._id,
      taskScheduleId: schedule._id,
      occurrenceDate: startDate,
      cycleDay: 1,
      snapshot: {
        title: task.title,
        description: task.description,
        accountabilityAction: { ...task.accountabilityAction.toObject(), weakness: '' },
        revision: task.revision,
      },
      status: scheduledIndexes.includes(index) ? 'scheduled' : 'completed',
      completedAt: scheduledIndexes.includes(index) ? null : day(startDate),
    })));
  }
  return { userId, user, run, schedule, tasks, occurrences };
}

async function createQuest({ fixture, expiresAt, activatedAt = day('2026-06-10'), sourceTask = null }) {
  const task = sourceTask || fixture.tasks[0] || await Task.create({
    userId: fixture.userId,
    progressionRunId: fixture.run._id,
    taskScheduleId: fixture.schedule?._id || new mongoose.Types.ObjectId(),
    title: 'Quest source Task',
    description: 'Saved source description',
    cycleDays: [1],
    accountabilityAction: { title: 'Source Action', description: 'Saved action details' },
    revision: 1,
    status: 'active',
    effectiveDate: fixture.run.startedOn,
    createdEffectiveDate: fixture.run.startedOn,
  });
  const occurrence = fixture.occurrences.find((item) => String(item.taskId) === String(task._id)) || await TaskOccurrence.create({
    userId: fixture.userId,
    progressionRunId: fixture.run._id,
    taskId: task._id,
    taskScheduleId: fixture.schedule?._id || new mongoose.Types.ObjectId(),
    occurrenceDate: fixture.run.startedOn,
    cycleDay: 1,
    snapshot: {
      title: task.title,
      description: task.description,
      accountabilityAction: { title: task.accountabilityAction.title, description: task.accountabilityAction.description, weakness: '' },
      revision: task.revision,
    },
    status: 'missed',
    missedAt: activatedAt,
  });
  return RecoveryQuest.create({
    userId: fixture.userId,
    progressionRunId: fixture.run._id,
    sourceTaskId: task._id,
    sourceOccurrenceId: occurrence._id,
    sourceEventKey: `missed-occurrence:${occurrence._id}`,
    sourceSnapshot: {
      taskTitle: occurrence.snapshot.title,
      taskDescription: occurrence.snapshot.description,
      accountabilityActionTitle: occurrence.snapshot.accountabilityAction.title,
      accountabilityActionDescription: occurrence.snapshot.accountabilityAction.description,
      taskRevision: occurrence.snapshot.revision,
    },
    activatedAt,
    baseExpiresAt: expiresAt,
    expiresAt,
    status: 'active',
  });
}

async function cleanupDisposableUsers() {
  const ids = [...disposableIds].map((id) => new mongoose.Types.ObjectId(id));
  if (!ids.length) return;
  const filter = { userId: { $in: ids } };
  await Promise.all([
    EmergencyPause.deleteMany(filter),
    EmergencyPauseMonthlyUsage.deleteMany(filter),
    RecoveryQuest.deleteMany(filter),
    GracePointTransaction.deleteMany(filter),
    XpTransaction.deleteMany(filter),
    DailyXpRecord.deleteMany(filter),
    RecoveryQuestDailyReset.deleteMany(filter),
    ProgressionResetEvent.deleteMany(filter),
    TaskOccurrence.deleteMany(filter),
    TaskSchedule.deleteMany(filter),
    Task.deleteMany(filter),
    ProgressionRun.deleteMany(filter),
    User.deleteMany({ _id: { $in: ids } }),
  ]);
  disposableIds.clear();
}

test('Milestone 21 recovery lifecycle, XP drain, reset, API and Pause integration use isolated replica-set data', { skip: !shouldRun }, async (t) => {
  const isolatedUri = new URL(config.mongoUri);
  isolatedUri.pathname = `/the_system_m21_${process.pid}_${Date.now()}`;
  await connectDatabase(isolatedUri.toString());
  t.after(async () => {
    try {
      await cleanupDisposableUsers();
    } finally {
      try { await mongoose.connection.dropDatabase(); } finally { await disconnectDatabase(); }
    }
  });
  await Promise.all([EmergencyPause.init(), EmergencyPauseMonthlyUsage.init()]);
  assert.equal(mongoose.connection.readyState, 1, 'The configured MongoDB replica set must be connected.');

  await t.test('missed Task creates one immutable 72-hour Quest; later drain demotes Rank without lowering lifetime highest Rank', async () => {
    const fixture = await createFixture({
      startDate: '2026-06-10',
      taskCount: 7,
      scheduledIndexes: [6],
      scheduleEndDate: '2026-06-10',
      runOverrides: {
        level: 10,
        totalXp: getCumulativeXpThreshold(10) + 1,
        currentRankSlug: 'ember',
        gracePoints: 3,
      },
      userOverrides: { highestRankAchieved: 'ember', lifetimeLongestStreak: 9, memberSince: '2020-02-03' },
    });
    const resetDate = '2026-06-11';
    const activatedAt = day(resetDate);
    const result = await processRecoveryQuestDailyReset({ userId: fixture.userId, resetDate, now: day('2026-06-12') });
    assert.equal(result.processed, true);
    assert.equal(result.activeQuestCount, 0, 'A Quest generated at a reset does not drain XP at that same reset.');
    const quest = await RecoveryQuest.findOne({ userId: fixture.userId, progressionRunId: fixture.run._id });
    assert.ok(quest);
    assert.equal(quest.status, 'active');
    assert.equal(quest.activatedAt.getTime(), activatedAt.getTime());
    assert.equal(quest.expiresAt.getTime(), activatedAt.getTime() + 72 * 60 * 60 * 1000);
    const missed = await TaskOccurrence.findById(fixture.occurrences[6]._id);
    assert.equal(missed.status, 'missed');
    assert.equal(missed.missedAt.getTime(), activatedAt.getTime());
    const snapshotBefore = quest.sourceSnapshot.toObject();
    await Task.updateOne({ _id: fixture.tasks[6]._id }, { $set: { title: 'Edited after miss', accountabilityAction: { title: 'Changed action', description: 'Changed details' } } });
    const sameQuest = await RecoveryQuest.findById(quest._id);
    assert.deepEqual(sameQuest.sourceSnapshot.toObject(), snapshotBefore);
    assert.equal((await RecoveryQuest.countDocuments({ userId: fixture.userId, progressionRunId: fixture.run._id })).valueOf(), 1);
    assert.equal(await Notification.countDocuments({ userId: fixture.userId, eventType: 'task-finalized-missed' }), 1);
    assert.equal(await Notification.countDocuments({ userId: fixture.userId, eventType: 'recovery-quest-activated' }), 1);
    const duplicate = await processRecoveryQuestDailyReset({ userId: fixture.userId, resetDate, now: day('2026-06-12') });
    assert.equal(duplicate.duplicate, true);

    const nextReset = await processRecoveryQuestDailyReset({ userId: fixture.userId, resetDate: '2026-06-12', now: day('2026-06-13') });
    assert.equal(nextReset.activeQuestCount, 1);
    const drainedRun = await ProgressionRun.findById(fixture.run._id);
    assert.equal(drainedRun.level, 9);
    assert.equal(drainedRun.currentRankSlug, 'origin', 'Dropping below Level 10 immediately demotes the current Rank.');
    assert.equal(Number(drainedRun.totalXp.toFixed(2)), Number((getCumulativeXpThreshold(10) + 1 - 11.41).toFixed(2)));
    const xpEvent = await XpTransaction.findOne({ userId: fixture.userId, progressionRunId: fixture.run._id });
    assert.equal(xpEvent.amount.toString(), '-11.41');
    const duplicateDrain = await processRecoveryQuestDailyReset({ userId: fixture.userId, resetDate: '2026-06-12', now: day('2026-06-13') });
    assert.equal(duplicateDrain.duplicate, true);
    assert.equal(await XpTransaction.countDocuments({ userId: fixture.userId, progressionRunId: fixture.run._id }), 1);
    assert.equal(Number((await ProgressionRun.findById(fixture.run._id)).totalXp.toFixed(2)), Number(xpEvent.balanceAfter.toString()));
    const member = await User.findById(fixture.userId);
    assert.equal(member.highestRankAchieved, 'ember', 'Lifetime Highest Rank is not demoted with the current Rank.');
    assert.equal(member.memberSince, '2020-02-03');

    const completed = await completeCurrentRecoveryQuest({ userId: fixture.userId, questId: quest._id, now: new Date(quest.expiresAt.getTime() - 1) });
    assert.equal(completed.status, 'completed');
    assert.equal(await Notification.countDocuments({ userId: fixture.userId, eventType: 'recovery-quest-completed' }), 1);
    await assert.rejects(() => completeCurrentRecoveryQuest({ userId: fixture.userId, questId: quest._id, now: new Date(quest.expiresAt.getTime() - 1) }), { code: 'RECOVERY_QUEST_NOT_ACTIVE' });
    await processDueRecoveryQuestExpiry({ userId: fixture.userId, cutoff: quest.expiresAt });
    assert.equal(await GracePointTransaction.countDocuments({ userId: fixture.userId }), 0, 'A completed Quest is never charged on later expiry processing.');
  });

  await t.test('sixth Quest threshold clears six and the next deterministic Quest begins a new active cycle', async () => {
    const fixture = await createFixture({ startDate: '2026-06-10', taskCount: 7, scheduledIndexes: [0, 1, 2, 3, 4, 5, 6], scheduleEndDate: '2026-06-10', runOverrides: { gracePoints: 2 } });
    const result = await processRecoveryQuestDailyReset({ userId: fixture.userId, resetDate: '2026-06-11', now: day('2026-06-12') });
    assert.equal(result.generated, 7);
    const quests = await RecoveryQuest.find({ userId: fixture.userId, progressionRunId: fixture.run._id }).sort({ activatedAt: 1, _id: 1 });
    assert.equal(quests.filter((quest) => quest.status === 'threshold-cleared').length, 6);
    assert.equal(quests.filter((quest) => quest.status === 'active').length, 1);
    assert.ok(quests.every((quest) => quest.sourceSnapshot.accountabilityActionTitle));
    const tx = await GracePointTransaction.find({ userId: fixture.userId, progressionRunId: fixture.run._id });
    assert.equal(tx.length, 1);
    assert.equal(tx[0].type, 'sixth-quest-threshold');
    assert.equal(tx[0].delta, -1);
    assert.equal(await Notification.countDocuments({ userId: fixture.userId, eventType: 'recovery-quest-threshold-cleared' }), 1);
    assert.equal((await ProgressionRun.findById(fixture.run._id)).gracePoints, 1);
    assert.equal(await XpTransaction.countDocuments({ userId: fixture.userId }), 0, 'Newly generated Quests are not drained on their activation reset.');
    await processRecoveryQuestDailyReset({ userId: fixture.userId, resetDate: '2026-06-11', now: day('2026-06-12') });
    assert.equal(await GracePointTransaction.countDocuments({ userId: fixture.userId }), 1, 'Retrying the reset cannot duplicate the threshold deduction.');
  });

  await t.test('XP drain cannot reduce XP or Level below zero', async () => {
    const fixture = await createFixture({
      startDate: '2026-06-10',
      runOverrides: { totalXp: 0.5, level: 0, currentRankSlug: 'origin' },
      userOverrides: { highestRankAchieved: 'zenith' },
      makeSchedule: false,
    });
    await createQuest({ fixture, activatedAt: day('2026-06-10'), expiresAt: addMs(day('2026-06-10'), 72 * 60 * 60 * 1000) });
    await processRecoveryQuestDailyReset({ userId: fixture.userId, resetDate: '2026-06-11', now: day('2026-06-12') });
    const run = await ProgressionRun.findById(fixture.run._id);
    const transaction = await XpTransaction.findOne({ userId: fixture.userId, progressionRunId: fixture.run._id });
    assert.equal(run.totalXp, 0);
    assert.equal(run.level, 0);
    assert.equal(run.currentRankSlug, 'origin');
    assert.equal(transaction.amount.toString(), '-0.50');
    assert.equal(transaction.balanceAfter.toString(), '0.00');
    assert.equal((await User.findById(fixture.userId)).highestRankAchieved, 'zenith');
  });

  await t.test('individual expiry at one remaining point atomically resets only the progression run', async () => {
    const fixture = await createFixture({
      startDate: '2026-06-10',
      runOverrides: {
        level: 76,
        totalXp: getCumulativeXpThreshold(76),
        currentRankSlug: 'zenith',
        gracePoints: 1,
        longestStreak: 19,
      },
      userOverrides: { resetCount: 4, lifetimeLongestStreak: 19, highestRankAchieved: 'zenith', memberSince: '2019-08-17' },
      makeSchedule: true,
    });
    await User.collection.updateOne({ _id: fixture.userId }, { $set: { personalBestRecords: { overall: 2, xp: 3 }, earnedRankBadges: [{ rank: 'zenith', serial: 'ZE.00004' }] } });
    const activatedAt = day('2026-06-10');
    const expiry = new Date(activatedAt.getTime() + 72 * 60 * 60 * 1000);
    const task = await Task.create({
      userId: fixture.userId, progressionRunId: fixture.run._id, taskScheduleId: new mongoose.Types.ObjectId(),
      title: 'Expiry source', description: '', cycleDays: [1],
      accountabilityAction: { title: 'Expiry Action', description: 'Complete the original commitment.' },
      revision: 1, status: 'active', effectiveDate: '2026-06-10', createdEffectiveDate: '2026-06-10',
    });
    const quest = await createQuest({ fixture, expiresAt: expiry, activatedAt, sourceTask: task });
    const beforeExpiry = await processDueRecoveryQuestExpiry({ userId: fixture.userId, cutoff: new Date(expiry.getTime() - 1) });
    assert.equal(beforeExpiry.processed, false);
    await assert.rejects(
      () => completeCurrentRecoveryQuest({ userId: fixture.userId, questId: quest._id, now: expiry }),
      { code: 'RECOVERY_QUEST_EXPIRED' },
      'Completion is rejected at the exact 72-hour expiry instant.',
    );
    const expired = await processDueRecoveryQuestExpiry({ userId: fixture.userId, cutoff: expiry });
    assert.equal(expired.processed, true);
    assert.equal(expired.resetCount, 5);
    const oldRun = await ProgressionRun.findById(fixture.run._id);
    assert.equal(oldRun.status, 'ended');
    const newRun = await ProgressionRun.findOne({ userId: fixture.userId, status: 'active' });
    assert.ok(newRun);
    assert.notEqual(String(newRun._id), String(fixture.run._id));
    assert.equal(newRun.runNumber, 2);
    assert.equal(newRun.currentRankSlug, 'origin');
    assert.equal(newRun.level, 0);
    assert.equal(newRun.totalXp, 0);
    assert.equal(newRun.gracePoints, 3);
    assert.equal(newRun.disciplinePoints, 0);
    assert.equal(newRun.currentStreak, 0);
    assert.equal(newRun.longestStreak, 0);
    assert.equal(newRun.taskScheduleId, null);
    assert.equal(newRun.dpRedemptionCooldownUntil, null);
    assert.deepEqual(newRun.emergencyPause.toObject(), {
      active: false,
      pauseId: null,
      allowanceMonthKey: '2026-06',
      activationsUsed: 0,
      selectedDurationDays: null,
      activatedAt: null,
      resumesAt: null,
    });
    assert.equal(await ProgressionRun.countDocuments({ userId: fixture.userId, status: 'active' }), 1);
    assert.equal(await Task.countDocuments({ userId: fixture.userId, progressionRunId: newRun._id }), 0);
    assert.equal(await RecoveryQuest.countDocuments({ userId: fixture.userId, progressionRunId: newRun._id }), 0);
    assert.equal((await TaskSchedule.findById(fixture.schedule._id)).status, 'archived');
    assert.equal((await RecoveryQuest.findById(quest._id)).status, 'expired');
    assert.equal(await GracePointTransaction.countDocuments({ userId: fixture.userId, progressionRunId: fixture.run._id, sourceEventKey: `recovery-quest-expiry:${quest._id}` }), 1);
    const member = await User.findById(fixture.userId);
    assert.equal(String(member.currentProgressionRunId), String(newRun._id));
    assert.equal(member.resetCount, 5);
    assert.equal(member.lifetimeLongestStreak, 19);
    assert.equal(member.highestRankAchieved, 'zenith');
    assert.equal(member.memberSince, '2019-08-17');
    const persistedLifetime = await User.collection.findOne({ _id: fixture.userId });
    assert.deepEqual(persistedLifetime.personalBestRecords, { overall: 2, xp: 3 });
    assert.deepEqual(persistedLifetime.earnedRankBadges, [{ rank: 'zenith', serial: 'ZE.00004' }]);
    assert.equal(await ProgressionResetEvent.countDocuments({ userId: fixture.userId, previousRunId: fixture.run._id }), 1);
    await processDueRecoveryQuestExpiry({ userId: fixture.userId, cutoff: expiry });
    assert.equal(await ProgressionResetEvent.countDocuments({ userId: fixture.userId }), 1, 'A retry cannot start a second reset.');
  });

  await t.test('a sixth-Quest threshold at one Grace Point triggers one reset and stops old-run generation', async () => {
    const fixture = await createFixture({
      startDate: '2026-06-10',
      taskCount: 7,
      scheduledIndexes: [0, 1, 2, 3, 4, 5, 6],
      scheduleEndDate: '2026-06-10',
      runOverrides: { gracePoints: 1, recoveryQuestLastResetDate: '2026-06-10' },
      userOverrides: { resetCount: 2, highestRankAchieved: 'apex', lifetimeLongestStreak: 12 },
    });
    const result = await processRecoveryQuestDailyReset({ userId: fixture.userId, resetDate: '2026-06-11', now: day('2026-06-12') });
    assert.equal(result.processed, true);
    assert.equal(result.generated, 6);
    assert.equal(result.reset.resetEvent.resetCountAfter, 3);
    const oldRun = await ProgressionRun.findById(fixture.run._id);
    assert.equal(oldRun.status, 'ended');
    const quests = await RecoveryQuest.find({ userId: fixture.userId, progressionRunId: fixture.run._id });
    assert.equal(quests.length, 6);
    assert.ok(quests.every((quest) => quest.status === 'threshold-cleared'));
    assert.equal((await TaskOccurrence.findById(fixture.occurrences[6]._id)).status, 'scheduled', 'Processing stops once the old run resets.');
    assert.equal(await GracePointTransaction.countDocuments({ userId: fixture.userId, progressionRunId: fixture.run._id }), 1);
    assert.equal((await ProgressionRun.find({ userId: fixture.userId, status: 'active' })).length, 1);
    const member = await User.findById(fixture.userId);
    assert.equal(member.resetCount, 3);
    assert.equal(member.highestRankAchieved, 'apex');
    await processRecoveryQuestDailyReset({ userId: fixture.userId, resetDate: '2026-06-11', now: day('2026-06-12') });
    assert.equal((await User.findById(fixture.userId)).resetCount, 3, 'Retrying the threshold reset cannot increment Reset Count again.');
  });

  await t.test('Emergency Pause freezes countdown and drain; resumed processing uses remaining time', async () => {
    const fixture = await createFixture({ startDate: '2026-06-08', runOverrides: { level: 1, totalXp: 100, currentRankSlug: 'origin', recoveryQuestLastResetDate: '2026-06-09' }, makeSchedule: false });
    const pauseStart = addMs(day('2026-06-09'), 12 * 60 * 60 * 1000);
    const resumeAt = addMs(pauseStart, 20 * 60 * 60 * 1000);
    const quest = await createQuest({ fixture, activatedAt: day('2026-06-08'), expiresAt: addMs(pauseStart, 48 * 60 * 60 * 1000) });
    await activateEmergencyPause({ userId: fixture.userId, durationDays: 1, idempotencyKey: 'm21-pause-activate-0001', now: pauseStart });
    const frozen = await RecoveryQuest.findById(quest._id);
    assert.equal(frozen.remainingDurationMs, 48 * 60 * 60 * 1000);

    const pausedReset = await processRecoveryQuestDailyReset({ userId: fixture.userId, resetDate: '2026-06-10', now: addMs(day('2026-06-10'), 15 * 60 * 1000) });
    assert.equal(pausedReset.paused, true);
    assert.equal(await XpTransaction.countDocuments({ userId: fixture.userId }), 0);
    const pausedExpiry = await processDueRecoveryQuestExpiry({ userId: fixture.userId, cutoff: addMs(pauseStart, 2 * 60 * 60 * 1000) });
    assert.equal(pausedExpiry.paused, true);
    assert.equal(await GracePointTransaction.countDocuments({ userId: fixture.userId }), 0);
    const pausedList = await listCurrentRecoveryQuests(fixture.userId, { now: addMs(pauseStart, 2 * 60 * 60 * 1000) });
    assert.equal(pausedList.quests[0].remainingMs, 48 * 60 * 60 * 1000);
    assert.equal(pausedList.quests[0].expiresAt, new Date(pauseStart.getTime() + 24 * 60 * 60 * 1000 + 48 * 60 * 60 * 1000).toISOString());
    await assert.rejects(() => completeCurrentRecoveryQuest({ userId: fixture.userId, questId: quest._id, now: addMs(pauseStart, 2 * 60 * 60 * 1000) }), { code: 'EMERGENCY_PAUSE_ACTIVE' });

    await resumeEmergencyPause({ userId: fixture.userId, idempotencyKey: 'm21-pause-resume-0001', now: resumeAt });
    const resumedQuest = await RecoveryQuest.findById(quest._id);
    assert.equal(resumedQuest.remainingDurationMs, null);
    assert.equal(resumedQuest.expiresAt.getTime(), resumeAt.getTime() + 48 * 60 * 60 * 1000);
    assert.equal((await RecoveryQuestDailyReset.findOne({ userId: fixture.userId, progressionRunId: fixture.run._id, date: '2026-06-10' })).status, 'skipped-emergency-pause');

    const nextReset = await processRecoveryQuestDailyReset({ userId: fixture.userId, resetDate: '2026-06-11', now: day('2026-06-11') });
    assert.equal(nextReset.activeQuestCount, 1);
    assert.equal((await XpTransaction.findOne({ userId: fixture.userId })).amount.toString(), '-7.35');
    const notExpired = await processDueRecoveryQuestExpiry({ userId: fixture.userId, cutoff: addMs(resumeAt, 47 * 60 * 60 * 1000) });
    assert.equal(notExpired.processed, false, 'The Recovery Window does not expire while paused.');
  });

  await t.test('a cross-month Emergency Pause resumes automatically at IST month start and resets allowance', async () => {
    const fixture = await createFixture({ startDate: '2026-06-30', makeSchedule: false });
    const pauseStart = addMs(day('2026-06-30'), 23 * 60 * 60 * 1000);
    const monthBoundary = day('2026-07-01');
    const resumeAt = addMs(pauseStart, 7 * 24 * 60 * 60 * 1000);
    const quest = await createQuest({
      fixture,
      activatedAt: addMs(pauseStart, -60 * 60 * 1000),
      expiresAt: addMs(pauseStart, 12 * 60 * 60 * 1000),
    });
    await ProgressionRun.updateOne({ _id: fixture.run._id }, { $set: { emergencyPause: { active: true, allowanceMonthKey: '2026-06', activationsUsed: 2, activatedAt: pauseStart, resumesAt: resumeAt } } });
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await freezeRecoveryQuestsForEmergencyPause({ userId: fixture.userId, progressionRunId: fixture.run._id, activatedAt: pauseStart, session });
      });
    } finally { await session.endSession(); }

    const result = await processDueRecoveryQuestExpiry({ userId: fixture.userId, cutoff: monthBoundary });
    assert.equal(result.processed, false);
    const run = await ProgressionRun.findById(fixture.run._id);
    assert.equal(run.emergencyPause.active, false);
    assert.equal(run.emergencyPause.allowanceMonthKey, '2026-07');
    assert.equal(run.emergencyPause.activationsUsed, 0);
    const resumedQuest = await RecoveryQuest.findById(quest._id);
    assert.equal(resumedQuest.remainingDurationMs, null);
    assert.equal(resumedQuest.expiresAt.getTime(), addMs(monthBoundary, 12 * 60 * 60 * 1000).getTime());
    assert.equal(await GracePointTransaction.countDocuments({ userId: fixture.userId }), 0);
  });

  await t.test('Recovery Quest listings preserve each lifecycle state and report accurate remaining time', async () => {
    const fixture = await createFixture({ startDate: '2026-06-10', makeSchedule: false });
    const now = new Date('2026-06-12T12:00:00.000Z');
    const plentyExpiry = addMs(now, 48 * 60 * 60 * 1000);
    const closeExpiry = addMs(now, 90 * 1000);
    const plenty = await createQuest({ fixture, activatedAt: addMs(now, -24 * 60 * 60 * 1000), expiresAt: plentyExpiry });
    const close = await createQuest({ fixture, activatedAt: addMs(now, -72 * 60 * 60 * 1000), expiresAt: closeExpiry });
    const completed = await createQuest({ fixture, activatedAt: addMs(now, -4 * 60 * 60 * 1000), expiresAt: addMs(now, 68 * 60 * 60 * 1000) });
    const expiredAt = addMs(now, -60 * 60 * 1000);
    const expired = await createQuest({ fixture, activatedAt: addMs(now, -96 * 60 * 60 * 1000), expiresAt: expiredAt });
    const cleared = await createQuest({ fixture, activatedAt: addMs(now, -6 * 60 * 60 * 1000), expiresAt: addMs(now, 66 * 60 * 60 * 1000) });
    await RecoveryQuest.updateOne({ _id: completed._id }, { $set: { status: 'completed', completedAt: addMs(now, -30 * 60 * 1000) } });
    await RecoveryQuest.updateOne({ _id: expired._id }, { $set: { status: 'expired', expiredAt } });
    await RecoveryQuest.updateOne({ _id: cleared._id }, { $set: { status: 'threshold-cleared', thresholdClearedAt: addMs(now, -15 * 60 * 1000) } });

    const listed = await listCurrentRecoveryQuests(fixture.userId, { now });
    const byId = new Map(listed.quests.map((quest) => [quest.id, quest]));
    assert.equal(byId.get(String(plenty._id)).status, 'active');
    assert.equal(byId.get(String(plenty._id)).remainingMs, 48 * 60 * 60 * 1000);
    assert.equal(byId.get(String(close._id)).status, 'active');
    assert.equal(byId.get(String(close._id)).remainingMs, 90 * 1000);
    assert.equal(byId.get(String(completed._id)).status, 'completed');
    assert.equal(byId.get(String(expired._id)).status, 'expired');
    assert.equal(byId.get(String(expired._id)).remainingMs, 0);
    assert.equal(byId.get(String(cleared._id)).status, 'threshold-cleared');
    assert.equal((await RecoveryQuest.findById(completed._id)).completedAt.getTime(), addMs(now, -30 * 60 * 1000).getTime());
    assert.equal((await RecoveryQuest.findById(expired._id)).expiredAt.getTime(), expiredAt.getTime());
    assert.equal(await GracePointTransaction.countDocuments({ userId: fixture.userId }), 0, 'Listing Quest states does not apply expiry or threshold deductions.');
  });

  await t.test('Recovery Quest APIs return safe user-scoped server records and reject client authority fields', async () => {
    const apiDate = getIstDateKey();
    const apiNow = new Date();
    const fixture = await createFixture({ startDate: apiDate, makeSchedule: false });
    const quest = await createQuest({ fixture, activatedAt: apiNow, expiresAt: addMs(apiNow, 72 * 60 * 60 * 1000) });
    const foreign = await createFixture({ startDate: apiDate, makeSchedule: false });
    const foreignQuest = await createQuest({ fixture: foreign, activatedAt: apiNow, expiresAt: addMs(apiNow, 72 * 60 * 60 * 1000) });
    let identity = String(fixture.userId);
    const app = createApp({
      nodeEnv: 'test',
      databaseReady: () => mongoose.connection.readyState === 1,
      corsOrigins: [],
      testIdentityMiddleware: (request, _response, next) => { request.user = { id: identity, identityKind: 'account' }; request.authSession = { authenticated: true }; next(); },
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    try {
      assert.equal((await fetch(`${base}/recovery-quests?userId=${foreign.userId}`)).status, 400, 'Caller-supplied identity queries are rejected.');
      const questsResponse = await fetch(`${base}/recovery-quests`);
      assert.equal(questsResponse.status, 200);
      const questData = await questsResponse.json();
      assert.equal(questData.quests.length, 1);
      assert.equal(questData.quests[0].id, String(quest._id));
      assert.equal(questData.quests[0].sourceTaskName, 'Quest source Task');
      assert.equal((await fetch(`${base}/recovery-quests/${foreignQuest._id}`)).status, 404);
      assert.equal((await fetch(`${base}/grace-points?userId=${foreign.userId}`)).status, 400);
      assert.equal((await fetch(`${base}/grace-points`)).status, 200);
      assert.equal((await fetch(`${base}/grace-points/transactions`)).status, 200);
      const progressionResponse = await fetch(`${base}/progression/current`);
      assert.equal(progressionResponse.status, 200);
      assert.equal((await progressionResponse.json()).progression.currentRankSlug, 'origin');
      const badBody = await fetch(`${base}/recovery-quests/${quest._id}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gracePoints: 500, userId: foreign.userId }),
      });
      assert.equal(badBody.status, 400);
      const completed = await fetch(`${base}/recovery-quests/${quest._id}/complete`, { method: 'POST' });
      assert.equal(completed.status, 200);
      assert.equal((await completed.json()).status, 'completed');
      identity = String(foreign.userId);
      assert.equal((await fetch(`${base}/recovery-quests/${quest._id}`)).status, 404);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
