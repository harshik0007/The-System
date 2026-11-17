import { Link } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import AuthCard from '../../components/auth/AuthCard.jsx';
import PrimaryButton from '../../components/auth/PrimaryButton.jsx';

export default function AccountRecoveryPage() {
  return <AuthLayout compact><AuthCard eyebrow="THE SYSTEM / RECOVERY" title="Account recovery" description="Recovery services are not connected in this preview. No account access or recovery option can be confirmed here.">
    <div className="auth-recovery-options">
      <article><span className="auth-recovery-options__number">01</span><div><h2>Email access available</h2><p>The password recovery screen is ready for future integration. It does not send messages yet.</p><Link to="/forgot-password">Open recovery preview <span aria-hidden="true">↗</span></Link></div></article>
      <article><span className="auth-recovery-options__number">02</span><div><h2>Email access unavailable</h2><p>Contact and identity review options have not been defined. Please check back when support processes are available.</p></div></article>
    </div>
    <Link className="auth-primary-button auth-primary-button--link" to="/login">Return to login <span aria-hidden="true">↗</span></Link>
    <p className="auth-switch">Need another route? <Link to="/signup">Create an account</Link></p>
  </AuthCard></AuthLayout>;
}
