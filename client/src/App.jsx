import LandingPage from './pages/LandingPage.jsx';
import VoidShardCursor from './components/VoidShardCursor.jsx';
import { BrowserRouter, Navigate, Route } from 'react-router-dom';
import PageTransition from './components/PageTransition.jsx';
import SignUpPage from './pages/auth/SignUpPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import VerifyEmailPage from './pages/auth/VerifyEmailPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import AccountRecoveryPage from './pages/auth/AccountRecoveryPage.jsx';
import PublicInfoPage from './pages/public/PublicInfoPage.jsx';
import LegalPage from './pages/public/LegalPage.jsx';
import RankDetailPage from './pages/public/RankDetailPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <PageTransition>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/account-recovery" element={<AccountRecoveryPage />} />
        <Route path="/about" element={<PublicInfoPage page="about" />} />
        <Route path="/how-it-works" element={<PublicInfoPage page="how" />} />
        <Route path="/features" element={<PublicInfoPage page="features" />} />
        <Route path="/ranks" element={<PublicInfoPage page="ranks" />} />
        <Route path="/ranks/:rankSlug" element={<RankDetailPage />} />
        <Route path="/rules" element={<PublicInfoPage page="rules" />} />
        <Route path="/faq" element={<PublicInfoPage page="faq" />} />
        <Route path="/getting-started" element={<PublicInfoPage page="getting-started" />} />
        <Route path="/contact" element={<PublicInfoPage page="contact" />} />
        <Route path="/legal/:slug" element={<LegalPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </PageTransition>
      <VoidShardCursor />
    </BrowserRouter>
  );
}
