import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../../components/app/AppIcon.jsx';
import DisciplineActivityMap from '../../components/app/DisciplineActivityMap.jsx';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
import { DISCIPLINE_POINTS_CAP, DISCIPLINE_TASK_MINIMUM, GRACE_REDEMPTION_COOLDOWN_HOURS, RECOVERY_QUEST_XP_DRAIN_RATE, getRankDisciplineConfig } from '../../data/disciplineConfig.js';
import { RECOVERY_STATUS } from '../../utils/recoveryQuestManager.js';
import { getLevelFromTotalXp, getLevelXpRequirement, getRedemptionCooldownRemaining } from '../../utils/disciplineManager.js';
import '../../styles/discipline.css';

function formatCountdown(milliseconds) {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, text: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` };
}

function RewardCategory({ eyebrow, title, amount, description, icon, tone = 'blue', color }) {
  return <article className={`discipline-reward discipline-reward--${tone}`} style={color ? { '--rank-color': color } : undefined}>
    <span className="discipline-reward__icon"><AppIcon name={icon} /></span>
    <div className="discipline-reward__copy"><p className="app-eyebrow">{eyebrow}</p><h3>{title}</h3><strong>{amount}</strong><p>{description}</p></div>
  </article>;
}

function RedemptionDialog({ points, onCancel, onConfirm }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onCancel]);
  return <div className="discipline-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="discipline-modal" role="dialog" aria-modal="true" aria-labelledby="grace-redemption-title">
      <button className="discipline-modal__close" type="button" aria-label="Close confirmation" onClick={onCancel}><AppIcon name="close" /></button>
      <span className="discipline-modal__icon"><AppIcon name="shield" /></span>
      <p className="app-eyebrow">DISCIPLINE POINT CONVERSION</p>
      <h2 id="grace-redemption-title">Redeem 1 Grace Point?</h2>
      <p>One Discipline Point will be exchanged for one Grace Point. This starts a rolling {GRACE_REDEMPTION_COOLDOWN_HOURS}-hour redemption cooldown.</p>
      <div className="discipline-modal__balances"><span><strong>{points.toFixed(2)}</strong> Discipline Points now</span><span><strong>{(points - 1).toFixed(2)}</strong> after redemption</span></div>
      <div className="discipline-modal__actions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="button button--primary" onClick={onConfirm}>Confirm Redemption</button></div>
    </section>
  </div>;
}

export default function DisciplinePage() {
  const { disciplineState, recoveryState, currentSchedule, emergencyPauseState, isEmergencyPauseActive, activeEmergencyPause, redeemGracePoint } = useTaskSchedule();
  const [now, setNow] = useState(Date.now());
  const [confirmRedemption, setConfirmRedemption] = useState(false);
  const [feedback, setFeedback] = useState('');
  const activeQuestCount = recoveryState.quests.filter((quest) => quest.status === RECOVERY_STATUS.ACTIVE).length;
  const rank = getRankDisciplineConfig(disciplineState.currentRankSlug);
  const cycleRank = getRankDisciplineConfig(disciplineState.cycle.rankSlug);
  const level = getLevelFromTotalXp(disciplineState.totalXp);
  const levelRequirement = getLevelXpRequirement(level);
  const xpDrainAtNextReset = isEmergencyPauseActive ? 0 : Math.round(levelRequirement * RECOVERY_QUEST_XP_DRAIN_RATE * activeQuestCount * 100) / 100;
  const dailyXpBonus = Math.round(levelRequirement * rank.dailyXpPercent / 100);
  const remaining = Math.max(0, disciplineState.cycle.requiredDays - disciplineState.cycle.progress);
  const cyclePercent = Math.min(100, Math.round(disciplineState.cycle.progress / disciplineState.cycle.requiredDays * 100));
  const cooldownRemaining = getRedemptionCooldownRemaining(disciplineState, now);
  const countdown = formatCountdown(cooldownRemaining);
  const redemptionAvailableAt = disciplineState.lastRedemptionAt
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
      .format(new Date(new Date(disciplineState.lastRedemptionAt).getTime() + GRACE_REDEMPTION_COOLDOWN_HOURS * 60 * 60 * 1000))
    : null;
  const rankEntryClaimId = `${disciplineState.progressionRunId}:${rank.id}`;
  const rankEntryClaimed = disciplineState.claimedRankEntryIds.includes(rankEntryClaimId);
  const recentXpDrains = useMemo(() => disciplineState.xpDrainEvents.slice(0, 4), [disciplineState.xpDrainEvents]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const confirmConversion = () => {
    const result = redeemGracePoint();
    setConfirmRedemption(false);
    setFeedback(result.success
      ? 'One Discipline Point was converted into one Grace Point. The 72-hour cooldown is now active.'
      : result.reason === 'cooldown'
        ? 'A Grace Point was not redeemed because the cooldown is active.'
        : 'A Grace Point was not redeemed because the Discipline Point balance is below 1.');
  };

  return (
    <div className="discipline-page">
      <header className="discipline-page__header">
        <div><p className="app-eyebrow">MY PROGRESS · DAILY CONSISTENCY</p><h1>Discipline</h1><p>Consistency is the foundation of progression.</p></div>
        <span className="app-demo-label"><i aria-hidden="true" />SESSION PREVIEW</span>
      </header>

      {feedback && <p className="discipline-feedback" role="status"><AppIcon name="activity" />{feedback}<button type="button" onClick={() => setFeedback('')} aria-label="Dismiss message"><AppIcon name="close" /></button></p>}

      <section className="discipline-overview" aria-label="Discipline overview">
        <article className="discipline-overview__main app-panel">
          <div className="discipline-overview__heading"><div><p className="app-eyebrow">CURRENT STREAK</p><h2>{disciplineState.currentStreak}<span> days</span></h2></div><span className="discipline-overview__symbol"><AppIcon name="activity" /></span></div>
          <p className="discipline-overview__support">Longest streak <strong>{disciplineState.longestStreak} days</strong><i /> Total qualifying days <strong>{disciplineState.totalQualifyingDays}</strong></p>
          <div className="discipline-overview__rank"><span className="discipline-overview__rank-mark" style={{ '--rank-color': rank.color }}>{rank.number}</span><span><small>CURRENT RANK</small><strong>{rank.name}</strong></span><span className="discipline-overview__rank-reward">+{rank.recurringDp.toFixed(2)} DP / {rank.cycleDays} days</span></div>
        </article>
        <article className="discipline-countdown app-panel" aria-live="polite">
          <div className="discipline-countdown__top"><div><p className="app-eyebrow">NEXT REWARD IN</p><h2>{remaining}<span> days</span></h2></div><span className="discipline-countdown__amount">+{disciplineState.cycle.rewardDp.toFixed(2)} <small>DP</small></span></div>
          <p className="discipline-countdown__label">Rank {cycleRank.number} · {cycleRank.name} recurring Discipline reward</p>
          <div className="discipline-progress-track" role="progressbar" aria-label="Qualifying days toward recurring Discipline reward" aria-valuemin="0" aria-valuemax={disciplineState.cycle.requiredDays} aria-valuenow={disciplineState.cycle.progress}><span style={{ width: `${cyclePercent}%` }} /></div>
          <p className="discipline-countdown__progress">{disciplineState.cycle.progress} of {disciplineState.cycle.requiredDays} qualifying days</p>
        </article>
        <article className="discipline-overview__currency app-panel">
          <div className="discipline-currency-card"><span><AppIcon name="activity" /></span><div><small>DISCIPLINE POINTS</small><strong>{disciplineState.dpBalance.toFixed(2)} <i>/ {DISCIPLINE_POINTS_CAP.toFixed(2)}</i></strong></div></div>
          <div className="discipline-currency-card discipline-currency-card--grace"><span><AppIcon name="shield" /></span><div><small>GRACE POINTS</small><strong>{recoveryState.gracePoints}</strong></div></div>
          <p className="discipline-overview__minimum">Daily minimum <strong>{DISCIPLINE_TASK_MINIMUM} original scheduled tasks</strong></p>
          <button className="discipline-redeem-button" type="button" disabled={disciplineState.dpBalance < 1 || cooldownRemaining > 0} onClick={() => setConfirmRedemption(true)}>
            {cooldownRemaining > 0 ? `Available in ${countdown.days}d ${countdown.text}` : 'Redeem 1 DP for 1 Grace Point'}
          </button>
          <p className="discipline-overview__cooldown">{cooldownRemaining > 0 ? `Available ${redemptionAvailableAt} IST · in ${countdown.days} days ${countdown.text} (72-hour cooldown).` : 'One successful redemption starts a rolling 72-hour cooldown.'}</p>
        </article>
      </section>

      <section className="discipline-rewards-section" aria-labelledby="discipline-rewards-title">
        <div className="discipline-section-heading"><div><p className="app-eyebrow">CURRENT RANK · REWARD CATEGORIES</p><h2 id="discipline-rewards-title">Rank benefits</h2></div><span>Current Rank: {rank.number} · {rank.name}</span></div>
        <div className="discipline-rewards-grid">
          <RewardCategory tone="cyan" eyebrow="RECURRING · DISCIPLINE POINTS" title="Consistency cycle" amount={`+${disciplineState.cycle.rewardDp.toFixed(2)} DP`} description={`${disciplineState.cycle.requiredDays} qualifying days per cycle. Rewards repeat; this active cycle keeps its Rank ${getRankDisciplineConfig(disciplineState.cycle.rankSlug).number} snapshot.`} icon="activity" />
          <RewardCategory tone="rank" color={rank.color} eyebrow="ONE-TIME · RANK ENTRY" title="Rank-entry reward" amount={`+${rank.entryDp.toFixed(2)} DP`} description={rank.entryDp === 0 ? 'Origin has no entry reward.' : rankEntryClaimed ? 'This progression run already recorded the entry reward.' : 'Awarded once when this Rank is first reached in a progression run; the current Rank was seeded in this preview.'} icon="shield" />
          <RewardCategory tone="xp" eyebrow="DAILY · RANK XP BENEFIT" title="Daily Rank bonus" amount={`+${dailyXpBonus} XP`} description={`${rank.dailyXpPercent.toFixed(2)}% of the next-Level requirement (${levelRequirement} XP). Rounded to the nearest integer and awarded once at daily reset.`} icon="spark" />
        </div>
        <div className="discipline-entry-xp-note"><span>ENTRY XP · PENDING</span><p>One-time Rank-entry XP is an approved reward category, but every Rank amount remains unconfigured. No entry XP is awarded until those values are approved.</p></div>
      </section>

      <section className="discipline-drain app-panel" aria-labelledby="discipline-drain-title">
        <div className="discipline-drain__icon"><AppIcon name="recovery" /></div>
        <div className="discipline-drain__copy"><p className="app-eyebrow">ACTIVE RECOVERY QUESTS · XP DRAIN</p><h2 id="discipline-drain-title">{activeQuestCount} active {activeQuestCount === 1 ? 'Quest' : 'Quests'} · {xpDrainAtNextReset.toFixed(2)} XP estimated at next reset</h2><p>{isEmergencyPauseActive ? `Emergency Pause suspends Recovery Quest XP drain until ${activeEmergencyPause?.scheduledResumeAt ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(activeEmergencyPause.scheduledResumeAt)) : 'normal activity resumes'} IST. No paused-day drain is applied later.` : `Each Active Recovery Quest drains 7% of the current Level requirement (${levelRequirement} XP). Completed, expired and threshold-cleared Quests stop future drains. Past deductions are not reversed.`}</p></div>
        <Link to="/app/recovery-quests" className="discipline-drain__link">Review Quests <AppIcon name="arrow" /></Link>
        {recentXpDrains.length > 0 && <div className="discipline-drain__events"><h3>Recorded daily drains</h3><ul>{recentXpDrains.map((event) => <li key={event.id}><time>{event.date}</time><span>{event.activeRecoveryQuestCount} Active Quests</span><strong>−{event.amount.toFixed(2)} XP</strong></li>)}</ul></div>}
        {disciplineState.levelDownEvents.length > 0 && <p className="discipline-level-down" role="status">Latest XP drain caused a Level decrease to Level {getLevelFromTotalXp(disciplineState.totalXp)}. Total XP never falls below 0 and Level cannot fall below 0.</p>}
      </section>

      <DisciplineActivityMap disciplineState={disciplineState} schedule={currentSchedule} emergencyPauseState={emergencyPauseState} />
      <p className="discipline-disclosure"><AppIcon name="activity" />Frontend demonstration data is held in this browser tab's session only. Closing the session clears it. XP thresholds are demonstration values; no account or permanent storage is connected.</p>

      {confirmRedemption && <RedemptionDialog points={disciplineState.dpBalance} onCancel={() => setConfirmRedemption(false)} onConfirm={confirmConversion} />}
    </div>
  );
}
