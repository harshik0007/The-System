import Task from '../models/Task.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import TaskSchedule from '../models/TaskSchedule.js';
import TaskScheduleChange from '../models/TaskScheduleChange.js';
import DailyXpRecord from '../models/DailyXpRecord.js';
import ProgressionRun from '../models/ProgressionRun.js';
import User from '../models/User.js';
import XpTransaction from '../models/XpTransaction.js';
import { withMongoTransaction } from './mongoTransaction.js';
import { isEmergencyPauseDateWithinSession, reconcileEmergencyPauseWithinSession } from './emergencyPauseService.js';
import { getCycleDayForDateKey, getInclusiveDateRange } from '../utils/taskCycle.js';
import { getIstDateKey } from '../utils/ist.js';
import { ConflictError, NotFoundError } from '../utils/httpErrors.js';
import { toOccurrenceDto } from '../utils/taskDtos.js';
import { createNotificationWithinSession } from './notificationService.js';
import {
  applyEligibleTaskXpRewardWithinSession,
  buildProgressionXpDto,
  ensureDailyTaskXpAllocationWithinSession,
  ensureDailyXpRecordWithinSession,
} from './progressionXpService.js';

function currentDefinition(task) {
  const action = task.accountabilityAction || {};
  return {
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
  };
}

function definitionAtDate(task, dateKey, changes) {
  const chronological = changes || [];
  const applicable = chronological.filter((change) => change.effectiveDate <= dateKey);
  if (applicable.length) {
    return applicable.at(-1).afterSnapshot;
  }

  const nextChange = chronological.find((change) => change.effectiveDate > dateKey);
  if (nextChange) return nextChange.beforeSnapshot;
  const createdEffectiveDate = task.createdEffectiveDate || task.effectiveDate;
  if (createdEffectiveDate > dateKey) return null;
  return currentDefinition(task);
}

function plainSnapshot(snapshot) {
  if (!snapshot) return null;
  const value = snapshot.toObject?.() ?? snapshot;
  const action = value.accountabilityAction?.toObject?.() ?? value.accountabilityAction ?? {};
  return {
    title: value.title,
    description: value.description || '',
    accountabilityAction: {
      title: action.title,
      description: action.description,
      weakness: action.weakness || '',
    },
    revision: value.revision,
  };
}

