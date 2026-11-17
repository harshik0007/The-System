import SectionHeading from '../components/SectionHeading.jsx';
import SurfaceCard from '../components/SurfaceCard.jsx';

const steps = [
  { number: '01', icon: '◎', title: 'Follow your Task schedule', copy: 'Work through 7 daily Tasks arranged in your repeating 1–7-day cycle.' },
  { number: '02', icon: '⌁', title: 'Choose Accountability Actions', copy: 'Give every Task its own Accountability Action, selected by you in advance.' },
  { number: '03', icon: '◈', title: 'Recover and complete', copy: 'A missed Task activates its linked Recovery Quest for a 3-day Recovery Window.' },
  { number: '04', icon: '↗', title: 'Earn XP and progress', copy: 'Complete Tasks to earn base XP and completion milestone bonuses across seven Ranks.' },
];

export default function HowItWorksSection() {
  return (
    <section className="how-section section-wrap" id="how-it-works" aria-labelledby="how-title">
      <SectionHeading id="how-title" eyebrow="A simple process" title="Make the next step" accent="clear." description="A clear daily schedule connects your Tasks, Recovery Quests and progression." align="center" />
      <div className="steps-grid">
        {steps.map((step) => (
          <SurfaceCard variant="step" className="step-card scroll-reveal" key={step.number}>
            <div className="step-meta"><span>PROCESS / {step.number}</span><span className="card-icon step-icon" aria-hidden="true">{step.icon}</span></div>
            <h3>{step.title}</h3>
            <p>{step.copy}</p>
          </SurfaceCard>
        ))}
      </div>
    </section>
  );
}
