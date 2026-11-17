import { useId } from 'react';
import '../../styles/rank-emblem.css';

const designs = {
  origin: <>
    <path className="emblem-metal" d="M50 5 62 38 95 50 62 62 50 95 38 62 5 50 38 38Z" />
    <path className="emblem-inlay" d="M50 13 57 43 87 50 57 57 50 87 43 57 13 50 43 43Z" />
    <path className="emblem-engrave" d="M50 10v23m0 34v23M10 50h23m34 0h23" />
    <path className="emblem-core" d="m50 40 10 10-10 10-10-10Z" />
  </>,
  ember: <>
    <path className="emblem-metal" d="M51 5c7 18-2 24-3 34 8-5 13-12 15-20 19 19 29 38 20 55-6 12-18 20-34 20S20 86 16 71C11 54 23 38 35 27c-1 14 1 20 6 25C42 34 51 24 51 5Z" />
    <path className="emblem-inlay" d="M51 34c4 11 12 16 13 27 1 11-5 20-14 20s-17-7-16-17c1-8 9-16 17-30Z" />
    <path className="emblem-core" d="m50 52 9 11-9 13-9-13Z" />
  </>,
  surge: <>
    <path className="emblem-metal" d="M7 34c13-19 27-19 43 0s30 19 43 0v10c-13 19-27 19-43 0S20 25 7 44Zm0 17c13-19 27-19 43 0s30 19 43 0v10c-13 19-27 19-43 0S20 42 7 61Zm0 17c13-19 27-19 43 0s30 19 43 0v8c-13 17-27 17-43 0S20 68 7 86Z" />
    <path className="emblem-inlay" d="M9 39c12-15 25-15 40 2s28 17 40 2M9 56c12-15 25-15 40 2s28 17 40 2M9 73c12-15 25-15 40 2s28 17 40 2" />
    <path className="emblem-core" d="m50 43 7 7-7 7-7-7Zm0 17 7 7-7 7-7-7Z" />
  </>,
  vector: <>
    <path className="emblem-metal" d="M50 7 66 35 58 40 50 25 42 40 34 35ZM93 50 65 66 60 58 75 50 60 42 65 34ZM50 93 34 65 42 60 50 75 58 60 66 65ZM7 50 35 34 40 42 25 50 40 58 35 66Z" />
    <path className="emblem-inlay" d="m50 19 8 16-8 6-8-6Zm31 31-16 8-6-8 6-8Zm-31 31-8-16 8-6 8 6Zm-31-31 16-8 6 8-6 8Z" />
    <path className="emblem-engrave" d="m50 25 7 14m18 11-14 7m-11 18-7-14M25 50l14-7" />
    <path className="emblem-core" d="m50 39 11 11-11 11-11-11Z" />
  </>,
  apex: <>
    <path className="emblem-metal" d="m5 83 25-45 13 19L60 20l35 63H5Z" />
    <path className="emblem-inlay" d="m17 75 15-27 12 18 16-33 24 42H17Z" />
    <path className="emblem-engrave" d="m25 83 19-28 15 28m-7-42 8-14 8 14" />
    <path className="emblem-core" d="m60 20 7 8-7 8-7-8Z" />
  </>,
  zenith: <>
    <path className="emblem-metal" d="M50 4 59 34c3 9 10 10 19 2l13-12-5 27 12 10-28 5c-8 2-14 8-20 19-6-11-12-17-20-19L2 61l12-10-5-27 13 12c9 8 16 7 19-2Z" />
    <path className="emblem-inlay" d="M50 13 56 41l13 12 18-3-17 15c-7 2-14 8-20 15-6-7-13-13-20-15L13 50l18 3 13-12Z" />
    <path className="emblem-engrave" d="M50 8v27m-28 9 12 7m44-7-12 7" />
    <path className="emblem-core" d="m50 39 12 13-12 18-12-18Z" />
  </>,
  continuum: <>
    <path className="emblem-metal continuum-ribbon" d="M50 50C39 44 29 39 18 42 8 44 5 48 5 50c0 2 3 6 13 8 11 3 21-2 32-8Z" />
    <path className="emblem-metal continuum-ribbon" d="M50 50c11-6 21-11 32-8 10 2 13 6 13 8 0 2-3 6-13 8-11 3-21-2-32-8Z" />
    <path className="emblem-inlay continuum-ribbon-inlay" d="M50 50C39 44 29 39 18 42 8 44 5 48 5 50c0 2 3 6 13 8 11 3 21-2 32-8Zm0 0c11-6 21-11 32-8 10 2 13 6 13 8 0 2-3 6-13 8-11 3-21-2-32-8Z" />
    <path className="emblem-metal continuum-blade" d="m50 6 7 35-4 7 5 3-5 4-3 39-3-39-5-4 5-3-4-7Z" />
    <path className="emblem-engrave continuum-engrave" d="M50 12v27m0 21v27M17 49l16 1m50-1-16 1" />
    <path className="emblem-core continuum-crystal" d="m50 41 9 9-9 9-9-9Z" />
  </>,
};

