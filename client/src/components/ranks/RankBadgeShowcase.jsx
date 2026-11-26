import RankBadge from './RankBadge.jsx';
import RankUnlockReveal from './RankUnlockReveal.jsx';

export default function RankBadgeShowcase({ rank, isEarned = false, serialNumber, achievementRevealActive = false }) {
  const serial = serialNumber || (isEarned ? 'SERIAL PENDING' : 'NOT ASSIGNED');
  const presentation = isEarned ? 'earned' : 'preview';

  return (
    <>
      <aside className={`rank-badge-showcase rank-badge-showcase--${rank.aura}${isEarned ? ' is-earned' : ''}`} aria-label={`${rank.name} exclusive badge ${isEarned ? 'earned state' : 'preview'}`}>
        <div className="rank-badge-showcase__heading"><span>EXCLUSIVE RANK BADGE</span><b>{isEarned ? 'UNLOCKED' : 'PREVIEW'}<i aria-hidden="true" /></b></div>
        <div className="rank-badge-showcase__art">
          <RankBadge rank={rank} serialNumber={serial} size="large" presentation={presentation} />
          <p className="rank-badge-showcase__caption">{isEarned ? 'This Rank badge is unlocked on this account.' : 'Earn this Rank to unlock its exclusive badge.'}</p>
        </div>
      </aside>
      {isEarned && achievementRevealActive && <RankUnlockReveal rank={rank} serialNumber={serialNumber} active={achievementRevealActive} />}
    </>
  );
}
