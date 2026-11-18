import { Link } from 'react-router-dom';
import AppIcon from './AppIcon.jsx';
import { formatNotificationDateTime, resolveNotificationDestination } from '../../utils/notificationCenter.js';

const categoryIcons = {
  tasks: 'tasks',
  recovery_quests: 'recovery',
  discipline: 'activity',
  rank_xp: 'spark',
  emergency_pause: 'shield',
  monthly_analysis: 'analysis',
};

export default function NotificationItem({ notification, compact = false, onMarkRead, onNavigate }) {
  const tone = notification.eventType?.includes('deduction') || notification.eventType?.includes('expired')
    ? 'warning'
    : notification.eventType?.includes('reward') || notification.eventType?.includes('qualified') || notification.eventType?.includes('rank-up')
      ? 'success'
      : 'standard';
  const destination = resolveNotificationDestination(notification) || '/app/notifications';
  const displayedAt = notification.occurredAt || notification.createdAt;

  return (
    <article className={`notification-item notification-item--${tone}${notification.isRead ? ' is-read' : ' is-unread'}${compact ? ' notification-item--compact' : ''}`}>
      <Link
        className="notification-item__main"
        to={destination}
        onClick={() => { onMarkRead?.(notification.id); onNavigate?.(); }}
      >
        <span className="notification-item__icon"><AppIcon name={categoryIcons[notification.category] || 'bell'} /></span>
        <span className="notification-item__copy">
          <span className="notification-item__title-row">
            <strong>{notification.title}</strong>
            {!notification.isRead && <span className="notification-item__new"><i aria-hidden="true" />Unread</span>}
          </span>
          <span className="notification-item__description">{notification.description}</span>
          <time className="notification-item__time" dateTime={displayedAt}>{formatNotificationDateTime(displayedAt)}</time>
        </span>
      </Link>
      {!compact && !notification.isRead && (
        <button className="notification-item__mark-read" type="button" onClick={() => onMarkRead?.(notification.id)}>
          Mark as read
        </button>
      )}
    </article>
  );
}
