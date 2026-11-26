import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AppIcon from '../../components/app/AppIcon.jsx';
import PageLoadingSkeleton from '../../components/app/PageLoadingSkeleton.jsx';
import TaskActionMenu from '../../components/tasks/TaskActionMenu.jsx';
import TaskChangeDialog from '../../components/tasks/TaskChangeDialog.jsx';
import QuickStartScheduleBuilder from '../../components/tasks/QuickStartScheduleBuilder.jsx';
import { useTaskBackend } from '../../context/TaskBackendContext.jsx';
import { useFlashMessages } from '../../context/FlashMessageContext.jsx';
import { createIdempotencyKey, taskApi } from '../../services/taskApi.js';
import { createCycleDays, formatTaskDateKey, getScheduleValidation, getScheduledTasksForDay } from '../../utils/taskScheduleBuilder.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import '../../styles/task-creation.css';

const STEPS = [
  { number: 1, label: 'Tutorial' },
  { number: 2, label: 'Rules' },
  { number: 3, label: 'Choose cycle' },
  { number: 4, label: 'Daily Tasks' },
  { number: 5, label: 'Punishments' },
  { number: 6, label: 'Review & start' },
];
const CYCLE_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

function initialTaskDraft() {
  return { name: '', description: '', cycleDays: [], actionTitle: '', actionDescription: '', weakness: '' };
}

function StepHeader({ eyebrow, title, description }) {
  return <div className="task-builder-step-heading"><p className="app-eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>;
}

function CycleSetup({ cycleLength, setCycleLength, startDate, setStartDate, cycleDays }) {
  return (
    <div className="task-builder-cycle" aria-labelledby="cycle-setup-title">
      <div className="task-builder-schedule__heading"><div><p className="app-eyebrow">CYCLE SETUP</p><h3 id="cycle-setup-title">Choose your repeating cycle</h3></div></div>
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

    </div>
  );
}

function TutorialStep() {
  const flow = [
    'Choose your cycle',
    'Add at least 7 Tasks to every day',
    'Choose a Forfeit for each Task',
    'Follow your schedule',
    'Complete normal Tasks and earn XP',
    'Build your Rank and unlock rewards',
  ];

  return <section className="task-builder-panel task-builder-tutorial" aria-labelledby="schedule-tutorial-title">
    <StepHeader eyebrow="STEP 01 · HOW THE SYSTEM WORKS" title="Welcome to THE SYSTEM" description="A simple guide before you create your schedule." />
    <p className="task-builder-tutorial__intro">THE SYSTEM helps you plan your work, complete daily Tasks and improve over time. Create a schedule, follow it every day and build your progress.</p>
    <ol className="task-builder-tutorial__flow" aria-label="How progress works">
      {flow.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item}</strong></li>)}
    </ol>
    <div className="task-builder-tutorial__facts">
      <article><strong>Every day needs 7 Tasks</strong><p>A 1-day cycle needs at least 7 Tasks. A 7-day cycle needs at least 49.</p></article>
      <article><strong>Missed Tasks have consequences</strong><p>The linked Forfeit becomes active the next day and has a 72-hour window.</p></article>
      <article><strong>Build progress honestly</strong><p>Normal completed Tasks can earn XP. Forfeits do not earn XP. Your actual Rank and account settings control rewards.</p></article>
    </div>
  </section>;
}

function RulesStep({ allowance, allowanceLoaded, emergencyPause, gracePoints, disciplineSummary }) {
  const loaded = allowanceLoaded && Number.isFinite(Number(allowance?.maximum)) && Number.isFinite(Number(allowance?.remaining));
  const pauseLoaded = Number.isFinite(Number(emergencyPause?.allowance)) && Number.isFinite(Number(emergencyPause?.activationsRemaining));
  const graceBalance = gracePoints?.balance ?? disciplineSummary?.gracePointBalance;
  const dpBalance = disciplineSummary?.dpBalance;
  const [rankConfiguration, setRankConfiguration] = useState(null);

  useEffect(() => {
    let active = true;
    taskApi.rankConfiguration().then((configuration) => {
      if (active) setRankConfiguration(configuration);
    }).catch(() => {
      if (active) setRankConfiguration({ unavailable: true });
    });
    return () => { active = false; };
  }, []);

  return <section className="task-builder-panel task-builder-rules-step" aria-labelledby="schedule-rules-title">
    <StepHeader eyebrow="STEP 02 · UNDERSTAND ALL RULES" title="Important rules" description="See how your schedule and progress work." />
    <div className="task-builder-rule-grid task-builder-rule-grid--eight">
      <article className="task-builder-rule-card"><p className="app-eyebrow">01 · TASK MANAGER</p><strong>Changes happen in the future</strong><p>New Tasks start on their next matching cycle day after today. Editing, rescheduling or deleting an existing Task takes effect from the next IST calendar day. Past completed records stay in history.</p><Link to="/app/tasks">Open Task Manager <span aria-hidden="true">↗</span></Link></article>
      <article className="task-builder-rule-card"><p className="app-eyebrow">02 · TASK CHANGE CHANCES</p><strong>{loaded ? `${allowance.remaining} of ${allowance.maximum} left` : 'Checking your allowance…'}</strong><p>{loaded ? `${allowance.used} used this week. Adding a Task is free; editing, deleting and rescheduling share these ${allowance.maximum} chances.` : 'One shared weekly limit applies.'} It renews Monday at 12:00 AM IST. Canceling without saving does not use a chance.</p></article>
      <article className="task-builder-rule-card task-builder-rule-card--featured"><p className="app-eyebrow">03 · MISSED TASKS</p><strong>Next day · 72 hours</strong><p>A missed Task creates its linked Forfeit at the next daily IST reset. You have 72 hours from activation to finish it. Emergency Pause freezes the countdown.</p><p>The actual overload limit is 6 active Forfeits at once—not 3. When the sixth appears, the active group is cleared and 1 Grace Point is deducted. Cleared records stay in your history.</p></article>
      <article className="task-builder-rule-card"><p className="app-eyebrow">04 · GRACE POINTS</p><strong>{graceBalance === undefined || graceBalance === null ? 'Checking your balance…' : `${graceBalance} available`}</strong><p>One point is deducted when a Forfeit expires or the sixth active one triggers the overload rule. At zero, the current Progression Run ends and a fresh run starts at Rank 07, Level 0, 0 XP, 3 Grace Points and 0 DP. Its schedule is archived; your account, Task history, lifetime records and reset count remain.</p></article>
      <article className="task-builder-rule-card"><p className="app-eyebrow">05 · DP POINTS</p><strong>{dpBalance === undefined || dpBalance === null ? 'Checking your balance…' : `${Number(dpBalance).toFixed(2)} DP · 4.00 cap`}</strong><p>A day qualifies for Discipline progress after 5 original Tasks are completed. The qualifying cycle and DP reward depend on Rank. You can exchange 1.00 DP for 1 Grace Point; each exchange has a 72-hour cooldown.</p><Link to="/app/discipline">See your Discipline progress <span aria-hidden="true">↗</span></Link></article>
      <article className="task-builder-rule-card"><p className="app-eyebrow">06 · SEVEN RANKS</p><strong>Rank 07 starts · Rank 01 is highest</strong><p>Each Rank has its own entry rewards, XP multiplier, daily cap and recurring DP reward. Rank 01 has no entry XP reward. Badges follow your current Rank.</p><Link to="/ranks">View Rank information <span aria-hidden="true">↗</span></Link>
        {rankConfiguration?.ranks?.length > 0 ? <div className="task-builder-rank-table-wrap"><table className="task-builder-rank-table"><caption>Current Rank rewards</caption><thead><tr><th>Rank</th><th>Entry XP</th><th>Entry DP</th><th>Cycle DP</th></tr></thead><tbody>{rankConfiguration.ranks.map((rank) => <tr key={rank.slug}><th scope="row">{rank.number} · {rank.name}</th><td>{rank.entryXpConfigured ? `${Number(rank.entryXp).toLocaleString()} XP` : 'Not available'}</td><td>{Number(rank.entryDp).toFixed(2)}</td><td>{rank.recurringDpPreview.qualifyingDays} days · {Number(rank.recurringDpPreview.rewardDp).toFixed(2)}</td></tr>)}</tbody></table></div> : rankConfiguration?.unavailable && <p>Rank values could not be loaded right now. Use the Rank information page to review them.</p>}
      </article>
      <article className="task-builder-rule-card"><p className="app-eyebrow">07 · EARN XP</p><strong>Normal completed Tasks only</strong><p>THE SYSTEM shares a 300 XP daily base pool across that day’s scheduled Tasks, then applies your Rank multiplier and daily XP cap. The exact amount per Task varies with that day’s schedule. Forfeits give no XP.</p><p>Unfinished active Forfeits can drain XP at daily reset: 7% of the current Level requirement per active one. This is separate from Task completion rewards.</p></article>
      <article className="task-builder-rule-card task-builder-rule-card--featured"><p className="app-eyebrow">08 · EMERGENCY PAUSE</p><strong>{pauseLoaded ? `${emergencyPause.activationsRemaining} of ${emergencyPause.allowance} uses left` : 'Checking your allowance…'}</strong><p>{pauseLoaded ? `You can use Emergency Pause ${emergencyPause.allowance} times per IST calendar month` : 'Emergency Pause has a monthly use limit'}; it renews when the IST month changes. You can choose 1–7 days. Ending early still uses that activation.</p><p>Activating Pause has no separate XP fee. While active, missed-Task processing and daily XP drain are suspended, Forfeit time is frozen, and your Discipline streak is protected. A Pause that reaches a new month ends at 12:00 AM IST on its first day.</p></article>
    </div>
  </section>;
}

