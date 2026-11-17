import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ranks } from '../../data/ranks.js';
import { dashboardDemo } from '../../data/dashboardDemo.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import RankBadge from '../../components/ranks/RankBadge.jsx';
import AppIcon from '../../components/app/AppIcon.jsx';
import AppProgressBar from '../../components/app/AppProgressBar.jsx';
import GracePointSummary from '../../components/app/GracePointSummary.jsx';
import DisciplinePointsSummary from '../../components/app/DisciplinePointsSummary.jsx';
import EmergencyPauseControls from '../../components/app/EmergencyPauseControls.jsx';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
import { RECOVERY_STATUS } from '../../utils/recoveryQuestManager.js';
import { getIstDateKey } from '../../utils/taskScheduleBuilder.js';
import { getRankDisciplineConfig } from '../../data/disciplineConfig.js';
import { getLevelFromTotalXp, getLevelProgress } from '../../utils/disciplineManager.js';
import { getScheduleDaySnapshot } from '../../utils/disciplineActivity.js';
import '../../styles/public-pages.css';

function buildRecentEvents(schedule, recoveryState, disciplineState) {
  const taskEvents = Object.entries(schedule?.occurrences || {}).filter(([, occurrence]) => occurrence.status === 'completed').map(([key, occurrence]) => {
    const [, , date] = key.split(':');
    return { id: `task:${key}`, date, icon: 'tasks', title: 'Scheduled Task completed', detail: occurrence.snapshot?.name || 'Completed scheduled Task' };
  });
  const recoveryEvents = (recoveryState.activity || []).map((event) => ({ ...event, icon: event.kind === 'completed' ? 'tasks' : 'recovery' }));
  const xpDrainEvents = disciplineState.xpDrainEvents.filter((event) => event.amount > 0).map((event) => ({ id: event.id, date: event.date, icon: 'activity', title: 'Recovery Quest XP drain', detail: `−${event.amount.toFixed(2)} XP from ${event.activeRecoveryQuestCount} Active Recovery Quests` }));
  const rankXpEvents = disciplineState.dailyRankXpEvents.filter((event) => event.amount > 0).map((event) => ({ id: event.id, date: event.date, icon: 'spark', title: 'Daily Rank XP benefit', detail: `+${event.amount} XP · Rank ${event.rankName}` }));
  const pointEvents = disciplineState.dpEvents.filter((event) => event.amount > 0).map((event) => ({ id: event.id, date: event.date, icon: 'activity', title: 'Discipline Points awarded', detail: `+${event.amount.toFixed(2)} DP · ${event.title}` }));
  return [...taskEvents, ...recoveryEvents, ...xpDrainEvents, ...rankXpEvents, ...pointEvents]
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))
    .slice(0, 4)
    .map((event) => ({ ...event, time: event.date === getIstDateKey() ? 'Today' : event.date || 'Recorded' }));
}

