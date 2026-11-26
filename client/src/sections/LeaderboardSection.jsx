import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SectionHeading from '../components/SectionHeading.jsx';
import { useReducedMotion } from '../hooks/useReducedMotion.js';

gsap.registerPlugin(ScrollTrigger);

const standings = [
  { icon: '↗', title: 'Overall progress', copy: 'Compare current Rank, Level and current-run XP.' },
  { icon: '⌁', title: 'Discipline', copy: 'Recognize current and current-run longest streaks.' },
  { icon: '✳', title: 'XP earned', copy: 'Review eligible Task XP recorded in the current run.' },
];

export default function LeaderboardSection() {
  const sceneRef = useRef(null);
  const [revealStep, setRevealStep] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 600px)').matches);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const media = window.matchMedia('(max-width: 600px)');
    const updateMobile = (event) => setIsMobile(event.matches);
    setIsMobile(media.matches);
    media.addEventListener('change', updateMobile);
    return () => media.removeEventListener('change', updateMobile);
  }, []);

  useLayoutEffect(() => {
    if (!sceneRef.current) return undefined;
    const scene = sceneRef.current;
    if (reduceMotion || isMobile) {
      scene.classList.remove('has-scroll-motion');
      setRevealStep(3);
      return undefined;
    }
    scene.classList.add('has-scroll-motion');
    const context = gsap.context(() => {
      if (window.matchMedia('(max-width: 900px)').matches) {
        ScrollTrigger.create({
          trigger: sceneRef.current,
          start: 'top 76%',
          end: 'bottom 38%',
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const progress = self.progress;
            const nextStep = progress > 0.82 ? 3 : progress > 0.5 ? 2 : progress > 0.16 ? 1 : 0;
            setRevealStep((current) => current === nextStep ? current : nextStep);
          },
          onLeaveBack: () => setRevealStep(0),
        });
        return;
      }
      ScrollTrigger.create({
        trigger: sceneRef.current,
        start: 'top top+=84',
        end: () => `+=${Math.max(window.innerHeight * 1.8, 1280)}`,
        pin: sceneRef.current,
        pinSpacing: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const progress = self.progress;
          const nextStep = progress > 0.78 ? 3 : progress > 0.43 ? 2 : progress > 0.12 ? 1 : 0;
          setRevealStep((current) => current === nextStep ? current : nextStep);
        },
        onLeaveBack: () => setRevealStep(0),
      });
    }, sceneRef);
    return () => {
      context.revert();
      scene.classList.remove('has-scroll-motion');
    };
  }, [isMobile, reduceMotion]);

  return (
    <section className="leaderboard-section section-wrap" id="leaderboard" aria-labelledby="leaderboard-title">
      <SectionHeading id="leaderboard-title" eyebrow="Community standings" title="Progress is personal." accent="Momentum is shared." description="Compare recorded progress across three views. Standings recognize activity; they do not award XP, Discipline Points, or Rank benefits." />
      <div className="leaderboard-metrics">
        {standings.map((item, index) => (
          <article className="leader-metric scroll-reveal" key={item.title}>
            <span className={`leader-metric__icon leader-metric__icon--${index + 1}`} aria-hidden="true">{item.icon}</span>
            <div><h3>{item.title}</h3><p>{item.copy}</p></div>
            <span className="leader-metric__index">0{index + 1}</span>
          </article>
        ))}
      </div>
      <div className="podium-scene" ref={sceneRef} aria-label="Illustrative leaderboard podium">
        <div className="podium-scene__header"><span>COMMUNITY STANDINGS</span><span>OVERALL · DISCIPLINE · XP</span></div>
        <div className={`podium${revealStep >= 1 ? ' has-third' : ''}${revealStep >= 2 ? ' has-second' : ''}${revealStep >= 3 ? ' has-first' : ''}`}>
          <article className={`podium-card podium-card--second${revealStep >= 2 ? ' is-revealed' : ''}`}>
            <span className="podium-card__position">2nd</span>
            <div className="podium-card__block"><span className="podium-card__medal">02</span><strong>Member profile</strong><small>Details shared with permission</small></div>
          </article>
          <article className={`podium-card podium-card--first${revealStep >= 3 ? ' is-revealed' : ''}`}>
            <span className="podium-card__position">1st</span>
            <div className="podium-card__block"><span className="podium-card__medal">01</span><strong>Member profile</strong><small>Details shared with permission</small></div>
          </article>
          <article className={`podium-card podium-card--third${revealStep >= 1 ? ' is-revealed' : ''}`}>
            <span className="podium-card__position">3rd</span>
            <div className="podium-card__block"><span className="podium-card__medal">03</span><strong>Member profile</strong><small>Details shared with permission</small></div>
          </article>
          <div className="podium__base" aria-hidden="true"><i /><i /><i /></div>
        </div>
        <p className="podium-scene__note">Member names and scores appear only when shared.</p>
        {!isMobile && !reduceMotion && <div className="podium-scene__scroll-hint"><span>SCROLL TO REVEAL THE PODIUM</span><i style={{ '--reveal-progress': `${revealStep / 3}` }} /></div>}
      </div>
    </section>
  );
}
