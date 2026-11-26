import { useRef, useState } from 'react';
import AppIcon from './AppIcon.jsx';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { markQuickStartIntroSeen } from '../../utils/firstRunProgress.js';

const CARDS = [
  { icon: 'tasks', title: 'Build your daily plan', text: 'Choose at least 7 small Tasks for each day in your schedule.' },
  { icon: 'clock', title: 'Finish before the day resets', text: 'Complete scheduled Tasks before midnight India time, then start fresh the next day.' },
  { icon: 'spark', title: 'Turn action into progress', text: 'Eligible completed Tasks award XP and move you through seven Ranks, from Origin to Continuum.' },
  { icon: 'shield', title: 'Know your recovery plan', text: 'If you miss a Task, its linked Recovery Quest gives you 72 hours to complete the Accountability Action you chose.' },
];

export default function QuickStartIntro({ onDone }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(null);
  const reduceMotion = useReducedMotion();
  const card = CARDS[activeIndex];
  const finish = () => {
    markQuickStartIntroSeen();
    onDone();
  };

  const onTouchStart = (event) => { touchStartX.current = event.changedTouches[0]?.clientX ?? null; };
  const onTouchEnd = (event) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    setActiveIndex((current) => Math.max(0, Math.min(CARDS.length - 1, current + (delta < 0 ? 1 : -1))));
  };

  return <section className={`first-run-intro${reduceMotion ? ' is-reduced-motion' : ''}`} role="region" aria-labelledby="first-run-intro-title" aria-roledescription="carousel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onKeyDown={(event) => {
    if (event.key === 'ArrowRight') setActiveIndex((current) => Math.min(CARDS.length - 1, current + 1));
    if (event.key === 'ArrowLeft') setActiveIndex((current) => Math.max(0, current - 1));
  }}>
    <div className="first-run-intro__topline"><p className="app-eyebrow">A QUICK GUIDE · {activeIndex + 1} OF {CARDS.length}</p><button className="first-run-intro__skip" type="button" onClick={finish}>Skip intro</button></div>
    <div className="first-run-intro__slide" key={activeIndex} aria-live="polite" aria-atomic="true">
      <span className="first-run-intro__icon"><AppIcon name={card.icon} /></span>
      <h1 id="first-run-intro-title">{card.title}</h1>
      <p>{card.text}</p>
    </div>
    <div className="first-run-intro__bottomline">
      <div className="first-run-intro__dots" role="group" aria-label="Choose an intro card">
        {CARDS.map((item, index) => <button key={item.text} type="button" className={index === activeIndex ? 'is-active' : ''} aria-label={`Show intro card ${index + 1}`} aria-current={index === activeIndex ? 'step' : undefined} onClick={() => setActiveIndex(index)} />)}
      </div>
      <div className="first-run-intro__controls">
        {activeIndex > 0 && <button className="quick-start-secondary-button" type="button" onClick={() => setActiveIndex((current) => current - 1)}>Back</button>}
        {activeIndex < CARDS.length - 1
          ? <button className="quick-start-primary-button" type="button" onClick={() => setActiveIndex((current) => current + 1)}>Next <AppIcon name="arrow" /></button>
          : <button className="quick-start-primary-button" type="button" onClick={finish}>Set up my plan <AppIcon name="arrow" /></button>}
      </div>
    </div>
    <p className="first-run-intro__hint">Swipe to move between cards, or use the buttons.</p>
  </section>;
}
