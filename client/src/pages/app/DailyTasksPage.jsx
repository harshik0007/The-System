import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import AppIcon from '../../components/app/AppIcon.jsx';
import PageLoadingSkeleton, { SkeletonLine } from '../../components/app/PageLoadingSkeleton.jsx';
import DailyTaskSummary from '../../components/tasks/DailyTaskSummary.jsx';
import TaskCard from '../../components/tasks/TaskCard.jsx';
import TaskCyclePanel from '../../components/tasks/TaskCyclePanel.jsx';
import TaskChangeDialog from '../../components/tasks/TaskChangeDialog.jsx';
import TaskSubmissionDialog from '../../components/tasks/TaskSubmissionDialog.jsx';
import { useTaskBackend } from '../../context/TaskBackendContext.jsx';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { getDailyTaskMetrics } from '../../utils/dailyTaskProgress.js';
import { selectEligibleTaskOccurrences } from '../../utils/taskOccurrenceSelection.js';
import { formatTaskDateKey } from '../../utils/taskScheduleBuilder.js';
import { createIdempotencyKey, taskApi } from '../../services/taskApi.js';
import '../../styles/daily-tasks.css';

function taskForCard(task, number) {
  const action = task.accountabilityAction || {};
  return {
    ...task,
    id: task.id,
    number,
    name: task.title || task.name,
    details: task.description || 'No additional Task details were added.',
    accountabilityAction: task.actionTitle || action.title || '',
    accountabilityActionDescription: task.actionDescription || action.description || '',
    weakness: task.weakness || action.weakness || '',
  };
}

function occurrenceForCard(occurrence, number) {
  const snapshot = occurrence.snapshot || {};
  const action = snapshot.accountabilityAction || {};
  return taskForCard({
    id: occurrence.taskId,
    occurrenceId: occurrence.id,
    status: occurrence.status,
    title: snapshot.title,
    description: snapshot.description,
    cycleDays: [occurrence.cycleDay],
    actionTitle: snapshot.actionTitle || action.title,
    actionDescription: snapshot.actionDescription || action.description,
    weakness: snapshot.weakness || action.weakness,
  }, number);
}

