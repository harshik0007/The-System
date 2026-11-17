export default function ScrollReveal({ as: Element = 'div', className = '', children, ...props }) {
  return <Element className={`scroll-reveal ${className}`.trim()} {...props}>{children}</Element>;
}
