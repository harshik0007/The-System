import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../../components/app/AppIcon.jsx';
import NotificationItem from '../../components/app/NotificationItem.jsx';
import { useNotificationCenter } from '../../context/NotificationCenterContext.jsx';
import { NOTIFICATION_CATEGORIES } from '../../utils/notificationCenter.js';
import '../../styles/notification-center.css';

export default function NotificationsPage() {
  const { notifications, getUnreadCount, getFilteredNotifications, markRead, markAllRead } = useNotificationCenter();
  const [activeCategory, setActiveCategory] = useState('all');
  const [feedback, setFeedback] = useState('');
  const visibleNotifications = useMemo(() => getFilteredNotifications(activeCategory), [getFilteredNotifications, activeCategory]);

  const handleMarkAll = () => {
    markAllRead();
    setFeedback('All notifications marked as read. Your notification history is preserved.');
  };

  const emptyTitle = activeCategory === 'unread' ? "You're All Caught Up" : 'No Notifications Yet';
  const emptyMessage = activeCategory === 'unread'
    ? 'Important system updates will appear here when there is something new to review.'
    : 'There are no notifications in this view. Updates will appear here as recorded events occur.';

  return (
    <section className="notifications-page">
      <header className="notifications-page__header">
        <div>
          <p className="app-eyebrow">SYSTEM INBOX</p>
          <h1>Notifications</h1>
          <p>Stay informed about your progress, important events and upcoming actions.</p>
        </div>
        <div className="notifications-page__header-actions">
          <span className="notifications-page__unread-summary"><i aria-hidden="true" />{getUnreadCount()} unread</span>
          <Link to="/app/settings?category=notifications" className="notifications-page__settings-link"><AppIcon name="settings" /> Notification preferences</Link>
        </div>
      </header>

      <section className="notifications-inbox" aria-label="Notification history">
        <div className="notifications-inbox__toolbar">
          <div className="notifications-filters" role="group" aria-label="Filter notifications">
            {NOTIFICATION_CATEGORIES.map((category) => {
              const unread = getUnreadCount(category.id === 'all' || category.id === 'unread' ? null : category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`notifications-filter${activeCategory === category.id ? ' is-active' : ''}`}
                  aria-pressed={activeCategory === category.id}
                  onClick={() => setActiveCategory(category.id)}
                >
                  {category.label}
                  {unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}
                </button>
              );
            })}
          </div>
          <button className="notifications-mark-all" type="button" onClick={handleMarkAll} disabled={getUnreadCount() === 0}>
            Mark All as Read <AppIcon name="tasks" />
          </button>
        </div>
        {feedback && <p className="notifications-inbox__feedback" role="status">{feedback}</p>}

        {visibleNotifications.length > 0 ? (
          <div className="notifications-list" aria-live="polite">
            {visibleNotifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} onMarkRead={markRead} />
            ))}
          </div>
        ) : (
          <div className="notifications-empty">
            <span className="notifications-empty__icon"><AppIcon name="bell" /></span>
            <p className="app-eyebrow">{activeCategory === 'all' || activeCategory === 'unread' ? 'INBOX STATUS' : 'CATEGORY STATUS'}</p>
            <h2>{emptyTitle}</h2>
            <p>{emptyMessage}</p>
          </div>
        )}
        <p className="notifications-inbox__storage-note">Notification history is stored in this browser session for the current progression run. It is not synced to a server.</p>
      </section>
    </section>
  );
}
