import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import DailyTaskXpAllocation from '../models/DailyTaskXpAllocation.js';
import DailyXpRecord from '../models/DailyXpRecord.js';
import DisciplinePointTransaction from '../models/DisciplinePointTransaction.js';
import Notification from '../models/Notification.js';
import ProgressionRun from '../models/ProgressionRun.js';
import RankEntryEvent from '../models/RankEntryEvent.js';
import Task from '../models/Task.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import TaskSchedule from '../models/TaskSchedule.js';
import User from '../models/User.js';
import XpTransaction from '../models/XpTransaction.js';
import { applyXpAdjustment, ensureDailyXpRecordWithinSession, getLevelFromTotalXp } from '../services/progressionXpService.js';
import { completeCurrentTaskOccurrence } from '../services/taskOccurrenceService.js';
import { withMongoTransaction } from '../services/mongoTransaction.js';
import { getIstDateKey } from '../utils/ist.js';

const shouldRun = process.env.RUN_MONGO_INTEGRATION === '1';

test('M22 Task awards, cap snapshot, Rank-entry rewards and demotion are transactional and idempotent', { skip: !shouldRun }, async (t) => {
  await connectDatabase();
  t.after(async () => disconnectDatabase());
  assert.equal(mongoose.connection.readyState, 1, 'A real MongoDB replica set connection is required.');

  const userId = new mongoose.Types.ObjectId();
  const runId = new mongoose.Types.ObjectId();
  const scheduleId = new mongoose.Types.ObjectId();
  const today = getIstDateKey();
  const idempotencyKeys = new Map();
  let taskIds = [];
  let occurrenceIds = [];
  try {
    await User.create({
      _id: userId,
      identityKind: 'account',
      emailNormalized: `m22-xp-${userId}@example.test`,
      accountStatus: 'active',
      memberSince: today,
      currentProgressionRunId: runId,
      highestRankAchieved: 'origin',
    });
    const run = await ProgressionRun.create({
      _id: runId,
      userId,
      runNumber: 1,
      status: 'active',
      currentRankSlug: 'origin',
      level: getLevelFromTotalXp(1_240),
      totalXp: 1_240,
      startedOn: today,
      recoveryQuestLastResetDate: today,
    });
    await TaskSchedule.create({
      _id: scheduleId,
      userId,
      progressionRunId: runId,
      cycleLength: 1,
      cycleAnchorDate: today,
      effectiveStartDate: today,
      idempotencyKey: `m22-schedule-${scheduleId}`,
    });
    run.taskScheduleId = scheduleId;
    await run.save();
    const tasks = await Task.create(Array.from({ length: 7 }, (_, index) => ({
      userId,
      progressionRunId: runId,
      taskScheduleId: scheduleId,
      title: `M22 Task ${index + 1}`,
      description: '',
      cycleDays: [1],
      accountabilityAction: { title: `Action ${index + 1}`, description: 'Complete the scheduled action.' },
      effectiveDate: today,
      createdEffectiveDate: today,
      idempotencyKey: `m22-task-${index + 1}-${taskIds.length}-${userId}`,
    })));
    taskIds = tasks.map((task) => task._id);
    await TaskOccurrence.create(tasks.map((task) => ({
      userId,
      progressionRunId: runId,
      taskScheduleId: scheduleId,
      taskId: task._id,
      occurrenceDate: today,
      cycleDay: 1,
      snapshot: {
        title: task.title,
        description: '',
        accountabilityAction: { title: task.accountabilityAction.title, description: task.accountabilityAction.description, weakness: '' },
        revision: 1,
      },
      status: 'scheduled',
    })));
    const occurrences = await TaskOccurrence.find({ userId, progressionRunId: runId, occurrenceDate: today }).sort({ taskId: 1 });
    occurrenceIds = occurrences.map((occurrence) => occurrence._id);

    const complete = async (occurrence, index) => {
      const idempotencyKey = `m22-complete-${index}-${userId}`;
      idempotencyKeys.set(String(occurrence._id), idempotencyKey);
      return completeCurrentTaskOccurrence({
        userId,
        occurrenceId: occurrence._id,
        submission: { note: '', fileName: '' },
        idempotencyKey,
        now: new Date(),
      });
    };

    const first = await complete(occurrences[0], 1);
    assert.equal(first.occurrence.status, 'completed');
    assert.equal(first.xpReward.baseXp, '42.86');
    assert.equal(first.xpReward.multiplier, 1);
    assert.equal(first.xpReward.creditedXp, '42.86');
    assert.equal(first.progression.currentRank.slug, 'ember');
    assert.equal(first.progression.currentRank.multiplierLabel, '1.10×');
    assert.equal(first.rankEntryRewards.length, 1);
    assert.deepEqual({ rank: first.rankEntryRewards[0].rankName, xp: first.rankEntryRewards[0].creditedXpReward, dp: first.rankEntryRewards[0].creditedDpReward }, { rank: 'Ember', xp: '1642.40', dp: '0.10' });

    const replay = await completeCurrentTaskOccurrence({
      userId,
      occurrenceId: occurrences[0]._id,
      submission: { note: '', fileName: '' },
      idempotencyKey: idempotencyKeys.get(String(occurrences[0]._id)),
    });
    assert.equal(replay.idempotentReplay, true);
    assert.equal(replay.rankEntryRewards.length, 0, 'A completion replay never repeats Rank-up feedback.');
    assert.equal(await XpTransaction.countDocuments({ userId, progressionRunId: runId, sourceEventKey: `task-completion:${occurrences[0]._id}` }), 1);

    const allocation = await DailyTaskXpAllocation.findOne({ userId, progressionRunId: runId, date: today });
    assert.equal(allocation.scheduledOccurrenceCount, 7);
    assert.equal(allocation.totalBaseXpCents, 30_000);
    assert.equal(allocation.allocations.reduce((sum, item) => sum + item.baseXpCents, 0), 30_000);
    const dailyRecord = await DailyXpRecord.findOne({ userId, date: today });
    assert.equal(dailyRecord.rankAtDayStart, 'origin');
    assert.equal(dailyRecord.capAmountCents, 30_000);
    assert.equal(dailyRecord.ordinaryXpCreditedCents, 4_286, 'Rank-entry XP does not consume daily cap capacity.');

    const nextTask = await complete(occurrences[1], 2);
    assert.equal(nextTask.xpReward.multiplier, 1.1, 'The new Rank multiplier applies immediately to the next eligible Task.');
    assert.equal(nextTask.progression.dailyXp.rankAtDayStart, 'origin');
    assert.equal(nextTask.progression.dailyXp.capAmount, '300.00', 'A midday promotion does not change the saved daily cap.');
    assert.equal(nextTask.rankEntryRewards.length, 0);

    const drain = await withMongoTransaction((session) => applyXpAdjustment({
      userId,
      progressionRunId: runId,
      amountCents: -180_000,
      sourceEventKey: `m22-regression-drain:${runId}:${today}`,
      occurredAt: new Date(),
      businessDate: today,
      activeQuestCount: 1,
      levelRequirement: 100,
      metadata: { regression: true },
      session,
    }));
    assert.equal(drain.currentRankAfter, 'origin');
    const recordAfterDrain = await DailyXpRecord.findOne({ userId, date: today });
    assert.equal(recordAfterDrain.ordinaryXpCreditedCents, dailyRecord.ordinaryXpCreditedCents + Math.round(Number(nextTask.xpReward.creditedXp) * 100), 'XP drain does not restore daily positive earning capacity.');

    const third = await complete(occurrences[2], 3);
    const fourth = await complete(occurrences[3], 4);
    assert.equal(third.xpReward.multiplier, 1);
    assert.equal(fourth.xpReward.multiplier, 1);
    const rePromoted = await complete(occurrences[4], 5);
    assert.equal(rePromoted.progression.currentRank.slug, 'ember');
    assert.equal(rePromoted.rankEntryRewards.length, 0, 'Demotion and re-promotion do not regrant entry rewards within the run.');

    const finalRun = await ProgressionRun.findById(runId);
    const user = await User.findById(userId);
    assert.equal(finalRun.currentRankSlug, 'ember');
    assert.equal(user.highestRankAchieved, 'ember');
    assert.equal(finalRun.disciplinePoints, 0.1);
    assert.equal(await RankEntryEvent.countDocuments({ userId, progressionRunId: runId, rankSlug: 'ember' }), 1);
    assert.equal(await XpTransaction.countDocuments({ userId, progressionRunId: runId, type: 'rank-entry' }), 1);
    assert.equal(await DisciplinePointTransaction.countDocuments({ userId, progressionRunId: runId, type: 'rank-entry' }), 1);
    assert.equal(await Notification.countDocuments({ userId, eventType: 'task-completed' }), 5);
    assert.equal(await Notification.countDocuments({ userId, eventType: 'rank-entry-reward-credited' }), 1);
    assert.ok(await Notification.exists({ userId, eventType: 'rank-promoted' }));
    assert.ok(await Notification.exists({ userId, eventType: 'rank-demoted' }));
    assert.equal(await Notification.countDocuments({ userId, eventType: 'rank-promoted' }), 2,
      'Each distinct persisted promotion in the run is notified once, including a later re-promotion.');

    const capturedAfterPromotion = await withMongoTransaction((session) => ensureDailyXpRecordWithinSession({
      userId,
      run: { _id: runId, totalXp: 75_702 },
      date: today,
      occurredAt: new Date(),
      session,
    }));
    assert.equal(capturedAfterPromotion.rankAtDayStart, 'origin', 'A later Rank or same-day run change cannot recreate the daily cap record.');
    assert.equal(capturedAfterPromotion.capAmountCents, 30_000);
  } finally {
    await Promise.all([
      DailyTaskXpAllocation.deleteMany({ userId }),
      DailyXpRecord.deleteMany({ userId }),
      DisciplinePointTransaction.deleteMany({ userId }),
      RankEntryEvent.deleteMany({ userId }),
      XpTransaction.deleteMany({ userId }),
      TaskOccurrence.deleteMany({ userId }),
      Task.deleteMany({ userId }),
      TaskSchedule.deleteMany({ userId }),
      ProgressionRun.deleteMany({ userId }),
      User.deleteOne({ _id: userId }),
    ]);
  }
});
