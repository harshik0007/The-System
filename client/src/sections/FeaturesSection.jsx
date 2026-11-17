import SectionHeading from '../components/SectionHeading.jsx';
import SurfaceCard from '../components/SurfaceCard.jsx';

const features = [
  { index: 'A / 01', icon: '⌖', title: 'Goals with purpose', copy: 'Keep your attention on the commitments that matter to you.' },
  { index: 'A / 02', icon: '▤', title: 'Actions you can follow', copy: 'Give big intentions a practical shape with clear next steps.' },
  { index: 'A / 03', icon: '◇', title: 'A record of your work', copy: 'Capture meaningful moments and evidence of what you have done.' },
  { index: 'A / 04', icon: '⟡', title: 'Progress over time', copy: 'See your effort as a continuing path, one step at a time.' },
];

export default function FeaturesSection() {
  return (
    <section className="features-section" id="features" aria-labelledby="features-title">
      <div className="section-wrap features-inner">
        <SectionHeading id="features-title" eyebrow="Designed around your effort" title="Tools for a more" accent="intentional life." description="A focused set of building blocks for planning, doing, and reflecting." />
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
