import { useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Navbar from '../Navbar.jsx';
import ShadowBackground from '../ShadowBackground.jsx';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { useAuth } from '../../context/AuthContext.jsx';
import '../../styles/public-pages.css';
import '../../styles/modal-close-fixes.css';

gsap.registerPlugin(ScrollTrigger);

export default function PublicLayout({ title, description, eyebrow, heading, intro, children, className = '' }) {
  const pageRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const location = useLocation();
  const { member } = useAuth();

  useLayoutEffect(() => {
    document.title = `${title} | THE SYSTEM`;
    let descriptionMeta = document.querySelector('meta[name="description"]');
    if (!descriptionMeta) {
      descriptionMeta = document.createElement('meta');
      descriptionMeta.name = 'description';
      document.head.appendChild(descriptionMeta);
    }
    descriptionMeta.content = description;
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.content = `${title} | THE SYSTEM`;
    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (!ogDescription) {
      ogDescription = document.createElement('meta');
      ogDescription.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescription);
    }
    ogDescription.content = description;
  }, [title, description, location.pathname]);

  useLayoutEffect(() => {
    if (reduceMotion || !pageRef.current) return undefined;
    const context = gsap.context(() => {
      gsap.utils.toArray('.public-content .public-reveal').forEach((element) => {
        gsap.from(element, {
          y: 22,
          autoAlpha: 0,
          duration: 0.62,
          ease: 'power3.out',
          scrollTrigger: { trigger: element, start: 'top 88%', once: true },
        });
      });
      gsap.utils.toArray('.public-card-grid').forEach((grid) => {
        const cards = grid.querySelectorAll('.public-card');
        if (cards.length > 1) gsap.from(cards, {
          y: 18, autoAlpha: 0, stagger: 0.075, duration: 0.58, ease: 'power3.out',
          scrollTrigger: { trigger: grid, start: 'top 86%', once: true },
        });
      });
      const rankCards = pageRef.current.querySelectorAll('.rank-gallery .rank-card');
      if (rankCards.length) {
        gsap.from(rankCards, {
          y: 16, autoAlpha: 0, stagger: 0.07, duration: 0.52, ease: 'power3.out',
          scrollTrigger: { trigger: '.rank-gallery', start: 'top 84%', once: true },
        });
        const emblemPaths = pageRef.current.querySelectorAll(
          '.rank-gallery .emblem-art .emblem-metal, .rank-gallery .emblem-art .emblem-inlay, .rank-gallery .emblem-art .emblem-engrave',
        );
        if (emblemPaths.length) gsap.fromTo(emblemPaths,
          { strokeDasharray: 240, strokeDashoffset: 240 },
          { strokeDashoffset: 0, stagger: { each: 0.025, from: 'start' }, duration: 0.74, ease: 'power2.out',
            scrollTrigger: { trigger: pageRef.current.querySelector('.rank-gallery'), start: 'top 82%', once: true } },
        );
        gsap.from('.rank-gallery .rank-card__emblem', {
          scale: 0.92, filter: 'brightness(.68)', stagger: 0.055, duration: 0.48, ease: 'power2.out',
          scrollTrigger: { trigger: '.rank-gallery', start: 'top 83%', once: true },
        });
      }
      const badgeShowcase = pageRef.current.querySelector('.rank-badge-showcase');
      if (badgeShowcase) gsap.fromTo(badgeShowcase.querySelector('.rank-badge-aura'),
        { autoAlpha: 0, y: 13, scale: 0.96 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.72, ease: 'power3.out', clearProps: 'opacity,visibility,transform',
          scrollTrigger: { trigger: badgeShowcase, start: 'top 82%', once: true } },
      );
      const atmosphere = pageRef.current.querySelector('.public-atmosphere');
      if (atmosphere) gsap.to(atmosphere, {
        yPercent: 10, ease: 'none',
        scrollTrigger: { trigger: pageRef.current, start: 'top top', end: 'bottom top', scrub: 1.6 },
      });
    }, pageRef);
    return () => context.revert();
  }, [location.pathname, reduceMotion]);

  const main = (
    <main className={`public-main${member ? ' public-main--authenticated' : ''}`} id="main-content">
        <header className="public-hero public-reveal">
          <nav className="public-breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><span>{title}</span></nav>
          {eyebrow && <p className="public-eyebrow">{eyebrow}</p>}
          <h1>{heading || title}</h1>
          {intro && <p className="public-hero__intro">{intro}</p>}
        </header>
        <div className="public-content">{children}</div>
    </main>
  );

  if (member) return <div className={`public-information-content ${className}`} ref={pageRef}>{main}</div>;

  return (
    <div className={`public-layout ${className}`} ref={pageRef}>
      <Navbar />
      <div className="public-atmosphere" aria-hidden="true"><ShadowBackground variant="public" /></div>
      {main}
    </div>
  );
}
