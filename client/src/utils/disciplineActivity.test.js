import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowHistoricalResetWarning } from './disciplineActivity.js';

test('an unfinalized historical day shows the no-reset-record note without referencing an out-of-scope date', () => {
  const record = { hasDailyResetRecord: false };
  assert.equal(shouldShowHistoricalResetWarning(record, '2026-11-17', '2026-11-19'), true);
});

test('an unfinalized current day does not show the historical no-reset-record note', () => {
  const record = { hasDailyResetRecord: false };
  assert.equal(shouldShowHistoricalResetWarning(record, '2026-11-19', '2026-11-19'), false);
});

test('finalized dates and missing records do not show the historical no-reset-record note', () => {
  assert.equal(shouldShowHistoricalResetWarning({ hasDailyResetRecord: true }, '2026-11-17', '2026-11-19'), false);
  assert.equal(shouldShowHistoricalResetWarning(null, '2026-11-17', '2026-11-19'), false);
});
