import { Link } from 'react-router-dom';
import { dashboardDemo } from '../../data/dashboardDemo.js';
import AppIcon from './AppIcon.jsx';

export default function MemberProfileMenu({ open, onToggle, onClose, onSignOutPreview, triggerRef }) {
  return (
    <div className="app-profile-menu">
      <button
        ref={triggerRef}
        className={`app-profile-menu__trigger${open ? ' is-open' : ''}`}
        type="button"
        aria-expanded={open}
        aria-controls="app-profile-panel"
        onClick={onToggle}
      >
        <span className="app-profile-menu__avatar" aria-hidden="true">M</span>
        <span className="app-profile-menu__trigger-copy"><strong>{dashboardDemo.member.displayName}</strong><small>DEMO ACCOUNT</small></span>
        <span className="app-profile-menu__chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <section className="app-popover app-profile-panel" id="app-profile-panel" aria-label="Member account">
          <div className="app-profile-panel__identity"><span className="app-profile-menu__avatar" aria-hidden="true">M</span><div><strong>{dashboardDemo.member.displayName}</strong><small>{dashboardDemo.member.accountLabel}</small></div></div>
          <p className="app-profile-panel__account-state"><span /> No account is connected to this preview.</p>
          <nav className="app-profile-panel__links" aria-label="Member account links">
            <Link to="/app/profile" onClick={onClose}><AppIcon name="profile" />View Profile</Link>
            <Link to="/app/settings" onClick={onClose}><AppIcon name="settings" />Settings</Link>
            <Link to="/app/profile" onClick={onClose}><AppIcon name="activity" />Account information</Link>
          </nav>
          <button className="app-profile-panel__signout" type="button" onClick={onSignOutPreview}>Sign out <span>Preview only</span></button>
        </section>
      )}
    </div>
  );
}
