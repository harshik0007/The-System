import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import AuthCard from '../../components/auth/AuthCard.jsx';
import FormField from '../../components/auth/FormField.jsx';
import PasswordInput from '../../components/auth/PasswordInput.jsx';
import PrimaryButton from '../../components/auth/PrimaryButton.jsx';
import AuthNotice from '../../components/auth/AuthNotice.jsx';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { safeAuthenticatedDestination } from '../../utils/authNavigation.js';
import { useFlashMessages } from '../../context/FlashMessageContext.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { notifySuccess, notifyError } = useFlashMessages();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const oauthState = new URLSearchParams(location.search).get('oauth');
  const oauthReturnTo = new URLSearchParams(location.search).get('returnTo');
  const oauthNotice = oauthState === 'provider-conflict'
    ? 'This email uses a different sign-in method. Sign in with the method used to create the account.'
    : oauthState === 'unavailable'
      ? 'Google sign-in is temporarily unavailable. Use your username or email and password.'
      : oauthState === 'failed'
        ? 'Google sign-in could not be completed. Try again.'
        : '';
  const accountDeletedNotice = location.state?.accountDeleted === true
    ? 'Your THE SYSTEM account and its personal data have been permanently deleted.'
    : '';

  const submit = async (event) => {
    event.preventDefault();
    if (!identifier.trim() || !password) { setNotice('Enter your email or username and password.'); return; }
    setNotice('');
    setBusy(true);
    try {
      await login({ identifier: identifier.trim(), password });
      notifySuccess('You are signed in. Your progress is ready.');
      navigate(safeAuthenticatedDestination(location.state?.from || oauthReturnTo), { replace: true });
    } catch (error) {
      const message = error?.message || 'The sign-in details are incorrect.';
      setNotice(message);
      notifyError(message);
    } finally { setBusy(false); }
  };

  return <AuthLayout><AuthCard eyebrow="THE SYSTEM / RETURN" title="Welcome back" description="Continue with the work you chose to do.">
    <form className="auth-form" onSubmit={submit} noValidate>
      <FormField id="login-identifier" label="Email or username"><input className="auth-input" id="login-identifier" name="username" type="text" autoComplete="username" value={identifier} onChange={(event) => { setIdentifier(event.target.value); setNotice(''); }} required /></FormField>
      <PasswordInput id="login-password" label="Password" name="password" value={password} onChange={(event) => { setPassword(event.target.value); setNotice(''); }} autoComplete="current-password" />
      <div className="auth-form-options"><span aria-hidden="true" /> <Link to="/forgot-password">Forgot password?</Link></div>
      {accountDeletedNotice && <AuthNotice variant="success">{accountDeletedNotice}</AuthNotice>}
      {(notice || oauthNotice) && <AuthNotice variant="error">{notice || oauthNotice}</AuthNotice>}
      <PrimaryButton disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</PrimaryButton>
    </form>
    <div className="auth-divider"><span>OR CONTINUE WITH</span></div>
    <GoogleSignInButton disabled={busy} />
    <p className="auth-switch">No recovery code? <Link to="/account-recovery">Review recovery options</Link></p>
    <p className="auth-switch">New to THE SYSTEM? <Link to="/signup">Create an account</Link></p>
  </AuthCard></AuthLayout>;
}
