export const applicationNavigation = [
  {
    title: 'Overview',
    items: [{ id: 'dashboard', label: 'Dashboard', path: '/app/dashboard', icon: 'dashboard', description: 'Your current progress at a glance.' }],
  },
  {
    title: 'My Progress',
    items: [
      { id: 'tasks', label: 'Tasks', path: '/app/tasks', icon: 'tasks', description: 'View your daily schedule, completion progress and Accountability Actions.' },
      { id: 'discipline', label: 'Discipline', path: '/app/discipline', icon: 'activity', description: 'Track qualifying days, Rank rewards and your activity history.' },
      { id: 'recovery-quests', label: 'Recovery Quests', path: '/app/recovery-quests', icon: 'recovery', description: 'Manage the Accountability Actions activated by missed Tasks.' },
      { id: 'monthly-analysis', label: 'Monthly Analysis', path: '/app/monthly-analysis', icon: 'analysis', description: 'Monthly progress analysis is planned for a future milestone.' },
    ],
  },
  {
    title: 'Community',
    items: [{ id: 'leaderboard', label: 'Leaderboard', path: '/app/leaderboard', icon: 'leaderboard', description: 'Community rankings are planned for a future milestone.' }],
  },
  {
    title: 'Account',
    items: [
      { id: 'profile', label: 'Member Profile', path: '/app/profile', icon: 'profile', description: 'Member profile controls are planned for a future milestone.' },
      { id: 'settings', label: 'Settings', path: '/app/settings', icon: 'settings', description: 'Account settings are planned for a future milestone.' },
    ],
  },
];

export const applicationNavigationItems = applicationNavigation.flatMap((group) => group.items);
