export const dashboardDemo = {
  member: { displayName: 'Demo Member', email: 'demo.member@example.com', accountLabel: 'Demonstration account' },
  identity: {
    rankSlug: 'continuum',
    level: 3,
    totalXp: 1240,
    xpProgressPercent: 62,
    levelProgressLabel: 'Illustrative progress only; XP formulas and Level thresholds are not final.',
  },
  tasks: [
    { id: 'task-01', title: 'Focused work block', completed: true },
    { id: 'task-02', title: 'Movement session', completed: true },
    { id: 'task-03', title: 'Read and reflect', completed: true },
    { id: 'task-04', title: 'Plan the next step', completed: true },
    { id: 'task-05', title: 'Skill practice', completed: false },
    { id: 'task-06', title: 'Prepare for tomorrow', completed: false },
    { id: 'task-07', title: 'Personal project', completed: false },
  ],
  recoveryQuests: [
    { id: 'recovery-01', title: 'Example Recovery Quest', status: 'active', daysRemaining: 2 },
    { id: 'recovery-02', title: 'Completed example quest', status: 'completed' },
  ],
  graceCharges: {
    available: 3,
    explanation: 'Members begin with 3 Grace Charges. Published Recovery Quest and daily failure rules can affect the balance.',
  },
  disciplinePoints: {
    balance: 1.25,
    maximum: 10,
    explanation: 'Every three months of discipline awards 0.25 points. The stored balance is capped at 10.',
  },
  goals: [
    { id: 'goal-01', title: 'Build a steady reading practice', progress: 64 },
    { id: 'goal-02', title: 'Make time for movement', progress: 38 },
  ],
  activity: [
    { id: 'activity-01', icon: 'tasks', title: 'Task completed', detail: 'Example activity entry', time: 'Today' },
    { id: 'activity-02', icon: 'spark', title: 'XP awarded', detail: 'Example entry · no XP formula assigned', time: 'Today' },
    { id: 'activity-03', icon: 'recovery', title: 'Recovery Quest completed', detail: 'Example activity entry', time: 'Yesterday' },
    { id: 'activity-04', icon: 'leaderboard', title: 'Rank achievement', detail: 'Rank 01 · Continuum · example entry', time: 'Earlier' },
  ],
  notifications: [
    { id: 'notification-01', title: 'Your dashboard is ready', detail: 'This notification is part of the interface preview.', time: 'Just now' },
    { id: 'notification-02', title: 'Demonstration data is active', detail: 'No activity here is connected to an account.', time: 'Today' },
  ],
  disclosure: 'Demonstration data only. These values and events are examples and are not connected to an account or live platform activity.',
};