function TaskDetailsStep({ tasks, setTasks, draft, setDraft, editingId, setEditingId, attempted, setAttempted, compact = false }) {
  const submitLockRef = useRef(false);
  const nameError = attempted && !draft.name.trim();

  const saveTask = (event) => {
    event.preventDefault();
    if (submitLockRef.current) return;
    if (!draft.name.trim()) { setAttempted(true); return; }
    submitLockRef.current = true;
    if (editingId) {
      setTasks((current) => current.map((task) => task.id === editingId ? { ...task, ...draft, name: draft.name.trim() } : task));
      setEditingId(null);
    } else {
      setTasks((current) => [...current, { ...draft, cycleDays: [], id: crypto.randomUUID(), name: draft.name.trim() }]);
    }
    setDraft(initialTaskDraft());
    setAttempted(false);
    submitLockRef.current = false;
  };

  const editTask = (task) => {
    setDraft({ ...task, cycleDays: [...task.cycleDays] });
    setEditingId(task.id);
  };

  const cancelEdit = () => { setDraft(initialTaskDraft()); setEditingId(null); };

  return (
    <section className={`task-builder-panel${compact ? ' task-builder-panel--embedded' : ''}`} aria-labelledby="task-editor-title">
      {!compact && <StepHeader eyebrow="STEP 04 · ADD TASKS" title="What do you want to do?" description="Give each Task a clear name. Add a short description if it helps explain the work." />}
      <div className="task-builder-layout">
        <form className="task-builder-form" onSubmit={saveTask} noValidate>
          <div className="task-builder-form__heading"><span className="task-builder-icon"><AppIcon name="tasks" /></span><div><p className="app-eyebrow">{editingId ? 'EDIT TASK' : 'NEW TASK'}</p><h3 id="task-editor-title">Task details</h3></div></div>
          <label className="task-builder-field" htmlFor="new-task-name">Task name <span>Required</span>
            <input id="new-task-name" type="text" value={draft.name} maxLength={100} aria-invalid={nameError} aria-describedby={nameError ? 'task-name-error' : undefined} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Study Java for one hour" />
            {nameError && <small className="task-builder-error" id="task-name-error">Enter a name for this Task.</small>}
          </label>
          <label className="task-builder-field" htmlFor="new-task-description">Description <span>Optional</span>
            <textarea id="new-task-description" rows="3" maxLength={300} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Add a useful explanation or completion detail" />
          </label>
          <p className="task-builder-inline-note"><AppIcon name="activity" />One Task should describe one clear action. You can add as many Tasks as your cycle needs.</p>
          <div className="task-builder-form__actions"><button className="task-builder-button task-builder-button--primary" type="submit">{editingId ? 'Save Task' : 'Add Task'}<span aria-hidden="true">↗</span></button>{editingId && <button className="task-builder-button task-builder-button--quiet" type="button" onClick={cancelEdit}>Cancel edit</button>}</div>
        </form>

        <div className="task-builder-schedule">
          <div className="task-builder-schedule__heading"><div><p className="app-eyebrow">YOUR TASK LIST</p><h3>Tasks to schedule</h3></div><span className="task-builder-total">{tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}</span></div>
          {tasks.length ? <ul className="task-builder-task-list">{tasks.map((task) => <li className="task-builder-task" key={task.id}>
            <div className="task-builder-task__copy"><strong>{task.name}</strong><p>{task.description || 'No description provided.'}</p><small>{task.cycleDays.length ? `Scheduled on ${task.cycleDays.map((day) => `Day ${String(day).padStart(2, '0')}`).join(', ')}` : 'Schedule not set yet'}</small></div>
            <div className="task-builder-task__controls"><button type="button" aria-label={`Edit ${task.name}`} onClick={() => editTask(task)}>Edit</button><button type="button" aria-label={`Remove ${task.name}`} onClick={() => { setTasks((current) => current.filter((item) => item.id !== task.id)); if (editingId === task.id) cancelEdit(); }}>Remove</button></div>
          </li>)}</ul> : <div className="task-builder-empty"><span aria-hidden="true">＋</span><p>No Tasks added yet.</p><small>Add at least seven Tasks for every cycle day in Step 4.</small></div>}
          <p className="task-builder-footnote">Example: “Study Java for one hour.” Keep each Task focused on one clear action.</p>
        </div>
      </div>
    </section>
  );
}

