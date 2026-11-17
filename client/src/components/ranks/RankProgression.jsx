import { Link } from 'react-router-dom';
import { ranks } from '../../data/ranks.js';

export default function RankProgression({ currentRank }) {
  return (
    <nav className="rank-progression" aria-label="Rank progression from lowest to highest">
      <div className="rank-progressive-heading">
        <div><p className="public-eyebrow">LOWEST TO HIGHEST</p><h2>One continuous progression</h2></div>
        <p>Rank 01 · Continuum is the highest Rank.</p>
      </div>
      <ol className="rank-progressive-list">
        {ranks.map((rank, index) => <li key={rank.number} className={`${rank.number === currentRank?.number ? 'is-current' : ''}${Number(rank.number) === 1 ? ' is-ultimate' : ''}`} style={{ '--rank-accent': rank.color, '--rank-spectrum': rank.spectrum }}>
          <Link to={`/ranks/${rank.slug}`} aria-current={rank.number === currentRank?.number ? 'page' : undefined} aria-label={`Rank ${rank.number}, ${rank.name}${Number(rank.number) === 1 ? ', highest rank' : ''}`}>
            <span className="rank-progressive-list__number">{rank.number}</span><span>{rank.name}</span>{Number(rank.number) === 1 && <b>HIGHEST</b>}
          </Link>
        </li>)}
      </ol>
    </nav>
  );
}
