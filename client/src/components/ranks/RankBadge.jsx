import { useId } from 'react';
import { RankEmblemArtwork } from './RankEmblem.jsx';
import RankBadgeAura, { badgeTones } from './RankBadgeAura.jsx';

export default function RankBadge({ rank, serialNumber, size = 'medium', className = '', presentation = 'preview', unlocking = false }) {
  const reactId = useId().replace(/:/g, '');
  const id = `award-${reactId}`;
  const isReference = presentation === 'reference';
  const serial = serialNumber || (isReference ? 'NOT ASSIGNED' : 'SERIAL PENDING');
  const [, accent, highlight] = badgeTones[rank.slug] || [rank.color, rank.color, '#F5FAFF'];
  const accessiblePresentation = presentation === 'earned' ? 'earned badge' : isReference ? 'reference artwork with no member serial assigned' : 'badge preview';
  return (
    <RankBadgeAura rank={rank} presentation={presentation} unlocking={unlocking} size={size} className={className}>
      <svg className={`rank-badge rank-badge--collectible rank-badge--${rank.slug}`} viewBox="0 0 320 430" role="img"
        style={{ '--rank-metal-fill': `url(#${id}-emblem-metal)`, '--rank-inlay-fill': `url(#${id}-emblem-inlay)` }}
        aria-label={`${rank.name}, Rank ${rank.number} ${accessiblePresentation}${isReference ? '' : `, serial ${serial}`}`} focusable="false">
        <text x="160" y="72" className="rank-badge__brand" textAnchor="middle" fill="#F5FAFF">THE SYSTEM</text>
        <path className="rank-badge__rank-plate" d="M111 91h98l11 13-11 13h-98l-11-13Z" fill="#080E17" stroke={accent} strokeWidth="1.4"/>
        <text x="160" y="109" className="rank-badge__number" textAnchor="middle" fill={highlight}>RANK {rank.number}</text>
        {rank.slug === 'continuum' && <g className="rank-badge__continuum-orbit" aria-hidden="true">
          <ellipse cx="160" cy="203" rx="104" ry="49" fill="none" stroke="#7F1024" strokeWidth="1" strokeDasharray="3 7 28 10" />
          <ellipse cx="160" cy="203" rx="99" ry="45" fill="none" stroke="#DCE4EF" strokeOpacity=".52" strokeWidth=".55" strokeDasharray="1 18 16 32" />
          <circle cx="56" cy="203" r="1.5" fill="#FF6670" />
          <circle cx="264" cy="203" r="1.3" fill="#DCE4EF" />
        </g>}
        <g transform={rank.slug === 'continuum' ? 'translate(77 124) scale(1.66)' : 'translate(90 133) scale(1.4)'} className="rank-badge__core"><RankEmblemArtwork rank={rank} idPrefix={`${id}-emblem`}/></g>
        <text x="160" y={rank.badgeTitle ? '304' : '319'} className="rank-badge__name" textAnchor="middle" fill="#F5FAFF">{rank.name.toUpperCase()}</text>
        {rank.badgeTitle && <text x="160" y="326" className="rank-badge__title" textAnchor="middle" fill="#FF6670">{rank.badgeTitle}</text>}
        <path className="rank-badge__serial-plate" d="M91 342h138l14 17-14 17H91l-14-17Z" fill="#080E17" stroke={accent} strokeWidth="1.6"/>
        <path className="rank-badge__serial-highlight" d="M104 346h112" stroke={highlight} strokeOpacity=".42"/>
        <text x="160" y="363" className="rank-badge__serial" textAnchor="middle" fill="#F5FAFF">{serial}</text>
        <text x="160" y="395" className="rank-badge__state" textAnchor="middle" fill={highlight}>{presentation === 'earned' ? 'EARNED' : isReference ? 'REFERENCE' : 'PREVIEW'}</text>
      </svg>
    </RankBadgeAura>
  );
}
