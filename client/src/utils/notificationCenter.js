import { notificationPreferenceGroups } from '../data/notificationPreferenceGroups.js';
import { getLevelFromTotalXp } from './disciplineManager.js';
import { getScheduleDaySnapshot } from './disciplineActivity.js';
import { formatDateKey } from './monthlyAnalysis.js';
import { getIstDateKey } from './taskScheduleBuilder.js';

export const NOTIFICATIONS_SESSION_KEY = 'the-system-notification-center-v1';
export const NOTIFICATION_CATEGORIES = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'recovery_quests', label: 'Recovery Quests' },
  { id: 'discipline', label: 'Discipline' },
  { id: 'rank_xp', label: 'Rank & XP' },
  { id: 'emergency_pause', label: 'Emergency Pause' },
  { id: 'monthly_analysis', label: 'Monthly Analysis' },
]);
const notificationCategoryIds = new Set(NOTIFICATION_CATEGORIES.filter((category) => !['all', 'unread'].includes(category.id)).map((category) => category.id));

const knownPreferences = new Set(notificationPreferenceGroups.flatMap((group) => group.items.map((item) => item.id)));

export function isNotificationEnabled(preferences, preferenceKey) {
  return knownPreferences.has(preferenceKey) && preferences?.notifications?.[preferenceKey] !== false;
}

export function createEmptyNotificationStore(progressionRunId, evaluatedEventIds = []) {
  return {
    version: 1,
    progressionRunId: progressionRunId || null,
    notifications: [],
    evaluatedEventIds: [...new Set(evaluatedEventIds)],
  };
}

export function normalizeNotificationStore(value, progressionRunId) {
  if (!value || typeof value !== 'object' || value.progressionRunId !== progressionRunId) {
    return createEmptyNotificationStore(progressionRunId);
  }
  const notifications = Array.isArray(value.notifications)
    ? value.notifications.filter((item) => item && typeof item.id === 'string' && typeof item.eventId === 'string'
      && notificationCategoryIds.has(item.category) && typeof item.createdAt === 'string'
      && typeof item.isRead === 'boolean' && typeof item.targetRoute === 'string')
    : [];
  return {
    version: 1,
    progressionRunId,
    notifications,
    evaluatedEventIds: Array.isArray(value.evaluatedEventIds)
      ? [...new Set(value.evaluatedEventIds.filter((item) => typeof item === 'string'))]
      : notifications.map((item) => item.eventId),
  };
}

