import Task from '../models/Task.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import TaskSchedule from '../models/TaskSchedule.js';
import TaskScheduleChange from '../models/TaskScheduleChange.js';
import { getIstDateKey, getIstWeekStart } from '../utils/ist.js';
import { DAILY_ORIGINAL_TASK_MINIMUM, WEEKLY_TASK_CHANGE_LIMIT, getNextEligibleCycleDate, validateScheduleDefinition } from '../utils/taskCycle.js';
import { toTaskDto, toTaskSnapshot } from '../utils/taskDtos.js';
import { ConflictError, HttpError, NotFoundError, ValidationError } from '../utils/httpErrors.js';
import {
  validateTaskEditRequest,
  validateTaskRequest,
  validateTaskRescheduleRequest,
} from '../validators/taskValidation.js';
import { getActiveProgressionRun } from './progressionRunService.js';
import { getNextEffectiveDate } from './taskScheduleService.js';
import { ensureTaskOccurrencesWithinSession } from './taskOccurrenceService.js';
import { withMongoTransaction } from './mongoTransaction.js';
import { reserveWeeklyTaskChange } from './weeklyTaskChangeService.js';
import { createNotificationWithinSession } from './notificationService.js';

async function notifyScheduleChange({ userId, run, changeType, taskTitle, effectiveDate, idempotencyKey, session }) {
  const action = {
    added: ['Task added to your Schedule', 'added'],
    edited: ['Task updated for future occurrences', 'updated'],
    rescheduled: ['Task rescheduled', 'rescheduled'],
    archived: ['Task removed from future scheduling', 'removed from future scheduling'],
  }[changeType];
  await createNotificationWithinSession({
    userId, progressionRunId: run._id, category: 'tasks', eventType: `task-schedule-${changeType}`,
    title: action[0], description: `“${taskTitle}” was ${action[1]} from ${effectiveDate}. Today's scheduled Tasks remain unchanged.`,
    targetRoute: '/app/tasks', idempotencyKey: `task-schedule-change:${idempotencyKey}`,
    occurredAt: new Date(), session,
  });
}

function plainTask(task) {
  const action = task.accountabilityAction?.toObject?.() ?? task.accountabilityAction ?? {};
  return {
    _id: task._id,
    title: task.title,
    description: task.description || '',
    cycleDays: [...task.cycleDays],
    accountabilityAction: {
      title: action.title || '',
      description: action.description || '',
      weakness: action.weakness || '',
    },
    revision: task.revision,
    status: task.status,
    effectiveDate: task.effectiveDate,
  };
}

async function requireCurrentContext(userId, session) {
  const run = await getActiveProgressionRun(userId, session);
  if (!run) throw new NotFoundError('An active progression run is not available. Create a Task Schedule to begin.');
  const scheduleQuery = TaskSchedule.findOne({ userId, progressionRunId: run._id, status: 'active' });
  if (session) scheduleQuery.session(session);
  const schedule = await scheduleQuery;
  if (!schedule) throw new NotFoundError('An active Task Schedule was not found.');
  return { run, schedule };
}

async function findIdempotentEvent(userId, idempotencyKey, session, expectedTaskId, expectedChangeType) {
  const event = await TaskScheduleChange.findOne({ userId, idempotencyKey }).session(session);
  if (!event) return null;
  if ((expectedTaskId && String(event.taskId) !== String(expectedTaskId)) || (expectedChangeType && event.changeType !== expectedChangeType)) {
    throw new ConflictError('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for a different Task change.');
  }
  const task = await Task.findOne({ _id: event.taskId, userId, progressionRunId: event.progressionRunId }).session(session);
  if (!task) throw new NotFoundError();
  return toTaskDto(task);
}

function operationTransaction(work, transactionSession) {
  return transactionSession ? work(transactionSession) : withMongoTransaction(work);
}

function normalizeTaskInput(input) {
  return {
    title: input.title.trim(),
    description: input.description?.trim() || '',
    cycleDays: [...input.cycleDays].sort((a, b) => a - b),
    accountabilityAction: {
      title: input.accountabilityAction.title.trim(),
      description: input.accountabilityAction.description.trim(),
      weakness: input.weakness?.trim() || input.accountabilityAction.weakness?.trim() || '',
    },
  };
}

