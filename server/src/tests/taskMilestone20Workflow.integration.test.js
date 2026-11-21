import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import ProgressionRun from '../models/ProgressionRun.js';
import Task from '../models/Task.js';
import TaskOccurrence from '../models/TaskOccurrence.js';
import TaskSchedule from '../models/TaskSchedule.js';
import TaskScheduleChange from '../models/TaskScheduleChange.js';
import User from '../models/User.js';
import WeeklyTaskChangeUsage from '../models/WeeklyTaskChangeUsage.js';
import DailyXpRecord from '../models/DailyXpRecord.js';
import DailyTaskXpAllocation from '../models/DailyTaskXpAllocation.js';
import XpTransaction from '../models/XpTransaction.js';
import RankEntryEvent from '../models/RankEntryEvent.js';
import DisciplinePointTransaction from '../models/DisciplinePointTransaction.js';
import Notification from '../models/Notification.js';
import { addIstCalendarDays, getIstDateKey, getIstWeekStart } from '../utils/ist.js';
import { getCycleDayForDateKey } from '../utils/taskCycle.js';
import { selectEligibleTaskOccurrences } from '../../../client/src/utils/taskOccurrenceSelection.js';

const shouldRun = process.env.RUN_MONGO_INTEGRATION === '1';

function taskInput(title, cycleDays) {
  return {
    title,
    description: `Disposable end-to-end fixture for ${title}.`,
    cycleDays,
    accountabilityAction: {
      title: `Action: ${title}`,
      description: `A disposable, task-specific action for ${title}.`,
    },
  };
}

