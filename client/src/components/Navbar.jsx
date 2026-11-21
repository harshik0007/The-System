import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import BrandLogo from './BrandLogo.jsx';

const navigation = [
  ['Overview', '#top'],
  ['How it works', '#how-it-works'],
  ['Features', '#features'],
  ['Progression', '#progression'],
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const onLanding = location.pathname === '/';
  const isRankOrBadgePage = location.pathname === '/ranks'
    || location.pathname === '/badges'
    || /^\/ranks\/[^/]+\/?$/.test(location.pathname);
  const informationLinks = [
    ['About', '/about'], ['How it works', '/how-it-works'], ['Features', '/features'], ['Seven ranks', '/ranks'], ['Badges', '/badges'], ['Rules', '/rules'],
  ];
  const links = onLanding ? navigation : informationLinks;
  const showPageNavigation = !isRankOrBadgePage;

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 30);
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <BrandLogo href={onLanding ? '#top' : '/'} onClick={closeMenu} />
      {showPageNavigation && <>
        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span /><span />
        </button>
        <nav className={`main-nav${menuOpen ? ' is-open' : ''}`} id="main-navigation" aria-label="Main navigation">
          {links.map(([label, href]) => onLanding
            ? <a className="nav-link" href={href} key={href} onClick={closeMenu}>{label}</a>
            : <Link className="nav-link" to={href} key={href} onClick={closeMenu}>{label}</Link>)}
        </nav>
      </>}
      <div className="nav-actions">
        <Link className="nav-login" to="/login">Log in</Link>
        <Link className="nav-signup" to="/signup">Sign up</Link>
      </div>
    </header>
  );
}