async function findAddedTaskReplay({ userId, progressionRunId, idempotencyKey, input, session }) {
  const conflictingEvent = await TaskScheduleChange.findOne({ userId, idempotencyKey }).session(session);
  if (conflictingEvent) {
    if (conflictingEvent.changeType !== 'added') {
      throw new ConflictError('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for a different Task change.');
    }
    const replayTask = await Task.findOne({ _id: conflictingEvent.taskId, userId, progressionRunId }).session(session);
    if (!replayTask) throw new NotFoundError();
    const expected = normalizeTaskInput(input);
    const stored = toTaskSnapshot(conflictingEvent.afterSnapshot);
    const matches = stored.title === expected.title
      && stored.description === expected.description
      && JSON.stringify([...stored.cycleDays].sort((a, b) => a - b)) === JSON.stringify(expected.cycleDays)
      && JSON.stringify(stored.accountabilityAction) === JSON.stringify(expected.accountabilityAction);
    if (!matches) throw new ConflictError('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for a different Task.');
    return { task: toTaskDto(replayTask), idempotentReplay: true };
  }

  const existingTask = await Task.findOne({ userId, progressionRunId, idempotencyKey }).session(session);
  if (!existingTask) return null;
  const expected = normalizeTaskInput(input);
  const stored = toTaskSnapshot(existingTask);
  const matches = stored.title === expected.title
    && stored.description === expected.description
    && JSON.stringify(stored.cycleDays) === JSON.stringify(expected.cycleDays)
    && JSON.stringify(stored.accountabilityAction) === JSON.stringify(expected.accountabilityAction);
  if (!matches) throw new ConflictError('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for a different Task.');
  return { task: toTaskDto(existingTask), idempotentReplay: true };
}

function assertResultingScheduleValid(cycleLength, tasks) {
  const validation = validateScheduleDefinition({ cycleLength, cycleAnchorDate: '2000-01-03', tasks: tasks.map(plainTask) });
  if (!validation.valid) {
    const dayIssues = validation.issues.filter((issue) => issue.code === 'MINIMUM_TASK_COUNT_NOT_MET');
    const detail = dayIssues.map((issue) => `Cycle Day ${issue.cycleDay} must retain at least ${DAILY_ORIGINAL_TASK_MINIMUM} active Tasks.`).join(' ');
    throw new ValidationError(detail || 'This change would leave a cycle day with fewer than seven active Tasks.', validation.issues);
  }
}

async function incrementScheduleVersion(schedule, session) {
  const result = await TaskSchedule.updateOne(
    { _id: schedule._id, userId: schedule.userId, progressionRunId: schedule.progressionRunId, status: 'active', version: schedule.version },
    { $inc: { version: 1 } },
    { session },
  );
  if (result.modifiedCount !== 1) throw new ConflictError('SCHEDULE_CHANGED', 'The Task Schedule changed. Refresh and try again.');
}

function isSameTaskDefinition(before, after, { includeCycleDays = false } = {}) {
  return before.title === after.title
    && before.description === after.description
    && JSON.stringify(before.accountabilityAction) === JSON.stringify(after.accountabilityAction)
    && (!includeCycleDays || JSON.stringify(before.cycleDays) === JSON.stringify(after.cycleDays));
}

async function updateFutureSnapshots({ userId, run, task, snapshot, effectiveDate, session }) {
  await TaskOccurrence.updateMany(
    { userId, progressionRunId: run._id, taskId: task._id, occurrenceDate: { $gte: effectiveDate }, cycleDay: { $in: snapshot.cycleDays }, status: 'scheduled' },
    { $set: { snapshot: {
      title: snapshot.title,
      description: snapshot.description,
      accountabilityAction: snapshot.accountabilityAction,
      revision: snapshot.revision,
    } } },
    { session },
  );
  await TaskOccurrence.deleteMany(
    { userId, progressionRunId: run._id, taskId: task._id, occurrenceDate: { $gte: effectiveDate }, cycleDay: { $nin: snapshot.cycleDays }, status: 'scheduled' },
    { session },
  );
}

