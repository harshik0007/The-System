import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar.jsx';
import AppTopbar from './AppTopbar.jsx';
import AppPageContainer from './AppPageContainer.jsx';
import { Link } from 'react-router-dom';
import AppIcon from './AppIcon.jsx';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
import '../../styles/app-shell.css';
import '../../styles/discipline.css';

export default function AppLayout() {
  const { rankUpNotice, dismissRankUpNotice } = useTaskSchedule();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia('(max-width: 1100px)').matches);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
        {rankUpNotice && <section className="discipline-rank-up discipline-rank-up--global" role="status" aria-live="polite"><span><AppIcon name="spark" /></span><div><p className="app-eyebrow">RANK ADVANCED</p><h2>Rank {rankUpNotice.rankNumber} — {rankUpNotice.rankName}</h2><p>{rankUpNotice.dpAwarded > 0 ? `+${rankUpNotice.dpAwarded.toFixed(2)} Discipline Points awarded.` : 'No Discipline Points were added because the balance is at its cap.'} Rank-entry XP remains pending configuration.</p><Link to={`/ranks/${rankUpNotice.rankSlug}`}>View Rank <AppIcon name="arrow" /></Link></div><button type="button" onClick={dismissRankUpNotice} aria-label="Dismiss Rank update"><AppIcon name="close" /></button></section>}
        <main className="app-layout__content" id="main-content">
          <AppPageContainer><Outlet /></AppPageContainer>
        </main>
      </div>
    </div>
  );
}