function ScheduleAssignment({ cycleLength, cycleDays, tasks, setTasks, activeDay, setActiveDay, validation, attempted }) {
  const dayCounts = cycleDays.map((day) => ({ ...day, count: getScheduledTasksForDay(tasks, day.dayNumber).length }));
  const dayIssues = validation.issues.filter((issue) => ['cycle', 'date', 'day'].includes(issue.type));
  const toggleTask = (taskId) => setTasks((current) => current.map((task) => task.id !== taskId ? task : {
    ...task,
    cycleDays: task.cycleDays.includes(activeDay)
      ? task.cycleDays.filter((day) => day !== activeDay)
      : [...task.cycleDays, activeDay].sort((a, b) => a - b),
  }));

  return <section className="task-builder-panel task-builder-panel--embedded" aria-labelledby="schedule-step-title">
    <div className="task-builder-schedule task-builder-schedule--assignment" aria-labelledby="schedule-step-title">
      <div className="task-builder-schedule__heading"><div><p className="app-eyebrow">DAY-BY-DAY PLAN</p><h3 id="schedule-step-title">Assign Tasks to each day</h3></div><span className="task-builder-total">{tasks.length} Tasks</span></div>
      <div className="task-builder-day-tabs" role="tablist" aria-label="Choose a cycle day">{dayCounts.map((day) => <button role="tab" aria-selected={activeDay === day.dayNumber} className={activeDay === day.dayNumber ? 'is-active' : ''} key={day.dayNumber} type="button" onClick={() => setActiveDay(day.dayNumber)}><span>{cycleLength === 7 ? day.label.slice(0, 3) : `Day ${day.dayNumber}`}</span><small className={day.count >= 7 ? 'is-valid' : ''}>{day.count}/7+</small></button>)}</div>
      {cycleLength ? <>
        <div className={`task-builder-day-count${dayCounts[activeDay - 1]?.count >= 7 ? ' is-valid' : ' is-incomplete'}`}><strong>Day {String(activeDay).padStart(2, '0')} · {dayCounts[activeDay - 1]?.count} / 7 minimum</strong><span>{dayCounts[activeDay - 1]?.count >= 7 ? 'Minimum met' : `Add ${7 - dayCounts[activeDay - 1]?.count} more ${7 - dayCounts[activeDay - 1]?.count === 1 ? 'Task' : 'Tasks'} to complete this day.`}</span></div>
        {tasks.length ? <ul className="task-builder-task-list task-builder-task-list--assignment">{tasks.map((task) => {
          const checked = task.cycleDays.includes(activeDay);
          return <li className={`task-builder-task task-builder-task--assign${checked ? ' is-assigned' : ''}`} key={task.id}><label className="task-builder-assignment-check"><input type="checkbox" checked={checked} onChange={() => toggleTask(task.id)} /><span aria-hidden="true" /><span className="task-builder-task__copy"><strong>{task.name}</strong><small>{task.description || 'No description provided.'}</small></span></label><span className="task-builder-assignment-status">{checked ? 'On this day' : 'Not scheduled'}</span></li>;
        })}</ul> : <div className="task-builder-empty"><p>Add Tasks above to assign them to this day.</p></div>}
      </> : <div className="task-builder-empty"><p>Choose the cycle length above to start scheduling.</p></div>}
      {attempted && dayIssues.length > 0 && <div className="task-builder-validation" role="alert"><AppIcon name="clock" /><div><strong>Finish this schedule step</strong><ul>{dayIssues.map((issue, index) => <li key={`${issue.type}-${index}`}>{issue.message}</li>)}</ul></div></div>}
      <p className="task-builder-footnote">Every cycle day needs at least 7 Tasks. There is no maximum. Task times are not supported; all scheduled Tasks share the 12:00 AM IST daily deadline.</p>
    </div>
  </section>;
}

function ChooseCycleStep({ cycleLength, setCycleLength, startDate, setStartDate, cycleDays }) {
  return <section className="task-builder-panel" aria-labelledby="choose-cycle-title">
    <StepHeader eyebrow="STEP 03 · CHOOSE YOUR CYCLE" title="Choose your Daily Cycle" description="How many days do you want in your schedule? Choose from 1 to 7 days." />
    <CycleSetup cycleLength={cycleLength} setCycleLength={setCycleLength} startDate={startDate} setStartDate={setStartDate} cycleDays={cycleDays} />
    <div className="task-builder-cycle-summary" aria-live="polite">
      <div><span>Your cycle</span><strong>{cycleLength ? `${cycleLength} ${cycleLength === 1 ? 'day' : 'days'}` : 'Choose a length'}</strong></div>
      <div><span>Minimum Tasks</span><strong>{cycleLength ? cycleLength * 7 : '—'}</strong></div>
      <div><span>Minimum each day</span><strong>7</strong></div>
    </div>
    <p className="task-builder-footnote">Every day needs at least 7 Tasks. Choose a cycle you can realistically follow.</p>
    <div className="task-builder-cycle-table-wrap"><table className="task-builder-cycle-table"><caption>Minimum Tasks by cycle length</caption><thead><tr><th scope="col">Cycle</th><th scope="col">Minimum Tasks</th></tr></thead><tbody>{CYCLE_OPTIONS.map((days) => <tr key={days} className={cycleLength === days ? 'is-selected' : undefined}><th scope="row">{days} {days === 1 ? 'day' : 'days'}</th><td>{days * 7}</td></tr>)}</tbody></table></div>
  </section>;
}