export default function DashboardPage() {
  const { recoveryState, disciplineState, currentSchedule } = useTaskSchedule();
  const pageRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const rank = ranks.find((item) => item.slug === disciplineState.currentRankSlug) || ranks[0];
  const activeRecoveryQuests = recoveryState.quests.filter((quest) => quest.status === RECOVERY_STATUS.ACTIVE);
  const activeRecoveryCount = activeRecoveryQuests.length;
  const nearestRecoveryDays = activeRecoveryQuests.length ? Math.min(...activeRecoveryQuests.map((quest) => quest.remainingDays)) : null;
  const today = getIstDateKey(new Date());
  const todaySnapshot = getScheduleDaySnapshot(currentSchedule, today, { todayKey: today });
  const completedTasks = todaySnapshot.completedTaskCount;
  const scheduledTaskCount = todaySnapshot.scheduledTaskCount;
  const taskCompletion = scheduledTaskCount ? Math.round((completedTasks / scheduledTaskCount) * 100) : 0;
  const todayTasks = todaySnapshot.tasks.map((task, index) => {
    const definition = currentSchedule.tasks.find((item) => item.id === task.id) || currentSchedule.taskHistory.find((item) => item.id === task.id);
    return { id: task.id, title: definition?.name || `Scheduled task ${index + 1}`, completed: task.status === 'completed', status: task.status };
  });
  const currentLevel = getLevelFromTotalXp(disciplineState.totalXp);
  const levelProgress = getLevelProgress(disciplineState.totalXp);
  const rankReward = getRankDisciplineConfig(disciplineState.cycle.rankSlug);
  const recentEvents = buildRecentEvents(currentSchedule, recoveryState, disciplineState);

  useLayoutEffect(() => {
    if (reduceMotion || !pageRef.current) return undefined;
    const context = gsap.context(() => {
      gsap.from('.dashboard-reveal', {
        y: 14,
        autoAlpha: 0,
        duration: 0.42,
        stagger: 0.055,
        ease: 'power2.out',
        clearProps: 'opacity,visibility,transform',
      });
      gsap.from('.app-progress__fill', {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 0.62,
        delay: 0.14,
        stagger: 0.05,
        ease: 'power2.out',
        clearProps: 'transform',
      });
    }, pageRef);
    return () => context.revert();
  }, [reduceMotion]);

  return (
    <div className="dashboard-page" ref={pageRef}>
      <header className="dashboard-welcome dashboard-reveal">
        <div><p className="app-eyebrow">PLAYER OVERVIEW</p><h1>Welcome back.</h1><p>Your progress is built through consistent action.</p></div>
        <span className="app-demo-label"><i aria-hidden="true" />DEMONSTRATION DATA</span>
      </header>

      <div className="dashboard-feature-grid">
        <section className="app-panel dashboard-rank-panel dashboard-reveal" aria-labelledby="dashboard-rank-heading" style={{ '--rank-accent': rank.color }}>
          <div className="dashboard-rank-panel__badge"><RankBadge rank={rank} serialNumber={rank.demo.exampleSerial} size="medium" /></div>
          <div className="dashboard-rank-panel__details">
            <div className="dashboard-rank-panel__member">
              <strong>{dashboardDemo.member.displayName}</strong>
              <span>{dashboardDemo.member.email}</span>
            </div>
            <p className="app-eyebrow">CURRENT RANK · EXAMPLE</p>
            <h2 id="dashboard-rank-heading">Rank {rank.number} — {rank.name}</h2>
            <p>{rank.shortDescription}</p>
            <div className="dashboard-rank-panel__meta">
              <span className="dashboard-badge-state"><AppIcon name="shield" />Example badge</span>
              <span className="dashboard-rank-panel__position">Progression <b>·</b> {rank.progressionOrder} of 7</span>
            </div>
            <Link className="app-action-link" to={`/ranks/${rank.slug}`}>Explore Rank <AppIcon name="arrow" /></Link>
            <EmergencyPauseControls />
          </div>
        </section>

        <section className="app-panel dashboard-level-panel dashboard-reveal" aria-labelledby="dashboard-level-heading">
          <div className="app-panel__heading"><div><p className="app-eyebrow">LEVEL & XP · EXAMPLE</p><h2 id="dashboard-level-heading">Progress snapshot</h2></div><span className="dashboard-level-panel__icon"><AppIcon name="spark" /></span></div>
          <div className="dashboard-level-panel__values"><div><span>Current Level</span><strong>{String(currentLevel).padStart(2, '0')}</strong></div><div><span>Total XP</span><strong>{disciplineState.totalXp.toLocaleString('en-US')}</strong></div></div>
          <AppProgressBar value={levelProgress.percent} label="Progress to next Level" description={`${levelProgress.earnedInLevel} of ${levelProgress.requirement} XP toward the next Level using demonstration thresholds.`} />
          <p className="app-panel__note">Session preview thresholds. Rank XP and Recovery Quest drains use this shared demonstration progression.</p>
        </section>
      </div>

      <div className="dashboard-content-grid dashboard-content-grid--primary">
        <section className="app-panel dashboard-tasks-panel dashboard-reveal" aria-labelledby="dashboard-tasks-heading">
          <div className="app-panel__heading"><div><p className="app-eyebrow">TODAY · SHARED SCHEDULE</p><h2 id="dashboard-tasks-heading">Today's Tasks</h2></div><span className="dashboard-panel-count">{completedTasks}<i>/</i>{scheduledTaskCount}</span></div>
          <div className="dashboard-task-summary"><strong>{taskCompletion}%</strong><span>complete <i>· equal Task weighting</i></span><AppProgressBar value={taskCompletion} label="Today's Task completion" description={`${completedTasks} of ${scheduledTaskCount} scheduled Tasks completed; Tasks are equally weighted.`} /></div>
          <ul className="dashboard-task-list">
            {todayTasks.map((task, index) => (
              <li className={task.completed ? 'is-complete' : ''} key={task.id}>
                <span className="dashboard-task-list__status" aria-label={task.completed ? 'Completed Task' : `${task.status} Task`}>{task.completed ? <AppIcon name="tasks" /> : <span>{String(index + 1).padStart(2, '0')}</span>}</span>
                <span>{task.title}</span>
                <small>{task.completed ? 'COMPLETE' : task.status.toUpperCase()}</small>
              </li>
            ))}
          </ul>
          <Link className="app-panel__footer-link" to="/app/tasks">View All Tasks <AppIcon name="arrow" /></Link>
        </section>

        <div className="dashboard-side-stack">
          <section className="app-panel dashboard-recovery-panel dashboard-reveal" aria-labelledby="dashboard-recovery-heading">
            <div className="app-panel__heading"><div><p className="app-eyebrow">RECOVERY · SHARED PREVIEW</p><h2 id="dashboard-recovery-heading">Recovery Quests</h2></div><span className="dashboard-panel-count">{activeRecoveryCount} active</span></div>
            {activeRecoveryCount >= 4 && <p className="dashboard-recovery-limit">{activeRecoveryCount}/5 active · {activeRecoveryCount === 5 ? 'next quest triggers the limit' : 'approaching the active limit'}</p>}
            {nearestRecoveryDays !== null && <p className="dashboard-recovery-nearest">Nearest Recovery Window: <strong>{nearestRecoveryDays} demonstration {nearestRecoveryDays === 1 ? 'day' : 'days'} shown</strong></p>}
            <ul className="dashboard-quest-list">
              {activeRecoveryQuests.slice(0, 2).map((quest) => (
                <li className="dashboard-quest-list__item dashboard-quest-list__item--active" key={quest.id}>
                  <span className="dashboard-quest-list__icon"><AppIcon name="clock" /></span>
                  <span><strong>{quest.accountabilityActionTitle}</strong><small>From: {quest.originalTaskName} · {quest.remainingDays} demonstration {quest.remainingDays === 1 ? 'day' : 'days'} shown</small></span>
                  <i>ACTIVE</i>
                </li>
              ))}
              {!activeRecoveryCount && <li className="dashboard-quest-list__empty">No active Recovery Quests.</li>}
            </ul>
            <Link className="app-panel__footer-link" to="/app/recovery-quests">View Recovery Quests <AppIcon name="arrow" /></Link>
          </section>

          <GracePointSummary compact recoveryState={recoveryState} />
        </div>
      </div>

      <div className="dashboard-content-grid dashboard-content-grid--secondary">
        <DisciplinePointsSummary compact disciplineState={disciplineState} />

        <section className="app-panel dashboard-discipline-panel dashboard-reveal" aria-labelledby="dashboard-discipline-heading">
          <div className="app-panel__heading"><div><p className="app-eyebrow">DAILY CONSISTENCY · SHARED STATE</p><h2 id="dashboard-discipline-heading">Discipline</h2></div><Link className="app-panel__small-link" to="/app/discipline">View details <AppIcon name="arrow" /></Link></div>
          <div className="dashboard-discipline-stats"><div><strong>{disciplineState.currentStreak}</strong><span>current streak days</span></div><div><strong>{disciplineState.longestStreak}</strong><span>longest streak days</span></div></div>
          <p className="dashboard-discipline-cycle">Next Rank {rankReward.number} reward <strong>+{disciplineState.cycle.rewardDp.toFixed(2)} DP</strong> · {disciplineState.cycle.progress}/{disciplineState.cycle.requiredDays} qualifying days</p>
          <Link className="app-panel__footer-link" to="/app/discipline">Open Discipline <AppIcon name="arrow" /></Link>
        </section>
      </div>

      <section className="app-panel dashboard-activity-panel dashboard-reveal" aria-labelledby="dashboard-activity-heading">
        <div className="app-panel__heading"><div><p className="app-eyebrow">RECENT ACTIVITY · SHARED STATE</p><h2 id="dashboard-activity-heading">Activity timeline</h2></div><span className="dashboard-activity-panel__label">THIS SESSION</span></div>
        <ol className="dashboard-activity-list">
          {recentEvents.map((event) => (
            <li key={event.id}><span className="dashboard-activity-list__icon"><AppIcon name={event.icon} /></span><div><strong>{event.title}</strong><p>{event.detail}</p></div><time>{event.time}</time></li>
          ))}
          {!recentEvents.length && <li className="dashboard-activity-list__empty">No completed scheduled-task or progression events have been recorded in this session.</li>}
        </ol>
      </section>

      <p className="dashboard-disclosure"><AppIcon name="activity" />{dashboardDemo.disclosure}</p>
    </div>
  );
}
