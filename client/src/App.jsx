import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, useLocation } from 'react-router-dom';
import VoidShardCursor from './components/VoidShardCursor.jsx';
import PageTransition from './components/PageTransition.jsx';
import EmergencyPauseAtmosphere from './components/app/EmergencyPauseAtmosphere.jsx';
import LandingPage from './pages/LandingPage.jsx';
import { applicationNavigationItems } from './data/applicationNavigation.js';
import { TaskScheduleProvider, useTaskSchedule } from './context/TaskScheduleContext.jsx';
import { UserPreferencesProvider, useUserPreferences } from './context/UserPreferencesContext.jsx';

const routeLoaders = {
  signup: () => import('./pages/auth/SignUpPage.jsx'),
  login: () => import('./pages/auth/LoginPage.jsx'),
  verifyEmail: () => import('./pages/auth/VerifyEmailPage.jsx'),
  forgotPassword: () => import('./pages/auth/ForgotPasswordPage.jsx'),
  resetPassword: () => import('./pages/auth/ResetPasswordPage.jsx'),
  accountRecovery: () => import('./pages/auth/AccountRecoveryPage.jsx'),
  publicInfo: () => import('./pages/public/PublicInfoPage.jsx'),
  legal: () => import('./pages/public/LegalPage.jsx'),
  rankDetail: () => import('./pages/public/RankDetailPage.jsx'),
  appShell: () => import('./components/app/AppLayout.jsx'),
  settings: () => import('./pages/app/SettingsPage.jsx'),
  dashboard: () => import('./pages/app/DashboardPage.jsx'),
  dailyTasks: () => import('./pages/app/DailyTasksPage.jsx'),
  recoveryQuests: () => import('./pages/app/RecoveryQuestsPage.jsx'),
  discipline: () => import('./pages/app/DisciplinePage.jsx'),
  profile: () => import('./pages/app/ProfilePage.jsx'),
  publicMemberProfile: () => import('./pages/app/PublicMemberProfilePage.jsx'),
  leaderboard: () => import('./pages/app/LeaderboardPage.jsx'),
  createTasks: () => import('./pages/app/CreateTaskSchedulePage.jsx'),
  monthlyAnalysis: () => import('./pages/app/MonthlyAnalysisPage.jsx'),
  notifications: () => import('./pages/app/NotificationsPage.jsx'),
  appPlaceholder: () => import('./pages/app/AppPlaceholderPage.jsx'),
};
const prefetchedRoutes = new Set();

const SignUpPage = lazy(routeLoaders.signup);
const LoginPage = lazy(routeLoaders.login);
const VerifyEmailPage = lazy(routeLoaders.verifyEmail);
const ForgotPasswordPage = lazy(routeLoaders.forgotPassword);
const ResetPasswordPage = lazy(routeLoaders.resetPassword);
const AccountRecoveryPage = lazy(routeLoaders.accountRecovery);
const PublicInfoPage = lazy(routeLoaders.publicInfo);
const LegalPage = lazy(routeLoaders.legal);
const RankDetailPage = lazy(routeLoaders.rankDetail);
const AppLayout = lazy(routeLoaders.appShell);
const SettingsPageRoute = lazy(routeLoaders.settings);
const DashboardPage = lazy(routeLoaders.dashboard);
const DailyTasksPage = lazy(routeLoaders.dailyTasks);
const RecoveryQuestsPage = lazy(routeLoaders.recoveryQuests);
const DisciplinePage = lazy(routeLoaders.discipline);
const ProfilePage = lazy(routeLoaders.profile);
const PublicMemberProfilePage = lazy(routeLoaders.publicMemberProfile);
const LeaderboardPage = lazy(routeLoaders.leaderboard);
const CreateTaskSchedulePage = lazy(routeLoaders.createTasks);
const MonthlyAnalysisPage = lazy(routeLoaders.monthlyAnalysis);
const NotificationsPage = lazy(routeLoaders.notifications);
const AppPlaceholderPage = lazy(routeLoaders.appPlaceholder);

function getRouteLoaders(pathname) {
  if (pathname === '/app') return [routeLoaders.appShell, routeLoaders.dashboard];
  if (pathname === '/app/dashboard') return [routeLoaders.appShell, routeLoaders.dashboard];
  if (pathname === '/app/tasks') return [routeLoaders.appShell, routeLoaders.dailyTasks];
  if (pathname === '/app/recovery-quests') return [routeLoaders.appShell, routeLoaders.recoveryQuests];
  if (pathname === '/app/discipline') return [routeLoaders.appShell, routeLoaders.discipline];
  if (pathname === '/app/profile') return [routeLoaders.appShell, routeLoaders.profile];
  if (/^\/app\/profile\/[^/]+\/?$/.test(pathname)) return [routeLoaders.appShell, routeLoaders.publicMemberProfile];
  if (pathname === '/app/tasks/create') return [routeLoaders.appShell, routeLoaders.createTasks];
  if (pathname === '/app/monthly-analysis') return [routeLoaders.appShell, routeLoaders.monthlyAnalysis];
  if (pathname === '/app/notifications') return [routeLoaders.appShell, routeLoaders.notifications];
  if (pathname === '/app/leaderboard') return [routeLoaders.appShell, routeLoaders.leaderboard];
  if (pathname === '/app/settings') return [routeLoaders.appShell, routeLoaders.settings];
  if (pathname === '/signup') return [routeLoaders.signup];
  if (pathname === '/login') return [routeLoaders.login];
  if (pathname === '/verify-email') return [routeLoaders.verifyEmail];
  if (pathname === '/forgot-password') return [routeLoaders.forgotPassword];
  if (pathname === '/reset-password') return [routeLoaders.resetPassword];
  if (pathname === '/account-recovery') return [routeLoaders.accountRecovery];
  if (/^\/ranks\/[^/]+\/?$/.test(pathname)) return [routeLoaders.rankDetail];
  if (/^\/legal\/[^/]+\/?$/.test(pathname)) return [routeLoaders.legal];
  if (['/about', '/how-it-works', '/features', '/ranks', '/rules', '/faq', '/getting-started', '/contact'].includes(pathname)) {
    return [routeLoaders.publicInfo];
  }
  return [];
}

