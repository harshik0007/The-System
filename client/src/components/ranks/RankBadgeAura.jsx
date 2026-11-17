export const badgeTones = {
  origin: ['#102B40', '#78C9F2', '#DDF7FF'],
  ember: ['#32180E', '#FF9857', '#FFE0AD'],
  surge: ['#0A3131', '#54D7C5', '#D5FFF6'],
  vector: ['#101F3C', '#579EFF', '#DCEEFF'],
  apex: ['#20183A', '#A38BFF', '#EEE8FF'],
  zenith: ['#30200D', '#F2C96B', '#FFF0C7'],
  continuum: ['#190D18', '#F0443E', '#F5FAFF'],
};

export default function RankBadgeAura({ rank, presentation, unlocking, size, className = '', children }) {
  const [shadow, accent] = badgeTones[rank.slug] || [rank.color, rank.color];
  const classes = [
    'rank-badge-aura',
    `rank-badge-aura--${rank.slug}`,
    `rank-badge-aura--${presentation}`,
    `rank-badge-aura--${size}`,
    unlocking && 'rank-badge-aura--unlocking',
    className,
  ].filter(Boolean).join(' ');

  return <span className={classes} style={{ '--rank-accent': accent, '--rank-shadow': shadow }}>{children}</span>;
}
