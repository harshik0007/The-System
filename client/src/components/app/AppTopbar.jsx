import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { applicationNavigationItems } from '../../data/applicationNavigation.js';
import AppIcon from './AppIcon.jsx';
import AppNotificationPanel from './AppNotificationPanel.jsx';
import { Link } from 'react-router-dom';
import { useTaskBackend } from '../../context/TaskBackendContext.jsx';
import { DISCIPLINE_POINTS_CAP } from '../../data/disciplineConfig.js';
import { useNotificationCenter } from '../../context/NotificationCenterContext.jsx';

const titles = new Map(applicationNavigationItems.map((item) => [item.path, item.label]));

export default function AppTopbar({ isMobile, sidebarExpanded, onNavigationToggle }) {
  const location = useLocation();
  const { gracePoints: serverGracePoints, progression: serverProgression, disciplineSummary } = useTaskBackend();
  const gracePointBalance = disciplineSummary?.gracePointBalance ?? serverProgression?.progression?.gracePoints ?? serverGracePoints?.balance ?? null;
  const disciplinePointBalance = disciplineSummary?.dpBalance ?? serverProgression?.progression?.disciplinePoints ?? null;
  const disciplinePointMaximum = Number(disciplineSummary?.disciplinePointWalletCap ?? DISCIPLINE_POINTS_CAP);
  const { unreadCount } = useNotificationCenter();
  const [openPanel, setOpenPanel] = useState(null);
  const topbarRef = useRef(null);
  const notificationTriggerRef = useRef(null);
  const title = location.pathname === '/app/tasks/create'
    ? 'Create Schedule'
    : location.pathname === '/app/notifications'
      ? 'Notifications'
    : titles.get(location.pathname) || 'Dashboard';

  useEffect(() => {
    if (!openPanel) return undefined;
    const handlePointerDown = (event) => {
      if (!topbarRef.current?.contains(event.target)) setOpenPanel(null);
    };
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setOpenPanel(null);
      requestAnimationFrame(() => notificationTriggerRef.current?.focus());
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openPanel]);

  const togglePanel = (panel) => {
    setOpenPanel((current) => current === panel ? null : panel);
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
          <Link className="app-topbar-balance app-topbar-balance--grace" to="/app/discipline" aria-label={`Grace Points: ${gracePointBalance ?? 'loading'}`} title="Grace Points">
            <AppIcon name="shield" /><span>GP</span><strong>{gracePointBalance ?? '—'}</strong>
          </Link>
          <Link className="app-topbar-balance app-topbar-balance--discipline" to="/app/discipline" aria-label={`Discipline Points: ${disciplinePointBalance === null ? 'loading' : `${Number(disciplinePointBalance).toFixed(2)} of ${disciplinePointMaximum.toFixed(2)}`}`} title="Discipline Points">
            <AppIcon name="activity" /><span>DP</span><strong>{disciplinePointBalance === null ? '—' : Number(disciplinePointBalance).toFixed(2)}</strong><i>/ {disciplinePointMaximum.toFixed(2)}</i>
          </Link>
        </nav>
        <button
          ref={notificationTriggerRef}
          className={`app-icon-button app-topbar__notification${openPanel === 'notifications' ? ' is-active' : ''}`}
          type="button"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications, no unread items'}
          aria-expanded={openPanel === 'notifications'}
          aria-controls="app-notifications"
          onClick={() => togglePanel('notifications')}
        >
          <AppIcon name="bell" />
          {unreadCount > 0 && <><span className="app-topbar__notification-count" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span><span className="app-topbar__notification-unread-dot" aria-hidden="true" /></>}
        </button>
        {openPanel === 'notifications' && <AppNotificationPanel onClose={() => setOpenPanel(null)} />}
      </div>
    </header>
  );
}