export default function DailyTasksPage() {
  const pageRef = useRef(null);
  const idempotencyKeyRef = useRef(createIdempotencyKey());
  const reducedMotion = useReducedMotion();
  const { schedule, tasks: taskDefinitions, occurrences, allowance, todayDate, todayLabel, todayCycleDay, loading, error, refresh, refreshRecovery, clearError } = useTaskBackend();
  const [changeTarget, setChangeTarget] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [changeSaving, setChangeSaving] = useState(false);
  const [changeError, setChangeError] = useState('');
  const changeSaveLockRef = useRef(false);
  const [submissionTarget, setSubmissionTarget] = useState(null);
  const [submissionSaving, setSubmissionSaving] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const submissionLockRef = useRef(false);

  const activeTasks = useMemo(() => taskDefinitions.filter((task) => task.status === 'active').map(taskForCard), [taskDefinitions]);
  const currentDayTasks = useMemo(() => selectEligibleTaskOccurrences(occurrences, todayDate, todayCycleDay)
    .map(occurrenceForCard), [occurrences, todayDate, todayCycleDay]);
  const metrics = useMemo(() => getDailyTaskMetrics(currentDayTasks), [currentDayTasks]);

  useLayoutEffect(() => {
    if (reducedMotion || !pageRef.current) return undefined;
    const context = gsap.context(() => {
      gsap.from('.daily-task-reveal', { y: 12, autoAlpha: 0, duration: 0.38, stagger: 0.045, ease: 'power2.out', clearProps: 'opacity,visibility,transform' });
    }, pageRef);
    return () => context.revert();
  }, [reducedMotion, loading, schedule]);

  const confirmTaskChange = async ({ taskId, mode, draft }) => {
    if (changeSaveLockRef.current) return;
    changeSaveLockRef.current = true;
    setChangeSaving(true);
    setChangeError('');
    let effectiveDate = null;
    try {
      if (mode === 'delete') {
        const result = await taskApi.deleteTask(taskId, idempotencyKeyRef.current);
        effectiveDate = result.task?.effectiveDate || null;
      } else if (mode === 'reschedule') {
        await taskApi.rescheduleTask(taskId, draft.cycleDays, idempotencyKeyRef.current);
      } else {
        const patch = {
          title: draft.name,
          description: draft.description,
          accountabilityAction: { title: draft.actionTitle, description: draft.actionDescription },
        };
        await taskApi.updateTask(taskId, patch, idempotencyKeyRef.current);
      }
      idempotencyKeyRef.current = createIdempotencyKey();
      setChangeTarget(null);
      await refresh();
      setFeedback(mode === 'delete'
        ? `Delete Task is pending until ${formatTaskDateKey(effectiveDate)}. Today's scheduled occurrence remains available; previous occurrences and snapshots are preserved.`
        : mode === 'reschedule'
          ? 'Task rescheduled from the next IST date. Current and historical occurrences were preserved.'
          : 'Task updated for future dates. Current and historical snapshots were preserved.');
    } catch (requestError) {
      setChangeError(requestError.message || 'The Task change could not be saved.');
    } finally {
      changeSaveLockRef.current = false;
      setChangeSaving(false);
    }
  };

  const submitTaskCompletion = async (occurrenceId, submission) => {
    if (submissionLockRef.current) return;
    submissionLockRef.current = true;
    setSubmissionSaving(true);
    setSubmissionError('');
    try {
      const result = await taskApi.completeOccurrence(occurrenceId, submission, idempotencyKeyRef.current);
      idempotencyKeyRef.current = createIdempotencyKey();
      setSubmissionTarget(null);
      await refresh();
      await refreshRecovery();
      if (result.idempotentReplay) {
        setFeedback('This Task completion was already recorded. No duplicate XP or Rank reward was added.');
      } else {
        const award = result.xpReward;
        const creditedText = award?.creditedXp && Number(award.creditedXp) > 0
          ? `+${Number(award.creditedXp).toFixed(2)} XP credited`
          : 'No ordinary XP remained under today’s cap';
        const rankRewardText = (result.rankEntryRewards || []).map((reward) => {
          const xpText = reward.xpRewardConfigured ? `+${Number(reward.creditedXpReward).toLocaleString('en-US')} XP` : 'Rank-entry XP is not configured';
          return `Rank ${reward.rankName} entered · ${xpText} · +${Number(reward.creditedDpReward).toFixed(2)} DP`;
        }).join(' · ');
        setFeedback([
          `Task completed · ${creditedText}${award?.capped ? ' (daily cap applied)' : ''}.`,
          rankRewardText,
          result.progression ? `Current Rank ${result.progression.currentRank.name} · ${result.progression.currentRank.multiplierLabel} · ${Number(result.progression.dailyXp.remaining).toLocaleString('en-US')} daily XP remaining.` : '',
        ].filter(Boolean).join(' '));
      }
    } catch (requestError) {
      setSubmissionError(requestError.message || 'The Task completion could not be saved.');
    } finally {
      submissionLockRef.current = false;
      setSubmissionSaving(false);
    }
  };

  return (
    <div className="daily-tasks-page" ref={pageRef}>
      <header className="daily-tasks-header daily-task-reveal">
        <div className="daily-tasks-header__copy">
          <p className="app-eyebrow">MY PROGRESS · DAILY SCHEDULE</p>
          <h1>Daily Tasks</h1>
          <p>Consistency is built through the actions you complete every day.</p>
        </div>
        <div className="daily-tasks-header__meta">
          <span className="app-demo-label"><i aria-hidden="true" />YOUR SCHEDULE</span>
          <Link className="button button--primary daily-tasks-create-link" to="/app/tasks/create">{schedule ? 'Manage Tasks' : 'Create Schedule'} <span aria-hidden="true">↗</span></Link>
          <div className="daily-tasks-date"><AppIcon name="clock" /><span><strong>{todayLabel || <SkeletonLine width="medium" label="Loading IST date" />}</strong><small>Daily deadline · 12:00 AM IST (India Standard Time)</small></span></div>
        </div>
      </header>

      {error && <div className="daily-task-feedback daily-task-reveal" role="alert"><AppIcon name="shield" /><p>{error}</p><button className="daily-task-feedback__retry" type="button" onClick={() => { clearError(); refresh(); }}><span aria-hidden="true">↻</span>Retry</button></div>}
      {feedback && <div className="daily-task-feedback daily-task-reveal" role="status" aria-live="polite"><AppIcon name="shield" /><p>{feedback}</p><button className="daily-task-feedback__dismiss" type="button" aria-label="Dismiss message" onClick={() => setFeedback('')}><AppIcon name="close" /></button></div>}

      {schedule && <div className="daily-task-overview-grid daily-task-reveal">
        <DailyTaskSummary metrics={metrics} />
        <TaskCyclePanel context={{ weekday: todayLabel?.split(',')[0] || '', scheduleDate: todayLabel || '', cycleDay: todayCycleDay, cycleLength: schedule.cycleLength }} allowance={allowance} />
      </div>}

      {!schedule && !loading && !error && <section className="app-panel daily-task-empty daily-task-reveal" aria-labelledby="daily-task-empty-title">
        <p className="app-eyebrow">NO ACTIVE SCHEDULE</p><h2 id="daily-task-empty-title">Create your Daily Schedule</h2><p>Set a repeating cycle, schedule at least seven original Tasks on each cycle day, and save them to THE SYSTEM.</p><Link className="button button--primary" to="/app/tasks/create">Start schedule setup <span aria-hidden="true">↗</span></Link>
      </section>}

      {schedule && <section className="daily-task-list-section" aria-labelledby="daily-task-list-title">
        <div className="daily-task-list-heading daily-task-reveal">
          <div><p className="app-eyebrow">CYCLE DAY {String(todayCycleDay || '—').padStart(2, '0')} · TODAY</p><h2 id="daily-task-list-title">Your scheduled Tasks</h2><p>Here are the Tasks planned for this day of your cycle.</p></div>
          <span className="daily-task-list-heading__count">{metrics.completed}<i>/</i>{metrics.total}<small>completed</small></span>
        </div>
        {loading && <PageLoadingSkeleton variant="rows" compact label="Loading today’s scheduled Tasks" />}
        {!loading && currentDayTasks.length > 0 && <ol className="daily-task-list">
          {currentDayTasks.map((task, index) => <TaskCard
            key={task.occurrenceId || `${task.id}-${todayDate}`}
            task={{ ...task, number: index + 1 }}
            backendMode
            onSubmit={(selectedTask) => { idempotencyKeyRef.current = createIdempotencyKey(); setSubmissionError(''); setSubmissionTarget(selectedTask); }}
            onModify={(selectedTask, mode) => { idempotencyKeyRef.current = createIdempotencyKey(); setChangeError(''); setChangeTarget({ task: activeTasks.find((item) => item.id === selectedTask.id) || selectedTask, mode }); }}
            canModify={allowance.remaining > 0}
          />)}
        </ol>}
        {!loading && currentDayTasks.length === 0 && <div className="task-builder-empty daily-task-reveal"><span aria-hidden="true">—</span><p>No Task occurrences are scheduled for this IST cycle day.</p><small>Tasks assigned to other cycle days remain in your active schedule.</small></div>}
        <p className="task-completion-pending daily-task-reveal" role="note"><AppIcon name="clock" />Completing a Task applies its saved XP share, current Rank multiplier and daily cap. Optional proof details are not AI-verified.</p>
      </section>}

      {changeTarget && <TaskChangeDialog
        task={changeTarget.task}
        mode={changeTarget.mode}
        cycleLength={schedule?.cycleLength || 7}
        tasks={activeTasks}
        allowance={allowance}
        onConfirm={confirmTaskChange}
        onClose={() => setChangeTarget(null)}
        saving={changeSaving}
        error={changeError}
      />}
      <TaskSubmissionDialog
        task={submissionTarget}
        onClose={() => setSubmissionTarget(null)}
        onSubmit={submitTaskCompletion}
        saving={submissionSaving}
        error={submissionError}
      />
    </div>
  );
}