function DailyTasksStep({ cycleLength, cycleDays, tasks, setTasks, draft, setDraft, editingId, setEditingId, activeDay, setActiveDay, validation, attempted, setAttempted }) {
  const minimum = cycleLength * 7;
  return <section className="task-builder-daily-step" aria-labelledby="daily-tasks-step-title">
    <StepHeader eyebrow="STEP 04 · ADD TASKS FOR EACH DAY" title="Add your Tasks" description="Plan what you want to complete each day. Every day needs at least 7 Tasks." />
    <div className="task-builder-cycle-summary" aria-label="Task count summary"><div><span>Cycle length</span><strong>{cycleLength} {cycleLength === 1 ? 'day' : 'days'}</strong></div><div><span>Total Tasks</span><strong>{tasks.length}</strong></div><div><span>Minimum required</span><strong>{minimum}</strong></div></div>
    <p className="task-builder-footnote">Task times are not supported. Every scheduled Task uses the shared 12:00 AM IST deadline.</p>
    <TaskDetailsStep tasks={tasks} setTasks={setTasks} draft={draft} setDraft={setDraft} editingId={editingId} setEditingId={setEditingId} attempted={attempted} setAttempted={setAttempted} compact />
    <ScheduleAssignment cycleLength={cycleLength} cycleDays={cycleDays} tasks={tasks} setTasks={setTasks} activeDay={activeDay} setActiveDay={setActiveDay} validation={validation} attempted={attempted} />
  </section>;
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
      <StepHeader eyebrow="STEP 05 · CHOOSE YOUR FORFEITS" title="Choose your own Forfeits" description="Be honest with yourself. Choose something safe, realistic and useful that helps you improve." />
      <aside className="task-builder-rules task-builder-rules--notice"><AppIcon name="activity" /><div><strong>Choose one for every scheduled Task</strong><p>If you miss a scheduled Task, its linked Forfeit becomes active the next day. You have 3 days to complete it. Choose an action that is safe and realistic.</p></div></aside>
      {!tasks.length ? <div className="task-builder-empty task-builder-empty--wide"><p>Add Tasks in the previous step before choosing their Forfeits.</p></div> : <div className="task-action-builder">
        <div className="task-action-picker" aria-label="Tasks needing Forfeits">
          <p className="app-eyebrow">YOUR TASKS · {tasks.length}</p>
          {tasks.map((task) => <button type="button" key={task.id} className={`task-action-picker__item${activeTask?.id === task.id ? ' is-active' : ''}`} aria-current={activeTask?.id === task.id ? 'step' : undefined} onClick={() => setActiveActionId(task.id)}>
            <span className={`task-action-picker__status${actionIncomplete(task) ? ' is-pending' : ' is-complete'}`} aria-label={actionIncomplete(task) ? 'Forfeit needed' : 'Forfeit ready'}>{actionIncomplete(task) ? '!' : '✓'}</span><span><strong>{task.name}</strong><small>{actionIncomplete(task) ? 'Forfeit needed' : 'Forfeit ready'}</small></span><span aria-hidden="true">→</span>
          </button>)}
        </div>
        {activeTask && <div className="task-action-editor">
          <div className="task-action-editor__task"><p className="app-eyebrow">FORFEIT FOR</p><h3>{activeTask.name}</h3><p>{activeTask.description || 'No Task description provided.'}</p><small>Assigned to {activeTask.cycleDays.map((day) => `Day ${String(day).padStart(2, '0')}`).join(', ') || 'no cycle days'}</small></div>
          <div className="task-action-editor__fields">
            <label className="task-builder-field" htmlFor="accountability-action-title">Forfeit name <span>Required</span><input id="accountability-action-title" value={activeTask.actionTitle} maxLength={100} aria-invalid={attempted && !activeTask.actionTitle.trim()} onChange={(event) => updateAction('actionTitle', event.target.value)} placeholder="Name the action you would take" />{attempted && !activeTask.actionTitle.trim() && <small className="task-builder-error">Add a Forfeit name.</small>}</label>
            <label className="task-builder-field" htmlFor="accountability-action-description">What will you do? <span>Required</span><textarea id="accountability-action-description" rows="3" value={activeTask.actionDescription} maxLength={300} aria-invalid={attempted && !activeTask.actionDescription.trim()} onChange={(event) => updateAction('actionDescription', event.target.value)} placeholder="Describe the action clearly" />{attempted && !activeTask.actionDescription.trim() && <small className="task-builder-error">Describe the Forfeit.</small>}</label>
            <label className="task-builder-field" htmlFor="accountability-action-weakness">What are you working to improve? <span>Optional</span><textarea id="accountability-action-weakness" rows="2" value={activeTask.weakness} maxLength={240} onChange={(event) => updateAction('weakness', event.target.value)} placeholder="A habit, behaviour or specific weakness" /></label>
          </div>
          <div className="task-action-preview"><p className="app-eyebrow">TASK + FORFEIT PREVIEW</p><strong>{activeTask.name}</strong><span>{activeTask.actionTitle || 'Forfeit name will appear here'}</span><p>{activeTask.actionDescription || 'Add a description to complete this step.'}</p></div>
        </div>}
      </div>}
      <aside className="task-builder-safety-note" role="note"><strong>Keep each choice safe and realistic.</strong><p>Do not use self-harm, food restriction, sleep deprivation, dangerous exercise or harmful punishments. Every Task saves its own assignment; choose each one deliberately.</p></aside>
      <aside className="task-builder-rules task-builder-rules--recovery"><AppIcon name="recovery" /><div><strong>If you miss a scheduled Task</strong><p>You have 3 days to finish its linked Forfeit. If time runs out, one Grace Point is deducted. This step only saves your choices; it does not create a missed Task or deduct points.</p></div></aside>
    </section>
  );
}

