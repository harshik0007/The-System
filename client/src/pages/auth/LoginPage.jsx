import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import AuthCard from '../../components/auth/AuthCard.jsx';
import FormField from '../../components/auth/FormField.jsx';
import PasswordInput from '../../components/auth/PasswordInput.jsx';
import PrimaryButton from '../../components/auth/PrimaryButton.jsx';
import AuthNotice from '../../components/auth/AuthNotice.jsx';
import { isValidEmail } from '../../utils/authValidation.js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const submit = (event) => {
    event.preventDefault();
    const next = {};
    if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setNotice(Object.keys(next).length ? '' : 'Preview only — sign-in is not connected. No authentication was performed.');
  };
  return <AuthLayout><AuthCard eyebrow="THE SYSTEM / RETURN" title="Welcome back" description="Continue with the work you chose to do.">
    <form className="auth-form" onSubmit={submit} noValidate>
      <FormField id="login-email" label="Email address" error={errors.email}><input className="auth-input" id="login-email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: undefined })); setNotice(''); }} required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'login-email-error' : undefined} /></FormField>
      <PasswordInput id="login-password" label="Password" name="password" value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined })); setNotice(''); }} error={errors.password} autoComplete="current-password" />
      <div className="auth-form-options">
        <label className="auth-check-small"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />Remember me</label>
        <Link to="/forgot-password">Forgot password?</Link>
      </div>
      {notice && <AuthNotice>{notice}</AuthNotice>}
      <PrimaryButton>Log in</PrimaryButton>
    </form>
    <p className="auth-switch">Trouble accessing your account? <Link to="/account-recovery">Recovery options</Link></p>
    <p className="auth-switch">New to THE SYSTEM? <Link to="/signup">Create an account</Link></p>
  </AuthCard></AuthLayout>;
}