export function buildNotificationCandidates({
  currentSchedule = {}, recoveryState = {}, disciplineState = {}, emergencyPauseState = {},
  monthlySummaries = [], historyExpiryReminders = [],
} = {}) {
  const runId = disciplineState.progressionRunId || 'current-run';
  const candidates = [];
  const add = (eventId, category, eventType, preferenceKey, title, description, targetRoute, extra = {}) => {
    const resolvedTarget = resolveNotificationDestination({ targetRoute });
    if (!eventId || !resolvedTarget || !notificationCategoryIds.has(category) || !knownPreferences.has(preferenceKey)) return;
    candidates.push({
      id: `notification:${eventId}`,
      eventId,
      category,
      eventType,
      title,
      description,
      preferenceKey,
      targetRoute: resolvedTarget,
      relatedEntityType: extra.relatedEntityType || null,
      relatedEntityId: extra.relatedEntityId || null,
      occurredAt: extra.occurredAt || null,
      origin: 'actual-event',
      metadata: { ...(extra.metadata || {}), ...(extra.createdDate ? { createdDate: extra.createdDate } : {}) },
    });
  };

  const records = disciplineState.dailyRecords || {};
  for (const [date, record] of Object.entries(records)) {
    if (!record?.hasDailyResetRecord || record.progressionRunId && record.progressionRunId !== runId) continue;
    const dailyEventId = `daily-status:${runId}:${date}`;
    const taskSnapshot = getScheduleDaySnapshot(currentSchedule, date, { todayKey: getIstDateKey() });
    const missedTasks = record.emergencyPause ? [] : taskSnapshot.tasks.filter((task) => task.status !== 'completed');
    const missedCount = record.emergencyPause ? 0 : Math.max(0, Number(record.scheduledTaskCount || 0) - Number(record.completedTaskCount || 0));
    const dailySummary = record.emergencyPause
      ? `${record.completedTaskCount} of ${record.scheduledTaskCount} scheduled Tasks were completed on ${formatDateKey(date)}; Emergency Pause protection applied.`
      : `${record.completedTaskCount} completed and ${missedCount} missed out of ${record.scheduledTaskCount} scheduled Tasks on ${formatDateKey(date)}.`;
    if (Number(record.scheduledTaskCount) > 0) {
      add(dailyEventId, 'tasks', 'daily-task-status', 'dailyTaskStatusUpdates', 'Daily Task status finalized',
        dailySummary,
        `/app/tasks?date=${encodeURIComponent(date)}`, { relatedEntityType: 'daily-record', relatedEntityId: date, metadata: { date } });
    }
    for (const missedTask of missedTasks) {
      const occurrenceKey = missedTask.occurrenceKey;
      const occurrence = currentSchedule.occurrences?.[occurrenceKey] || {};
      const taskId = missedTask.id;
      const task = (currentSchedule.tasks || []).find((item) => item.id === taskId)
        || (currentSchedule.taskHistory || []).find((item) => item.id === taskId);
      const taskName = occurrence.snapshot?.name || task?.name || 'Task details unavailable';
      const eventId = `missed-task:${runId}:${occurrenceKey}`;
      add(eventId, 'tasks', 'missed-task', 'missedTaskAlerts', 'Task finalized as missed',
        `“${taskName}” was finalized as missed on ${formatDateKey(date)}. Its linked Recovery Quest is available in Recovery Quests.`,
        `/app/tasks?date=${encodeURIComponent(date)}&task=${encodeURIComponent(taskId)}`,
        { relatedEntityType: 'task-occurrence', relatedEntityId: occurrenceKey, metadata: { taskName, date, taskId } });
    }
    if (record.qualifies && !record.emergencyPause) {
      add(`discipline-qualified:${runId}:${date}`, 'discipline', 'discipline-qualified', 'disciplineQualificationCompleted',
        'Discipline day qualified', `${record.completedTaskCount} scheduled Tasks were completed on ${formatDateKey(date)}. This day qualified for Discipline.`,
        `/app/discipline?date=${encodeURIComponent(date)}`, { relatedEntityType: 'daily-record', relatedEntityId: date, metadata: { date } });
    }
    if (!record.qualifies && !record.emergencyPause && Number(record.streakBefore) > 0) {
      add(`discipline-streak-broken:${runId}:${date}`, 'discipline', 'discipline-streak-broken', 'disciplineStreakBroken',
        'Discipline Streak ended', `The finalized day on ${formatDateKey(date)} had fewer than five completed scheduled Tasks. The previous ${record.streakBefore}-day Streak ended.`,
        `/app/discipline?date=${encodeURIComponent(date)}`, { relatedEntityType: 'daily-record', relatedEntityId: date, metadata: { date } });
    }
  }

  for (const event of recoveryState.activity || []) {
    if (!event?.id || event.progressionRunId && event.progressionRunId !== runId) continue;
    const quest = (recoveryState.quests || []).find((item) => item.id === event.questId);
    if (event.kind === 'generated') {
      add(`recovery-generated:${event.id}`, 'recovery_quests', 'recovery-quest-generated', 'recoveryQuestGenerated',
        'Recovery Quest generated', `A Recovery Quest for “${quest?.originalTaskName || 'the missed Task'}” was generated on ${formatDateKey(event.date)}.`,
        `/app/recovery-quests?quest=${encodeURIComponent(event.questId || '')}`, { relatedEntityType: 'recovery-quest', relatedEntityId: event.questId, occurredAt: event.at || null });
    } else if (event.kind === 'completed') {
      add(`recovery-completed:${event.id}`, 'recovery_quests', 'recovery-quest-completed', 'recoveryQuestCompleted',
        'Recovery Quest completed', `${event.detail} Completed on ${formatDateKey(event.date)}.`,
        `/app/recovery-quests?quest=${encodeURIComponent(event.questId || '')}`, { relatedEntityType: 'recovery-quest', relatedEntityId: event.questId, occurredAt: event.at || null });
    }
  }

  for (const event of recoveryState.gracePointEvents || []) {
    if (!event?.id || event.progressionRunId && event.progressionRunId !== runId) continue;
    const quest = (recoveryState.quests || []).find((item) => item.id === event.questId);
    if (event.kind === 'expiry') {
      add(`recovery-expired:${event.id}`, 'recovery_quests', 'recovery-quest-expired', 'recoveryQuestExpired',
        'Recovery Quest expired', `“${quest?.accountabilityActionTitle || 'The Accountability Action'}” expired after its Recovery Window on ${formatDateKey(event.date)}.`,
        `/app/recovery-quests?quest=${encodeURIComponent(event.questId || '')}`, { relatedEntityType: 'recovery-quest', relatedEntityId: event.questId });
      const deduction = Number(event.appliedAmount) > 0
        ? 'One Grace Point was deducted.'
        : 'No Grace Point was deducted because the balance was already zero.';
      add(`grace-deduction:${event.id}`, 'recovery_quests', 'grace-point-deduction', 'gracePointDeduction',
        'Grace Point balance changed', `${deduction} The individual Recovery Quest expiry was recorded on ${formatDateKey(event.date)}.`,
        '/app/recovery-quests', { relatedEntityType: 'grace-point-event', relatedEntityId: event.id });
    } else if (event.kind === 'threshold') {
      const deduction = Number(event.appliedAmount) > 0
        ? 'One Grace Point was deducted.'
        : 'No Grace Point was deducted because the balance was already zero.';
      add(`quest-threshold:${event.id}`, 'recovery_quests', 'recovery-quest-threshold', 'sixQuestThreshold',
        'Sixth active Recovery Quest threshold reached', `${deduction} All active Recovery Quests were cleared; this was threshold clearing, not individual expiry.`,
        '/app/recovery-quests', { relatedEntityType: 'grace-point-event', relatedEntityId: event.id });
    }
  }

  for (const event of disciplineState.dpEvents || []) {
    if (!event?.id || event.kind !== 'recurring' || event.progressionRunId && event.progressionRunId !== runId) continue;
    const rewardMessage = Number(event.amount) > 0
      ? `${event.title}: +${Number(event.amount).toFixed(2)} Discipline Points on ${formatDateKey(event.date)}.`
      : `${event.title} completed on ${formatDateKey(event.date)}, but no Discipline Points were added because the balance was at its cap.`;
    add(`discipline-reward:${event.id}`, 'discipline', 'discipline-point-reward', 'disciplinePointReward',
      Number(event.amount) > 0 ? 'Discipline Point reward earned' : 'Discipline reward cycle completed', rewardMessage,
      `/app/discipline?date=${encodeURIComponent(event.date || '')}`, { relatedEntityType: 'discipline-point-event', relatedEntityId: event.id });
  }

  for (const event of disciplineState.rankEntryEvents || []) {
    if (!event?.id || event.progressionRunId && event.progressionRunId !== runId) continue;
    add(`rank-up:${event.id}`, 'rank_xp', 'rank-up', 'rankUp',
      `Rank ${String(event.rankNumber).padStart(2, '0')} — ${event.rankName} achieved`, `You advanced to ${event.rankName} on ${formatDateKey(event.date)}.`,
      `/ranks/${encodeURIComponent(event.rankSlug)}`, { relatedEntityType: 'rank-entry', relatedEntityId: event.id, metadata: { rankSlug: event.rankSlug } });
    if (Number(event.dpAwarded) > 0) {
      add(`rank-entry-reward:${event.id}`, 'rank_xp', 'rank-entry-reward', 'rankEntryReward',
        'Rank-entry Discipline Point reward', `+${Number(event.dpAwarded).toFixed(2)} Discipline Points were awarded for entering ${event.rankName}.`,
        '/app/discipline', { relatedEntityType: 'rank-entry', relatedEntityId: event.id });
    }
  }

  for (const event of disciplineState.levelDownEvents || []) {
    if (!event?.id || event.progressionRunId && event.progressionRunId !== runId) continue;
    add(`level-lost:${event.id}`, 'rank_xp', 'level-lost', 'levelLost', `Level ${event.fromLevel} lost`,
      `Recovery Quest XP drain reduced your Level from ${event.fromLevel} to ${event.toLevel} on ${formatDateKey(event.date)}.`,
      '/app/discipline', { relatedEntityType: 'level-event', relatedEntityId: event.id });
  }

  for (const event of disciplineState.xpHistory || []) {
    if (!event?.id || event.kind !== 'daily-rank-bonus' || event.progressionRunId && event.progressionRunId !== runId) continue;
    const totalAfter = Number(event.totalAfter);
    const amount = Number(event.amount);
    const levelBefore = getLevelFromTotalXp(Math.max(0, totalAfter - amount));
    const levelAfter = getLevelFromTotalXp(totalAfter);
    if (levelAfter > levelBefore) {
      add(`level-gained:${event.id}`, 'rank_xp', 'level-gained', 'levelGained', `Level ${levelAfter} reached`,
        `Your XP increased your Level from ${levelBefore} to ${levelAfter} on ${formatDateKey(event.date)}.`,
        '/app/discipline', { relatedEntityType: 'level-event', relatedEntityId: event.id });
    }
  }

  for (const event of disciplineState.dailyRankXpEvents || []) {
    if (!event?.id || Number(event.amount) <= 0 || event.progressionRunId && event.progressionRunId !== runId) continue;
    add(`daily-rank-xp:${event.id}`, 'rank_xp', 'daily-rank-xp', 'dailyRankXpBenefit',
      'Daily Rank XP benefit awarded', `+${Number(event.amount)} XP from the ${event.rankName} daily Rank benefit on ${formatDateKey(event.date)}.`,
      '/app/discipline', { relatedEntityType: 'xp-event', relatedEntityId: event.id });
  }

  for (const event of disciplineState.xpDrainEvents || []) {
    if (!event?.id || Number(event.amount) <= 0 || event.emergencyPause || Number(event.activeRecoveryQuestCount) <= 0 || event.progressionRunId && event.progressionRunId !== runId) continue;
    add(`recovery-xp-drain:${event.id}`, 'rank_xp', 'recovery-quest-xp-drain', 'recoveryQuestXpDrain',
      'Recovery Quest XP drain applied', `${Number(event.amount)} XP was drained for ${event.activeRecoveryQuestCount} active Recovery Quest${event.activeRecoveryQuestCount === 1 ? '' : 's'} on ${formatDateKey(event.date)}.`,
      '/app/discipline', { relatedEntityType: 'xp-drain-event', relatedEntityId: event.id });
  }

  for (const pause of emergencyPauseState.pauses || []) {
    if (!pause?.id) continue;
    if (pause.activationEventId) {
      const scheduledResume = pause.scheduledResumeAt ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(pause.scheduledResumeAt)) : 'the scheduled time';
      add(`pause-activated:${pause.activationEventId}`, 'emergency_pause', 'emergency-pause-activated', 'emergencyPauseActivated',
        'Emergency Pause activated', `A ${pause.durationDays}-day Emergency Pause began. Scheduled resumption: ${scheduledResume} IST.`,
        '/app/dashboard', { relatedEntityType: 'emergency-pause', relatedEntityId: pause.id, occurredAt: pause.startAt });
    }
    if (pause.resumeEventId && pause.status === 'resumed-early') {
      add(`pause-resumed-early:${pause.resumeEventId}`, 'emergency_pause', 'emergency-pause-resumed-early', 'emergencyPauseResumedEarly',
        'Emergency Pause resumed early', `Emergency Pause ended early on ${formatDateTime(pause.actualResumeAt)}.`,
        '/app/dashboard', { relatedEntityType: 'emergency-pause', relatedEntityId: pause.id, occurredAt: pause.actualResumeAt });
      if ((pause.recoveryQuestRemainingSnapshots || []).length > 0) {
        add(`recovery-processing-resumed:${pause.resumeEventId}`, 'recovery_quests', 'recovery-processing-resumed', 'recoveryQuestProcessingResumed',
          'Recovery Quest processing resumed', `Recovery Quest processing resumed after Emergency Pause for ${(pause.recoveryQuestRemainingSnapshots || []).length} quest${pause.recoveryQuestRemainingSnapshots.length === 1 ? '' : 's'}.`,
          '/app/recovery-quests', { relatedEntityType: 'emergency-pause', relatedEntityId: pause.id });
      }
    } else if (pause.resumeEventId && pause.status === 'automatically-resumed') {
      add(`pause-resumed-auto:${pause.resumeEventId}`, 'emergency_pause', 'emergency-pause-automatically-resumed', 'emergencyPauseAutoResumed',
        'Emergency Pause automatically resumed', `Emergency Pause reached its scheduled end on ${formatDateTime(pause.actualResumeAt || pause.scheduledResumeAt)}.`,
        '/app/dashboard', { relatedEntityType: 'emergency-pause', relatedEntityId: pause.id, occurredAt: pause.actualResumeAt || pause.scheduledResumeAt });
      if ((pause.recoveryQuestRemainingSnapshots || []).length > 0) {
        add(`recovery-processing-resumed:${pause.resumeEventId}`, 'recovery_quests', 'recovery-processing-resumed', 'recoveryQuestProcessingResumed',
          'Recovery Quest processing resumed', `Recovery Quest processing resumed after Emergency Pause for ${(pause.recoveryQuestRemainingSnapshots || []).length} quest${pause.recoveryQuestRemainingSnapshots.length === 1 ? '' : 's'}.`,
          '/app/recovery-quests', { relatedEntityType: 'emergency-pause', relatedEntityId: pause.id });
      }
    }
  }

  for (const reminder of historyExpiryReminders) {
    if (!reminder?.id || !['7d', '48h', '24h'].includes(reminder.timing)) continue;
    const preferenceKey = { '7d': 'historyExpirySevenDays', '48h': 'historyExpiry48Hours', '24h': 'historyExpiry24Hours' }[reminder.timing];
    add(`history-expiry:${reminder.id}`, 'monthly_analysis', 'history-expiry-reminder', preferenceKey,
      `${reminder.monthLabel} detailed history expires soon`, `${reminder.timingLabel} remain before detailed history for ${reminder.monthLabel} expires on ${formatDateKey(reminder.expiryDate)}. Detailed task history will expire; the aggregate monthly summary will remain available.`,
      `/app/monthly-analysis?month=${encodeURIComponent(reminder.monthKey)}`, { relatedEntityType: 'monthly-summary', relatedEntityId: reminder.monthKey, createdDate: reminder.createdDate, metadata: { expiryDate: reminder.expiryDate, timing: reminder.timing } });
  }

  for (const summary of monthlySummaries) {
    if (!summary?.id || summary.status !== 'finalized' || !summary.availability?.hasData) continue;
    add(`monthly-summary:${summary.id}`, 'monthly_analysis', 'monthly-summary-available', 'monthlySummaryAvailable',
      `${summary.monthLabel} analysis is available`, `The finalized monthly summary for ${summary.monthLabel} is available in Monthly Analysis.`,
      `/app/monthly-analysis?month=${encodeURIComponent(summary.monthKey)}`, { relatedEntityType: 'monthly-summary', relatedEntityId: summary.id, occurredAt: summary.generatedAt });
  }

  return candidates;
}

