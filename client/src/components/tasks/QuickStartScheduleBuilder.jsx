import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppIcon from '../app/AppIcon.jsx';
import QuickStartIntro from '../app/QuickStartIntro.jsx';
import { TermText } from '../app/Term.jsx';
import { useTaskBackend } from '../../context/TaskBackendContext.jsx';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { createIdempotencyKey, taskApi } from '../../services/taskApi.js';
import { getScheduleValidation } from '../../utils/taskScheduleBuilder.js';
import { hasSeenQuickStartIntro, updateFirstRunProgress } from '../../utils/firstRunProgress.js';
import '../../styles/quick-start.css';
import '../../styles/first-run-help.css';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const FORFEIT_CHOICES = ['20 squats', '10-minute walk', 'Tidy up for 5 minutes', 'Write a 5-line reflection', 'No phone for 1 hour'];

const STARTER_PACKS = [
  { name: 'Student', icon: 'analysis', tasks: ['Study 1 hour (no phone)', "Revise yesterday's notes", 'Solve 2 practice problems', 'Read 10 pages', 'Exercise 20 minutes', 'Plan tomorrow (5 min)', 'Sleep before 11 PM'] },
  { name: 'Fitness', icon: 'activity', tasks: ['Workout 30 minutes', 'Walk 20 minutes', 'Drink 2 liters of water', 'Stretch 10 minutes', 'No sugary drinks', 'Eat one home-cooked meal', 'Sleep 7+ hours'] },
  { name: 'Coder', icon: 'goals', tasks: ['Code for 1 hour', 'Solve 1 DSA problem', 'Read docs for 30 minutes', "Revise yesterday's code", 'Write 5 lines on what I learned', 'Exercise 15 minutes', "Plan tomorrow's tasks"] },
  { name: 'Balanced', icon: 'spark', tasks: ['Finish morning routine', 'Deep work 45 minutes', 'Exercise 20 minutes', 'Read 10 pages', 'Tidy up for 10 minutes', 'Message a friend or family member', 'Plan tomorrow'] },
];

const makeTask = (name = '') => ({
  id: globalThis.crypto?.randomUUID?.() || `quick-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: name.slice(0, 100),
  description: '',
  cycleDays: [...ALL_DAYS],
  actionTitle: FORFEIT_CHOICES[0],
  actionDescription: forfeitWording(FORFEIT_CHOICES[0]),
  weakness: '',
  showDetails: false,
  showDays: false,
  editWording: false,
});

function forfeitWording(title) {
  return title ? `If I miss this Task, I will ${title} within 72 hours.` : '';
}

function ForfeitChips({ value, onChange, label = 'Choose a Forfeit' }) {
  return <fieldset className="quick-start-forfeit-options">
    <legend>{label}</legend>
    <div className="quick-start-forfeit-options__chips">
      {FORFEIT_CHOICES.map((choice) => <button
        key={choice}
        type="button"
        className={`quick-start-chip${value === choice ? ' is-selected' : ''}`}
        aria-pressed={value === choice}
        onClick={() => onChange(choice)}
      >{choice}</button>)}
      <button
        type="button"
        className={`quick-start-chip${value === '__custom__' ? ' is-selected' : ''}`}
        aria-pressed={value === '__custom__'}
        onClick={() => onChange('__custom__')}
      >Custom</button>
    </div>
  </fieldset>;
}

function TaskRow({ task, index, onChange, onDelete, onToggleDays }) {
  return <li className="quick-start-task-row">
    <div className="quick-start-task-row__top">
      <span className="quick-start-task-row__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <label className="quick-start-field quick-start-task-row__name">
        <span className="quick-start-sr-only">Task {index + 1} name</span>
        <input
          type="text"
          value={task.name}
          maxLength={100}
          placeholder="Name one clear Task"
          onChange={(event) => onChange(task.id, { name: event.target.value })}
        />
      </label>
      <button className="quick-start-icon-button quick-start-task-row__delete" type="button" aria-label={`Delete Task ${task.name || index + 1}`} onClick={() => onDelete(task.id)}>
        <AppIcon name="trash" />
      </button>
    </div>
    <div className="quick-start-task-row__links">
      <button className="quick-start-text-button" type="button" aria-expanded={task.showDetails} onClick={() => onChange(task.id, { showDetails: !task.showDetails })}>{task.showDetails ? 'Hide details' : 'Add details'}</button>
      <button className="quick-start-text-button" type="button" aria-expanded={task.showDays} onClick={() => onToggleDays(task.id)}>{task.showDays ? 'Hide days' : 'Choose days'}</button>
    </div>
    {task.showDetails && <label className="quick-start-field quick-start-task-row__details">
      <span>Task details <small>Optional</small></span>
      <textarea rows="2" value={task.description} maxLength={300} placeholder="Add a short note, if it helps." onChange={(event) => onChange(task.id, { description: event.target.value })} />
      <small className="quick-start-field__hint">{task.description.length}/300</small>
    </label>}
    {task.showDays && <fieldset className="quick-start-day-picker">
      <legend>Days for this Task</legend>
      <div className="quick-start-day-picker__chips">
        {SHORT_DAYS.map((day, dayIndex) => {
          const dayNumber = dayIndex + 1;
          const selected = task.cycleDays.includes(dayNumber);
          return <button type="button" key={day} className={`quick-start-day-chip${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={() => onChange(task.id, { cycleDays: selected ? task.cycleDays.filter((value) => value !== dayNumber) : [...task.cycleDays, dayNumber].sort((a, b) => a - b) })}>{day}</button>;
        })}
      </div>
    </fieldset>}
  </li>;
}

