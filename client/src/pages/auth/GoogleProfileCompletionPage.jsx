import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import AuthCard from '../../components/auth/AuthCard.jsx';
import FormField from '../../components/auth/FormField.jsx';
import PrimaryButton from '../../components/auth/PrimaryButton.jsx';
import AuthNotice from '../../components/auth/AuthNotice.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFlashMessages } from '../../context/FlashMessageContext.jsx';
import { safeAuthenticatedDestination } from '../../utils/authNavigation.js';

const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{2,23}$/;

export default function GoogleProfileCompletionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { googlePending, completeGoogleSignup, usernameAvailability } = useAuth();
  const { notifyError } = useFlashMessages();
  const [profile, setProfile] = useState(location.state?.profile || null);
  const [form, setForm] = useState({ firstName: '', middleName: '', lastName: '', username: '', termsAccepted: false });
  const [usernameMessage, setUsernameMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) return;
    let active = true;
    googlePending().then((result) => {
      if (!active) return;
      if (!result.pending) {
        navigate('/signup', { replace: true, state: { notice: 'Google sign-up expired. Start again to continue.' } });
        return;
      }
      setProfile(result.profile);
    }).catch(() => {
      if (active) navigate('/signup', { replace: true, state: { notice: 'Google sign-up could not be resumed. Start again to continue.' } });
    });
    return () => { active = false; };
  }, [googlePending, navigate, profile]);

  useEffect(() => {
    if (!profile) return;
    setForm((current) => ({ ...current, firstName: profile.firstName || '', lastName: profile.lastName || '' }));
  }, [profile]);

  useEffect(() => {
    const candidate = form.username.trim();
    if (!candidate || !USERNAME_PATTERN.test(candidate)) { setUsernameMessage(''); return undefined; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => usernameAvailability(candidate, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setUsernameMessage(result.message); })
      .catch(() => { if (!controller.signal.aborted) setUsernameMessage('Availability will be checked when you continue.'); }), 350);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [form.username, usernameAvailability]);

  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!profile) return;
    if (!USERNAME_PATTERN.test(form.username.trim())) { setError('Choose a username with 3–24 letters, numbers or underscores, starting with a letter.'); return; }
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('First name and last name are required.'); return; }
    if (!form.termsAccepted) { setError('Acknowledge the Terms and Conditions to continue.'); return; }
    setBusy(true);
    try {
      await completeGoogleSignup({ ...form, username: form.username.trim(), firstName: form.firstName.trim(), middleName: form.middleName.trim(), lastName: form.lastName.trim() });
      const returnTo = new URLSearchParams(location.search).get('returnTo') || location.state?.from;
      navigate(safeAuthenticatedDestination(returnTo), { replace: true });
    } catch (requestError) {
      notifyError(requestError?.message || 'Your account could not be completed. Review the details and retry.');
    } finally { setBusy(false); }
  };

  return <AuthLayout compact><AuthCard eyebrow="THE SYSTEM / GOOGLE SIGN-UP" title="Complete your profile" description={profile?.email ? `Google verified ${profile.email}. Choose a unique public username and review your name before continuing.` : 'Choose your public identity before completing sign-up.'}>
    <form className="auth-form" onSubmit={submit} noValidate>
      <div className="auth-name-grid">
        <FormField id="google-first-name" label="First name"><input className="auth-input" id="google-first-name" autoComplete="given-name" maxLength={80} value={form.firstName} onChange={update('firstName')} required /></FormField>
        <FormField id="google-middle-name" label="Middle name (optional)"><input className="auth-input" id="google-middle-name" autoComplete="additional-name" maxLength={80} value={form.middleName} onChange={update('middleName')} /></FormField>
      </div>
      <FormField id="google-last-name" label="Last name"><input className="auth-input" id="google-last-name" autoComplete="family-name" maxLength={80} value={form.lastName} onChange={update('lastName')} required /></FormField>
      <FormField id="google-username" label="Username" hint={usernameMessage || 'Your username is the identity shown across THE SYSTEM.'}><input className="auth-input" id="google-username" autoComplete="username" maxLength={24} value={form.username} onChange={update('username')} required /></FormField>
      <div className="auth-checkbox-row"><input id="google-terms" type="checkbox" checked={form.termsAccepted} onChange={update('termsAccepted')} /><label htmlFor="google-terms">I acknowledge the <Link to="/legal/terms">Terms and Conditions</Link> <small>(draft pending legal review)</small></label></div>
      {error && <AuthNotice variant="error">{error}</AuthNotice>}
      <PrimaryButton disabled={busy || !profile}>{busy ? 'Creating account…' : 'Complete Google sign-up'}</PrimaryButton>
    </form>
    <p className="auth-switch"><Link to="/signup">← Back to sign-up</Link></p>
  </AuthCard></AuthLayout>;
}