export async function getTaskForCurrentRun(userId, taskId) {
  const { run, schedule } = await requireCurrentContext(userId);
  const task = await Task.findOne({ _id: taskId, userId, progressionRunId: run._id, taskScheduleId: schedule._id });
  if (!task) throw new NotFoundError('The Task was not found in the current progression run.');
  return toTaskDto(task);
}

/** A new Task is free and starts on its next assigned cycle-day occurrence. */
export async function addTaskToCurrentSchedule(userId, input, idempotencyKey, { transactionSession = null, now = new Date() } = {}) {
  return operationTransaction(async (session) => {
    const { run, schedule } = await requireCurrentContext(userId, session);
    const replay = await findAddedTaskReplay({ userId, progressionRunId: run._id, idempotencyKey, input, session });
    if (replay) return replay;
    validateTaskRequest(input, schedule.cycleLength);

    const activeTasks = await Task.find({ userId, progressionRunId: run._id, taskScheduleId: schedule._id, status: 'active' }).session(session);
    const taskData = normalizeTaskInput(input);
    assertResultingScheduleValid(schedule.cycleLength, [...activeTasks, taskData]);

    const effectiveDate = getNextEligibleCycleDate({
      now,
      cycleLength: schedule.cycleLength,
      cycleAnchorDate: schedule.cycleAnchorDate,
      cycleDays: taskData.cycleDays,
      effectiveStartDate: schedule.effectiveStartDate,
    });
    const [task] = await Task.create([{
      ...taskData,
      userId,
      progressionRunId: run._id,
      taskScheduleId: schedule._id,
      revision: 1,
      status: 'active',
      effectiveDate,
      createdEffectiveDate: effectiveDate,
      idempotencyKey,
    }], { session });
    await incrementScheduleVersion(schedule, session);
    await TaskScheduleChange.create([{
      userId,
      progressionRunId: run._id,
      taskScheduleId: schedule._id,
      taskId: task._id,
      changeType: 'added',
      beforeSnapshot: null,
      afterSnapshot: toTaskSnapshot(task),
      effectiveDate,
      weekStartDate: getIstWeekStart(getIstDateKey(now)),
      scheduleVersion: schedule.version + 1,
      idempotencyKey,
      occurredAt: now,
    }], { session });
    await notifyScheduleChange({ userId, run, changeType: 'added', taskTitle: task.title, effectiveDate, idempotencyKey, session });
    await ensureTaskOccurrencesWithinSession({
      userId,
      progressionRunId: run._id,
      schedule,
      startDate: effectiveDate,
      endDate: effectiveDate,
      session,
    });

    return { task: toTaskDto(task), idempotentReplay: false };
  }, transactionSession);
}

