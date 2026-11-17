import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../app/AppIcon.jsx';

const STATUS_LABELS = {
  scheduled: 'Scheduled',
  submitted: 'Submitted for verification',
  completed: 'Completed',
  missed: 'Missed',
};

export default function TaskCard({ task, onSubmit, onMarkMissed, onMarkCompleted }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = `task-details-${task.id}`;
  const isScheduled = task.status === 'scheduled';

  return (
    <li className={`task-list-item task-list-item--${task.status} daily-task-reveal`}>
      <article className="app-panel task-card" aria-labelledby={`task-title-${task.id}`}>
        <div className="task-card__main">
          <span className="task-card__number" aria-label={`Task ${task.number}`}>{String(task.number).padStart(2, '0')}</span>
          <div className="task-card__copy">
            <div className="task-card__title-row"><h3 id={`task-title-${task.id}`}>{task.name}</h3><span className={`task-status task-status--${task.status}`}><i aria-hidden="true" />{STATUS_LABELS[task.status]}</span></div>
            <p>{task.description}</p>
            <button className="task-card__details-toggle" type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded((value) => !value)}>
              <AppIcon name="shield" />{expanded ? 'Hide task details' : 'View Accountability Action'}<span aria-hidden="true">{expanded ? '−' : '+'}</span>
            </button>
          </div>
          <div className="task-card__action">
            {isScheduled && <button className="task-submit-button" type="button" onClick={() => onSubmit(task)}><AppIcon name="tasks" />Submit Completion</button>}
            {task.status === 'submitted' && <span className="task-card__locked"><AppIcon name="clock" />Awaiting review</span>}
            {task.status === 'completed' && <span className="task-card__locked task-card__locked--complete"><AppIcon name="tasks" />Completed</span>}
            {task.status === 'missed' && <span className="task-card__locked task-card__locked--missed">Missed</span>}
          </div>
        </div>

        {expanded && (
          <div className="task-card__expanded" id={detailsId}>
            <p className="task-card__description-detail">{task.details}</p>
            <div className="task-accountability-action">
              <div className="task-accountability-action__heading"><AppIcon name="recovery" /><span>USER-SELECTED ACCOUNTABILITY ACTION · DEMONSTRATION</span></div>
              <p>{task.accountabilityAction}</p>
              {task.status === 'missed' && <div className="task-card__recovery-note"><p>This task’s own Accountability Action is shown as the Recovery Quest in this preview. The ordinary missed task does not carry forward.</p><Link to="/app/recovery-quests">View Recovery Quests <span aria-hidden="true">↗</span></Link></div>}
            </div>
            {task.status === 'submitted' && <div className="task-card__preview-review"><p>Preview only: no proof is checked or verified.</p><button type="button" onClick={() => onMarkCompleted(task.id)}>Set Completed for preview</button></div>}
            {isScheduled && <button className="task-card__miss-preview" type="button" onClick={() => onMarkMissed(task.id)}>Mark missed in this preview</button>}
          </div>
        )}
      </article>
    </li>
  );
}
