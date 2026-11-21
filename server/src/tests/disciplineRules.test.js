import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRESSION_RANKS } from '../config/progressionConfiguration.js';
import { calculateRewardCycleProgress, calculateStreakResult, getDailyQualificationStatus } from '../utils/disciplineRules.js';

test('daily qualification uses the original five-task threshold and Pause is distinct', () => {
  for (let completed = 0; completed <= 4; completed += 1) {
    assert.equal(getDailyQualificationStatus(completed), 'not-qualified');
  }
  for (const completed of [5, 6, 7, 8, 10]) {
    assert.equal(getDailyQualificationStatus(completed), 'qualified');
  }
  assert.equal(getDailyQualificationStatus(0, true), 'emergency-pause-protected');
  assert.equal(getDailyQualificationStatus(10, true), 'emergency-pause-protected');
});

test('streaks break only on a finalized ordinary unqualified day and lifetime best never falls', () => {
  assert.deepEqual(calculateStreakResult({ currentStreak: 4, longestStreak: 7, lifetimeLongestStreak: 9, qualifies: true }), {
    currentStreakBefore: 4,
    currentStreakAfter: 5,
    runLongestStreakAfter: 7,
    lifetimeLongestStreakAfter: 9,
  });
  assert.deepEqual(calculateStreakResult({ currentStreak: 4, longestStreak: 7, lifetimeLongestStreak: 9, qualifies: false }), {
    currentStreakBefore: 4,
    currentStreakAfter: 0,
    runLongestStreakAfter: 7,
    lifetimeLongestStreakAfter: 9,
  });
  assert.deepEqual(calculateStreakResult({ currentStreak: 4, longestStreak: 7, lifetimeLongestStreak: 9, qualifies: false, protectedByEmergencyPause: true }), {
    currentStreakBefore: 4,
    currentStreakAfter: 4,
    runLongestStreakAfter: 7,
    lifetimeLongestStreakAfter: 9,
  });
});

test('non-qualifying and protected days do not erase earned recurring-cycle progress', () => {
  assert.equal(calculateRewardCycleProgress({ completedQualifyingDays: 12, requiredQualifyingDays: 30, qualifies: false }), 12);
  assert.equal(calculateRewardCycleProgress({ completedQualifyingDays: 12, requiredQualifyingDays: 30, qualifies: false, protectedByEmergencyPause: true }), 12);
  assert.equal(calculateRewardCycleProgress({ completedQualifyingDays: 29, requiredQualifyingDays: 30, qualifies: true }), 30);
});

test('approved recurring DP cycle table is unchanged across all seven Ranks', () => {
  assert.deepEqual(PROGRESSION_RANKS.map(({ slug, recurringDpPreview }) => [slug, recurringDpPreview.qualifyingDays, recurringDpPreview.rewardDpCents]), [
    ['origin', 30, 25],
    ['ember', 35, 40],
    ['surge', 40, 50],
    ['vector', 45, 60],
    ['apex', 50, 70],
    ['zenith', 55, 80],
    ['continuum', 60, 90],
  ]);
});