function ScheduleReview({ cycleLength, cycleDays, startDate, tasks, validation, attempted, rulesAcknowledged, setRulesAcknowledged, allowance, allowanceLoaded, emergencyPause, onEditCycle, onEditTasks, onEditActions }) {
  const loadedAllowance = allowanceLoaded && Number.isFinite(Number(allowance?.maximum));
  const loadedPause = Number.isFinite(Number(emergencyPause?.allowance));
  return (
    <section className="task-builder-panel" aria-labelledby="schedule-review-title">
      <StepHeader eyebrow="STEP 06 · REVIEW & START" title="Review your complete schedule" description="Check every day, Task and Forfeit before creating your schedule." />
      <div className="task-builder-rule-grid task-builder-rule-grid--summary"><article className="task-builder-rule-card"><p className="app-eyebrow">DAILY CYCLE</p><strong>{cycleLength || '—'} {cycleLength === 1 ? 'day' : 'days'}</strong><p>{cycleLength === 7 ? 'Monday–Sunday calendar week.' : `Starts ${formatTaskDateKey(startDate)} and repeats every ${cycleLength || '—'} days.`}</p></article><article className="task-builder-rule-card"><p className="app-eyebrow">DAILY DEADLINE</p><strong>12:00 AM IST</strong><p>There are no individual Task times. All Tasks share the system deadline.</p></article><article className="task-builder-rule-card"><p className="app-eyebrow">TASKS & COVERAGE</p><strong>{tasks.length} Tasks · {cycleLength * 7} minimum</strong><p>{validation.dayCounts.filter((day) => day.valid).length} of {validation.dayCounts.length} days meet the minimum of 7 Tasks.</p></article></div>
      <aside className="task-builder-review-rules" aria-label="Important rules summary"><strong>Before you start</strong><ul><li>{loadedAllowance ? `${allowance.maximum} shared Task changes renew each Monday at 12:00 AM IST.` : 'Task edits, rescheduling and deletion share one weekly allowance.'}</li><li>A missed Task creates its linked Forfeit the next day; you have 72 hours.</li><li>An expired Forfeit or the sixth active one costs 1 Grace Point; the sixth clears the active group.</li><li>{loadedPause ? `Emergency Pause currently allows ${emergencyPause.allowance} uses each IST month; activation has no separate XP fee.` : 'Emergency Pause has a monthly use limit and no separate XP fee.'}</li><li>Only normal scheduled Task completion can award XP; Forfeits do not.</li></ul></aside>
      {attempted && !validation.valid && <div className="task-builder-validation" role="alert"><AppIcon name="shield" /><div><strong>Schedule needs attention</strong><ul>{validation.issues.slice(0, 12).map((issue, index) => <li key={`${issue.type}-${index}`}>{issue.message.replaceAll('Forfeit', 'Forfeit')}</li>)}</ul></div></div>}
      <div className="task-review-days">{cycleDays.map((day) => {
        const dayTasks = getScheduledTasksForDay(tasks, day.dayNumber);
        const isValid = dayTasks.length >= 7;
        return <article className={`task-review-day${isValid ? ' is-valid' : ' is-incomplete'}`} key={day.dayNumber}>
          <header><div><p className="app-eyebrow">CYCLE DAY {String(day.dayNumber).padStart(2, '0')}</p><h3>{day.label}</h3><small>{day.sublabel}</small></div><span className={isValid ? 'is-valid' : 'is-incomplete'}>{dayTasks.length} Tasks · {isValid ? 'Valid' : `${7 - dayTasks.length} more needed`}</span></header>
          {dayTasks.length ? <ul>{dayTasks.map((task) => <li key={task.id}><div><strong>{task.name}</strong><p>{task.description || 'No description provided.'}</p></div><aside><span>FORFEIT</span><strong>{task.actionTitle || 'Not configured'}</strong><p>{task.actionDescription || 'Description required.'}</p></aside></li>)}</ul> : <p className="task-review-empty">No Tasks assigned to this day yet.</p>}
        </article>;
      })}</div>
      <div className="task-review-edit-links"><button type="button" onClick={onEditCycle}>Edit schedule</button><button type="button" onClick={onEditTasks}>Edit Task details</button><button type="button" onClick={onEditActions}>Edit Forfeits</button></div>
      <label className={`task-builder-acknowledgement${attempted && !rulesAcknowledged ? ' is-invalid' : ''}`}><input type="checkbox" checked={rulesAcknowledged} onChange={(event) => setRulesAcknowledged(event.target.checked)} /><span>I have read and understood the rules of THE SYSTEM.</span></label>
      {!rulesAcknowledged && !attempted && <small className="task-builder-acknowledgement-hint">Required before you can start your schedule.</small>}
      {attempted && !rulesAcknowledged && <p className="task-builder-error" role="alert">Please acknowledge the rules before starting your schedule.</p>}
      <p className="task-builder-preview-disclosure">Check each Task before creating. Your Tasks will appear in Daily Tasks once the schedule is saved.</p>
    </section>
  );
}

