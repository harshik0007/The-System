export default function ProgressionEmblem({ stage, active = false }) {
  return (
    <svg className={`emblem-svg${active ? ' is-active' : ''}`} viewBox="0 0 100 100" role="img" aria-label={`Geometric emblem for stage ${stage.number}`}>
      {stage.emblem.map((shape, index) => {
        const className = `emblem-stroke${shape.className ? ` emblem-${shape.className}` : ''}`;
        if (shape.type === 'circle') {
          const isCore = shape.className === 'core';
          return <circle key={`${shape.type}-${index}`} className={className} cx={shape.cx} cy={shape.cy} r={shape.r} fill={isCore ? 'currentColor' : 'none'} />;
        }
        return <path key={`${shape.type}-${index}`} className={className} d={shape.d} />;
      })}
    </svg>
  );
}
