import { Link } from 'react-router-dom';
import RankLogo from '../components/ranks/RankLogo.jsx';
import SectionHeading from '../components/SectionHeading.jsx';
import ShadowBackground from '../components/ShadowBackground.jsx';
import { ranks } from '../data/ranks.js';

export default function ProgressionSection() {
  return (
    <section className="progression-section" id="progression" aria-labelledby="progression-title">
      <ShadowBackground variant="progression" />
      <div className="section-wrap progression-content">
        <SectionHeading id="progression-title" eyebrow="The progression path" title="Seven ranks." accent="One continuous progression." description="Begin at Origin and build your way toward Continuum." align="center" />
        <div className="progress-track" aria-hidden="true"><span className="progress-track-fill" /></div>
        <div className="ranks-grid" role="group" aria-label="Seven Ranks, from lowest to highest">
          {ranks.map((rank) => (
              <Link
                className="surface-card surface-card--progression rank-tile"
                style={{ '--rank-accent': rank.color }}
                key={rank.number}
                to="/ranks"
                aria-label={`Explore Rank ${rank.number}, ${rank.name}`}
              >
                <span className="rank-tile__topline"><span>RANK {rank.number}</span><span className="rank-tile__indicator" /></span>
                <span className="rank-tile__emblem"><RankLogo rank={rank} /></span>
                <span className="rank-tile__label">{rank.name}</span>
                <span className="rank-tile__description">{rank.shortDescription}</span>
                <span className="rank-tile__action">VIEW RANK <b aria-hidden="true">↗</b></span>
              </Link>
          ))}
        </div>
        <div className="progression-explore">
          <Link className="button button--quiet" to="/ranks">EXPLORE ALL RANKS <span aria-hidden="true">↗</span></Link>
          <Link className="button button--quiet" to="/badges">BADGE INFORMATION <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </section>
  );
}
