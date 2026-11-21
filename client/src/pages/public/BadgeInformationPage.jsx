import { Link } from 'react-router-dom';
import PublicLayout from '../../components/public/PublicLayout.jsx';
import RankBadge from '../../components/ranks/RankBadge.jsx';
import { ranks } from '../../data/ranks.js';
import '../../styles/public-pages.css';

export default function BadgeInformationPage() {
  return (
    <PublicLayout
      title="Rank Badges"
      description="See the collectible badge artwork associated with every THE SYSTEM Rank."
      eyebrow="Collectible insignia"
      heading="A badge for every Rank."
      intro="Each Rank has its own badge artwork. These previews use shared Rank data and show reference art only; they do not grant or change a Member’s achievements."
      className="badge-information-layout"
    >
      <section className="badge-information-page" aria-label="Rank badge collection">
        {ranks.map((rank) => (
          <article className="badge-information-card" key={rank.slug} style={{ '--rank-accent': rank.color }}>
            <div className="badge-information-card__art"><RankBadge rank={rank} size="small" presentation="reference" /></div>
            <div className="badge-information-card__copy">
              <p className="public-eyebrow">RANK {rank.number}</p>
              <h2>{rank.name}</h2>
              <p>{rank.shortDescription}</p>
              <Link to={`/ranks/${rank.slug}`}>Rank details <span aria-hidden="true">↗</span></Link>
            </div>
          </article>
        ))}
      </section>
    </PublicLayout>
  );
}
