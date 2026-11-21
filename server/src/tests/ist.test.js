import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertIstDateKey,
  compareIstDateKeys,
  formatIstDateKey,
  getIstDateKey,
  getIstMonthKey,
  getIstWeekStart,
  getNextIstMidnight,
  isValidIstDateKey,
} from '../utils/ist.js';

test('IST date key changes at the India midnight boundary', () => {
  assert.equal(getIstDateKey('2026-11-17T18:29:59.999Z'), '2026-11-17');
  assert.equal(getIstDateKey('2026-11-17T18:30:00.000Z'), '2026-11-18');
  assert.equal(getIstMonthKey('2026-11-30T18:30:00.000Z'), '2026-12');
});

test('next IST midnight is returned as a UTC instant', () => {
  assert.equal(getNextIstMidnight('2026-11-17T18:30:00.000Z').toISOString(), '2026-11-18T18:30:00.000Z');
  assert.equal(getNextIstMidnight('2026-12-31T18:30:00.000Z').toISOString(), '2027-01-01T18:30:00.000Z');
});

test('IST week start is Monday and date keys are canonical calendar dates', () => {
  assert.equal(getIstWeekStart('2026-11-18'), '2026-11-16');
  assert.equal(getIstWeekStart('2026-11-22'), '2026-11-16');
  assert.equal(isValidIstDateKey('2024-02-29'), true);
  assert.equal(isValidIstDateKey('2025-02-29'), false);
  assert.equal(compareIstDateKeys('2026-11-17', '2026-11-18'), -1);
  assert.equal(formatIstDateKey('2026-11-17'), '17 Nov 2026');
  assert.throws(() => assertIstDateKey('17-11-2026'), /YYYY-MM-DD/);
});
