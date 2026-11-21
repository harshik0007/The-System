import { Link } from 'react-router-dom';
import AppIcon from './AppIcon.jsx';
import { DISCIPLINE_POINTS_CAP } from '../../data/disciplineConfig.js';
import '../../styles/discipline.css';

export default function DisciplinePointsSummary({ disciplineState, serverSummary = null, compact = false }) {
  const balance = serverSummary ? Number(serverSummary.dpBalance || 0) : Number(disciplineState?.dpBalance || 0);
  const cap = serverSummary ? Number(serverSummary.disciplinePointWalletCap || DISCIPLINE_POINTS_CAP) : DISCIPLINE_POINTS_CAP;
  const percent = Math.min(100, (balance / cap) * 100);
  const latestReward = serverSummary?.recentDpTransactions?.[0] || disciplineState?.dpEvents?.[0] || null;
  const latestDelta = Number(latestReward?.delta ?? latestReward?.amount ?? 0);
  const latestTitle = latestReward?.title || ({
    'rank-entry': 'Rank-entry reward',
    'recurring-discipline-cycle': 'Recurring Discipline cycle',
    'dp-redemption': 'Grace Point redemption',
  }[latestReward?.type] || 'Discipline Point transaction');
  return (
    <section className={`app-panel discipline-points-summary${compact ? ' discipline-points-summary--compact' : ''}`} aria-labelledby={compact ? undefined : 'discipline-points-summary-title'}>
      <div className="discipline-points-summary__heading">
        <span className="discipline-points-summary__icon"><AppIcon name="activity" /></span>
        <div><p className="app-eyebrow">SHARED DISCIPLINE BALANCE</p><h2 id={compact ? undefined : 'discipline-points-summary-title'}>Discipline Points</h2></div>
      </div>
      <div className="discipline-points-summary__balance"><strong>{balance.toFixed(2)}</strong><span>/ {cap.toFixed(2)} maximum</span></div>
      <div className="discipline-points-summary__track" role="progressbar" aria-label="Discipline Points balance" aria-valuemin="0" aria-valuemax={cap} aria-valuenow={balance}><span style={{ width: `${percent}%` }} /></div>
      <p className="discipline-points-summary__note">Discipline Points come from recurring Rank cycles and one-time Rank-entry rewards. Unused points do not expire.</p>
      {latestReward && <p className="discipline-points-summary__latest"><strong>{latestDelta > 0 ? '+' : ''}{latestDelta.toFixed(2)} DP</strong><span>{latestTitle}</span></p>}
      <Link to="/app/discipline" className="dashboard-text-link">View Discipline <AppIcon name="arrow" /></Link>
    </section>
  );
}
