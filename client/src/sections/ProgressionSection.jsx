import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import RankLogo from '../components/ranks/RankLogo.jsx';
import SectionHeading from '../components/SectionHeading.jsx';
import { ranks } from '../data/ranks.js';
import { useReducedMotion } from '../hooks/useReducedMotion.js';

gsap.registerPlugin(ScrollTrigger);

const orderedRanks = [...ranks].sort((a, b) => a.progressionOrder - b.progressionOrder);

export default function ProgressionSection() {
  const sceneRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const activeRank = orderedRanks[activeIndex];
  const activeAccent = activeRank.color ?? activeRank.palette?.crimson ?? activeRank.palette?.main ?? '#5368d5';

  useLayoutEffect(() => {
    if (reduceMotion || !sceneRef.current || window.matchMedia('(max-width: 900px)').matches) return undefined;
    const context = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sceneRef.current,
        start: 'top top+=84',
        end: () => `+=${Math.max(window.innerHeight * 1.45, 920)}`,
        pin: sceneRef.current,
        pinSpacing: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const nextIndex = Math.min(orderedRanks.length - 1, Math.floor(self.progress * orderedRanks.length));
          setActiveIndex((current) => current === nextIndex ? current : nextIndex);
        },
        onRefresh: (self) => {
          const nextIndex = Math.min(orderedRanks.length - 1, Math.floor(self.progress * orderedRanks.length));
          setActiveIndex((current) => current === nextIndex ? current : nextIndex);
        },
      });
      gsap.from('.rank-detail', {
        y: 22, autoAlpha: 0, duration: 0.72, ease: 'power3.out',
        scrollTrigger: { trigger: sceneRef.current, start: 'top 78%', once: true },
      });
    }, sceneRef);
    return () => context.revert();
  }, [reduceMotion]);

  return (
    <section className="progression-section" id="progression" aria-labelledby="progression-title">
      <div className="section-wrap progression-content">
        <SectionHeading id="progression-title" eyebrow="The progression path" title="Every Rank is" accent="earned through action." description="Begin at Rank 07, Origin. Complete eligible Tasks, build XP and reach each Level gate on your way to Rank 01, Continuum." />
        <div className="rank-scene" ref={sceneRef}>
          <div className="rank-orbit" aria-label="Select a Rank to explore">
            <span className="rank-orbit__ring rank-orbit__ring--outer" aria-hidden="true" />
            <span className="rank-orbit__ring rank-orbit__ring--inner" aria-hidden="true" />
            <svg className="rank-orbit__route" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="36" pathLength="1" />
              <circle className="rank-orbit__route-progress" cx="50" cy="50" r="36" pathLength="1" style={{ '--rank-progress': `${(activeIndex + 1) / orderedRanks.length}` }} />
            </svg>
          <div className="rank-orbit__center" style={{ '--rank-accent': activeAccent }} aria-hidden="true">
              <span>RANK {activeRank.number}</span>
              <RankLogo rank={activeRank} />
              <strong>{activeRank.name}</strong>
            </div>
            {orderedRanks.map((rank, index) => {
              const angle = (-90 + (index / orderedRanks.length) * 360) * (Math.PI / 180);
              const x = 50 + Math.cos(angle) * 36;
              const y = 50 + Math.sin(angle) * 36;
              const complete = index < activeIndex;
              return (
                <button
                  type="button"
                  className={`rank-orbit__node${index === activeIndex ? ' is-active' : ''}${complete ? ' is-passed' : ''}`}
                  style={{ left: `${x}%`, top: `${y}%`, '--rank-accent': rank.color ?? rank.palette?.crimson ?? rank.palette?.main ?? '#5368d5' }}
                  key={rank.number}
                  aria-current={index === activeIndex ? 'step' : undefined}
                  aria-label={`Rank ${rank.number}, ${rank.name}${index === activeIndex ? ', currently highlighted' : ''}`}
                  onClick={() => setActiveIndex(index)}
                >
                  <span>{complete ? '✓' : rank.number}</span><strong>{rank.name}</strong>
                </button>
              );
            })}
          </div>

          <article className="rank-detail" aria-live="polite" style={{ '--rank-accent': activeAccent }}>
            <div className="rank-detail__head">
              <div className="rank-detail__topline"><span>{activeRank.name} · Rank {activeRank.number}</span><span>{activeIndex + 1} / 07</span></div>
              <span className="rank-detail__emblem" aria-hidden="true"><RankLogo rank={activeRank} /></span>
            </div>
            <h3>{activeRank.name}</h3>
            <p className="rank-detail__description">{activeRank.shortDescription}</p>
            <div className="rank-detail__gate"><span>PROGRESSION</span><strong>{activeRank.number === '07' ? 'Your starting Rank' : 'Advances when its Level gate is reached'}</strong></div>
            <div className="rank-detail__links">
              <Link className="rank-detail__link" to={`/ranks/${activeRank.slug}`}>Rank {activeRank.number} details</Link>
              <Link className="rank-detail__all-link" to="/ranks">Explore all seven Ranks</Link>
            </div>
            <div className="rank-detail__progress"><span style={{ width: `${((activeIndex + 1) / orderedRanks.length) * 100}%` }} /></div>
            <p className="rank-detail__hint">Scroll to move through the Rank path. Rank 01 is the highest.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
