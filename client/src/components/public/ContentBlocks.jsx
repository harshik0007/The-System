import { Link } from 'react-router-dom';
import SurfaceCard from '../SurfaceCard.jsx';

export function ContentSection({ id, eyebrow, title, children, className = '' }) {
  return <section className={`public-section public-reveal ${className}`} id={id}>
    {eyebrow && <p className="public-eyebrow">{eyebrow}</p>}
    {title && <h2>{title}</h2>}
    <div className="public-section__body">{children}</div>
  </section>;
}

export function InfoGrid({ items, columns = 3 }) {
  return <div className={`public-card-grid public-card-grid--${columns}`}>
    {items.map((item, index) => <SurfaceCard key={item.title} variant="info" className="public-card">
      <div className="public-card__top"><span className="public-card__index">{item.label || String(index + 1).padStart(2, '0')}</span><span className="public-card__glyph" aria-hidden="true">{item.icon || '◇'}</span></div>
      <h3>{item.title}</h3><p>{item.body}</p>
      {item.href && <Link className="public-inline-link" to={item.href}>{item.action || 'Explore'} <span aria-hidden="true">↗</span></Link>}
    </SurfaceCard>)}
  </div>;
}

export function ActionLink({ to, children, secondary = false }) {
  return <Link className={`public-action${secondary ? ' public-action--secondary' : ''}`} to={to}>{children}<span aria-hidden="true">↗</span></Link>;
}

export function DataTable({ headers, rows, caption }) {
  return <div className="public-table-wrap"><table className="public-table">
    {caption && <caption>{caption}</caption>}
    <thead><tr>{headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
    <tbody>{rows.map((row) => <tr key={row.join('-')}>{row.map((cell, i) => <td key={`${i}-${cell}`}>{cell}</td>)}</tr>)}</tbody>
  </table></div>;
}
