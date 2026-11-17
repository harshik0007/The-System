import { passwordRules } from '../../utils/authValidation.js';

export default function PasswordStrengthIndicator({ value }) {
  const rules = passwordRules(value);
  const passed = rules.filter((rule) => rule.passed).length;
  const strength = passed === 4 ? 'Strong' : passed >= 2 ? 'Developing' : 'Needs work';
  return (
    <div className="auth-password-strength" aria-live="polite">
      <div className="auth-password-strength__heading"><span>Password requirements</span><span>{value ? strength : '4 checks'}</span></div>
      <div className="auth-password-strength__meter" aria-hidden="true">{rules.map((rule) => <i key={rule.id} className={rule.passed ? 'is-passed' : ''} />)}</div>
      <ul>{rules.map((rule) => <li key={rule.id} className={rule.passed ? 'is-passed' : ''}><span aria-hidden="true">{rule.passed ? '✓' : '·'}</span>{rule.label}</li>)}</ul>
    </div>
  );
}
