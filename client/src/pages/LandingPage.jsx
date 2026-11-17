import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Footer from '../components/Footer.jsx';
import Navbar from '../components/Navbar.jsx';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import FeaturesSection from '../sections/FeaturesSection.jsx';
import FinalCTASection from '../sections/FinalCTASection.jsx';
import HeroSection from '../sections/HeroSection.jsx';
import HowItWorksSection from '../sections/HowItWorksSection.jsx';
import IntroductionSection from '../sections/IntroductionSection.jsx';
import ProgressionSection from '../sections/ProgressionSection.jsx';
import '../styles/landing.css';

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const pageRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (reduceMotion) return undefined;

    const context = gsap.context(() => {
      const entrance = gsap.timeline({ defaults: { ease: 'power3.out' } });
      entrance
        .from('.hero-eyebrow', { y: 16, autoAlpha: 0, duration: 0.55 })
        .from('.hero-content h1', { y: 30, autoAlpha: 0, duration: 0.75 }, '-=0.3')
        .from('.hero-copy', { y: 18, autoAlpha: 0, duration: 0.6 }, '-=0.42')
        .from('.hero-actions .button', { y: 14, autoAlpha: 0, stagger: 0.12, duration: 0.48 }, '-=0.3')
        .from('.hero-bottom', { autoAlpha: 0, duration: 0.45 }, '-=0.18');

      gsap.utils.toArray('.scroll-reveal').forEach((element) => {
        gsap.from(element, {
          y: 26,
          autoAlpha: 0,
          duration: 0.72,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: element,
            start: 'top 88%',
            toggleActions: 'play none none reverse',
          },
        });
      });

      gsap.to('.hero-section .shadow-shape--one', {
        xPercent: 9, yPercent: 15, rotation: -10, ease: 'none',
        scrollTrigger: { trigger: '.hero-section', start: 'top top', end: 'bottom top', scrub: 1.3 },
      });
      gsap.to('.hero-section .shadow-shape--two', {
        xPercent: -10, yPercent: -13, rotation: 8, ease: 'none',
        scrollTrigger: { trigger: '.hero-section', start: 'top top', end: 'bottom top', scrub: 1.7 },
      });
      gsap.to('.hero-section .shadow-ring--one', {
        yPercent: 22, rotation: 8, ease: 'none',
        scrollTrigger: { trigger: '.hero-section', start: 'top top', end: 'bottom top', scrub: 1.5 },
      });
      gsap.to('.progression-section .shadow-shape--one', {
        xPercent: 8, yPercent: 14, rotation: -9, clipPath: 'polygon(0 42%, 13% 18%, 29% 29%, 45% 3%, 60% 25%, 100% 32%, 88% 69%, 70% 85%, 48% 63%, 28% 100%, 12% 67%)', ease: 'none',
        scrollTrigger: { trigger: '.progression-section', start: 'top bottom', end: 'bottom top', scrub: 1.5 },
      });
      gsap.to('.progression-section .shadow-shape--two', {
        xPercent: -9, yPercent: -12, rotation: 8, ease: 'none',
        scrollTrigger: { trigger: '.progression-section', start: 'top bottom', end: 'bottom top', scrub: 1.8 },
      });
      gsap.to('.progress-track-fill', {
        scaleX: 1, ease: 'none', transformOrigin: 'left center',
        scrollTrigger: { trigger: '.stages-grid', start: 'top 80%', end: 'bottom 58%', scrub: 0.8 },
      });

      gsap.fromTo('.stage-card',
        { autoAlpha: 0, y: 30, scale: 0.96 },
        {
          autoAlpha: 1, y: 0, scale: 1, stagger: 0.12, duration: 0.68, ease: 'power3.out',
          scrollTrigger: { trigger: '.stages-grid', start: 'top 82%', toggleActions: 'play none none reverse' },
        },
      );
      gsap.fromTo('.stage-card .emblem-stroke:not(.emblem-core)',
        { strokeDasharray: 240, strokeDashoffset: 240 },
        {
          strokeDashoffset: 0, stagger: { each: 0.035, from: 'start' }, duration: 0.9, ease: 'power2.out',
          scrollTrigger: { trigger: '.stages-grid', start: 'top 78%', toggleActions: 'play none none reverse' },
        },
      );
      gsap.from('.final-cta .shadow-shape', {
        yPercent: 35, stagger: 0.1, ease: 'none',
        scrollTrigger: { trigger: '.final-cta', start: 'top bottom', end: 'bottom bottom', scrub: 1.4 },
      });
    }, pageRef);

    return () => context.revert();
  }, [reduceMotion]);

  return (
    <div className="site-shell" ref={pageRef}>
      <Navbar />
      <main>
        <HeroSection />
        <IntroductionSection />
        <HowItWorksSection />
        <FeaturesSection />
        <ProgressionSection />
        <FinalCTASection />
      </main>
      <Footer />
    </div>
  );
}
