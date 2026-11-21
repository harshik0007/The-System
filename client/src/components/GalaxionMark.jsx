import { useId } from 'react';

export default function GalaxionMark({ className = '' }) {
  const classes = ['galaxion-mark', className].filter(Boolean).join(' ');
  const gradientId = `galaxion-ring-${useId().replaceAll(':', '')}`;
  const coreId = `galaxion-core-${useId().replaceAll(':', '')}`;

  return (
    <svg className={classes} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="7" y1="20" x2="57" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E9E9F1" />
          <stop offset=".58" stopColor="#527DCD" />
          <stop offset="1" stopColor="#D3A477" />
        </linearGradient>
        <radialGradient id={coreId} cx="0" cy="0" r="1" gradientTransform="translate(26 22) rotate(56) scale(31)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#171820" />
          <stop offset="1" stopColor="#050507" />
        </radialGradient>
      </defs>
      <ellipse className="galaxion-mark__halo" cx="32" cy="32" rx="25" ry="10" transform="rotate(-22 32 32)" />
      <ellipse className="galaxion-mark__accretion" cx="32" cy="32" rx="23" ry="8" transform="rotate(-22 32 32)" stroke={`url(#${gradientId})`} />
      <circle className="galaxion-mark__core" cx="32" cy="32" r="11" fill={`url(#${coreId})`} />
      <path className="galaxion-mark__lensing" d="M21 31.8a11 11 0 0 1 21.5-3.1M42.8 32.8a11 11 0 0 1-21.4 3.1" />
      <path className="galaxion-mark__glint" d="M47.5 13v7m-3.5-3.5h7" />
      <circle className="galaxion-mark__star" cx="13" cy="47" r="1.4" />
    </svg>
  );
}
