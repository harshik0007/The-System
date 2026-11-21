import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from './AppIcon.jsx';
import PageLoadingSkeleton, { SkeletonLine } from './PageLoadingSkeleton.jsx';
import NotificationItem from './NotificationItem.jsx';
import { useNotificationCenter } from '../../context/NotificationCenterContext.jsx';

export default function AppNotificationPanel({ onClose }) {
  const { notifications, unreadCount, markRead, markAllRead, loadNotifications, loading, error } = useNotificationCenter();
  const [feedback, setFeedback] = useState(null);
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const recent = notifications.slice(0, 5);
  useEffect(() => {
    const controller = new AbortController();
    void loadNotifications({ limit: 5, signal: controller.signal }).catch(() => {});
    return () => controller.abort();
  }, [loadNotifications]);
  const handleMarkAll = async () => {
    if (markAllLoading) return;
    setMarkAllLoading(true);
    try {
      await markAllRead();
      setFeedback({ message: 'All notifications marked as read.', type: 'success' });
    } catch (requestError) {
      setFeedback({ message: requestError?.message || 'Notifications could not be updated.', type: 'error' });
    } finally {
      setMarkAllLoading(false);
    }
  };

  return (
    <section className="app-popover app-notifications" id="app-notifications" aria-label="Recent notifications">
      <div className="app-popover__heading">
        <div><p className="app-eyebrow">IN-APP UPDATES</p><h2>Notifications {unreadCount > 0 && <span>{unreadCount} unread</span>}</h2></div>
        <button className="app-icon-button" type="button" aria-label="Close notifications" onClick={onClose}><AppIcon name="close" /></button>
      </div>
      {unreadCount > 0 && <div className="app-notifications__actions"><button type="button" disabled={markAllLoading} onClick={() => void handleMarkAll()}>{markAllLoading ? <SkeletonLine width="short" label="Updating notification status" /> : 'Mark all as read'}</button></div>}
      {feedback && <p className={`app-notifications__feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'} aria-live={feedback.type === 'error' ? 'assertive' : 'polite'}>{feedback.message}</p>}
      {recent.length > 0 ? (
        <div className="app-notifications__preview-list">
          {recent.map((notice) => <NotificationItem key={notice.id} notification={notice} compact onMarkRead={markRead} onNavigate={onClose} />)}
        </div>
      ) : loading ? (
        <PageLoadingSkeleton variant="rows" compact label="Loading notifications" />
      ) : error ? (
        <div className="app-notifications__empty"><strong>Notifications unavailable</strong><p>{error}</p><button type="button" onClick={() => void loadNotifications({ limit: 5 }).catch(() => {})}>Retry</button></div>
      ) : (
        <div className="app-notifications__empty"><span><AppIcon name="bell" /></span><strong>You're All Caught Up</strong><p>Important system updates will appear here.</p></div>
      )}
      <Link className="app-notifications__view-all" to="/app/notifications" onClick={onClose}>View All Notifications <AppIcon name="arrow" /></Link>
    </section>
  );
}
