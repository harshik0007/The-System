import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import AuthCard from '../../components/auth/AuthCard.jsx';
import OTPInput from '../../components/auth/OTPInput.jsx';
import PrimaryButton from '../../components/auth/PrimaryButton.jsx';
import AuthNotice from '../../components/auth/AuthNotice.jsx';

export default function VerifyEmailPage() {
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);
  const submit = (event) => {
    event.preventDefault();
    setError(code.length !== 6);
    setNotice(code.length === 6 ? 'Preview only — code verification is not connected. No code was verified.' : 'Enter all six digits to preview the next step.');
  };
  return <AuthLayout compact><AuthCard className="auth-card--verification" eyebrow="THE SYSTEM / VERIFY EMAIL" title="Check your inbox" description="Enter the six-digit code associated with your email address. This screen is a UI preview; no email or verification code is sent.">
    <div className="auth-verification-mark" aria-hidden="true"><svg viewBox="0 0 34 30" fill="none"><path d="M4 6.5h26v18H4z" /><path d="m5 8 12 9 12-9M5 23l8-7m16 7-8-7" /></svg><i /><b /></div>
    <p className="auth-email-destination">CODE DESTINATION <strong>your email address</strong></p>
    <form className="auth-form" onSubmit={submit} noValidate>
      <OTPInput value={code} onChange={(value) => { setCode(value); setError(false); setNotice(''); }} error={error} />
      {error && <span className="auth-field__error" role="alert">Enter all six digits.</span>}
      {notice && <AuthNotice>{notice}</AuthNotice>}
      <PrimaryButton>Continue</PrimaryButton>
    </form>
    <div className="auth-resend-row"><span>Didn’t receive a code?</span><button type="button" onClick={() => setNotice('Preview only — resend is not connected, so no email was sent.')}>Resend code</button></div>
    <p className="auth-switch"><Link to="/signup">Change email address</Link><span aria-hidden="true"> · </span><Link to="/login">Back to login</Link></p>
  </AuthCard></AuthLayout>;
}
