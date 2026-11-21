import { createPortal } from 'react-dom';

const CURTAINS = [
  { left: '-9%', width: '38%', hue: 'teal', duration: '31s', delay: '-9s', sway: '2.8vw', returnSway: '-1.5vw', tilt: '-3deg' },
  { left: '17%', width: '38%', hue: 'violet', duration: '39s', delay: '-23s', sway: '-3vw', returnSway: '1.7vw', tilt: '2deg' },
  { left: '45%', width: '38%', hue: 'ice', duration: '35s', delay: '-15s', sway: '2.5vw', returnSway: '-1.4vw', tilt: '-2deg' },
  { left: '70%', width: '38%', hue: 'teal', duration: '43s', delay: '-27s', sway: '-2.6vw', returnSway: '1.4vw', tilt: '2deg' },
];

const PARTICLE_TYPES = [
  { kind: 'tiny', count: 24, size: [1.2, 2.4], duration: [34, 48], opacity: [.3, .56], drift: 44 },
  { kind: 'medium', count: 7, size: [7, 12], duration: [39, 54], opacity: [.42, .7], drift: 52 },
  { kind: 'large', count: 2, size: [13, 19], duration: [46, 61], opacity: [.5, .8], drift: 58 },
  { kind: 'silver', count: 4, size: [1.5, 2.8], duration: [31, 45], opacity: [.5, .84], drift: 38 },
  { kind: 'streak', count: 3, size: [1, 1.6], length: [54, 112], duration: [20, 29], opacity: [.2, .4], drift: 34 },
];

const BALANCED_COUNTS = { tiny: 19, medium: 5, large: 1, silver: 3, streak: 2 };
const LOW_POWER_COUNTS = { tiny: 12, medium: 3, large: 1, silver: 2, streak: 1 };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const randomFor = (seed) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};
const rangeFor = (range, seed) => range[0] + randomFor(seed) * (range[1] - range[0]);

const PARTICLES = PARTICLE_TYPES.flatMap((type, typeIndex) => Array.from({ length: type.count }, (_, index) => {
  const seed = (typeIndex + 1) * 97 + index * 31;
  const slot = (index + .5) / type.count;
  const left = clamp((slot + (randomFor(seed) - .5) * .52 / type.count) * 100, 2, 98);
  const hueChoices = ['ice', 'teal', 'violet'];
  const hue = type.kind === 'silver' || type.kind === 'streak'
    ? 'silver'
    : hueChoices[Math.floor(randomFor(seed + 4) * hueChoices.length)];
  return {
    ...type,
    index,
    id: `${type.kind}-${index}`,
    left,
    hue,
    sizePx: rangeFor(type.size, seed + 1),
    lengthPx: type.length ? rangeFor(type.length, seed + 2) : 0,
    durationSeconds: rangeFor(type.duration, seed + 3),
    delaySeconds: randomFor(seed + 5) * 4.5,
    opacityValue: rangeFor(type.opacity, seed + 6),
    driftMid: (randomFor(seed + 7) - .5) * type.drift,
    driftEnd: (randomFor(seed + 8) - .5) * type.drift,
    turnMid: (randomFor(seed + 9) - .5) * 170,
    turnEnd: (randomFor(seed + 10) - .5) * 300,
  };
}));

function getParticleCounts(effectQuality = 'balanced') {
  if (effectQuality === 'low') return LOW_POWER_COUNTS;
  if (effectQuality === 'balanced') return BALANCED_COUNTS;
  if (effectQuality === 'high') return Object.fromEntries(PARTICLE_TYPES.map(({ kind, count }) => [kind, count]));
  const cores = navigator.hardwareConcurrency || 8;
  const memory = navigator.deviceMemory || 8;
  if (cores <= 4 || memory <= 4) return LOW_POWER_COUNTS;
  if (window.innerWidth <= 900 || cores <= 10 || memory <= 8 || window.matchMedia?.('(pointer: coarse)').matches) {
    return BALANCED_COUNTS;
  }
  return Object.fromEntries(PARTICLE_TYPES.map(({ kind, count }) => [kind, count]));
}

function AuroraParticle({ particle }) {
  const className = `aurora-emergency-atmosphere__particle is-${particle.kind} is-${particle.hue}`;
  const style = {
    '--particle-left': `${particle.left}%`,
    '--particle-size': `${particle.sizePx}px`,
    '--particle-width': `${particle.sizePx * .9}px`,
    '--particle-height': `${particle.sizePx * 1.35}px`,
    '--particle-length': `${particle.lengthPx}px`,
    '--particle-duration': `${particle.durationSeconds}s`,
    '--particle-delay': `${particle.delaySeconds}s`,
    '--particle-opacity': particle.opacityValue,
    '--particle-drift-mid': `${particle.driftMid}px`,
    '--particle-drift-end': `${particle.driftEnd}px`,
    '--particle-turn-mid': `${particle.turnMid}deg`,
    '--particle-turn-end': `${particle.turnEnd}deg`,
  };

  return (
    <span className={className} key={particle.id} style={style}>
      {(particle.kind === 'medium' || particle.kind === 'large') && <svg className="aurora-emergency-atmosphere__crystal" viewBox="0 0 24 32" aria-hidden="true" focusable="false">
        <path className="aurora-emergency-atmosphere__crystal-edge" d="M12 1 20 8 17 16 22 22 12 31 3 24 7 16 3 8Z" />
        <path className="aurora-emergency-atmosphere__crystal-facet" d="M12 1 12 13 20 8M12 13 17 16 12 31M12 13 7 16 3 8M12 13 3 24" />
      </svg>}
    </span>
  );
}

export default function AuroraEmergencyAtmosphere({
  visible,
  phase = 'active',
  documentVisible = true,
  reducedMotion,
  reduceDecorativeEffects,
  effectQuality = 'balanced',
}) {
  if (!visible) return null;

  const staticOnly = reducedMotion || reduceDecorativeEffects;
  const particleCounts = getParticleCounts(effectQuality);
  const particles = staticOnly ? [] : PARTICLES.filter((particle) => particle.index < particleCounts[particle.kind]);

  return createPortal(
    <div
      className={`aurora-emergency-atmosphere${staticOnly ? ' is-static' : ''}${phase === 'ending' ? ' is-ending' : ''}`}
      data-document-visible={documentVisible ? 'true' : 'false'}
      aria-hidden="true"
    >
      <div className="aurora-emergency-atmosphere__aura" />
      <div className="aurora-emergency-atmosphere__curtains">
        {CURTAINS.map((curtain, index) => (
          <span
            className={`aurora-emergency-atmosphere__curtain is-${curtain.hue}`}
            key={`curtain-${index}`}
            style={{
              '--curtain-left': curtain.left,
              '--curtain-width': curtain.width,
              '--curtain-duration': curtain.duration,
              '--curtain-delay': curtain.delay,
              '--curtain-sway': curtain.sway,
              '--curtain-return-sway': curtain.returnSway,
              '--curtain-tilt': curtain.tilt,
            }}
          />
        ))}
      </div>
      {!staticOnly && <div className="aurora-emergency-atmosphere__particles">
        {particles.map((particle) => <AuroraParticle key={particle.id} particle={particle} />)}
      </div>}
    </div>,
    document.body,
  );
}
