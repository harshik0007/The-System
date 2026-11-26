import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import '../../styles/emergency-pause-atmosphere.css';

const LEAF_SHAPES = [
  'M2 14 C8 12 9 5 17 3 C25 1 33 6 40 14 C33 22 25 27 17 25 C9 23 8 16 2 14 Z',
  'M2 14 C8 10 7 5 13 5 C17 1 22 3 24 7 C30 3 37 7 40 14 C37 21 31 25 25 21 C21 27 15 26 12 22 C7 24 3 19 2 14 Z',
  'M2 14 C8 12 9 7 14 4 L19 8 L23 2 L27 8 C33 5 38 9 40 14 C36 20 31 23 25 20 L21 26 L17 20 C10 23 5 19 2 14 Z',
];

const LEAVES = [
  { left: '2%', duration: '27s', delay: '-1.6s', width: '27px', height: '18px', drift1: '24px', drift2: '-10px', drift3: '31px', driftEnd: '4px', opacity: '.5', color: '#b32038', shape: 0 },
  { left: '9%', duration: '31s', delay: '-3.7s', width: '24px', height: '17px', drift1: '-22px', drift2: '14px', drift3: '-27px', driftEnd: '-8px', opacity: '.46', color: '#86172e', shape: 1 },
  { left: '16%', duration: '24s', delay: '-4.3s', width: '30px', height: '20px', drift1: '30px', drift2: '8px', drift3: '-19px', driftEnd: '20px', opacity: '.54', color: '#c12a40', shape: 2, glow: true },
  { left: '23%', duration: '29s', delay: '-7s', width: '23px', height: '16px', drift1: '-14px', drift2: '29px', drift3: '6px', driftEnd: '-18px', opacity: '.45', color: '#98192f', shape: 0 },
  { left: '31%', duration: '34s', delay: '-10.2s', width: '28px', height: '19px', drift1: '19px', drift2: '-24px', drift3: '17px', driftEnd: '2px', opacity: '.5', color: '#761629', shape: 1 },
  { left: '38%', duration: '26s', delay: '-9.4s', width: '22px', height: '15px', drift1: '-28px', drift2: '11px', drift3: '23px', driftEnd: '-13px', opacity: '.48', color: '#bd263c', shape: 2 },
  { left: '45%', duration: '30s', delay: '-12.6s', width: '29px', height: '19px', drift1: '13px', drift2: '-18px', drift3: '30px', driftEnd: '-5px', opacity: '.51', color: '#8b172c', shape: 0 },
  { left: '52%', duration: '25s', delay: '-12s', width: '24px', height: '17px', drift1: '-25px', drift2: '20px', drift3: '-8px', driftEnd: '22px', opacity: '.55', color: '#ad1f35', shape: 1, glow: true },
  { left: '59%', duration: '33s', delay: '-17.8s', width: '31px', height: '20px', drift1: '18px', drift2: '-29px', drift3: '12px', driftEnd: '-14px', opacity: '.46', color: '#741528', shape: 2 },
  { left: '66%', duration: '28s', delay: '-16.8s', width: '23px', height: '16px', drift1: '-17px', drift2: '25px', drift3: '-20px', driftEnd: '8px', opacity: '.51', color: '#c02b40', shape: 0 },
  { left: '73%', duration: '35s', delay: '-23.1s', width: '27px', height: '18px', drift1: '26px', drift2: '-9px', drift3: '16px', driftEnd: '-25px', opacity: '.47', color: '#78172a', shape: 1 },
  { left: '80%', duration: '27s', delay: '-19.4s', width: '22px', height: '15px', drift1: '-12px', drift2: '22px', drift3: '-29px', driftEnd: '14px', opacity: '.52', color: '#a82037', shape: 2 },
  { left: '88%', duration: '32s', delay: '-25s', width: '30px', height: '20px', drift1: '21px', drift2: '-15px', drift3: '26px', driftEnd: '-7px', opacity: '.49', color: '#9c1c32', shape: 0, glow: true },
  { left: '95%', duration: '24s', delay: '-20.2s', width: '24px', height: '16px', drift1: '-18px', drift2: '24px', drift3: '-11px', driftEnd: '16px', opacity: '.45', color: '#741528', shape: 1 },
  { left: '27%', duration: '32s', delay: '-10.9s', width: '32px', height: '21px', drift1: '22px', drift2: '-19px', drift3: '12px', driftEnd: '-16px', opacity: '.57', color: '#d03148', shape: 2, glow: true },
  { left: '82%', duration: '26s', delay: '-23.7s', width: '26px', height: '18px', drift1: '-20px', drift2: '17px', drift3: '-25px', driftEnd: '11px', opacity: '.54', color: '#a32038', shape: 1 },
  { left: '5%', duration: '30s', delay: '-18.4s', width: '25px', height: '17px', drift1: '17px', drift2: '-23px', drift3: '9px', driftEnd: '20px', opacity: '.56', color: '#bd2941', shape: 0, glow: true },
  { left: '35%', duration: '25s', delay: '-21.6s', width: '29px', height: '19px', drift1: '-19px', drift2: '26px', drift3: '-8px', driftEnd: '-23px', opacity: '.52', color: '#921c34', shape: 2 },
  { left: '64%', duration: '34s', delay: '-15.3s', width: '24px', height: '16px', drift1: '23px', drift2: '-12px', drift3: '20px', driftEnd: '-9px', opacity: '.55', color: '#c12c43', shape: 1 },
  { left: '92%', duration: '28s', delay: '-26.8s', width: '31px', height: '20px', drift1: '-24px', drift2: '15px', drift3: '-17px', driftEnd: '12px', opacity: '.53', color: '#a41e36', shape: 0, glow: true },
];

