import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../../components/app/AppIcon.jsx';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
import { createCycleDays, getScheduleValidation, getScheduledTasksForDay } from '../../utils/taskScheduleBuilder.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import '../../styles/task-creation.css';

const STEPS = [
  { number: 1, label: 'Recurring cycle' },
  { number: 2, label: 'Schedule Tasks' },
  { number: 3, label: 'Accountability Actions' },
  { number: 4, label: 'Review schedule' },
];
const CYCLE_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

function getTodayInputValue() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${date.year}-${date.month}-${date.day}`;
}

function initialTaskDraft() {
  return { name: '', description: '', cycleDays: [], actionTitle: '', actionDescription: '', weakness: '' };
}

function StepHeader({ eyebrow, title, description }) {
  return <div className="task-builder-step-heading"><p className="app-eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>;
}

function CycleSetup({ cycleLength, setCycleLength, startDate, setStartDate, cycleDays }) {
  return (
    <section className="task-builder-panel" aria-labelledby="cycle-setup-title">
      <StepHeader eyebrow="STEP 01 · RECURRING CYCLE" title="Choose your rhythm" description="Select a repeating cycle for your daily schedule. You can place a Task on one or several days." />
      <fieldset className="task-cycle-options">
        <legend>Cycle length <span>Required</span></legend>
        <div className="task-cycle-options__grid">
          {CYCLE_OPTIONS.map((length) => (
            <button className={`task-cycle-option${cycleLength === length ? ' is-selected' : ''}`} type="button" key={length} aria-pressed={cycleLength === length} onClick={() => setCycleLength(length)}>
              <strong>{length}</strong><span>{length === 1 ? 'Day' : 'Days'}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {cycleLength && <div className="task-cycle-explainer" aria-live="polite">
        <div className="task-cycle-explainer__heading"><span className="task-builder-icon"><AppIcon name="analysis" /></span><div><p className="app-eyebrow">YOUR REPEATING CYCLE</p><strong>{cycleLength === 7 ? 'Calendar-aligned week' : `${cycleLength}-day repeating cycle`}</strong></div></div>
        <ol className="task-cycle-day-preview" aria-label={`${cycleLength}-day cycle preview`}>
          {cycleDays.map((day) => <li key={day.dayNumber}><span>{String(day.dayNumber).padStart(2, '0')}</span><strong>{day.label}</strong><small>{day.sublabel}</small></li>)}
        </ol>
        {cycleLength === 7 ? (
          <p className="task-builder-note">Day 1 is Monday and Day 7 is Sunday. A member who starts on Wednesday joins on Day 3.</p>
        ) : (
          <div className="task-start-date"><label htmlFor="cycle-start-date">Cycle start date <span>Day 1 begins on this date. The cycle repeats continuously.</span></label><input id="cycle-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></div>
        )}
      </div>}

      <aside className="task-builder-rules"><AppIcon name="clock" /><div><strong>Scheduling rules</strong><p>Daily deadline: <b>12:00 AM IST</b>. Three Task changes are available each Monday–Sunday week; edits, replacements and rescheduling count. Unused changes do not carry forward. Initial schedule setup does not use a weekly change.</p></div></aside>
    </section>
  );
}

function TaskScheduleEditor({ cycleLength, cycleDays, tasks, setTasks, draft, setDraft, editingId, setEditingId, activeDay, setActiveDay, attempted }) {
  const dayCounts = cycleDays.map((day) => ({ ...day, count: getScheduledTasksForDay(tasks, day.dayNumber).length }));
  const tasksForDay = getScheduledTasksForDay(tasks, activeDay);
  const assignmentError = attempted && draft.cycleDays.length === 0;
  const nameError = attempted && !draft.name.trim();

  const toggleDay = (dayNumber) => setDraft((current) => ({
    ...current,
    cycleDays: current.cycleDays.includes(dayNumber)
      ? current.cycleDays.filter((number) => number !== dayNumber)
      : [...current.cycleDays, dayNumber].sort((a, b) => a - b),
  }));

  const saveTask = (event) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.cycleDays.length) { setAttempted(true); return; }
    if (editingId) {
      setTasks((current) => current.map((task) => task.id === editingId ? { ...task, ...draft, name: draft.name.trim() } : task));
      setEditingId(null);
    } else {
      setTasks((current) => [...current, { ...draft, id: crypto.randomUUID(), name: draft.name.trim() }]);
    }
    setDraft(initialTaskDraft());
    setAttempted(false);
  };

  const editTask = (task) => {
    setDraft({ ...task, cycleDays: [...task.cycleDays] });
    setEditingId(task.id);
  };

  const cancelEdit = () => { setDraft(initialTaskDraft()); setEditingId(null); };

  return (
    <section className="task-builder-panel" aria-labelledby="task-editor-title">
      <StepHeader eyebrow="STEP 02 · DAILY TASK SCHEDULING" title="Build your schedule" description="Create each Task once, then assign it to as many cycle days as you need. Each selected day counts it once." />
      <div className="task-builder-layout">
        <form className="task-builder-form" onSubmit={saveTask} noValidate>
          <div className="task-builder-form__heading"><span className="task-builder-icon"><AppIcon name="tasks" /></span><div><p className="app-eyebrow">{editingId ? 'EDIT TASK' : 'NEW TASK'}</p><h3 id="task-editor-title">Task details</h3></div></div>
          <label className="task-builder-field" htmlFor="new-task-name">Task name <span>Required</span>
            <input id="new-task-name" type="text" value={draft.name} maxLength={100} aria-invalid={nameError} aria-describedby={nameError ? 'task-name-error' : undefined} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Name the work you plan to complete" />
            {nameError && <small className="task-builder-error" id="task-name-error">Enter a name for this Task.</small>}
          </label>
          <label className="task-builder-field" htmlFor="new-task-description">Description <span>Optional</span>
            <textarea id="new-task-description" rows="3" maxLength={300} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Add a useful explanation or completion detail" />
          </label>
          <fieldset className="task-day-assignment" aria-describedby={assignmentError ? 'task-day-error' : undefined}>
            <legend>Assign to cycle days <span>Choose one or more</span></legend>
            <div className="task-day-assignment__choices">
              {cycleDays.map((day) => <label className={draft.cycleDays.includes(day.dayNumber) ? 'is-selected' : ''} key={day.dayNumber}><input type="checkbox" checked={draft.cycleDays.includes(day.dayNumber)} onChange={() => toggleDay(day.dayNumber)} /><span>{cycleLength === 7 ? day.label.slice(0, 3) : `Day ${day.dayNumber}`}</span></label>)}
            </div>
            {assignmentError && <small className="task-builder-error" id="task-day-error">Assign this Task to at least one cycle day.</small>}
          </fieldset>
          <p className="task-builder-inline-note"><AppIcon name="recovery" />Each Task gets its own Accountability Action in the next step.</p>
          <div className="task-builder-form__actions"><button className="task-builder-button task-builder-button--primary" type="submit">{editingId ? 'Save Task details' : 'Add Task to schedule'}<span aria-hidden="true">↗</span></button>{editingId && <button className="task-builder-button task-builder-button--quiet" type="button" onClick={cancelEdit}>Cancel edit</button>}</div>
        </form>

        <div className="task-builder-schedule">
          <div className="task-builder-schedule__heading"><div><p className="app-eyebrow">DAY-BY-DAY SCHEDULE</p><h3>Scheduled Tasks</h3></div><span className="task-builder-total">{tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}</span></div>
          <div className="task-builder-day-tabs" role="tablist" aria-label="Choose a cycle day">
            {dayCounts.map((day) => <button role="tab" aria-selected={activeDay === day.dayNumber} className={activeDay === day.dayNumber ? 'is-active' : ''} key={day.dayNumber} type="button" onClick={() => setActiveDay(day.dayNumber)}><span>{cycleLength === 7 ? day.label.slice(0, 3) : `Day ${day.dayNumber}`}</span><small className={day.count >= 7 ? 'is-valid' : ''}>{day.count}/7+</small></button>)}
          </div>
          <div className={`task-builder-day-count${dayCounts[activeDay - 1]?.count >= 7 ? ' is-valid' : ' is-incomplete'}`}><strong>Day {String(activeDay).padStart(2, '0')} · {dayCounts[activeDay - 1]?.count} scheduled</strong><span>{dayCounts[activeDay - 1]?.count >= 7 ? 'Minimum met' : `${7 - dayCounts[activeDay - 1]?.count} more needed to reach 7`}</span></div>
          {tasksForDay.length ? <ul className="task-builder-task-list">{tasksForDay.map((task) => <li className="task-builder-task" key={task.id}>
            <div className="task-builder-task__copy"><strong>{task.name}</strong><p>{task.description || 'No description provided.'}</p><small>Assigned to {task.cycleDays.map((day) => `Day ${String(day).padStart(2, '0')}`).join(', ')}</small><small>{task.actionTitle ? `Accountability Action: ${task.actionTitle}` : 'Accountability Action pending'}</small>{task.actionDescription && <small>{task.actionDescription}</small>}</div>
            <div className="task-builder-task__controls"><button type="button" aria-label={`Edit ${task.name}`} onClick={() => editTask(task)}>Edit</button><button type="button" aria-label={`Remove ${task.name}`} onClick={() => { setTasks((current) => current.filter((item) => item.id !== task.id)); if (editingId === task.id) cancelEdit(); }}>Remove</button></div>
          </li>)}</ul> : <div className="task-builder-empty"><span aria-hidden="true">＋</span><p>No Tasks assigned to this day yet.</p><small>Use the form to add a new Task and select this day.</small></div>}
          <p className="task-builder-footnote">Every cycle day needs at least 7 scheduled Tasks. There is no maximum.</p>
        </div>
      </div>
    </section>
  );
}

function AccountabilityActions({ tasks, setTasks, activeActionId, setActiveActionId, attempted }) {
  const activeTask = tasks.find((task) => task.id === activeActionId) || tasks[0];
  const actionIncomplete = (task) => !task.actionTitle.trim() || !task.actionDescription.trim();

  const updateAction = (key, value) => {
    if (!activeTask) return;
    setTasks((current) => current.map((task) => task.id === activeTask.id ? { ...task, [key]: value } : task));
  };

  return (
    <section className="task-builder-panel" aria-labelledby="action-step-title">
      <StepHeader eyebrow="STEP 03 · ACCOUNTABILITY ACTIONS" title="Give every Task its own action" description="Choose an action that helps address a weakness, habit or behaviour related to that specific Task. Actions are never assigned automatically." />
      {!tasks.length ? <div className="task-builder-empty task-builder-empty--wide"><p>Add Tasks in the previous step before configuring their Accountability Actions.</p></div> : <div className="task-action-builder">
        <div className="task-action-picker" aria-label="Tasks needing Accountability Actions">
          <p className="app-eyebrow">YOUR TASKS · {tasks.length}</p>
          {tasks.map((task) => <button type="button" key={task.id} className={`task-action-picker__item${activeTask?.id === task.id ? ' is-active' : ''}`} aria-current={activeTask?.id === task.id ? 'step' : undefined} onClick={() => setActiveActionId(task.id)}>
            <span className={`task-action-picker__status${actionIncomplete(task) ? ' is-pending' : ' is-complete'}`} aria-label={actionIncomplete(task) ? 'Action needed' : 'Action configured'}>{actionIncomplete(task) ? '!' : '✓'}</span><span><strong>{task.name}</strong><small>{actionIncomplete(task) ? 'Action needed' : 'Action ready'}</small></span><span aria-hidden="true">→</span>
          </button>)}
        </div>
        {activeTask && <div className="task-action-editor">
          <div className="task-action-editor__task"><p className="app-eyebrow">ACTION BELONGS TO</p><h3>{activeTask.name}</h3><p>{activeTask.description || 'No Task description provided.'}</p><small>Assigned to {activeTask.cycleDays.map((day) => `Day ${String(day).padStart(2, '0')}`).join(', ') || 'no cycle days'}</small></div>
          <div className="task-action-editor__fields">
            <label className="task-builder-field" htmlFor="accountability-action-title">Accountability Action title <span>Required</span><input id="accountability-action-title" value={activeTask.actionTitle} maxLength={100} aria-invalid={attempted && !activeTask.actionTitle.trim()} onChange={(event) => updateAction('actionTitle', event.target.value)} placeholder="Name the action you will take" />{attempted && !activeTask.actionTitle.trim() && <small className="task-builder-error">Add an action title for this Task.</small>}</label>
            <label className="task-builder-field" htmlFor="accountability-action-description">Action description <span>Required</span><textarea id="accountability-action-description" rows="3" value={activeTask.actionDescription} maxLength={300} aria-invalid={attempted && !activeTask.actionDescription.trim()} onChange={(event) => updateAction('actionDescription', event.target.value)} placeholder="Describe what the action involves" />{attempted && !activeTask.actionDescription.trim() && <small className="task-builder-error">Describe the Accountability Action for this Task.</small>}</label>
            <label className="task-builder-field" htmlFor="accountability-action-weakness">What are you working to improve? <span>Optional</span><textarea id="accountability-action-weakness" rows="2" value={activeTask.weakness} maxLength={240} onChange={(event) => updateAction('weakness', event.target.value)} placeholder="A habit, behaviour or specific weakness" /></label>
          </div>
          <div className="task-action-preview"><p className="app-eyebrow">TASK + ACTION PREVIEW</p><strong>{activeTask.name}</strong><span>{activeTask.actionTitle || 'Action title will appear here'}</span><p>{activeTask.actionDescription || 'Add an action description to complete this Task.'}</p></div>
        </div>}
      </div>}
      <aside className="task-builder-rules task-builder-rules--recovery"><AppIcon name="recovery" /><div><strong>How the Accountability Action is used</strong><p>If the original Task is missed, its own Accountability Action activates as a Recovery Quest. It carries forward during a three-day Recovery Window. If incomplete when it expires, one Grace Point is deducted. Generating a sixth Active Recovery Quest deducts one Grace Point and clears the active group. This explains the rules only—the builder does not activate Quests or deduct points.</p></div></aside>
    </section>
  );
}

function ScheduleReview({ cycleLength, cycleDays, tasks, validation, attempted, onEditCycle, onEditTasks, onEditActions }) {
  return (
    <section className="task-builder-panel" aria-labelledby="schedule-review-title">
      <StepHeader eyebrow="STEP 04 · FINAL REVIEW" title="Review your schedule" description="Check every cycle day and the Accountability Action connected to each Task before confirming." />
      <div className="task-review-summary"><div><p className="app-eyebrow">CYCLE COVERAGE</p><strong>{cycleLength || '—'} {cycleLength === 1 ? 'Day' : 'Days'}</strong></div><span>{validation.dayCounts.filter((day) => day.valid).length} of {validation.dayCounts.length} days meet the 7-Task minimum</span></div>
      {attempted && !validation.valid && <div className="task-builder-validation" role="alert"><AppIcon name="shield" /><div><strong>Schedule needs attention</strong><ul>{validation.issues.slice(0, 12).map((issue, index) => <li key={`${issue.type}-${index}`}>{issue.message}</li>)}</ul></div></div>}
      <div className="task-review-days">{cycleDays.map((day) => {
        const dayTasks = getScheduledTasksForDay(tasks, day.dayNumber);
        const isValid = dayTasks.length >= 7;
        return <article className={`task-review-day${isValid ? ' is-valid' : ' is-incomplete'}`} key={day.dayNumber}>
          <header><div><p className="app-eyebrow">CYCLE DAY {String(day.dayNumber).padStart(2, '0')}</p><h3>{day.label}</h3><small>{day.sublabel}</small></div><span className={isValid ? 'is-valid' : 'is-incomplete'}>{dayTasks.length} Tasks · {isValid ? 'Valid' : `${7 - dayTasks.length} more needed`}</span></header>
          {dayTasks.length ? <ul>{dayTasks.map((task) => <li key={task.id}><div><strong>{task.name}</strong><p>{task.description || 'No description provided.'}</p></div><aside><span>ACCOUNTABILITY ACTION</span><strong>{task.actionTitle || 'Not configured'}</strong><p>{task.actionDescription || 'Action description required.'}</p></aside></li>)}</ul> : <p className="task-review-empty">No Tasks assigned to this day yet.</p>}
        </article>;
      })}</div>
      <div className="task-review-edit-links"><button type="button" onClick={onEditCycle}>Edit cycle</button><button type="button" onClick={onEditTasks}>Edit Tasks</button><button type="button" onClick={onEditActions}>Edit Accountability Actions</button></div>
      <p className="task-builder-preview-disclosure">Frontend preview only. Confirming updates this browser session’s Daily Tasks view; this schedule is not saved to an account or database.</p>
    </section>
  );
}

export default function CreateTaskSchedulePage() {
  const { currentSchedule, setCurrentSchedule } = useTaskSchedule();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(1);
  const [cycleLength, setCycleLength] = useState(null);
  const [startDate, setStartDate] = useState(getTodayInputValue);
  const [tasks, setTasks] = useState([]);
  const [draft, setDraft] = useState(initialTaskDraft);
  const [editingId, setEditingId] = useState(null);
  const [activeDay, setActiveDay] = useState(1);
  const [activeActionId, setActiveActionId] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const [success, setSuccess] = useState(false);
  const cycleDays = useMemo(() => cycleLength ? createCycleDays(cycleLength, startDate) : [], [cycleLength, startDate]);
  const validation = useMemo(() => getScheduleValidation(cycleLength, startDate, tasks), [cycleLength, startDate, tasks]);

  if (currentSchedule?.source === 'created') return (
    <div className="task-creation-page">
      <section className="task-builder-success" aria-labelledby="schedule-exists-title">
        <p className="app-eyebrow">SCHEDULE ALREADY ACTIVE</p><h1 id="schedule-exists-title">Manage Tasks individually.</h1>
        <p>To preserve the weekly Task change allowance, update one future Task at a time from Daily Tasks. Existing historical records remain protected.</p>
        <Link className="task-builder-button task-builder-button--primary" to="/app/tasks">Return to Daily Tasks <span aria-hidden="true">↗</span></Link>
      </section>
    </div>
  );

  const selectCycleLength = (length) => {
    setCycleLength(length);
    setActiveDay((day) => Math.min(day, length));
    setTasks((current) => current.map((task) => ({ ...task, cycleDays: task.cycleDays.filter((day) => day <= length) })));
  };
  const continueFromCycle = () => { if (!cycleLength || (cycleLength < 7 && !startDate)) { setAttempted(true); return; } setAttempted(false); setStep(2); };
  const continueToActions = () => { setAttempted(true); setEditingId(null); setDraft(initialTaskDraft()); setActiveActionId(tasks[0]?.id || null); setStep(3); };
  const continueToReview = () => { setAttempted(true); setStep(4); };
  const confirmSchedule = () => {
    setAttempted(true);
    if (!validation.valid) return;
    setCurrentSchedule({ cycleLength, startDate: cycleLength === 7 ? '' : startDate, source: 'created', tasks: tasks.map((task) => ({ ...task, cycleDays: [...task.cycleDays] })), taskHistory: currentSchedule?.taskHistory || [], occurrences: currentSchedule?.occurrences || {}, confirmedAt: new Date().toISOString() });
    setSuccess(true);
  };

  if (success) return (
    <div className="task-creation-page">
      <section className="task-builder-success" role="status" aria-live="polite">
        <span className="task-builder-success__mark" aria-hidden="true">✓</span><p className="app-eyebrow">SCHEDULE READY · FRONTEND PREVIEW</p><h1>Your Daily Schedule is set.</h1><p>The schedule is available in this application session. It has not been sent to a server or permanently saved.</p><Link className="task-builder-button task-builder-button--primary" to="/app/tasks">View Daily Tasks <span aria-hidden="true">↗</span></Link>
      </section>
    </div>
  );

  return (
    <div className={`task-creation-page${reducedMotion ? ' is-reduced-motion' : ''}`}>
      <header className="task-creation-header"><div><p className="app-eyebrow">MY PROGRESS · SCHEDULE BUILDER</p><h1>Create your Daily Schedule</h1><p>Set a repeating cycle, build its Tasks and choose a personal Accountability Action for each one.</p></div><span className="app-demo-label"><i aria-hidden="true" />FRONTEND PREVIEW</span></header>

      <nav className="task-builder-progress" aria-label="Schedule creation progress">
        {STEPS.map((item, index) => <div className={`task-builder-progress__step${step === item.number ? ' is-current' : ''}${step > item.number ? ' is-complete' : ''}`} key={item.number} aria-current={step === item.number ? 'step' : undefined}><span>{step > item.number ? '✓' : String(item.number).padStart(2, '0')}</span><strong>{item.label}</strong>{index < STEPS.length - 1 && <i aria-hidden="true" />}</div>)}
      </nav>

      {step === 1 && <CycleSetup cycleLength={cycleLength} setCycleLength={selectCycleLength} startDate={startDate} setStartDate={setStartDate} cycleDays={cycleDays} />}
      {step === 2 && <TaskScheduleEditor cycleLength={cycleLength} cycleDays={cycleDays} tasks={tasks} setTasks={setTasks} draft={draft} setDraft={setDraft} editingId={editingId} setEditingId={setEditingId} activeDay={activeDay} setActiveDay={setActiveDay} attempted={attempted} />}
      {step === 3 && <AccountabilityActions tasks={tasks} setTasks={setTasks} activeActionId={activeActionId} setActiveActionId={setActiveActionId} attempted={attempted} />}
      {step === 4 && <ScheduleReview cycleLength={cycleLength} cycleDays={cycleDays} tasks={tasks} validation={validation} attempted={attempted} onEditCycle={() => setStep(1)} onEditTasks={() => setStep(2)} onEditActions={() => setStep(3)} />}

      <div className="task-builder-footer-nav">
        {step === 1 ? <Link className="task-builder-back-link" to="/app/tasks">Cancel and return to Tasks</Link> : <button className="task-builder-button task-builder-button--quiet" type="button" onClick={() => { setAttempted(false); setStep((current) => current - 1); }}>Back</button>}
        {step === 1 && <button className="task-builder-button task-builder-button--primary" type="button" onClick={continueFromCycle} disabled={!cycleLength || (cycleLength < 7 && !startDate)}>Continue to Tasks <span aria-hidden="true">→</span></button>}
        {step === 2 && <button className="task-builder-button task-builder-button--primary" type="button" onClick={continueToActions}>Continue to Accountability Actions <span aria-hidden="true">→</span></button>}
        {step === 3 && <button className="task-builder-button task-builder-button--primary" type="button" onClick={continueToReview}>Review schedule <span aria-hidden="true">→</span></button>}
        {step === 4 && <button className="task-builder-button task-builder-button--primary" type="button" onClick={confirmSchedule} disabled={!validation.valid}>Confirm Daily Schedule <span aria-hidden="true">✓</span></button>}
      </div>
      {step === 4 && !validation.valid && <p className="task-builder-confirm-hint">Complete all required fields and bring every cycle day to at least 7 Tasks to enable confirmation.</p>}
      <p className="task-builder-disclosure"><AppIcon name="activity" />Changes remain in this frontend session only. A page refresh restores the demonstration schedule.</p>
    </div>
  );
}
