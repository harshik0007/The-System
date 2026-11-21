import test from 'node:test';
import assert from 'node:assert/strict';
import { currentScheduleResponse, getCurrentTaskAllowance, getCurrentTaskSchedule, listCurrentTasks } from '../services/taskScheduleService.js';

test('current schedule response is empty when no ProgressionRun exists', () => {
  assert.deepEqual(currentScheduleResponse({ run: null, schedule: null, todayDate: '2026-11-18' }), {
    schedule: null,
    todayDate: '2026-11-18',
    todayCycleDay: null,
  });
});

test('current schedule response is empty when a ProgressionRun exists without a schedule', () => {
  assert.deepEqual(currentScheduleResponse({ run: { _id: 'run-id' }, schedule: null, todayDate: '2026-11-18' }), {
    schedule: null,
    todayDate: '2026-11-18',
    todayCycleDay: null,
  });
});

test('current schedule response includes stored schedule and today cycle day', () => {
  const schedule = {
    _id: 'schedule-id',
    cycleLength: 7,
    cycleAnchorDate: '2026-11-16',
    status: 'active',
    version: 1,
    effectiveStartDate: '2026-11-16',
    effectiveEndDate: null,
  };

  const response = currentScheduleResponse({ run: { _id: 'run-id' }, schedule, todayDate: '2026-11-18' });
  assert.equal(response.schedule.id, 'schedule-id');
  assert.equal(response.schedule.cycleLength, 7);
  assert.equal(response.schedule.todayCycleDay, 3);
  assert.equal(response.todayCycleDay, 3);
});

test('weekly allowance returns its initial 3/3 state without an active ProgressionRun', async () => {
  let reconciled = false;
  const allowance = await getCurrentTaskAllowance('member-id', {
    now: new Date('2026-11-18T06:00:00.000Z'),
    runInTransaction: (work) => work({ id: 'session' }),
    getRun: async () => null,
    reconcileUsage: async () => { reconciled = true; throw new Error('No run should be reconciled.'); },
  });

  assert.equal(reconciled, false);
  assert.deepEqual(allowance, {
    maximum: 3,
    used: 0,
    remaining: 3,
    weekStart: '2026-11-16',
    nextResetAt: '2026-11-22T18:30:00.000Z',
  });
});

test('weekly allowance reconciles usage for the member-owned active run', async () => {
  let reconciledInput;
  const allowance = await getCurrentTaskAllowance('member-id', {
    now: new Date('2026-11-18T06:00:00.000Z'),
    runInTransaction: (work) => work({ id: 'session' }),
    getRun: async (userId, session) => {
      assert.equal(userId, 'member-id');
      assert.equal(session.id, 'session');
      return { _id: 'active-run-id' };
    },
    reconcileUsage: async (input) => {
      reconciledInput = input;
      return { maximum: 3, usedCount: 1 };
    },
  });

  assert.equal(reconciledInput.progressionRunId, 'active-run-id');
  assert.equal(reconciledInput.weekStartDate, '2026-11-16');
  assert.deepEqual({ maximum: allowance.maximum, used: allowance.used, remaining: allowance.remaining }, {
    maximum: 3,
    used: 1,
    remaining: 2,
  });
});

test('three eligible weekly edits leave no remaining allowance', async () => {
  const allowance = await getCurrentTaskAllowance('member-id', {
    now: new Date('2026-11-18T06:00:00.000Z'),
    runInTransaction: (work) => work({ id: 'session' }),
    getRun: async () => ({ _id: 'active-run-id' }),
    reconcileUsage: async () => ({ maximum: 3, usedCount: 3 }),
  });

  assert.deepEqual({ maximum: allowance.maximum, used: allowance.used, remaining: allowance.remaining }, {
    maximum: 3,
    used: 3,
    remaining: 0,
  });
});

