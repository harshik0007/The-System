import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveDisciplineRewardCycleCalendar,
  getDisciplineRewardCycleCalendarStatus,
  initializeDisciplineRewardCycleCalendar,
} from '../utils/disciplineRewardCycleCalendar.js';
import { getIstMidnightInstant } from '../utils/ist.js';

test('new reward-cycle timing follows IST calendar-day boundaries and its snapshotted requirement', () => {
  const timing = deriveDisciplineRewardCycleCalendar({ startDate: '2026-11-19', requiredQualifyingDays: 30 });
  assert.equal(timing.cycleStartedAt.toISOString(), getIstMidnightInstant('2026-11-19').toISOString());
  assert.equal(timing.baselineTargetDate, '2026-12-19');
  assert.equal(timing.baselineTargetAt.toISOString(), getIstMidnightInstant('2026-12-19').toISOString());
});

test('calendar countdown advances while qualification progress remains independent', () => {
  const cycle = {
    startDate: '2026-11-19',
    requiredQualifyingDays: 30,
    completedQualifyingDays: 12,
    status: 'active',
  };
  const before = getDisciplineRewardCycleCalendarStatus(cycle, '2026-11-19T18:29:59.999Z');
  const duringPauseNextIstDate = getDisciplineRewardCycleCalendarStatus(cycle, '2026-11-20T18:29:59.999Z');
  assert.equal(before.calendarDaysRemaining, 30);
  assert.equal(duringPauseNextIstDate.calendarDaysRemaining, 29);
  assert.equal(duringPauseNextIstDate.calendarStatus, 'countdown');
  assert.equal(cycle.completedQualifyingDays, 12, 'Calendar time does not grant qualifying days.');
  assert.equal(before.baselineTargetAt.toISOString(), duringPauseNextIstDate.baselineTargetAt.toISOString());
});

test('the baseline target stays fixed and an incomplete active cycle awaits genuine qualification', () => {
  const cycle = {
    startDate: '2026-11-19',
    requiredQualifyingDays: 30,
    completedQualifyingDays: 29,
    status: 'active',
  };
  const target = deriveDisciplineRewardCycleCalendar(cycle).baselineTargetAt;
  const atTarget = getDisciplineRewardCycleCalendarStatus(cycle, target);
  const afterResume = getDisciplineRewardCycleCalendarStatus(cycle, new Date(target.getTime() + 3 * 24 * 60 * 60 * 1000));
  assert.equal(atTarget.calendarDaysRemaining, 0);
  assert.equal(atTarget.calendarTargetPassed, true);
  assert.equal(atTarget.calendarStatus, 'awaiting-qualification');
  assert.equal(afterResume.calendarStatus, 'awaiting-qualification');
  assert.equal(afterResume.baselineTargetAt.toISOString(), target.toISOString());
  assert.equal(afterResume.calendarDaysRemaining, 0);
});

test('lazy timing initialization preserves progress and all Rank/reward snapshots', () => {
  const cycle = {
    startDate: '2026-11-19',
    requiredQualifyingDays: 55,
    completedQualifyingDays: 41,
    rankSlug: 'zenith',
    rankName: 'Zenith',
    rewardAmountCents: 80,
    actualCreditedCents: null,
    status: 'active',
  };
  assert.equal(initializeDisciplineRewardCycleCalendar(cycle), true);
  assert.equal(initializeDisciplineRewardCycleCalendar(cycle), false);
  assert.equal(cycle.cycleStartedAt.toISOString(), getIstMidnightInstant('2026-11-19').toISOString());
  assert.equal(cycle.baselineTargetDate, '2027-01-13');
  assert.equal(cycle.completedQualifyingDays, 41);
  assert.equal(cycle.rankSlug, 'zenith');
  assert.equal(cycle.rankName, 'Zenith');
  assert.equal(cycle.requiredQualifyingDays, 55);
  assert.equal(cycle.rewardAmountCents, 80);
  assert.equal(cycle.actualCreditedCents, null);
});