function prefetchInternalRoute(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest('a[href]');
  if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return;
  if (url.pathname === window.location.pathname) return;
  for (const loader of getRouteLoaders(url.pathname)) {
    if (prefetchedRoutes.has(loader)) continue;
    prefetchedRoutes.add(loader);
    loader().catch(() => prefetchedRoutes.delete(loader));
  }
}

function RoutePrefetch() {
  useEffect(() => {
    document.addEventListener('pointerover', prefetchInternalRoute, { passive: true });
    document.addEventListener('focusin', prefetchInternalRoute);
    return () => {
      document.removeEventListener('pointerover', prefetchInternalRoute);
      document.removeEventListener('focusin', prefetchInternalRoute);
    };
  }, []);
  return null;
}

function RouteView({ children }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

function EmergencyPauseAtmosphereGate() {
  const { pathname } = useLocation();
  const { isEmergencyPauseActive } = useTaskSchedule();
  const { preferences } = useUserPreferences();

  if (pathname !== '/app' && !pathname.startsWith('/app/')) return null;
  return <EmergencyPauseAtmosphere active={isEmergencyPauseActive} reduceDecorativeEffects={preferences.appearance.reduceDecorativeEffects} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <TaskScheduleProvider>
      <UserPreferencesProvider>
      <RoutePrefetch />
      <EmergencyPauseAtmosphereGate />
      <PageTransition>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<RouteView><SignUpPage /></RouteView>} />
        <Route path="/login" element={<RouteView><LoginPage /></RouteView>} />
        <Route path="/verify-email" element={<RouteView><VerifyEmailPage /></RouteView>} />
        <Route path="/forgot-password" element={<RouteView><ForgotPasswordPage /></RouteView>} />
        <Route path="/reset-password" element={<RouteView><ResetPasswordPage /></RouteView>} />
        <Route path="/account-recovery" element={<RouteView><AccountRecoveryPage /></RouteView>} />
        <Route path="/about" element={<RouteView><PublicInfoPage page="about" /></RouteView>} />
        <Route path="/how-it-works" element={<RouteView><PublicInfoPage page="how" /></RouteView>} />
        <Route path="/features" element={<RouteView><PublicInfoPage page="features" /></RouteView>} />
        <Route path="/ranks" element={<RouteView><PublicInfoPage page="ranks" /></RouteView>} />
        <Route path="/ranks/:rankSlug" element={<RouteView><RankDetailPage /></RouteView>} />
        <Route path="/rules" element={<RouteView><PublicInfoPage page="rules" /></RouteView>} />
        <Route path="/faq" element={<RouteView><PublicInfoPage page="faq" /></RouteView>} />
        <Route path="/getting-started" element={<RouteView><PublicInfoPage page="getting-started" /></RouteView>} />
        <Route path="/contact" element={<RouteView><PublicInfoPage page="contact" /></RouteView>} />
        <Route path="/legal/:slug" element={<RouteView><LegalPage /></RouteView>} />
        <Route path="/app" element={<RouteView><AppLayout /></RouteView>}>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<RouteView><DashboardPage /></RouteView>} />
          <Route path="tasks" element={<RouteView><DailyTasksPage /></RouteView>} />
          <Route path="recovery-quests" element={<RouteView><RecoveryQuestsPage /></RouteView>} />
          <Route path="discipline" element={<RouteView><DisciplinePage /></RouteView>} />
          <Route path="profile" element={<RouteView><ProfilePage /></RouteView>} />
          <Route path="profile/:memberId" element={<RouteView><PublicMemberProfilePage /></RouteView>} />
          <Route path="leaderboard" element={<RouteView><LeaderboardPage /></RouteView>} />
          <Route path="settings" element={<RouteView><SettingsPageRoute /></RouteView>} />
          <Route path="monthly-analysis" element={<RouteView><MonthlyAnalysisPage /></RouteView>} />
          <Route path="notifications" element={<RouteView><NotificationsPage /></RouteView>} />
          <Route path="tasks/create" element={<RouteView><CreateTaskSchedulePage /></RouteView>} />
          {applicationNavigationItems.filter((item) => !['dashboard', 'tasks', 'recovery-quests', 'discipline', 'profile', 'leaderboard', 'monthly-analysis', 'settings', 'notifications'].includes(item.id)).map((item) => (
            <Route key={item.id} path={item.path.replace('/app/', '')} element={<RouteView><AppPlaceholderPage /></RouteView>} />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </PageTransition>
      <VoidShardCursor />
      </UserPreferencesProvider>
      </TaskScheduleProvider>
    </BrowserRouter>
  );
}
