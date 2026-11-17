import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 30);
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <BrandLogo onClick={closeMenu} />
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
        {navigation.map(([label, href]) => <a className="nav-link" href={href} key={href} onClick={closeMenu}>{label}</a>)}
      </nav>
      <div className="nav-actions">
        <a className="nav-login" href="/login">Log in</a>
        <a className="nav-signup" href="/signup">Sign up</a>
      </div>
    </header>
  );
}
