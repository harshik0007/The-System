import { Link } from 'react-router-dom';
import AppIcon from './AppIcon.jsx';
import { DISCIPLINE_POINTS_CAP } from '../../data/disciplineConfig.js';
import '../../styles/discipline.css';

export default function DisciplinePointsSummary({ disciplineState, compact = false }) {
  const percent = Math.min(100, (disciplineState.dpBalance / DISCIPLINE_POINTS_CAP) * 100);
  const latestReward = disciplineState.dpEvents[0];
  return (
    <section className={`app-panel discipline-points-summary${compact ? ' discipline-points-summary--compact' : ''}`} aria-labelledby={compact ? undefined : 'discipline-points-summary-title'}>
      <div className="discipline-points-summary__heading">
        <span className="discipline-points-summary__icon"><AppIcon name="activity" /></span>
        <div><p className="app-eyebrow">SHARED DISCIPLINE BALANCE</p><h2 id={compact ? undefined : 'discipline-points-summary-title'}>Discipline Points</h2></div>
      </div>
      <div className="discipline-points-summary__balance"><strong>{disciplineState.dpBalance.toFixed(2)}</strong><span>/ {DISCIPLINE_POINTS_CAP.toFixed(2)} maximum</span></div>
      <div className="discipline-points-summary__track" role="progressbar" aria-label="Discipline Points balance" aria-valuemin="0" aria-valuemax={DISCIPLINE_POINTS_CAP} aria-valuenow={disciplineState.dpBalance}><span style={{ width: `${percent}%` }} /></div>
      <p className="discipline-points-summary__note">Discipline Points come from recurring Rank cycles and one-time Rank-entry rewards. Unused points do not expire.</p>
      {latestReward && <p className="discipline-points-summary__latest"><strong>{latestReward.amount > 0 ? `+${latestReward.amount.toFixed(2)} DP` : 'Reward capped'}</strong><span>{latestReward.title}</span></p>}
      <Link to="/app/discipline" className="dashboard-text-link">View Discipline <AppIcon name="arrow" /></Link>
    </section>
  );
}
