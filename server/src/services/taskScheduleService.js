import ProgressionRun from '../models/ProgressionRun.js';
import Task from '../models/Task.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import TaskSchedule from '../models/TaskSchedule.js';
import TaskScheduleChange from '../models/TaskScheduleChange.js';
import { HttpError, NotFoundError, ValidationError } from '../utils/httpErrors.js';
import { addIstCalendarDays, getIstDateKey, getIstWeekStart, getNextIstWeekReset } from '../utils/ist.js';
import { getCycleAnchorDate, getCycleDayForDateKey, validateScheduleDefinition, WEEKLY_TASK_CHANGE_LIMIT } from '../utils/taskCycle.js';
import { toOccurrenceDto, toScheduleDto, toTaskDto } from '../utils/taskDtos.js';
import { getActiveProgressionRun, ensureActiveProgressionRun } from './progressionRunService.js';
import { ensureTaskOccurrencesWithinSession } from './taskOccurrenceService.js';
import { withMongoTransaction } from './mongoTransaction.js';
import { reconcileWeeklyTaskUsage } from './weeklyTaskChangeService.js';
import { createNotificationWithinSession } from './notificationService.js';

function normalizeTask(task) {
  return {
    title: task.title.trim(),
    description: task.description?.trim() || '',
    cycleDays: [...task.cycleDays].sort((a, b) => a - b),
    accountabilityAction: {
      title: task.accountabilityAction.title.trim(),
      description: task.accountabilityAction.description.trim(),
      weakness: task.weakness?.trim() || task.accountabilityAction.weakness?.trim() || '',
    },
  };
}

function assertScheduleValid(input) {
  const validation = validateScheduleDefinition(input);
  if (!validation.valid) throw new ValidationError('Review the schedule fields and cycle-day assignments.', validation.issues);
  return validation;
}

function scheduleView(schedule, dateKey) {
  if (!schedule) return null;
  const cycleDay = getCycleDayForDateKey(dateKey, schedule.cycleLength, schedule.cycleAnchorDate);
  return toScheduleDto(schedule, dateKey, cycleDay);
}

export function currentScheduleResponse({ run, schedule, todayDate }) {
  const hasSchedule = Boolean(run && schedule);
  return {
    schedule: hasSchedule ? scheduleView(schedule, todayDate) : null,
    todayDate,
    todayCycleDay: hasSchedule ? getCycleDayForDateKey(todayDate, schedule.cycleLength, schedule.cycleAnchorDate) : null,
  };
}

export async function getCurrentTaskSchedule(userId, {
  now = new Date(),
  getRun = getActiveProgressionRun,
  findSchedule = (filter) => TaskSchedule.findOne(filter),
} = {}) {
  const todayDate = getIstDateKey(now);
  const run = await getRun(userId);
  const schedule = run
    ? await findSchedule({ userId, progressionRunId: run._id, status: 'active' })
    : null;
  return currentScheduleResponse({ run, schedule, todayDate });
}

export async function listCurrentTasks(userId, {
  getRun = getActiveProgressionRun,
  findSchedule = (filter) => TaskSchedule.findOne(filter),
  findTasks = (filter) => Task.find(filter),
  findAddedEvents = (filter) => TaskScheduleChange.find(filter),
} = {}) {
  const run = await getRun(userId);
  if (!run) return [];
  let scheduleQuery = findSchedule({ userId, progressionRunId: run._id, status: 'active' });
  if (typeof scheduleQuery.select === 'function') scheduleQuery = scheduleQuery.select('_id');
  const schedule = await scheduleQuery;
  if (!schedule) return [];
  let taskQuery = findTasks({ userId, progressionRunId: run._id, taskScheduleId: schedule._id, status: 'active' });
  if (!Array.isArray(taskQuery) && typeof taskQuery.sort === 'function') taskQuery = taskQuery.sort({ createdAt: 1, _id: 1 });
  const tasks = await taskQuery;
  const taskIds = tasks.map((task) => task._id);
  let additions = [];
  if (taskIds.length) {
    let eventQuery = findAddedEvents({ userId, progressionRunId: run._id, taskScheduleId: schedule._id, taskId: { $in: taskIds }, changeType: 'added' });
    if (typeof eventQuery.select === 'function') eventQuery = eventQuery.select('taskId effectiveDate');
    if (!Array.isArray(eventQuery) && typeof eventQuery.sort === 'function') eventQuery = eventQuery.sort({ occurredAt: 1, _id: 1 });
    additions = await eventQuery;
  }
  const addedEffectiveDates = new Map();
  for (const event of additions) {
    const key = String(event.taskId);
    if (!addedEffectiveDates.has(key)) addedEffectiveDates.set(key, event.effectiveDate);
  }
  return tasks.map((task) => toTaskDto(task, { addedEffectiveDate: addedEffectiveDates.get(String(task._id)) || null }));
}

