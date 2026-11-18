import { ranks } from '../../data/ranks.js';
import AppIcon from './AppIcon.jsx';
import RankBadge from '../ranks/RankBadge.jsx';
import '../../styles/personal-best-records.css';
import '../../styles/public-pages.css';

function formatDate(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return 'Achievement date unavailable';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${dateKey}T12:00:00Z`));
}

function PositionRecord({ recordKey, title, record }) {
  const bestPosition = record?.bestPosition;
  const currentPosition = record?.currentPosition;
  return (
    <article className="personal-best-card">
      <p className="personal-best-card__eyebrow">{title}</p>
      <div className="personal-best-card__value-row"><strong className="personal-best-card__value">{bestPosition ? `#${bestPosition}` : '—'}</strong>{bestPosition && <span className="personal-best-card__record-badge"><AppIcon name="leaderboard" />BEST</span>}</div>
      <div className="personal-best-card__current"><span>Current position</span><b>{currentPosition ? `#${currentPosition}` : 'Not recorded'}</b></div>
      <time className="personal-best-card__date" dateTime={record?.achievedOn || undefined}>{bestPosition ? `Best achieved · ${formatDate(record?.achievedOn)}` : 'No record yet'}</time>
      <span className="personal-best-card__category">{recordKey === 'overall' ? 'OVERALL LEADERBOARD' : recordKey === 'discipline' ? 'DISCIPLINE LEADERBOARD' : 'XP LEADERBOARD'}</span>
    </article>
  );
}

function HighestRankRecord({ record }) {
  const rank = ranks.find((item) => item.slug === record?.rankSlug);
  return (
    <article className="personal-best-card personal-best-card--rank">
      <p className="personal-best-card__eyebrow">HIGHEST SYSTEM RANK ACHIEVED</p>
      <div className="personal-best-card__rank-content">
        {rank && <RankBadge className="personal-best-card__badge" rank={rank} size="small" presentation="reference" />}
        <div><strong className="personal-best-card__rank-name">{rank ? `Rank ${rank.number} · ${rank.name}` : 'Not recorded'}</strong><time className="personal-best-card__date" dateTime={record?.achievedOn || undefined}>{record?.rankSlug ? `Achieved · ${formatDate(record.achievedOn)}` : 'No Rank achievement record yet'}</time></div>
      </div>
      <span className="personal-best-card__category">THE SYSTEM progression</span>
    </article>
  );
}

export default function PersonalBestRecords({ records, isCurrentMember = false, isDemonstration = false }) {
  return (
    <section className="personal-best-records" aria-labelledby="personal-best-records-title">
      <header className="personal-best-records__heading">
        <div><p className="app-eyebrow">LIFETIME ACHIEVEMENTS</p><h2 id="personal-best-records-title">Personal Best Records</h2></div>
        <p>Leaderboard positions and THE SYSTEM Rank are tracked separately.</p>
      </header>
      {isCurrentMember && <p className="personal-best-records__notice">Saved in this browser session. Permanent account records will require backend persistence.</p>}
      {isDemonstration && <p className="personal-best-records__notice">Illustrative records for a fictional demonstration member.</p>}
      <div className="personal-best-records__grid">
        <PositionRecord recordKey="overall" title="BEST OVERALL POSITION" record={records?.overall} />
        <PositionRecord recordKey="discipline" title="BEST DISCIPLINE POSITION" record={records?.discipline} />
        <PositionRecord recordKey="xp" title="BEST XP POSITION" record={records?.xp} />
        <HighestRankRecord record={records?.highestRankAchieved} />
      </div>
    </section>
  );
}
