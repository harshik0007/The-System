import { Link } from 'react-router-dom';
import BrandLogo from '../BrandLogo.jsx';

const LINKS = [
  { label: 'Rank information', to: '/ranks' },
  { label: 'Badge information', to: '/badges' },
  { label: 'System rules', to: '/rules' },
  { label: 'Privacy policy', to: '/legal/privacy' },
  { label: 'Terms & Conditions', to: '/legal/terms' },
  { label: 'Contact', to: '/contact' },
];

export default function AuthenticatedFooter() {
  return (
    <footer className="authenticated-footer">
      <div className="authenticated-footer__inner">
        <div className="authenticated-footer__brand">
          <BrandLogo href="/app/dashboard" className="authenticated-footer__logo" />
          <span>Progress is built, not given.</span>
        </div>
        <nav aria-label="System information">
          {LINKS.map(({ label, to }) => <Link key={to} to={to}>{label}</Link>)}
        </nav>
        <small>© {new Date().getFullYear()} THE SYSTEM</small>
      </div>
    </footer>
  );
}
