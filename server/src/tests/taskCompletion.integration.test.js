import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import User from '../models/User.js';
import ProgressionRun from '../models/ProgressionRun.js';
import Task from '../models/Task.js';
import TaskSchedule from '../models/TaskSchedule.js';
import TaskScheduleChange from '../models/TaskScheduleChange.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import { completeCurrentTaskOccurrence } from '../services/taskOccurrenceService.js';
import { getCurrentOccurrences, getCurrentTaskSchedule, listCurrentTasks } from '../services/taskScheduleService.js';
import { getIstDateKey } from '../utils/ist.js';

const shouldRun = process.env.RUN_MONGO_INTEGRATION === '1';

test('MongoDB Task completion is idempotent and transaction-safe', { skip: !shouldRun }, async (t) => {
  await connectDatabase();
  t.after(async () => {
    await disconnectDatabase();
  });

  assert.equal(mongoose.connection.readyState, 1, 'MongoDB must be connected');
  const userQuery = User.findOne({
    identityKind: 'development-seed',
    ...(config.developmentIdentitySelector ? { developmentIdentitySelector: config.developmentIdentitySelector } : {}),
  });
  const user = await userQuery.select('+developmentIdentitySelector');
  assert.ok(user, 'A development-seed identity must exist');

  const run = await ProgressionRun.findOne({ userId: user._id, status: 'active' }).sort({ runNumber: -1 });
  assert.ok(run, 'An active ProgressionRun must exist');
  const schedule = await TaskSchedule.findOne({ userId: user._id, progressionRunId: run._id, status: 'active' });
  assert.ok(schedule, 'An active Task Schedule must exist');
  const today = getIstDateKey();
  const scheduleView = await getCurrentTaskSchedule(user._id);
  const [definitions, apiOccurrences] = await Promise.all([
    listCurrentTasks(user._id),
    getCurrentOccurrences(user._id, today, today),
  ]);
  const eligibleApiOccurrences = apiOccurrences.filter((item) => item.date === today && item.cycleDay === scheduleView.todayCycleDay);
  const eligibleApiTaskIds = new Set(eligibleApiOccurrences.map((item) => item.taskId));
  const persistedTodayCount = await TaskOccurrence.countDocuments({
    userId: user._id,
    progressionRunId: run._id,
    taskScheduleId: schedule._id,
    occurrenceDate: today,
    cycleDay: scheduleView.todayCycleDay,
  });
  assert.equal(eligibleApiTaskIds.size, persistedTodayCount, 'The current API response must include every persisted unique Task occurrence for today');
  const activeDefinitions = definitions.filter((item) => item.status === 'active');
  const nextDateDefinitions = activeDefinitions.filter((item) => item.createdEffectiveDate > today && item.cycleDays.includes(scheduleView.todayCycleDay));
  const effectiveAfterToday = activeDefinitions.filter((item) => item.effectiveDate > today && item.cycleDays.includes(scheduleView.todayCycleDay));
  const futureCreatedAfterToday = activeDefinitions.filter((item) => item.createdEffectiveDate > today);
  const todayAssignmentCount = activeDefinitions.filter((item) => item.cycleDays.includes(scheduleView.todayCycleDay)).length;
  const changeEvents = await TaskScheduleChange.countDocuments({ userId: user._id, progressionRunId: run._id, taskScheduleId: schedule._id });
  console.info('MongoDB Task count audit:', {
    activeDefinitions: activeDefinitions.length,
    todayOccurrenceCount: eligibleApiTaskIds.size,
    todayCycleDayAssignments: todayAssignmentCount,
    definitionsStartingAfterToday: nextDateDefinitions.length,
    definitionsEffectiveAfterToday: effectiveAfterToday.length,
    definitionsCreatedAfterToday: futureCreatedAfterToday.length,
    taskChangeEvents: changeEvents,
  });

  const occurrence = await TaskOccurrence.findOne({
    userId: user._id,
    progressionRunId: run._id,
    taskScheduleId: schedule._id,
    occurrenceDate: today,
    status: 'scheduled',
  }).sort({ _id: 1 });
  if (!occurrence) {
    t.skip('No scheduled Task occurrence is available today for a rollback-only completion check.');
    return;
  }

  const before = await TaskOccurrence.findById(occurrence._id).lean();
  const session = await mongoose.startSession();
  const key = `completion-integration-${new mongoose.Types.ObjectId()}`;
  try {
    session.startTransaction();
    const first = await completeCurrentTaskOccurrence({
      userId: user._id,
      occurrenceId: occurrence._id,
      submission: { note: '', fileName: '' },
      idempotencyKey: key,
      transactionSession: session,
    });
    assert.equal(first.occurrence.status, 'completed');
    assert.ok(first.occurrence.completedAt);
    assert.equal(first.idempotentReplay, false);

    const replay = await completeCurrentTaskOccurrence({
      userId: user._id,
      occurrenceId: occurrence._id,
      submission: { note: '', fileName: '' },
      idempotencyKey: key,
      transactionSession: session,
    });
    assert.equal(replay.occurrence.status, 'completed');
    assert.equal(replay.idempotentReplay, true);

    await assert.rejects(
      completeCurrentTaskOccurrence({
        userId: user._id,
        occurrenceId: occurrence._id,
        submission: { note: '', fileName: '' },
        idempotencyKey: `different-${new mongoose.Types.ObjectId()}`,
        transactionSession: session,
      }),
      (error) => error.code === 'TASK_ALREADY_COMPLETED',
    );
  } finally {
    if (session.inTransaction()) await session.abortTransaction();
    await session.endSession();
  }

  const after = await TaskOccurrence.findById(occurrence._id).lean();
  assert.equal(after.status, before.status, 'The rollback must preserve the real occurrence status');
  assert.equal(after.completedAt?.toISOString?.() ?? null, before.completedAt?.toISOString?.() ?? null);
  assert.equal(after.completionIdempotencyKey, before.completionIdempotencyKey);
});

