import test from 'node:test';
import assert from 'node:assert/strict';
import { selectEligibleTaskOccurrences } from './taskOccurrenceSelection.js';

const makeOccurrences = (count, { date = '2026-11-18', cycleDay = 3, completedEvery = 0 } = {}) => Array.from({ length: count }, (_, index) => ({
  id: `occ-${index + 1}`,
  taskId: `task-${index + 1}`,
  date,
  cycleDay,
  status: completedEvery && (index + 1) % completedEvery === 0 ? 'completed' : 'scheduled',
}));

test('Dashboard selection preserves every eligible Task count from 7 through 15 without a list cap', () => {
  for (const count of [7, 8, 9, 10, 11, 15]) {
    const selected = selectEligibleTaskOccurrences(makeOccurrences(count), '2026-11-18', 3);
    assert.equal(selected.length, count);
  }
});

test('completed occurrences remain in the scheduled denominator', () => {
  const selected = selectEligibleTaskOccurrences(makeOccurrences(10, { completedEvery: 2 }), '2026-11-18', 3);
  assert.equal(selected.length, 10);
  assert.equal(selected.filter((occurrence) => occurrence.status === 'completed').length, 5);
});

test('selection ignores other IST dates and cycle days and removes duplicate Task occurrence rows', () => {
  const source = [
    ...makeOccurrences(2),
    { id: 'duplicate', taskId: 'task-1', date: '2026-11-18', cycleDay: 3, status: 'scheduled' },
    { id: 'other-date', taskId: 'task-x', date: '2026-11-19', cycleDay: 3, status: 'scheduled' },
    { id: 'other-day', taskId: 'task-y', date: '2026-11-18', cycleDay: 2, status: 'scheduled' },
  ];
  const selected = selectEligibleTaskOccurrences(source, '2026-11-18', 3);
  assert.equal(selected.length, 2);
  assert.deepEqual(selected.map((occurrence) => occurrence.id), ['occ-1', 'occ-2']);
});
