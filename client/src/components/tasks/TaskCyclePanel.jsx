import AppIcon from '../app/AppIcon.jsx';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TaskCyclePanel({ context, changesAllowed, changesUsed }) {
  const remaining = Math.max(0, changesAllowed - changesUsed);

  return (
    <section className="app-panel task-cycle-panel" aria-labelledby="task-cycle-title">
      <div className="app-panel__heading">
        <div><p className="app-eyebrow">RECURRING CYCLE</p><h2 id="task-cycle-title">Cycle Day {context.cycleDay} of {context.cycleLength}</h2></div>
        <span className="task-cycle-panel__icon"><AppIcon name="analysis" /></span>
      </div>

      <ol className="task-cycle-track" aria-label={`Day ${context.cycleDay} of a ${context.cycleLength}-day cycle`}>
        {WEEKDAYS.slice(0, context.cycleLength).map((day, index) => {
          const number = index + 1;
          const state = number === context.cycleDay ? 'is-current' : number < context.cycleDay ? 'is-past' : '';
          const label = context.cycleLength === 7 ? day.slice(0, 3) : `Day ${number}`;
          return <li className={state} key={day} aria-current={number === context.cycleDay ? 'step' : undefined}><span>{String(number).padStart(2, '0')}</span><small>{label}</small></li>;
        })}
      </ol>

      <div className="task-change-allowance">
        <div className="task-change-allowance__copy"><div><p className="app-eyebrow">WEEKLY TASK CHANGES · EXAMPLE</p><strong>{changesUsed} of {changesAllowed} used</strong></div><span>{remaining} remaining</span></div>
        <div className="task-change-allowance__segments" aria-label={`${changesUsed} of ${changesAllowed} demonstration weekly changes used`}>
          {Array.from({ length: changesAllowed }, (_, index) => <i className={index < changesUsed ? 'is-used' : ''} key={index} />)}
        </div>
        <p>Calendar week: Monday–Sunday. Edits, replacements and rescheduling count. Resets Monday; unused changes do not carry forward.</p>
      </div>
    </section>
  );
}
