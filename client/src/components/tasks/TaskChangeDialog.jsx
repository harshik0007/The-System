import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../app/AppIcon.jsx';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CHANGE_LABELS = { edit: 'Edit future Task', replace: 'Replace future Task', reschedule: 'Reschedule future Task' };

function getCycleLabel(day, cycleLength) {
  return cycleLength === 7 ? WEEKDAYS[day - 1] : `Day ${String(day).padStart(2, '0')}`;
}

function makeDraft(task, mode) {
  if (mode === 'replace') {
    return { name: '', description: '', cycleDays: [...task.cycleDays], actionTitle: '', actionDescription: '', weakness: '' };
  }
  return {
    name: task.name,
    description: task.description || '',
    cycleDays: [...task.cycleDays],
    actionTitle: task.actionTitle || task.accountabilityAction || '',
    actionDescription: task.actionDescription || '',
    weakness: task.weakness || '',
  };
}

function getChanges(task, draft, mode, cycleLength) {
  const values = [
    ['Task name', task.name, draft.name],
    ['Description', task.description || '', draft.description || ''],
    ['Assigned cycle days', task.cycleDays.map((day) => getCycleLabel(day, cycleLength)).join(', '), draft.cycleDays.map((day) => getCycleLabel(day, cycleLength)).join(', ')],
    ['Accountability Action title', task.actionTitle || task.accountabilityAction || '', draft.actionTitle],
    ['Accountability Action description', task.actionDescription || '', draft.actionDescription],
  ];
  return values.filter(([, before, after]) => mode === 'replace' || before !== after).map(([label, before, after]) => ({ label, before: before || 'Not provided', after: after || 'Not provided' }));
}

function getDayCounts(tasks, task, draft, cycleLength) {
  return Array.from({ length: cycleLength }, (_, index) => {
    const dayNumber = index + 1;
    const currentCount = tasks.filter((item) => item.cycleDays.includes(dayNumber)).length;
    const wasAssigned = task.cycleDays.includes(dayNumber);
    const willBeAssigned = draft.cycleDays.includes(dayNumber);
    const count = currentCount - Number(wasAssigned) + Number(willBeAssigned);
    return { dayNumber, currentCount, count, remaining: Math.max(0, 7 - count), valid: count >= 7, changed: wasAssigned !== willBeAssigned };
  });
}

