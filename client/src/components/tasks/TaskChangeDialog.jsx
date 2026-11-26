import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../app/AppIcon.jsx';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LABELS = { edit: 'Edit Task', reschedule: 'Reschedule Task', delete: 'Delete Task' };
const labelForDay = (day, cycleLength) => cycleLength === 7 ? WEEKDAYS[day - 1] : 'Day ' + String(day).padStart(2, '0');

function taskFields(task) {
  const action = task.accountabilityAction || {};
  return {
    id: task.id,
    name: task.name || task.title || '',
    description: task.description || '',
    cycleDays: [...(task.cycleDays || [])],
    actionTitle: task.actionTitle || action.title || (typeof task.accountabilityAction === 'string' ? task.accountabilityAction : ''),
    actionDescription: task.actionDescription || action.description || task.accountabilityActionDescription || '',
  };
}

function dayCounts(tasks, task, assignedDays, cycleLength, deleting) {
  return Array.from({ length: cycleLength }, (_, index) => {
    const dayNumber = index + 1;
    const count = tasks.filter((item) => item.status === 'active' && item.cycleDays.includes(dayNumber)).length
      - Number(task.cycleDays.includes(dayNumber))
      + Number(!deleting && assignedDays.includes(dayNumber));
    return { dayNumber, count, valid: count >= 7 };
  });
}

