import test from 'node:test';
import assert from 'node:assert/strict';
import { definitionAtDate } from '../services/taskOccurrenceService.js';

const snapshot = (title, status = 'active') => ({
  title,
  description: `${title} details`,
  cycleDays: [1],
  accountabilityAction: { title: `${title} action`, description: `${title} action details`, weakness: '' },
  revision: 1,
  status,
});

test('occurrence definition selection preserves the version active on each date', () => {
  const original = snapshot('Original');
  const revised = { ...snapshot('Revised'), revision: 2 };
  const task = { ...revised, effectiveDate: '2026-11-20' };
  const changes = [{ effectiveDate: '2026-11-20', beforeSnapshot: original, afterSnapshot: revised }];

  assert.equal(definitionAtDate(task, '2026-11-19', changes), original);
  assert.equal(definitionAtDate(task, '2026-11-20', changes), revised);
  assert.equal(definitionAtDate(task, '2026-11-19', []), null);
});

test('archived definitions stop future occurrences while preserving earlier versions', () => {
  const active = snapshot('Read');
  const archived = { ...snapshot('Read', 'archived'), revision: 2 };
  const task = { ...archived, effectiveDate: '2026-11-21', status: 'archived' };
  const changes = [{ effectiveDate: '2026-11-21', beforeSnapshot: active, afterSnapshot: archived }];

  assert.equal(definitionAtDate(task, '2026-11-20', changes), active);
  assert.equal(definitionAtDate(task, '2026-11-21', changes), archived);
  assert.equal(definitionAtDate(task, '2026-11-22', changes).status, 'archived');
});

test('a newly added Task is excluded before its next-IST-date effective date', () => {
  const task = { ...snapshot('New Task'), effectiveDate: '2026-11-19', createdEffectiveDate: '2026-11-19' };
  assert.equal(definitionAtDate(task, '2026-11-18', []), null);
  assert.equal(definitionAtDate(task, '2026-11-19', []).title, 'New Task');
});

test('an immutable added event keeps a Task out of prior dates and activates its snapshot at the effective date', () => {
  const active = snapshot('Future Task');
  const task = { ...active, effectiveDate: '2026-11-20', createdEffectiveDate: '2026-11-20' };
  const changes = [{ changeType: 'added', beforeSnapshot: null, afterSnapshot: active, effectiveDate: '2026-11-20' }];

  assert.equal(definitionAtDate(task, '2026-11-19', changes), null);
  assert.equal(definitionAtDate(task, '2026-11-20', changes).title, 'Future Task');
});
