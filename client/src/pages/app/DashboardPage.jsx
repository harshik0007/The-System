import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ranks } from '../../data/ranks.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import RankBadge from '../../components/ranks/RankBadge.jsx';
import AppIcon from '../../components/app/AppIcon.jsx';
import PageLoadingSkeleton from '../../components/app/PageLoadingSkeleton.jsx';
import AppProgressBar from '../../components/app/AppProgressBar.jsx';
import GracePointSummary from '../../components/app/GracePointSummary.jsx';
import DisciplinePointsSummary from '../../components/app/DisciplinePointsSummary.jsx';
import EmergencyPauseControls from '../../components/app/EmergencyPauseControls.jsx';
import { APPEARANCE_THEMES } from '../../data/appearanceThemes.js';
import { useTaskBackend } from '../../context/TaskBackendContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { RECOVERY_STATUS } from '../../utils/recoveryQuestManager.js';
import { selectEligibleTaskOccurrences } from '../../utils/taskOccurrenceSelection.js';
import { getNextAppearanceThemeReward } from '../../data/appearanceThemes.js';
import '../../styles/public-pages.css';

function remainingLabel(milliseconds) {
  const minutes = Math.max(0, Math.floor((Number(milliseconds) || 0) / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h remaining` : `${hours}h ${rest}m remaining`;
}

export default function DashboardPage() {
  const { schedule: serverSchedule, tasks: serverTaskDefinitions, occurrences: serverOccurrences, todayDate, todayCycleDay, loading: taskDataLoading, error: taskDataError, recoveryQuests: serverRecoveryQuests, gracePoints: serverGracePoints, gracePointTransactions, progression: serverProgression, disciplineSummary: serverDiscipline, recoveryLoading } = useTaskBackend();
  const { member } = useAuth();
  const pageRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const backendLoaded = Boolean(serverProgression?.progression);
  const serverRun = serverProgression?.progression || null;
  const progressionXp = serverRun?.xpSummary || null;
  const rank = ranks.find((item) => item.slug === serverRun?.currentRankSlug) || null;
  const themeRewardProgress = backendLoaded ? getNextAppearanceThemeReward(rank?.number) : null;
  const nextThemeReward = themeRewardProgress?.theme || null;
  const effectiveRecoveryState = backendLoaded ? {
    gracePoints: serverRun?.gracePoints ?? serverGracePoints?.balance ?? null,
    gracePointEvents: (gracePointTransactions || []).map((event) => ({
      id: event.id,
      kind: event.type === 'sixth-quest-threshold' ? 'threshold' : event.type === 'dp-redemption' ? 'redemption' : 'expiry',
      date: event.occurredAt,
      title: event.type === 'sixth-quest-threshold' ? 'Sixth active Recovery Quest' : event.type === 'dp-redemption' ? 'Discipline Point redemption' : 'Recovery Quest expired',
      detail: event.type === 'sixth-quest-threshold' ? 'One Grace Point was deducted and the active Quest group was cleared.' : event.type === 'dp-redemption' ? 'One Grace Point was added through redemption.' : 'One Grace Point was deducted at Recovery Window expiry.',
      appliedAmount: Math.abs(event.delta),
    })),
  } : null;
  const displayedQuests = backendLoaded ? (serverRecoveryQuests || []) : [];
  const activeRecoveryQuests = displayedQuests.filter((quest) => quest.status === RECOVERY_STATUS.ACTIVE);
  const activeRecoveryCount = activeRecoveryQuests.length;
  const nearestRecoveryMs = activeRecoveryQuests.length ? Math.min(...activeRecoveryQuests.map((quest) => quest.remainingMs ?? quest.remainingDays * 24 * 60 * 60 * 1000)) : null;
  const todayTasks = selectEligibleTaskOccurrences(serverOccurrences, todayDate, todayCycleDay)
    .map((occurrence) => ({
      id: occurrence.id,
      title: occurrence.snapshot?.title || 'Scheduled Task',
      completed: occurrence.status === 'completed',
      status: occurrence.status,
    }));
  const completedTasks = todayTasks.filter((task) => task.completed).length;
  const scheduledTaskCount = todayTasks.length;
  const startsNextDateCount = (serverTaskDefinitions || []).filter((task) => task.status === 'active'
    && task.createdEffectiveDate > todayDate
    && task.cycleDays.includes(todayCycleDay)).length;
  const taskCompletion = scheduledTaskCount ? Math.round((completedTasks / scheduledTaskCount) * 100) : 0;
  const currentLevel = serverRun?.level ?? 0;
  const levelProgress = serverRun ? {
    percent: serverRun.levelProgressPercent,
    earnedInLevel: serverRun.levelXpEarned,
    requirement: serverRun.nextLevelRequirement,
  } : { percent: 0, earnedInLevel: 0, requirement: 0 };
  const displayedXp = serverRun?.totalXp ?? 0;
  const displayedDisciplineState = {
    dpBalance: Number(serverDiscipline?.dpBalance ?? serverRun?.disciplinePoints ?? 0),
    currentStreak: serverDiscipline?.currentStreak ?? serverRun?.currentStreak ?? 0,
    longestStreak: serverDiscipline?.runLongestStreak ?? serverRun?.longestStreak ?? 0,
    lifetimeLongestStreak: serverDiscipline?.lifetimeLongestStreak ?? serverProgression?.lifetimeLongestStreak ?? 0,
  };
  const recentEvents = [];

  useLayoutEffect(() => {
    if (reduceMotion || !pageRef.current) return undefined;
    const context = gsap.context(() => {
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

  if (!backendLoaded) {
    if (taskDataLoading || recoveryLoading) return <PageLoadingSkeleton variant="dashboard" label="Loading dashboard data" />;
    return <div className="dashboard-page" ref={pageRef}>
      <header className="dashboard-welcome"><div><p className="app-eyebrow">PLAYER OVERVIEW</p><h1>Welcome back, {member?.username || 'member'}.</h1><p>Your progress and activity will appear here.</p></div></header>
      <section className="app-panel dashboard-unavailable" role={taskDataLoading || recoveryLoading ? 'status' : 'alert'}>
        <h2>Dashboard data is unavailable</h2>
        <p>{taskDataError || 'There is no active Progression Run for this account yet.'}</p>
        <button type="button" className="app-button app-button--secondary" onClick={() => window.location.reload()}>Retry</button>
      </section>
    </div>;
  }

  return (
    <div className="dashboard-page" ref={pageRef}>
      <header className="dashboard-welcome dashboard-reveal">
        <div><p className="app-eyebrow">PLAYER OVERVIEW</p><h1>Welcome back, {member?.username || 'member'}.</h1><p>Your progress is built through consistent action.</p></div>
        <span className="app-demo-label"><i aria-hidden="true" />LIVE PROGRESSION</span>
      </header>

      <div className="dashboard-feature-grid">
        <section className="app-panel dashboard-rank-panel dashboard-reveal" aria-labelledby="dashboard-rank-heading" style={{ '--rank-accent': rank.color }}>
          <div className="dashboard-rank-panel__badge"><RankBadge rank={rank} presentation="reference" size="medium" /></div>
          <div className="dashboard-rank-panel__details">
            <div className="dashboard-rank-panel__member">
              <strong>{member?.username || 'Member'}</strong>
            </div>
            <p className="app-eyebrow">CURRENT RANK</p>
            <h2 id="dashboard-rank-heading">Rank {rank.number} — {rank.name}</h2>
            <p>{rank.shortDescription}</p>
            <div className="dashboard-rank-panel__meta">
              <span className="dashboard-badge-state"><AppIcon name="shield" />Current Rank badge</span>
              <span className="dashboard-rank-panel__position">Progression <b>·</b> {rank.progressionOrder} of 7</span>
              {backendLoaded && !nextThemeReward && <span className="dashboard-theme-unlocked-state">ALL THEMES UNLOCKED</span>}
            </div>
            <Link className="app-action-link" to={`/ranks/${rank.slug}`}>Explore Rank <AppIcon name="arrow" /></Link>
          </div>
        </section>

        <section className="app-panel dashboard-level-panel dashboard-reveal" aria-labelledby="dashboard-level-heading">
          <div className="app-panel__heading"><div><p className="app-eyebrow">LEVEL & XP · YOUR PROGRESS</p><h2 id="dashboard-level-heading">Progress snapshot</h2></div><span className="dashboard-level-panel__icon"><AppIcon name="spark" /></span></div>
          <div className="dashboard-level-panel__values"><div><span>Current Level</span><strong>{String(serverRun?.level ?? currentLevel).padStart(2, '0')}</strong></div><div><span>Total XP</span><strong>{displayedXp.toLocaleString('en-US')}</strong></div></div>
          <AppProgressBar value={levelProgress.percent} label="Progress to next Level" description={`${levelProgress.earnedInLevel} of ${levelProgress.requirement} XP toward the next Level.`} />
          {progressionXp && <p className="dashboard-level-panel__remaining">{Number(progressionXp.xpRemaining).toLocaleString('en-US')} XP remaining to Level {progressionXp.currentLevel + 1}</p>}
        </section>
      </div>

      {backendLoaded && progressionXp && <div className="dashboard-progression-benefits">
        <section className="app-panel dashboard-progression-benefit" aria-labelledby="dashboard-active-xp-heading">
          <div className="app-panel__heading"><div><p className="app-eyebrow">YOUR XP BOOST</p><h2 id="dashboard-active-xp-heading">Current Rank benefit</h2></div><span className="dashboard-progression-benefit__multiplier">{progressionXp.currentRank.multiplierLabel}</span></div>
          <p className="dashboard-progression-benefit__source">{progressionXp.currentRank.name} applies its multiplier to eligible Task base XP.</p>
          <div className="dashboard-progression-benefit__cap"><div><span>Daily XP cap · {progressionXp.dailyXp.rankAtDayStart} at IST day start</span><strong>{Number(progressionXp.dailyXp.credited).toLocaleString('en-US')} / {Number(progressionXp.dailyXp.capAmount).toLocaleString('en-US')} XP</strong></div><AppProgressBar value={progressionXp.dailyXp.capAmountCents ? (progressionXp.dailyXp.creditedCents / progressionXp.dailyXp.capAmountCents) * 100 : 0} label="Daily XP cap used" description={`${progressionXp.dailyXp.remaining} XP remains in today's ordinary XP capacity.`} /></div>
          <p className="app-panel__note">Daily XP earned: {Number(progressionXp.dailyXp.credited).toLocaleString('en-US')} · Remaining today: {Number(progressionXp.dailyXp.remaining).toLocaleString('en-US')} XP.</p>
        </section>

        <section className="app-panel dashboard-progression-benefit dashboard-progression-benefit--next" aria-labelledby="dashboard-next-rank-heading">
          <div className="app-panel__heading"><div><p className="app-eyebrow">NEXT RANK PREVIEW</p><h2 id="dashboard-next-rank-heading">Next Rank benefits</h2></div><span className="dashboard-progression-benefit__icon"><AppIcon name="arrow" /></span></div>
          {progressionXp.nextRank ? <>
            <div className="dashboard-progression-benefit__next-title"><span>Rank {progressionXp.nextRank.number}</span><strong>{progressionXp.nextRank.name}</strong></div>
            <p className="dashboard-progression-benefit__source">Unlock at Level {progressionXp.nextRank.minimumLevel}.</p>
            <ul className="dashboard-progression-benefit__list">
              <li><span>XP multiplier</span><strong>{progressionXp.nextRank.multiplierLabel}</strong></li>
              <li><span>Daily XP cap</span><strong>{Number(progressionXp.nextRank.dailyXpCap).toLocaleString('en-US')} XP</strong></li>
              <li><span>One-time Rank-entry XP</span><strong>{progressionXp.nextRank.entryXpConfigured ? `+${Number(progressionXp.nextRank.entryXp).toLocaleString('en-US')} XP` : 'Not configured'}</strong></li>
              <li><span>One-time Rank-entry DP</span><strong>+{Number(progressionXp.nextRank.entryDp).toFixed(2)} DP</strong></li>
              <li><span>Recurring DP preview</span><strong>{progressionXp.nextRank.recurringDpPreview.qualifyingDays} days · +{Number(progressionXp.nextRank.recurringDpPreview.rewardDp).toFixed(2)} DP</strong></li>
            </ul>
            <p className="app-panel__note">Preview only. These benefits apply after reaching {progressionXp.nextRank.name}.</p>
          </> : <div className="dashboard-progression-benefit__top-rank"><strong>Highest defined Rank reached</strong><p>Level progression continues beyond 100. No later Rank or Continuum entry XP is configured.</p></div>}
        </section>
      </div>}

      {nextThemeReward && <section
        className="app-panel dashboard-theme-reward dashboard-reveal"
        aria-labelledby="dashboard-theme-reward-heading"
        style={{ '--dashboard-theme-accent': nextThemeReward.colors[2] }}
      >
        <div className="dashboard-theme-reward__identity">
          <span className="dashboard-theme-reward__icon" aria-hidden="true"><AppIcon name="spark" /></span>
          <div>
            <p className="app-eyebrow">NEXT THEME REWARD</p>
            <h2 id="dashboard-theme-reward-heading">{nextThemeReward.name}</h2>
            <p>{nextThemeReward.description}</p>
          </div>
        </div>
        <div className="dashboard-theme-reward__progress">
          <div className="dashboard-theme-reward__rank"><span>Unlocks at Rank {String(nextThemeReward.requiredRankNumber).padStart(2, '0')}</span><strong>{themeRewardProgress.remainingRankSteps} {themeRewardProgress.remainingRankSteps === 1 ? 'Rank' : 'Ranks'} to go</strong></div>
          <div className="dashboard-theme-reward__track" role="progressbar" aria-label={`Rank progress toward ${nextThemeReward.name}`} aria-valuemin="0" aria-valuemax={themeRewardProgress.totalRankSteps} aria-valuenow={themeRewardProgress.completedRankSteps} aria-valuetext={`${themeRewardProgress.completedRankSteps} of ${themeRewardProgress.totalRankSteps} Rank promotions complete`}>
            <span style={{ width: `${themeRewardProgress.progressPercent}%` }} />
          </div>
          <small>Current Rank {rank.number} · {rank.name}</small>
        </div>
        <Link className="dashboard-theme-reward__link" to="/app/settings?category=appearance">View theme <AppIcon name="arrow" /></Link>
      </section>}

      <section className="dashboard-quick-pause dashboard-reveal" id="emergency-pause-controls" aria-label="Emergency Pause controls">
        <EmergencyPauseControls />
      </section>

      <div className="dashboard-content-grid dashboard-content-grid--primary">
        <section className="app-panel dashboard-tasks-panel dashboard-reveal" aria-labelledby="dashboard-tasks-heading">
          <div className="app-panel__heading"><div><p className="app-eyebrow">TODAY · YOUR SCHEDULE</p><h2 id="dashboard-tasks-heading">Today's Tasks</h2></div><span className="dashboard-panel-count">{completedTasks}<i>/</i>{scheduledTaskCount}</span></div>
          {serverSchedule && <div className="dashboard-task-summary"><strong>{taskCompletion}%</strong><span>complete <i>· equal Task weighting</i></span><AppProgressBar value={taskCompletion} label="Today's Task completion" description={`${completedTasks} of ${scheduledTaskCount} scheduled Tasks completed; Tasks are equally weighted.`} /></div>}
          {startsNextDateCount > 0 && <p className="dashboard-task-future-note">{startsNextDateCount} new {startsNextDateCount === 1 ? 'Task starts' : 'Tasks start'} on the next IST date and will join this count then.</p>}
          <ul className="dashboard-task-list">
            {todayTasks.map((task, index) => (
              <li className={task.completed ? 'is-complete' : ''} key={task.id}>
                <span className="dashboard-task-list__status" aria-label={task.completed ? 'Completed Task' : `${task.status} Task`}>{task.completed ? <AppIcon name="tasks" /> : <span>{String(index + 1).padStart(2, '0')}</span>}</span>
                <span>{task.title}</span>
                <small>{task.completed ? 'COMPLETE' : task.status.toUpperCase()}</small>
              </li>
            ))}
            {!taskDataLoading && !taskDataError && !serverSchedule && <li className="dashboard-task-list__empty">No active Task Schedule. Create one to see today’s Tasks here.</li>}
            {!taskDataLoading && serverSchedule && !todayTasks.length && <li className="dashboard-task-list__empty">No Task occurrences are scheduled for this IST cycle day.</li>}
            {taskDataLoading && <li className="dashboard-task-list__loading" role="status" aria-label="Loading scheduled Tasks"><i /><i /><i /></li>}
            {taskDataError && <li className="dashboard-task-list__empty">Task data is unavailable. Open Daily Tasks to retry.</li>}
          </ul>
          <Link className="app-panel__footer-link" to="/app/tasks">View All Tasks <AppIcon name="arrow" /></Link>
        </section>

        <div className="dashboard-side-stack">
          <section className="app-panel dashboard-recovery-panel dashboard-reveal" aria-labelledby="dashboard-recovery-heading">
            <div className="app-panel__heading"><div><p className="app-eyebrow">RECOVERY · YOUR QUESTS</p><h2 id="dashboard-recovery-heading">Recovery Quests</h2></div><span className="dashboard-panel-count">{activeRecoveryCount} active</span></div>
            {activeRecoveryCount >= 4 && <p className="dashboard-recovery-limit">{activeRecoveryCount}/5 active · {activeRecoveryCount === 5 ? 'next quest triggers the limit' : 'approaching the active limit'}</p>}
            {nearestRecoveryMs !== null && <p className="dashboard-recovery-nearest">Nearest Recovery Window: <strong>{remainingLabel(nearestRecoveryMs)}</strong></p>}
            <ul className="dashboard-quest-list">
              {activeRecoveryQuests.slice(0, 2).map((quest) => (
                <li className="dashboard-quest-list__item dashboard-quest-list__item--active" key={quest.id}>
                  <span className="dashboard-quest-list__icon"><AppIcon name="clock" /></span>
                  <span><strong>{quest.accountabilityActionTitle}</strong><small>From: {quest.sourceTaskName || quest.originalTaskName} · {remainingLabel(quest.remainingMs)}</small></span>
                  <i>ACTIVE</i>
                </li>
              ))}
              {!activeRecoveryCount && <li className="dashboard-quest-list__empty">No active Recovery Quests.</li>}
            </ul>
            <Link className="app-panel__footer-link" to="/app/recovery-quests">View Recovery Quests <AppIcon name="arrow" /></Link>
          </section>

          {Number.isFinite(effectiveRecoveryState?.gracePoints)
            ? <GracePointSummary compact recoveryState={effectiveRecoveryState} serverBacked={backendLoaded} />
            : <section className="app-panel grace-charge-summary dashboard-grace-panel-unavailable" role="status"><p className="app-eyebrow">GRACE POINTS</p><p>Grace Point balance could not be loaded.</p></section>}
        </div>
      </div>

      <div className="dashboard-content-grid dashboard-content-grid--secondary">
        <DisciplinePointsSummary compact disciplineState={displayedDisciplineState} serverSummary={serverDiscipline} />

        <section className="app-panel dashboard-discipline-panel dashboard-reveal" aria-labelledby="dashboard-discipline-heading">
          <div className="app-panel__heading"><div><p className="app-eyebrow">DAILY CONSISTENCY · SHARED STATE</p><h2 id="dashboard-discipline-heading">Discipline</h2></div><Link className="app-panel__small-link" to="/app/discipline">View details <AppIcon name="arrow" /></Link></div>
          <div className="dashboard-discipline-stats"><div><strong>{displayedDisciplineState.currentStreak}</strong><span>current streak days</span></div><div><strong>{displayedDisciplineState.longestStreak}</strong><span>run best</span></div><div><strong>{displayedDisciplineState.lifetimeLongestStreak}</strong><span>lifetime best days</span></div></div>
          {backendLoaded && serverDiscipline?.activeRewardCycle
            ? <p className="dashboard-discipline-cycle">Rank {serverDiscipline.activeRewardCycle.rank.number} · {serverDiscipline.activeRewardCycle.rank.name} cycle <strong>+{Number(serverDiscipline.activeRewardCycle.rewardAmount).toFixed(2)} DP</strong> · {serverDiscipline.activeRewardCycle.completedQualifyingDays}/{serverDiscipline.activeRewardCycle.requiredQualifyingDays} qualifying days · {serverDiscipline.activeRewardCycle.remainingQualifyingDays} remaining{serverDiscipline.redemption?.remainingMs > 0 ? ` · DP redemption available ${remainingLabel(serverDiscipline.redemption.remainingMs)}` : ''}</p>
            : backendLoaded
              ? <p className="dashboard-discipline-cycle">{serverDiscipline?.today?.status === 'qualified' ? 'Today is Qualified' : serverDiscipline?.today?.status === 'emergency-pause-protected' ? 'Today is protected by Emergency Pause' : serverDiscipline?.today?.status === 'not-qualified' ? 'Today was not qualified' : 'Today is In Progress'} · {serverDiscipline?.today?.completedOriginalTaskCount ?? 0}/{serverDiscipline?.today?.requiredTaskCount ?? 5} original Tasks</p>
              : <p className="dashboard-discipline-cycle">Next Rank {rankReward.number} reward <strong>+{disciplineState.cycle.rewardDp.toFixed(2)} DP</strong> · {disciplineState.cycle.progress}/{disciplineState.cycle.requiredDays} qualifying days</p>}
          <Link className="app-panel__footer-link" to="/app/discipline">Open Discipline <AppIcon name="arrow" /></Link>
        </section>
      </div>

      <section className="app-panel dashboard-activity-panel dashboard-reveal" aria-labelledby="dashboard-activity-heading">
        <div className="app-panel__heading"><div><p className="app-eyebrow">RECENT ACTIVITY · SHARED STATE</p><h2 id="dashboard-activity-heading">Activity timeline</h2></div><span className="dashboard-activity-panel__label">THIS SESSION</span></div>
        <ol className={`dashboard-activity-list${recentEvents.length ? '' : ' dashboard-activity-list--empty'}`}>
          {recentEvents.map((event) => (
            <li key={event.id}><span className="dashboard-activity-list__icon"><AppIcon name={event.icon} /></span><div><strong>{event.title}</strong><p>{event.detail}</p></div><time>{event.time}</time></li>
          ))}
          {!recentEvents.length && <li className="dashboard-activity-list__empty">No completed scheduled-task or progression events have been recorded in this session.</li>}
        </ol>
      </section>

    </div>
  );
}
