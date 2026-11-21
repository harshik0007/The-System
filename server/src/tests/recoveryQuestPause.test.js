import test from 'node:test';
import assert from 'node:assert/strict';
import { getEmergencyPauseResumeAt, isEmergencyPauseActive } from '../services/recoveryQuestService.js';
import { getIstMidnightInstant } from '../utils/ist.js';

test('Emergency Pause month key resolves to the first IST midnight of the next month', () => {
  const run = {
    startedAt: new Date('2026-06-30T17:00:00.000Z'),
    emergencyPause: {
      active: true,
      allowanceMonthKey: '2026-06',
      activatedAt: new Date('2026-06-30T17:00:00.000Z'),
      resumesAt: new Date('2026-07-07T17:00:00.000Z'),
    },
  };
  const expected = getIstMidnightInstant('2026-07-01');
  assert.equal(getEmergencyPauseResumeAt(run).getTime(), expected.getTime());
  assert.equal(isEmergencyPauseActive(run, new Date(expected.getTime() - 1)), true);
  assert.equal(isEmergencyPauseActive(run, expected), false);
});

test('a configured early resume wins when it occurs before the month boundary', () => {
  const earlyResume = new Date('2026-06-20T06:30:00.000Z');
  const run = {
    emergencyPause: {
      active: true,
      allowanceMonthKey: '2026-06',
      activatedAt: new Date('2026-06-19T06:30:00.000Z'),
      resumesAt: earlyResume,
    },
  };
  assert.equal(getEmergencyPauseResumeAt(run).getTime(), earlyResume.getTime());
});
