export default function FormField({ id, label, error, hint, className = '', children, ...props }) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`auth-field ${className}`.trim()}>
      <label className="auth-field__label" htmlFor={id}>{label}</label>
      {children || <input className="auth-input" id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />}
      {hint && <span className="auth-field__hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="auth-field__error" id={`${id}-error`} role="alert">{error}</span>}
    </div>
  );
}
