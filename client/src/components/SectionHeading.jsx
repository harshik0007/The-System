export default function SectionHeading({ id, eyebrow, title, accent, description, align = 'left' }) {
  return (
    <div className={`section-heading section-heading--${align} scroll-reveal`}>
      {eyebrow && <p className="section-kicker"><span className="kicker-line" />{eyebrow}</p>}
      <h2 className="section-title" id={id}>{title}{accent && <><br /><em>{accent}</em></>}</h2>
      {description && <p className="section-heading-copy">{description}</p>}
    </div>
  );
}