export default function TaskChangeDialog({ task, mode, cycleLength, tasks, allowance, onConfirm, onClose }) {
  const dialogRef = useRef(null);
  const [phase, setPhase] = useState('edit');
  const [draft, setDraft] = useState(() => task ? makeDraft(task, mode) : null);
  const [attempted, setAttempted] = useState(false);
  const isOpen = Boolean(task && mode);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      setDraft(makeDraft(task, mode));
      setPhase('edit');
      setAttempted(false);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [task?.id, mode, isOpen]);

  const counts = useMemo(() => task && draft ? getDayCounts(tasks, task, draft, cycleLength) : [], [tasks, task, draft, cycleLength]);
  const changes = useMemo(() => task && draft ? getChanges(task, draft, mode, cycleLength) : [], [task, draft, mode, cycleLength]);
  const issues = [];
  if (draft) {
    if (!draft.name.trim()) issues.push('Task name is required.');
    if (!draft.cycleDays.length) issues.push('Assign this Task to at least one cycle day.');
    if (!draft.actionTitle.trim()) issues.push('An Accountability Action title is required.');
    if (!draft.actionDescription.trim()) issues.push('An Accountability Action description is required.');
    if (counts.some((day) => !day.valid)) issues.push('Every cycle day must retain at least 7 scheduled Tasks.');
    if (mode !== 'replace' && changes.length === 0) issues.push('No changes have been made yet.');
  }

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const toggleDay = (dayNumber) => setDraft((current) => ({
    ...current,
    cycleDays: current.cycleDays.includes(dayNumber)
      ? current.cycleDays.filter((day) => day !== dayNumber)
      : [...current.cycleDays, dayNumber].sort((a, b) => a - b),
  }));

  const continueToReview = (event) => {
    event.preventDefault();
    setAttempted(true);
    if (issues.length) return;
    setPhase('confirm');
  };

  const finish = () => {
    if (!task || issues.length || allowance.remaining < 1) return;
    onConfirm({ taskId: task.id, mode, draft });
  };

  const title = mode === 'replace' ? 'Replace Task' : mode === 'reschedule' ? 'Reschedule Task' : 'Edit Task';

  return (
    <dialog className="task-change-dialog" ref={dialogRef} aria-labelledby="task-change-title" onClose={onClose} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      {isOpen && draft && <>
        <div className="task-change-dialog__header"><div><p className="app-eyebrow">FUTURE SCHEDULE · {CHANGE_LABELS[mode].toUpperCase()}</p><h2 id="task-change-title">{phase === 'edit' ? title : 'Confirm task change?'}</h2><p>{phase === 'edit' ? `Update “${task.name}” for future occurrences.` : `Review the proposed changes to “${task.name}”.`}</p></div><button type="button" className="task-change-dialog__close" aria-label="Close task change dialog" onClick={onClose}><AppIcon name="close" /></button></div>

        {phase === 'edit' ? <form className="task-change-dialog__body" onSubmit={continueToReview} noValidate>
          {mode !== 'reschedule' && <>
            {mode === 'replace' && <div className="task-change-dialog__replacing"><span>REPLACING</span><strong>{task.name}</strong><p>The original Task details and any historical record remain unchanged.</p></div>}
            <label className="task-change-field" htmlFor="change-task-name">{mode === 'replace' ? 'New Task name' : 'Task name'} <span>Required</span><input id="change-task-name" value={draft.name} maxLength={100} aria-invalid={attempted && !draft.name.trim()} onChange={(event) => update('name', event.target.value)} /></label>
            <label className="task-change-field" htmlFor="change-task-description">Description <span>Optional</span><textarea id="change-task-description" rows="2" maxLength={300} value={draft.description} onChange={(event) => update('description', event.target.value)} /></label>
          </>}

          <fieldset className="task-change-days"><legend>{mode === 'reschedule' ? 'Choose the new cycle-day assignments' : 'Assigned cycle days'} <span>Choose one or more</span></legend><div>
            {Array.from({ length: cycleLength }, (_, index) => index + 1).map((day) => <label className={draft.cycleDays.includes(day) ? 'is-selected' : ''} key={day}><input type="checkbox" checked={draft.cycleDays.includes(day)} onChange={() => toggleDay(day)} /><span>{cycleLength === 7 ? WEEKDAYS[day - 1].slice(0, 3) : `Day ${day}`}</span></label>)}
          </div></fieldset>

          {mode !== 'reschedule' && <section className="task-change-action-fields" aria-labelledby="change-action-heading"><div><p className="app-eyebrow">ACCOUNTABILITY ACTION · REQUIRED</p><h3 id="change-action-heading">{mode === 'replace' ? 'Set the new Task’s action' : 'Update this Task’s action'}</h3></div>
            <label className="task-change-field" htmlFor="change-action-title">Action title <span>Required</span><input id="change-action-title" value={draft.actionTitle} maxLength={100} aria-invalid={attempted && !draft.actionTitle.trim()} onChange={(event) => update('actionTitle', event.target.value)} /></label>
            <label className="task-change-field" htmlFor="change-action-description">Action description <span>Required</span><textarea id="change-action-description" rows="2" maxLength={300} value={draft.actionDescription} aria-invalid={attempted && !draft.actionDescription.trim()} onChange={(event) => update('actionDescription', event.target.value)} /></label>
          </section>}

          {(attempted || counts.some((day) => !day.valid)) && <div className="task-change-validation" role="alert"><strong>Change needs attention</strong><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}{counts.filter((day) => !day.valid).map((day) => <li key={day.dayNumber}>Day {String(day.dayNumber).padStart(2, '0')} would have {day.count} Tasks; add {day.remaining} more before moving a Task from it.</li>)}</ul></div>}
          <p className="task-change-history-note"><AppIcon name="shield" />This update applies to future occurrences only. Existing proof, completed or submitted records, XP and Recovery Quests keep their original Task and Accountability Action details.</p>
          <footer><button type="button" className="task-change-button task-change-button--quiet" onClick={onClose}>Cancel</button><button type="submit" className="task-change-button task-change-button--primary" disabled={Boolean(issues.length)}>{mode === 'replace' ? 'Review replacement' : mode === 'reschedule' ? 'Review new schedule' : 'Review changes'}<span aria-hidden="true">→</span></button></footer>
        </form> : <div className="task-change-dialog__body">
          <div className="task-change-type"><span>CHANGE TYPE</span><strong>{CHANGE_LABELS[mode]}</strong></div>
          <div className="task-change-comparison"><div className="task-change-comparison__labels"><span>CURRENT</span><span>PROPOSED</span></div>{changes.map((change) => <div className="task-change-comparison__row" key={change.label}><strong>{change.label}</strong><div><span>{change.before}</span><span>{change.after}</span></div></div>)}</div>
          <div className="task-change-result"><p className="app-eyebrow">RESULTING DAILY TASK COUNTS</p><div>{counts.map((day) => <span className={day.valid ? '' : 'is-invalid'} key={day.dayNumber}>Day {String(day.dayNumber).padStart(2, '0')} <b>{day.count}/7+</b></span>)}</div></div>
          <div className="task-change-allowance-summary"><div><span>ALLOWANCE BEFORE</span><strong>{allowance.used} / {allowance.maximum} used · {allowance.remaining} remaining</strong></div><div><span>ALLOWANCE AFTER</span><strong>{allowance.used + 1} / {allowance.maximum} used · {allowance.remaining - 1} remaining</strong></div></div>
          <p className="task-change-confirm-copy">This change will use 1 of your {allowance.maximum} weekly task changes. It applies to future occurrences; the historical version remains unchanged.</p>
          {allowance.remaining < 1 && <p className="task-change-validation" role="alert">No weekly task changes remain. The allowance resets Monday.</p>}
          <footer><button type="button" className="task-change-button task-change-button--quiet" onClick={() => setPhase('edit')}>Back to edit</button><button type="button" className="task-change-button task-change-button--primary" onClick={finish} disabled={allowance.remaining < 1}>Confirm Change <span aria-hidden="true">✓</span></button><button type="button" className="task-change-button task-change-button--cancel" onClick={onClose}>Cancel</button></footer>
        </div>}
      </>}
    </dialog>
  );
}
