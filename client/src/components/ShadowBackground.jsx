export default function ShadowBackground({ variant = 'hero' }) {
  return (
    <div className={`shadow-field shadow-field--${variant}`} aria-hidden="true">
      <div className="shadow-light shadow-light--one" />
      <div className="shadow-light shadow-light--two" />
      <div className="shadow-ring shadow-ring--one" />
      <div className="shadow-ring shadow-ring--two" />
      <div className="shadow-shape shadow-shape--one" />
      <div className="shadow-shape shadow-shape--two" />
      <div className="shadow-shape shadow-shape--three" />
    </div>
  );
}
