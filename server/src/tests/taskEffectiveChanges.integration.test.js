import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import User from '../models/User.js';
import ProgressionRun from '../models/ProgressionRun.js';
import Task from '../models/Task.js';
import TaskSchedule from '../models/TaskSchedule.js';
import TaskScheduleChange from '../models/TaskScheduleChange.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import WeeklyTaskChangeUsage from '../models/WeeklyTaskChangeUsage.js';
import { addTaskToCurrentSchedule, archiveTaskInCurrentSchedule } from '../services/taskManagementService.js';
import { createInitialTaskSchedule, getCurrentOccurrences, getCurrentTaskAllowance } from '../services/taskScheduleService.js';
import { ensureOccurrencesForCurrentRun } from '../services/taskOccurrenceService.js';
import { addIstCalendarDays, getIstDateKey, getIstWeekStart } from '../utils/ist.js';
import { getCycleDayForDateKey, getNextEligibleCycleDate } from '../utils/taskCycle.js';

const shouldRun = process.env.RUN_MONGO_INTEGRATION === '1';

test('MongoDB future-effective add and delete preserve current and historical occurrence snapshots', { skip: !shouldRun }, async (t) => {
  await connectDatabase();
  t.after(async () => disconnectDatabase());
  assert.equal(mongoose.connection.readyState, 1, 'MongoDB must be connected');

  const userId = new mongoose.Types.ObjectId();
  const today = getIstDateKey();
  const now = new Date();
  const weekStart = getIstWeekStart(today);
  let scheduleId;
  let runId;

  try {
    await User.create({
      _id: userId,
      identityKind: 'account',
      emailNormalized: `effective-task-${userId}@example.test`,
      accountStatus: 'active',
      memberSince: today,
    });

    const currentCycleDay = getCycleDayForDateKey(today, 7, weekStart);
    const nextCycleDay = (currentCycleDay % 7) + 1;
    const taskInput = (title, cycleDays) => ({
      title,
      description: `Disposable integration fixture for ${title}.`,
      cycleDays,
      accountabilityAction: { title: `Action for ${title}`, description: 'A test-only scheduled action.' },
    });
    const initial = await createInitialTaskSchedule(userId, {
      cycleLength: 7,
      cycleAnchorDate: weekStart,
      tasks: [
        ...Array.from({ length: 7 }, (_, index) => taskInput(`Baseline ${index + 1}`, [1, 2, 3, 4, 5, 6, 7])),
        taskInput('Today-only fixture', [currentCycleDay]),
      ],
    }, `effective-schedule-${userId}`);
    scheduleId = initial.schedule.id;
    runId = (await ProgressionRun.findOne({ userId, status: 'active' }).select('_id'))._id;
    const deletionTarget = initial.tasks.at(-1);

    const beforeToday = await getCurrentOccurrences(userId, today, today);
    const todayBefore = beforeToday.filter((occurrence) => occurrence.cycleDay === currentCycleDay);
    assert.equal(todayBefore.length, 8, 'The baseline and today-only Task are in today’s immutable occurrence set.');
    const deletionOccurrenceBefore = todayBefore.find((occurrence) => occurrence.taskId === deletionTarget.id);
    assert.ok(deletionOccurrenceBefore, 'The deletion target has a current-day occurrence.');
    const deletionSnapshot = {
      title: deletionOccurrenceBefore.snapshot.title,
      description: deletionOccurrenceBefore.snapshot.description,
      accountabilityAction: structuredClone(deletionOccurrenceBefore.snapshot.accountabilityAction),
      revision: deletionOccurrenceBefore.snapshot.revision,
    };

    const historicalDate = addIstCalendarDays(today, -1);
    const historicalCycleDay = getCycleDayForDateKey(historicalDate, 7, weekStart);
    const historical = await TaskOccurrence.create({
      userId,
      progressionRunId: runId,
      taskId: deletionTarget.id,
      taskScheduleId: scheduleId,
      occurrenceDate: historicalDate,
      cycleDay: historicalCycleDay,
      snapshot: {
        title: 'Historical immutable fixture',
        description: 'Preservation check.',
        accountabilityAction: { title: 'Historical action', description: 'Already recorded.' },
        revision: 1,
      },
      status: 'completed',
      completedAt: new Date(`${historicalDate}T12:00:00.000Z`),
    });
    const historicalSnapshot = structuredClone(historical.snapshot.toObject());

    const allowanceBeforeAdd = await getCurrentTaskAllowance(userId);
    assert.equal(allowanceBeforeAdd.used, 0);
    const addInput = taskInput('Future-only fixture', [nextCycleDay]);
    const addKey = `effective-add-${userId}`;
    const expectedAddDate = getNextEligibleCycleDate({
      now,
      cycleLength: 7,
      cycleAnchorDate: weekStart,
      cycleDays: [nextCycleDay],
    });
    const added = await addTaskToCurrentSchedule(userId, addInput, addKey, { now });
    assert.equal(added.task.effectiveDate, expectedAddDate);
    assert.ok(added.task.effectiveDate > today, 'A new Task never starts on the current IST date.');
    assert.equal((await getCurrentTaskAllowance(userId)).used, 0, 'Adding a Task is free.');

    const afterAddToday = (await getCurrentOccurrences(userId, today, today))
      .filter((occurrence) => occurrence.cycleDay === currentCycleDay);
    assert.equal(afterAddToday.length, todayBefore.length, 'Adding a future Task leaves today’s count and XP denominator unchanged.');
    const addReplay = await addTaskToCurrentSchedule(userId, addInput, addKey, { now });
    assert.equal(addReplay.idempotentReplay, true);
    assert.equal(await Task.countDocuments({ userId, taskScheduleId: scheduleId, title: 'Future-only fixture' }), 1);

    await ensureOccurrencesForCurrentRun({ userId, startDate: expectedAddDate, endDate: expectedAddDate });
    assert.equal(await TaskOccurrence.countDocuments({ userId, taskId: added.task.id, occurrenceDate: expectedAddDate, status: 'scheduled' }), 1);

    const expectedDeleteDate = getNextEligibleCycleDate({
      now,
      cycleLength: 7,
      cycleAnchorDate: weekStart,
      cycleDays: [currentCycleDay],
    });
    await ensureOccurrencesForCurrentRun({ userId, startDate: expectedDeleteDate, endDate: expectedDeleteDate });
    assert.equal(await TaskOccurrence.countDocuments({ userId, taskId: deletionTarget.id, occurrenceDate: expectedDeleteDate, status: 'scheduled' }), 1);

    const deleted = await archiveTaskInCurrentSchedule(userId, deletionTarget.id, `effective-delete-${userId}`, { now });
    assert.equal(deleted.task.status, 'archived');
    assert.equal(deleted.task.effectiveDate, expectedDeleteDate);
    const allowanceAfterDelete = await getCurrentTaskAllowance(userId);
    assert.equal(allowanceAfterDelete.used, 1, 'Only the deletion consumes one weekly change.');

    const currentAfterDelete = await TaskOccurrence.findOne({ userId, taskId: deletionTarget.id, occurrenceDate: today }).lean();
    assert.ok(currentAfterDelete, 'The already-generated current-day occurrence remains available.');
    assert.equal(currentAfterDelete.status, 'scheduled');
    assert.deepEqual(currentAfterDelete.snapshot, deletionSnapshot);
    const historicalAfterDelete = await TaskOccurrence.findById(historical._id).lean();
    assert.ok(historicalAfterDelete, 'Historical Task records are retained.');
    assert.deepEqual(historicalAfterDelete.snapshot, historicalSnapshot);

    await ensureOccurrencesForCurrentRun({ userId, startDate: expectedDeleteDate, endDate: expectedDeleteDate });
    assert.equal(await TaskOccurrence.countDocuments({ userId, taskId: deletionTarget.id, occurrenceDate: expectedDeleteDate }), 0, 'Archived Tasks do not regenerate at or after the effective date.');

    const baselineTask = initial.tasks[0];
    await assert.rejects(
      archiveTaskInCurrentSchedule(userId, baselineTask.id, `effective-rejected-delete-${userId}`, { now }),
      (error) => error.code === 'VALIDATION_ERROR' && error.details.some((issue) => issue.code === 'MINIMUM_TASK_COUNT_NOT_MET'),
    );
    assert.equal((await getCurrentTaskAllowance(userId)).used, 1, 'A rejected deletion does not consume allowance.');
  } finally {
    await Promise.all([
      TaskOccurrence.deleteMany({ userId }),
      TaskScheduleChange.deleteMany({ userId }),
      Task.deleteMany({ userId }),
      TaskSchedule.deleteMany({ userId }),
      WeeklyTaskChangeUsage.deleteMany({ userId }),
      ProgressionRun.deleteMany({ userId }),
      User.deleteOne({ _id: userId }),
    ]);
  }
});
