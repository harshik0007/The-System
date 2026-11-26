import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import Navbar from '../components/Navbar.jsx';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import FAQSection from '../sections/FAQSection.jsx';
import FinalCTASection from '../sections/FinalCTASection.jsx';
import HeroSection from '../sections/HeroSection.jsx';
import HowItWorksSection from '../sections/HowItWorksSection.jsx';
import IntroductionSection from '../sections/IntroductionSection.jsx';
import LeaderboardSection from '../sections/LeaderboardSection.jsx';
import ProgressionSection from '../sections/ProgressionSection.jsx';
import '../styles/landing.css';

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const pageRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return undefined;
    const previousScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true, smoothTouch: false, wheelMultiplier: 0.92 });
    const onScroll = () => ScrollTrigger.update();
    const onTick = (time) => lenis.raf(time * 1000);
    lenis.on('scroll', onScroll);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(onTick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.off('scroll', onScroll);
      lenis.destroy();
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
    };
  }, [reduceMotion]);

  useLayoutEffect(() => {
    if (reduceMotion) return undefined;

    const context = gsap.context(() => {
      const entrance = gsap.timeline({ defaults: { ease: 'power3.out' } });
      entrance
        .from('.hero-eyebrow', { y: 16, autoAlpha: 0, duration: 0.55 })
        .from('.hero-content h1', { y: 30, autoAlpha: 0, duration: 0.75 }, '-=0.3')
        .from('.hero-copy', { y: 18, autoAlpha: 0, duration: 0.6 }, '-=0.35')
        .from('.hero-actions .button', { y: 14, autoAlpha: 0, stagger: 0.12, duration: 0.48 }, '-=0.28')
        .from('.hero-proof', { y: 10, autoAlpha: 0, duration: 0.42 }, '-=0.16')
        .from('.hero-demo-wrap', { y: 24, autoAlpha: 0, duration: 0.85, clearProps: 'transform' }, '-=0.66')
        .from('.hero-bottom', { autoAlpha: 0, duration: 0.45 }, '-=0.18');

      gsap.utils.toArray('.scroll-reveal:not(.principle-card):not(.leader-metric)').forEach((element) => {
        gsap.from(element, {
          y: 20,
          autoAlpha: 0,
          duration: 0.78,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: element,
            start: 'top 84%',
            toggleActions: 'play none none reverse',
          },
        });
      });

      gsap.from('.principle-card', {
        y: 24, autoAlpha: 0, stagger: 0.13, duration: 0.68, ease: 'power3.out',
        scrollTrigger: { trigger: '.principle-strip', start: 'top 80%', toggleActions: 'play none none reverse' },
      });
      gsap.from('.leader-metric', {
        x: -16, autoAlpha: 0, stagger: 0.14, duration: 0.7, ease: 'power3.out',
        scrollTrigger: { trigger: '.leaderboard-metrics', start: 'top 81%', toggleActions: 'play none none reverse' },
      });
      gsap.from('.faq-card', {
        y: 16, autoAlpha: 0, stagger: 0.09, duration: 0.62, ease: 'power3.out',
        scrollTrigger: { trigger: '.faq-list', start: 'top 84%', toggleActions: 'play none none reverse' },
      });
      gsap.from('.final-cta-step', {
        y: 18, autoAlpha: 0, scale: .98, stagger: .14, duration: .72, ease: 'power3.out',
        scrollTrigger: { trigger: '.final-cta-steps', start: 'top 82%', toggleActions: 'play none none reverse' },
      });
      gsap.from('.final-cta-actions .button', {
        y: 14, autoAlpha: 0, stagger: .13, duration: .62, ease: 'power3.out',
        scrollTrigger: { trigger: '.final-cta-actions', start: 'top 88%', toggleActions: 'play none none reverse' },
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
        <ProgressionSection />
        <LeaderboardSection />
        <FAQSection />
        <FinalCTASection />
      </main>
    </div>
  );
}
