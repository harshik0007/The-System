import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '../BrandLogo.jsx';
import AppNavigation from './AppNavigation.jsx';
import AppIcon from './AppIcon.jsx';
import MemberAvatar from './MemberAvatar.jsx';
import { useUserPreferences } from '../../context/UserPreferencesContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AppSidebar({ collapsed, mobileOpen, isMobile, onClose, onExpand }) {
  const { preferences } = useUserPreferences();
  const { member } = useAuth();
  const username = member?.username || 'Member';
  const sidebarRef = useRef(null);
  useLayoutEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    if (isMobile && !mobileOpen) sidebar.setAttribute('inert', '');
    else sidebar.removeAttribute('inert');
  }, [isMobile, mobileOpen]);

  return (
    <>
      {isMobile && mobileOpen && (
        <button className="app-sidebar-scrim" type="button" aria-label="Close application navigation" onClick={onClose} />
      )}
      <aside
        ref={sidebarRef}
        className={`app-sidebar${collapsed && !isMobile ? ' app-sidebar--collapsed' : ''}${mobileOpen ? ' app-sidebar--mobile-open' : ''}`}
        id="app-sidebar"
        aria-label="Application sidebar"
        aria-hidden={isMobile && !mobileOpen}
      >
        <div className="app-sidebar__brand-row">
          <BrandLogo href="/app/dashboard" variant={collapsed && !isMobile ? 'compact' : 'full'} className="app-sidebar__brand" />
          {isMobile && <button className="app-icon-button app-sidebar__close" type="button" aria-label="Close navigation" onClick={onClose}><AppIcon name="close" /></button>}
          {!isMobile && collapsed && <button className="app-sidebar__expand" type="button" onClick={onExpand} aria-label="Expand sidebar" title="Expand sidebar"><AppIcon name="menu" /></button>}
        </div>

        <AppNavigation collapsed={collapsed && !isMobile} onNavigate={isMobile ? onClose : undefined} />

        <div className="app-sidebar__account">
          <MemberAvatar name={username} mark={preferences.profile.avatarMark} className="app-sidebar__member-mark" />
          <span className="app-sidebar__member-copy"><strong>{username}</strong><small>Member account</small></span>
          <Link className="app-sidebar__account-link" to="/app/profile" aria-label="View Member Profile" title={collapsed && !isMobile ? 'Member Profile' : undefined} onClick={isMobile ? onClose : undefined}>
            <AppIcon name="profile" />
          </Link>
        </div>
      </aside>
    </>
  );
}
