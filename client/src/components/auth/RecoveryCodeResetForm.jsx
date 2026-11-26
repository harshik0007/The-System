import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import AuthLayout from './AuthLayout.jsx';
import AuthCard from './AuthCard.jsx';
import FormField from './FormField.jsx';
import PasswordInput from './PasswordInput.jsx';
import PasswordStrengthIndicator from './PasswordStrengthIndicator.jsx';
import PrimaryButton from './PrimaryButton.jsx';
import AuthNotice from './AuthNotice.jsx';
import { useFlashMessages } from '../../context/FlashMessageContext.jsx';

function formatCode(value) {
  const normalized = value.replace(/[^a-f0-9]/gi, '').slice(0, 32).toUpperCase();
  return normalized.match(/.{1,8}/g)?.join('-') || '';
}

export default function RecoveryCodeResetForm() {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const { notifyError } = useFlashMessages();
  const [form, setForm] = useState({ identifier: '', code: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (key) => (event) => {
    const value = key === 'code' ? formatCode(event.target.value) : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!form.identifier.trim() || form.code.replaceAll('-', '').length !== 32 || !form.newPassword || form.newPassword !== form.confirmPassword) {
      setError('Enter your username or email, a complete unused recovery code, and matching new passwords.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await resetPassword({ identifier: form.identifier.trim(), code: form.code, newPassword: form.newPassword, confirmPassword: form.confirmPassword });
      navigate('/login', { replace: true, state: { notice: result.message } });
    } catch (requestError) {
      notifyError(requestError?.message || 'The account or recovery code could not be verified.');
    } finally { setBusy(false); }
  };

  return <AuthLayout compact><AuthCard eyebrow="THE SYSTEM / ACCOUNT ACCESS" title="Recover your password" description="Use one unused recovery code saved when your account was created. Recovery codes work once and are not delivered by email.">
    <form className="auth-form" onSubmit={submit} noValidate>
      <FormField id="recovery-identifier" label="Username or email"><input className="auth-input" id="recovery-identifier" autoComplete="username" value={form.identifier} onChange={update('identifier')} required /></FormField>
      <FormField id="recovery-code" label="Unused recovery code" hint="Enter one of the 10 codes you saved. Each code works once."><input className="auth-input auth-input--recovery-code" id="recovery-code" autoComplete="off" spellCheck="false" autoCapitalize="characters" maxLength={35} value={form.code} onChange={update('code')} required /></FormField>
      <PasswordInput id="recovery-new-password" label="New password" value={form.newPassword} onChange={update('newPassword')} autoComplete="new-password" />
      <PasswordStrengthIndicator value={form.newPassword} />
      <PasswordInput id="recovery-confirm-password" label="Confirm new password" value={form.confirmPassword} onChange={update('confirmPassword')} autoComplete="new-password" />
      {error && <AuthNotice variant="error">{error}</AuthNotice>}
      <PrimaryButton disabled={busy}>{busy ? 'Updating password…' : 'Reset password'}</PrimaryButton>
    </form>
    <p className="auth-switch"><Link to="/login">← Back to login</Link><span aria-hidden="true"> · </span><Link to="/account-recovery">Recovery options</Link></p>
  </AuthCard></AuthLayout>;
}
