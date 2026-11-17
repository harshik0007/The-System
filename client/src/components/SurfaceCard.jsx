export default function SurfaceCard({ as: Element = 'article', variant, className = '', children, ...props }) {
  return (
    <Element className={`surface-card surface-card--${variant}${className ? ` ${className}` : ''}`} {...props}>
      {children}
    </Element>
  );
}
