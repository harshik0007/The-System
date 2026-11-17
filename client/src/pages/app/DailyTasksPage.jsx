import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import AppIcon from '../../components/app/AppIcon.jsx';
import DailyTaskSummary from '../../components/tasks/DailyTaskSummary.jsx';
import TaskCard from '../../components/tasks/TaskCard.jsx';
import TaskCyclePanel from '../../components/tasks/TaskCyclePanel.jsx';
import TaskSubmissionDialog from '../../components/tasks/TaskSubmissionDialog.jsx';
import { dailyTaskMilestones, dailyTasksDemo, dailyTaskScheduleDemo } from '../../data/dailyTasksDemo.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { getDailyTaskMetrics, getIstScheduleContext } from '../../utils/dailyTaskProgress.js';
import { getCycleDay } from '../../utils/taskScheduleBuilder.js';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
import '../../styles/daily-tasks.css';

export default function DailyTasksPage() {
  const pageRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const { currentSchedule } = useTaskSchedule();
  const schedule = useMemo(() => {
    if (!currentSchedule) return getIstScheduleContext(new Date(), dailyTaskScheduleDemo.cycleLength, dailyTaskScheduleDemo.cycleDayOneDate);
    const context = getIstScheduleContext(new Date(), currentSchedule.cycleLength, currentSchedule.startDate);
    return { ...context, cycleDay: getCycleDay(new Date(), currentSchedule.cycleLength, currentSchedule.startDate) };
  }, [currentSchedule]);
  const currentDayTasks = useMemo(() => {
    if (!currentSchedule) return dailyTasksDemo.map((task) => ({ ...task }));
    return currentSchedule.tasks
      .filter((task) => task.cycleDays.includes(schedule.cycleDay))
      .map((task, index) => ({
        ...task,
        number: index + 1,
        status: 'scheduled',
        details: task.description || 'No additional task details were added.',
        accountabilityAction: task.actionTitle,
        accountabilityActionDescription: task.actionDescription,
      }));
  }, [currentSchedule, schedule.cycleDay]);
  const [tasks, setTasks] = useState(() => currentDayTasks);
  const [submissionTask, setSubmissionTask] = useState(null);
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
    setSubmissionTask(null);
    setFeedback(`“${task.name}” is submitted for verification in this preview. It has not been marked completed and no XP has been awarded.`);
  };

  const markMissedForPreview = (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status !== 'scheduled') return;
    setTasks((current) => current.map((item) => item.id === taskId ? { ...item, status: 'missed' } : item));
    setFeedback(`“${task.name}” is marked missed in this local preview. Its own Accountability Action is shown as its Recovery Quest.`);
  };

  const markCompletedForPreview = (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status !== 'submitted') return;
    setTasks((current) => current.map((item) => item.id === taskId ? { ...item, status: 'completed' } : item));
    setFeedback(`“${task.name}” is set to Completed for this preview only. No proof was checked and no XP has been awarded.`);
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
        <TaskCyclePanel context={schedule} changesAllowed={dailyTaskScheduleDemo.taskChangesAllowed} changesUsed={currentSchedule ? 0 : dailyTaskScheduleDemo.taskChangesUsed} />
      </div>

      <section className="daily-task-list-section" aria-labelledby="daily-task-list-title">
        <div className="daily-task-list-heading daily-task-reveal">
        <div><p className="app-eyebrow">{schedule.weekday.toUpperCase()} · {currentSchedule ? 'YOUR SCHEDULE' : 'EXAMPLE SCHEDULE'}</p><h2 id="daily-task-list-title">Your scheduled tasks</h2><p>{currentSchedule ? 'Your current cycle-day schedule is shown below. This frontend preview resets on refresh.' : 'Seven demonstration tasks for this schedule. The number shown is not a maximum.'}</p></div>
          <span className="daily-task-list-heading__count">{metrics.completed}<i>/</i>{metrics.total}<small>completed</small></span>
        </div>
        <ol className="daily-task-list">
          {tasks.map((task) => <TaskCard key={task.id} task={task} onSubmit={setSubmissionTask} onMarkMissed={markMissedForPreview} onMarkCompleted={markCompletedForPreview} />)}
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
    </div>
  );
}