export async function editTaskInCurrentSchedule(userId, taskId, patch, idempotencyKey, { transactionSession = null } = {}) {
  return operationTransaction(async (session) => {
    const replay = await findIdempotentEvent(userId, idempotencyKey, session, taskId, 'edited');
    if (replay) return { task: replay, idempotentReplay: true };
    const { run, schedule } = await requireCurrentContext(userId, session);
    const task = await Task.findOne({ _id: taskId, userId, progressionRunId: run._id, taskScheduleId: schedule._id }).session(session);
    if (!task) throw new NotFoundError('The Task was not found in the current progression run.');
    if (task.status !== 'active') throw new ConflictError('TASK_ARCHIVED', 'Archived Tasks cannot be edited.');

    const beforeSnapshot = toTaskSnapshot(task);
    const next = validateTaskEditRequest({ currentTask: plainTask(task), patch });
    const afterSnapshot = {
      ...beforeSnapshot,
      title: next.title.trim(),
      description: next.description?.trim() || '',
      accountabilityAction: {
        title: next.accountabilityAction.title.trim(),
        description: next.accountabilityAction.description.trim(),
        weakness: beforeSnapshot.accountabilityAction.weakness || '',
      },
      revision: task.revision + 1,
      status: 'active',
    };
    if (isSameTaskDefinition(beforeSnapshot, afterSnapshot)) {
      throw new ValidationError('No Task fields have changed.', [{ field: 'task', code: 'NO_CHANGES' }]);
    }

    const now = new Date();
    const effectiveDate = getNextEffectiveDate(now);
    const weekStartDate = getIstWeekStart(getIstDateKey(now));
    await reserveWeeklyTaskChange({ userId, progressionRunId: run._id, weekStartDate, session });
    const updateResult = await Task.updateOne(
      { _id: task._id, userId, progressionRunId: run._id, taskScheduleId: schedule._id, status: 'active', revision: task.revision },
      { $set: {
        title: afterSnapshot.title,
        description: afterSnapshot.description,
        accountabilityAction: afterSnapshot.accountabilityAction,
        effectiveDate,
      }, $inc: { revision: 1 } },
      { session },
    );
    if (updateResult.modifiedCount !== 1) throw new ConflictError('TASK_CHANGED', 'The Task changed. Refresh and try again.');
    await incrementScheduleVersion(schedule, session);
    await updateFutureSnapshots({ userId, run, task, snapshot: afterSnapshot, effectiveDate, session });
    await TaskScheduleChange.create([{
      userId,
      progressionRunId: run._id,
      taskScheduleId: schedule._id,
      taskId: task._id,
      changeType: 'edited',
      beforeSnapshot,
      afterSnapshot,
      effectiveDate,
      weekStartDate,
      scheduleVersion: schedule.version + 1,
      idempotencyKey,
      occurredAt: now,
    }], { session });
    await notifyScheduleChange({ userId, run, changeType: 'edited', taskTitle: afterSnapshot.title, effectiveDate, idempotencyKey, session });

    const updated = await Task.findOne({ _id: task._id, userId, progressionRunId: run._id, taskScheduleId: schedule._id }).session(session);
    return { task: toTaskDto(updated), idempotentReplay: false };
  }, transactionSession);
}

export async function rescheduleTaskInCurrentSchedule(userId, taskId, patch, idempotencyKey, { transactionSession = null } = {}) {
  return operationTransaction(async (session) => {
    const replay = await findIdempotentEvent(userId, idempotencyKey, session, taskId, 'rescheduled');
    if (replay) return { task: replay, idempotentReplay: true };
    const { run, schedule } = await requireCurrentContext(userId, session);
    const task = await Task.findOne({ _id: taskId, userId, progressionRunId: run._id, taskScheduleId: schedule._id }).session(session);
    if (!task) throw new NotFoundError('The Task was not found in the current progression run.');
    if (task.status !== 'active') throw new ConflictError('TASK_ARCHIVED', 'Archived Tasks cannot be rescheduled.');

    const activeTasks = await Task.find({ userId, progressionRunId: run._id, taskScheduleId: schedule._id, status: 'active' }).session(session);
    const beforeSnapshot = toTaskSnapshot(task);
    // The cycle validator operates on plain task definitions. Mongoose documents
    // do not expose their schema fields through object spread, so normalize the
    // full active set before checking the resulting day-by-day minimums.
    const next = validateTaskRescheduleRequest({
      currentTask: plainTask(task),
      patch,
      cycleLength: schedule.cycleLength,
      activeTasks: activeTasks.map(plainTask),
    });
    const afterSnapshot = { ...beforeSnapshot, cycleDays: [...next.cycleDays].sort((a, b) => a - b), revision: task.revision + 1 };
    if (JSON.stringify(beforeSnapshot.cycleDays) === JSON.stringify(afterSnapshot.cycleDays)) {
      throw new ValidationError('Choose at least one different cycle day.', [{ field: 'cycleDays', code: 'NO_CHANGES' }]);
    }

    const now = new Date();
    const effectiveDate = getNextEffectiveDate(now);
    const weekStartDate = getIstWeekStart(getIstDateKey(now));
    await reserveWeeklyTaskChange({ userId, progressionRunId: run._id, weekStartDate, session });
    const updateResult = await Task.updateOne(
      { _id: task._id, userId, progressionRunId: run._id, taskScheduleId: schedule._id, status: 'active', revision: task.revision },
      { $set: { cycleDays: afterSnapshot.cycleDays, effectiveDate }, $inc: { revision: 1 } },
      { session },
    );
    if (updateResult.modifiedCount !== 1) throw new ConflictError('TASK_CHANGED', 'The Task changed. Refresh and try again.');
    await incrementScheduleVersion(schedule, session);
    await updateFutureSnapshots({ userId, run, task, snapshot: afterSnapshot, effectiveDate, session });
    await TaskScheduleChange.create([{
      userId,
      progressionRunId: run._id,
      taskScheduleId: schedule._id,
      taskId: task._id,
      changeType: 'rescheduled',
      beforeSnapshot,
      afterSnapshot,
      effectiveDate,
      weekStartDate,
      scheduleVersion: schedule.version + 1,
      idempotencyKey,
      occurredAt: now,
    }], { session });
    await notifyScheduleChange({ userId, run, changeType: 'rescheduled', taskTitle: afterSnapshot.title, effectiveDate, idempotencyKey, session });

    const updated = await Task.findOne({ _id: task._id, userId, progressionRunId: run._id, taskScheduleId: schedule._id }).session(session);
    return { task: toTaskDto(updated), idempotentReplay: false };
  }, transactionSession);
}

