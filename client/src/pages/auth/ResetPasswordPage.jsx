import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import AuthCard from '../../components/auth/AuthCard.jsx';
import PasswordInput from '../../components/auth/PasswordInput.jsx';
import PasswordStrengthIndicator from '../../components/auth/PasswordStrengthIndicator.jsx';
import PrimaryButton from '../../components/auth/PrimaryButton.jsx';
import AuthNotice from '../../components/auth/AuthNotice.jsx';
import { isStrongPassword } from '../../utils/authValidation.js';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const submit = (event) => {
    event.preventDefault();
    const next = {};
    if (!isStrongPassword(password)) next.password = 'Meet each password requirement.';
    if (confirm !== password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    setNotice(Object.keys(next).length ? '' : 'Preview only — password reset is not connected. No password was changed.');
  };
  return <AuthLayout compact><AuthCard eyebrow="THE SYSTEM / NEW CREDENTIAL" title="Choose a new password" description="Create a strong password for future account access. Reset links and password updates are not connected yet.">
    <div className="auth-lock-mark" aria-hidden="true"><svg viewBox="0 0 28 30" fill="none"><path d="M7.5 12V8.5a6.5 6.5 0 0 1 13 0V12M5.5 12h17v14h-17z" /><path d="M14 17v4" /></svg><i /></div>
    <form className="auth-form" onSubmit={submit} noValidate>
      <PasswordInput id="reset-password" label="New password" value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined })); setNotice(''); }} error={errors.password} autoComplete="new-password" />
      <PasswordStrengthIndicator value={password} />
      <PasswordInput id="reset-confirm" label="Confirm new password" value={confirm} onChange={(event) => { setConfirm(event.target.value); setErrors((current) => ({ ...current, confirm: undefined })); setNotice(''); }} error={errors.confirm} autoComplete="new-password" />
      {notice && <AuthNotice>{notice}</AuthNotice>}
      <PrimaryButton>Preview password reset</PrimaryButton>
    </form>
    <p className="auth-switch"><Link to="/login">← Back to login</Link></p>
  </AuthCard></AuthLayout>;
}
