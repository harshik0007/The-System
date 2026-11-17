import BrandLogo from './BrandLogo.jsx';
import { footerNavigation } from '../data/footerNavigation.js';
import { Link, useLocation } from 'react-router-dom';

function FooterDestination({ label, href, pending }) {
  if (pending) {
    return (
      <span className="footer-destination footer-destination--pending" aria-label={`${label} — pending`}>
        <span>{label}</span><small>Pending</small>
      </span>
    );
  }

  if (href.startsWith('/')) return <Link className="footer-destination" to={href}>{label}</Link>;
  return <a className="footer-destination" href={href}>{label}</a>;
}

export default function Footer() {
  const location = useLocation();
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand-block">
          <BrandLogo href={location.pathname === '/' ? '#top' : '/'} className="brand-logo--footer" />
          <p className="footer-tagline">Progress is built, not given.</p>
          <div className="footer-contact-links" aria-label="Contact options">
            <FooterDestination label="Contact" href="/contact" />
            <FooterDestination label="Grievance information" href="/legal/grievance" />
          </div>
        </div>

        <div className="footer-group-grid">
          {footerNavigation.map((group) => (
            <nav className="footer-group" aria-label={group.title} key={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.label}>
                    <FooterDestination {...link} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="footer-bottom">
        <small>© {new Date().getFullYear()} THE SYSTEM</small>
        {location.pathname === '/' ? <a href="#top" className="back-top">Back to top <span aria-hidden="true">↑</span></a> : <Link to={location.pathname} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="back-top">Back to top <span aria-hidden="true">↑</span></Link>}
      </div>
    </footer>
  );
}
