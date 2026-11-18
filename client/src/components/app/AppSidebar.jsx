import { Link } from 'react-router-dom';
import BrandLogo from '../BrandLogo.jsx';
import { dashboardDemo } from '../../data/dashboardDemo.js';
import AppNavigation from './AppNavigation.jsx';
import AppIcon from './AppIcon.jsx';
import MemberAvatar from './MemberAvatar.jsx';
import { useUserPreferences } from '../../context/UserPreferencesContext.jsx';

export default function AppSidebar({ collapsed, mobileOpen, isMobile, onClose, onExpand }) {
  const { preferences } = useUserPreferences();
  return (
    <>
      {isMobile && mobileOpen && (
        <button className="app-sidebar-scrim" type="button" aria-label="Close application navigation" onClick={onClose} />
      )}
      <aside
        className={`app-sidebar${collapsed && !isMobile ? ' app-sidebar--collapsed' : ''}${mobileOpen ? ' app-sidebar--mobile-open' : ''}`}
        id="app-sidebar"
        aria-label="Application sidebar"
        aria-hidden={isMobile && !mobileOpen}
        inert={isMobile && !mobileOpen ? true : undefined}
      >
        <div className="app-sidebar__brand-row">
          <BrandLogo href="/" variant={collapsed && !isMobile ? 'compact' : 'full'} className="app-sidebar__brand" />
          {isMobile && <button className="app-icon-button app-sidebar__close" type="button" aria-label="Close navigation" onClick={onClose}><AppIcon name="close" /></button>}
          {!isMobile && collapsed && <button className="app-sidebar__expand" type="button" onClick={onExpand} aria-label="Expand sidebar" title="Expand sidebar"><AppIcon name="menu" /></button>}
        </div>

        <AppNavigation collapsed={collapsed && !isMobile} onNavigate={isMobile ? onClose : undefined} />

        <div className="app-sidebar__account">
          <MemberAvatar name={preferences.profile.displayName} mark={preferences.profile.avatarMark} className="app-sidebar__member-mark" />
          <span className="app-sidebar__member-copy"><strong>{preferences.profile.displayName}</strong><small>{dashboardDemo.member.accountLabel}</small></span>
          <Link className="app-sidebar__account-link" to="/app/profile" aria-label="View Member Profile" title={collapsed && !isMobile ? 'Member Profile' : undefined} onClick={isMobile ? onClose : undefined}>
            <AppIcon name="profile" />
          </Link>
        </div>
      </aside>
    </>
  );
}
