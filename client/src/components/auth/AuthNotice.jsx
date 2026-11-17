export default function AuthNotice({ children, variant = 'info' }) {
  return <p className={`auth-notice auth-notice--${variant}`} role={variant === 'error' ? 'alert' : 'status'}>{children}</p>;
}
