import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import AuthCard from '../../components/auth/AuthCard.jsx';
import FormField from '../../components/auth/FormField.jsx';
import PasswordInput from '../../components/auth/PasswordInput.jsx';
import PasswordStrengthIndicator from '../../components/auth/PasswordStrengthIndicator.jsx';
import PrimaryButton from '../../components/auth/PrimaryButton.jsx';
import AuthNotice from '../../components/auth/AuthNotice.jsx';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton.jsx';
import { isStrongPassword, isValidEmail } from '../../utils/authValidation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFlashMessages } from '../../context/FlashMessageContext.jsx';
import { useSignUpDraft } from '../../context/SignUpDraftContext.jsx';

const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{2,23}$/;

export default function SignUpPage() {
  const navigate = useNavigate();
  const { signUp, usernameAvailability } = useAuth();
  const { notifySuccess, notifyError } = useFlashMessages();
  const { draft: form, updateDraft: setForm, clearDraft } = useSignUpDraft();
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState({ type: 'idle', message: '' });

  useEffect(() => {
    const candidate = form.username.trim();
    if (!candidate) { setUsernameStatus({ type: 'idle', message: '' }); return undefined; }
    if (!USERNAME_PATTERN.test(candidate)) { setUsernameStatus({ type: 'error', message: 'Start with a letter and use 3–24 letters, numbers or underscores.' }); return undefined; }
    const controller = new AbortController();
    setUsernameStatus({ type: 'checking', message: 'Checking username…' });
    const timer = window.setTimeout(async () => {
      try {
        const result = await usernameAvailability(candidate, { signal: controller.signal });
        if (!controller.signal.aborted) setUsernameStatus({ type: result.available ? 'available' : 'error', message: result.message });
      } catch (error) {
        if (!controller.signal.aborted && error?.name !== 'AbortError') setUsernameStatus({ type: 'idle', message: 'Availability will be checked when you create the account.' });
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [form.username, usernameAvailability]);

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setNotice('');
  };

  const openRecoveryCodes = (result) => navigate('/recovery-codes', {
    replace: true,
    state: { codes: result.recoveryCodes, next: '/app/tasks/create' },
  });

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!form.firstName.trim()) next.firstName = 'Enter your first name.';
    if (form.firstName.length > 80) next.firstName = 'Use no more than 80 characters.';
    if (form.middleName.length > 80) next.middleName = 'Use no more than 80 characters.';
    if (!form.lastName.trim()) next.lastName = 'Enter your last name.';
    if (form.lastName.length > 80) next.lastName = 'Use no more than 80 characters.';
    if (!USERNAME_PATTERN.test(form.username.trim())) next.username = 'Use 3–24 characters, start with a letter, and use only letters, numbers or underscores.';
    if (!isValidEmail(form.email)) next.email = 'Enter a valid email address.';
    if (!isStrongPassword(form.password)) next.password = 'Meet the password requirements.';
    if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match.';
    if (!form.termsAccepted) next.termsAccepted = 'Please acknowledge the terms to continue.';
    setErrors(next);
    setNotice('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const result = await signUp({
        firstName: form.firstName.trim(), middleName: form.middleName.trim(), lastName: form.lastName.trim(),
        username: form.username.trim(), email: form.email.trim(), password: form.password,
        confirmPassword: form.confirmPassword, termsAccepted: form.termsAccepted,
      });
      clearDraft();
      notifySuccess('Your account was created. Save the recovery codes shown next.');
      openRecoveryCodes(result);
    } catch (error) {
      const message = error?.message || 'Account creation could not be completed. Check the form and retry.';
      notifyError(message);
      const field = error?.code === 'EMAIL_ALREADY_EXISTS' ? 'email' : error?.code === 'USERNAME_ALREADY_TAKEN' ? 'username' : null;
      if (field) setErrors({ [field]: message });
    } finally { setBusy(false); }
  };

  return <AuthLayout><AuthCard eyebrow="THE SYSTEM / CREATE ACCESS" title="Create your access" description="Choose your public identity and begin a fresh progression. Recovery codes will be shown once after account creation.">
    <form className="auth-form" onSubmit={submit} noValidate>
      <div className="auth-name-grid">
        <FormField id="signup-first-name" label="First name" error={errors.firstName}><input className="auth-input" id="signup-first-name" name="given-name" type="text" autoComplete="given-name" maxLength={80} value={form.firstName} onChange={set('firstName')} required aria-invalid={Boolean(errors.firstName)} /></FormField>
        <FormField id="signup-middle-name" label="Middle name (optional)"><input className="auth-input" id="signup-middle-name" name="additional-name" type="text" autoComplete="additional-name" maxLength={80} value={form.middleName} onChange={set('middleName')} /></FormField>
      </div>
      <FormField id="signup-last-name" label="Last name" error={errors.lastName}><input className="auth-input" id="signup-last-name" name="family-name" type="text" autoComplete="family-name" maxLength={80} value={form.lastName} onChange={set('lastName')} required aria-invalid={Boolean(errors.lastName)} /></FormField>
      <FormField id="signup-username" label="Username" error={errors.username} hint={usernameStatus.message} className={`auth-field--username auth-field--username-${usernameStatus.type}`}><input className="auth-input" id="signup-username" name="username" type="text" autoComplete="username" maxLength={24} value={form.username} onChange={set('username')} required aria-invalid={Boolean(errors.username || usernameStatus.type === 'error')} aria-describedby="signup-username-hint" /></FormField>
      <FormField id="signup-email" label="Email address" error={errors.email}><input className="auth-input" id="signup-email" name="email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} required aria-invalid={Boolean(errors.email)} /></FormField>
      <PasswordInput id="signup-password" label="Password" name="new-password" value={form.password} onChange={set('password')} error={errors.password} autoComplete="new-password" />
      <PasswordStrengthIndicator value={form.password} />
      <PasswordInput id="signup-confirm" label="Confirm password" name="confirm-password" value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} autoComplete="new-password" />
      <div className="auth-checkbox-row">
        <input id="signup-terms" type="checkbox" checked={form.termsAccepted} onChange={set('termsAccepted')} aria-invalid={Boolean(errors.termsAccepted)} />
        <label htmlFor="signup-terms">I acknowledge the <Link to="/legal/terms">Terms and Conditions</Link> <small>(draft pending legal review)</small> <span aria-hidden="true">·</span> <Link to="/legal/privacy">Privacy Policy</Link></label>
      </div>
      {errors.termsAccepted && <span className="auth-field__error" role="alert">{errors.termsAccepted}</span>}
      {notice && <AuthNotice variant="error">{notice}</AuthNotice>}
      <PrimaryButton disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</PrimaryButton>
    </form>
    <div className="auth-divider"><span>OR CONTINUE WITH</span></div>
    <GoogleSignInButton disabled={busy} />
    <p className="auth-switch">Already have access? <Link to="/login">Log in</Link></p>
  </AuthCard></AuthLayout>;
}