const colors = {
  origin: ['#153C57', '#78C9F2', '#DDF7FF'], ember: ['#54250F', '#FF9857', '#FFE0AD'],
  surge: ['#0C514D', '#54D7C5', '#D5FFF6'], vector: ['#133968', '#579EFF', '#DCEEFF'],
  apex: ['#34235D', '#A38BFF', '#EEE8FF'], zenith: ['#553817', '#F2C96B', '#FFF0C7'],
  continuum: ['#450712', '#F0443E', '#F5FAFF'],
};

export function RankEmblemArtwork({ rank, idPrefix }) {
  const [shadow, accent, highlight] = colors[rank.slug] || [rank.color, rank.color, '#F5FAFF'];
  return (
    <>
      <defs>
        <linearGradient id={`${idPrefix}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={highlight} />
          <stop offset=".19" stopColor={accent} />
          <stop offset=".46" stopColor={shadow} />
          <stop offset=".7" stopColor={accent} />
          <stop offset="1" stopColor={highlight} />
        </linearGradient>
        <linearGradient id={`${idPrefix}-inlay`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor={highlight} stopOpacity=".68" />
          <stop offset="1" stopColor={shadow} stopOpacity=".92" />
        </linearGradient>
        {rank.slug === 'continuum' && <>
          <linearGradient id={`${idPrefix}-continuum-metal`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#DCE4EF" />
            <stop offset=".16" stopColor="#7F1024" />
            <stop offset=".34" stopColor="#B8203F" />
            <stop offset=".48" stopColor="#190D18" />
            <stop offset=".65" stopColor="#DCE4EF" />
            <stop offset=".82" stopColor="#7F1024" />
            <stop offset="1" stopColor="#F0443E" />
          </linearGradient>
          <linearGradient id={`${idPrefix}-continuum-inlay`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#FF6670" />
            <stop offset=".5" stopColor="#B8203F" />
            <stop offset="1" stopColor="#450712" />
          </linearGradient>
        </>}
        <filter id={`${idPrefix}-emission`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.7" result="glow" />
          <feFlood floodColor={accent} floodOpacity=".7" />
          <feComposite in2="glow" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g className={`emblem-art emblem-art--${rank.slug}`} style={rank.slug === 'continuum' ? { '--rank-metal-fill': `url(#${idPrefix}-continuum-metal)`, '--rank-inlay-fill': `url(#${idPrefix}-continuum-inlay)` } : undefined}>
        {designs[rank.slug] || designs.origin}
      </g>
    </>
  );
}

export default function RankEmblem({ rank, active = false, decorative = false, className = '' }) {
  const reactId = useId().replace(/:/g, '');
  const idPrefix = `rank-emblem-${reactId}`;
  return (
    <svg className={`emblem-svg emblem-svg--${rank.slug}${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`} viewBox="0 0 100 100"
      role={decorative ? undefined : 'img'} aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : `Rank ${rank.number} ${rank.name} insignia`} focusable="false"
      style={{ color: rank.color, '--rank-accent': rank.color, '--rank-metal-fill': `url(#${idPrefix}-metal)`, '--rank-inlay-fill': `url(#${idPrefix}-inlay)` }}>
      <RankEmblemArtwork rank={rank} idPrefix={idPrefix} />
    </svg>
  );
}
