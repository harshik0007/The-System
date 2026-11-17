import { useState } from 'react';
import ProgressionEmblem from '../components/ProgressionEmblem.jsx';
import SectionHeading from '../components/SectionHeading.jsx';
import ShadowBackground from '../components/ShadowBackground.jsx';
import SurfaceCard from '../components/SurfaceCard.jsx';
import { progressionStages } from '../data/progressionStages.js';

export default function ProgressionSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStage = progressionStages[activeIndex];

  const moveSelection = (event, index) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = Math.min(progressionStages.length - 1, Math.max(0, index + direction));
    setActiveIndex(nextIndex);
    event.currentTarget.parentElement?.querySelector(`[data-stage-index="${nextIndex}"]`)?.focus();
  };

  return (
    <section className="progression-section" id="progression" aria-labelledby="progression-title">
      <ShadowBackground variant="progression" />
      <div className="section-wrap progression-content">
        <SectionHeading id="progression-title" eyebrow="The progression path" title="Seven stages." accent="One continuing climb." description="A visual path for recognizing the steps you take as you move forward." align="center" />
        <div className="progress-track" aria-hidden="true"><span className="progress-track-fill" /></div>
        <div className="stages-grid" role="tablist" aria-label="Seven stages of progression">
          {progressionStages.map((stage, index) => {
            const selected = index === activeIndex;
            return (
              <SurfaceCard
                as="button"
                variant="progression"
                className={`stage-card stage-card--${stage.number}${selected ? ' is-selected' : ''}`}
                style={{ '--stage-color': stage.color }}
                key={stage.number}
                id={`stage-tab-${stage.number}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="stage-detail-panel"
                tabIndex={selected ? 0 : -1}
                data-stage-index={index}
                onClick={() => setActiveIndex(index)}
                onKeyDown={(event) => moveSelection(event, index)}
              >
                <span className="stage-topline"><span>STAGE {stage.number}</span><span className="stage-indicator" /></span>
                <span className="stage-emblem"><ProgressionEmblem stage={stage} active={selected} /></span>
                <span className="stage-label">Stage {stage.number}</span>
                <span className="stage-action">VIEW STAGE <b aria-hidden="true">↗</b></span>
              </SurfaceCard>
            );
          })}
        </div>
        <SurfaceCard as="div" variant="information" className="stage-detail" id="stage-detail-panel" role="tabpanel" aria-labelledby={`stage-tab-${activeStage.number}`} aria-live="polite">
          <div className="stage-detail-index"><span>{activeStage.number}</span><span className="stage-detail-divider" /><span>07</span></div>
          <div className="stage-detail-copy">
            <p className="detail-label">CURRENT STAGE</p>
            <h3>Stage {activeStage.number}</h3>
            <p>{activeStage.description}</p>
          </div>
          <div className="stage-detail-note"><span className="pulse-dot" />A PATH THAT CONTINUES</div>
        </SurfaceCard>
      </div>
    </section>
  );
}
