import { Link } from 'react-router-dom';

export default function Button({ children, href, variant = 'primary', className = '', ...props }) {
  const classes = `button button--${variant} ${className}`.trim();
  return href?.startsWith('/')
    ? <Link className={classes} to={href} {...props}>{children}</Link>
    : <a className={classes} href={href} {...props}>{children}</a>;
}
