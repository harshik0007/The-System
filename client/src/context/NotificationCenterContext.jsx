import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTaskSchedule } from './TaskScheduleContext.jsx';
import { useUserPreferences } from './UserPreferencesContext.jsx';
import {
  appendNewNotificationEvents,
  buildNotificationCandidates,
  createInitialNotificationStore,
  filterNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  normalizeNotificationStore,
  NOTIFICATIONS_SESSION_KEY,
  sortNotificationsNewestFirst,
} from '../utils/notificationCenter.js';
import { getIstDateKey } from '../utils/taskScheduleBuilder.js';

const NotificationCenterContext = createContext(null);

function readStore(progressionRunId, candidates, todayKey) {
  try {
    const raw = window.sessionStorage.getItem(NOTIFICATIONS_SESSION_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (stored?.progressionRunId === progressionRunId) return normalizeNotificationStore(stored, progressionRunId);
    }
  } catch {
    // Keep the notification inbox available in memory if storage is unavailable.
  }
  return createInitialNotificationStore(progressionRunId, candidates, todayKey);
}

function persistStore(store) {
  try {
    window.sessionStorage.setItem(NOTIFICATIONS_SESSION_KEY, JSON.stringify(store));
  } catch {
    // Notification interactions remain usable for the current page session.
  }
}

export function NotificationCenterProvider({ children }) {
  const {
    currentSchedule, recoveryState, disciplineState, emergencyPauseState,
    monthlySummaries, historyExpiryReminders,
  } = useTaskSchedule();
  const { preferences } = useUserPreferences();
  const progressionRunId = disciplineState.progressionRunId;
  const todayKey = getIstDateKey();
  const candidates = useMemo(() => buildNotificationCandidates({
    currentSchedule, recoveryState, disciplineState, emergencyPauseState, monthlySummaries, historyExpiryReminders,
  }), [currentSchedule, recoveryState, disciplineState, emergencyPauseState, monthlySummaries, historyExpiryReminders]);
  const [store, setStore] = useState(() => readStore(progressionRunId, candidates, todayKey));
  const activeStore = store.progressionRunId === progressionRunId
    ? store
    : createInitialNotificationStore(progressionRunId, candidates, todayKey);

  useEffect(() => {
    setStore((current) => {
      const base = current.progressionRunId === progressionRunId
        ? current
        : createInitialNotificationStore(progressionRunId, candidates, todayKey);
      const next = appendNewNotificationEvents(base, candidates, preferences, new Date());
      return JSON.stringify(next) === JSON.stringify(base) ? current : next;
    });
  }, [progressionRunId, candidates, preferences, todayKey]);

  useEffect(() => {
    if (store.progressionRunId !== progressionRunId) return;
    persistStore(store);
  }, [store, progressionRunId]);

  const markRead = useCallback((notificationId) => {
    setStore((current) => {
      const base = current.progressionRunId === progressionRunId ? current : activeStore;
      const next = markNotificationAsRead(base, notificationId);
      if (next !== base) persistStore(next);
      return next;
    });
  }, [progressionRunId, activeStore]);
  const markAllRead = useCallback(() => {
    setStore((current) => {
      const base = current.progressionRunId === progressionRunId ? current : activeStore;
      const next = markAllNotificationsAsRead(base);
      if (next !== base) persistStore(next);
      return next;
    });
  }, [progressionRunId, activeStore]);

  const notifications = useMemo(() => sortNotificationsNewestFirst(activeStore.notifications), [activeStore.notifications]);
  const unreadCount = useMemo(() => getUnreadNotificationCount(notifications), [notifications]);
  const value = useMemo(() => ({
    notifications,
    unreadCount,
    getUnreadCount: (category) => getUnreadNotificationCount(notifications, category),
    getFilteredNotifications: (category) => filterNotifications(notifications, category),
    markRead,
    markAllRead,
  }), [notifications, unreadCount, markRead, markAllRead]);

  return <NotificationCenterContext.Provider value={value}>{children}</NotificationCenterContext.Provider>;
}

export function useNotificationCenter() {
  const context = useContext(NotificationCenterContext);
  if (!context) throw new Error('useNotificationCenter must be used within NotificationCenterProvider.');
  return context;
}
