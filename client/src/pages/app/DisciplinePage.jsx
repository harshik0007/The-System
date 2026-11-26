import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../../components/app/AppIcon.jsx';
import PageLoadingSkeleton, { SkeletonLine } from '../../components/app/PageLoadingSkeleton.jsx';
import DisciplineActivityMap from '../../components/app/DisciplineActivityMap.jsx';
import { useTaskBackend } from '../../context/TaskBackendContext.jsx';
import { useUserPreferences } from '../../context/UserPreferencesContext.jsx';
import ThemePreviewVisual from '../../components/app/ThemePreviewVisual.jsx';
import { APPEARANCE_THEMES, getNextAppearanceThemeReward } from '../../data/appearanceThemes.js';
import { getRankDisciplineConfig, DISCIPLINE_TASK_MINIMUM, GRACE_REDEMPTION_COOLDOWN_HOURS, RECOVERY_QUEST_XP_DRAIN_RATE } from '../../data/disciplineConfig.js';
import { RECOVERY_STATUS } from '../../utils/recoveryQuestManager.js';
import { createIdempotencyKey } from '../../services/taskApi.js';
import '../../styles/discipline.css';
import '../../styles/settings.css';

function formatCountdown(milliseconds) {
  const totalSeconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, text: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` };
}

function formatInstant(instant) {
  if (!instant) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(instant));
}

function formatIstDateKey(dateKey) {
  if (!dateKey) return 'Unavailable';
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function transactionLabel(type) {
  if (type === 'recurring-discipline-cycle') return 'Recurring Discipline cycle';
  if (type === 'rank-entry') return 'Rank-entry reward';
  if (type === 'dp-redemption') return 'Grace Point redemption';
  return 'Discipline Point transaction';
}

function RewardCategory({ eyebrow, title, amount, description, icon, tone = 'blue', color }) {
  return <article className={`discipline-reward discipline-reward--${tone}`} style={color ? { '--rank-color': color } : undefined}>
    <span className="discipline-reward__icon"><AppIcon name={icon} /></span>
    <div className="discipline-reward__copy"><p className="app-eyebrow">{eyebrow}</p><h3>{title}</h3><strong>{amount}</strong><p>{description}</p></div>
  </article>;
}

function RedemptionDialog({ points, onCancel, onConfirm, busy }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [busy, onCancel]);
  return <div className="discipline-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className="discipline-modal" role="dialog" aria-modal="true" aria-labelledby="grace-redemption-title">
      <button className="discipline-modal__close" type="button" aria-label="Close confirmation" disabled={busy} onClick={onCancel}><AppIcon name="close" /></button>
      <span className="discipline-modal__icon"><AppIcon name="shield" /></span>
      <p className="app-eyebrow">DISCIPLINE POINT CONVERSION</p>
      <h2 id="grace-redemption-title">Redeem 1 Grace Point?</h2>
      <p>One Discipline Point will be exchanged for one Grace Point. A successful exchange starts a rolling {GRACE_REDEMPTION_COOLDOWN_HOURS}-hour cooldown.</p>
      <div className="discipline-modal__balances"><span><strong>{points.toFixed(2)}</strong> Discipline Points now</span><span><strong>{(points - 1).toFixed(2)}</strong> after redemption</span></div>
      <div className="discipline-modal__actions"><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="button button--primary" disabled={busy} onClick={onConfirm}>{busy ? 'Processing…' : 'Confirm Redemption'}</button></div>
    </section>
  </div>;
}

const THEME_FEATURES = Object.freeze({
  'dark-navy': ['Original THE SYSTEM design', 'Deep navy surfaces and cyan details', 'Crimson Emergency Pause effect'],
  obsidian: ['Graphite and charcoal surfaces', 'Amber molten-light accents', 'Emberfall Emergency Pause effect'],
  aurora: ['Violet and teal atmosphere', 'Flowing northern-light visuals', 'Aurora Veil Emergency Pause effect'],
  eclipse: ['Premium lunar-black appearance', 'Silver-violet orbital details', 'Totality Emergency Pause effect'],
  galaxion: ['Large black-hole visual and glowing accretion disc', 'Falling stars, comets and meteors', 'Celestial Star pointer with a flowing light tail'],
});

function ThemeRewards({ currentRank, equippedTheme, preferencesReady }) {
  const currentRankNumber = Number(currentRank?.number);
  const knownRank = Number.isInteger(currentRankNumber) && currentRankNumber >= 1 && currentRankNumber <= 7;
  const themeRewardProgress = knownRank ? getNextAppearanceThemeReward(currentRankNumber) : null;
  const nextTheme = themeRewardProgress?.theme || null;
  const totalRankSteps = themeRewardProgress?.totalRankSteps || 0;
  const completedRankSteps = themeRewardProgress?.completedRankSteps || 0;
  const remainingRankSteps = themeRewardProgress?.remainingRankSteps || 0;
  const nextPercent = themeRewardProgress?.progressPercent ?? 100;
  const equipped = APPEARANCE_THEMES.find((theme) => theme.id === equippedTheme) || APPEARANCE_THEMES[0];

  return <section className="discipline-theme-rewards" aria-labelledby="theme-rewards-title">
    <div className="discipline-section-heading"><div><p className="app-eyebrow">RANK PROGRESSION · APPEARANCE REWARDS</p><h2 id="theme-rewards-title">Theme rewards</h2></div><span>{currentRank ? `Current Rank: ${currentRank.number} · ${currentRank.name}` : 'Rank loading'}</span></div>
    <article className="discipline-next-theme app-panel">
      <div className="discipline-next-theme__copy"><p className="app-eyebrow">YOUR NEXT THEME</p>
        {!preferencesReady || !knownRank ? <><h3>Checking your next unlock…</h3><p>Your current Rank and equipped theme are loaded from your account.</p></> : nextTheme ? <><h3>{nextTheme.name}</h3><p>{nextTheme.requirement}. Your current Rank is Rank {String(currentRankNumber).padStart(2, '0')} · {currentRank.name}.</p><div className="discipline-next-theme__progress" role="progressbar" aria-label={`Rank progress toward ${nextTheme.name}`} aria-valuemin="0" aria-valuemax={totalRankSteps} aria-valuenow={completedRankSteps} aria-valuetext={`${completedRankSteps} of ${totalRankSteps} Rank promotions complete`}><span style={{ width: `${nextPercent}%` }} /></div><small>{completedRankSteps} of {totalRankSteps} Rank promotions · {remainingRankSteps} {remainingRankSteps === 1 ? 'Rank' : 'Ranks'} to reach Rank {String(nextTheme.requiredRankNumber).padStart(2, '0')}</small></> : <><h3>ALL THEMES UNLOCKED</h3><p>All five themes are available at your current Rank.</p></>}
      </div>
      <div className="discipline-next-theme__active"><span>CURRENT THEME</span><strong>{preferencesReady ? equipped.name : 'Loading…'}</strong><Link to="/app/settings?category=appearance">Open Appearance settings <AppIcon name="arrow" /></Link></div>
    </article>
    <div className="discipline-theme-grid" aria-label="Theme rewards by Rank">{APPEARANCE_THEMES.map((theme) => {
      const accessKnown = knownRank && preferencesReady;
      const isEligible = theme.requiredRankNumber === null || (knownRank && currentRankNumber <= theme.requiredRankNumber);
      const isEquipped = preferencesReady && equippedTheme === theme.id;
      const status = !accessKnown ? 'Checking availability' : isEquipped ? 'Equipped' : isEligible ? 'Available to equip' : `Unlock at ${theme.requirement}`;
      const stateClass = !accessKnown ? ' is-pending' : isEquipped ? ' is-equipped' : isEligible ? ' is-unlocked' : ' is-locked';
      return <article className={`discipline-theme-card${stateClass}`} key={theme.id}>
        <ThemePreviewVisual theme={theme} size="card" />
        <div className="discipline-theme-card__heading"><div><h3>{theme.name}</h3><span>{theme.requirement}</span></div><strong>{status}</strong></div>
        <ul>{THEME_FEATURES[theme.id].map((feature) => <li key={feature}>{feature}</li>)}</ul>
      </article>;
    })}</div>
    {!preferencesReady && <p className="discipline-disclosure">Theme access and the equipped theme are confirmed from your account settings.</p>}
  </section>;
}

export default function DisciplinePage() {
  const { preferences, ready: preferencesReady } = useUserPreferences();
  const {
    disciplineSummary: summary,
    disciplineCalendar,
    disciplineTransactions,
    disciplineError,
    recoveryQuests,
    progression,
    recoveryLoading,
    redeemDisciplinePoint,
  } = useTaskBackend();
  const [now, setNow] = useState(Date.now());
  const [confirmRedemption, setConfirmRedemption] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [feedback, setFeedback] = useState('');
  const redemptionKeyRef = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const run = progression?.progression || null;
  const rankPresentation = getRankDisciplineConfig(summary?.currentRank?.slug || run?.currentRankSlug || 'origin');
  const rankData = summary?.currentRank || run?.xpSummary?.currentRank || null;
  const rank = {
    ...rankPresentation,
    ...(rankData || {}),
    color: rankData?.accentColor || rankPresentation.color,
  };
  const cycle = summary?.activeRewardCycle || null;
  const activeQuests = recoveryQuests.filter((quest) => quest.status === RECOVERY_STATUS.ACTIVE);
  const currentLevelRequirement = Number(run?.xpSummary?.xpRequirement || run?.nextLevelRequirement || 0);
  const estimatedDrain = summary?.emergencyPauseActive
    ? 0
    : Math.round(currentLevelRequirement * RECOVERY_QUEST_XP_DRAIN_RATE * activeQuests.length * 100) / 100;
  const dpBalance = summary ? Number(summary.dpBalance) : null;
  const dpWalletCap = summary ? Number(summary.disciplinePointWalletCap) : null;
  const gpBalance = summary ? Number(summary.gracePointBalance) : null;
  const cooldownUntil = summary?.redemption?.availableAt ? Date.parse(summary.redemption.availableAt) : 0;
  const cooldownRemaining = Math.max(0, cooldownUntil - now);
  const countdown = formatCountdown(cooldownRemaining);
  const calendarDaysRemaining = cycle ? Number(cycle.calendarDaysRemaining) : null;
  const remainingQualifyingDays = cycle ? Number(cycle.remainingQualifyingDays) : null;
  const cycleProgress = cycle ? Number(cycle.completedQualifyingDays) : 0;
  const cycleRequirement = cycle ? Number(cycle.requiredQualifyingDays) : 0;
  const cyclePercent = cycleRequirement ? Math.min(100, Math.round(cycleProgress / cycleRequirement * 100)) : 0;
  const cycleAwaitingQualification = cycle?.calendarStatus === 'awaiting-qualification';
  const nextCyclePreview = summary?.nextRewardCycle || null;
  const redemptionCooldownHours = summary?.redemption?.cooldownHours || GRACE_REDEMPTION_COOLDOWN_HOURS;
  const activityRecords = disciplineCalendar?.records || [];
  const transactions = useMemo(() => disciplineTransactions || [], [disciplineTransactions]);

  const confirmConversion = async () => {
    if (redeeming) return;
    setRedeeming(true);
    redemptionKeyRef.current ||= createIdempotencyKey();
    try {
      await redeemDisciplinePoint(redemptionKeyRef.current);
      redemptionKeyRef.current = null;
      setConfirmRedemption(false);
      setFeedback('One Discipline Point was converted into one Grace Point. The 72-hour cooldown is now active.');
    } catch (error) {
      setFeedback(error?.message || 'The redemption could not be completed. Your balances and cooldown were not changed.');
    } finally {
      setRedeeming(false);
    }
  };

  if (!summary && disciplineError) {
    return <div className="discipline-page"><header className="discipline-page__header"><div><p className="app-eyebrow">MY PROGRESS · DAILY CONSISTENCY</p><h1>Discipline</h1><p>Consistency is the foundation of progression.</p></div></header><p className="discipline-feedback" role="alert"><AppIcon name="activity" />{disciplineError}</p></div>;
  }

  return (
    <div className="discipline-page">
      <header className="discipline-page__header">
        <div><p className="app-eyebrow">MY PROGRESS · DAILY CONSISTENCY</p><h1>Discipline</h1><p>Consistency is the foundation of progression.</p></div>
      </header>

      {disciplineError && <p className="discipline-feedback" role="alert"><AppIcon name="activity" />{disciplineError}</p>}
      {feedback && <p className="discipline-feedback" role="status"><AppIcon name="activity" />{feedback}<button type="button" onClick={() => setFeedback('')} aria-label="Dismiss message"><AppIcon name="close" /></button></p>}

      <section className="discipline-overview" aria-label="Discipline overview">
        <article className="discipline-overview__main app-panel">
          <div className="discipline-overview__heading"><div><p className="app-eyebrow">CURRENT STREAK</p><h2>{summary ? summary.currentStreak : '—'}<span>{summary ? ' days' : ''}</span></h2></div><span className="discipline-overview__symbol"><AppIcon name="activity" /></span></div>
          <p className="discipline-overview__support">Run longest <strong>{summary ? `${summary.runLongestStreak} days` : '—'}</strong><i /> Lifetime longest <strong>{summary ? `${summary.lifetimeLongestStreak} days` : '—'}</strong></p>
          <p className="discipline-overview__support">Total qualifying days <strong>{summary?.totalQualifyingDays ?? '—'}</strong></p>
          <div className="discipline-overview__rank"><span className="discipline-overview__rank-mark" style={{ '--rank-color': rank.color }}>{rankData?.number || '—'}</span><span><small>CURRENT RANK</small><strong>{rankData?.name || 'Loading…'}</strong></span><span className="discipline-overview__rank-reward">{cycle ? `+${Number(cycle.rewardAmount).toFixed(2)} DP · active cycle` : 'Reward cycle unavailable'}</span></div>
        </article>

        <article className="discipline-countdown app-panel" aria-live="polite">
          <div className="discipline-countdown__top"><div><p className="app-eyebrow">RECURRING REWARD CYCLE</p><h2>{cycle ? calendarDaysRemaining : '—'}<span>{cycle ? ' calendar days' : ' no active cycle'}</span></h2></div>{cycle && <span className="discipline-countdown__amount">+{Number(cycle.rewardAmount).toFixed(2)} <small>DP</small></span>}</div>
          {cycle ? <>
            <p className="discipline-countdown__label">Rank {cycle.rank.number} · {cycle.rank.name} snapshot · Cycle {cycle.cycleNumber}</p>
            <p className="discipline-countdown__target">Baseline target · {formatIstDateKey(cycle.baselineTargetDate)}</p>
            {cycleAwaitingQualification && <p className="discipline-countdown__awaiting" role="status">Calendar target reached · awaiting {remainingQualifyingDays} more qualifying {remainingQualifyingDays === 1 ? 'day' : 'days'}.</p>}
            <div className="discipline-progress-track" role="progressbar" aria-label="Qualifying days toward recurring Discipline reward" aria-valuemin={0} aria-valuemax={cycleRequirement} aria-valuenow={cycleProgress}><span style={{ width: `${cyclePercent}%` }} /></div>
            <p className="discipline-countdown__progress">{cycleProgress} / {cycleRequirement} qualifying days · {remainingQualifyingDays} remaining to qualify</p>
            {nextCyclePreview && <p className="discipline-countdown__next-preview">Next cycle preview · Rank {nextCyclePreview.rank.number} {nextCyclePreview.rank.name} · {nextCyclePreview.requiredQualifyingDays} qualifying days · +{Number(nextCyclePreview.rewardAmount).toFixed(2)} DP. Based on the Rank held when that cycle begins.</p>}
          </> : <p className="discipline-countdown__label">A recurring reward cycle will appear when an active Progression Run is available.</p>}
        </article>

        <article className="discipline-overview__currency app-panel">
          <div className="discipline-currency-card"><span><AppIcon name="activity" /></span><div><small>DISCIPLINE POINTS</small><strong>{dpBalance === null ? '—' : dpBalance.toFixed(2)} <i>/ {dpWalletCap === null ? '—' : dpWalletCap.toFixed(2)}</i></strong></div></div>
          <div className="discipline-currency-card discipline-currency-card--grace"><span><AppIcon name="shield" /></span><div><small>GRACE POINTS</small><strong>{gpBalance ?? '—'}</strong></div></div>
          <p className="discipline-overview__minimum">Today's qualification <strong>{summary?.today ? `${summary.today.status === 'qualified' ? 'Qualified' : summary.today.status === 'not-qualified' ? 'Not qualified' : summary.today.status === 'emergency-pause-protected' ? 'Protected' : 'In Progress'} · ${summary.today.completedOriginalTaskCount} / ${DISCIPLINE_TASK_MINIMUM} completed` : <SkeletonLine width="medium" label="Loading today’s qualification" />}</strong></p>
          <button className="discipline-redeem-button" type="button" disabled={!summary?.redemption?.eligible || cooldownRemaining > 0 || redeeming} onClick={() => setConfirmRedemption(true)}>
            {cooldownRemaining > 0 ? `Available in ${countdown.days}d ${countdown.text}` : dpBalance === null ? <SkeletonLine width="medium" label="Loading Discipline Point balance" /> : dpBalance < 1 ? '1.00 DP required to redeem' : 'Redeem 1 DP for 1 Grace Point'}
          </button>
          <p className="discipline-overview__cooldown">{cooldownRemaining > 0 ? `Available ${formatInstant(summary?.redemption?.availableAt)} IST · ${countdown.days} days ${countdown.text} remain.` : `1 DP = 1 GP. Each successful redemption starts a rolling ${redemptionCooldownHours}-hour cooldown.`}</p>
        </article>
      </section>

      <section className="discipline-rewards-section" aria-labelledby="discipline-rewards-title">
        <div className="discipline-section-heading"><div><p className="app-eyebrow">CURRENT RANK · REWARD CATEGORIES</p><h2 id="discipline-rewards-title">Rank benefits</h2></div><span>{rankData ? `Current Rank: ${rank.number} · ${rank.name}` : <SkeletonLine width="medium" label="Loading current Rank" />}</span></div>
        <div className="discipline-rewards-grid">
          <RewardCategory tone="cyan" eyebrow="RECURRING · DISCIPLINE POINTS" title="Consistency cycle" amount={cycle ? `+${Number(cycle.rewardAmount).toFixed(2)} DP` : 'No active cycle'} description={cycle ? `${cycleRequirement} qualifying days per cycle. This active cycle preserves its Rank ${cycle.rank.number} ${cycle.rank.name} snapshot.` : 'Cycle reward details appear here when a Progression Run is active.'} icon="activity" />
          <RewardCategory tone="rank" color={rank.color} eyebrow="ONE-TIME · RANK ENTRY" title="Rank-entry reward" amount={rankData ? `+${Number(rank.entryDp).toFixed(2)} DP` : 'Unavailable'} description="Recorded once when each Rank is first reached in a Progression Run. Your history shows any awarded entry reward." icon="shield" />
          <RewardCategory tone="xp" eyebrow="CURRENT · RANK XP BENEFIT" title="Task XP multiplier" amount={rankData?.multiplierLabel || 'Unavailable'} description={rankData ? 'Applied to eligible Task base XP after allocation. The day’s XP cap is captured from the Rank held at IST day start.' : 'Current Rank XP benefits appear when your active Progression Run is ready.'} icon="spark" />
        </div>
      </section>

      <ThemeRewards currentRank={rankData} equippedTheme={preferences.appearance.theme} preferencesReady={preferencesReady} />

      <section className="discipline-drain app-panel" aria-labelledby="discipline-drain-title">
        <div className="discipline-drain__icon"><AppIcon name="recovery" /></div>
        <div className="discipline-drain__copy"><p className="app-eyebrow">ACTIVE RECOVERY QUESTS · XP DRAIN</p><h2 id="discipline-drain-title">{activeQuests.length} active {activeQuests.length === 1 ? 'Quest' : 'Quests'} · {estimatedDrain.toFixed(2)} XP estimated at next reset</h2><p>{summary?.emergencyPauseActive ? `Emergency Pause is active${summary.emergencyPauseResumesAt ? ` until ${formatInstant(summary.emergencyPauseResumesAt)} IST` : ''}.` : `Each Active Recovery Quest drains 7% of the current Level requirement (${currentLevelRequirement} XP). Completed, expired and threshold-cleared Quests stop future drains.`}</p></div>
        <Link to="/app/recovery-quests" className="discipline-drain__link">Review Quests <AppIcon name="arrow" /></Link>
      </section>

      <section className="discipline-rewards-section" aria-labelledby="discipline-ledger-title">
        <div className="discipline-section-heading"><div><p className="app-eyebrow">YOUR PROGRESS · THIS RUN</p><h2 id="discipline-ledger-title">Discipline Point history</h2></div><span>{transactions.length} recent transactions</span></div>
        {transactions.length ? <ul className="discipline-drain__events discipline-ledger" aria-label="Discipline Point transactions">{transactions.map((event) => <li key={event.id}><time>{event.businessDate || formatInstant(event.occurredAt)}</time><span>{transactionLabel(event.type)}</span><strong className={Number(event.delta) < 0 ? 'is-negative' : ''}>{Number(event.delta) > 0 ? '+' : ''}{Number(event.delta).toFixed(2)} DP</strong></li>)}</ul> : recoveryLoading ? <PageLoadingSkeleton variant="rows" compact label="Loading Discipline Point transaction history" /> : <p className="discipline-empty-state">No Discipline Point transactions have been recorded for this Progression Run.</p>}
      </section>

      <DisciplineActivityMap
        disciplineState={{ memberSince: summary?.memberSince || progression?.memberSince, dailyRecords: {}, emergencyPauseDates: [] }}
        schedule={null}
        serverRecords={activityRecords}
        serverToday={summary?.today || null}
        memberSince={summary?.memberSince || progression?.memberSince}
      />

      {confirmRedemption && dpBalance !== null && <RedemptionDialog points={dpBalance} onCancel={() => setConfirmRedemption(false)} onConfirm={confirmConversion} busy={redeeming} />}
    </div>
  );
}
