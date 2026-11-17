import AppProgressBar from '../app/AppProgressBar.jsx';

export default function DailyTaskSummary({ metrics, milestones }) {
  return (
    <section className="app-panel daily-task-summary" aria-labelledby="daily-task-summary-title">
      <div className="daily-task-summary__heading">
        <div><p className="app-eyebrow">DAILY COMPLETION · EXAMPLE</p><h2 id="daily-task-summary-title">Today’s progress</h2></div>
        <strong className="daily-task-summary__percentage">{metrics.percentage}<span>%</span></strong>
      </div>

      <div className="daily-task-summary__counts" aria-label={`${metrics.completed} of ${metrics.total} tasks completed; ${metrics.remaining} remaining`}>
        <div><span>Scheduled</span><strong>{metrics.total}</strong></div>
        <div><span>Completed</span><strong>{metrics.completed}</strong></div>
        <div><span>Remaining</span><strong>{metrics.remaining}</strong></div>
      </div>

      <div className="daily-task-summary__progress">
        <AppProgressBar value={metrics.percentage} label="Daily task completion" description={`${metrics.completed} of ${metrics.total} demonstration tasks completed. Each scheduled task has equal weight.`} />
        <div className="daily-task-milestones" aria-label="XP bonus completion milestones">
          {milestones.map((milestone) => {
            const reached = metrics.percentage >= milestone;
            return (
              <span key={milestone} className={`daily-task-milestones__marker${reached ? ' is-reached' : ''}`} style={{ left: `${milestone}%` }}>
                <i aria-hidden="true" />
                <small>{milestone}%</small>
              </span>
            );
          })}
        </div>
      </div>

      <p className="daily-task-summary__note">Each task has equal weight. The markers are XP bonus milestones; reward amounts are not assigned. Submitted tasks remain under verification and are not shown as completed.</p>
    </section>
  );
}
