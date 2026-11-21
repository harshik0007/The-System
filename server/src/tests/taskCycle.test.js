import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_ORIGINAL_TASK_MINIMUM,
  MAX_OCCURRENCE_RANGE_DAYS,
  getCycleAnchorDate,
  getCycleDayForDateKey,
  getNextEligibleCycleDate,
  getInclusiveDateRange,
  validateScheduleDefinition,
  validateTaskDefinition,
} from '../utils/taskCycle.js';
import { validateDateRangeRequest, validateTaskRequest } from '../validators/taskValidation.js';

function tasksForCycle(cycleLength) {
  return Array.from({ length: DAILY_ORIGINAL_TASK_MINIMUM }, (_, index) => ({
    title: `Task ${index + 1}`,
    description: '',
    cycleDays: Array.from({ length: cycleLength }, (_value, dayIndex) => dayIndex + 1),
    accountabilityAction: { title: `Action ${index + 1}`, description: 'A defined action.' },
  }));
}

test('seven-day cycles follow Monday through Sunday and Wednesday joins on Day 3', () => {
  const dates = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];
  assert.deepEqual(dates.map((date) => getCycleDayForDateKey(date, 7, '2026-11-16')), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(getCycleAnchorDate(7, undefined, '2026-11-18'), '2026-11-16');
});

test('short cycles use their explicit anchor and repeat by IST calendar date', () => {
  assert.equal(getCycleAnchorDate(3, '2026-11-18', '2026-11-18'), '2026-11-18');
  assert.deepEqual(['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'].map((date) => getCycleDayForDateKey(date, 3, '2026-11-18')), [1, 2, 3, 1, 2]);
  assert.equal(getCycleDayForDateKey('2026-11-17', 3, '2026-11-18'), null);
});

test('future-effective changes select the next matching cycle date after today in IST', () => {
  const tuesday = new Date('2026-11-17T06:00:00.000Z');
  assert.equal(getNextEligibleCycleDate({
    now: tuesday,
    cycleLength: 7,
    cycleAnchorDate: '2026-11-16',
    cycleDays: [5],
  }), '2026-11-20');
  assert.equal(getNextEligibleCycleDate({
    now: tuesday,
    cycleLength: 7,
    cycleAnchorDate: '2026-11-16',
    cycleDays: [1, 4],
  }), '2026-11-19');
});

test('future-effective changes exclude the current IST day and handle short-cycle wrapping', () => {
  const shortlyAfterMidnightIst = new Date('2026-11-17T18:45:00.000Z');
  assert.equal(getNextEligibleCycleDate({
    now: shortlyAfterMidnightIst,
    cycleLength: 7,
    cycleAnchorDate: '2026-11-16',
    cycleDays: [3],
  }), '2026-11-25');
  assert.equal(getNextEligibleCycleDate({
    now: new Date('2026-11-17T06:00:00.000Z'),
    cycleLength: 3,
    cycleAnchorDate: '2026-11-16',
    cycleDays: [1, 3],
  }), '2026-11-18');
  assert.equal(getNextEligibleCycleDate({
    now: new Date('2026-11-17T06:00:00.000Z'),
    cycleLength: 3,
    cycleAnchorDate: '2026-11-20',
    effectiveStartDate: '2026-11-20',
    cycleDays: [2],
  }), '2026-11-21');
});

test('cycles 1 through 7 accept valid coverage and reject fewer than seven Tasks on any day', () => {
  for (let cycleLength = 1; cycleLength <= 7; cycleLength += 1) {
    const result = validateScheduleDefinition({ cycleLength, cycleAnchorDate: '2026-11-16', tasks: tasksForCycle(cycleLength) });
    assert.equal(result.valid, true, `cycle length ${cycleLength}`);
    const insufficient = validateScheduleDefinition({ cycleLength, cycleAnchorDate: '2026-11-16', tasks: tasksForCycle(cycleLength).slice(1) });
    assert.equal(insufficient.valid, false, `cycle length ${cycleLength} rejects six Tasks`);
    assert.ok(insufficient.issues.some((issue) => issue.code === 'INSUFFICIENT_TASKS'));
  }
});

test('schedule validation rejects invalid lengths, assignments, duplicate days and missing actions', () => {
  const invalidLength = validateScheduleDefinition({ cycleLength: 8, tasks: tasksForCycle(7) });
  assert.ok(invalidLength.issues.some((issue) => issue.code === 'INVALID_CYCLE_LENGTH'));
  assert.ok(validateTaskDefinition({ ...tasksForCycle(1)[0], cycleDays: [1, 1] }, 'task', 1).issues.some((issue) => issue.code === 'DUPLICATE_CYCLE_DAY'));
  assert.ok(validateTaskDefinition({ ...tasksForCycle(1)[0], cycleDays: [2] }, 'task', 1).issues.some((issue) => issue.code === 'INVALID_CYCLE_DAY'));
  assert.ok(validateTaskDefinition({ ...tasksForCycle(1)[0], accountabilityAction: {} }, 'task', 1).issues.some((issue) => issue.code === 'ACCOUNTABILITY_ACTION_REQUIRED'));
  assert.throws(() => validateTaskRequest({ title: 'One task', cycleDays: [1], accountabilityAction: {} }, 1), /fields/);
});

test('occurrence date ranges are canonical, inclusive and capped for database work', () => {
  assert.deepEqual(getInclusiveDateRange('2026-11-16', '2026-11-18'), ['2026-11-16', '2026-11-17', '2026-11-18']);
  assert.equal(getInclusiveDateRange('2026-11-16', '2027-02-13').length, MAX_OCCURRENCE_RANGE_DAYS);
  assert.throws(() => getInclusiveDateRange('2026-11-16', '2027-02-14'), /at most/);
  assert.throws(() => validateDateRangeRequest('2026-11-16', '2027-02-14'), /90 days/);
  assert.throws(() => validateDateRangeRequest('16-11-2026', '2026-11-17'), /canonical IST/);
});
