export default function AppProgressBar({ value, label, description, className = '' }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className={`app-progress${className ? ` ${className}` : ''}`}>
      <div className="app-progress__meta"><span>{label}</span><strong>{safeValue}%</strong></div>
      <div className="app-progress__track" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={safeValue} aria-valuetext={description || `${safeValue}% demonstration progress`}>
        <span className="app-progress__fill" style={{ '--progress-value': `${safeValue}%` }} />
      </div>
    </div>
  );
}