/** Must be called with the caller's Mongo session so related writes remain atomic. */
export async function ensureTaskOccurrencesWithinSession({ userId, progressionRunId, schedule, startDate, endDate, session }) {
  const dates = getInclusiveDateRange(startDate, endDate);
  if (!schedule || schedule.status !== 'active') return [];
  const run = await ProgressionRun.findOne({ _id: progressionRunId, userId }).session(session);
  if (run) await reconcileEmergencyPauseWithinSession({ userId, run, now: new Date(), session });
  const currentlyPaused = Boolean(run?.emergencyPause?.active);
  const today = getIstDateKey();
  const protectedDates = new Set();
  for (const dateKey of dates) {
    const protectedDate = await isEmergencyPauseDateWithinSession({ userId, progressionRunId, date: dateKey, run, session });
    if (protectedDate && (currentlyPaused || dateKey < today)) protectedDates.add(dateKey);
  }

  const tasks = await Task.find({
    userId,
    progressionRunId,
    taskScheduleId: schedule._id,
  }).session(session);
  const taskIds = tasks.map((task) => task._id);
  const changes = taskIds.length
    ? await TaskScheduleChange.find({ userId, progressionRunId, taskId: { $in: taskIds } })
      .sort({ effectiveDate: 1, occurredAt: 1, _id: 1 })
      .session(session)
    : [];
  const changesByTask = new Map();
  for (const change of changes) {
    const key = String(change.taskId);
    if (!changesByTask.has(key)) changesByTask.set(key, []);
    changesByTask.get(key).push(change);
  }

  const operations = [];
  for (const dateKey of dates) {
    if (dateKey < schedule.effectiveStartDate || (schedule.effectiveEndDate && dateKey > schedule.effectiveEndDate)) continue;
    if (protectedDates.has(dateKey)) continue;
    const cycleDay = getCycleDayForDateKey(dateKey, schedule.cycleLength, schedule.cycleAnchorDate);
    if (!cycleDay) continue;

    for (const task of tasks) {
      const snapshot = definitionAtDate(task, dateKey, changesByTask.get(String(task._id)) || []);
      if (!snapshot || snapshot.status !== 'active' || !snapshot.cycleDays.includes(cycleDay)) continue;
      operations.push({
        updateOne: {
          filter: { userId, progressionRunId, taskId: task._id, occurrenceDate: dateKey },
          update: {
            $setOnInsert: {
              userId,
              progressionRunId,
              taskId: task._id,
              taskScheduleId: schedule._id,
              occurrenceDate: dateKey,
              cycleDay,
              snapshot: plainSnapshot(snapshot),
              status: 'scheduled',
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (operations.length) {
    await TaskOccurrence.bulkWrite(operations, { session, ordered: false });
  }

  const found = await TaskOccurrence.find({
    userId,
    progressionRunId,
    taskScheduleId: schedule._id,
    occurrenceDate: { $gte: startDate, $lte: endDate },
  }).sort({ occurrenceDate: 1, cycleDay: 1, _id: 1 }).session(session);
  return found.map(toOccurrenceDto);
}

export async function ensureTaskOccurrences({ userId, progressionRunId, schedule, startDate, endDate }) {
  return withMongoTransaction((session) => ensureTaskOccurrencesWithinSession({
    userId,
    progressionRunId,
    schedule,
    startDate,
    endDate,
    session,
  }));
}

export async function ensureOccurrencesForCurrentRun({ userId, startDate, endDate }) {
  return withMongoTransaction(async (session) => {
    const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).session(session);
    if (!run) return [];
    const schedule = await TaskSchedule.findOne({ userId, progressionRunId: run._id, status: 'active' }).session(session);
    if (!schedule) return [];
    return ensureTaskOccurrencesWithinSession({ userId, progressionRunId: run._id, schedule, startDate, endDate, session });
  });
}

export async function completeCurrentTaskOccurrence({ userId, occurrenceId, submission, idempotencyKey, transactionSession = null, now = new Date() }) {
  const operation = async (session) => {
    const user = await User.findById(userId).session(session);
    const run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).session(session);
    if (!user || !run || String(user.currentProgressionRunId || '') !== String(run._id)) {
      throw new NotFoundError('An active progression run is not available.');
    }
    const pause = await reconcileEmergencyPauseWithinSession({ userId, run, now: new Date(now), session });
    if (pause.active) throw new ConflictError('EMERGENCY_PAUSE_ACTIVE', 'Task completion is unavailable during Emergency Pause.');

    const replay = await TaskOccurrence.findOne({
      userId,
      progressionRunId: run._id,
      completionIdempotencyKey: idempotencyKey,
    }).session(session);
    if (replay) {
      if (String(replay._id) !== String(occurrenceId)) {
        throw new ConflictError('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for a different Task completion.');
      }
      const xpTransaction = await XpTransaction.findOne({ userId, progressionRunId: run._id, sourceEventKey: `task-completion:${replay._id}` }).session(session);
      return {
        occurrence: toOccurrenceDto(replay),
        xpReward: xpTransaction ? { transactionId: String(xpTransaction._id), creditedXp: xpTransaction.amount.toString(), idempotentReplay: true } : null,
        rankEntryRewards: [],
        idempotentReplay: true,
      };
    }

    const schedule = await TaskSchedule.findOne({ userId, progressionRunId: run._id, status: 'active' }).session(session);
    if (!schedule) throw new NotFoundError('An active Task Schedule was not found.');
    const today = getIstDateKey(now);
    await ensureTaskOccurrencesWithinSession({ userId, progressionRunId: run._id, schedule, startDate: today, endDate: today, session });
    const occurrence = await TaskOccurrence.findOne({
      _id: occurrenceId,
      userId,
      progressionRunId: run._id,
      taskScheduleId: schedule._id,
      occurrenceDate: today,
    }).session(session);
    if (!occurrence) throw new NotFoundError('The scheduled Task occurrence was not found for today.');
    if (occurrence.status !== 'scheduled') {
      if (occurrence.status === 'completed') throw new ConflictError('TASK_ALREADY_COMPLETED', 'This Task is already completed.');
      throw new ConflictError('TASK_NOT_COMPLETABLE', 'This Task occurrence is not available for completion.');
    }

    const completedAt = new Date(now);
    const updated = await TaskOccurrence.findOneAndUpdate({
      _id: occurrence._id,
      userId,
      progressionRunId: run._id,
      taskScheduleId: schedule._id,
      occurrenceDate: today,
      status: 'scheduled',
    }, {
      $set: {
        status: 'completed',
        completedAt,
        submission: {
          note: submission.note || '',
          fileName: submission.fileName || '',
        },
        completionIdempotencyKey: idempotencyKey,
      },
    }, { new: true, runValidators: true, session });
    if (!updated) throw new ConflictError('TASK_ALREADY_COMPLETED', 'This Task is already completed.');
    await createNotificationWithinSession({
      userId, progressionRunId: run._id, category: 'tasks', eventType: 'task-completed',
      title: 'Task completed', description: `“${updated.snapshot.title}” was completed for ${today}.`,
      targetRoute: `/app/tasks?date=${today}`, idempotencyKey: `task-completed:${updated._id}`,
      occurredAt: completedAt, session,
    });

    const dailyRecord = await ensureDailyXpRecordWithinSession({ userId, run, date: today, occurredAt: completedAt, session });
    const allocationRecord = await ensureDailyTaskXpAllocationWithinSession({
      userId,
      run,
      scheduleId: schedule._id,
      date: today,
      occurredAt: completedAt,
      session,
    });
    const allocation = allocationRecord.allocations.find((item) => String(item.occurrenceId) === String(updated._id));
    if (!allocation) throw new Error('The completed occurrence is missing from its immutable daily XP allocation.');
    const xpReward = await applyEligibleTaskXpRewardWithinSession({ userId, run, occurrence: updated, allocation, dailyRecord, occurredAt: completedAt, session });
    const persistedDailyRecord = await DailyXpRecord.findOne({ userId, date: today }).session(session);
    return {
      occurrence: toOccurrenceDto(updated),
      xpReward: {
        transactionId: String(xpReward.transaction._id),
        baseXp: xpReward.baseXp,
        multiplier: xpReward.multiplier,
        calculatedXp: xpReward.calculatedXp,
        creditedXp: xpReward.creditedXp,
        dailyCap: xpReward.dailyCap,
        dailyXpCredited: xpReward.dailyXpCredited,
        dailyXpRemaining: xpReward.dailyXpRemaining,
        capped: xpReward.capped,
        idempotentReplay: xpReward.idempotentReplay,
      },
      rankEntryRewards: xpReward.rankEntryRewards || [],
      progression: buildProgressionXpDto({ run, dailyRecord: persistedDailyRecord, date: today }),
      idempotentReplay: false,
    };
  };
  return transactionSession ? operation(transactionSession) : withMongoTransaction(operation);
}

export { definitionAtDate };
