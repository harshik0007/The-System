import Button from '../components/Button.jsx';
import ShadowBackground from '../components/ShadowBackground.jsx';

export default function FinalCTASection() {
  return (
    <section className="final-cta section-wrap" aria-labelledby="final-cta-title">
      <ShadowBackground variant="closing" />
      <div className="final-cta-content scroll-reveal">
        <p className="section-kicker"><span className="kicker-line" />THE NEXT STEP IS YOURS</p>
        <h2 className="section-title" id="final-cta-title">Progress starts<br /><em>with what you choose.</em></h2>
        <p>Choose what matters. Commit to the work. Begin where you are.</p>
        <Button href="/signup" variant="primary">Enter THE SYSTEM <span aria-hidden="true">↗</span></Button>
      </div>
    </section>
  );
}