export function createInitialNotificationStore(progressionRunId, candidates = [], todayKey = '') {
  // Existing records are a baseline on first use; only due reminders from today are evaluated for first display.
  const currentReminders = candidates.filter((item) => item.eventType === 'history-expiry-reminder'
    && item.metadata?.createdDate === todayKey);
  const currentReminderIds = new Set(currentReminders.map((item) => item.id));
  return createEmptyNotificationStore(progressionRunId, candidates.filter((item) => !currentReminderIds.has(item.id)).map((item) => item.id));
}

export function appendNewNotificationEvents(store, candidates, preferences, now = new Date()) {
  const normalized = normalizeNotificationStore(store, store?.progressionRunId);
  const evaluated = new Set(normalized.evaluatedEventIds);
  const existingIds = new Set(normalized.notifications.map((item) => item.id));
  const notifications = [...normalized.notifications];
  for (const candidate of candidates) {
    if (evaluated.has(candidate.id)) continue;
    evaluated.add(candidate.id);
    if (!isNotificationEnabled(preferences, candidate.preferenceKey) || existingIds.has(candidate.id)) continue;
    const createdAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
    notifications.push({ ...candidate, createdAt, isRead: false, readAt: null });
    existingIds.add(candidate.id);
  }
  return { ...normalized, notifications, evaluatedEventIds: [...evaluated] };
}

