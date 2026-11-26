import Button from '../components/Button.jsx';
import ShadowBackground from '../components/ShadowBackground.jsx';

export default function FinalCTASection() {
  return (
    <section className="final-cta section-wrap" aria-labelledby="final-cta-title">
      <ShadowBackground variant="closing" />
      <div className="final-cta-content scroll-reveal">
        <p className="section-kicker"><span className="kicker-line" />PROGRESS STARTS BEFORE MOTIVATION SHOWS UP</p>
        <h2 className="section-title" id="final-cta-title">Give your goal a place<br />in <em>today’s plan.</em></h2>
        <p>Choose <strong>one goal</strong>, schedule <strong>one doable Task</strong>, and give it a time. If a day goes differently, your plan includes a way back.</p>
        <ol className="final-cta-steps" aria-label="A simple way to begin">
          <li className="final-cta-step"><i>01</i><span>Choose a goal</span></li>
          <li className="final-cta-step"><i>02</i><span>Choose one Task</span></li>
          <li className="final-cta-step"><i>03</i><span>Schedule it</span></li>
          <li className="final-cta-step"><i>04</i><span>Follow through</span></li>
        </ol>
        <div className="final-cta-action-stack">
          <div className="final-cta-actions">
            <Button href="/signup" variant="primary">Plan your first Task</Button>
            <Button href="/ranks" variant="quiet">Explore the seven Ranks</Button>
          </div>
          <p className="final-cta-note">Start where you are. <strong>One clear Task is enough to begin.</strong></p>
        </div>
      </div>
    </section>
  );
}
