import { Link } from 'react-router-dom';
import RankLogo from './RankLogo.jsx';

export default function RankCard({ rank }) {
  return (
    <Link
      className={`rank-card rank-card--${rank.aura}`}
      to={`/ranks/${rank.slug}`}
      style={{ '--rank-accent': rank.color, '--rank-spectrum': rank.spectrum }}
      aria-label={`View Rank ${rank.number}, ${rank.name}`}
    >
      <span className="rank-card__topline"><span>RANK {rank.number}</span><span className="rank-card__position">{Number(rank.number) === 1 ? 'HIGHEST' : Number(rank.number) === 7 ? 'STARTING' : Number(rank.number) === 2 ? 'SECOND-HIGHEST' : `${rank.number} / 07`}</span></span>
      <span className="rank-card__emblem" aria-hidden="true"><RankLogo rank={rank} /></span>
      <span className="rank-card__identity"><span className="rank-card__name">{rank.name}</span></span>
      <span className="rank-card__description">{rank.shortDescription}</span>
      <span className="rank-card__action">VIEW RANK <b aria-hidden="true">↗</b></span>
    </Link>
  );
}
