import test from 'node:test';
import assert from 'node:assert/strict';
import { toTaskDto } from '../utils/taskDtos.js';

test('Task DTO preserves persisted creation dates and can recover legacy added dates from the immutable event', () => {
  const task = {
    _id: 'task-1',
    title: 'Read',
    description: '',
    cycleDays: [1],
    accountabilityAction: { title: 'Review', description: 'Write a short summary.' },
    revision: 1,
    status: 'active',
    effectiveDate: '2026-11-19',
    createdEffectiveDate: null,
  };

  assert.equal(toTaskDto(task, { addedEffectiveDate: '2026-11-19' }).createdEffectiveDate, '2026-11-19');
  assert.equal(toTaskDto({ ...task, createdEffectiveDate: '2026-11-17' }, { addedEffectiveDate: '2026-11-19' }).createdEffectiveDate, '2026-11-17');
});
