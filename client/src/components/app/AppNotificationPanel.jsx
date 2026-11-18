import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from './AppIcon.jsx';
import NotificationItem from './NotificationItem.jsx';
import { useNotificationCenter } from '../../context/NotificationCenterContext.jsx';

export default function AppNotificationPanel({ onClose }) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationCenter();
  const [feedback, setFeedback] = useState('');
  const recent = notifications.slice(0, 5);
  const handleMarkAll = () => {
    markAllRead();
    setFeedback('All notifications marked as read.');
  };

  return (
    <section className="app-popover app-notifications" id="app-notifications" aria-label="Recent notifications">
      <div className="app-popover__heading">
        <div><p className="app-eyebrow">IN-APP UPDATES</p><h2>Notifications {unreadCount > 0 && <span>{unreadCount} unread</span>}</h2></div>
        <button className="app-icon-button" type="button" aria-label="Close notifications" onClick={onClose}><AppIcon name="close" /></button>
      </div>
      {unreadCount > 0 && <div className="app-notifications__actions"><button type="button" onClick={handleMarkAll}>Mark all as read</button></div>}
      {feedback && <p className="app-notifications__feedback" role="status">{feedback}</p>}
      {recent.length > 0 ? (
        <div className="app-notifications__preview-list">
          {recent.map((notice) => <NotificationItem key={notice.id} notification={notice} compact onMarkRead={markRead} onNavigate={onClose} />)}
        </div>
      ) : (
        <div className="app-notifications__empty"><span><AppIcon name="bell" /></span><strong>You're All Caught Up</strong><p>Important system updates will appear here.</p></div>
      )}
      <Link className="app-notifications__view-all" to="/app/notifications" onClick={onClose}>View All Notifications <AppIcon name="arrow" /></Link>
    </section>
  );
}
