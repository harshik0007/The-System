const SKELETON_SHAPES = {
  landing: ['identity', 'feature', 'wide', 'card', 'card'],
  auth: ['identity', 'feature', 'card'],
  public: ['toolbar', 'feature', 'wide', 'card', 'card'],
  dashboard: ['toolbar', 'feature', 'feature', 'card', 'card', 'wide'],
  tasks: ['toolbar', 'feature', 'feature', 'row', 'row', 'row'],
  recovery: ['toolbar', 'feature', 'feature', 'wide'],
  discipline: ['toolbar', 'feature', 'card', 'card', 'wide'],
  profile: ['identity', 'feature', 'card', 'card', 'wide'],
  table: ['toolbar', 'row', 'row', 'row', 'row', 'row'],
  settings: ['settings-nav', 'settings-content'],
  monthly: ['toolbar', 'feature', 'card', 'card', 'wide'],
  notifications: ['toolbar', 'row', 'row', 'row', 'row'],
  rows: ['row', 'row', 'row'],
  page: ['card', 'card', 'wide'],
};

export default function PageLoadingSkeleton({ variant = 'page', label = 'Loading page', compact = false }) {
  const shapes = SKELETON_SHAPES[variant] || SKELETON_SHAPES.page;
  return (
    <section className={`page-loading-skeleton page-loading-skeleton--${variant}${compact ? ' is-compact' : ''}`} role="status" aria-live="polite" aria-busy="true" aria-label={label}>
      <div className="page-loading-skeleton__layout" aria-hidden="true">
        {shapes.map((shape, index) => <div className={`page-loading-skeleton__block is-${shape}`} key={`${shape}-${index}`}>
          <i />
          {shape !== 'row' && <><i /><i /></>}
        </div>)}
      </div>
    </section>
  );
}

export function SkeletonLine({ width = 'medium', label = 'Loading content', className = '' }) {
  return <span className={`page-loading-skeleton__line page-loading-skeleton__line--${width}${className ? ` ${className}` : ''}`} role="status" aria-label={label}><i aria-hidden="true" /></span>;
}
