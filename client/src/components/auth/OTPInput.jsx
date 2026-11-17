import { useRef } from 'react';

export default function OTPInput({ value, onChange, error = false }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] || '');
  const update = (index, next) => {
    const clean = next.replace(/\D/g, '').slice(-1);
    const updated = digits.slice();
    updated[index] = clean;
    onChange(updated.join('').replace(/\s/g, ''));
    if (clean && index < 5) refs.current[index + 1]?.focus();
  };
  return (
    <div className="auth-otp" role="group" aria-label="Six-digit verification code">
      {digits.map((digit, index) => (
        <input key={index} ref={(element) => { refs.current[index] = element; }} className="auth-otp__digit" inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={6} value={digit} aria-label={`Digit ${index + 1} of 6`} aria-invalid={error} onChange={(event) => {
          const pasted = event.target.value;
          if (pasted.length > 1) {
            const clean = pasted.replace(/\D/g, '').slice(0, 6);
            onChange(clean);
            refs.current[Math.min(clean.length, 5)]?.focus();
          } else update(index, pasted);
        }} onKeyDown={(event) => {
          if (event.key === 'Backspace' && !digit && index > 0) refs.current[index - 1]?.focus();
          if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
          if (event.key === 'ArrowRight' && index < 5) refs.current[index + 1]?.focus();
        }} />
      ))}
    </div>
  );
}
