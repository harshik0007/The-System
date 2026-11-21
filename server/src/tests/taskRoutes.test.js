import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskRouter } from '../routes/taskRoutes.js';
import { validateScheduleRequest, validateTaskCompletionRequest } from '../validators/taskValidation.js';

test('task routes are mounted behind one identity middleware and expose the documented API surface', () => {
  const identity = (_request, _response, next) => next();
  const router = createTaskRouter({ identityMiddleware: identity });
  assert.equal(router.stack[0].handle, identity);
  const routes = router.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  assert.deepEqual(routes, [
    'GET /task-schedules/current',
    'POST /task-schedules',
    'GET /tasks',
    'GET /tasks/:taskId',
    'POST /tasks',
    'PATCH /tasks/:taskId/reschedule',
    'PATCH /tasks/:taskId',
    'DELETE /tasks/:taskId',
    'GET /task-occurrences',
    'POST /task-occurrences/ensure',
    'POST /task-occurrences/:occurrenceId/complete',
    'GET /task-schedule-changes/allowance',
  ]);
});

test('completion accepts an empty optional proof form and trims supported metadata', () => {
  assert.deepEqual(validateTaskCompletionRequest({}), { note: '', fileName: '' });
  assert.deepEqual(validateTaskCompletionRequest({ note: '  done  ', fileName: ' proof.png ' }), {
    note: 'done',
    fileName: 'proof.png',
  });
  assert.throws(() => validateTaskCompletionRequest({ note: 7 }), /Review the optional completion details/);
  assert.throws(() => validateTaskCompletionRequest({ evidence: 'not accepted' }), /Review the optional completion details/);
  assert.throws(() => validateTaskCompletionRequest({ fileName: 'x'.repeat(256) }), /Review the optional completion details/);
});

test('schedule validation rejects client ownership and run-selection fields', () => {
  const tasks = Array.from({ length: 7 }, (_, index) => ({
    title: `Task ${index + 1}`,
    cycleDays: [1],
    accountabilityAction: { title: 'Action', description: 'Description' },
  }));
  assert.throws(() => validateScheduleRequest({ cycleLength: 1, cycleAnchorDate: '2026-11-18', userId: 'client-owner', tasks }), /Review the schedule/);
  assert.throws(() => validateScheduleRequest({ cycleLength: 1, cycleAnchorDate: '2026-11-18', tasks: tasks.map((task) => ({ ...task, accountabilityAction: { ...task.accountabilityAction, progressionRunId: 'client-run' } })) }), /Review the schedule/);
});

test('schedule API validation rejects insufficient daily coverage and missing Accountability Actions', () => {
  const task = (title) => ({
    title,
    cycleDays: [1],
    accountabilityAction: { title: 'Action', description: 'A specific action.' },
  });
  const validTasks = Array.from({ length: 7 }, (_, index) => task(`Task ${index + 1}`));

  assert.throws(
    () => validateScheduleRequest({ cycleLength: 1, cycleAnchorDate: '2026-11-18', tasks: validTasks.slice(0, 6) }),
    (error) => error.status === 400 && error.details.some(({ code }) => code === 'INSUFFICIENT_TASKS'),
  );
  assert.throws(
    () => validateScheduleRequest({ cycleLength: 1, cycleAnchorDate: '2026-11-18', tasks: validTasks.map((entry, index) => index === 0 ? { ...entry, accountabilityAction: { title: '', description: '' } } : entry) }),
    (error) => error.status === 400 && error.details.some(({ code }) => code === 'ACCOUNTABILITY_ACTION_REQUIRED'),
  );
  assert.doesNotThrow(() => validateScheduleRequest({ cycleLength: 1, cycleAnchorDate: '2026-11-18', tasks: validTasks }));
});
