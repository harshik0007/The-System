import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, useLocation } from 'react-router-dom';
import ThemeClickEffects from './components/ThemeClickEffects.jsx';
import PageTransition from './components/PageTransition.jsx';
import RouteErrorBoundary from './components/RouteErrorBoundary.jsx';
import EmergencyPauseAtmosphere from './components/app/EmergencyPauseAtmosphere.jsx';
import PageLoadingSkeleton from './components/app/PageLoadingSkeleton.jsx';
import LandingPage from './pages/LandingPage.jsx';
import { applicationNavigationItems } from './data/applicationNavigation.js';
import { TaskBackendProvider, useTaskBackend } from './context/TaskBackendContext.jsx';
import { UserPreferencesProvider, useUserPreferences } from './context/UserPreferencesContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SignUpDraftProvider } from './context/SignUpDraftContext.jsx';
import { FlashMessageProvider } from './context/FlashMessageContext.jsx';
import { isApplicationPath, isAuthenticatedExperiencePath } from './utils/routePaths.js';

const routeLoaders = {
  signup: () => import('./pages/auth/SignUpPage.jsx'),
  login: () => import('./pages/auth/LoginPage.jsx'),
  forgotPassword: () => import('./pages/auth/ForgotPasswordPage.jsx'),
  resetPassword: () => import('./pages/auth/ResetPasswordPage.jsx'),
  accountRecovery: () => import('./pages/auth/AccountRecoveryPage.jsx'),
  recoveryCodes: () => import('./pages/auth/RecoveryCodesPage.jsx'),
  googleComplete: () => import('./pages/auth/GoogleProfileCompletionPage.jsx'),
  publicInfo: () => import('./pages/public/PublicInfoPage.jsx'),
  badgeInfo: () => import('./pages/public/BadgeInformationPage.jsx'),
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
const ForgotPasswordPage = lazy(routeLoaders.forgotPassword);
const ResetPasswordPage = lazy(routeLoaders.resetPassword);
const AccountRecoveryPage = lazy(routeLoaders.accountRecovery);
const RecoveryCodesPage = lazy(routeLoaders.recoveryCodes);
const GoogleProfileCompletionPage = lazy(routeLoaders.googleComplete);
const PublicInfoPage = lazy(routeLoaders.publicInfo);
const BadgeInformationPage = lazy(routeLoaders.badgeInfo);
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
  if (pathname === '/forgot-password') return [routeLoaders.forgotPassword];
  if (pathname === '/reset-password') return [routeLoaders.resetPassword];
  if (pathname === '/account-recovery') return [routeLoaders.accountRecovery];
  if (pathname === '/recovery-codes') return [routeLoaders.recoveryCodes];
  if (pathname === '/google-complete') return [routeLoaders.googleComplete];
  if (/^\/ranks\/[^/]+\/?$/.test(pathname)) return [routeLoaders.rankDetail];
  if (pathname === '/badges') return [routeLoaders.badgeInfo];
  if (/^\/legal\/[^/]+\/?$/.test(pathname)) return [routeLoaders.legal];
  if (['/about', '/how-it-works', '/features', '/ranks', '/rules', '/faq', '/getting-started', '/contact'].includes(pathname)) {
    return [routeLoaders.publicInfo];
  }
  return [];
}

function getLoadingVariant(pathname) {
  if (pathname === '/') return 'landing';
  if (['/signup', '/login', '/forgot-password', '/reset-password', '/account-recovery', '/recovery-codes', '/google-complete'].includes(pathname)) return 'auth';
  if (pathname === '/app' || pathname.startsWith('/app/dashboard')) return 'dashboard';
  if (pathname.startsWith('/app/tasks')) return 'tasks';
  if (pathname.startsWith('/app/recovery-quests')) return 'recovery';
  if (pathname.startsWith('/app/discipline')) return 'discipline';
  if (pathname.startsWith('/app/profile')) return 'profile';
  if (pathname.startsWith('/app/settings')) return 'settings';
  if (pathname.startsWith('/app/monthly-analysis')) return 'monthly';
  if (pathname.startsWith('/app/notifications')) return 'notifications';
  if (pathname.startsWith('/app/leaderboard')) return 'table';
  if (pathname.startsWith('/ranks') || pathname === '/badges' || pathname.startsWith('/legal/') || !pathname.startsWith('/app/')) return 'public';
  return 'page';
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
  const { pathname } = useLocation();
  return (
    <RouteErrorBoundary key={pathname} resetKey={pathname}>
      <Suspense fallback={isApplicationPath(pathname) ? null : <PageLoadingSkeleton variant={getLoadingVariant(pathname)} label="Loading page content" />}>
        {children}
      </Suspense>
    </RouteErrorBoundary>
  );
}

