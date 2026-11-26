import { Link, Navigate, useParams } from 'react-router-dom';
import PublicLayout from '../../components/public/PublicLayout.jsx';
import RankBadgeShowcase from '../../components/ranks/RankBadgeShowcase.jsx';
import RankProgression from '../../components/ranks/RankProgression.jsx';
import RankBenefitSection from '../../components/ranks/RankBenefitSection.jsx';
import { ranks } from '../../data/ranks.js';

export default function RankDetailPage() {
  const { rankSlug } = useParams();
  const rankIndex = ranks.findIndex((item) => item.slug === rankSlug);
  if (rankIndex < 0) return <Navigate to="/ranks" replace />;

  const rank = ranks[rankIndex];
  const previous = ranks[rankIndex - 1];
  const next = ranks[rankIndex + 1];
  const isHighest = Number(rank.number) === 1;

  return (
    <PublicLayout
      title={`Rank ${rank.number} — ${rank.name}`}
      description={`Discover the Rank ${rank.number} ${rank.name} emblem, badge preview and position in THE SYSTEM progression.`}
      eyebrow={`RANK ${rank.number} / 07`}
      heading={`${rank.number} — ${rank.name}`}
      intro={rank.description}
      className={`rank-detail-layout rank-detail-layout--${rank.aura}`}
    >
      <section className="rank-detail-page" aria-labelledby="rank-detail-title" style={{ '--rank-accent': rank.color, '--rank-spectrum': rank.spectrum }}>
        <div className="rank-detail-page__copy">
          <p className="public-eyebrow">THE PROGRESSION SEQUENCE</p>
          <h2 id="rank-detail-title">Rank {rank.number} <span>· {rank.name}</span></h2>
          <p className="rank-detail-page__description">{rank.description}</p>

          <div className="rank-detail-page__stats"><div><span>Rank position</span><strong>{rank.number} / 07</strong><small>{Number(rank.number) === 7 ? 'Starting Rank' : Number(rank.number) === 2 ? 'Second-highest Rank' : isHighest ? 'Highest Rank' : `${Number(rank.number) - 1} Ranks stand above`}</small></div></div>

          <RankBenefitSection rank={rank} />

        </div>

        <RankBadgeShowcase rank={rank} />
      </section>

      <RankProgression currentRank={rank} />

      <nav className="rank-detail-pagination" aria-label="Previous and next Ranks">
        {previous ? <Link to={`/ranks/${previous.slug}`} className="rank-detail-pagination__link"><span>PREVIOUS RANK</span><strong>{previous.number} — {previous.name}</strong></Link> : <span className="rank-detail-pagination__edge">LOWEST RANK</span>}
        {next ? <Link to={`/ranks/${next.slug}`} className="rank-detail-pagination__link rank-detail-pagination__link--next"><span>NEXT RANK</span><strong>{next.number} — {next.name}</strong></Link> : <span className="rank-detail-pagination__edge rank-detail-pagination__edge--highest">HIGHEST RANK</span>}
      </nav>
    </PublicLayout>
  );
}
