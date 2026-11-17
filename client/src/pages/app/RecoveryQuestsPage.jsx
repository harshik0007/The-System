import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../../components/app/AppIcon.jsx';
import GraceChargeSummary from '../../components/app/GraceChargeSummary.jsx';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
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
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

function statusLabel(quest) {
  if (quest.status === RECOVERY_STATUS.THRESHOLD_CLEARED) return 'Cleared — Grace Charge Threshold';
  if (quest.status === RECOVERY_STATUS.EXPIRED) return 'Failed / Expired';
  return quest.status[0].toUpperCase() + quest.status.slice(1);
}

function QuestCard({ quest, onComplete, onExpire }) {
  const active = quest.status === RECOVERY_STATUS.ACTIVE;
  const completed = quest.status === RECOVERY_STATUS.COMPLETED;
  const expired = quest.status === RECOVERY_STATUS.EXPIRED;
  const progress = active ? (quest.recoveryDay / quest.recoveryWindowDays) * 100 : (expired ? 100 : completed ? 100 : 0);
  return (
    <article className={`recovery-quest-card recovery-quest-card--${quest.status}`}>
      <div className="recovery-quest-card__topline">
        <span className="recovery-quest-card__eyebrow">RECOVERY QUEST <i>·</i> {formatDate(quest.activationDate)}</span>
        <span className={`recovery-quest-status recovery-quest-status--${quest.status}`}><i aria-hidden="true" />{statusLabel(quest)}</span>
      </div>
      <div className="recovery-quest-card__connection">
        <div className="recovery-quest-card__source">
          <span>ORIGINAL MISSED TASK</span>
          <strong>{quest.originalTaskName}</strong>
        </div>
        <span className="recovery-quest-card__connector" aria-hidden="true"><AppIcon name="arrow" /></span>
        <div className="recovery-quest-card__action">
          <span>ACCOUNTABILITY ACTION</span>
          <strong>{quest.accountabilityActionTitle}</strong>
          <p>{quest.accountabilityActionDescription}</p>
        </div>
      </div>
      {active ? <div className="recovery-window">
        <div className="recovery-window__meta"><span>Recovery Day {quest.recoveryDay} of {quest.recoveryWindowDays}</span><strong>{quest.remainingDays} demonstration {quest.remainingDays === 1 ? 'day' : 'days'} shown</strong></div>
        <div className="recovery-window__track" role="progressbar" aria-label={`Recovery window day ${quest.recoveryDay} of ${quest.recoveryWindowDays}`} aria-valuemin="1" aria-valuemax={quest.recoveryWindowDays} aria-valuenow={quest.recoveryDay}><span style={{ width: `${progress}%` }} /></div>
        <p>Activated {formatDate(quest.activationDate)} · its original activation date anchors this window.</p>
      </div> : <div className="recovery-quest-card__history">
        {completed && <span>Completed {formatDate(quest.completedDate)}</span>}
        {expired && <span>Expired {formatDate(quest.expiryDate)} · individual deduction: −{quest.chargeEventId ? '1' : '0'} Grace Charge</span>}
        {quest.status === RECOVERY_STATUS.THRESHOLD_CLEARED && <p>Automatically cleared when active Recovery Quests exceeded five. No completion is required, and no individual expiry deduction applies.</p>}
      </div>}
      {active && <div className="recovery-quest-card__actions">
        <button type="button" className="recovery-complete-button" onClick={() => onComplete(quest)}><AppIcon name="tasks" />Complete Recovery Quest</button>
        <button type="button" className="recovery-expire-button" onClick={() => onExpire(quest)}>Simulate expiry</button>
      </div>}
      {completed && <p className="recovery-quest-card__outcome">Completed in this preview. No Grace Charge was deducted and no XP was awarded.</p>}
    </article>
  );
}

