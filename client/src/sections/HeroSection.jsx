import { useState } from 'react';
import Button from '../components/Button.jsx';
import ShadowBackground from '../components/ShadowBackground.jsx';

const starterTasks = [
  { title: 'Choose a study slot', meta: 'Earlier today', state: 'done' },
  { title: 'Review one set of notes', meta: 'Scheduled for today', state: 'current' },
  { title: 'Write three practice questions', meta: 'Planned for later', state: 'next' },
];

function TaskPreview() {
  const [completed, setCompleted] = useState(false);
  const completedCount = completed ? 2 : 1;

  const followPointer = (event) => {
    if (event.pointerType !== 'mouse') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    event.currentTarget.style.setProperty('--pointer-x', `${x * 100}%`);
    event.currentTarget.style.setProperty('--pointer-y', `${y * 100}%`);
    event.currentTarget.style.setProperty('--tilt-x', `${(0.5 - y) * 2.4}deg`);
    event.currentTarget.style.setProperty('--tilt-y', `${(x - 0.5) * 3.2}deg`);
  };

  const resetPointer = (event) => {
    event.currentTarget.style.setProperty('--tilt-x', '0deg');
    event.currentTarget.style.setProperty('--tilt-y', '0deg');
    event.currentTarget.style.setProperty('--pointer-x', '72%');
    event.currentTarget.style.setProperty('--pointer-y', '8%');
  };

  return (
      <div className="hero-demo-wrap" onPointerMove={followPointer} onPointerLeave={resetPointer}>
      <article className={`hero-demo${completed ? ' is-complete' : ''}`} aria-label="Interactive example of a daily Task plan">
        <div className="hero-demo__topline">
          <span className="hero-demo__brand"><span className="hero-demo__mark" aria-hidden="true">✳</span> THE SYSTEM</span>
          <span className="hero-demo__sample">SAMPLE PLAN</span>
        </div>

        <div className="hero-demo__goal">
          <div>
            <p className="hero-demo__eyebrow">LONG-TERM GOAL</p>
            <h2>Prepare for exams</h2>
          </div>
          <span className="hero-demo__goal-mark" aria-hidden="true">↗</span>
        </div>

        <div className="hero-focus">
          <div className="hero-focus__heading">
            <p className="hero-demo__eyebrow">TODAY’S FOCUS</p>
            <span className={completed ? 'hero-focus__status is-done' : 'hero-focus__status'}>
              <i aria-hidden="true">{completed ? '✓' : ''}</i>{completed ? 'Done' : 'Up next'}
            </span>
          </div>
          <h3>Review one set of notes</h3>
          <p>Choose one topic and give it your first two minutes.</p>
          <div className="hero-focus__actions">
            <span className="hero-demo__time">20 min <b>·</b> Today</span>
            <button
              className="hero-focus__complete"
              type="button"
              aria-pressed={completed}
              onClick={() => setCompleted((value) => !value)}
            >
              <span>{completed ? 'Demo task complete' : 'Complete demo task'}</span>
              <i aria-hidden="true">{completed ? '✓' : '＋'}</i>
            </button>
          </div>
        </div>

        <div className="hero-demo__tasks" aria-label="Example Tasks">
          {starterTasks.map((task) => {
            const isDone = task.state === 'done' || (task.state === 'current' && completed);
            const isCurrent = task.state === 'current' && !completed;
            return (
              <div className={`hero-task hero-task--${isDone ? 'done' : isCurrent ? 'current' : 'next'}`} key={task.title}>
                <span className="hero-task__icon" aria-hidden="true">{isDone ? '✓' : isCurrent ? '02' : '03'}</span>
                <span className="hero-task__copy"><strong>{task.title}</strong><small>{task.meta}</small></span>
                <span className="hero-task__state">{isDone ? 'Done' : isCurrent ? 'Now' : 'Next'}</span>
              </div>
            );
          })}
        </div>

        <div className="hero-demo__progress">
          <div className="hero-demo__progress-label"><span>Today’s follow-through</span><strong>{completedCount} of 3</strong></div>
          <div className="hero-demo__progress-track" role="progressbar" aria-label="Example daily follow-through" aria-valuemin="0" aria-valuemax="3" aria-valuenow={completedCount}>
            <span style={{ width: `${(completedCount / 3) * 100}%` }} />
          </div>
          <p>Interactive preview · your progress is not saved</p>
        </div>
      </article>
      <div className="hero-demo-note" aria-hidden="true"><span>01</span><span>One clear Task is enough to begin.</span></div>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section className="hero-section" id="top" aria-labelledby="hero-title">
      <ShadowBackground />
      <div className="hero-layout section-wrap">
        <div className="hero-content">
          <p className="section-kicker hero-eyebrow"><span className="kicker-line" />A GOAL YOU KEEP PUTTING OFF</p>
          <h1 id="hero-title">Start small.<br /><em>Move forward.</em></h1>
          <p className="hero-copy">Turn a long-term goal into one clear Task for today. Follow through, build XP, and see your effort open the way to your next Rank.</p>
          <div className="hero-actions">
          <Button href="/signup" variant="primary">Plan your first Task</Button>
            <Button href="#how-it-works" variant="quiet">See how it works</Button>
          </div>
          <p className="hero-proof"><i aria-hidden="true" />A practical system for steady, personal progress.</p>
        </div>
        <TaskPreview />
      </div>
      <div className="hero-bottom" aria-hidden="true">
        <span>YOUR GOALS. YOUR PACE. YOUR PROOF.</span>
        <a className="scroll-cue" href="#introduction"><span>SCROLL TO EXPLORE</span><i /></a>
        <span>THE SYSTEM <b>/</b> 01</span>
      </div>
    </section>
  );
}