test('MongoDB Task completion persists for a disposable test identity and rejects duplicate completion', { skip: !shouldRun }, async (t) => {
  await connectDatabase();
  t.after(async () => {
    await disconnectDatabase();
  });

  const userId = new mongoose.Types.ObjectId();
  const runId = new mongoose.Types.ObjectId();
  const scheduleId = new mongoose.Types.ObjectId();
  const taskId = new mongoose.Types.ObjectId();
  const occurrenceId = new mongoose.Types.ObjectId();
  const today = getIstDateKey();
  const key = `persist-completion-${new mongoose.Types.ObjectId()}`;

  try {
    await User.create({
      _id: userId,
      identityKind: 'account',
      emailNormalized: `task-completion-${userId}@example.test`,
      accountStatus: 'active',
      memberSince: today,
      currentProgressionRunId: runId,
    });
    await ProgressionRun.create({ _id: runId, userId, runNumber: 1, status: 'active', startedOn: today });
    await TaskSchedule.create({
      _id: scheduleId,
      userId,
      progressionRunId: runId,
      cycleLength: 1,
      cycleAnchorDate: today,
      effectiveStartDate: today,
      idempotencyKey: `schedule-${scheduleId}`,
    });
    await Task.create({
      _id: taskId,
      userId,
      progressionRunId: runId,
      taskScheduleId: scheduleId,
      title: 'Integration test Task',
      description: '',
      cycleDays: [1],
      accountabilityAction: { title: 'Test Action', description: 'Disposable test data.' },
      effectiveDate: today,
      createdEffectiveDate: today,
      idempotencyKey: `task-${taskId}`,
    });
    await TaskOccurrence.create({
      _id: occurrenceId,
      userId,
      progressionRunId: runId,
      taskId,
      taskScheduleId: scheduleId,
      occurrenceDate: today,
      cycleDay: 1,
      snapshot: {
        title: 'Integration test Task',
        description: '',
        accountabilityAction: { title: 'Test Action', description: 'Disposable test data.' },
        revision: 1,
      },
      status: 'scheduled',
    });

    const result = await completeCurrentTaskOccurrence({
      userId,
      occurrenceId,
      submission: { note: '', fileName: '' },
      idempotencyKey: key,
    });
    assert.equal(result.occurrence.status, 'completed');
    assert.ok(result.occurrence.completedAt);
    assert.equal(result.idempotentReplay, false);

    const reloaded = await TaskOccurrence.findById(occurrenceId).lean();
    assert.equal(reloaded.status, 'completed', 'A fresh database read must observe completion, as after a page refresh.');
    assert.ok(reloaded.completedAt);
    assert.deepEqual(reloaded.submission, { note: '', fileName: '' });

    const replay = await completeCurrentTaskOccurrence({
      userId,
      occurrenceId,
      submission: { note: '', fileName: '' },
      idempotencyKey: key,
    });
    assert.equal(replay.idempotentReplay, true);
    await assert.rejects(
      completeCurrentTaskOccurrence({
        userId,
        occurrenceId,
        submission: { note: '', fileName: '' },
        idempotencyKey: `duplicate-${new mongoose.Types.ObjectId()}`,
      }),
      (error) => error.code === 'TASK_ALREADY_COMPLETED',
    );
  } finally {
    await TaskOccurrence.deleteMany({ _id: occurrenceId });
    await Task.deleteMany({ _id: taskId });
    await TaskSchedule.deleteMany({ _id: scheduleId });
    await ProgressionRun.deleteMany({ _id: runId });
    await User.deleteMany({ _id: userId });
  }
});
