import AppProgressBar from '../app/AppProgressBar.jsx';

export default function DailyTaskSummary({ metrics }) {
  return (
    <section className="app-panel daily-task-summary" aria-labelledby="daily-task-summary-title">
      <div className="daily-task-summary__heading">
        <div><p className="app-eyebrow">DAILY TASKS · SERVER DATA</p><h2 id="daily-task-summary-title">Today’s schedule</h2></div>
        <strong className="daily-task-summary__percentage">{metrics.percentage}<span>%</span></strong>
      </div>

      <div className="daily-task-summary__counts" aria-label={`${metrics.completed} of ${metrics.total} tasks completed; ${metrics.remaining} remaining`}>
        <div><span>Scheduled</span><strong>{metrics.total}</strong></div>
        <div><span>Completed</span><strong>{metrics.completed}</strong></div>
        <div><span>Remaining</span><strong>{metrics.remaining}</strong></div>
      </div>

      <div className="daily-task-summary__progress">
        <AppProgressBar value={metrics.percentage} label="Daily task completion" description={`${metrics.completed} of ${metrics.total} scheduled Tasks are recorded as completed.`} />
      </div>

      <p className="daily-task-summary__note">Submit a scheduled Task to record it as completed. Proof is optional and is not AI-verified.</p>
    </section>
  );
}
