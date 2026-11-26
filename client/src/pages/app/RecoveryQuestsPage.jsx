import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../../components/app/AppIcon.jsx';
import PageLoadingSkeleton from '../../components/app/PageLoadingSkeleton.jsx';
import GracePointSummary from '../../components/app/GracePointSummary.jsx';
import { useTaskBackend } from '../../context/TaskBackendContext.jsx';
import { RECOVERY_STATUS } from '../../utils/recoveryQuestManager.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';

const filters = [
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'expired', label: 'Failed / Expired' },
  { id: 'all', label: 'All' },
];

function formatDate(date) {
  if (!date) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(date));
}

function formatRemaining(milliseconds) {
  const totalMinutes = Math.max(0, Math.floor((Number(milliseconds) || 0) / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days}d ${hours}h remaining`;
  if (hours) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

function statusLabel(quest) {
  if (quest.status === RECOVERY_STATUS.THRESHOLD_CLEARED) return 'Cleared — Grace Point Threshold';
  if (quest.status === RECOVERY_STATUS.EXPIRED) return 'Failed / Expired';
  return quest.status[0].toUpperCase() + quest.status.slice(1);
}

function QuestCard({ quest, onComplete, paused = false }) {
  const active = quest.status === RECOVERY_STATUS.ACTIVE;
  const completed = quest.status === RECOVERY_STATUS.COMPLETED;
  const expired = quest.status === RECOVERY_STATUS.EXPIRED;
  const totalWindowMs = 72 * 60 * 60 * 1000;
  const progress = active ? Math.min(100, Math.max(0, ((totalWindowMs - quest.remainingMs) / totalWindowMs) * 100)) : (expired || completed ? 100 : 0);
  return (
    <article className={`recovery-quest-card recovery-quest-card--${quest.status}${paused && active ? ' recovery-quest-card--frozen' : ''}`}>
      <div className="recovery-quest-card__topline">
        <span className="recovery-quest-card__eyebrow">RECOVERY QUEST <i>·</i> {formatDate(quest.activatedAt)}</span>
        <span className={`recovery-quest-status recovery-quest-status--${quest.status}`}><i aria-hidden="true" />{paused && active ? 'Frozen · Emergency Pause' : statusLabel(quest)}</span>
      </div>
      <div className="recovery-quest-card__connection">
        <div className="recovery-quest-card__source">
          <span>ORIGINAL MISSED TASK</span>
          <strong>{quest.sourceTaskName}</strong>
        </div>
        <span className="recovery-quest-card__connector" aria-hidden="true"><AppIcon name="arrow" /></span>
        <div className="recovery-quest-card__action">
          <span>FORFEIT</span>
          <strong>{quest.accountabilityActionTitle}</strong>
          <p>{quest.accountabilityActionDescription}</p>
        </div>
      </div>
      {active ? <div className="recovery-window">
        <div className="recovery-window__meta"><span>72-hour Recovery Window</span><strong>{paused ? formatRemaining(quest.remainingMs) : formatRemaining(quest.remainingMs)}</strong></div>
        <div className="recovery-window__track" role="progressbar" aria-label={`${formatRemaining(quest.remainingMs)} in the 72-hour Recovery Window`} aria-valuemin="0" aria-valuemax="72" aria-valuenow={Math.max(0, Math.min(72, Math.round(quest.remainingMs / 3_600_000)))}><span style={{ width: `${progress}%` }} /></div>
        <p>Expires {formatDate(quest.expiresAt)} IST · Emergency Pause preserves the remaining time.</p>
      </div> : <div className="recovery-quest-card__history">
        {completed && <span>Completed {formatDate(quest.completedAt)}</span>}
        {expired && <span>Expired {formatDate(quest.expiredAt)} · one Grace Point deducted{quest.gracePointTransactionId ? '' : ' (transaction pending)'}</span>}
        {quest.status === RECOVERY_STATUS.THRESHOLD_CLEARED && <p>Cleared when a sixth active Recovery Quest was generated. No individual expiry deduction applies.</p>}
      </div>}
      {active && <div className="recovery-quest-card__actions">
        {!paused && <button type="button" className="recovery-complete-button" onClick={() => onComplete(quest)}><AppIcon name="tasks" />Complete Recovery Quest</button>}
        {paused && <p className="recovery-quest-frozen-note">This Recovery Quest and its remaining window are preserved until the pause ends.</p>}
      </div>}
      {completed && <p className="recovery-quest-card__outcome">Completed and recorded. No Grace Point was restored and no XP was awarded.</p>}
    </article>
  );
}

export default function RecoveryQuestsPage() {
  const { recoveryQuests, gracePoints, gracePointTransactions, progression, recoveryLoading, recoveryLoaded, recoveryError, refreshRecovery, completeRecoveryQuest } = useTaskBackend();
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState('active');
  const [confirmQuest, setConfirmQuest] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const quests = recoveryQuests || [];
  const isEmergencyPauseActive = Boolean(progression?.progression?.emergencyPauseActive);
  const activeCount = quests.filter((quest) => quest.status === RECOVERY_STATUS.ACTIVE).length;
  const counts = useMemo(() => ({
    active: activeCount,
    completed: quests.filter((quest) => quest.status === RECOVERY_STATUS.COMPLETED).length,
    expired: quests.filter((quest) => quest.status === RECOVERY_STATUS.EXPIRED).length,
    cleared: quests.filter((quest) => quest.status === RECOVERY_STATUS.THRESHOLD_CLEARED).length,
  }), [activeCount, quests]);
  const filteredQuests = quests.filter((quest) => {
    if (filter === 'all') return true;
    if (filter === 'expired') return quest.status === RECOVERY_STATUS.EXPIRED;
    return quest.status === filter;
  });
  const recoveryState = useMemo(() => ({
    gracePoints: gracePoints?.balance ?? 0,
    gracePointEvents: (gracePointTransactions || []).map((event) => ({
      id: event.id,
      kind: event.type === 'sixth-quest-threshold' ? 'threshold' : event.type === 'dp-redemption' ? 'redemption' : 'expiry',
      date: event.occurredAt,
      title: event.type === 'sixth-quest-threshold' ? 'Sixth active Recovery Quest' : event.type === 'dp-redemption' ? 'Discipline Point redemption' : 'Recovery Quest expired',
      detail: event.type === 'sixth-quest-threshold' ? 'One Grace Point was deducted and the active Quest group was cleared.' : event.type === 'dp-redemption' ? 'One Grace Point was added through redemption.' : 'One Grace Point was deducted when the Recovery Window expired.',
      appliedAmount: Math.abs(event.delta),
    })),
  }), [gracePoints, gracePointTransactions]);

  useEffect(() => {
    if (!confirmQuest) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setConfirmQuest(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirmQuest]);

  useEffect(() => {
    if (isEmergencyPauseActive) setConfirmQuest(null);
  }, [isEmergencyPauseActive]);

  const confirmCompletion = () => {
    if (!confirmQuest || isEmergencyPauseActive) return;
    setSubmitting(true);
    completeRecoveryQuest(confirmQuest.id).then(() => {
      setFeedback(`“${confirmQuest.accountabilityActionTitle}” was completed and saved. No Grace Point was restored and no XP was awarded.`);
      setConfirmQuest(null);
    }).catch((error) => {
      setFeedback(error?.message || 'The Recovery Quest could not be completed. Refresh and try again.');
    }).finally(() => setSubmitting(false));
  };

  return (
    <div className={`recovery-page${reduceMotion ? ' recovery-page--reduced-motion' : ''}`}>
      <header className="recovery-page__heading">
        <div><p className="app-eyebrow">ACCOUNTABILITY · RECOVERY WINDOW</p><h1>Recovery Quests</h1><p>Complete the actions you committed to when your scheduled tasks were missed.</p></div>
        <Link className="recovery-page__back-link" to="/app/tasks"><AppIcon name="tasks" />View Daily Tasks</Link>
      </header>

      {isEmergencyPauseActive && <div className="recovery-pause-banner" role="status"><AppIcon name="clock" /><span><strong>Recovery processing is paused.</strong> Active Quests remain unchanged; completion, expiry and the Recovery Window countdown are suspended{progression?.progression?.emergencyPauseResumesAt ? ` until ${formatDate(progression.progression.emergencyPauseResumesAt)} IST` : ''}.</span></div>}
      {recoveryError && <p className="recovery-feedback" role="alert"><AppIcon name="shield" />{recoveryError}<button type="button" onClick={() => void refreshRecovery()}>Retry</button></p>}

      <div className="recovery-summary-grid">
        <section className="app-panel recovery-count-summary" aria-label="Recovery Quest status summary">
          <div className="recovery-count-summary__heading"><div><p className="app-eyebrow">QUEST HISTORY</p><h2>Current overview</h2></div><span className="recovery-count-summary__window"><AppIcon name="clock" />72-hour window</span></div>
          <div className="recovery-count-grid">
            <div className="is-active"><strong>{counts.active}</strong><span>Active</span></div>
            <div><strong>{counts.completed}</strong><span>Completed</span></div>
            <div className="is-expired"><strong>{counts.expired}</strong><span>Failed / Expired</span></div>
            <div className="is-cleared"><strong>{counts.cleared}</strong><span>Threshold cleared</span></div>
          </div>
        </section>
        <GracePointSummary recoveryState={recoveryState} />
      </div>

      {activeCount >= 4 && <div className={`recovery-threshold-note${activeCount === 5 ? ' is-at-limit' : ''}`} role="status"><AppIcon name="activity" /><span><strong>{activeCount === 5 ? 'Active quest limit reached.' : `${5 - activeCount} active quest${5 - activeCount === 1 ? '' : 's'} until the limit.`}</strong> Generating a 6th active quest deducts one Grace Point and clears the full active group.</span></div>}
      {feedback && <p className="recovery-feedback" role="status"><AppIcon name="shield" />{feedback}<button type="button" aria-label="Dismiss message" onClick={() => setFeedback('')}><AppIcon name="close" /></button></p>}

      <section className="recovery-quest-section" aria-labelledby="recovery-quest-list-title">
        <div className="recovery-quest-section__heading"><div><p className="app-eyebrow">YOUR COMMITMENTS</p><h2 id="recovery-quest-list-title">Recovery Quest record</h2><p>Only the Forfeit attached to a missed task becomes a Recovery Quest.</p></div></div>
        <div className="recovery-tabs" role="group" aria-label="Filter Recovery Quests">
          {filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} className={filter === item.id ? 'is-selected' : ''} onClick={() => setFilter(item.id)}>{item.label}<span>{item.id === 'all' ? quests.length : counts[item.id] ?? 0}</span></button>)}
        </div>
        {recoveryLoading && !recoveryLoaded && quests.length === 0 ? <PageLoadingSkeleton variant="rows" compact label="Loading Recovery Quest records" /> : filteredQuests.length ? <div className="recovery-quest-list">
          {filteredQuests.map((quest) => <QuestCard key={quest.id} quest={quest} onComplete={setConfirmQuest} paused={isEmergencyPauseActive} />)}
        </div> : <div className="recovery-empty-state"><span><AppIcon name="recovery" /></span><h3>{filter === 'active' ? 'No active Recovery Quests' : 'No records in this view'}</h3><p>{filter === 'active' ? 'When an original scheduled Task is finalized as missed, its saved Forfeit appears here.' : 'Completed, expired and threshold-cleared records remain available in All.'}</p></div>}
      </section>

      <div className="recovery-rules-grid">
        <article className="app-panel recovery-rule-card"><span className="recovery-rule-card__icon"><AppIcon name="clock" /></span><div><p className="app-eyebrow">RECOVERY WINDOW</p><h3>Exactly 72 hours to complete</h3><p>Each active Quest remains eligible for exactly 72 rolling hours from activation. Emergency Pause preserves its remaining time.</p></div></article>
        <article className="app-panel recovery-rule-card"><span className="recovery-rule-card__icon recovery-rule-card__icon--warning"><AppIcon name="activity" /></span><div><p className="app-eyebrow">ACTIVE QUEST LIMIT</p><h3>Five active quests maximum</h3><p>At the 6th active quest, one Grace Point is deducted and the active group is cleared. Cleared records remain in All and do not expire individually.</p></div></article>
      </div>

      {confirmQuest && <div className="recovery-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmQuest(null); }}>
        <section className="recovery-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="recovery-confirm-title" aria-describedby="recovery-confirm-description">
          <button className="recovery-confirm-modal__close" type="button" onClick={() => setConfirmQuest(null)} aria-label="Close confirmation"><AppIcon name="close" /></button>
          <span className="recovery-confirm-modal__icon"><AppIcon name="tasks" /></span>
          <p className="app-eyebrow">COMPLETION CONFIRMATION</p>
          <h2 id="recovery-confirm-title">Complete this Recovery Quest?</h2>
          <p id="recovery-confirm-description">Confirm that you completed the action committed to when this task was missed.</p>
          <div className="recovery-confirm-modal__details"><span>ORIGINAL MISSED TASK</span><strong>{confirmQuest.sourceTaskName}</strong><span>FORFEIT</span><strong>{confirmQuest.accountabilityActionTitle}</strong><p>{confirmQuest.accountabilityActionDescription}</p></div>
          <p className="recovery-confirm-modal__note">Completion is saved to this progression run. It does not require proof, restore Grace Points or award XP.</p>
          <div className="recovery-confirm-modal__actions"><button type="button" className="recovery-confirm-modal__cancel" onClick={() => setConfirmQuest(null)}>Keep Active</button><button type="button" className="recovery-complete-button" disabled={isEmergencyPauseActive || submitting} onClick={confirmCompletion}>{submitting ? 'Saving…' : 'Confirm Completion'}</button></div>
        </section>
      </div>}
    </div>
  );
}
