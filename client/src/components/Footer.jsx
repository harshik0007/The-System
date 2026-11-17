import BrandLogo from './BrandLogo.jsx';
import { footerNavigation } from '../data/footerNavigation.js';

function FooterDestination({ label, href, pending }) {
  if (pending) {
    return (
      <span className="footer-destination footer-destination--pending" aria-label={`${label} — pending`}>
        <span>{label}</span><small>Pending</small>
      </span>
    );
  }

  return <a className="footer-destination" href={href}>{label}</a>;
}

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand-block">
          <BrandLogo className="brand-logo--footer" />
          <p className="footer-tagline">Progress is built, not given.</p>
          <div className="footer-contact-links" aria-label="Contact options">
            <FooterDestination label="Contact" pending />
            <FooterDestination label="Grievance contact" pending />
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
        <a href="#top" className="back-top">Back to top <span aria-hidden="true">↑</span></a>
      </div>
    </footer>
  );
}