test('weekly allowance uses the new Monday IST window after reset', async () => {
  let reconciledWeek;
  const allowance = await getCurrentTaskAllowance('member-id', {
    now: new Date('2026-11-22T18:30:00.000Z'),
    runInTransaction: (work) => work({ id: 'session' }),
    getRun: async () => ({ _id: 'active-run-id' }),
    reconcileUsage: async ({ weekStartDate }) => {
      reconciledWeek = weekStartDate;
      return { maximum: 3, usedCount: 0 };
    },
  });

  assert.equal(reconciledWeek, '2026-11-23');
  assert.equal(allowance.weekStart, '2026-11-23');
  assert.equal(allowance.remaining, 3);
});

test('schedule endpoint safely returns the empty state when the member has no active run', async () => {
  let queriedSchedule = false;
  const response = await getCurrentTaskSchedule('member-id', {
    now: new Date('2026-11-18T06:00:00.000Z'),
    getRun: async () => null,
    findSchedule: async () => { queriedSchedule = true; throw new Error('A missing run has no schedule query.'); },
  });

  assert.equal(queriedSchedule, false);
  assert.deepEqual(response, { schedule: null, todayDate: '2026-11-18', todayCycleDay: null });
});

test('schedule endpoint safely returns the empty state for a run with no schedule', async () => {
  let query;
  const response = await getCurrentTaskSchedule('member-id', {
    now: new Date('2026-11-18T06:00:00.000Z'),
    getRun: async () => ({ _id: 'run-id' }),
    findSchedule: async (filter) => { query = filter; return null; },
  });

  assert.deepEqual(query, { userId: 'member-id', progressionRunId: 'run-id', status: 'active' });
  assert.deepEqual(response, { schedule: null, todayDate: '2026-11-18', todayCycleDay: null });
});

test('task endpoint returns an empty list without a run or active schedule', async () => {
  assert.deepEqual(await listCurrentTasks('member-id', { getRun: async () => null }), []);
  assert.deepEqual(await listCurrentTasks('member-id', {
    getRun: async () => ({ _id: 'run-id' }),
    findSchedule: async () => null,
  }), []);
});

test('task endpoint returns every stored active definition and scopes queries to the member run', async () => {
  let taskFilter;
  let eventFilter;
  const tasks = Array.from({ length: 15 }, (_, index) => ({
    _id: `15-${index}`,
    title: `Task 15-${index}`,
    description: '',
    cycleDays: [1],
    accountabilityAction: { title: 'Action', description: 'Description', weakness: '' },
    status: 'active',
    revision: 1,
  }));
  const results = await listCurrentTasks('member-id', {
    getRun: async () => ({ _id: 'active-run-id' }),
    findSchedule: async (filter) => ({ _id: 'schedule-id', filter }),
    findTasks: (filter) => { taskFilter = filter; return tasks; },
    findAddedEvents: (filter) => { eventFilter = filter; return []; },
  });

  assert.equal(results.length, 15);
  assert.deepEqual(taskFilter, { userId: 'member-id', progressionRunId: 'active-run-id', taskScheduleId: 'schedule-id', status: 'active' });
  assert.deepEqual(eventFilter.taskId.$in, tasks.map(({ _id }) => _id));
  assert.equal(eventFilter.userId, 'member-id');
  assert.equal(eventFilter.progressionRunId, 'active-run-id');
});

for (const taskCount of [7, 10, 15]) {
  test(`task endpoint returns all ${taskCount} stored active definitions`, async () => {
    const tasks = Array.from({ length: taskCount }, (_, index) => ({
      _id: `${taskCount}-${index}`,
      title: `Task ${index + 1}`,
      description: '',
      cycleDays: [1],
      accountabilityAction: { title: 'Action', description: 'Description', weakness: '' },
      status: 'active',
      revision: 1,
    }));
    const result = await listCurrentTasks('member-id', {
      getRun: async () => ({ _id: 'active-run-id' }),
      findSchedule: async () => ({ _id: 'schedule-id' }),
      findTasks: () => tasks,
      findAddedEvents: () => [],
    });

    assert.equal(result.length, taskCount);
  });
}
