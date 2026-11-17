import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { applicationNavigationItems } from '../../data/applicationNavigation.js';
import { dashboardDemo } from '../../data/dashboardDemo.js';
import AppIcon from './AppIcon.jsx';
import AppNotificationPanel from './AppNotificationPanel.jsx';
import MemberProfileMenu from './MemberProfileMenu.jsx';
import { Link } from 'react-router-dom';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
import { DISCIPLINE_POINTS_CAP } from '../../data/disciplineConfig.js';

const titles = new Map(applicationNavigationItems.map((item) => [item.path, item.label]));

export default function AppTopbar({ isMobile, sidebarExpanded, onNavigationToggle }) {
  const location = useLocation();
  const { recoveryState, disciplineState } = useTaskSchedule();
  const [openPanel, setOpenPanel] = useState(null);
  const [previewMessage, setPreviewMessage] = useState('');
  const topbarRef = useRef(null);
  const notificationTriggerRef = useRef(null);
  const profileTriggerRef = useRef(null);
  const title = location.pathname === '/app/tasks/create'
    ? 'Create Schedule'
    : titles.get(location.pathname) || 'Dashboard';

  useEffect(() => {
    if (!openPanel) return undefined;
    const handlePointerDown = (event) => {
      if (!topbarRef.current?.contains(event.target)) setOpenPanel(null);
    };
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      const trigger = openPanel === 'profile' ? profileTriggerRef.current : notificationTriggerRef.current;
      setOpenPanel(null);
      requestAnimationFrame(() => trigger?.focus());
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openPanel]);

  const togglePanel = (panel) => {
    setPreviewMessage('');
    setOpenPanel((current) => current === panel ? null : panel);
  };

  const handleSignOutPreview = () => {
    setOpenPanel(null);
    setPreviewMessage('Sign out is a preview action. No account session is connected.');
  };

  return (
    <header className="app-topbar" ref={topbarRef}>
      <div className="app-topbar__page-title">
        <button
          className="app-icon-button app-topbar__nav-toggle"
          id="app-navigation-toggle"
          type="button"
          aria-label={isMobile ? (sidebarExpanded ? 'Close navigation' : 'Open navigation') : (sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar')}
          aria-controls="app-sidebar"
          aria-expanded={sidebarExpanded}
          onClick={onNavigationToggle}
        ><AppIcon name="menu" /></button>
        <div className="app-topbar__breadcrumbs"><span>THE SYSTEM</span><i aria-hidden="true">/</i><strong>{title}</strong></div>
      </div>
      <div className="app-topbar__actions">
        <nav className="app-topbar-balances" aria-label="Current balances">
          <Link className="app-topbar-balance app-topbar-balance--grace" to="/app/discipline" aria-label={`Grace Points: ${recoveryState.gracePoints}`} title="Grace Points">
            <AppIcon name="shield" /><span>GP</span><strong>{recoveryState.gracePoints}</strong>
          </Link>
          <Link className="app-topbar-balance app-topbar-balance--discipline" to="/app/discipline" aria-label={`Discipline Points: ${disciplineState.dpBalance.toFixed(2)} of ${DISCIPLINE_POINTS_CAP.toFixed(2)}`} title="Discipline Points">
            <AppIcon name="activity" /><span>DP</span><strong>{disciplineState.dpBalance.toFixed(2)}</strong><i>/ {DISCIPLINE_POINTS_CAP.toFixed(2)}</i>
          </Link>
        </nav>
        <button
          ref={notificationTriggerRef}
          className={`app-icon-button app-topbar__notification${openPanel === 'notifications' ? ' is-active' : ''}`}
          type="button"
          aria-label={`Notifications, ${dashboardDemo.notifications.length} demonstration items`}
          aria-expanded={openPanel === 'notifications'}
          aria-controls="app-notifications"
          onClick={() => togglePanel('notifications')}
        >
          <AppIcon name="bell" />
          {dashboardDemo.notifications.length > 0 && <span className="app-topbar__notification-count" aria-hidden="true">{dashboardDemo.notifications.length}</span>}
        </button>
        <MemberProfileMenu
          open={openPanel === 'profile'}
          triggerRef={profileTriggerRef}
          onToggle={() => togglePanel('profile')}
          onClose={() => setOpenPanel(null)}
          onSignOutPreview={handleSignOutPreview}
        />
        {openPanel === 'notifications' && <AppNotificationPanel onClose={() => setOpenPanel(null)} />}
        {previewMessage && <p className="app-topbar__status" role="status">{previewMessage}</p>}
      </div>
    </header>
  );
}
