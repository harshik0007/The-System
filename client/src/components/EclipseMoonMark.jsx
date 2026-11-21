export default function EclipseMoonMark({ className = '' }) {
  return (
    <span className={`eclipse-moon-mark ${className}`.trim()} aria-hidden="true">
      <i className="eclipse-moon-mark__halo" />
      <i className="eclipse-moon-mark__orbit eclipse-moon-mark__orbit--violet" />
      <i className="eclipse-moon-mark__orbit eclipse-moon-mark__orbit--silver" />
      <i className="eclipse-moon-mark__disc" />
      <i className="eclipse-moon-mark__shadow" />
      <i className="eclipse-moon-mark__star eclipse-moon-mark__star--one" />
      <i className="eclipse-moon-mark__star eclipse-moon-mark__star--two" />
    </span>
  );
}
