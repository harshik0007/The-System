import BrandLogo from '../BrandLogo.jsx';
import AuthPageBackground from './AuthPageBackground.jsx';

export default function AuthLayout({ children, compact = false }) {
  return (
    <main className={`auth-layout${compact ? ' auth-layout--compact' : ''}`}>
      <AuthPageBackground />
      <header className="auth-mobile-brand">
        <BrandLogo href="/" />
      </header>
      <aside className="auth-aside" aria-label="THE SYSTEM introduction">
        <BrandLogo href="/" />
        <div className="auth-aside__copy">
          <span className="auth-eyebrow"><i /> A system for intentional progress</span>
          <p className="auth-aside__headline">Progress is built,<br /><span>not given.</span></p>
          <p className="auth-aside__support">Choose what matters. Commit to the work. Prove what you accomplish.</p>
        </div>
        <div className="auth-aside__foot"><span>PERSONAL PROGRESSION FRAMEWORK</span><span>SYS / 001</span></div>
      </aside>
      <section className="auth-main">
        <div className="auth-main__inner">{children}</div>
      </section>
    </main>
  );
}
