import { ApiError, requestApi, requestApiBlob } from './apiClient.js';

export class TaskApiError extends ApiError {
  constructor(status, code, message, details = [], requestId = null) {
    super(status, code, message, details, requestId);
    this.name = 'TaskApiError';
  }
}

export function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 18)}`;
}

const request = requestApi;

export const taskApi = Object.freeze({
  currentSchedule: (options) => request('/task-schedules/current', options),
  tasks: (options) => request('/tasks', options),
  allowance: (options) => request('/task-schedule-changes/allowance', options),
  occurrences: (startDate, endDate, options) => {
    const query = new URLSearchParams({ startDate, endDate });
    return request(`/task-occurrences?${query.toString()}`, options);
  },
  ensureOccurrences: (startDate, endDate, options) => request('/task-occurrences/ensure', {
    ...options,
    method: 'POST',
    body: { startDate, endDate },
  }),
  createSchedule: (schedule, idempotencyKey = createIdempotencyKey()) => request('/task-schedules', { method: 'POST', body: schedule, idempotencyKey }),
  addTask: (task, idempotencyKey = createIdempotencyKey()) => request('/tasks', { method: 'POST', body: task, idempotencyKey }),
  updateTask: (taskId, patch, idempotencyKey = createIdempotencyKey()) => request(`/tasks/${encodeURIComponent(taskId)}`, { method: 'PATCH', body: patch, idempotencyKey }),
  rescheduleTask: (taskId, cycleDays, idempotencyKey = createIdempotencyKey()) => request(`/tasks/${encodeURIComponent(taskId)}/reschedule`, { method: 'PATCH', body: { cycleDays }, idempotencyKey }),
  deleteTask: (taskId, idempotencyKey = createIdempotencyKey()) => request(`/tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE', idempotencyKey }),
  completeOccurrence: (occurrenceId, submission = {}, idempotencyKey = createIdempotencyKey()) => request(`/task-occurrences/${encodeURIComponent(occurrenceId)}/complete`, { method: 'POST', body: submission, idempotencyKey }),
  recoveryQuests: (options) => request('/recovery-quests', options),
  recoveryQuest: (questId, options) => request(`/recovery-quests/${encodeURIComponent(questId)}`, options),
  completeRecoveryQuest: (questId) => request(`/recovery-quests/${encodeURIComponent(questId)}/complete`, { method: 'POST', body: {} }),
  gracePoints: (options) => request('/grace-points', options),
  gracePointTransactions: (limit = 50, options = {}) => request(`/grace-points/transactions?${new URLSearchParams({ limit: String(limit) })}`, options),
  currentProgression: (options) => request('/progression/current', options),
  xpSummary: (options) => request('/xp/summary', options),
  xpTransactions: ({ limit = 50, before = null, beforeId = null } = {}, options = {}) => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (before) query.set('before', before);
    if (beforeId) query.set('beforeId', beforeId);
    return request(`/xp/transactions?${query.toString()}`, options);
  },
  rankConfiguration: (options) => request('/ranks', options),
  currentRank: (options) => request('/ranks/current', options),
  nextRank: (options) => request('/ranks/next', options),
  disciplineSummary: (options) => request('/discipline/summary', options),
  disciplineCalendar: ({ startDate, endDate } = {}, options = {}) => {
    const query = new URLSearchParams();
    if (startDate) query.set('startDate', startDate);
    if (endDate) query.set('endDate', endDate);
    return request(`/discipline/calendar${query.size ? `?${query}` : ''}`, options);
  },
  disciplineRewardCycle: (options) => request('/discipline/reward-cycle', options),
  disciplineTransactions: (limit = 50, options = {}) => request(`/discipline/transactions?${new URLSearchParams({ limit: String(limit) })}`, options),
  disciplinePoints: (options) => request('/discipline-points', options),
  redeemDisciplinePoint: (idempotencyKey = createIdempotencyKey()) => request('/discipline-points/redeem', { method: 'POST', body: {}, idempotencyKey }),
  emergencyPauseStatus: (options) => request('/emergency-pause', options),
  activateEmergencyPause: (durationDays, idempotencyKey = createIdempotencyKey()) => request('/emergency-pause/activate', { method: 'POST', body: { durationDays }, idempotencyKey }),
  resumeEmergencyPause: (idempotencyKey = createIdempotencyKey()) => request('/emergency-pause/resume', { method: 'POST', body: {}, idempotencyKey }),
  monthlyAnalysisCurrent: (options) => request('/monthly-analysis/current', options),
  monthlyAnalysisPrevious: (options) => request('/monthly-analysis/previous', options),
  monthlyAnalysisMonths: (options) => request('/monthly-analysis/months', options),
  monthlyAnalysisSummary: (monthKey, options) => request(`/monthly-analysis/${encodeURIComponent(monthKey)}`, options),
  monthlyAnalysisDetails: (monthKey, { limit = 50, cursor = null } = {}, options = {}) => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (cursor) query.set('cursor', cursor);
    return request(`/monthly-analysis/${encodeURIComponent(monthKey)}/details?${query}`, options);
  },
  monthlyAnalysisCompare: (first, second, options) => request(`/monthly-analysis/compare?${new URLSearchParams({ first, second })}`, options),
  monthlyAnalysisReminders: (options) => request('/monthly-analysis/reminders', options),
  leaderboard: (options) => request('/leaderboard', options),
  publicMemberProfile: (publicHandle, options) => request(`/leaderboard/profiles/${encodeURIComponent(publicHandle)}`, options),
  publicProfileSettings: (options) => request('/leaderboard/profile-settings', options),
  savePublicProfileSettings: (settings, options) => request('/leaderboard/profile-settings', { ...options, method: 'PUT', body: settings }),
  accountSettings: (options) => request('/account/settings', options),
  updateAccountPreferences: (preferences, options) => request('/account/preferences', { ...options, method: 'PUT', body: preferences }),
  manualResetPreview: (options) => request('/account/reset-preview', options),
  manualResetAndRestart: (confirmationPhrase, expectedRunNumber, idempotencyKey, options = {}) => request('/account/reset-and-restart', {
    ...options,
    method: 'POST',
    body: { confirmationPhrase, expectedRunNumber },
    idempotencyKey,
  }),
  notifications: ({ category = null, readState = 'all', cursor = null, limit = 20 } = {}, options) => {
    const query = new URLSearchParams({ readState, limit: String(limit) });
    if (category) query.set('category', category);
    if (cursor) query.set('cursor', cursor);
    return request(`/notifications?${query.toString()}`, options);
  },
  notificationUnreadCount: (options) => request('/notifications/unread-count', options),
  notificationCategories: (options) => request('/notifications/categories', options),
  markNotificationRead: (id, options) => request(`/notifications/${encodeURIComponent(id)}/read`, { ...options, method: 'PATCH', body: {} }),
  markAllNotificationsRead: (options) => request('/notifications/read-all', { ...options, method: 'POST', body: {} }),
  deleteNotification: (id, options) => request(`/notifications/${encodeURIComponent(id)}`, { ...options, method: 'DELETE' }),
  deleteAllNotifications: (options) => request('/notifications', { ...options, method: 'DELETE' }),
  notificationPreferences: (options) => request('/notification-preferences', options),
  updateNotificationPreferences: (categories, options) => request('/notification-preferences', { ...options, method: 'PATCH', body: { categories } }),
  downloadMonthlyAnalysisPdf: (monthKey, compareMonth = null, { signal } = {}) => {
    const query = compareMonth ? `?${new URLSearchParams({ compare: compareMonth })}` : '';
    return requestApiBlob(`/monthly-analysis/${encodeURIComponent(monthKey)}/pdf${query}`, { signal });
  },
});
