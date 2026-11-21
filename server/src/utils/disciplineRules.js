export const REQUIRED_DAILY_COMPLETIONS = 5;

export function getDailyQualificationStatus(completedOriginalTaskCount, protectedByEmergencyPause = false) {
  if (protectedByEmergencyPause) return 'emergency-pause-protected';
  return completedOriginalTaskCount >= REQUIRED_DAILY_COMPLETIONS ? 'qualified' : 'not-qualified';
}

export function calculateStreakResult({ currentStreak, longestStreak, lifetimeLongestStreak, qualifies, protectedByEmergencyPause = false }) {
  const currentStreakAfter = protectedByEmergencyPause ? currentStreak : qualifies ? currentStreak + 1 : 0;
  return {
    currentStreakBefore: currentStreak,
    currentStreakAfter,
    runLongestStreakAfter: Math.max(longestStreak, currentStreakAfter),
    lifetimeLongestStreakAfter: Math.max(lifetimeLongestStreak, currentStreakAfter),
  };
}

export function calculateRewardCycleProgress({ completedQualifyingDays, requiredQualifyingDays, qualifies, protectedByEmergencyPause = false }) {
  if (protectedByEmergencyPause || !qualifies) return completedQualifyingDays;
  return Math.min(requiredQualifyingDays, completedQualifyingDays + 1);
}
