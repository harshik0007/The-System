export default function PrimaryButton({ children, type = 'submit', disabled = false, className = '', ...props }) {
  return <button className={`auth-primary-button ${className}`.trim()} type={type} disabled={disabled} {...props}>{children}<span aria-hidden="true">↗</span></button>;
}
