import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import AppIcon from '../../components/app/AppIcon.jsx';
import DailyTaskSummary from '../../components/tasks/DailyTaskSummary.jsx';
import TaskCard from '../../components/tasks/TaskCard.jsx';
import TaskCyclePanel from '../../components/tasks/TaskCyclePanel.jsx';
import TaskSubmissionDialog from '../../components/tasks/TaskSubmissionDialog.jsx';
import TaskChangeDialog from '../../components/tasks/TaskChangeDialog.jsx';
import { dailyTaskMilestones, dailyTasksDemo, dailyTaskScheduleDemo } from '../../data/dailyTasksDemo.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { getDailyTaskMetrics, getIstScheduleContext } from '../../utils/dailyTaskProgress.js';
import { getCycleDay, getIstDateKey, getTaskOccurrenceKey } from '../../utils/taskScheduleBuilder.js';
import { consumeWeeklyChange, getWeeklyChangeAllowance } from '../../utils/weeklyTaskChanges.js';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
import '../../styles/daily-tasks.css';

export default function DailyTasksPage() {
  const pageRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const { currentSchedule, setCurrentSchedule, weeklyAllowance, setWeeklyAllowance } = useTaskSchedule();
  const referenceDate = dailyTaskScheduleDemo.taskChangesWeekDate;
  const allowance = useMemo(() => getWeeklyChangeAllowance(weeklyAllowance, referenceDate), [weeklyAllowance, referenceDate]);
  const currentDateKey = getIstDateKey(new Date());
  const schedule = useMemo(() => {
    if (!currentSchedule) return getIstScheduleContext(new Date(), dailyTaskScheduleDemo.cycleLength, dailyTaskScheduleDemo.cycleDayOneDate);
    const context = getIstScheduleContext(new Date(), currentSchedule.cycleLength, currentSchedule.startDate);
    return { ...context, cycleDay: getCycleDay(new Date(), currentSchedule.cycleLength, currentSchedule.startDate) };
  }, [currentSchedule]);
  const currentDayTasks = useMemo(() => {
    if (!currentSchedule) return dailyTasksDemo.map((task) => ({ ...task }));
    return currentSchedule.tasks
      .filter((task) => task.cycleDays.includes(schedule.cycleDay))
      .map((task, index) => {
        const occurrenceKey = getTaskOccurrenceKey(task.id, schedule.cycleDay, currentDateKey);
        const occurrence = currentSchedule.occurrences?.[occurrenceKey];
        const visibleTask = occurrence?.snapshot ? { ...task, ...occurrence.snapshot } : task;
        return { ...visibleTask, number: index + 1, occurrenceKey,
          status: occurrence?.status || (currentSchedule.source === 'demo' ? task.status : 'scheduled'),
          details: visibleTask.description || 'No additional task details were added.',
          accountabilityAction: visibleTask.actionTitle || visibleTask.accountabilityAction,
          accountabilityActionDescription: visibleTask.actionDescription || visibleTask.accountabilityActionDescription };
      });
  }, [currentSchedule, schedule.cycleDay, currentDateKey]);
  const [tasks, setTasks] = useState(() => currentDayTasks);
  const [submissionTask, setSubmissionTask] = useState(null);
  const [changeTarget, setChangeTarget] = useState(null);
  const [feedback, setFeedback] = useState('');
  const metrics = useMemo(() => getDailyTaskMetrics(tasks), [tasks]);

  useEffect(() => setTasks(currentDayTasks), [currentDayTasks]);

  useLayoutEffect(() => {
    if (reducedMotion || !pageRef.current) return undefined;
    const context = gsap.context(() => {
      gsap.from('.daily-task-reveal', { y: 12, autoAlpha: 0, duration: 0.38, stagger: 0.045, ease: 'power2.out', clearProps: 'opacity,visibility,transform' });
    }, pageRef);
    return () => context.revert();
  }, [reducedMotion]);

  const submitCompletion = (taskId, submission) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status !== 'scheduled') return;
    setTasks((current) => current.map((item) => item.id === taskId ? { ...item, status: 'submitted', submission } : item));
    saveOccurrence(task, 'submitted', { submission });
    setSubmissionTask(null);
    setFeedback(`“${task.name}” is submitted for verification in this preview. It has not been marked completed and no XP has been awarded.`);
  };

  const markMissedForPreview = (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status !== 'scheduled') return;
    setTasks((current) => current.map((item) => item.id === taskId ? { ...item, status: 'missed' } : item));
    saveOccurrence(task, 'missed');
    setFeedback(`“${task.name}” is marked missed in this local preview. Its own Accountability Action is shown as its Recovery Quest.`);
  };

  const markCompletedForPreview = (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status !== 'submitted') return;
    setTasks((current) => current.map((item) => item.id === taskId ? { ...item, status: 'completed' } : item));
    saveOccurrence(task, 'completed');
    setFeedback(`“${task.name}” is set to Completed for this preview only. No proof was checked and no XP has been awarded.`);
  };

  const saveOccurrence = (task, status, extra = {}) => {
    if (!currentSchedule || !task?.occurrenceKey) return;
    setCurrentSchedule((current) => ({
      ...current,
      occurrences: {
        ...(current.occurrences || {}),
        [task.occurrenceKey]: {
          ...(current.occurrences?.[task.occurrenceKey] || {}), status,
          snapshot: current.occurrences?.[task.occurrenceKey]?.snapshot || {
            name: task.name, description: task.description,
            actionTitle: task.actionTitle || task.accountabilityAction,
            actionDescription: task.actionDescription || task.accountabilityActionDescription,
          },
          ...extra,
        },
      },
    }));
  };

  const confirmTaskChange = ({ taskId, mode, draft }) => {
    const consumed = consumeWeeklyChange(weeklyAllowance, referenceDate);
    const original = currentSchedule?.tasks.find((item) => item.id === taskId);
    const visible = tasks.find((item) => item.id === taskId);
    if (!original || !visible || visible.status !== 'scheduled' || !consumed.allowed) return;

    const nextTasks = currentSchedule.tasks.map((item) => item.id === taskId
      ? { ...item, ...draft, name: draft.name.trim(), cycleDays: [...draft.cycleDays] }
      : item);
    const invalidDay = Array.from({ length: currentSchedule.cycleLength }, (_, index) => index + 1)
      .map((day) => ({ day, count: nextTasks.filter((item) => item.cycleDays.includes(day)).length }))
      .find(({ count }) => count < 7);
    if (invalidDay) {
      setFeedback(`Change blocked: Day ${String(invalidDay.day).padStart(2, '0')} would have ${invalidDay.count} scheduled Tasks; add ${7 - invalidDay.count} more to keep the 7-Task minimum.`);
      setChangeTarget(null);
      return;
    }

    const historyEntry = { ...original, changedAt: currentDateKey, changeType: mode };
    setCurrentSchedule((current) => ({ ...current, tasks: nextTasks, taskHistory: [...(current.taskHistory || []), historyEntry] }));
    setWeeklyAllowance(consumed.allowance);
    setChangeTarget(null);
    setFeedback(`“${original.name}” was updated for future occurrences. One weekly Task change was used (${consumed.current.used + 1}/${consumed.current.maximum}). Existing history and Recovery Quests remain unchanged.`);
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
          <span className="app-demo-label"><i aria-hidden="true" />DEMONSTRATION DATA</span>
          <Link className="button button--primary daily-tasks-create-link" to="/app/tasks/create">Create Schedule <span aria-hidden="true">↗</span></Link>
          <div className="daily-tasks-date"><AppIcon name="clock" /><span><strong>{schedule.weekday}, {schedule.scheduleDate}</strong><small>Daily deadline · 12:00 AM IST (India Standard Time)</small></span></div>
        </div>
      </header>

      {feedback && <div className="daily-task-feedback daily-task-reveal" role="status" aria-live="polite"><AppIcon name="shield" /><p>{feedback}</p><button type="button" aria-label="Dismiss message" onClick={() => setFeedback('')}><AppIcon name="close" /></button></div>}

      <div className="daily-task-overview-grid daily-task-reveal">
        <DailyTaskSummary metrics={metrics} milestones={dailyTaskMilestones} />
        <TaskCyclePanel context={schedule} allowance={allowance} />
      </div>

      <section className="daily-task-list-section" aria-labelledby="daily-task-list-title">
        <div className="daily-task-list-heading daily-task-reveal">
        <div><p className="app-eyebrow">{schedule.weekday.toUpperCase()} · {currentSchedule ? 'YOUR SCHEDULE' : 'EXAMPLE SCHEDULE'}</p><h2 id="daily-task-list-title">Your scheduled tasks</h2><p>{currentSchedule ? 'Your current cycle-day schedule is shown below. This frontend preview resets on refresh.' : 'Seven demonstration tasks for this schedule. The number shown is not a maximum.'}</p></div>
          <span className="daily-task-list-heading__count">{metrics.completed}<i>/</i>{metrics.total}<small>completed</small></span>
        </div>
        <ol className="daily-task-list">
          {tasks.map((task) => <TaskCard key={task.id} task={task} onSubmit={setSubmissionTask} onMarkMissed={markMissedForPreview} onMarkCompleted={markCompletedForPreview} onModify={(selectedTask, mode) => setChangeTarget({ task: selectedTask, mode })} canModify={allowance.remaining > 0} changesExhausted={allowance.remaining === 0} />)}
        </ol>
      </section>

      <section className="app-panel daily-recovery-explainer daily-task-reveal" aria-labelledby="daily-recovery-title">
        <div className="daily-recovery-explainer__icon"><AppIcon name="recovery" /></div>
        <div className="daily-recovery-explainer__copy">
          <p className="app-eyebrow">MISSED TASKS · RECOVERY QUESTS</p>
          <h2 id="daily-recovery-title">What happens when a task is missed?</h2>
          <p>When a scheduled task is missed, its associated Accountability Action activates as a Recovery Quest. The ordinary missed task does not carry forward; only its associated Recovery Quest does.</p>
          <ul>
            <li>Each Recovery Quest has a three-day Recovery Window and must be completed before its deadline.</li>
            <li>If it expires incomplete, one Grace Charge is deducted.</li>
            <li>If the System detects three failed quests in a day, another Grace Charge is deducted. Both conditions can apply on the same day.</li>
          </ul>
          <Link className="dashboard-text-link" to="/app/recovery-quests">Open Recovery Quests <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <p className="daily-tasks-disclosure"><AppIcon name="activity" />This page uses local demonstration data only. Changes reset on refresh and are not saved to an account or sent for real verification.</p>

      <TaskSubmissionDialog task={submissionTask} onClose={() => setSubmissionTask(null)} onSubmit={submitCompletion} />
      <TaskChangeDialog task={changeTarget?.task} mode={changeTarget?.mode} cycleLength={currentSchedule?.cycleLength || dailyTaskScheduleDemo.cycleLength} tasks={currentSchedule?.tasks || []} allowance={allowance} onConfirm={confirmTaskChange} onClose={() => setChangeTarget(null)} />
    </div>
  );
}
