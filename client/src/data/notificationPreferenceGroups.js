export const notificationPreferenceGroups = Object.freeze([
  {
    id: 'tasks',
    title: 'Task Notifications',
    description: 'Updates about the scheduled work in your current cycle. Scheduled reminder timing remains inactive until it is defined.',
    items: [
      { id: 'scheduledTaskReminders', label: 'Scheduled Task reminders' },
      { id: 'missedTaskAlerts', label: 'Missed Task alerts' },
      { id: 'dailyTaskStatusUpdates', label: 'Daily Task status updates' },
    ],
  },
  {
    id: 'recoveryQuests',
    title: 'Recovery Quest Notifications',
    description: 'Changes to Active Recovery Quests and their Recovery Windows. Expiry-warning timing remains inactive until it is defined.',
    items: [
      { id: 'recoveryQuestGenerated', label: 'Recovery Quest generated' },
      { id: 'recoveryQuestCompleted', label: 'Recovery Quest completed' },
      { id: 'recoveryWindowExpiry', label: 'Recovery Window approaching expiry' },
      { id: 'recoveryQuestExpired', label: 'Recovery Quest expired' },
      { id: 'gracePointDeduction', label: 'Grace Point deduction' },
      { id: 'sixQuestThreshold', label: 'Six-quest threshold reached' },
      { id: 'recoveryQuestProcessingResumed', label: 'Recovery Quest processing resumed after Emergency Pause' },
      { id: 'recoveryQuestXpDrain', label: 'Recovery Quest XP drain' },
    ],
  },
  {
    id: 'discipline',
    title: 'Discipline Notifications',
    description: 'Reminders and records related to Discipline milestones. Warning and countdown alerts stay inactive until their thresholds are configured.',
    items: [
      { id: 'disciplineRewardCountdown', label: 'Discipline reward countdown milestones' },
      { id: 'disciplinePointReward', label: 'Discipline Point reward earned' },
      { id: 'disciplineQualificationCompleted', label: 'Discipline day qualified' },
      { id: 'disciplineStreakWarning', label: 'Discipline streak warning' },
      { id: 'disciplineStreakBroken', label: 'Discipline streak broken' },
    ],
  },
  {
    id: 'rankXp',
    title: 'Rank and XP Notifications',
    description: 'Progression milestones and configured XP events.',
    items: [
      { id: 'rankUp', label: 'Rank-up' },
      { id: 'rankEntryReward', label: 'Rank-entry reward' },
      { id: 'levelGained', label: 'Level gained' },
      { id: 'levelLost', label: 'Level lost' },
      { id: 'dailyRankXpBenefit', label: 'Daily Rank XP benefit' },
    ],
  },
  {
    id: 'emergencyPause',
    title: 'Emergency Pause Notifications',
    description: 'Status changes for an active Emergency Pause. Resume warning timing remains inactive until an interval is approved.',
    items: [
      { id: 'emergencyPauseActivated', label: 'Emergency Pause activated' },
      { id: 'pauseResumeApproaching', label: 'Pause approaching automatic resume' },
      { id: 'emergencyPauseAutoResumed', label: 'Emergency Pause automatically resumed' },
      { id: 'emergencyPauseResumedEarly', label: 'Emergency Pause resumed early' },
    ],
  },
  {
    id: 'monthlyAnalysis',
    title: 'Monthly Analysis Notifications',
    description: 'History retention reminders and supported summary notices.',
    items: [
      { id: 'historyExpirySevenDays', label: 'Seven-day history expiry reminder' },
      { id: 'historyExpiry48Hours', label: '48-hour history expiry reminder' },
      { id: 'historyExpiry24Hours', label: '24-hour history expiry reminder' },
      { id: 'monthlySummaryAvailable', label: 'Monthly summary availability, when supported' },
    ],
  },
]);

export const notificationPreferenceKeys = notificationPreferenceGroups.flatMap(({ items }) => items.map(({ id }) => id));
