import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route } from 'react-router-dom';
import VoidShardCursor from './components/VoidShardCursor.jsx';
import PageTransition from './components/PageTransition.jsx';
import LandingPage from './pages/LandingPage.jsx';
import { applicationNavigationItems } from './data/applicationNavigation.js';
import { TaskScheduleProvider } from './context/TaskScheduleContext.jsx';

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
  dashboard: () => import('./pages/app/DashboardPage.jsx'),
  dailyTasks: () => import('./pages/app/DailyTasksPage.jsx'),
  recoveryQuests: () => import('./pages/app/RecoveryQuestsPage.jsx'),
  createTasks: () => import('./pages/app/CreateTaskSchedulePage.jsx'),
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
const DashboardPage = lazy(routeLoaders.dashboard);
const DailyTasksPage = lazy(routeLoaders.dailyTasks);
const RecoveryQuestsPage = lazy(routeLoaders.recoveryQuests);
const CreateTaskSchedulePage = lazy(routeLoaders.createTasks);
const AppPlaceholderPage = lazy(routeLoaders.appPlaceholder);

function getRouteLoaders(pathname) {
  if (pathname === '/app') return [routeLoaders.appShell, routeLoaders.dashboard];
  if (pathname === '/app/dashboard') return [routeLoaders.appShell, routeLoaders.dashboard];
  if (pathname === '/app/tasks') return [routeLoaders.appShell, routeLoaders.dailyTasks];
  if (pathname === '/app/recovery-quests') return [routeLoaders.appShell, routeLoaders.recoveryQuests];
  if (pathname === '/app/tasks/create') return [routeLoaders.appShell, routeLoaders.createTasks];
  if (/^\/app\/(goals|recovery-quests|monthly-analysis|leaderboard|profile|settings)\/?$/.test(pathname)) return [routeLoaders.appShell, routeLoaders.appPlaceholder];
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

export default function App() {
  return (
    <BrowserRouter>
      <TaskScheduleProvider>
      <RoutePrefetch />
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
          <Route path="tasks/create" element={<RouteView><CreateTaskSchedulePage /></RouteView>} />
          {applicationNavigationItems.filter((item) => !['dashboard', 'tasks', 'recovery-quests'].includes(item.id)).map((item) => (
            <Route key={item.id} path={item.path.replace('/app/', '')} element={<RouteView><AppPlaceholderPage /></RouteView>} />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </PageTransition>
      <VoidShardCursor />
      </TaskScheduleProvider>
    </BrowserRouter>
  );
}