const PARTICLES = [
  { left: '5%', top: '73%', size: '3px', duration: '21s', delay: '-14s', drift: '18px', driftBack: '-10px', midY: '-10vh', endY: '-22vh', opacity: '.39' },
  { left: '12%', top: '39%', size: '3px', duration: '26s', delay: '-4s', drift: '-16px', driftBack: '9px', midY: '-7vh', endY: '-15vh', opacity: '.32', glow: true },
  { left: '19%', top: '82%', size: '2px', duration: '19s', delay: '-11s', drift: '11px', driftBack: '-6px', midY: '-15vh', endY: '-29vh', opacity: '.35' },
  { left: '27%', top: '24%', size: '2px', duration: '28s', delay: '-21s', drift: '22px', driftBack: '-12px', midY: '3vh', endY: '7vh', opacity: '.28' },
  { left: '33%', top: '68%', size: '4px', duration: '23s', delay: '-16s', drift: '-19px', driftBack: '11px', midY: '-12vh', endY: '-24vh', opacity: '.36', glow: true },
  { left: '40%', top: '32%', size: '2px', duration: '25s', delay: '-8s', drift: '14px', driftBack: '-8px', midY: '-4vh', endY: '-18vh', opacity: '.29' },
  { left: '47%', top: '87%', size: '3px', duration: '20s', delay: '-18s', drift: '-12px', driftBack: '7px', midY: '-17vh', endY: '-31vh', opacity: '.34' },
  { left: '54%', top: '49%', size: '2px', duration: '29s', delay: '-23s', drift: '20px', driftBack: '-11px', midY: '2vh', endY: '5vh', opacity: '.28' },
  { left: '61%', top: '77%', size: '3px', duration: '22s', delay: '-2s', drift: '-21px', driftBack: '12px', midY: '-13vh', endY: '-25vh', opacity: '.37', glow: true },
  { left: '68%', top: '29%', size: '2px', duration: '27s', delay: '-12s', drift: '12px', driftBack: '-7px', midY: '-8vh', endY: '-20vh', opacity: '.3' },
  { left: '75%', top: '63%', size: '3px', duration: '24s', delay: '-19s', drift: '-15px', driftBack: '8px', midY: '-15vh', endY: '-27vh', opacity: '.35' },
  { left: '82%', top: '18%', size: '2px', duration: '30s', delay: '-26s', drift: '17px', driftBack: '-9px', midY: '1vh', endY: '6vh', opacity: '.27' },
  { left: '90%', top: '88%', size: '4px', duration: '25s', delay: '-17s', drift: '-18px', driftBack: '10px', midY: '-12vh', endY: '-26vh', opacity: '.38', glow: true },
  { left: '97%', top: '44%', size: '2px', duration: '31s', delay: '-9s', drift: '13px', driftBack: '-7px', midY: '-6vh', endY: '-17vh', opacity: '.3' },
  { left: '3%', top: '50%', size: '3px', duration: '22s', delay: '-7s', drift: '16px', driftBack: '-9px', midY: '-9vh', endY: '-20vh', opacity: '.33' },
  { left: '58%', top: '14%', size: '2px', duration: '27s', delay: '-22s', drift: '-14px', driftBack: '8px', midY: '2vh', endY: '8vh', opacity: '.28' },
  { left: '22%', top: '57%', size: '3px', duration: '24s', delay: '-13s', drift: '19px', driftBack: '-11px', midY: '-10vh', endY: '-21vh', opacity: '.35', glow: true },
  { left: '36%', top: '91%', size: '2px', duration: '32s', delay: '-6s', drift: '-13px', driftBack: '7px', midY: '-18vh', endY: '-33vh', opacity: '.3' },
  { left: '73%', top: '37%', size: '3px', duration: '21s', delay: '-16s', drift: '15px', driftBack: '-8px', midY: '3vh', endY: '9vh', opacity: '.32' },
  { left: '85%', top: '71%', size: '4px', duration: '28s', delay: '-24s', drift: '-17px', driftBack: '10px', midY: '-14vh', endY: '-27vh', opacity: '.37', glow: true },
  { left: '15%', top: '12%', size: '3px', duration: '23s', delay: '-20s', drift: '-12px', driftBack: '8px', midY: '8vh', endY: '16vh', opacity: '.35', glow: true },
  { left: '29%', top: '78%', size: '2px', duration: '30s', delay: '-25s', drift: '18px', driftBack: '-10px', midY: '-12vh', endY: '-24vh', opacity: '.33' },
  { left: '43%', top: '17%', size: '3px', duration: '24s', delay: '-10s', drift: '-16px', driftBack: '9px', midY: '5vh', endY: '12vh', opacity: '.36' },
  { left: '64%', top: '90%', size: '2px', duration: '27s', delay: '-19s', drift: '14px', driftBack: '-8px', midY: '-16vh', endY: '-29vh', opacity: '.34', glow: true },
  { left: '78%', top: '53%', size: '3px', duration: '22s', delay: '-5s', drift: '-19px', driftBack: '11px', midY: '-7vh', endY: '-19vh', opacity: '.37' },
  { left: '94%', top: '9%', size: '2px', duration: '31s', delay: '-28s', drift: '12px', driftBack: '-7px', midY: '6vh', endY: '13vh', opacity: '.33' },
];

