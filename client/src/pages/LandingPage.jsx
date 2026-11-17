import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Button from '../components/Button.jsx';
import SiteHeader from '../components/SiteHeader.jsx';
import { principles } from '../data/principles.js';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import '../styles/landing.css';

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const pageRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (reduceMotion) return undefined;

    const context = gsap.context(() => {
      gsap.from('.hero-copy > *', {
        y: 22,
        opacity: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: 'power3.out',
      });

      gsap.from('.principle-card', {
        y: 28,
        opacity: 0,
        duration: 0.65,
        stagger: 0.12,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.principles-grid',
          start: 'top 82%',
        },
      });
    }, pageRef);

    return () => context.revert();
  }, [reduceMotion]);

  return (
    <div className="site-shell" id="top" ref={pageRef}>
      <SiteHeader />
      <main>
        <section className="hero section-wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="status-dot" /> A better way forward</p>
            <h1 id="hero-title">Make progress<br /><span>your default.</span></h1>
            <p className="hero-description">
              Build a life that moves with intention. THE SYSTEM gives your daily effort a clear direction, a steady rhythm, and room to grow.
            </p>
            <div className="hero-actions">
              <Button href="#principles" variant="primary">Explore the system <span aria-hidden="true">↗</span></Button>
              <a className="text-link" href="#about">See how it works <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <div className="hero-visual" aria-label="Abstract illustration of progress" role="img">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="visual-center"><span>01</span><i /></div>
            <div className="visual-label label-top">INTENTION <span>01 / 03</span></div>
            <div className="visual-label label-bottom">BUILT, DAILY <span>EST. NOW</span></div>
            <div className="visual-cross cross-one">+</div>
            <div className="visual-cross cross-two">+</div>
          </div>
          <a className="scroll-cue" href="#principles"><span /> Scroll to explore</a>
        </section>

        <section className="principles section-wrap" id="principles" aria-labelledby="principles-title">
          <div className="section-heading">
            <p className="eyebrow">The foundation</p>
            <h2 id="principles-title">Small steps.<br /><span>Lasting change.</span></h2>
          </div>
          <div className="principles-grid">
            {principles.map((principle) => (
              <article className="principle-card" key={principle.number}>
                <div className="card-top"><span>{principle.number}</span><span aria-hidden="true">{principle.symbol}</span></div>
                <h3>{principle.title}</h3>
                <p>{principle.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="closing section-wrap" id="about">
          <p className="eyebrow">A system that grows with you</p>
          <div className="closing-row">
            <h2>Start where<br />you are.</h2>
            <p>Consistency isn’t a finish line. It’s a practice you can return to, one intentional day at a time.</p>
          </div>
          <div className="closing-rule"><span>THE SYSTEM</span><span>© 2026</span><span>MADE FOR MOMENTUM</span></div>
        </section>
      </main>
    </div>
  );
}