export default function CreateTaskSchedulePage() {
  const { notifySuccess, notifyError, notifyInfo } = useFlashMessages();
  const { schedule: currentSchedule, tasks: serverTasks, allowance, allowanceLoaded, todayDate, loading, error: backendError, errorInfo: backendErrorInfo, refresh, progressionResetNotice, emergencyPause, gracePoints, disciplineSummary } = useTaskBackend();
  const location = useLocation();
  const navigate = useNavigate();
  const [resetNotice, setResetNotice] = useState(() => location.state?.systemResetSuccess
    ? { persisted: location.state.systemResetPersisted !== false }
    : null);
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(1);
  const [cycleLength, setCycleLength] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [startDateTouched, setStartDateTouched] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [draft, setDraft] = useState(initialTaskDraft);
  const [editingId, setEditingId] = useState(null);
  const [activeDay, setActiveDay] = useState(1);
  const [activeActionId, setActiveActionId] = useState(null);
  const [rulesAcknowledged, setRulesAcknowledged] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const scheduleKeyRef = useRef(createIdempotencyKey());
  const scheduleSaveLockRef = useRef(false);
  const cycleDays = useMemo(() => cycleLength ? createCycleDays(cycleLength, startDate) : [], [cycleLength, startDate]);
  const validation = useMemo(() => getScheduleValidation(cycleLength, startDate, tasks), [cycleLength, startDate, tasks]);
  const automaticReset = location.state?.automaticProgressionReset ? {
    resetCount: location.state.resetCount,
  } : progressionResetNotice?.recentReset?.reason === 'automatic-grace-exhaustion' ? progressionResetNotice : null;
  const manualReset = location.state?.manualProgressionReset
    || progressionResetNotice?.recentReset?.reason === 'manual-reset-and-restart';
  const resetToastShownRef = useRef(false);
  useEffect(() => {
    if (resetToastShownRef.current) return;
    if (resetNotice) {
      resetToastShownRef.current = true;
      notifySuccess('Your new progression run is ready.');
      if (!resetNotice.persisted) notifyInfo('This change could not be saved in this browser. Refreshing may restore your previous progress.');
      setResetNotice(null);
      return;
    }
    if (manualReset) {
      resetToastShownRef.current = true;
      notifySuccess('Your fresh Progression Run is ready. Your account and saved history remain.');
    } else if (automaticReset) {
      resetToastShownRef.current = true;
      notifySuccess('Grace Points were exhausted. A new progression run is ready.');
    }
  }, [automaticReset, manualReset, notifyInfo, notifySuccess, resetNotice]);
  useEffect(() => {
    if (todayDate && !startDateTouched) setStartDate(todayDate);
  }, [todayDate, startDateTouched]);

  if (loading && !currentSchedule && !backendError) return <PageLoadingSkeleton variant="tasks" label="Loading your Task Schedule" />;
  if (backendError) {
    const unavailable = backendErrorInfo?.status === 0
      || backendErrorInfo?.status >= 500
      || backendErrorInfo?.code === 'NETWORK_ERROR'
      || backendErrorInfo?.code === 'SERVICE_UNAVAILABLE';
    const identityUnavailable = backendErrorInfo?.status === 401 || backendErrorInfo?.status === 403;
    const eyebrow = unavailable ? 'TASK SERVICE UNAVAILABLE' : identityUnavailable ? 'DEVELOPMENT IDENTITY UNAVAILABLE' : 'SCHEDULE REQUEST FAILED';
    const heading = unavailable ? 'Your schedule could not be loaded.' : identityUnavailable ? 'Your development identity could not be verified.' : 'The schedule request needs attention.';
    return <div className="task-creation-page"><section className="task-builder-success" role="alert"><p className="app-eyebrow">{eyebrow}</p><h1>{heading}</h1><p>{backendError}</p><button className="task-builder-button task-builder-button--primary" type="button" onClick={refresh}>Try again <span aria-hidden="true">↻</span></button></section></div>;
  }
  if (currentSchedule) return <ActiveScheduleManager schedule={currentSchedule} tasks={serverTasks} allowance={allowance} todayDate={todayDate} loading={loading} onRefresh={refresh} />;
  const customizeEverything = new URLSearchParams(location.search).get('customize') === '1';

  const selectCycleLength = (length) => {
    setCycleLength(length);
    setActiveDay((day) => Math.min(day, length));
    setTasks((current) => current.map((task) => ({ ...task, cycleDays: task.cycleDays.filter((day) => day <= length) })));
  };
  const continueToRules = () => { setAttempted(false); setStep(2); };
  const continueToCycle = () => { setAttempted(false); setStep(3); };
  const continueToDailyTasks = () => {
    setAttempted(true);
    if (!cycleLength || (cycleLength < 7 && !startDate)) return;
    setAttempted(false);
    setActiveDay(1);
    setStep(4);
  };
  const continueToPunishmentTasks = () => {
    setAttempted(true);
    const hasUnfinishedDraft = draft.name.trim() || draft.description.trim() || editingId;
    if (hasUnfinishedDraft || !tasks.length || !cycleLength || validation.dayCounts.some((day) => !day.valid)) return;
    setAttempted(false);
    setActiveActionId(tasks[0]?.id || null);
    setStep(5);
  };
  const continueToReview = () => {
    setAttempted(true);
    if (validation.issues.some((issue) => issue.type === 'action')) return;
    setAttempted(false);
    setStep(6);
  };
  const confirmSchedule = async () => {
    if (scheduleSaveLockRef.current) return;
    setAttempted(true);
    if (!rulesAcknowledged) return;
    if (!validation.valid) return;
    scheduleSaveLockRef.current = true;
    setSaving(true);
    try {
      await taskApi.createSchedule({
        cycleLength,
        ...(cycleLength < 7 ? { cycleAnchorDate: startDate } : {}),
        tasks: tasks.map((task) => ({
          title: task.name,
          description: task.description,
          cycleDays: [...task.cycleDays],
          accountabilityAction: { title: task.actionTitle, description: task.actionDescription, weakness: task.weakness },
        })),
      }, scheduleKeyRef.current);
      await refresh();
      scheduleKeyRef.current = createIdempotencyKey();
      notifySuccess('Your schedule is ready. Start with today’s Tasks.');
      navigate('/app/tasks', { replace: true, state: { scheduleCreated: true } });
    } catch (requestError) {
      notifyError(requestError.message || 'The schedule could not be saved.');
    } finally {
      scheduleSaveLockRef.current = false;
      setSaving(false);
    }
  };

  return (
    <>
    <div hidden={customizeEverything}>
      <QuickStartScheduleBuilder onCancel={() => navigate('/app/tasks')} />
    </div>
    <div hidden={!customizeEverything} className={`task-creation-page${reducedMotion ? ' is-reduced-motion' : ''}`}>
      <header className="task-creation-header"><div><p className="app-eyebrow">MY PROGRESS · SCHEDULE BUILDER</p><h1>Create your Daily Schedule</h1><p>Set a repeating cycle, add your Tasks and choose a Forfeit for each one.</p><Link className="task-builder-back-to-quick-start" to="/app/tasks/create"><span aria-hidden="true">←</span> Back to Quick Start</Link></div><span className="app-demo-label"><i aria-hidden="true" />SCHEDULE READY</span></header>

      <nav className="task-builder-progress" aria-label="Schedule creation progress">
        {STEPS.map((item, index) => <div className={`task-builder-progress__step${step === item.number ? ' is-current' : ''}${step > item.number ? ' is-complete' : ''}`} key={item.number} aria-current={step === item.number ? 'step' : undefined}><span>{step > item.number ? '✓' : String(item.number).padStart(2, '0')}</span><strong>{item.label}</strong>{index < STEPS.length - 1 && <i aria-hidden="true" />}</div>)}
      </nav>

      {step === 1 && <TutorialStep />}
      {step === 2 && <RulesStep allowance={allowance} allowanceLoaded={allowanceLoaded} emergencyPause={emergencyPause} gracePoints={gracePoints} disciplineSummary={disciplineSummary} />}
      {step === 3 && <ChooseCycleStep cycleLength={cycleLength} setCycleLength={selectCycleLength} cycleDays={cycleDays} startDate={startDate} setStartDate={(value) => { setStartDateTouched(true); setStartDate(value); }} />}
      {step === 4 && <DailyTasksStep cycleLength={cycleLength} cycleDays={cycleDays} tasks={tasks} setTasks={setTasks} draft={draft} setDraft={setDraft} editingId={editingId} setEditingId={setEditingId} activeDay={activeDay} setActiveDay={setActiveDay} validation={validation} attempted={attempted} setAttempted={setAttempted} />}
      {step === 4 && attempted && (draft.name.trim() || draft.description.trim() || editingId) && <p className="task-builder-step-error" role="alert">Save or cancel your Task edit before continuing, so nothing is lost.</p>}
      {step === 5 && <AccountabilityActions tasks={tasks} setTasks={setTasks} activeActionId={activeActionId} setActiveActionId={setActiveActionId} attempted={attempted} />}
      {step === 6 && <ScheduleReview cycleLength={cycleLength} cycleDays={cycleDays} startDate={startDate} tasks={tasks} validation={validation} attempted={attempted} rulesAcknowledged={rulesAcknowledged} setRulesAcknowledged={setRulesAcknowledged} allowance={allowance} allowanceLoaded={allowanceLoaded} emergencyPause={emergencyPause} onEditCycle={() => setStep(3)} onEditTasks={() => setStep(4)} onEditActions={() => setStep(5)} />}

      <div className="task-builder-footer-nav">
        {step === 1 ? <Link className="task-builder-back-link" to="/app/tasks">Cancel and return to Tasks</Link> : <button className="task-builder-button task-builder-button--quiet" type="button" onClick={() => { setAttempted(false); setStep((current) => current - 1); }}>Back</button>}
        {step === 1 && <button className="task-builder-button task-builder-button--primary" type="button" onClick={continueToRules}>Continue to rules <span aria-hidden="true">→</span></button>}
        {step === 2 && <button className="task-builder-button task-builder-button--primary" type="button" onClick={continueToCycle}>Continue to cycle <span aria-hidden="true">→</span></button>}
        {step === 3 && <button className="task-builder-button task-builder-button--primary" type="button" onClick={continueToDailyTasks}>Continue to daily Tasks <span aria-hidden="true">→</span></button>}
        {step === 4 && <button className="task-builder-button task-builder-button--primary" type="button" onClick={continueToPunishmentTasks}>Choose Forfeits <span aria-hidden="true">→</span></button>}
        {step === 5 && <button className="task-builder-button task-builder-button--primary" type="button" onClick={continueToReview}>Review your schedule <span aria-hidden="true">→</span></button>}
        {step === 6 && <button className="task-builder-button task-builder-button--primary" type="button" onClick={confirmSchedule} disabled={!validation.valid || !rulesAcknowledged || saving}>{saving ? 'Starting schedule…' : 'Start My Schedule'} <span aria-hidden="true">{saving ? '…' : '✓'}</span></button>}
      </div>
      {step === 3 && attempted && (!cycleLength || (cycleLength < 7 && !startDate)) && <p className="task-builder-confirm-hint">Choose a cycle length and its start date before continuing.</p>}
      {step === 4 && attempted && (!tasks.length || validation.dayCounts.some((day) => !day.valid)) && <p className="task-builder-confirm-hint">Add at least 7 Tasks to every day before choosing Forfeits.</p>}
      {step === 5 && attempted && validation.issues.some((issue) => issue.type === 'action') && <p className="task-builder-confirm-hint">Give every scheduled Task its own Forfeit name and description before continuing.</p>}
      {step === 6 && !validation.valid && <p className="task-builder-confirm-hint">Complete the cycle, every day’s 7 Task minimum and all Forfeit assignments before starting.</p>}
      <p className="task-builder-disclosure"><AppIcon name="activity" />Creating a schedule does not award XP. Completing a regular scheduled Task can earn XP; Forfeits do not.</p>
    </div>
    </>
  );
}

