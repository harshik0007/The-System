import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import AppIcon from '../app/AppIcon.jsx';

const STATUS_LABELS = {
  scheduled: 'Scheduled',
  submitted: 'Submitted for verification',
  completed: 'Completed',
  missed: 'Missed',
};

function TaskManageMenu({ task, onModify, canModify, changesExhausted }) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const frameRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'down', ready: false });

  useLayoutEffect(() => {
    if (!open) return undefined;
    const positionMenu = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const rect = trigger.getBoundingClientRect();
      const gap = 6;
      const edge = 12;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const menuHeight = menu.scrollHeight;
      const menuWidth = menu.getBoundingClientRect().width;
      const below = Math.max(0, viewportHeight - rect.bottom - gap - edge);
      const above = Math.max(0, rect.top - gap - edge);
      const placement = menuHeight <= below || below >= above ? 'down' : 'up';
      const left = Math.min(Math.max(edge, rect.right - menuWidth), viewportWidth - menuWidth - edge);
      const top = placement === 'up'
        ? Math.max(edge, rect.top - gap - menuHeight)
        : Math.max(edge, Math.min(viewportHeight - menuHeight - edge, rect.bottom + gap));
      setPosition({ top, left, placement, ready: true });
    };
    positionMenu();

    const onViewportChange = () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(positionMenu);
    };
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('scroll', onViewportChange);
    window.visualViewport?.addEventListener('resize', onViewportChange);
    return () => {
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('scroll', onViewportChange);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      cancelAnimationFrame(frameRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selectAction = (mode) => {
    setOpen(false);
    onModify(task, mode);
  };

  return (
    <div className={`task-card__manage${open ? ' is-open' : ''}`}>
      <button
        className="task-card__manage-trigger"
        type="button"
        ref={triggerRef}
        aria-label={`Manage future occurrences of ${task.name}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >Manage Task<span aria-hidden="true">⌄</span></button>
      {open && createPortal(
        <div
          className="task-card__manage-menu"
          ref={menuRef}
          role="group"
          aria-label={`Future task changes for ${task.name}`}
          data-placement={position.placement}
          style={{ position: 'fixed', top: position.top, left: position.left, visibility: position.ready ? 'visible' : 'hidden' }}
        >
          <button type="button" disabled={!canModify} onClick={() => selectAction('edit')}>Edit Task</button>
          <button type="button" disabled={!canModify} onClick={() => selectAction('replace')}>Replace Task</button>
          <button type="button" disabled={!canModify} onClick={() => selectAction('reschedule')}>Reschedule</button>
          {changesExhausted && <small>Weekly changes are used. The allowance resets Monday.</small>}
        </div>,
        document.body,
      )}
    </div>
  );
}

export default function TaskCard({ task, onSubmit, onMarkMissed, onMarkCompleted, onModify, canModify, changesExhausted }) {
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
            {isScheduled && <TaskManageMenu task={task} onModify={onModify} canModify={canModify} changesExhausted={changesExhausted} />}
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
              {task.accountabilityActionDescription && <p className="task-accountability-action__description">{task.accountabilityActionDescription}</p>}
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
