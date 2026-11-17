import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import AuthCard from '../../components/auth/AuthCard.jsx';
import FormField from '../../components/auth/FormField.jsx';
import PasswordInput from '../../components/auth/PasswordInput.jsx';
import PasswordStrengthIndicator from '../../components/auth/PasswordStrengthIndicator.jsx';
import PrimaryButton from '../../components/auth/PrimaryButton.jsx';
import AuthNotice from '../../components/auth/AuthNotice.jsx';
import { isStrongPassword, isValidEmail } from '../../utils/authValidation.js';

export default function SignUpPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', accepted: false });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setNotice('');
  };
  const submit = (event) => {
    event.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Enter your full name.';
    if (!isValidEmail(form.email)) next.email = 'Enter a valid email address.';
    if (!isStrongPassword(form.password)) next.password = 'Meet each password requirement.';
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.';
    if (!form.accepted) next.accepted = 'Please acknowledge the terms to continue.';
    setErrors(next);
    setNotice(Object.keys(next).length ? '' : 'Preview only — account creation is not connected yet. No account was created.');
  };

  return <AuthLayout><AuthCard eyebrow="THE SYSTEM / CREATE ACCESS" title="Create your access" description="Set up your Member profile to begin a more intentional progression.">
    <form className="auth-form" onSubmit={submit} noValidate>
      <FormField id="signup-name" label="Full name" error={errors.name}><input className="auth-input" id="signup-name" name="name" type="text" autoComplete="name" value={form.name} onChange={set('name')} required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'signup-name-error' : undefined} /></FormField>
      <FormField id="signup-email" label="Email address" error={errors.email}><input className="auth-input" id="signup-email" name="email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'signup-email-error' : undefined} /></FormField>
      <PasswordInput id="signup-password" label="Password" name="password" value={form.password} onChange={set('password')} error={errors.password} autoComplete="new-password" />
      <PasswordStrengthIndicator value={form.password} />
      <PasswordInput id="signup-confirm" label="Confirm password" name="confirm-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} autoComplete="new-password" />
      <div className="auth-checkbox-row">
        <input id="signup-terms" type="checkbox" checked={form.accepted} onChange={set('accepted')} aria-invalid={Boolean(errors.accepted)} aria-describedby={errors.accepted ? 'signup-terms-error' : 'signup-terms-note'} />
        <label htmlFor="signup-terms">I acknowledge the <Link to="/legal/terms">Terms and Conditions</Link> <small id="signup-terms-note">(draft pending legal review)</small></label>
      </div>
      {errors.accepted && <span className="auth-field__error" id="signup-terms-error" role="alert">{errors.accepted}</span>}
      {notice && <AuthNotice>{notice}</AuthNotice>}
      <PrimaryButton>Create account</PrimaryButton>
    </form>
    <p className="auth-switch">Already have access? <Link to="/login">Log in</Link></p>
    <p className="auth-switch">Explore the <Link to="/verify-email">email verification UI preview</Link></p>
  </AuthCard></AuthLayout>;
}
