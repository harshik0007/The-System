export default function SiteHeader() {
  return (
    <header className="site-header section-wrap">
      <a className="wordmark" href="#top" aria-label="THE SYSTEM home"><span className="wordmark-mark" aria-hidden="true">S</span> THE SYSTEM</a>
      <nav aria-label="Main navigation">
        <a href="#principles">Principles</a>
        <a href="#about">About</a>
      </nav>
      <a className="header-link" href="#about">Discover <span aria-hidden="true">↗</span></a>
    </header>
  );
}
