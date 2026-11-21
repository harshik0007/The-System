import test from 'node:test';
import assert from 'node:assert/strict';
import { countEligibleTaskChangeEvents, ELIGIBLE_TASK_CHANGE_TYPES } from '../services/weeklyTaskChangeService.js';
import { validateTaskEditRequest, validateTaskRescheduleRequest } from '../validators/taskValidation.js';

function task(id, cycleDays) {
  return {
    _id: id,
    title: 'Task ' + id,
    description: '',
    cycleDays,
    accountabilityAction: { title: 'Action', description: 'A specific action.', weakness: '' },
    status: 'active',
  };
}

test('weekly usage counts only edits, reschedules, and archived existing Tasks', () => {
  assert.deepEqual(ELIGIBLE_TASK_CHANGE_TYPES, ['edited', 'rescheduled', 'archived']);
  assert.equal(countEligibleTaskChangeEvents([
    { changeType: 'added' },
    { changeType: 'edited' },
    { changeType: 'rescheduled' },
    { changeType: 'archived' },
    { changeType: 'added' },
  ]), 3);
});

test('editing fields consumes one change and cannot alter cycle-day assignments', () => {
  const current = task('one', [1]);
  const next = validateTaskEditRequest({
    currentTask: current,
    patch: { title: 'Updated name', description: 'Updated description', accountabilityAction: { title: 'New action', description: 'New details.' } },
  });
  assert.equal(next.title, 'Updated name');
  assert.deepEqual(next.cycleDays, [1]);
  assert.throws(() => validateTaskEditRequest({ currentTask: current, patch: { cycleDays: [2] } }), /Task edit fields/);
});

test('rescheduling accepts assignments that preserve seven Tasks and rejects a short cycle day', () => {
  const current = task('moving', [1]);
  const validOthers = [
    ...Array.from({ length: 7 }, (_, index) => task('a' + index, [1])),
    ...Array.from({ length: 7 }, (_, index) => task('b' + index, [2])),
  ];
  const moved = validateTaskRescheduleRequest({ currentTask: current, patch: { cycleDays: [2] }, cycleLength: 2, activeTasks: [current, ...validOthers] });
  assert.deepEqual(moved.cycleDays, [2]);

  const insufficientOthers = validOthers.filter((item) => !String(item._id).startsWith('a')).concat(validOthers.filter((item) => String(item._id).startsWith('a')).slice(0, 6));
  assert.throws(
    () => validateTaskRescheduleRequest({ currentTask: current, patch: { cycleDays: [2] }, cycleLength: 2, activeTasks: [current, ...insufficientOthers] }),
    (error) => error.details.some((issue) => issue.code === 'MINIMUM_TASK_COUNT_NOT_MET'),
  );
});
