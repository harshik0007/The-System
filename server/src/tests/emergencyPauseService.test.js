import test from 'node:test';
import assert from 'node:assert/strict';
import { activateEmergencyPause, calculateEmergencyPauseSchedule } from '../services/emergencyPauseService.js';
import { getIstMidnightInstant } from '../utils/ist.js';

test('Emergency Pause duration is a rolling 24-hour period for each selected day', () => {
  const startedAt = new Date('2026-11-19T03:15:00.000Z');
  const result = calculateEmergencyPauseSchedule(startedAt, 1);
  assert.equal(result.selectedEndAt.toISOString(), '2026-11-20T03:15:00.000Z');
  assert.equal(result.effectiveEndAt.toISOString(), result.selectedEndAt.toISOString());
  assert.equal(result.scheduledEndReason, 'selected-duration');
});

test('Emergency Pause selected duration is capped at the next IST month boundary', () => {
  const startedAt = new Date('2026-11-30T18:00:00.000Z');
  const result = calculateEmergencyPauseSchedule(startedAt, 7);
  const expected = getIstMidnightInstant('2026-12-01');
  assert.equal(result.effectiveEndAt.toISOString(), expected.toISOString());
  assert.ok(result.selectedEndAt > result.effectiveEndAt);
  assert.equal(result.scheduledEndReason, 'monthly-boundary');
});

test('a duration ending exactly at IST month boundary is attributed to the boundary', () => {
  const startedAt = getIstMidnightInstant('2026-11-30');
  const result = calculateEmergencyPauseSchedule(startedAt, 1);
  assert.equal(result.effectiveEndAt.toISOString(), getIstMidnightInstant('2026-12-01').toISOString());
  assert.equal(result.scheduledEndReason, 'monthly-boundary');
});

test('Emergency Pause rejects non-integer and out-of-range durations before database work', async () => {
  for (const durationDays of [0, 8, 1.5, '2']) {
    await assert.rejects(
      activateEmergencyPause({ userId: 'not-read-before-duration-validation', durationDays, idempotencyKey: 'duration-validation-test' }),
      (error) => error.code === 'VALIDATION_ERROR',
    );
  }
});

