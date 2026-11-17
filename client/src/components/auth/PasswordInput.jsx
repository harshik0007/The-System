import { useState } from 'react';
import FormField from './FormField.jsx';

export default function PasswordInput({ id, label, value, onChange, error, autoComplete = 'new-password', name, hint, required = true }) {
  const [visible, setVisible] = useState(false);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <FormField id={id} label={label} error={error} hint={hint}>
      <span className="auth-password-wrap">
        <input className="auth-input auth-input--password" id={id} name={name || id} type={visible ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} required={required} aria-invalid={Boolean(error)} aria-describedby={describedBy} />
        <button className="auth-password-toggle" type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible}>
          {visible ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5.5 0 9 7 9 7a15.5 15.5 0 01-3.1 3.8M6.2 6.2C3.7 7.7 2 12 2 12s3.5 7 10 7c1 0 2-.2 2.8-.5" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>}
        </button>
      </span>
    </FormField>
  );
}
