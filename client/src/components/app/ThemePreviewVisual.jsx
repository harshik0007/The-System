export default function ThemePreviewVisual({ theme, size = 'card' }) {
  return (
    <div
      className={`theme-preview-visual theme-preview-visual--${theme.id} theme-preview-visual--${size}`}
      style={{
        '--preview-background': theme.colors[0],
        '--preview-surface': theme.colors[1],
        '--preview-accent': theme.colors[2],
        '--preview-secondary': theme.transition.secondary,
        '--theme-card-accent': theme.colors[2],
      }}
      role="img"
      aria-label={`${theme.name} interface preview`}
    >
      <div className="theme-preview-visual__sidebar" aria-hidden="true">
        <i />
        <span />
        <span />
        <span />
      </div>
      <div className="theme-preview-visual__workspace" aria-hidden="true">
        <div className="theme-preview-visual__topbar"><i /><i /><i /></div>
        <div className="theme-preview-visual__content">
          <div className="theme-preview-visual__feature">
            <span />
            <i />
            <b />
          </div>
          <div className="theme-preview-visual__metrics"><i /><i /><i /></div>
        </div>
      </div>
      <div className="theme-preview-visual__atmosphere" aria-hidden="true">
        <i className="theme-preview-visual__accretion" />
        <i className="theme-preview-visual__celestial" />
        <i className="theme-preview-visual__light" />
        <i className="theme-preview-visual__star theme-preview-visual__star--one" />
        <i className="theme-preview-visual__star theme-preview-visual__star--two" />
        <i className="theme-preview-visual__star theme-preview-visual__star--three" />
      </div>
    </div>
  );
}
