import AppIcon from './AppIcon.jsx';
import { Link } from 'react-router-dom';
import '../../styles/recovery-quests.css';

export default function GracePointSummary({ recoveryState, compact = false, serverBacked = false }) {
  const recentEvents = recoveryState.gracePointEvents.slice(0, compact ? 2 : 4);
  return (
    <section className={`app-panel grace-charge-summary${compact ? ' grace-charge-summary--compact' : ''}${recoveryState.gracePoints === 0 ? ' is-depleted' : ''}`} aria-labelledby={compact ? undefined : 'grace-point-summary-title'}>
      <div className="grace-charge-summary__top">
        <span className="grace-charge-summary__icon"><AppIcon name="shield" /></span>
        <div className="grace-charge-summary__balance">
          <p className="app-eyebrow">GRACE POINTS</p>
          <h2 id={compact ? undefined : 'grace-point-summary-title'}>{recoveryState.gracePoints}<span> available</span></h2>
        </div>
      </div>
      <div className="grace-charge-summary__pips" role="img" aria-label={`${recoveryState.gracePoints} Grace Points available`}>
        <span className={recoveryState.gracePoints > 0 ? 'is-available' : ''} />
        <strong>{recoveryState.gracePoints} POINT{recoveryState.gracePoints === 1 ? '' : 'S'}</strong>
      </div>
      <p className="grace-charge-summary__explanation">Grace Points protect progression. Individual quest expiry costs one point; exceeding five active quests costs one point and clears the active group.</p>
      {compact && <div className="dashboard-grace-panel__links"><Link to="/rules#grace-points" className="dashboard-text-link">Grace Point rules <span aria-hidden="true">↗</span></Link><Link to="/rules#emergency-pause" className="dashboard-text-link">Emergency Pause <span aria-hidden="true">↗</span></Link></div>}
      {recoveryState.gracePoints === 0 && <p className="grace-charge-summary__warning" role="alert"><strong>Progression Reset warning.</strong> Reaching zero starts a fresh progression run while preserving the Member identity and lifetime records.</p>}
      {!compact && <div className="grace-charge-summary__events" aria-live="polite">
        <h3>Recent deductions</h3>
        {recentEvents.length ? <ul>{recentEvents.map((event) => (
          <li key={event.id} className={`grace-charge-event grace-charge-event--${event.kind}`}>
            <span className="grace-charge-event__amount">{event.kind === 'redemption' ? '+' : '−'}{event.appliedAmount}</span>
            <span><strong>{event.title}</strong><small>{event.detail}</small></span>
            <time dateTime={event.date}>{new Date(event.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })}</time>
          </li>
        ))}</ul> : <p className="grace-charge-summary__empty">{serverBacked ? 'No Grace Point transactions are recorded in this progression run.' : 'No Grace Points have been deducted in this preview.'}</p>}
      </div>}
    </section>
  );
}
