import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from './AppIcon.jsx';
import { formatNotificationDateTime, resolveNotificationDestination } from '../../utils/notificationCenter.js';
import '../../styles/notification-feedback.css';

const categoryIcons = {
  tasks: 'tasks',
  'recovery-quests': 'recovery',
  discipline: 'activity',
  'rank-xp': 'spark',
  'emergency-pause': 'shield',
  'monthly-retention': 'analysis',
};

const notificationIconFor = (notification) => {
  if (notification.category === 'emergency-pause' && notification.eventType?.includes('resumed')) return 'play';
  if (notification.category === 'emergency-pause' && notification.eventType?.includes('activated')) return 'pause';
  return categoryIcons[notification.category] || 'bell';
};

export default function NotificationItem({ notification, compact = false, onMarkRead, onDelete, onNavigate }) {
  const [markingRead, setMarkingRead] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');
  const tone = notification.eventType?.includes('deduction') || notification.eventType?.includes('expired')
    ? 'warning'
    : notification.eventType?.includes('reward') || notification.eventType?.includes('qualified') || notification.eventType?.includes('rank-up')
      ? 'success'
      : 'standard';
  const destination = resolveNotificationDestination(notification) || '/app/notifications';
  const displayedAt = notification.occurredAt || notification.createdAt;
  const markReadSafely = async () => {
    if (notification.isRead || !onMarkRead || markingRead || deleting) return;
    setMarkingRead(true);
    setActionError('');
    try {
      await onMarkRead(notification.id);
    } catch {
      setActionError('This notification could not be updated. Please try again.');
    } finally {
      setMarkingRead(false);
    }
  };
  const deleteSafely = async () => {
    if (!onDelete || deleting || markingRead) return;
    setDeleting(true);
    setActionError('');
    try {
      await onDelete(notification.id);
    } catch {
      setActionError('This notification could not be deleted. Refresh your inbox and try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className={`notification-item notification-item--${tone} notification-item--category-${notification.category || 'other'}${notification.isRead ? ' is-read' : ' is-unread'}${compact ? ' notification-item--compact' : ''}`}>
      <Link
        className="notification-item__main"
        to={destination}
        onClick={() => { void markReadSafely(); onNavigate?.(); }}
      >
        <span className="notification-item__icon"><AppIcon name={notificationIconFor(notification)} /></span>
        <span className="notification-item__copy">
          <span className="notification-item__title-row">
            <strong>{notification.title}</strong>
            {!notification.isRead && <span className="notification-item__new"><i aria-hidden="true" />Unread</span>}
          </span>
          <span className="notification-item__description">{notification.description}</span>
          <time className="notification-item__time" dateTime={displayedAt}>{formatNotificationDateTime(displayedAt)}</time>
        </span>
      </Link>
      {((!compact && !notification.isRead) || onDelete) && <div className="notification-item__actions">
        {!compact && !notification.isRead && <button className="notification-item__mark-read" type="button" disabled={markingRead || deleting} onClick={() => void markReadSafely()}>
          {markingRead ? 'Updating…' : 'Mark as read'}
        </button>}
        {onDelete && <button className="notification-item__delete" type="button" aria-label={`Delete notification: ${notification.title}`} title="Delete notification" disabled={deleting || markingRead} onClick={() => void deleteSafely()}>
          <AppIcon name="trash" />{compact ? null : deleting ? 'Deleting…' : 'Delete'}
        </button>}
      </div>}
      {actionError && <p className="notification-item__action-error" role="alert">{actionError}</p>}
    </article>
  );
}
