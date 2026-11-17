import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ranks } from '../../data/ranks.js';
import { dashboardDemo } from '../../data/dashboardDemo.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import RankBadge from '../../components/ranks/RankBadge.jsx';
import AppIcon from '../../components/app/AppIcon.jsx';
import AppProgressBar from '../../components/app/AppProgressBar.jsx';
import GraceChargeSummary from '../../components/app/GraceChargeSummary.jsx';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
import { RECOVERY_STATUS } from '../../utils/recoveryQuestManager.js';
import '../../styles/public-pages.css';

export default function DashboardPage() {
  const { recoveryState } = useTaskSchedule();
  const pageRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const rank = ranks.find((item) => item.slug === dashboardDemo.identity.rankSlug) || ranks[0];
  const completedTasks = dashboardDemo.tasks.filter((task) => task.completed).length;
  const taskCompletion = Math.round((completedTasks / dashboardDemo.tasks.length) * 100);
  const activeRecoveryQuests = recoveryState.quests.filter((quest) => quest.status === RECOVERY_STATUS.ACTIVE);
  const activeRecoveryCount = activeRecoveryQuests.length;
  const nearestRecoveryDays = activeRecoveryQuests.length ? Math.min(...activeRecoveryQuests.map((quest) => quest.remainingDays)) : null;

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
          </div>
        </section>

        <section className="app-panel dashboard-level-panel dashboard-reveal" aria-labelledby="dashboard-level-heading">
          <div className="app-panel__heading"><div><p className="app-eyebrow">LEVEL & XP · EXAMPLE</p><h2 id="dashboard-level-heading">Progress snapshot</h2></div><span className="dashboard-level-panel__icon"><AppIcon name="spark" /></span></div>
          <div className="dashboard-level-panel__values"><div><span>Current Level</span><strong>{String(dashboardDemo.identity.level).padStart(2, '0')}</strong></div><div><span>Total XP</span><strong>{dashboardDemo.identity.totalXp.toLocaleString('en-US')}</strong></div></div>
          <AppProgressBar value={dashboardDemo.identity.xpProgressPercent} label="Illustrative progress to next Level" description={dashboardDemo.identity.levelProgressLabel} />
          <p className="app-panel__note">Illustrative progress only. No XP formula or Level threshold is assigned.</p>
        </section>
      </div>

      <div className="dashboard-content-grid dashboard-content-grid--primary">
        <section className="app-panel dashboard-tasks-panel dashboard-reveal" aria-labelledby="dashboard-tasks-heading">
          <div className="app-panel__heading"><div><p className="app-eyebrow">TODAY · EXAMPLE SCHEDULE</p><h2 id="dashboard-tasks-heading">Today's Tasks</h2></div><span className="dashboard-panel-count">{completedTasks}<i>/</i>{dashboardDemo.tasks.length}</span></div>
          <div className="dashboard-task-summary"><strong>{taskCompletion}%</strong><span>complete <i>· equal Task weighting</i></span><AppProgressBar value={taskCompletion} label="Today's Task completion" description={`${completedTasks} of ${dashboardDemo.tasks.length} demonstration Tasks completed; Tasks are equally weighted.`} /></div>
          <ul className="dashboard-task-list">
            {dashboardDemo.tasks.map((task, index) => (
              <li className={task.completed ? 'is-complete' : ''} key={task.id}>
                <span className="dashboard-task-list__status" aria-label={task.completed ? 'Completed example Task' : 'Outstanding example Task'}>{task.completed ? <AppIcon name="tasks" /> : <span>{String(index + 1).padStart(2, '0')}</span>}</span>
                <span>{task.title}</span>
                <small>{task.completed ? 'COMPLETE' : 'SCHEDULED'}</small>
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

          <GraceChargeSummary compact recoveryState={recoveryState} />
        </div>
      </div>

      <div className="dashboard-content-grid dashboard-content-grid--secondary">
        <section className="app-panel dashboard-points-panel dashboard-reveal" aria-labelledby="dashboard-points-heading">
          <div className="app-panel__heading"><div><p className="app-eyebrow">LONG-TERM PROGRESSION · EXAMPLE</p><h2 id="dashboard-points-heading">Discipline Points</h2></div><span className="dashboard-points-panel__icon"><AppIcon name="activity" /></span></div>
          <div className="dashboard-points-panel__balance"><strong>{dashboardDemo.disciplinePoints.balance.toFixed(2)}</strong><span>/ {dashboardDemo.disciplinePoints.maximum} maximum</span></div>
          <AppProgressBar value={(dashboardDemo.disciplinePoints.balance / dashboardDemo.disciplinePoints.maximum) * 100} label="Demonstration Discipline Points balance" description={`${dashboardDemo.disciplinePoints.balance} of ${dashboardDemo.disciplinePoints.maximum} maximum example points`} />
          <p className="app-panel__note">{dashboardDemo.disciplinePoints.explanation}</p>
          <Link to="/rules#discipline-points" className="dashboard-text-link">Read the Discipline Points rule <span aria-hidden="true">↗</span></Link>
        </section>

        <section className="app-panel dashboard-goals-panel dashboard-reveal" aria-labelledby="dashboard-goals-heading">
          <div className="app-panel__heading"><div><p className="app-eyebrow">ACTIVE GOALS · EXAMPLE</p><h2 id="dashboard-goals-heading">Goals</h2></div><Link className="app-panel__small-link" to="/app/goals">View all <AppIcon name="arrow" /></Link></div>
          <ul className="dashboard-goal-list">
            {dashboardDemo.goals.map((goal) => (
              <li key={goal.id}><div className="dashboard-goal-list__title"><strong>{goal.title}</strong><span>{goal.progress}%</span></div><AppProgressBar value={goal.progress} label={`${goal.title} example progress`} description="Demonstration indicator only; no goal-completion formula is assigned." /></li>
            ))}
          </ul>
          <p className="app-panel__note">Goal progress indicators are examples only.</p>
        </section>
      </div>

      <section className="app-panel dashboard-activity-panel dashboard-reveal" aria-labelledby="dashboard-activity-heading">
        <div className="app-panel__heading"><div><p className="app-eyebrow">RECENT ACTIVITY · EXAMPLE</p><h2 id="dashboard-activity-heading">Activity timeline</h2></div><span className="dashboard-activity-panel__label">DEMONSTRATION DATA</span></div>
        <ol className="dashboard-activity-list">
          {dashboardDemo.activity.map((event) => (
            <li key={event.id}><span className="dashboard-activity-list__icon"><AppIcon name={event.icon} /></span><div><strong>{event.title}</strong><p>{event.detail}</p></div><time>{event.time}</time></li>
          ))}
        </ol>
      </section>

      <p className="dashboard-disclosure"><AppIcon name="activity" />{dashboardDemo.disclosure}</p>
    </div>
  );
}
