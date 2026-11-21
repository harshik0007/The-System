import { useAuth } from '../../context/AuthContext.jsx';
import { useLocation } from 'react-router-dom';
import { safeAuthenticatedDestination } from '../../utils/authNavigation.js';

export default function GoogleSignInButton({ disabled = false }) {
  const { capabilities } = useAuth();
  const location = useLocation();

  if (!capabilities?.googleSignIn) {
    return <div className="auth-google-unavailable" role="status">
      Google sign-in is not configured on this server. You can still use your username or email and password.
    </div>;
  }

  const returnTo = safeAuthenticatedDestination(location.state?.from);
  const googleUrl = `/api/v1/auth/google?returnTo=${encodeURIComponent(returnTo)}`;

  return <div className={`auth-google${disabled ? ' is-disabled' : ''}`}>
    <a
      className="auth-google__link"
      href={googleUrl}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
    >
      <span className="auth-google__logo-wrap" aria-hidden="true">
        <svg className="auth-google__logo" viewBox="0 0 48 48" focusable="false">
          <path fill="#4285F4" d="M43.6 24.5c0-1.6-.1-3.1-.4-4.6H24v8.7h11c-.5 2.8-2.1 5.1-4.5 6.7v5.6h7.3c4.3-4 6.8-9.9 6.8-16.4z" />
          <path fill="#34A853" d="M24 44c5.9 0 10.9-2 14.5-5.4l-7.3-5.6c-2 1.3-4.4 2.1-7.2 2.1-5.5 0-10.1-3.7-11.8-8.7H4.7v5.8A20 20 0 0 0 24 44z" />
          <path fill="#FBBC05" d="M12.2 26.4a12 12 0 0 1 0-4.8v-5.8H4.7a20 20 0 0 0 0 16.4l7.5-5.8z" />
          <path fill="#EA4335" d="M24 12.8c3.2 0 6.1 1.1 8.3 3.2l6.2-6.2A20 20 0 0 0 4.7 15.8l7.5 5.8c1.8-5 6.4-8.8 11.8-8.8z" />
        </svg>
      </span>
      <span>Continue with Google</span>
    </a>
  </div>;
}
