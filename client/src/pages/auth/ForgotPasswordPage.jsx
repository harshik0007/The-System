import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import AuthCard from '../../components/auth/AuthCard.jsx';
import FormField from '../../components/auth/FormField.jsx';
import PrimaryButton from '../../components/auth/PrimaryButton.jsx';
import AuthNotice from '../../components/auth/AuthNotice.jsx';
import { isValidEmail } from '../../utils/authValidation.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const submit = (event) => {
    event.preventDefault();
    if (!isValidEmail(email)) { setError('Enter a valid email address.'); setNotice(''); return; }
    setError('');
    setNotice('Preview only — password recovery email is not connected. No email was sent.');
  };
  return <AuthLayout compact><AuthCard eyebrow="THE SYSTEM / ACCOUNT ACCESS" title="Reset your password" description="Enter the email address associated with your access. This preview does not send email or create a reset link.">
    <form className="auth-form" onSubmit={submit} noValidate>
      <FormField id="forgot-email" label="Email address" error={error}><input className="auth-input" id="forgot-email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); setNotice(''); }} required aria-invalid={Boolean(error)} aria-describedby={error ? 'forgot-email-error' : undefined} /></FormField>
      {notice && <AuthNotice>{notice}</AuthNotice>}
      <PrimaryButton>Preview recovery request</PrimaryButton>
    </form>
    <p className="auth-switch"><Link to="/login">← Back to login</Link><span aria-hidden="true"> · </span><Link to="/account-recovery">Recovery options</Link></p>
    <p className="auth-switch">Explore the <Link to="/reset-password">reset screen UI preview</Link></p>
  </AuthCard></AuthLayout>;
}
