import { dashboardDemo } from '../../data/dashboardDemo.js';
import AppIcon from './AppIcon.jsx';

export default function AppNotificationPanel({ onClose }) {
  return (
    <section className="app-popover app-notifications" id="app-notifications" aria-label="Notifications">
      <div className="app-popover__heading">
        <div><p className="app-eyebrow">DEMONSTRATION PREVIEW</p><h2>Notifications</h2></div>
        <button className="app-icon-button" type="button" aria-label="Close notifications" onClick={onClose}><AppIcon name="close" /></button>
      </div>
      <ul className="app-notifications__list">
        {dashboardDemo.notifications.map((notice) => (
          <li key={notice.id}>
            <span className="app-notifications__dot" aria-hidden="true" />
            <div><strong>{notice.title}</strong><p>{notice.detail}</p><small>{notice.time}</small></div>
          </li>
        ))}
      </ul>
      <p className="app-popover__footnote">Notifications are examples only.</p>
    </section>
  );
}
