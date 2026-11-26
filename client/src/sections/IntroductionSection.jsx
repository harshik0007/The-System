import ScrollReveal from '../components/ScrollReveal.jsx';
import SurfaceCard from '../components/SurfaceCard.jsx';

const principles = [
  { number: '01', eyebrow: 'MAKE IT CLEAR', title: 'Choose one direction.', copy: 'Name the goal that matters now. You can shape the full plan as you go.' },
  { number: '02', eyebrow: 'MAKE IT DOABLE', title: 'Start with one Task.', copy: 'Turn that direction into a specific action you can put on today’s schedule.' },
  { number: '03', eyebrow: 'KEEP IT MOVING', title: 'See your effort add up.', copy: 'Eligible completed Tasks build XP and move you toward the next Level gate.' },
];

export default function IntroductionSection() {
  return (
    <section className="intro-section section-wrap" id="introduction" aria-labelledby="intro-title">
      <div className="intro-grid">
        <div className="intro-heading">
          <p className="section-kicker scroll-reveal"><span className="kicker-line" />THE IDEA</p>
          <ScrollReveal as="h2" className="section-title" id="intro-title">Make progress<br /><em>easier to begin.</em></ScrollReveal>
        </div>
        <ScrollReveal className="intro-copy">
          <p>Big goals can feel distant when the next move is unclear. THE SYSTEM helps you turn a direction into a scheduled Task you can begin today.</p>
          <p>Build a plan that leaves room for difficult days, then keep a clear record of the work you complete.</p>
        </ScrollReveal>
      </div>
      <div className="principle-strip" aria-label="Three steps to begin">
        {principles.map((item) => (
          <SurfaceCard as="article" variant="principle" className="principle-card scroll-reveal" key={item.number}>
            <span className="principle-card__number">{item.number}</span>
            <div className="principle-card__copy"><p>{item.eyebrow}</p><h3>{item.title}</h3><span>{item.copy}</span></div>
            <span className="principle-card__arrow" aria-hidden="true">↗</span>
          </SurfaceCard>
        ))}
      </div>
    </section>
  );
}