export async function archiveTaskInCurrentSchedule(userId, taskId, idempotencyKey, { transactionSession = null, now = new Date() } = {}) {
  return operationTransaction(async (session) => {
    const replay = await findIdempotentEvent(userId, idempotencyKey, session, taskId, 'archived');
    if (replay) return { task: replay, idempotentReplay: true };
    const { run, schedule } = await requireCurrentContext(userId, session);
    const task = await Task.findOne({ _id: taskId, userId, progressionRunId: run._id, taskScheduleId: schedule._id }).session(session);
    if (!task) throw new NotFoundError('The Task was not found in the current progression run.');
    if (task.status !== 'active') throw new ConflictError('TASK_ARCHIVED', 'This Task has already been deleted from future scheduling.');

    const activeTasks = await Task.find({ userId, progressionRunId: run._id, taskScheduleId: schedule._id, status: 'active', _id: { $ne: task._id } }).session(session);
    assertResultingScheduleValid(schedule.cycleLength, activeTasks);

    const effectiveDate = getNextEligibleCycleDate({
      now,
      cycleLength: schedule.cycleLength,
      cycleAnchorDate: schedule.cycleAnchorDate,
      cycleDays: task.cycleDays,
      effectiveStartDate: schedule.effectiveStartDate,
    });
    const weekStartDate = getIstWeekStart(getIstDateKey(now));
    const beforeSnapshot = toTaskSnapshot(task);
    const afterSnapshot = { ...beforeSnapshot, status: 'archived', revision: task.revision + 1 };
    await reserveWeeklyTaskChange({ userId, progressionRunId: run._id, weekStartDate, session });
    const updateResult = await Task.updateOne(
      { _id: task._id, userId, progressionRunId: run._id, taskScheduleId: schedule._id, status: 'active', revision: task.revision },
      { $set: { status: 'archived', effectiveDate, archivedAt: now }, $inc: { revision: 1 } },
      { session },
    );
    if (updateResult.modifiedCount !== 1) throw new ConflictError('TASK_CHANGED', 'The Task changed. Refresh and try again.');
    await incrementScheduleVersion(schedule, session);
    await TaskOccurrence.deleteMany({
      userId,
      progressionRunId: run._id,
      taskId: task._id,
      occurrenceDate: { $gte: effectiveDate },
      status: 'scheduled',
    }, { session });
    await TaskScheduleChange.create([{
      userId,
      progressionRunId: run._id,
      taskScheduleId: schedule._id,
      taskId: task._id,
      changeType: 'archived',
      beforeSnapshot,
      afterSnapshot,
      effectiveDate,
      weekStartDate,
      scheduleVersion: schedule.version + 1,
      idempotencyKey,
      occurredAt: now,
    }], { session });
    await notifyScheduleChange({ userId, run, changeType: 'archived', taskTitle: beforeSnapshot.title, effectiveDate, idempotencyKey, session });
    const updated = await Task.findOne({ _id: task._id, userId, progressionRunId: run._id, taskScheduleId: schedule._id }).session(session);
    return { task: toTaskDto(updated), idempotentReplay: false };
  }, transactionSession);
}

export { WEEKLY_TASK_CHANGE_LIMIT, DAILY_ORIGINAL_TASK_MINIMUM };
