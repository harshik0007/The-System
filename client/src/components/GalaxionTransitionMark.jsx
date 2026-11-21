export default function GalaxionTransitionMark() {
  return (
    <span className="galaxion-transition-mark" aria-hidden="true">
      <svg className="galaxion-transition-mark__svg" viewBox="0 0 144 144" fill="none" focusable="false">
        <circle className="galaxion-transition-mark__halo" cx="72" cy="72" r="43" />
        <circle className="galaxion-transition-mark__horizon-edge" cx="72" cy="72" r="38" />
        <circle className="galaxion-transition-mark__black-hole" cx="72" cy="72" r="35" />
        <circle className="galaxion-transition-mark__horizon-glint" cx="72" cy="72" r="36.5" />
      </svg>

      <i className="galaxion-transition-mark__planet" />
      <i className="galaxion-transition-mark__meteor galaxion-transition-mark__meteor--one" />
      <i className="galaxion-transition-mark__meteor galaxion-transition-mark__meteor--two" />
      <i className="galaxion-transition-mark__falling-star galaxion-transition-mark__falling-star--one" />
      <i className="galaxion-transition-mark__falling-star galaxion-transition-mark__falling-star--two" />
      <i className="galaxion-transition-mark__falling-star galaxion-transition-mark__falling-star--three" />
    </span>
  );
}
