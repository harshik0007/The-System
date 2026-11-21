export const NOTIFICATION_CATEGORIES = Object.freeze([
  { id: 'tasks', label: 'Tasks' },
  { id: 'recovery-quests', label: 'Recovery Quests' },
  { id: 'discipline', label: 'Discipline' },
  { id: 'rank-xp', label: 'Rank & XP' },
  { id: 'emergency-pause', label: 'Emergency Pause' },
  { id: 'monthly-retention', label: 'Monthly Analysis' },
]);

const supportedRoutes = [
  /^\/app\/tasks(?:\?date=\d{4}-\d{2}-\d{2})?$/,
  /^\/app\/recovery-quests$/,
  /^\/app\/discipline(?:\?date=\d{4}-\d{2}-\d{2})?$/,
  /^\/app\/dashboard$/,
  /^\/app\/monthly-analysis(?:\?month=\d{4}-(?:0[1-9]|1[0-2]))?$/,
  /^\/ranks\/(?:origin|ember|surge|vector|apex|zenith|continuum)$/,
];

export function resolveNotificationDestination(notification) {
  const target = typeof notification?.targetRoute === 'string' ? notification.targetRoute : '';
  if (target.length > 220 || target.includes('\\') || target.includes('#')) return null;
  return supportedRoutes.some((pattern) => pattern.test(target)) ? target : null;
}

export function formatNotificationDateTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}
