import { Link } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import AuthCard from '../../components/auth/AuthCard.jsx';
import PrimaryButton from '../../components/auth/PrimaryButton.jsx';

export default function AccountRecoveryPage() {
  return <AuthLayout compact><AuthCard eyebrow="THE SYSTEM / RECOVERY" title="Account recovery" description="THE SYSTEM does not use email delivery for account recovery. Use a recovery method connected to your account.">
    <div className="auth-recovery-options">
      <article><span className="auth-recovery-options__number">01</span><div><h2>You saved a recovery code</h2><p>Use one unused code and your username or email to set a new password. Each code works once.</p><Link to="/forgot-password">Reset with a recovery code <span aria-hidden="true">↗</span></Link></div></article>
      <article><span className="auth-recovery-options__number">02</span><div><h2>You use a Google Account</h2><p>Google accounts are separate from Local Accounts and have no THE SYSTEM password or recovery codes. Restore access through Google, then sign in here with that same Google account.</p><Link to="/login">Continue with Google <span aria-hidden="true">↗</span></Link></div></article>
      <article><span className="auth-recovery-options__number">03</span><div><h2>You have neither option</h2><p>No alternate identity-review service is implemented. Do not create another account to recover existing progress.</p></div></article>
    </div>
    <Link className="auth-primary-button auth-primary-button--link" to="/login">Return to login <span aria-hidden="true">↗</span></Link>
    <p className="auth-switch">Need a new account? <Link to="/signup">Create an account</Link></p>
  </AuthCard></AuthLayout>;
}
