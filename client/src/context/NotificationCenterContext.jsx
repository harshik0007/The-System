import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { taskApi } from '../services/taskApi.js';
import { NOTIFICATION_CATEGORIES } from '../utils/notificationCenter.js';

const NotificationCenterContext = createContext(null);
const DEFAULT_CATEGORIES = Object.freeze(Object.fromEntries(NOTIFICATION_CATEGORIES.map(({ id }) => [id, true])));

export function NotificationCenterProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationPreferences, setNotificationPreferences] = useState(DEFAULT_CATEGORIES);
  const [page, setPage] = useState({ nextCursor: null, hasMore: false, limit: 20 });
  const [loading, setLoading] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [error, setError] = useState('');
  const listRequestSequence = useRef(0);
  const lastListQuery = useRef(null);

  const refreshUnreadCount = useCallback(async (options) => {
    const response = await taskApi.notificationUnreadCount(options);
    const count = Number(response?.data?.unreadCount);
    setUnreadCount(Number.isFinite(count) ? Math.max(0, count) : 0);
    return Number.isFinite(count) ? Math.max(0, count) : 0;
  }, []);

  const loadNotifications = useCallback(async ({ category = null, readState = 'all', cursor = null, limit = 20, append = false, signal } = {}) => {
    const requestSequence = ++listRequestSequence.current;
    lastListQuery.current = { category, readState, limit };
    setLoading(true);
    setError('');
    try {
      const response = await taskApi.notifications({ category, readState, cursor, limit }, { signal });
      const result = response?.data || {};
      const items = Array.isArray(result.notifications) ? result.notifications : [];
      if (requestSequence === listRequestSequence.current) {
        setNotifications((current) => append ? [...current, ...items] : items);
        setPage({ nextCursor: result.nextCursor || null, hasMore: Boolean(result.hasMore), limit: result.limit || limit });
      }
      return items;
    } catch (requestError) {
      if (requestError?.name !== 'AbortError' && requestSequence === listRequestSequence.current) {
        setError(requestError?.message || 'Notifications could not be loaded. Retry when the service is available.');
      }
      throw requestError;
    } finally {
      if (requestSequence === listRequestSequence.current) setLoading(false);
    }
  }, []);

  const refreshPreferences = useCallback(async (options) => {
    setPreferencesLoading(true);
    try {
      const response = await taskApi.notificationPreferences(options);
      setNotificationPreferences({ ...DEFAULT_CATEGORIES, ...(response?.data?.categories || {}) });
      return response?.data?.categories || DEFAULT_CATEGORIES;
    } finally {
      setPreferencesLoading(false);
    }
  }, []);

  const updateNotificationPreferences = useCallback(async (categories) => {
    const response = await taskApi.updateNotificationPreferences(categories);
    const next = { ...DEFAULT_CATEGORIES, ...(response?.data?.categories || {}) };
    setNotificationPreferences(next);
    return next;
  }, []);

  const markRead = useCallback(async (notificationId) => {
    const response = await taskApi.markNotificationRead(notificationId);
    const result = response?.data;
    listRequestSequence.current += 1;
    setLoading(false);
    if (result?.notification) {
      setNotifications((current) => {
        if (lastListQuery.current?.readState === 'unread') return current.filter((item) => item.id !== notificationId);
        return current.map((item) => item.id === notificationId ? result.notification : item);
      });
    }
    if (Number.isFinite(Number(result?.unreadCount))) setUnreadCount(Math.max(0, Number(result.unreadCount)));
    return result?.notification || null;
  }, []);

  const markAllRead = useCallback(async () => {
    const response = await taskApi.markAllNotificationsRead();
    const now = new Date().toISOString();
    listRequestSequence.current += 1;
    setLoading(false);
    setNotifications((current) => {
      if (lastListQuery.current?.readState === 'unread') return [];
      return current.map((item) => item.isRead ? item : { ...item, isRead: true, readAt: now });
    });
    setUnreadCount(Number(response?.data?.unreadCount) || 0);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    Promise.allSettled([
      refreshUnreadCount({ signal: controller.signal }),
      refreshPreferences({ signal: controller.signal }),
    ]).then((results) => {
      if (!active) return;
      const rejected = results.find((result) => result.status === 'rejected');
      if (rejected) setError(rejected.reason?.message || 'Notification service is temporarily unavailable.');
    });
    const syncCount = () => { void refreshUnreadCount().catch((requestError) => setError(requestError?.message || 'Unread count could not be refreshed.')); };
    const onVisibility = () => { if (document.visibilityState === 'visible') syncCount(); };
    const onBusinessChange = () => {
      syncCount();
      const inboxVisible = window.location.pathname === '/app/notifications' || document.getElementById('app-notifications');
      if (inboxVisible && lastListQuery.current) void loadNotifications(lastListQuery.current).catch(() => {});
    };
    window.addEventListener('focus', syncCount);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('system:notifications-refresh', onBusinessChange);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener('focus', syncCount);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('system:notifications-refresh', onBusinessChange);
    };
  }, [refreshUnreadCount, refreshPreferences, loadNotifications]);

  const value = useMemo(() => ({
    notifications, unreadCount, notificationPreferences, page, loading, preferencesLoading, error,
    loadNotifications, refreshUnreadCount, refreshPreferences, updateNotificationPreferences, markRead, markAllRead,
  }), [notifications, unreadCount, notificationPreferences, page, loading, preferencesLoading, error,
    loadNotifications, refreshUnreadCount, refreshPreferences, updateNotificationPreferences, markRead, markAllRead]);

  return <NotificationCenterContext.Provider value={value}>{children}</NotificationCenterContext.Provider>;
}

export function useNotificationCenter() {
  const context = useContext(NotificationCenterContext);
  if (!context) throw new Error('useNotificationCenter must be used within NotificationCenterProvider.');
  return context;
}
