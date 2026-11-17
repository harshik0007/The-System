import ScrollReveal from '../components/ScrollReveal.jsx';
import SurfaceCard from '../components/SurfaceCard.jsx';

export default function IntroductionSection() {
  return (
    <section className="intro-section section-wrap" id="introduction" aria-labelledby="intro-title">
      <p className="section-kicker scroll-reveal"><span className="kicker-line" />THE IDEA</p>
      <div className="intro-grid">
        <ScrollReveal as="h2" className="section-title" id="intro-title">A clearer way<br /><em>to move forward.</em></ScrollReveal>
        <ScrollReveal className="intro-copy">
          <p>THE SYSTEM is a personal progression framework built around the work you choose to do. Set a direction, follow through on meaningful actions, and keep a record of what you accomplish.</p>
          <p>Your path is yours to shape. Progress begins with one intentional step.</p>
        </ScrollReveal>
      </div>
      <div className="principle-strip scroll-reveal" aria-label="Three principles">
        <SurfaceCard as="article" variant="principle"><span className="strip-number">01</span><span>Choose with intention</span></SurfaceCard>
        <SurfaceCard as="article" variant="principle"><span className="strip-number">02</span><span>Show up for the work</span></SurfaceCard>
        <SurfaceCard as="article" variant="principle"><span className="strip-number">03</span><span>Recognize your progress</span></SurfaceCard>
      </div>
    </section>
  );
}
