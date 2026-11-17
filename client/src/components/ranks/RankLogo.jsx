import RankEmblem from './RankEmblem.jsx';

// Static master emblem for home, progression and ordinary rank cards.
export default function RankLogo({ rank, className = '' }) {
  return <RankEmblem rank={rank} decorative className={`rank-logo${className ? ` ${className}` : ''}`} />;
}