export function markNotificationAsRead(store, notificationId, readAt = new Date().toISOString()) {
  if (!store?.notifications?.some((item) => item.id === notificationId && !item.isRead)) return store;
  return { ...store, notifications: store.notifications.map((item) => item.id === notificationId && !item.isRead
    ? { ...item, isRead: true, readAt }
    : item) };
}

export function markAllNotificationsAsRead(store, readAt = new Date().toISOString()) {
  if (!store?.notifications?.some((item) => !item.isRead)) return store;
  return { ...store, notifications: store.notifications.map((item) => item.isRead ? item : { ...item, isRead: true, readAt }) };
}

export function getUnreadNotificationCount(notifications = [], category = null) {
  return notifications.filter((item) => !item.isRead && (!category || item.category === category)).length;
}

export function filterNotifications(notifications = [], category = 'all') {
  if (category === 'unread') return notifications.filter((item) => !item.isRead);
  if (category === 'all') return notifications;
  return notifications.filter((item) => item.category === category);
}

export function sortNotificationsNewestFirst(notifications = []) {
  return [...notifications].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function formatNotificationDateTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Time unavailable';
  return formatDateTime(value);
}

export function resolveNotificationDestination(notification) {
  const target = typeof notification?.targetRoute === 'string' ? notification.targetRoute : '';
  const path = target.split('?')[0];
  const supportedExact = new Set(['/app/tasks', '/app/recovery-quests', '/app/discipline', '/app/dashboard', '/app/monthly-analysis']);
  if (supportedExact.has(path)) return target;
  return /^\/ranks\/(origin|ember|surge|vector|apex|zenith|continuum)$/.test(path) ? target : null;
}

function formatDateTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'time unavailable';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}
