import test from 'node:test';
import assert from 'node:assert/strict';
import { getIstDateKey, getIstMonthKey } from '../utils/ist.js';
import { assertMonthKey, dateKeyRangeForInstantInterval, getDetailExpiry, getIstMonthBounds, getRetainedMonthKeys, monthDateBounds, shiftMonthKey } from '../utils/monthlyAnalysis.js';
import { createMonthlyAnalysisRouter } from '../routes/monthlyAnalysisRoutes.js';

test('monthly windows use canonical IST half-open month boundaries', () => {
  const february = getIstMonthBounds('2024-02');
  assert.equal(february.startAt.toISOString(), '2024-01-31T18:30:00.000Z');
  assert.equal(february.endAt.toISOString(), '2024-02-29T18:30:00.000Z');
  const november = getIstMonthBounds('2026-11');
  assert.equal(november.startAt.toISOString(), '2026-10-31T18:30:00.000Z');
  assert.equal(november.endAt.toISOString(), '2026-11-30T18:30:00.000Z');
  assert.equal(getIstDateKey(new Date(november.endAt.getTime() - 1)), '2026-11-30');
  assert.equal(getIstDateKey(november.endAt), '2026-12-01');
});

test('month keys support leap months, variable lengths and December rollover', () => {
  assert.equal(shiftMonthKey('2024-02', -1), '2024-01');
  assert.equal(shiftMonthKey('2026-12', 1), '2027-01');
  assert.equal(getIstMonthBounds('2025-02').endDate, '2025-03-01');
  assert.equal(getIstMonthBounds('2024-02').endDate, '2024-03-01');
  assert.throws(() => assertMonthKey('2026-13'), /YYYY-MM/);
  assert.throws(() => assertMonthKey('2026-2'), /YYYY-MM/);
});

test('detail expiry is the IST boundary two calendar months after the detail month', () => {
  assert.equal(getDetailExpiry('2026-10').toISOString(), '2026-11-30T18:30:00.000Z');
  assert.equal(getDetailExpiry('2026-12').toISOString(), '2027-01-31T18:30:00.000Z');
  assert.deepEqual(getRetainedMonthKeys('2026-11-30T18:29:59.999Z'), ['2026-10', '2026-11']);
  assert.deepEqual(getRetainedMonthKeys('2026-11-30T18:30:00.000Z'), ['2026-11', '2026-12']);
});

test('run coverage starts on the run date and partial reports stop at the current IST date', () => {
  const now = new Date('2026-11-19T18:29:59.000Z');
  const range = monthDateBounds('2026-11', '2026-11-12', now);
  assert.equal(range.coveredFrom, '2026-11-12');
  assert.equal(range.coveredThrough, '2026-11-19');
  assert.equal(range.partial, true);
  assert.equal(getIstMonthKey(now), '2026-11');
});

test('protected calendar dates are derived from half-open instants and IST boundaries', () => {
  assert.deepEqual(dateKeyRangeForInstantInterval('2026-11-30T18:29:59.000Z', '2026-11-30T18:30:00.000Z'), ['2026-11-30']);
  assert.deepEqual(dateKeyRangeForInstantInterval('2026-11-30T18:30:00.000Z', '2026-12-01T18:30:00.000Z'), ['2026-12-01']);
  assert.deepEqual(dateKeyRangeForInstantInterval('2026-11-30T18:30:00.000Z', '2026-12-01T18:30:00.000Z').filter((date) => date.startsWith('2026-11')), []);
});

test('monthly endpoints are mounted behind the shared identity middleware', () => {
  const identity = (_request, _response, next) => next();
  const router = createMonthlyAnalysisRouter({ identityMiddleware: identity });
  assert.equal(router.stack[0].handle, identity);
  const routes = router.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  assert.deepEqual(routes, [
    'GET /monthly-analysis/current',
    'GET /monthly-analysis/previous',
    'GET /monthly-analysis/months',
    'GET /monthly-analysis/compare',
    'GET /monthly-analysis/reminders',
    'GET /monthly-analysis/:monthKey/details',
    'GET /monthly-analysis/:monthKey/pdf',
    'GET /monthly-analysis/:monthKey',
  ]);
});
