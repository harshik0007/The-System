import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from './AppIcon.jsx';
import { formatNotificationDateTime, resolveNotificationDestination } from '../../utils/notificationCenter.js';

const categoryIcons = {
  tasks: 'tasks',
  'recovery-quests': 'recovery',
  discipline: 'activity',
  'rank-xp': 'spark',
  'emergency-pause': 'shield',
  'monthly-retention': 'analysis',
};

export default function NotificationItem({ notification, compact = false, onMarkRead, onNavigate }) {
  const [markingRead, setMarkingRead] = useState(false);
  const [actionError, setActionError] = useState('');
  const tone = notification.eventType?.includes('deduction') || notification.eventType?.includes('expired')
    ? 'warning'
    : notification.eventType?.includes('reward') || notification.eventType?.includes('qualified') || notification.eventType?.includes('rank-up')
      ? 'success'
      : 'standard';
  const destination = resolveNotificationDestination(notification) || '/app/notifications';
  const displayedAt = notification.occurredAt || notification.createdAt;
  const markReadSafely = async () => {
    if (notification.isRead || !onMarkRead || markingRead) return;
    setMarkingRead(true);
    setActionError('');
    try {
      await onMarkRead(notification.id);
    } catch (error) {
      setActionError(error?.message || 'This notification could not be marked as read. Retry when the service is available.');
    } finally {
      setMarkingRead(false);
    }
  };

  return (
    <article className={`notification-item notification-item--${tone}${notification.isRead ? ' is-read' : ' is-unread'}${compact ? ' notification-item--compact' : ''}`}>
      <Link
        className="notification-item__main"
        to={destination}
        onClick={() => { void markReadSafely(); onNavigate?.(); }}
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
        <button className="notification-item__mark-read" type="button" disabled={markingRead} onClick={() => void markReadSafely()}>
          {markingRead ? 'Updating…' : 'Mark as read'}
        </button>
      )}
      {actionError && <p className="notification-item__action-error" role="alert">{actionError}</p>}
    </article>
  );
}
