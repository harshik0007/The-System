import SectionHeading from '../components/SectionHeading.jsx';
import SurfaceCard from '../components/SurfaceCard.jsx';

const features = [
  { index: 'A / 01', icon: '⌖', title: 'A daily Task schedule', copy: 'Follow 7 Tasks each day in a repeating cycle of 1–7 days.' },
  { index: 'A / 02', icon: '▤', title: 'Recovery by your design', copy: 'Link each Task to an Accountability Action you choose. A missed Task activates its Recovery Quest.' },
  { index: 'A / 03', icon: '◇', title: 'XP and seven Ranks', copy: 'Earn base XP and completion milestone bonuses. Ranks provide rank-specific XP benefits and profile badges.' },
  { index: 'A / 04', icon: '⟡', title: 'Monthly Analysis', copy: 'Compare any available months in your current progression run.' },
];

export default function FeaturesSection() {
  return (
    <section className="features-section" id="features" aria-labelledby="features-title">
      <div className="section-wrap features-inner">
        <SectionHeading id="features-title" eyebrow="Designed around your effort" title="Tools for a more" accent="intentional life." description="A focused system for Tasks, recovery, progression and reflection." />
        <div className="features-grid">
          {features.map((feature) => (
            <SurfaceCard variant="feature" className="feature-card scroll-reveal" key={feature.index}>
              <div className="feature-top"><span>{feature.index}</span><span className="card-icon feature-icon" aria-hidden="true">{feature.icon}</span></div>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
              <span className="feature-rule" />
            </SurfaceCard>
          ))}
        </div>
      </div>
    </section>
  );
}
