import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SectionHeading from '../components/SectionHeading.jsx';
import { useReducedMotion } from '../hooks/useReducedMotion.js';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  { number: '01', eyebrow: 'GET CLEAR', title: 'Choose one goal.', copy: 'Decide what you want to move forward. You do not need the whole plan yet.' },
  { number: '02', eyebrow: 'MAKE IT DOABLE', title: 'Choose a specific Task.', copy: 'Turn the goal into an action you can schedule within your 1–7-day Task cycle.' },
  { number: '03', eyebrow: 'GIVE IT A PLACE', title: 'Add its Forfeit.', copy: 'Choose the action linked to that Task in advance, so your plan has a defined next step.' },
  { number: '04', eyebrow: 'KEEP GOING', title: 'Follow through, then reset.', copy: 'Complete eligible Tasks to build progress. If you miss one, its linked Recovery Quest gives you a route back.' },
];

export default function HowItWorksSection() {
  const sectionRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const updateMobile = (event) => setIsMobile(event.matches);
    setIsMobile(media.matches);
    media.addEventListener('change', updateMobile);
    return () => media.removeEventListener('change', updateMobile);
  }, []);

  useLayoutEffect(() => {
    if (!sectionRef.current) return undefined;
    const context = gsap.context(() => {
      const cards = gsap.utils.toArray('.journey-step');
      cards.forEach((card, index) => {
        ScrollTrigger.create({
          trigger: card,
          start: 'top 62%',
          end: 'bottom 43%',
          onEnter: () => setActiveStep(index),
          onEnterBack: () => setActiveStep(index),
        });
      });
      if (!reduceMotion && !isMobile) {
        gsap.fromTo('.journey-path__line',
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: sectionRef.current, start: 'top 76%', end: 'bottom 50%', scrub: 1 } },
        );
        cards.forEach((card) => {
          gsap.from(card, {
            y: 20,
            autoAlpha: 0,
            duration: 0.94,
            ease: 'power2.out',
            clearProps: 'transform,opacity,visibility',
            scrollTrigger: { trigger: card, start: 'top 80%', toggleActions: 'play none none reverse' },
          });
        });
      }
    }, sectionRef);
    return () => context.revert();
  }, [isMobile, reduceMotion]);

  return (
    <section className="how-section section-wrap" id="how-it-works" aria-labelledby="how-title" ref={sectionRef}>
      <SectionHeading id="how-title" eyebrow="A clear rhythm" title="A plan you can" accent="return to." description="Move from a long-term goal to a scheduled Task, with a recovery route when a day goes differently than planned." />
      <div className="journey-layout">
        <div className="journey-summary scroll-reveal" aria-live="polite">
          <span className="journey-summary__step">STEP {steps[activeStep].number} <i>·</i> {steps[activeStep].eyebrow}</span>
          <h3>{steps[activeStep].title}</h3>
          <p>{steps[activeStep].copy}</p>
          <div className="journey-summary__progress"><span>{steps[activeStep].number}</span><span className="journey-summary__track"><i style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }} /></span><span>04</span></div>
        </div>
        <div className="journey-map" aria-label="Four steps in the THE SYSTEM process">
          <svg className="journey-path" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
            <path className="journey-path__base" d="M235 99 C410 99 590 112 765 236 C790 282 635 355 235 393 C112 415 345 478 765 498" />
            <path className="journey-path__line" pathLength="1" d="M235 99 C410 99 590 112 765 236 C790 282 635 355 235 393 C112 415 345 478 765 498" />
          </svg>
          {steps.map((step, index) => (
            <article
              className={`journey-step journey-step--${index + 1}${activeStep === index ? ' is-active' : ''}${index < activeStep ? ' is-done' : ''}`}
              key={step.number}
            >
              <span className="journey-step__number" aria-label={index < activeStep ? 'Step complete' : `Step ${step.number}`}>
                {index < activeStep ? <span aria-hidden="true">✓</span> : step.number}
              </span>
              <div className="journey-step__copy"><p>{step.eyebrow}</p><h3>{step.title}</h3><span>{step.copy}</span></div>
              <span className="journey-step__check" aria-hidden="true">{index < activeStep ? 'Complete' : activeStep === index ? 'In focus' : 'Next'}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
