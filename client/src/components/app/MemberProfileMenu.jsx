import { Link } from 'react-router-dom';
import { dashboardDemo } from '../../data/dashboardDemo.js';
import AppIcon from './AppIcon.jsx';
import MemberAvatar from './MemberAvatar.jsx';
import { useUserPreferences } from '../../context/UserPreferencesContext.jsx';

export default function MemberProfileMenu({ open, onToggle, onClose, onSignOut, triggerRef }) {
  const { preferences } = useUserPreferences();
  const { displayName, avatarMark } = preferences.profile;
  return (
    <div className="app-profile-menu">
      <button
        ref={triggerRef}
        id="app-profile-menu-trigger"
        className={`app-profile-menu__trigger${open ? ' is-open' : ''}`}
        type="button"
        aria-expanded={open}
        aria-controls="app-profile-panel"
        onClick={onToggle}
      >
        <MemberAvatar name={displayName} mark={avatarMark} className="app-profile-menu__avatar" />
        <span className="app-profile-menu__trigger-copy"><strong>{displayName}</strong><small>DEMO ACCOUNT</small></span>
        <span className="app-profile-menu__chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <section className="app-popover app-profile-panel" id="app-profile-panel" aria-label="Member account">
          <div className="app-profile-panel__identity"><MemberAvatar name={displayName} mark={avatarMark} className="app-profile-menu__avatar" /><div><strong>{displayName}</strong><small>{dashboardDemo.member.accountLabel}</small></div></div>
          <p className="app-profile-panel__account-state"><span /> No account is connected to this preview.</p>
          <nav className="app-profile-panel__links" aria-label="Member account links">
            <Link to="/app/profile" onClick={onClose}><AppIcon name="profile" />View Profile</Link>
            <Link to="/app/settings" onClick={onClose}><AppIcon name="settings" />Settings</Link>
            <Link to="/app/profile" onClick={onClose}><AppIcon name="activity" />Account information</Link>
          </nav>
          <button className="app-profile-panel__signout" type="button" onClick={onSignOut}>Log out</button>
        </section>
      )}
    </div>
  );
}