function ScreenHeading({ step, title, description }) {
  return <div className="quick-start-heading">
    <p className="app-eyebrow">QUICK START · STEP {step} OF 3</p>
    <h2 id="quick-start-screen-title">{title}</h2>
    <p>{description}</p>
  </div>;
}

export default function QuickStartScheduleBuilder({ onCancel }) {
  const { refresh } = useTaskBackend();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const saveLockRef = useRef(false);
  const idempotencyKeyRef = useRef(createIdempotencyKey());
  const [step, setStep] = useState(1);
  const [introComplete, setIntroComplete] = useState(hasSeenQuickStartIntro);
  const [tasks, setTasks] = useState([]);
  const [selectedPack, setSelectedPack] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteMessage, setPasteMessage] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [sameForAll, setSameForAll] = useState(true);
  const [sharedForfeit, setSharedForfeit] = useState(FORFEIT_CHOICES[0]);
  const [customForfeit, setCustomForfeit] = useState('');
  const [sharedWording, setSharedWording] = useState(forfeitWording(FORFEIT_CHOICES[0]));
  const [noteOpen, setNoteOpen] = useState(false);
  const [weakness, setWeakness] = useState('');
  const [rulesAcknowledged, setRulesAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const validation = useMemo(() => getScheduleValidation(7, '', tasks), [tasks]);

  const filledCount = tasks.filter((task) => task.name.trim()).length;
  const completion = Math.min(100, Math.round((filledCount / 7) * 100));
  const taskNamesValid = tasks.length >= 7 && tasks.every((task) => task.name.trim() && task.cycleDays.length > 0);
  const daysValid = validation.dayCounts.length === 7 && validation.dayCounts.every((day) => day.valid);
  const taskStepValid = taskNamesValid && daysValid;
  const forfeitIssues = validation.issues.filter((issue) => issue.type === 'action');
  const forfeitStepValid = tasks.length >= 7 && forfeitIssues.length === 0;
  const cycleDays = validation.dayCounts;

  const updateTask = (taskId, updates) => setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...updates } : task));
  const applySharedForfeit = (title, description = forfeitWording(title)) => {
    setSharedWording(description);
    setTasks((current) => current.map((task) => ({ ...task, actionTitle: title, actionDescription: description, weakness })));
  };
  const chooseSharedForfeit = (choice) => {
    setSharedForfeit(choice);
    if (choice === '__custom__') {
      const title = customForfeit.trim();
      applySharedForfeit(title);
    } else {
      setCustomForfeit('');
      applySharedForfeit(choice);
    }
  };
  const usePack = (pack) => {
    setSelectedPack(pack.name);
    setPasteMessage('');
    setTasks(pack.tasks.map((name) => ({ ...makeTask(name), weakness })));
    setSharedForfeit(FORFEIT_CHOICES[0]);
    setSharedWording(forfeitWording(FORFEIT_CHOICES[0]));
  };
  const addBlankTask = () => {
    setTasks((current) => [...current, { ...makeTask(), weakness }]);
    setSelectedPack('');
  };
  const addPastedTasks = (source = pasteText) => {
    const seen = new Set(tasks.map((task) => task.name.trim()).filter(Boolean));
    let duplicates = 0;
    const names = [];
    for (const rawName of source.split(/\r?\n/)) {
      const name = rawName.trim().slice(0, 100);
      if (!name) continue;
      if (seen.has(name)) { duplicates += 1; continue; }
      seen.add(name);
      names.push(name);
    }
    if (names.length) {
      setTasks((current) => [...current, ...names.map((name) => ({ ...makeTask(name), weakness }))]);
      setSelectedPack('');
    }
    setPasteText('');
    setPasteMessage(names.length ? `${names.length} Task${names.length === 1 ? '' : 's'} added${duplicates ? ` · ${duplicates} exact duplicate${duplicates === 1 ? '' : 's'} skipped` : ''}.` : duplicates ? 'Those exact Task names are already on your list.' : 'Enter one Task name per line.');
  };
  const toggleTaskDays = (taskId) => setTasks((current) => current.map((task) => task.id === taskId ? { ...task, showDays: !task.showDays } : task));
  const continueFromTasks = () => {
    setAttempted(true);
    if (!taskStepValid) return;
    setAttempted(false);
    setStep(2);
  };
  const toggleSameForAll = (nextValue) => {
    setSameForAll(nextValue);
    if (nextValue) {
      const firstTask = tasks[0];
      const title = firstTask?.actionTitle || (sharedForfeit === '__custom__' ? customForfeit.trim() : sharedForfeit);
      const description = firstTask?.actionDescription || forfeitWording(title);
      setSharedForfeit(FORFEIT_CHOICES.includes(title) ? title : '__custom__');
      if (!FORFEIT_CHOICES.includes(title)) setCustomForfeit(title);
      setSharedWording(description);
      setTasks((current) => current.map((task) => ({ ...task, actionTitle: title, actionDescription: description, weakness })));
    } else {
      const title = sharedForfeit === '__custom__' ? customForfeit.trim() : sharedForfeit;
      const description = sharedWording || forfeitWording(title);
      setTasks((current) => current.map((task) => ({ ...task, actionTitle: task.actionTitle || title, actionDescription: task.actionDescription || description, weakness })));
    }
  };
  const changeTaskForfeit = (taskId, choice) => {
    if (choice === '__custom__') {
      updateTask(taskId, { actionTitle: '', actionDescription: '' });
      return;
    }
    updateTask(taskId, { actionTitle: choice, actionDescription: forfeitWording(choice), weakness });
  };
  const updateTaskCustomForfeit = (taskId, title) => updateTask(taskId, { actionTitle: title.slice(0, 100), actionDescription: forfeitWording(title.trim().slice(0, 100)), weakness });
  const continueFromForfeits = () => {
    setAttempted(true);
    if (!forfeitStepValid) return;
    setAttempted(false);
    setStep(3);
  };
  const updateSharedCustomForfeit = (value) => {
    const title = value.slice(0, 100);
    setCustomForfeit(title);
    applySharedForfeit(title.trim());
  };
  const updateSharedWording = (value) => {
    setSharedWording(value);
    setTasks((current) => current.map((task) => ({ ...task, actionDescription: value, weakness })));
  };
  const updateWeakness = (value) => {
    const note = value.slice(0, 240);
    setWeakness(note);
    setTasks((current) => current.map((task) => ({ ...task, weakness: note })));
  };

  const startPlan = async () => {
    if (saveLockRef.current) return;
    setAttempted(true);
    setSaveError('');
    if (!rulesAcknowledged || !taskStepValid || !forfeitStepValid || !validation.valid) return;
    saveLockRef.current = true;
    setSaving(true);
    const firstTaskName = tasks.find((task) => task.name.trim())?.name.trim() || '';
    const payload = {
      cycleLength: 7,
      tasks: tasks.map((task) => ({
        title: task.name.trim(),
        description: task.description.trim(),
        cycleDays: [...task.cycleDays].sort((a, b) => a - b),
        accountabilityAction: {
          title: task.actionTitle.trim(),
          description: task.actionDescription.trim(),
          weakness: task.weakness.trim(),
        },
      })),
    };
    try {
      await taskApi.createSchedule(payload, idempotencyKeyRef.current);
      updateFirstRunProgress({ planCreated: true });
      await refresh();
      idempotencyKeyRef.current = createIdempotencyKey();
      navigate('/app/dashboard', { replace: true, state: { quickStartCreated: true, firstTaskName } });
    } catch {
      setSaveError('We couldn’t save your plan just now. Your Tasks are still here. Please try again.');
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  if (!introComplete) return <main className={`quick-start-page${reducedMotion ? ' is-reduced-motion' : ''}`} aria-label="Quick Start setup">
    <QuickStartIntro onDone={() => setIntroComplete(true)} />
  </main>;

  return <main className={`quick-start-page${reducedMotion ? ' is-reduced-motion' : ''}`} aria-labelledby="quick-start-title">
    <header className="quick-start-page__header">
      <div><p className="app-eyebrow">MY PROGRESS · SCHEDULE BUILDER</p><h1 id="quick-start-title">Set up your daily plan</h1><p>Choose a starting point, make it yours, and begin.</p></div>
      <Link className="quick-start-customize-link" to="/app/tasks/create?customize=1">Customize everything <AppIcon name="arrow" /></Link>
    </header>

    <nav className="quick-start-progress" aria-label="Quick Start steps">
      {[['1', 'Your Tasks'], ['2', 'Your Forfeit'], ['3', 'Check and start']].map(([number, label], index) => <div className={`quick-start-progress__step${step === index + 1 ? ' is-current' : step > index + 1 ? ' is-complete' : ''}`} key={number} aria-current={step === index + 1 ? 'step' : undefined}><span>{step > index + 1 ? '✓' : number}</span><strong>{label}</strong></div>)}
    </nav>

    {step === 1 && <section className="quick-start-card" aria-labelledby="quick-start-screen-title">
      <ScreenHeading step="1" title="What will you do every day?" description="Pick 7 small Tasks. You can change them anytime." />
      <div className="quick-start-starter-packs" role="group" aria-label="Starter Task packs">
        {STARTER_PACKS.map((pack) => <button type="button" key={pack.name} className={`quick-start-pack${selectedPack === pack.name ? ' is-selected' : ''}`} aria-pressed={selectedPack === pack.name} onClick={() => usePack(pack)}>
          <span className="quick-start-pack__icon"><AppIcon name={pack.icon} /></span><span><strong>{pack.name}</strong><small>7 ready-to-edit Tasks</small></span>
        </button>)}
      </div>

      <div className="quick-start-paste">
        <label className="quick-start-field" htmlFor="quick-start-task-paste"><span>Or add your own list</span><textarea id="quick-start-task-paste" rows="3" value={pasteText} onChange={(event) => setPasteText(event.target.value)} onPaste={(event) => { const pasted = event.clipboardData.getData('text'); if (pasted.includes('\n')) { event.preventDefault(); addPastedTasks(pasted); } }} placeholder="One Task per line" /></label>
        <button className="quick-start-secondary-button" type="button" onClick={addPastedTasks}>Add these Tasks</button>
        {pasteMessage && <p className="quick-start-inline-message" role="status">{pasteMessage}</p>}
      </div>

      <div className="quick-start-task-list-heading">
        <div><h3>Your Tasks</h3><p>Every Task starts on all 7 days. Change its days only if needed.</p></div>
        <div className="quick-start-count-ring" role="progressbar" aria-label="Tasks added" aria-valuemin={0} aria-valuemax={7} aria-valuenow={Math.min(filledCount, 7)} style={{ '--quick-start-progress': `${completion}%` }}><span>{filledCount >= 7 ? '7+' : filledCount}<small>/ 7</small></span></div>
      </div>
      <p className="quick-start-count-label">{filledCount >= 7 ? `${filledCount} Tasks added` : `${filledCount} of 7 Tasks`}</p>

      {tasks.length > 0 && <ol className="quick-start-task-list">
        {tasks.map((task, index) => <TaskRow key={task.id} task={task} index={index} onChange={updateTask} onDelete={(taskId) => setTasks((current) => current.filter((item) => item.id !== taskId))} onToggleDays={toggleTaskDays} />)}
      </ol>}

      {tasks.length > 0 && <div className="quick-start-day-validation" aria-live="polite">
        {cycleDays.filter((day) => !day.valid).map((day) => <p key={day.dayNumber} role="status"><AppIcon name="activity" /><span><strong>{WEEKDAYS[day.dayNumber - 1]} needs 7 Tasks</strong> (it has {day.count}).</span><button className="quick-start-text-button" type="button" onClick={addBlankTask}>Add Task</button></p>)}
        {tasks.some((task) => !task.name.trim()) && <p role="alert">Give every Task a name before continuing. Names can be up to 100 characters.</p>}
        {tasks.some((task) => task.name.trim() && task.cycleDays.length === 0) && <p role="alert">Choose at least one day for every Task.</p>}
      </div>}

      <button className="quick-start-add-button" type="button" onClick={addBlankTask}><span aria-hidden="true">＋</span> Add another Task</button>
      <div className="quick-start-actions">
        <button className="quick-start-primary-button" type="button" onClick={continueFromTasks} disabled={!taskStepValid}>Next <AppIcon name="arrow" /></button>
      </div>
    </section>}

    {step === 2 && <section className="quick-start-card" aria-labelledby="quick-start-screen-title">
      <ScreenHeading step="2" title="What happens if you miss one?" description="Pick a small Forfeit you'll do if you miss a Task. Keep it safe and realistic." />
      <label className="quick-start-toggle"><input type="checkbox" checked={sameForAll} onChange={(event) => toggleSameForAll(event.target.checked)} /><span className="quick-start-toggle__switch" aria-hidden="true" /><span className="quick-start-toggle__copy"><strong>Same Forfeit for all Tasks</strong><small>Start with one choice and customize individual Tasks if you want.</small></span></label>

      {sameForAll ? <div className="quick-start-shared-forfeit">
        <ForfeitChips value={sharedForfeit} onChange={chooseSharedForfeit} />
        {sharedForfeit === '__custom__' && <label className="quick-start-field" htmlFor="quick-start-custom-forfeit"><span>Your Forfeit</span><input id="quick-start-custom-forfeit" type="text" maxLength={100} value={customForfeit} onChange={(event) => updateSharedCustomForfeit(event.target.value)} placeholder="Write a safe, realistic Forfeit" /></label>}
        <div className="quick-start-wording-preview"><p className="app-eyebrow">AUTO-FILLED WORDING</p><p>{sharedWording || 'Choose or enter a Forfeit to fill in the wording.'}</p><button className="quick-start-text-button" type="button" aria-expanded={tasks.some((task) => task.editWording)} onClick={() => setTasks((current) => current.map((task) => ({ ...task, editWording: !task.editWording })))}>{tasks.some((task) => task.editWording) ? 'Hide wording' : 'Edit wording'}</button>
          {tasks.some((task) => task.editWording) && <label className="quick-start-field" htmlFor="quick-start-shared-wording"><span>Forfeit wording <small>Required</small></span><textarea id="quick-start-shared-wording" rows="3" maxLength={300} value={sharedWording} onChange={(event) => updateSharedWording(event.target.value)} /></label>}
        </div>
      </div> : <div className="quick-start-individual-forfeits">
        {tasks.map((task, index) => <article className="quick-start-individual-forfeit" key={task.id}>
          <h3><span>{String(index + 1).padStart(2, '0')}</span>{task.name || 'Unnamed Task'}</h3>
          <label className="quick-start-field"><span>Forfeit</span><select value={FORFEIT_CHOICES.includes(task.actionTitle) ? task.actionTitle : '__custom__'} onChange={(event) => changeTaskForfeit(task.id, event.target.value)}><option value="">Choose a Forfeit</option>{FORFEIT_CHOICES.map((choice) => <option key={choice} value={choice}>{choice}</option>)}<option value="__custom__">Custom</option></select></label>
          {(!FORFEIT_CHOICES.includes(task.actionTitle)) && <label className="quick-start-field"><span>Custom Forfeit</span><input type="text" maxLength={100} value={task.actionTitle} onChange={(event) => updateTaskCustomForfeit(task.id, event.target.value)} placeholder="Write a safe, realistic Forfeit" /></label>}
          <p className="quick-start-wording-preview__text">{task.actionDescription || 'Choose a Forfeit to fill in the wording.'}</p>
          <button className="quick-start-text-button" type="button" aria-expanded={task.editWording} onClick={() => updateTask(task.id, { editWording: !task.editWording })}>{task.editWording ? 'Hide wording' : 'Edit wording'}</button>
          {task.editWording && <label className="quick-start-field"><span>Forfeit wording <small>Required</small></span><textarea rows="3" maxLength={300} value={task.actionDescription} onChange={(event) => updateTask(task.id, { actionDescription: event.target.value })} /></label>}
        </article>)}
      </div>}

      <details className="quick-start-note">
        <summary>Add a note about what you're working to improve <small>Optional</small></summary>
        <label className="quick-start-field" htmlFor="quick-start-weakness"><span>Your note</span><textarea id="quick-start-weakness" rows="3" maxLength={240} value={weakness} onChange={(event) => updateWeakness(event.target.value)} placeholder="A short reminder for yourself" /></label>
      </details>
      {attempted && !forfeitStepValid && <p className="quick-start-form-error" role="alert">Every Task needs a Forfeit name of up to 100 characters and wording of up to 300 characters.</p>}
      <div className="quick-start-actions quick-start-actions--split">
        <button className="quick-start-secondary-button" type="button" onClick={() => { setAttempted(false); setStep(1); }}>Back to Tasks</button>
        <button className="quick-start-primary-button" type="button" disabled={!forfeitStepValid} onClick={continueFromForfeits}>Next <AppIcon name="arrow" /></button>
      </div>
    </section>}

    {step === 3 && <section className="quick-start-card" aria-labelledby="quick-start-screen-title">
      <ScreenHeading step="3" title="Check and start" description="Your plan is ready. Review the details, then begin." />
      <section className="quick-start-review" aria-label="Plan summary">
        <div className="quick-start-review__heading"><div><p className="app-eyebrow">YOUR DAILY PLAN</p><h3>{tasks.length} Tasks · every day</h3><p>Deadline 12:00 AM IST · Forfeit: {sameForAll ? (sharedForfeit === '__custom__' ? customForfeit || 'custom choice' : sharedForfeit) : 'one choice per Task'}</p></div><button className="quick-start-text-button" type="button" onClick={() => setStep(1)}>Edit Tasks</button></div>
        <div className="quick-start-review__forfeit-link"><span><AppIcon name="shield" />Forfeit details</span><button className="quick-start-text-button" type="button" onClick={() => setStep(2)}>Edit Forfeit</button></div>
        <ul className="quick-start-review__tasks">
          {tasks.map((task, index) => <li key={task.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{task.name}</strong><small>{sameForAll ? (sharedForfeit === '__custom__' ? customForfeit : sharedForfeit) : task.actionTitle}</small></div></li>)}
        </ul>
      </section>
      <div className="quick-start-facts">
        <p><span className="quick-start-facts__icon" aria-hidden="true"><AppIcon name="activity" /></span><span className="quick-start-facts__text"><TermText>Do at least 5 a day to build your Streak.</TermText></span></p>
        <p><span className="quick-start-facts__icon" aria-hidden="true"><AppIcon name="shield" /></span><span className="quick-start-facts__text"><TermText>You start with 3 lives (Grace Points).</TermText></span></p>
        <p><span className="quick-start-facts__icon" aria-hidden="true"><AppIcon name="clock" /></span><span className="quick-start-facts__text"><TermText>A missed Task gives you 72 hours to complete its Recovery Quest.</TermText></span></p>
      </div>
      <label className="quick-start-acknowledgement"><input type="checkbox" checked={rulesAcknowledged} onChange={(event) => setRulesAcknowledged(event.target.checked)} /><span>I understand the rules.</span><Link to="/rules#the-60-second-version" target="_blank" rel="noreferrer">Read the full rules</Link></label>
      {saveError && <p className="quick-start-form-error" role="alert">{saveError}</p>}
      <div className="quick-start-actions quick-start-actions--split">
        <button className="quick-start-secondary-button" type="button" onClick={() => setStep(2)}>Back</button>
        <button className="quick-start-primary-button" type="button" onClick={startPlan} disabled={!rulesAcknowledged || !taskStepValid || !forfeitStepValid || !validation.valid || saving}>{saving ? 'Starting your plan…' : 'Start my plan'} <AppIcon name="arrow" /></button>
      </div>
    </section>}

    {step === 1 && <footer className="quick-start-page__footer"><button className="quick-start-text-button" type="button" onClick={onCancel}>Cancel and return to Tasks</button></footer>}
  </main>;
}