export async function getCurrentTaskAllowance(userId, {
  now = new Date(),
  runInTransaction = withMongoTransaction,
  getRun = getActiveProgressionRun,
  reconcileUsage = reconcileWeeklyTaskUsage,
} = {}) {
  const today = getIstDateKey(now);
  const weekStart = getIstWeekStart(today);
  const usage = await runInTransaction(async (session) => {
    const run = await getRun(userId, session);
    if (!run) return { maximum: WEEKLY_TASK_CHANGE_LIMIT, usedCount: 0 };
    return reconcileUsage({ userId, progressionRunId: run._id, weekStartDate: weekStart, session });
  });
  const maximum = usage.maximum;
  const used = usage.usedCount;
  return {
    maximum,
    used,
    remaining: Math.max(0, maximum - used),
    weekStart,
    nextResetAt: getNextIstWeekReset(now).toISOString(),
  };
}

export async function getCurrentOccurrences(userId, startDate, endDate) {
  const run = await getActiveProgressionRun(userId);
  if (!run) return [];
  const schedule = await TaskSchedule.findOne({ userId, progressionRunId: run._id, status: 'active' });
  if (!schedule) return [];
  const found = await TaskOccurrence.find({
    userId,
    progressionRunId: run._id,
    taskScheduleId: schedule._id,
    occurrenceDate: { $gte: startDate, $lte: endDate },
  }).sort({ occurrenceDate: 1, cycleDay: 1, _id: 1 });
  return found.map(toOccurrenceDto);
}

export async function createInitialTaskSchedule(userId, input, idempotencyKey, { transactionSession = null } = {}) {
  const preliminary = assertScheduleValid(input);
  void preliminary;
  const today = getIstDateKey();
  const anchorDate = getCycleAnchorDate(input.cycleLength, input.cycleAnchorDate, today);
  const effectiveStartDate = anchorDate > today ? anchorDate : today;
  const tasksToCreate = input.tasks.map(normalizeTask);

  const createWithinTransaction = async (session) => {
    const run = await ensureActiveProgressionRun(userId, session);
    const prior = await TaskSchedule.findOne({ userId, progressionRunId: run._id, idempotencyKey }).session(session);
    if (prior) {
      const existingTasks = await Task.find({ userId, progressionRunId: run._id, taskScheduleId: prior._id }).sort({ createdAt: 1 }).session(session);
      const existingOccurrences = await TaskOccurrence.find({ userId, progressionRunId: run._id, taskScheduleId: prior._id, occurrenceDate: prior.effectiveStartDate }).session(session);
      const view = scheduleView(prior, today);
      return { schedule: view, tasks: existingTasks.map(toTaskDto), occurrences: existingOccurrences.map(toOccurrenceDto), idempotentReplay: true };
    }

    const active = await TaskSchedule.findOne({ userId, progressionRunId: run._id, status: 'active' }).session(session);
    if (active) throw new HttpError(409, 'ACTIVE_SCHEDULE_EXISTS', 'A Task Schedule is already active for this progression run.');

    const [createdSchedule] = await TaskSchedule.create([{
      userId,
      progressionRunId: run._id,
      cycleLength: input.cycleLength,
      cycleAnchorDate: anchorDate,
      status: 'active',
      version: 1,
      effectiveStartDate,
      effectiveEndDate: null,
      idempotencyKey,
    }], { session });

    const createdTasks = await Task.create(tasksToCreate.map((task) => ({
      ...task,
      userId,
      progressionRunId: run._id,
      taskScheduleId: createdSchedule._id,
      revision: 1,
      status: 'active',
      effectiveDate: effectiveStartDate,
      createdEffectiveDate: effectiveStartDate,
    })), { session, ordered: true });

    await ProgressionRun.updateOne({ _id: run._id, userId, status: 'active' }, { $set: { taskScheduleId: createdSchedule._id } }, { session });
    const occurrences = await ensureTaskOccurrencesWithinSession({
      userId,
      progressionRunId: run._id,
      schedule: createdSchedule,
      startDate: effectiveStartDate,
      endDate: effectiveStartDate,
      session,
    });
    await createNotificationWithinSession({
      userId, progressionRunId: run._id, category: 'tasks', eventType: 'task-schedule-created',
      title: 'Daily Task Schedule created',
      description: `Your ${input.cycleLength}-day Task Schedule is active. Its first occurrence begins ${effectiveStartDate}.`,
      targetRoute: '/app/tasks', idempotencyKey: `task-schedule-created:${createdSchedule._id}`,
      occurredAt: createdSchedule.createdAt || new Date(), session,
    });

    return {
      schedule: scheduleView(createdSchedule, today),
      tasks: createdTasks.map(toTaskDto),
      occurrences,
      idempotentReplay: false,
    };
  };

  return transactionSession
    ? createWithinTransaction(transactionSession)
    : withMongoTransaction(createWithinTransaction);
}

export async function findCurrentScheduleModels(userId, session) {
  const run = await getActiveProgressionRun(userId, session);
  if (!run) return { run: null, schedule: null };
  const query = TaskSchedule.findOne({ userId, progressionRunId: run._id, status: 'active' });
  if (session) query.session(session);
  return { run, schedule: await query };
}

export function getNextEffectiveDate(now = new Date()) {
  return addIstCalendarDays(getIstDateKey(now), 1);
}
