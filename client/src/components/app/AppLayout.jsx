import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar.jsx';
import AppTopbar from './AppTopbar.jsx';
import AppPageContainer from './AppPageContainer.jsx';
import '../../styles/app-shell.css';

export default function AppLayout() {
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
        <main className="app-layout__content" id="main-content">
          <AppPageContainer><Outlet /></AppPageContainer>
        </main>
      </div>
    </div>
  );
}
