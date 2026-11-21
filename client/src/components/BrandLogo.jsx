import { Link } from 'react-router-dom';
import GalaxionMark from './GalaxionMark.jsx';

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
          <g className="brand-logo__eclipse-identity" display="none">
            <ellipse className="brand-logo__eclipse-orbit" cx="20" cy="20" rx="13.1" ry="7.2" transform="rotate(-28 20 20)" />
            <circle className="brand-logo__eclipse-moon" cx="20" cy="20" r="6.1" />
            <path className="brand-logo__eclipse-crescent" d="M21.4 14.2a6.1 6.1 0 0 0 0 11.6 4.7 4.7 0 0 1 0-11.6Z" />
            <circle className="brand-logo__eclipse-star" cx="29.8" cy="11.8" r="1.05" />
          </g>
        </svg>
      </span>
      {variant === 'full' && (
        <span className="brand-logo__wordmark" aria-hidden="true">THE <b>SYSTEM</b></span>
      )}
      <span className="brand-logo__galaxion-emblem" aria-hidden="true"><GalaxionMark /></span>
    </Link>
  );
}
