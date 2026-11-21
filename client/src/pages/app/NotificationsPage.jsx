import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../../components/app/AppIcon.jsx';
import PageLoadingSkeleton, { SkeletonLine } from '../../components/app/PageLoadingSkeleton.jsx';
import NotificationItem from '../../components/app/NotificationItem.jsx';
import { useNotificationCenter } from '../../context/NotificationCenterContext.jsx';
import { NOTIFICATION_CATEGORIES } from '../../utils/notificationCenter.js';
import '../../styles/notification-center.css';

export default function NotificationsPage() {
  const { notifications, unreadCount, page, loading, error, loadNotifications, markRead, markAllRead } = useNotificationCenter();
  const [activeCategory, setActiveCategory] = useState('');
  const [activeReadState, setActiveReadState] = useState('all');
  const [feedback, setFeedback] = useState('');
  const [markAllLoading, setMarkAllLoading] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setFeedback('');
    loadNotifications({ category: activeCategory || null, readState: activeReadState, signal: controller.signal })
      .catch(() => { if (active) setFeedback('The inbox could not be refreshed. Please retry.'); });
    return () => { active = false; controller.abort(); };
  }, [activeCategory, activeReadState, loadNotifications]);

  const handleMarkAll = async () => {
    if (markAllLoading) return;
    setMarkAllLoading(true);
    try {
      await markAllRead();
      setFeedback('All notifications marked as read. Your notification history is preserved.');
    } catch (requestError) {
      setFeedback(requestError?.message || 'Notifications could not be updated. Please retry.');
    } finally {
      setMarkAllLoading(false);
    }
  };

  const activeLabel = NOTIFICATION_CATEGORIES.find(({ id }) => id === activeCategory)?.label;
  const emptyTitle = activeReadState === 'unread' ? "You're All Caught Up" : activeReadState === 'read' ? 'No Read Notifications' : 'No Notifications Yet';
  const emptyMessage = activeCategory
    ? `No ${activeReadState === 'all' ? '' : `${activeReadState} `}${activeLabel} notifications are available here.`
    : activeReadState === 'unread'
      ? 'Important system updates will appear here when there is something new to review.'
      : activeReadState === 'read'
        ? 'Notifications you have reviewed will appear in this view.'
        : 'Updates will appear here as recorded system events occur.';

  return (
    <section className="notifications-page">
      <header className="notifications-page__header">
        <div>
          <p className="app-eyebrow">SYSTEM INBOX</p>
          <h1>Notifications</h1>
          <p>Stay informed about your progress, important events and upcoming actions.</p>
        </div>
        <div className="notifications-page__header-actions">
          <span className="notifications-page__unread-summary"><i aria-hidden="true" />{unreadCount} unread</span>
          <Link to="/app/settings?category=notifications" className="notifications-page__settings-link"><AppIcon name="settings" /> Notification preferences</Link>
        </div>
      </header>

      <section className="notifications-inbox" aria-label="Notification history">
        <div className="notifications-inbox__toolbar">
          <div className="notifications-inbox__filter-groups">
            <div className="notifications-filters" role="group" aria-label="Filter by read state">
              {[['all', 'All'], ['unread', 'Unread'], ['read', 'Read']].map(([id, label]) => (
                <button key={id} type="button" className={`notifications-filter${activeReadState === id ? ' is-active' : ''}`} aria-pressed={activeReadState === id} onClick={() => setActiveReadState(id)}>{label}</button>
              ))}
            </div>
            <div className="notifications-filters notifications-filters--categories" role="group" aria-label="Filter by category">
              <button type="button" className={`notifications-filter${!activeCategory ? ' is-active' : ''}`} aria-pressed={!activeCategory} onClick={() => setActiveCategory('')}>All categories</button>
              {NOTIFICATION_CATEGORIES.map((category) => (
                <button key={category.id} type="button" className={`notifications-filter${activeCategory === category.id ? ' is-active' : ''}`} aria-pressed={activeCategory === category.id} onClick={() => setActiveCategory(category.id)}>{category.label}</button>
              ))}
            </div>
          </div>
          <button className="notifications-mark-all" type="button" onClick={handleMarkAll} disabled={unreadCount === 0 || loading || markAllLoading}>
            {markAllLoading ? <SkeletonLine width="short" label="Updating notification status" /> : 'Mark All as Read'} <AppIcon name="tasks" />
          </button>
        </div>
        {(feedback || error) && <div className="notifications-inbox__feedback" role={error ? 'alert' : 'status'}>
          <span>{error || feedback}</span>
          {error && <button type="button" onClick={() => void loadNotifications({ category: activeCategory || null, readState: activeReadState }).catch(() => {})}>Retry</button>}
        </div>}

        {notifications.length > 0 ? (
          <div className="notifications-list" aria-live="polite">
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} onMarkRead={markRead} />
            ))}
          </div>
        ) : loading ? <PageLoadingSkeleton variant="rows" compact label="Loading notifications" /> : (
          <div className="notifications-empty">
            <span className="notifications-empty__icon"><AppIcon name="bell" /></span>
            <p className="app-eyebrow">{activeCategory ? 'CATEGORY STATUS' : 'INBOX STATUS'}</p>
            <h2>{emptyTitle}</h2>
            <p>{emptyMessage}</p>
          </div>
        )}
        {page.hasMore && <div className="notifications-inbox__pagination"><button className="notifications-mark-all" type="button" disabled={loading} onClick={() => void loadNotifications({ category: activeCategory || null, readState: activeReadState, cursor: page.nextCursor, limit: page.limit, append: true }).catch(() => {})}>{loading ? 'Loading…' : 'Load more notifications'}</button></div>}
        <p className="notifications-inbox__storage-note">Notification history is stored with your account and remains available after refresh. In-app notifications only.</p>
      </section>
    </section>
  );
}
