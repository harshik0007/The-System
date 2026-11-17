import { dashboardDemo } from '../../data/dashboardDemo.js';
import AppIcon from './AppIcon.jsx';
import { formatDateKey } from '../../utils/monthlyAnalysis.js';

export default function AppNotificationPanel({ onClose, historyExpiryReminders = [] }) {
  return (
    <section className="app-popover app-notifications" id="app-notifications" aria-label="Notifications">
      <div className="app-popover__heading">
        <div><p className="app-eyebrow">IN-APP UPDATES</p><h2>Notifications</h2></div>
        <button className="app-icon-button" type="button" aria-label="Close notifications" onClick={onClose}><AppIcon name="close" /></button>
      </div>
      {historyExpiryReminders.length > 0 && <>
        <p className="app-notifications__group-label">HISTORY RETENTION</p>
        <ul className="app-notifications__list app-notifications__list--system">
          {[...historyExpiryReminders].reverse().map((notice) => (
            <li key={notice.id}>
              <span className="app-notifications__dot app-notifications__dot--system" aria-hidden="true" />
              <div><strong>{notice.title}</strong><p>{notice.detail}</p><small>{notice.timingLabel} before expiry · {formatDateKey(notice.createdDate)}</small></div>
            </li>
          ))}
        </ul>
      </>}
      <p className="app-notifications__group-label">PREVIEW ITEMS</p>
      <ul className="app-notifications__list">
        {dashboardDemo.notifications.map((notice) => (
          <li key={notice.id}>
            <span className="app-notifications__dot" aria-hidden="true" />
            <div><strong>{notice.title}</strong><p>{notice.detail}</p><small>{notice.time}</small></div>
          </li>
        ))}
      </ul>
      <p className="app-popover__footnote">History reminders are saved in this browser tab's session. Other notification items are examples only.</p>
    </section>
  );
}
