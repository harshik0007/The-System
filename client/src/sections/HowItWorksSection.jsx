import SectionHeading from '../components/SectionHeading.jsx';
import SurfaceCard from '../components/SurfaceCard.jsx';

const steps = [
  { number: '01', icon: '◎', title: 'Set your direction', copy: 'Choose goals that reflect what matters to you right now.' },
  { number: '02', icon: '⌁', title: 'Commit to the work', copy: 'Break intention into practical actions you can return to.' },
  { number: '03', icon: '◈', title: 'Record what you do', copy: 'Keep a clear record of the effort and outcomes you choose to share.' },
  { number: '04', icon: '↗', title: 'Review your progress', copy: 'Look back on your steps and decide where to go next.' },
];

export default function HowItWorksSection() {
  return (
    <section className="how-section section-wrap" id="how-it-works" aria-labelledby="how-title">
      <SectionHeading id="how-title" eyebrow="A simple process" title="Make the next step" accent="clear." description="A steady framework for turning intention into action." align="center" />
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
