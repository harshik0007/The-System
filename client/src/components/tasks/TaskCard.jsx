import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../app/AppIcon.jsx';
import TaskActionMenu from './TaskActionMenu.jsx';

const STATUS_LABELS = {
  scheduled: 'Scheduled',
  submitted: 'Submitted for verification',
  completed: 'Completed',
  missed: 'Missed',
};

export default function TaskCard({ task, onSubmit, onMarkMissed, onMarkCompleted, onModify, canModify, paused = false, backendMode = false }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = `task-details-${task.id}`;
  const isScheduled = task.status === 'scheduled';
  const handleMenuAction = (selectedTask, mode) => {
    if (mode === 'details') {
      setExpanded(true);
      return;
    }
    if (mode === 'proof') {
      onSubmit?.(selectedTask);
      return;
    }
    onModify?.(selectedTask, mode);
  };

  return (
    <li className={`task-list-item task-list-item--${task.status} daily-task-reveal`}>
      <article className="app-panel task-card" aria-labelledby={`task-title-${task.id}`}>
        <div className="task-card__main">
          <span className="task-card__number" aria-label={`Task ${task.number}`}>{String(task.number).padStart(2, '0')}</span>
          <div className="task-card__copy">
            <div className="task-card__title-row"><h3 id={`task-title-${task.id}`}>{task.name}</h3><span className={`task-status task-status--${task.status}`}><i aria-hidden="true" />{STATUS_LABELS[task.status]}</span></div>
          </div>
          <div className="task-card__action">
            {isScheduled && <button className="task-submit-button" type="button" disabled={paused || !onSubmit} onClick={() => onSubmit?.(task)}><AppIcon name="tasks" />{backendMode ? 'Submit Proof' : 'Submit Completion'}</button>}
            {isScheduled && <TaskActionMenu task={task} onSelect={handleMenuAction} canModify={canModify} />}
            {task.status === 'submitted' && <span className="task-card__locked"><AppIcon name="clock" />Awaiting review</span>}
            {task.status === 'completed' && <span className="task-card__locked task-card__locked--complete"><AppIcon name="tasks" />Completed</span>}
            {task.status === 'missed' && <span className="task-card__locked task-card__locked--missed">Missed</span>}
          </div>
        </div>

        {expanded && (
          <div className="task-card__expanded" id={detailsId}>
            <p className="task-card__description-detail">{task.details}</p>
            <div className="task-accountability-action">
              <div className="task-accountability-action__heading"><AppIcon name="shield" /><span>FORFEIT</span></div>
              <p>{task.accountabilityAction}</p>
              {task.accountabilityActionDescription && <p className="task-accountability-action__description">{task.accountabilityActionDescription}</p>}
              {!backendMode && task.status === 'missed' && <div className="task-card__recovery-note"><p>This task’s own Forfeit is shown as the Recovery Quest in this preview. The ordinary missed task does not carry forward.</p><Link to="/app/recovery-quests">View Recovery Quests <span aria-hidden="true">↗</span></Link></div>}
            </div>
            {!backendMode && task.status === 'submitted' && <div className="task-card__preview-review"><p>Preview only: no proof is checked or verified.</p><button type="button" disabled={paused} onClick={() => onMarkCompleted(task.id)}>Set Completed for preview</button></div>}
            {!backendMode && isScheduled && <button className="task-card__miss-preview" type="button" disabled={paused} onClick={() => onMarkMissed(task.id)}>Mark missed in this preview</button>}
            {paused && <p className="task-card__pause-note" role="status">Emergency Pause is active. Task actions and Recovery Quest generation are suspended.</p>}
          </div>
        )}
      </article>
    </li>
  );
}