const PARTICLE_COLORS = ['#c52c45', '#e5485b', '#a91d38', '#ed4a5d'];

function Leaf({ leaf, index }) {
  return (
    <span
      className={`emergency-pause-atmosphere__leaf${leaf.glow ? ' is-luminous' : ''}`}
      key={`leaf-${index}`}
      style={{
        '--leaf-left': leaf.left,
        '--leaf-duration': leaf.duration,
        '--leaf-delay': leaf.delay,
        '--leaf-width': leaf.width,
        '--leaf-height': leaf.height,
        '--leaf-drift-1': leaf.drift1,
        '--leaf-drift-2': leaf.drift2,
        '--leaf-drift-3': leaf.drift3,
        '--leaf-drift-end': leaf.driftEnd,
        '--leaf-opacity': leaf.opacity,
        '--leaf-color': leaf.color,
      }}
    >
      <svg viewBox="0 0 42 28" aria-hidden="true" focusable="false">
        <path className="emergency-pause-atmosphere__leaf-shape" d={LEAF_SHAPES[leaf.shape]} />
        <path className="emergency-pause-atmosphere__leaf-vein" d="M2 14 C13 14 25 14 39 14 M13 14 L17 7 M19 14 L24 21 M27 14 L31 8 M9 13 L11 9 M32 15 L35 20" />
      </svg>
    </span>
  );
}

export default function EmergencyPauseAtmosphere({ active, devPreview, reduceDecorativeEffects = false }) {
  const shouldShow = devPreview ?? active;
  const reducedMotion = useReducedMotion() || reduceDecorativeEffects;
  const [visible, setVisible] = useState(Boolean(shouldShow));
  const [phase, setPhase] = useState(shouldShow ? 'entering' : 'idle');
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden);

  useEffect(() => {
    let animationFrameId;
    let timeoutId;

    if (shouldShow) {
      setVisible(true);
      setPhase('entering');
      animationFrameId = window.requestAnimationFrame(() => setPhase('active'));
    } else if (visible) {
      setPhase('ending');
      timeoutId = window.setTimeout(() => {
        setVisible(false);
        setPhase('idle');
      }, reducedMotion ? 240 : 1500);
    }

    return () => {
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [shouldShow, reducedMotion]);

  useLayoutEffect(() => {
    if (!visible) return undefined;
    document.body.classList.add('emergency-pause-atmosphere-running');
    return () => document.body.classList.remove('emergency-pause-atmosphere-running');
  }, [visible]);

  useEffect(() => {
    const updateVisibility = () => setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  if (!visible) return null;

  return createPortal(
    <div
      className={`emergency-pause-atmosphere emergency-pause-atmosphere--${phase}${reducedMotion ? ' is-reduced-motion' : ''}`}
      data-document-visible={documentVisible ? 'true' : 'false'}
      aria-hidden="true"
    >
      <div className="emergency-pause-atmosphere__aura" />
      <div className="emergency-pause-atmosphere__leaves">
        {LEAVES.map((leaf, index) => <Leaf leaf={leaf} index={index} key={`leaf-${index}`} />)}
      </div>
      <div className="emergency-pause-atmosphere__particles">
        {PARTICLES.map((particle, index) => (
          <span
            className={`emergency-pause-atmosphere__particle${particle.glow ? ' is-luminous' : ''}`}
            key={`particle-${index}`}
            style={{
              '--particle-left': particle.left,
              '--particle-top': particle.top,
              '--particle-color': PARTICLE_COLORS[index % PARTICLE_COLORS.length],
              '--particle-size': particle.size,
              '--particle-duration': particle.duration,
              '--particle-delay': particle.delay,
              '--particle-drift': particle.drift,
              '--particle-drift-back': particle.driftBack,
              '--particle-mid-y': particle.midY,
              '--particle-end-y': particle.endY,
              '--particle-opacity': particle.opacity,
            }}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}