function EmergencyPauseAtmosphereGate() {
  const { pathname, search } = useLocation();
  const { emergencyPause } = useTaskBackend();
  const { preferences } = useUserPreferences();

  if (!isAuthenticatedExperiencePath(pathname)) return null;
  const stasisPreviewParam = import.meta.env.DEV
    ? new URLSearchParams(search).get('stasis')
    : null;
  const devPreview = stasisPreviewParam === 'on' ? true : stasisPreviewParam === 'off' ? false : undefined;
  // Both themes follow the same server-confirmed active state; the selected
  // theme only changes the decoration rendered by the shared atmosphere.
  return <EmergencyPauseAtmosphere
    active={Boolean(emergencyPause?.isActive)}
    activationId={emergencyPause?.pause?.id || emergencyPause?.pause?.startedAt || null}
    startedAt={emergencyPause?.pause?.startedAt || null}
    statusKnown={emergencyPause !== null}
    theme={preferences.appearance.theme}
    clickRipple={preferences.appearance.clickRipple}
    reduceDecorativeEffects={preferences.appearance.reduceDecorativeEffects}
    effectQuality={preferences.appearance.effectQuality}
    devPreview={devPreview}
  />;
}

function ApplicationErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <RouteErrorBoundary resetKey={pathname}>{children}</RouteErrorBoundary>;
}

function AuthenticatedApplicationRuntime({ children }) {
  const { member } = useAuth();

  // Keep server-backed app state and the pause atmosphere outside the keyed
  // page-transition views so navigation does not remount their animation.
  if (!member) return children;
  return (
    <TaskBackendProvider>
      <EmergencyPauseAtmosphereGate />
      {children}
    </TaskBackendProvider>
  );
}

function AuthenticatedExperienceLayout() {
  const { pathname } = useLocation();
  const { member, loading } = useAuth();
  const { ready: preferencesReady } = useUserPreferences();
  if (loading || (member && !preferencesReady)) {
    if (isApplicationPath(pathname)) return <div className="app-session-loading" role="status" aria-live="polite"><span className="app-session-loading__indicator" aria-hidden="true" />Preparing your workspace…</div>;
    return <PageLoadingSkeleton variant={getLoadingVariant(pathname)} label="Preparing your experience" />;
  }
  return member ? <AppLayout /> : <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <FlashMessageProvider>
      <AuthProvider>
      <SignUpDraftProvider>
      <UserPreferencesProvider>
      <ApplicationErrorBoundary>
      <RoutePrefetch />
      <AuthenticatedApplicationRuntime>
      <PageTransition>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/signup" element={<RouteView><SignUpPage /></RouteView>} />
        <Route path="/login" element={<RouteView><LoginPage /></RouteView>} />
        <Route path="/forgot-password" element={<RouteView><ForgotPasswordPage /></RouteView>} />
        <Route path="/reset-password" element={<RouteView><ResetPasswordPage /></RouteView>} />
        <Route path="/account-recovery" element={<RouteView><AccountRecoveryPage /></RouteView>} />
        <Route path="/recovery-codes" element={<RouteView><RecoveryCodesPage /></RouteView>} />
        <Route path="/google-complete" element={<RouteView><GoogleProfileCompletionPage /></RouteView>} />
        <Route element={<AuthenticatedExperienceLayout />}>
          <Route path="/about" element={<RouteView><PublicInfoPage page="about" /></RouteView>} />
          <Route path="/how-it-works" element={<RouteView><PublicInfoPage page="how" /></RouteView>} />
          <Route path="/features" element={<RouteView><PublicInfoPage page="features" /></RouteView>} />
          <Route path="/ranks" element={<RouteView><PublicInfoPage page="ranks" /></RouteView>} />
          <Route path="/ranks/:rankSlug" element={<RouteView><RankDetailPage /></RouteView>} />
          <Route path="/badges" element={<RouteView><BadgeInformationPage /></RouteView>} />
          <Route path="/rules" element={<RouteView><PublicInfoPage page="rules" /></RouteView>} />
          <Route path="/faq" element={<RouteView><PublicInfoPage page="faq" /></RouteView>} />
          <Route path="/getting-started" element={<RouteView><PublicInfoPage page="getting-started" /></RouteView>} />
          <Route path="/contact" element={<RouteView><PublicInfoPage page="contact" /></RouteView>} />
          <Route path="/legal/:slug" element={<RouteView><LegalPage /></RouteView>} />
          <Route path="/app" element={<AuthenticatedApplication />}>
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </PageTransition>
      </AuthenticatedApplicationRuntime>
      <ThemeClickEffects />
      </ApplicationErrorBoundary>
      </UserPreferencesProvider>
      </SignUpDraftProvider>
      </AuthProvider>
      </FlashMessageProvider>
    </BrowserRouter>
  );
}

function HomeRoute() {
  const { member, loading } = useAuth();
  if (loading) return <PageLoadingSkeleton variant="landing" label="Restoring your session" />;
  return member ? <Navigate to="/app/dashboard" replace /> : <LandingPage />;
}

function AuthenticatedApplication() {
  const { member } = useAuth();
  const location = useLocation();
  if (!member) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return <Outlet />;
}
