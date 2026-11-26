import { Link } from 'react-router-dom';

export default function BrandLogo({ variant = 'full', href = '#top', className = '', onClick, ...props }) {
  const classes = ['brand-logo', `brand-logo--${variant}`, className].filter(Boolean).join(' ');

  return (
    <Link className={classes} to={href} aria-label="THE SYSTEM home" onClick={onClick} {...props}>
      <span className="brand-logo__mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none" focusable="false">
          <path d="M20 2.8 35 11.4v17.2L20 37.2 5 28.6V11.4L20 2.8Z" />
          <path d="M20 8.5 30 14.2v11.6L20 31.5 10 25.8V14.2L20 8.5Z" />
          <path d="M20 13v14M13 20h14m-11.8-4.8 9.6 9.6m0-9.6-9.6 9.6" />
          <circle cx="20" cy="20" r="2.3" />
        </svg>
      </span>
      {variant === 'full' && (
        <span className="brand-logo__wordmark" aria-hidden="true">THE <b>SYSTEM</b></span>
      )}
    </Link>
  );
}
