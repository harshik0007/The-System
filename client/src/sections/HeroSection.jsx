import Button from '../components/Button.jsx';
import ShadowBackground from '../components/ShadowBackground.jsx';

export default function HeroSection() {
  return (
    <section className="hero-section" id="top" aria-labelledby="hero-title">
      <ShadowBackground />
      <div className="hero-content">
        <p className="section-kicker hero-eyebrow"><span className="kicker-line" />A SYSTEM FOR PERSONAL PROGRESSION</p>
        <h1 id="hero-title">Progress is<br /><em>built, not given.</em></h1>
        <p className="hero-copy">Choose what matters. Commit to the work. Prove what you accomplish.</p>
        <div className="hero-actions">
          <Button href="/login" variant="primary">Enter THE SYSTEM <span aria-hidden="true">↗</span></Button>
          <Button href="#how-it-works" variant="quiet">Discover How It Works <span aria-hidden="true">↓</span></Button>
        </div>
      </div>
      <div className="hero-bottom" aria-hidden="true">
        <span>YOUR GOALS. YOUR PACE. YOUR PROOF.</span>
        <a className="scroll-cue" href="#introduction"><span>SCROLL TO EXPLORE</span><i /></a>
        <span>THE SYSTEM <b>/</b> 01</span>
      </div>
    </section>
  );
}
