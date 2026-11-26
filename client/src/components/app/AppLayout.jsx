import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar.jsx';
import AppTopbar from './AppTopbar.jsx';
import AppPageContainer from './AppPageContainer.jsx';
import AuthenticatedFooter from './AuthenticatedFooter.jsx';
import { useUserPreferences } from '../../context/UserPreferencesContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { AccountActionsProvider } from '../../context/AccountActionsContext.jsx';
import { NotificationCenterProvider } from '../../context/NotificationCenterContext.jsx';
import { useTaskBackend } from '../../context/TaskBackendContext.jsx';
import AppIcon from './AppIcon.jsx';
import { taskApi } from '../../services/taskApi.js';
import '../../styles/app-shell.css';
import '../../styles/discipline.css';
import '../../styles/profile-task-layout-fixes.css';

const pauseResumeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
});

function EmergencyPauseBanner({ pause }) {
  const resumeAt = pause?.effectiveEndAt ? new Date(pause.effectiveEndAt) : null;
  const formattedResume = resumeAt && Number.isFinite(resumeAt.getTime())
    ? pauseResumeFormatter.format(resumeAt)
    : null;

  return <aside className="app-emergency-pause-banner" role="status" aria-live="polite">
    <span className="app-emergency-pause-banner__icon" aria-hidden="true"><AppIcon name="shield" /></span>
    <div className="app-emergency-pause-banner__copy">
      <strong>Emergency Pause is active</strong>
      <p>Scheduled Tasks and Recovery Quest actions are paused. Your Discipline Streak remains protected.</p>
    </div>
    {formattedResume && <span className="app-emergency-pause-banner__resume">Scheduled resume <time dateTime={resumeAt.toISOString()}>{formattedResume} IST</time></span>}
  </aside>;
}

export default function AppLayout() {
  const { mergePreferences } = useUserPreferences();
  const { emergencyPause } = useTaskBackend();
  const { member } = useAuth();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia('(max-width: 1100px)').matches);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileSettingsRetry, setProfileSettingsRetry] = useState(0);
  const [profileSettingsError, setProfileSettingsError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setProfileSettingsError('');
    taskApi.publicProfileSettings({ signal: controller.signal }).then(({ settings }) => {
      if (!settings) return;
      mergePreferences({
        profile: { username: member?.username || settings.username, avatarMark: settings.avatarMark },
        privacy: settings.privacy,
      });
    }).catch((error) => {
      if (!controller.signal.aborted) setProfileSettingsError(error?.message || 'Profile display preferences could not be loaded.');
    });
    return () => {
      controller.abort();
    };
  }, [member?.username, mergePreferences, profileSettingsRetry]);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 760px)');
    const compactQuery = window.matchMedia('(max-width: 1100px)');
    const updateMobile = (event) => setIsMobile(event.matches);
    const updateCompact = (event) => setSidebarCollapsed(event.matches);
    mobileQuery.addEventListener('change', updateMobile);
    compactQuery.addEventListener('change', updateCompact);
    return () => {
      mobileQuery.removeEventListener('change', updateMobile);
      compactQuery.removeEventListener('change', updateCompact);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileNavOpen(false);
  }, [isMobile]);

  const toggleNavigation = () => {
    if (isMobile) setMobileNavOpen((open) => !open);
    else setSidebarCollapsed((collapsed) => !collapsed);
  };
  const closeMobileNavigation = () => {
    setMobileNavOpen(false);
    if (isMobile) requestAnimationFrame(() => document.getElementById('app-navigation-toggle')?.focus());
  };
  const sidebarExpanded = isMobile ? mobileNavOpen : !sidebarCollapsed;

  return (
    <AccountActionsProvider>
    <NotificationCenterProvider>
    <div className={`app-layout${sidebarCollapsed && !isMobile ? ' app-layout--collapsed' : ''}`}>
      <AppSidebar
        collapsed={sidebarCollapsed}
        isMobile={isMobile}
        mobileOpen={mobileNavOpen}
        onClose={closeMobileNavigation}
        onExpand={() => setSidebarCollapsed(false)}
      />
      <div className="app-layout__main">
        <AppTopbar isMobile={isMobile} sidebarExpanded={sidebarExpanded} onNavigationToggle={toggleNavigation} />
        {emergencyPause?.isActive && <EmergencyPauseBanner pause={emergencyPause.pause} />}
        {profileSettingsError && <div className="app-profile-settings-error" role="alert">
          <span>{profileSettingsError}</span>
          <button type="button" onClick={() => setProfileSettingsRetry((attempt) => attempt + 1)}>Retry</button>
        </div>}
        <main className="app-layout__content" id="main-content">
          <AppPageContainer><Outlet /></AppPageContainer>
        </main>
        <AuthenticatedFooter />
      </div>
    </div>
    </NotificationCenterProvider>
    </AccountActionsProvider>
  );
}