export default function TaskChangeDialog({ task, mode, cycleLength, tasks = [], allowance = { used: 0, maximum: 0, remaining: 0 }, onConfirm, onClose, saving = false, error = '' }) {
  const dialogRef = useRef(null);
  const submitLockRef = useRef(false);
  const [phase, setPhase] = useState('edit');
  const [draft, setDraft] = useState(() => task ? { ...taskFields(task) } : null);
  const [attempted, setAttempted] = useState(false);
  const isOpen = Boolean(task && mode);
  const current = useMemo(() => task ? taskFields(task) : null, [task]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      setDraft({ ...taskFields(task) });
      setPhase('edit');
      setAttempted(false);
      submitLockRef.current = false;
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) dialog.close();
  }, [task?.id, mode, isOpen]);

  const assignedDays = mode === 'reschedule' ? (draft?.cycleDays || []) : (current?.cycleDays || []);
  const counts = useMemo(() => task && draft ? dayCounts(tasks, current, assignedDays, cycleLength, mode === 'delete') : [], [tasks, task, current, assignedDays, cycleLength, mode, draft]);
  const canModify = allowance.remaining > 0;
  const issues = [];
  if (draft && mode === 'edit') {
    if (!draft.name.trim()) issues.push('Task name is required.');
    if (!draft.actionTitle.trim()) issues.push('A Forfeit title is required.');
    if (!draft.actionDescription.trim()) issues.push('A Forfeit description is required.');
    if (draft.name === current.name && draft.description === current.description && draft.actionTitle === current.actionTitle && draft.actionDescription === current.actionDescription) issues.push('Make at least one change before continuing.');
  }
  if (draft && mode === 'reschedule') {
    if (!draft.cycleDays.length) issues.push('Assign this Task to at least one cycle day.');
    if (JSON.stringify([...draft.cycleDays].sort()) === JSON.stringify([...current.cycleDays].sort())) issues.push('Choose at least one different cycle day.');
    if (counts.some((day) => !day.valid)) issues.push('Every cycle day must retain at least seven active Tasks.');
  }
  if (draft && mode === 'delete' && counts.some((day) => !day.valid)) issues.push('Deleting this Task would leave a cycle day below seven active Tasks.');

  const update = (field, value) => setDraft((valueNow) => ({ ...valueNow, [field]: value }));
  const toggleDay = (dayNumber) => setDraft((valueNow) => ({
    ...valueNow,
    cycleDays: valueNow.cycleDays.includes(dayNumber)
      ? valueNow.cycleDays.filter((day) => day !== dayNumber)
      : [...valueNow.cycleDays, dayNumber].sort((a, b) => a - b),
  }));
  const continueToReview = (event) => {
    event.preventDefault();
    setAttempted(true);
    if (issues.length || !canModify) return;
    setPhase('confirm');
  };
  const finish = async () => {
    if (!task || issues.length || !canModify || submitLockRef.current || saving) return;
    submitLockRef.current = true;
    setAttempted(true);
    try {
      await onConfirm({ taskId: task.id, mode, draft });
    } finally {
      submitLockRef.current = false;
    }
  };

  return (
    <dialog className="task-change-dialog" ref={dialogRef} aria-labelledby="task-change-title" onClose={onClose} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      {isOpen && draft && <>
        <div className="task-change-dialog__header">
          <div><p className="app-eyebrow">FUTURE SCHEDULE · {LABELS[mode].toUpperCase()}</p><h2 id="task-change-title">{phase === 'confirm' && mode !== 'delete' ? 'Confirm Task change?' : mode === 'delete' ? 'Delete this Task?' : LABELS[mode]}</h2><p>{mode === 'delete' ? 'Remove “' + current.name + '” from future scheduling.' : 'Update “' + current.name + '” for future occurrences.'}</p></div>
          <button type="button" className="task-change-dialog__close" aria-label="Close task change dialog" onClick={onClose}><AppIcon name="close" /></button>
        </div>

        {mode === 'delete' ? <div className="task-change-dialog__body">
          <div className="task-change-dialog__replacing"><span>TASK TO DELETE</span><strong>{current.name}</strong></div>
          <aside className="task-change-delete-notice" role="note"><strong>DELETE TASK NOTICE</strong><p>This Task will be removed from future scheduling. If it is already scheduled today, it will remain available to complete today. Today's Task count and XP calculation will remain unchanged. This action consumes one weekly Task change.</p><small>Deletion stays pending until the next scheduled occurrence for {current.cycleDays.map((day) => labelForDay(day, cycleLength)).join(', ')}.</small></aside>
          <div className="task-change-allowance-summary"><div><span>ALLOWANCE BEFORE</span><strong>{allowance.used} / {allowance.maximum} used · {allowance.remaining} remaining</strong></div><div><span>ALLOWANCE AFTER</span><strong>{allowance.used + 1} / {allowance.maximum} used · {Math.max(0, allowance.remaining - 1)} remaining</strong></div></div>
          {issues.length > 0 && <div className="task-change-validation" role="alert"><strong>Task cannot be deleted</strong><ul>{counts.filter((day) => !day.valid).map((day) => <li key={day.dayNumber}>Cycle Day {String(day.dayNumber).padStart(2, '0')} would have {day.count} active Tasks; at least 7 are required.</li>)}</ul></div>}
          {!canModify && <p className="task-change-validation" role="alert">No weekly Task changes remain. The allowance resets Monday in IST.</p>}
          {error && <p className="task-change-validation" role="alert">{error}</p>}
          <footer><button type="button" className="task-change-button task-change-button--quiet" onClick={onClose}>Cancel</button><button type="button" className="task-change-button task-change-button--primary task-change-button--destructive" onClick={finish} disabled={!canModify || issues.length > 0 || saving}>{saving ? 'Deleting…' : 'Delete Task'} <span aria-hidden="true">✓</span></button></footer>
        </div> : phase === 'edit' ? <form className="task-change-dialog__body" onSubmit={continueToReview} noValidate>
          {mode === 'edit' && <>
            <label className="task-change-field" htmlFor="change-task-name">Task name <span>Required</span><input id="change-task-name" value={draft.name} maxLength={100} aria-invalid={attempted && !draft.name.trim()} onChange={(event) => update('name', event.target.value)} /></label>
            <label className="task-change-field" htmlFor="change-task-description">Description <span>Optional</span><textarea id="change-task-description" rows="2" maxLength={300} value={draft.description} onChange={(event) => update('description', event.target.value)} /></label>
            <section className="task-change-action-fields" aria-labelledby="change-action-heading"><div><p className="app-eyebrow">FORFEIT · REQUIRED</p><h3 id="change-action-heading">Update this Task’s action</h3></div>
              <label className="task-change-field" htmlFor="change-action-title">Action title <span>Required</span><input id="change-action-title" value={draft.actionTitle} maxLength={100} aria-invalid={attempted && !draft.actionTitle.trim()} onChange={(event) => update('actionTitle', event.target.value)} /></label>
              <label className="task-change-field" htmlFor="change-action-description">Action description <span>Required</span><textarea id="change-action-description" rows="2" maxLength={300} value={draft.actionDescription} aria-invalid={attempted && !draft.actionDescription.trim()} onChange={(event) => update('actionDescription', event.target.value)} /></label>
            </section>
          </>}
          {mode === 'reschedule' && <fieldset className="task-change-days"><legend>Choose the new cycle-day assignments <span>Choose one or more</span></legend><div>
            {Array.from({ length: cycleLength }, (_, index) => index + 1).map((day) => <label className={draft.cycleDays.includes(day) ? 'is-selected' : ''} key={day}><input type="checkbox" checked={draft.cycleDays.includes(day)} onChange={() => toggleDay(day)} /><span>{cycleLength === 7 ? WEEKDAYS[day - 1].slice(0, 3) : 'Day ' + day}</span></label>)}
          </div></fieldset>}
          {(attempted && issues.length > 0 || counts.some((day) => !day.valid)) && <div className="task-change-validation" role="alert"><strong>Change needs attention</strong><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}{counts.filter((day) => !day.valid).map((day) => <li key={day.dayNumber}>Cycle Day {String(day.dayNumber).padStart(2, '0')} would have {day.count} Tasks; at least 7 are required.</li>)}</ul></div>}
          {!canModify && <p className="task-change-validation" role="alert">No weekly Task changes remain. The allowance resets Monday in IST.</p>}
          {error && <p className="task-change-validation" role="alert">{error}</p>}
          <p className="task-change-history-note"><AppIcon name="shield" />This update applies from the next IST date. Existing and current-day occurrence snapshots keep their original Task and Forfeit details.</p>
          <footer><button type="button" className="task-change-button task-change-button--quiet" onClick={onClose}>Cancel</button><button type="submit" className="task-change-button task-change-button--primary" disabled={Boolean(issues.length) || !canModify}>{mode === 'reschedule' ? 'Review new schedule' : 'Review changes'}<span aria-hidden="true">→</span></button></footer>
        </form> : <div className="task-change-dialog__body">
          <div className="task-change-type"><span>CHANGE TYPE</span><strong>{LABELS[mode]}</strong></div>
          {mode === 'edit' ? <div className="task-change-comparison"><div className="task-change-comparison__labels"><span>CURRENT</span><span>PROPOSED</span></div>
            {[['Task name', current.name, draft.name], ['Description', current.description || 'Not provided', draft.description || 'Not provided'], ['Forfeit title', current.actionTitle, draft.actionTitle], ['Forfeit description', current.actionDescription, draft.actionDescription]].map(([label, before, after]) => <div className="task-change-comparison__row" key={label}><strong>{label}</strong><div><span>{before || 'Not provided'}</span><span>{after || 'Not provided'}</span></div></div>)}
          </div> : <div className="task-change-comparison"><div className="task-change-comparison__labels"><span>CURRENT CYCLE DAYS</span><span>NEW CYCLE DAYS</span></div><div className="task-change-comparison__row"><strong>Schedule</strong><div><span>{current.cycleDays.map((day) => labelForDay(day, cycleLength)).join(', ')}</span><span>{draft.cycleDays.map((day) => labelForDay(day, cycleLength)).join(', ')}</span></div></div></div>}
          <div className="task-change-result"><p className="app-eyebrow">RESULTING DAILY TASK COUNTS</p><div>{counts.map((day) => <span className={day.valid ? '' : 'is-invalid'} key={day.dayNumber}>Day {String(day.dayNumber).padStart(2, '0')} <b>{day.count}/7+</b></span>)}</div></div>
          <div className="task-change-allowance-summary"><div><span>ALLOWANCE BEFORE</span><strong>{allowance.used} / {allowance.maximum} used · {allowance.remaining} remaining</strong></div><div><span>ALLOWANCE AFTER</span><strong>{allowance.used + 1} / {allowance.maximum} used · {Math.max(0, allowance.remaining - 1)} remaining</strong></div></div>
          <p className="task-change-confirm-copy">This change uses one weekly change for this Task. It applies to future occurrences; historical and current-day snapshots remain unchanged.</p>
          {!canModify && <p className="task-change-validation" role="alert">No weekly Task changes remain. The allowance resets Monday in IST.</p>}
          {error && <p className="task-change-validation" role="alert">{error}</p>}
          <footer><button type="button" className="task-change-button task-change-button--quiet" onClick={() => setPhase('edit')}>Back to edit</button><button type="button" className="task-change-button task-change-button--primary" onClick={finish} disabled={!canModify || issues.length > 0 || saving}>{saving ? 'Saving…' : 'Confirm Change'} <span aria-hidden="true">✓</span></button></footer>
        </div>}
      </>}
    </dialog>
  );
}