test('Milestone 20 complete Task workflow uses the real API and isolated MongoDB records', { skip: !shouldRun }, async (t) => {
  await connectDatabase();
  t.after(async () => disconnectDatabase());
  assert.equal(mongoose.connection.readyState, 1, 'The configured MongoDB replica set must be connected.');

  const userId = new mongoose.Types.ObjectId();
  const today = getIstDateKey();
  const weekStart = getIstWeekStart(today);
  const tomorrow = addIstCalendarDays(today, 1);
  const disposableUserIds = [userId];
  let apiIdentityId = userId;
  const allCycleDays = [1, 2, 3, 4, 5, 6, 7];
  let server;
  const requests = [];

  try {
    await User.create({
      _id: userId,
      identityKind: 'account',
      emailNormalized: `milestone20-workflow-${userId}@example.test`,
      accountStatus: 'active',
      memberSince: today,
    });

    const app = createApp({
      nodeEnv: 'test',
      databaseReady: () => mongoose.connection.readyState === 1,
      corsOrigins: [],
      testIdentityMiddleware: (request, _response, next) => {
        request.user = { id: String(apiIdentityId), identityKind: 'account' };
        next();
      },
    });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    const api = async (path, { method = 'GET', body, key } = {}) => {
      const headers = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (key) headers['Idempotency-Key'] = key;
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json();
      requests.push({ method, path, status: response.status });
      return { status: response.status, data };
    };

    const emptySchedule = await api('/task-schedules/current');
    assert.equal(emptySchedule.status, 200);
    assert.equal(emptySchedule.data.schedule, null, 'A new identity receives an empty schedule state.');
    assert.equal((await api('/tasks')).data.tasks.length, 0);
    const emptyAllowance = await api('/task-schedule-changes/allowance');
    assert.deepEqual({ maximum: emptyAllowance.data.maximum, used: emptyAllowance.data.used }, { maximum: 3, used: 0 });

    const tooSmallSchedule = await api('/task-schedules', {
      method: 'POST',
      key: `invalid-schedule-${userId}`,
      body: { cycleLength: 7, cycleAnchorDate: weekStart, tasks: Array.from({ length: 6 }, (_, index) => taskInput(`Invalid ${index + 1}`, allCycleDays)) },
    });
    assert.equal(tooSmallSchedule.status, 400, 'The API enforces the seven-original-Task minimum.');
    assert.equal(await ProgressionRun.countDocuments({ userId, status: 'active' }), 0, 'Invalid schedule creation does not initialize a run.');

    const created = await api('/task-schedules', {
      method: 'POST',
      key: `initial-schedule-${userId}`,
      body: {
        cycleLength: 7,
        cycleAnchorDate: weekStart,
        tasks: Array.from({ length: 10 }, (_, index) => taskInput(`Workflow Task ${index + 1}`, allCycleDays)),
      },
    });
    assert.equal(created.status, 201, 'A valid schedule is created through the HTTP API.');
    assert.equal(created.data.tasks.length, 10);
    const activeRun = await ProgressionRun.findOne({ userId, status: 'active' });
    assert.ok(activeRun, 'Initial schedule creation ensures exactly one active ProgressionRun.');
    assert.equal(String((await User.findById(userId).select('currentProgressionRunId')).currentProgressionRunId), String(activeRun._id));
    assert.equal(await ProgressionRun.countDocuments({ userId, status: 'active' }), 1);

    const scheduleResponse = await api('/task-schedules/current');
    const todayCycleDay = scheduleResponse.data.todayCycleDay;
    const tomorrowCycleDay = getCycleDayForDateKey(tomorrow, 7, weekStart);
    const listedTasks = (await api('/tasks')).data.tasks;
    assert.equal(listedTasks.length, 10);
    for (const task of listedTasks) {
      assert.ok(task.accountabilityAction.title, 'Every managed Task has its own Accountability Action title.');
      assert.ok(task.accountabilityAction.description, 'Every managed Task has its own Accountability Action description.');
    }

    const getDateOccurrences = async (date) => (await api(`/task-occurrences?startDate=${date}&endDate=${date}`)).data.occurrences;
    const todayBefore = (await getDateOccurrences(today)).filter((item) => item.cycleDay === todayCycleDay);
    assert.equal(todayBefore.length, 10, 'The current date has all ten original occurrence snapshots.');
    const todaySnapshotByTask = new Map(todayBefore.map((item) => [item.taskId, structuredClone(item.snapshot)]));
    const historyTask = created.data.tasks[2];
    const historicalDate = addIstCalendarDays(today, -1);
    const historicalCycleDay = getCycleDayForDateKey(historicalDate, 7, weekStart);
    const currentHistorySnapshot = todayBefore.find((item) => item.taskId === historyTask.id).snapshot;
    const historicalSnapshot = {
      title: currentHistorySnapshot.title,
      description: currentHistorySnapshot.description,
      accountabilityAction: structuredClone(currentHistorySnapshot.accountabilityAction),
      revision: currentHistorySnapshot.revision,
    };
    const [historicalOccurrence] = await TaskOccurrence.create([{
      userId,
      progressionRunId: activeRun._id,
      taskId: historyTask.id,
      taskScheduleId: created.data.schedule.id,
      occurrenceDate: historicalDate,
      cycleDay: historicalCycleDay,
      snapshot: historicalSnapshot,
      status: 'completed',
      completedAt: new Date(),
    }]);
    const allowanceBefore = await api('/task-schedule-changes/allowance');

    const nextCycleDay = (todayCycleDay % 7) + 1;
    const added = await api('/tasks', {
      method: 'POST',
      key: `free-add-${userId}`,
      body: taskInput('Future-only added Task', [nextCycleDay]),
    });
    assert.equal(added.status, 201);
    assert.ok(added.data.task.effectiveDate > today, 'The added Task starts at its next matching cycle-day occurrence.');
    assert.equal((await api('/task-schedule-changes/allowance')).data.used, allowanceBefore.data.used, 'Adding remains free.');
    const ensureAdded = await api('/task-occurrences/ensure', { method: 'POST', body: { startDate: added.data.task.effectiveDate, endDate: added.data.task.effectiveDate } });
    assert.ok(ensureAdded.data.occurrences.some((item) => item.taskId === added.data.task.id));
    assert.equal((await getDateOccurrences(today)).filter((item) => item.cycleDay === todayCycleDay).length, 10, 'A future-effective addition leaves today’s denominator unchanged.');

    const editTarget = created.data.tasks[0];
    const edited = await api(`/tasks/${editTarget.id}`, {
      method: 'PATCH',
      key: `edit-${userId}`,
      body: { title: 'Edited future Task', description: 'The future definition changed.', accountabilityAction: { title: 'Edited future action', description: 'Future action description.' } },
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.data.task.title, 'Edited future Task');
    assert.equal((await api('/task-schedule-changes/allowance')).data.used, 1, 'Editing consumes one weekly change.');

    const rescheduleTarget = created.data.tasks[1];
    const rescheduled = await api(`/tasks/${rescheduleTarget.id}/reschedule`, {
      method: 'PATCH',
      key: `reschedule-${userId}`,
      body: { cycleDays: allCycleDays.filter((day) => day !== tomorrowCycleDay) },
    });
    assert.equal(rescheduled.status, 200, JSON.stringify(rescheduled.data));
    assert.equal((await api('/task-schedule-changes/allowance')).data.used, 2, 'Rescheduling consumes one weekly change.');

    const deleteTarget = created.data.tasks[2];
    const deleted = await api(`/tasks/${deleteTarget.id}`, { method: 'DELETE', key: `delete-${userId}` });
    assert.equal(deleted.status, 200);
    assert.equal(deleted.data.task.status, 'archived', 'Delete archives the Task instead of removing it.');
    assert.equal(deleted.data.task.effectiveDate, tomorrow, 'The all-cycle-day deletion takes effect at the next matching date.');
    assert.equal((await api('/task-schedule-changes/allowance')).data.used, 3, 'Deletion consumes exactly one additional weekly change.');
    assert.equal((await api('/tasks')).data.tasks.length, 10, 'Ten active definitions remain after add and soft-delete.');

    const todayAfterChanges = (await getDateOccurrences(today)).filter((item) => item.cycleDay === todayCycleDay);
    assert.equal(todayAfterChanges.length, todayBefore.length, 'Edit, reschedule, and delete do not alter today’s scheduled denominator.');
    for (const occurrence of todayAfterChanges) {
      assert.deepEqual(occurrence.snapshot, todaySnapshotByTask.get(occurrence.taskId), 'Today’s immutable Task and Accountability Action snapshots remain unchanged.');
    }
    const retainedHistory = await TaskOccurrence.findById(historicalOccurrence._id).lean();
    assert.ok(retainedHistory, 'The prior-day Task record remains stored.');
    assert.equal(retainedHistory.status, 'completed');
    assert.deepEqual(retainedHistory.snapshot, historicalSnapshot, 'Historical snapshots remain immutable after future changes.');
    const tomorrowOccurrences = await getDateOccurrences(tomorrow);
    assert.ok(!tomorrowOccurrences.some((item) => item.taskId === rescheduleTarget.id), 'Rescheduled Tasks do not appear on removed future cycle days.');
    assert.ok(!tomorrowOccurrences.some((item) => item.taskId === deleteTarget.id), 'Archived Tasks do not generate future occurrences.');
    assert.ok(tomorrowOccurrences.some((item) => item.taskId === added.data.task.id), 'The addition appears on its next matching cycle day.');
    assert.ok(tomorrowOccurrences.some((item) => item.taskId === editTarget.id && item.snapshot.title === 'Edited future Task'), 'Future occurrences use the edited definition.');
    assert.equal(tomorrowOccurrences.length, 9, 'Future Task occurrence count reflects one addition, one reschedule, and one deletion while respecting the seven-Task minimum.');

    const deletedTasksToday = todayAfterChanges.filter((item) => item.taskId === deleteTarget.id);
    assert.equal(deletedTasksToday.length, 1, 'The archived Task’s already-generated occurrence remains available today.');
    const occurrenceToComplete = deletedTasksToday[0];
    const completionKey = `complete-${userId}`;
    const completed = await api(`/task-occurrences/${occurrenceToComplete.id}/complete`, { method: 'POST', key: completionKey, body: {} });
    assert.equal(completed.status, 200, 'An empty proof submission is accepted and completes immediately.');
    assert.equal(completed.data.occurrence.status, 'completed');
    assert.deepEqual({ baseXp: completed.data.xpReward.baseXp, multiplier: completed.data.xpReward.multiplier, creditedXp: completed.data.xpReward.creditedXp }, { baseXp: '30.00', multiplier: 1, creditedXp: '30.00' });
    assert.equal(completed.data.progression.currentRank.slug, 'origin');
    const reloadedToday = (await getDateOccurrences(today)).filter((item) => item.cycleDay === todayCycleDay);
    const reloadedCompletion = reloadedToday.find((item) => item.id === occurrenceToComplete.id);
    assert.equal(reloadedCompletion.status, 'completed', 'A fresh API read observes completion after refresh.');
    assert.deepEqual(reloadedCompletion.submission, { note: '', fileName: '' }, 'Both proof fields are optional.');
    const duplicateReplay = await api(`/task-occurrences/${occurrenceToComplete.id}/complete`, { method: 'POST', key: completionKey, body: {} });
    assert.equal(duplicateReplay.status, 200);
    assert.equal(duplicateReplay.data.idempotentReplay, true, 'Retrying with the same idempotency key does not duplicate completion.');
    const duplicateNewKey = await api(`/task-occurrences/${occurrenceToComplete.id}/complete`, { method: 'POST', key: `duplicate-${userId}`, body: {} });
    assert.equal(duplicateNewKey.status, 409, 'A second completion with a new key is rejected.');
    assert.equal(duplicateNewKey.data.error.code, 'TASK_ALREADY_COMPLETED');

    const dashboardSelection = selectEligibleTaskOccurrences(reloadedToday, today, todayCycleDay);
    assert.equal(dashboardSelection.length, 10, 'The Dashboard selector keeps all scheduled occurrences and completed items in the denominator.');
    assert.equal(dashboardSelection.filter((item) => item.status === 'completed').length, 1);
    assert.equal(300 / dashboardSelection.length, 30, 'The approved daily base-pool denominator remains the unchanged ten original scheduled occurrences.');
    assert.equal((await api('/task-schedule-changes/allowance')).data.used, 3, 'Completion does not consume Task-change allowance.');
    const dailyAllocation = await DailyTaskXpAllocation.findOne({ userId, progressionRunId: activeRun._id, date: today });
    assert.equal(dailyAllocation.totalBaseXpCents, 30_000);
    assert.equal(dailyAllocation.scheduledOccurrenceCount, 10, 'Future-effective Task edits leave the original daily denominator intact.');
    assert.equal(dailyAllocation.allocations.reduce((sum, item) => sum + item.baseXpCents, 0), 30_000);
    const dailyXp = await DailyXpRecord.findOne({ userId, date: today });
    assert.equal(dailyXp.rankAtDayStart, 'origin');
    assert.equal(dailyXp.capAmountCents, 30_000);
    assert.equal(dailyXp.ordinaryXpCreditedCents, 3_000);
    assert.equal(await XpTransaction.countDocuments({ userId, progressionRunId: activeRun._id, type: 'task-completion' }), 1);
    const taskNotificationTypes = new Set(await Notification.find({ userId, category: 'tasks' }).distinct('eventType'));
    for (const eventType of ['task-schedule-created', 'task-schedule-added', 'task-schedule-edited', 'task-schedule-rescheduled', 'task-schedule-archived', 'task-completed']) {
      assert.ok(taskNotificationTypes.has(eventType), `The committed ${eventType} event creates a Tasks notification.`);
    }
    assert.equal(await Notification.countDocuments({ userId, eventType: 'task-completed' }), 1,
      'Repeated completion requests do not create duplicate notifications.');
    assert.equal(await RankEntryEvent.countDocuments({ userId, progressionRunId: activeRun._id }), 0);
    assert.equal(await DisciplinePointTransaction.countDocuments({ userId }), 0);
    const xpSummary = await api('/xp/summary');
    assert.equal(xpSummary.status, 200);
    assert.equal(xpSummary.data.summary.dailyXp.credited, '30.00');
    assert.equal(xpSummary.data.summary.dailyXp.remaining, '270.00');
    assert.equal((await api('/ranks')).data.ranks.length, 7);
    assert.equal((await api('/xp/transactions?limit=1')).data.transactions.length, 1);

    for (const count of [7, 15]) {
      const countUserId = new mongoose.Types.ObjectId();
      disposableUserIds.push(countUserId);
      await User.create({
        _id: countUserId,
        identityKind: 'account',
        emailNormalized: `milestone20-count-${count}-${countUserId}@example.test`,
        accountStatus: 'active',
        memberSince: today,
      });
      apiIdentityId = countUserId;
      const countSchedule = await api('/task-schedules', {
        method: 'POST',
        key: `count-${count}-schedule-${countUserId}`,
        body: {
          cycleLength: 7,
          cycleAnchorDate: weekStart,
          tasks: Array.from({ length: count }, (_, index) => taskInput(`Count ${count} Task ${index + 1}`, allCycleDays)),
        },
      });
      assert.equal(countSchedule.status, 201, `The ${count}-Task fixture schedule is created through the API.`);
      const countScheduleView = await api('/task-schedules/current');
      const countCycleDay = countScheduleView.data.todayCycleDay;
      const countOccurrences = (await getDateOccurrences(today)).filter((item) => item.cycleDay === countCycleDay);
      const dashboardCount = selectEligibleTaskOccurrences(countOccurrences, today, countCycleDay).length;
      assert.equal(dashboardCount, count, `The actual ${count}-Task occurrence set is complete and has no off-by-one truncation.`);
      assert.equal((await api('/tasks')).data.tasks.length, count, `The backend returns every ${count}-Task definition.`);
    }

    console.info('Milestone 20 HTTP workflow requests:', requests);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await Promise.all(disposableUserIds.map((disposableUserId) => Promise.all([
      DailyTaskXpAllocation.deleteMany({ userId: disposableUserId }),
      DailyXpRecord.deleteMany({ userId: disposableUserId }),
      DisciplinePointTransaction.deleteMany({ userId: disposableUserId }),
      RankEntryEvent.deleteMany({ userId: disposableUserId }),
      XpTransaction.deleteMany({ userId: disposableUserId }),
      TaskOccurrence.deleteMany({ userId: disposableUserId }),
      TaskScheduleChange.deleteMany({ userId: disposableUserId }),
      Task.deleteMany({ userId: disposableUserId }),
      TaskSchedule.deleteMany({ userId: disposableUserId }),
      WeeklyTaskChangeUsage.deleteMany({ userId: disposableUserId }),
      ProgressionRun.deleteMany({ userId: disposableUserId }),
      User.deleteOne({ _id: disposableUserId }),
    ])));
  }
});
