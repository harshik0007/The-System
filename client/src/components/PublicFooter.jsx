import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo.jsx';

const footerLinks = [
  ['How it works', '/how-it-works'],
  ['Seven Ranks', '/ranks'],
  ['Leaderboard', '/#leaderboard'],
  ['FAQ', '/faq'],
  ['Rules', '/rules'],
  ['Privacy', '/legal/privacy'],
  ['Terms', '/legal/terms'],
];

export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer__inner section-wrap">
        <div className="public-footer__brand"><BrandLogo href="/" /><p>Your practice. Your progress.</p></div>
        <nav aria-label="Footer navigation">{footerLinks.map(([label, href]) => href.includes('#')
          ? <a href={href} key={label}>{label}</a>
          : <Link to={href} key={label}>{label}</Link>)}</nav>
        <p className="public-footer__copyright">© THE SYSTEM</p>
      </div>
    </footer>
  );
}