function ActiveScheduleManager({ schedule, tasks, allowance, todayDate, loading, onRefresh }) {
  const { notifySuccess, notifyError } = useFlashMessages();
  const [draft, setDraft] = useState(initialTaskDraft);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changeTarget, setChangeTarget] = useState(null);
  const [changeSaving, setChangeSaving] = useState(false);
  const [changeError, setChangeError] = useState('');
  const idempotencyKeyRef = useRef(createIdempotencyKey());
  const changeKeyRef = useRef(createIdempotencyKey());
  const addLockRef = useRef(false);
  const changeLockRef = useRef(false);
  const cycleDays = useMemo(() => createCycleDays(schedule.cycleLength, schedule.cycleAnchorDate), [schedule.cycleLength, schedule.cycleAnchorDate]);
  const dayCounts = useMemo(() => cycleDays.map((day) => ({ ...day, count: tasks.filter((task) => task.status === 'active' && task.cycleDays.includes(day.dayNumber)).length })), [cycleDays, tasks]);
  const activeDayTasks = useMemo(() => dayCounts.map((day) => ({ ...day, tasks: tasks.filter((task) => task.status === 'active' && task.cycleDays.includes(day.dayNumber)) })), [dayCounts, tasks]);

  const toggleDay = (dayNumber) => setDraft((current) => ({
    ...current,
    cycleDays: current.cycleDays.includes(dayNumber)
      ? current.cycleDays.filter((day) => day !== dayNumber)
      : [...current.cycleDays, dayNumber].sort((a, b) => a - b),
  }));

  const submit = async (event) => {
    event.preventDefault();
    if (addLockRef.current) return;
    setAttempted(true);
    if (!draft.name.trim() || !draft.cycleDays.length || !draft.actionTitle.trim() || !draft.actionDescription.trim()) return;
    addLockRef.current = true;
    setSaving(true);
    try {
      const result = await taskApi.addTask({
        title: draft.name,
        description: draft.description,
        cycleDays: draft.cycleDays,
        accountabilityAction: { title: draft.actionTitle, description: draft.actionDescription, weakness: draft.weakness },
      }, idempotencyKeyRef.current);
      await onRefresh();
      idempotencyKeyRef.current = createIdempotencyKey();
      setDraft(initialTaskDraft());
      setAttempted(false);
      notifySuccess(`Task saved for ${formatTaskDateKey(result.task?.effectiveDate)}. It will not change today's Task list or XP calculation.`);
    } catch (requestError) {
      notifyError(requestError.message || 'The Task could not be saved.');
    } finally {
      addLockRef.current = false;
      setSaving(false);
    }
  };

  const confirmChange = async ({ taskId, mode, draft: changeDraft }) => {
    if (changeLockRef.current) return;
    changeLockRef.current = true;
    setChangeSaving(true);
    setChangeError('');
    try {
      let result;
      if (mode === 'delete') result = await taskApi.deleteTask(taskId, changeKeyRef.current);
      else if (mode === 'reschedule') await taskApi.rescheduleTask(taskId, changeDraft.cycleDays, changeKeyRef.current);
      else await taskApi.updateTask(taskId, {
        title: changeDraft.name,
        description: changeDraft.description,
        accountabilityAction: { title: changeDraft.actionTitle, description: changeDraft.actionDescription },
      }, changeKeyRef.current);
      changeKeyRef.current = createIdempotencyKey();
      setChangeTarget(null);
      notifySuccess(mode === 'delete'
        ? `Delete Task is pending until ${formatTaskDateKey(result.task?.effectiveDate)}. Today's scheduled occurrence remains available; previous Task history is preserved.`
        : mode === 'reschedule'
          ? 'Task rescheduled from the next IST date.'
          : 'Task updated for future dates. Existing and current-day snapshots remain unchanged.');
      await onRefresh();
    } catch (requestError) {
      const message = requestError.message || 'The Task change could not be saved.';
      setChangeError(message);
      notifyError(message);
    } finally {
      changeLockRef.current = false;
      setChangeSaving(false);
    }
  };

  return (
    <div className="task-creation-page">
      <header className="task-creation-header"><div><p className="app-eyebrow">MY PROGRESS · SCHEDULE BUILDER</p><h1>Manage your Daily Schedule</h1><p>Your active cycle has {schedule.cycleLength} {schedule.cycleLength === 1 ? 'day' : 'days'} and {tasks.length} original Tasks. Changes apply to future occurrences.</p></div><span className="app-demo-label"><i aria-hidden="true" />ACTIVE SCHEDULE</span></header>
      <section className="task-builder-panel" aria-labelledby="active-schedule-title">
        <StepHeader eyebrow="ACTIVE TASK SCHEDULE" title="Current schedule" description="Every cycle day must retain at least seven original scheduled Tasks. All existing Tasks and their Forfeits are listed below." />
        <section className="task-builder-existing-list" aria-label="Existing Tasks grouped by cycle day">
          {activeDayTasks.map((day) => <article className="task-builder-existing-day" key={day.dayNumber} aria-labelledby={'managed-day-' + day.dayNumber}>
            <header><div><p className="app-eyebrow">CYCLE DAY {String(day.dayNumber).padStart(2, '0')}</p><h3 id={'managed-day-' + day.dayNumber}>{day.label}</h3></div><span>{day.tasks.length} {day.tasks.length === 1 ? 'Task' : 'Tasks'}</span></header>
            {day.tasks.length ? <ul className="task-builder-task-list task-builder-task-list--managed">{day.tasks.map((task) => <li className="task-builder-task" key={task.id}>
              <div className="task-builder-task__copy"><strong>{task.title}</strong><p>{task.description || 'No description provided.'}</p><small>Scheduled {task.cycleDays.map((cycleDay) => cycleDays.find((item) => item.dayNumber === cycleDay)?.label || ('Day ' + String(cycleDay).padStart(2, '0'))).join(', ')}</small><small>{task.createdEffectiveDate > todayDate ? `Pending · active from ${formatTaskDateKey(task.createdEffectiveDate)}` : `Revision ${task.revision} · Active`}</small><small>Forfeit: {task.accountabilityAction?.title}</small><small>{task.accountabilityAction?.description}</small></div>
              <TaskActionMenu task={task} canModify={allowance.remaining > 0} onSelect={(selectedTask, mode) => { changeKeyRef.current = createIdempotencyKey(); setChangeError(''); setChangeTarget({ task: selectedTask, mode }); }} />
            </li>)}</ul> : <div className="task-builder-empty"><p>No active Tasks are assigned to this cycle day.</p></div>}
          </article>)}
        </section>
        <form className="task-builder-form" onSubmit={submit} noValidate>
          <div className="task-builder-form__heading"><span className="task-builder-icon"><AppIcon name="tasks" /></span><div><p className="app-eyebrow">ADD ORIGINAL TASK</p><h3 id="active-schedule-title">Task details</h3></div></div>
          <label className="task-builder-field" htmlFor="active-task-name">Task name <span>Required</span><input id="active-task-name" value={draft.name} maxLength={100} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />{attempted && !draft.name.trim() && <small className="task-builder-error">Enter a Task name.</small>}</label>
          <label className="task-builder-field" htmlFor="active-task-description">Description <span>Optional</span><textarea id="active-task-description" rows="2" maxLength={300} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
          <fieldset className="task-day-assignment"><legend>Assign to cycle days <span>Choose one or more</span></legend><div className="task-day-assignment__choices">{cycleDays.map((day) => <label className={draft.cycleDays.includes(day.dayNumber) ? 'is-selected' : ''} key={day.dayNumber}><input type="checkbox" checked={draft.cycleDays.includes(day.dayNumber)} onChange={() => toggleDay(day.dayNumber)} /><span>{schedule.cycleLength === 7 ? day.label.slice(0, 3) : `Day ${day.dayNumber}`}</span></label>)}</div>{attempted && !draft.cycleDays.length && <small className="task-builder-error">Assign the Task to at least one cycle day.</small>}</fieldset>
          <label className="task-builder-field" htmlFor="active-task-action-title">Forfeit name <span>Required</span><input id="active-task-action-title" value={draft.actionTitle} maxLength={100} onChange={(event) => setDraft((current) => ({ ...current, actionTitle: event.target.value }))} />{attempted && !draft.actionTitle.trim() && <small className="task-builder-error">Add the Forfeit name.</small>}</label>
          <label className="task-builder-field" htmlFor="active-task-action-description">Forfeit description <span>Required</span><textarea id="active-task-action-description" rows="2" maxLength={300} value={draft.actionDescription} onChange={(event) => setDraft((current) => ({ ...current, actionDescription: event.target.value }))} />{attempted && !draft.actionDescription.trim() && <small className="task-builder-error">Describe the Forfeit.</small>}</label>
          <label className="task-builder-field" htmlFor="active-task-weakness">What are you working to improve? <span>Optional</span><textarea id="active-task-weakness" rows="2" maxLength={240} value={draft.weakness} onChange={(event) => setDraft((current) => ({ ...current, weakness: event.target.value }))} /></label>
          <aside className="task-schedule-change-notice" role="note"><div><strong>SCHEDULE CHANGE NOTICE</strong><p>New Tasks become active from their next scheduled cycle day. They will not appear in today's Task list. Today's Task count and XP calculation will remain unchanged.</p></div></aside>
          <aside className="task-builder-rules"><AppIcon name="activity" /><div><strong>Weekly Existing Task Changes</strong><p><b>{allowance.remaining} of {allowance.maximum} changes remaining.</b> Adding new Tasks is free. Editing, rescheduling or deleting existing Tasks uses the weekly allowance.</p></div></aside>
          <div className="task-builder-form__actions"><button className="task-builder-button task-builder-button--primary" type="submit" disabled={saving || loading}>{saving ? 'Saving…' : 'Save Task'}<span aria-hidden="true">↗</span></button><Link className="task-builder-button task-builder-button--quiet" to="/app/tasks">Return to Daily Tasks</Link><button className="task-builder-button task-builder-button--quiet" type="button" onClick={onRefresh} disabled={loading}>Refresh schedule</button></div>
        </form>
      </section>
      {changeTarget && <TaskChangeDialog task={changeTarget.task} mode={changeTarget.mode} cycleLength={schedule.cycleLength} tasks={tasks} allowance={allowance} onConfirm={confirmChange} onClose={() => setChangeTarget(null)} saving={changeSaving} error={changeError} />}
      <p className="task-builder-disclosure"><AppIcon name="activity" />New Tasks start on their next matching cycle day. Edits, rescheduling and deletion take effect from the next IST calendar day. Completed occurrences remain in Task history; making a change does not award XP.</p>
    </div>
  );
}