export default function RecoveryQuestsPage() {
  const { recoveryState, completeQuest, expireQuest } = useTaskSchedule();
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState('active');
  const [confirmQuest, setConfirmQuest] = useState(null);
  const [feedback, setFeedback] = useState('');
  const activeCount = recoveryState.quests.filter((quest) => quest.status === RECOVERY_STATUS.ACTIVE).length;
  const counts = useMemo(() => ({
    active: activeCount,
    completed: recoveryState.quests.filter((quest) => quest.status === RECOVERY_STATUS.COMPLETED).length,
    expired: recoveryState.quests.filter((quest) => quest.status === RECOVERY_STATUS.EXPIRED).length,
    cleared: recoveryState.quests.filter((quest) => quest.status === RECOVERY_STATUS.THRESHOLD_CLEARED).length,
  }), [activeCount, recoveryState.quests]);
  const filteredQuests = recoveryState.quests.filter((quest) => {
    if (filter === 'all') return true;
    if (filter === 'expired') return quest.status === RECOVERY_STATUS.EXPIRED;
    return quest.status === filter;
  });

  useEffect(() => {
    if (!confirmQuest) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setConfirmQuest(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirmQuest]);

  const confirmCompletion = () => {
    if (!confirmQuest) return;
    completeQuest(confirmQuest.id);
    setFeedback(`“${confirmQuest.accountabilityActionTitle}” was marked complete in this preview. No XP was awarded.`);
    setConfirmQuest(null);
  };

  const handleExpiryPreview = (quest) => {
    expireQuest(quest.id);
    setFeedback(`“${quest.accountabilityActionTitle}” was marked expired for this preview. One Grace Charge was deducted.`);
  };

  return (
    <div className={`recovery-page${reduceMotion ? ' recovery-page--reduced-motion' : ''}`}>
      <header className="recovery-page__heading">
        <div><p className="app-eyebrow">ACCOUNTABILITY · RECOVERY WINDOW</p><h1>Recovery Quests</h1><p>Complete the actions you committed to when your scheduled tasks were missed.</p></div>
        <Link className="recovery-page__back-link" to="/app/tasks"><AppIcon name="tasks" />View Daily Tasks</Link>
      </header>

      <div className="recovery-summary-grid">
        <section className="app-panel recovery-count-summary" aria-label="Recovery Quest status summary">
          <div className="recovery-count-summary__heading"><div><p className="app-eyebrow">QUEST HISTORY</p><h2>Current overview</h2></div><span className="recovery-count-summary__window"><AppIcon name="clock" />3-day window</span></div>
          <div className="recovery-count-grid">
            <div className="is-active"><strong>{counts.active}</strong><span>Active</span></div>
            <div><strong>{counts.completed}</strong><span>Completed</span></div>
            <div className="is-expired"><strong>{counts.expired}</strong><span>Failed / Expired</span></div>
            <div className="is-cleared"><strong>{counts.cleared}</strong><span>Threshold cleared</span></div>
          </div>
        </section>
        <GraceChargeSummary recoveryState={recoveryState} />
      </div>

      {activeCount >= 4 && <div className={`recovery-threshold-note${activeCount === 5 ? ' is-at-limit' : ''}`} role="status"><AppIcon name="activity" /><span><strong>{activeCount === 5 ? 'Active quest limit reached.' : `${5 - activeCount} active quest${5 - activeCount === 1 ? '' : 's'} until the limit.`}</strong> Generating a 6th active quest deducts one Grace Charge and clears the full active group.</span></div>}
      {feedback && <p className="recovery-feedback" role="status"><AppIcon name="shield" />{feedback}<button type="button" aria-label="Dismiss message" onClick={() => setFeedback('')}><AppIcon name="close" /></button></p>}

      <section className="recovery-quest-section" aria-labelledby="recovery-quest-list-title">
        <div className="recovery-quest-section__heading"><div><p className="app-eyebrow">YOUR COMMITMENTS</p><h2 id="recovery-quest-list-title">Recovery Quest record</h2><p>Only the Accountability Action attached to a missed task becomes a Recovery Quest.</p></div></div>
        <div className="recovery-tabs" role="group" aria-label="Filter Recovery Quests">
          {filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} className={filter === item.id ? 'is-selected' : ''} onClick={() => setFilter(item.id)}>{item.label}<span>{item.id === 'all' ? recoveryState.quests.length : counts[item.id] ?? 0}</span></button>)}
        </div>
        {filteredQuests.length ? <div className="recovery-quest-list">
          {filteredQuests.map((quest) => <QuestCard key={quest.id} quest={quest} onComplete={setConfirmQuest} onExpire={handleExpiryPreview} />)}
        </div> : <div className="recovery-empty-state"><span><AppIcon name="recovery" /></span><h3>{filter === 'active' ? 'No active Recovery Quests' : 'No records in this view'}</h3><p>{filter === 'active' ? 'When a scheduled task is marked missed, its own Accountability Action appears here.' : 'Completed, expired and threshold-cleared records remain available in All.'}</p></div>}
      </section>

      <div className="recovery-rules-grid">
        <article className="app-panel recovery-rule-card"><span className="recovery-rule-card__icon"><AppIcon name="clock" /></span><div><p className="app-eyebrow">RECOVERY WINDOW</p><h3>Three days to complete</h3><p>Each quest keeps its original activation date and a three-day Recovery Window. Remaining-day values here are demonstration data; exact expiry timing is not finalized.</p></div></article>
        <article className="app-panel recovery-rule-card"><span className="recovery-rule-card__icon recovery-rule-card__icon--warning"><AppIcon name="activity" /></span><div><p className="app-eyebrow">ACTIVE QUEST LIMIT</p><h3>Five active quests maximum</h3><p>At the 6th active quest, one Grace Charge is deducted and the active group is cleared. Cleared records remain in All and do not expire individually.</p></div></article>
      </div>
      <p className="recovery-disclosure"><AppIcon name="activity" />Demonstration data only. Changes are held in shared frontend state and reset when the page is refreshed.</p>

      {confirmQuest && <div className="recovery-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmQuest(null); }}>
        <section className="recovery-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="recovery-confirm-title" aria-describedby="recovery-confirm-description">
          <button className="recovery-confirm-modal__close" type="button" onClick={() => setConfirmQuest(null)} aria-label="Close confirmation"><AppIcon name="close" /></button>
          <span className="recovery-confirm-modal__icon"><AppIcon name="tasks" /></span>
          <p className="app-eyebrow">COMPLETION CONFIRMATION</p>
          <h2 id="recovery-confirm-title">Complete this Recovery Quest?</h2>
          <p id="recovery-confirm-description">Confirm that you completed the action committed to when this task was missed.</p>
          <div className="recovery-confirm-modal__details"><span>ORIGINAL MISSED TASK</span><strong>{confirmQuest.originalTaskName}</strong><span>ACCOUNTABILITY ACTION</span><strong>{confirmQuest.accountabilityActionTitle}</strong><p>{confirmQuest.accountabilityActionDescription}</p></div>
          <p className="recovery-confirm-modal__note">This preview will mark the quest complete. It does not submit proof, verify the action, deduct a Grace Charge or award XP.</p>
          <div className="recovery-confirm-modal__actions"><button type="button" className="recovery-confirm-modal__cancel" onClick={() => setConfirmQuest(null)}>Keep Active</button><button type="button" className="recovery-complete-button" onClick={confirmCompletion}>Confirm Completion</button></div>
        </section>
      </div>}
    </div>
  );
}
