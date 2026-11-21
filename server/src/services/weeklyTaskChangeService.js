import TaskScheduleChange from '../models/TaskScheduleChange.js';
import WeeklyTaskChangeUsage from '../models/WeeklyTaskChangeUsage.js';
import { HttpError } from '../utils/httpErrors.js';
import { WEEKLY_TASK_CHANGE_LIMIT } from '../utils/taskCycle.js';

export const ELIGIBLE_TASK_CHANGE_TYPES = Object.freeze(['edited', 'rescheduled', 'archived']);

export function countEligibleTaskChangeEvents(events) {
  return events.filter((event) => ELIGIBLE_TASK_CHANGE_TYPES.includes(event.changeType)).length;
}

export async function reconcileWeeklyTaskUsage({ userId, progressionRunId, weekStartDate, session }) {
  const usedCount = await TaskScheduleChange.countDocuments({
    userId,
    progressionRunId,
    weekStartDate,
    changeType: { $in: ELIGIBLE_TASK_CHANGE_TYPES },
  }).session(session);

  await WeeklyTaskChangeUsage.updateOne(
    { userId, progressionRunId, weekStartDate },
    {
      $set: { usedCount, maximumSnapshot: WEEKLY_TASK_CHANGE_LIMIT },
      $setOnInsert: { userId, progressionRunId, weekStartDate },
    },
    { upsert: true, session, setDefaultsOnInsert: true },
  );

  return { usedCount, maximum: WEEKLY_TASK_CHANGE_LIMIT };
}

export async function reserveWeeklyTaskChange({ userId, progressionRunId, weekStartDate, session }) {
  const current = await reconcileWeeklyTaskUsage({ userId, progressionRunId, weekStartDate, session });
  if (current.usedCount >= current.maximum) {
    throw new HttpError(409, 'WEEKLY_CHANGE_LIMIT_REACHED', 'No weekly Task changes remain. The allowance resets next Monday in IST.');
  }

  const usage = await WeeklyTaskChangeUsage.findOneAndUpdate(
    {
      userId,
      progressionRunId,
      weekStartDate,
      maximumSnapshot: current.maximum,
      usedCount: current.usedCount,
    },
    { $inc: { usedCount: 1 } },
    { new: true, session },
  );

  if (!usage) {
    throw new HttpError(409, 'WEEKLY_CHANGE_CONFLICT', 'The weekly Task-change allowance changed. Refresh and try again.');
  }
  return usage;
}
