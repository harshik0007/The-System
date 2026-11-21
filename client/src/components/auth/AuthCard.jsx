export default function AuthCard({ eyebrow, title, description, children, className = '' }) {
  return (
    <section className={`auth-card ${className}`.trim()} aria-labelledby="auth-card-title">
      <div className="auth-card__topline"><span>{eyebrow || 'THE SYSTEM / ACCESS'}</span><span className="auth-card__status"><i /> SECURE ACCESS</span></div>
      <h1 id="auth-card-title">{title}</h1>
      {description && <p className="auth-card__description">{description}</p>}
      <div className="auth-card__content">{children}</div>
    </section>
  );
}
