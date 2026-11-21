import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import AuroraEmergencyAtmosphere from './AuroraEmergencyAtmosphere.jsx';
import EclipseEmergencyAtmosphere from './EclipseEmergencyAtmosphere.jsx';
import GalaxionAtmosphere from './GalaxionAtmosphere.jsx';
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
const EMBERFALL_DEPTH = { tiny: 0, streak: 1, medium: 2, large: 3, spark: 4 };
const EMBERFALL_SHARD_SHAPES = [
  [[.02, -1], [.44, -.58], [.82, -.22], [.39, .06], [.68, .74], [.12, .42], [-.52, .83], [-.25, .14], [-.74, -.08], [-.3, -.46]],
  [[-.16, -1], [.28, -.46], [.74, -.35], [.46, .02], [.92, .48], [.22, .34], [-.1, .86], [-.38, .24], [-.84, .04], [-.34, -.42]],
  [[.08, -.9], [.56, -.72], [.37, -.16], [.76, .16], [.38, .9], [-.04, .48], [-.68, .62], [-.28, .12], [-.55, -.34], [-.12, -.32]],
  [[-.06, -1], [.2, -.48], [.7, -.54], [.47, -.02], [.76, .62], [.1, .5], [-.42, .9], [-.24, .3], [-.82, -.12], [-.34, -.5]],
  [[.18, -.96], [.66, -.48], [.34, -.08], [.84, .28], [.34, .72], [-.04, .48], [-.76, .56], [-.36, .04], [-.66, -.46], [-.12, -.28]],
];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createEmberfallWave(width, height, elapsedSeconds, effectQuality = 'balanced') {
  const mobile = width <= 640;
  const lowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const screenScale = Math.min(1.08, Math.max(.82, Math.sqrt((width * height) / (1440 * 900))));
  const qualityScale = effectQuality === 'low' ? .42 : effectQuality === 'high' ? 1 : .72;
  const density = screenScale * (mobile ? .46 : lowPower ? .72 : 1) * qualityScale;
  const particles = [];
  const kindsPerWave = [
    ['tiny', Math.max(2, Math.round(3 * density)), [11, 15], [1.1, 2.5], [-22, 22]],
    ['medium', Math.max(1, Math.round(1.2 * density)), [12, 16], [5.5, 12], [-34, 34]],
    ['large', Math.round(.65 * density), [13, 17], [13, 22], [-42, 42]],
    ['streak', Math.round(.25 * density), [10, 13], [30, 62], [-16, 16]],
    ['spark', Math.round(.3 * density), [10, 13], [2.2, 4.2], [-20, 20]],
  ];

  const waveKinds = kindsPerWave.flatMap(([kind, count]) => Array.from({ length: Math.max(0, count) }, () => kind));
  for (let index = waveKinds.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [waveKinds[index], waveKinds[swapIndex]] = [waveKinds[swapIndex], waveKinds[index]];
  }
  const slotWidth = width / waveKinds.length;
  waveKinds.forEach((kind, index) => {
    const [, , durationRange, sizeRange, driftRange] = kindsPerWave.find(([candidate]) => candidate === kind);
    const size = randomBetween(...sizeRange);
    particles.push({
      kind,
      x: (index + randomBetween(.18, .82)) * slotWidth,
      // New embers enter above the viewport and travel downward until they exit.
      startY: -randomBetween(Math.max(18, height * .055), Math.max(56, height * .22)) - size,
      delay: elapsedSeconds + randomBetween(.015, mobile ? .2 : .16),
      duration: randomBetween(...durationRange),
      size,
      drift: randomBetween(...driftRange),
      angle: randomBetween(0, Math.PI * 2),
      rotation: randomBetween(kind === 'streak' ? -.12 : -2.2, kind === 'streak' ? .12 : 2.2),
      opacity: kind === 'spark' ? randomBetween(.42, .58) : kind === 'streak' ? randomBetween(.2, .34) : randomBetween(.24, .46),
      warmCore: Math.random() > (kind === 'spark' ? .28 : .72),
      glow: Math.random() < (kind === 'tiny' ? .2 : .42),
      shape: Math.floor(Math.random() * EMBERFALL_SHARD_SHAPES.length),
    });
  });
  // Draw the furthest embers first and the occasional foreground sparks last.
  return particles.sort((a, b) => EMBERFALL_DEPTH[b.kind] - EMBERFALL_DEPTH[a.kind]);
}

function drawShard(ctx, particle, x, y, alpha, large, progress) {
  const size = particle.size;
  const points = EMBERFALL_SHARD_SHAPES[particle.shape];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(particle.angle + particle.rotation * progress);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  points.forEach(([px, py], index) => index ? ctx.lineTo(px * size, py * size) : ctx.moveTo(px * size, py * size));
  ctx.closePath();
  const graphiteFill = ctx.createLinearGradient(-size * .7, -size, size * .8, size);
  graphiteFill.addColorStop(0, '#51494A');
  graphiteFill.addColorStop(.28, '#242226');
  graphiteFill.addColorStop(.62, '#17171C');
  graphiteFill.addColorStop(.84, '#5A3427');
  graphiteFill.addColorStop(1, '#252024');
  ctx.fillStyle = graphiteFill;
  ctx.fill();
  ctx.lineWidth = large ? 1 : .55;
  ctx.strokeStyle = 'rgba(255, 193, 102, .22)';
  ctx.shadowColor = particle.warmCore ? '#FFE0A3' : '#FF8A3D';
  ctx.shadowBlur = particle.glow ? (large ? 9 : 5) : 0;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Edge light follows a few facets rather than outlining the whole shape.
  ctx.beginPath();
  ctx.moveTo(points[0][0] * size, points[0][1] * size);
  ctx.lineTo(points[1][0] * size, points[1][1] * size);
  ctx.lineTo(points[2][0] * size, points[2][1] * size);
  ctx.strokeStyle = particle.warmCore ? 'rgba(255, 224, 163, .92)' : 'rgba(255, 161, 72, .84)';
  ctx.lineWidth = large ? 1.7 : 1.05;
  ctx.shadowColor = particle.warmCore ? '#FFE0A3' : '#FF8A3D';
  ctx.shadowBlur = particle.glow ? (large ? 8 : 4) : 1;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(-size * .36, size * .34);
  ctx.lineTo(-size * .04, -size * .44);
  ctx.lineTo(size * .22, -size * .12);
  ctx.closePath();
  ctx.fillStyle = particle.warmCore ? 'rgba(255, 193, 102, .38)' : 'rgba(255, 138, 61, .28)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-size * .2, size * .28);
  ctx.lineTo(size * .2, -size * .3);
  ctx.strokeStyle = 'rgba(255, 245, 218, .62)';
  ctx.lineWidth = large ? 1 : .55;
  ctx.stroke();
  ctx.restore();
}

function paintEmberfallParticle(ctx, particle, progress, height) {
  const fadeIn = Math.min(1, progress / .1);
  const fadeOut = Math.min(1, (1 - progress) / .11);
  const alpha = Math.max(0, Math.min(fadeIn, fadeOut)) * particle.opacity;
  const fallProgress = progress * progress * (3 - 2 * progress);
  const x = particle.x + particle.drift * (fallProgress + Math.sin(progress * Math.PI * 2 + particle.angle) * .055);
  const y = particle.startY + (height + particle.size + 12 - particle.startY) * fallProgress;
  if (alpha <= 0 || y < -particle.size * 2 || y > height + particle.size * 2) return;

  if (particle.kind === 'streak') {
    const trailLength = particle.size;
    const gradient = ctx.createLinearGradient(x, y - trailLength, x, y + 4);
    gradient.addColorStop(0, 'rgba(255, 193, 102, 0)');
    gradient.addColorStop(.48, particle.warmCore ? 'rgba(255, 224, 163, .75)' : 'rgba(255, 138, 61, .78)');
    gradient.addColorStop(1, 'rgba(255, 138, 61, 0)');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = particle.size < 58 ? 1 : 1.35;
    ctx.shadowColor = particle.warmCore ? '#FFE0A3' : '#FF8A3D';
    ctx.shadowBlur = particle.glow ? 5 : 0;
    ctx.beginPath();
    ctx.moveTo(x, y - trailLength);
    ctx.lineTo(x + particle.drift * .035, y + 4);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const trailLength = particle.kind === 'large' ? particle.size * 1.5 : particle.kind === 'medium' ? particle.size * 1.8 : particle.size * 3.6;
  const trail = ctx.createLinearGradient(x, y - trailLength, x, y);
  trail.addColorStop(0, 'rgba(255, 138, 61, 0)');
  trail.addColorStop(.72, particle.kind === 'tiny' ? 'rgba(255, 193, 102, .24)' : 'rgba(255, 138, 61, .5)');
  trail.addColorStop(1, particle.warmCore ? '#FFE0A3' : '#FFC166');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = trail;
  ctx.lineWidth = particle.kind === 'tiny' ? Math.max(.7, particle.size * .42) : particle.kind === 'large' ? 2.1 : 1.25;
  ctx.shadowColor = '#FF8A3D';
  ctx.shadowBlur = particle.glow ? (particle.kind === 'large' ? 8 : particle.kind === 'tiny' ? 3 : 5) : 0;
  ctx.beginPath();
  ctx.moveTo(x - particle.drift * .025, y - trailLength);
  ctx.lineTo(x, y);
  ctx.stroke();
  if (particle.kind === 'tiny') {
    ctx.beginPath();
    ctx.arc(x, y, particle.size * (particle.warmCore ? 1.25 : 1), 0, Math.PI * 2);
    ctx.fillStyle = particle.warmCore ? '#FFE0A3' : '#FF8A3D';
    ctx.fill();
  } else if (particle.kind === 'spark') {
    const flare = particle.size;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(particle.angle + particle.rotation * progress);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = '#FFE0A3';
    ctx.shadowBlur = particle.glow ? 8 : 2;
    ctx.strokeStyle = '#FFF0C2';
    ctx.lineWidth = .9;
    ctx.beginPath();
    ctx.moveTo(0, -flare * 1.5);
    ctx.lineTo(0, flare * 1.5);
    ctx.moveTo(-flare, 0);
    ctx.lineTo(flare, 0);
    ctx.stroke();
    ctx.fillStyle = '#FFF5D9';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(.7, flare * .3), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    drawShard(ctx, particle, x, y, alpha, particle.kind === 'large', progress);
  }
  ctx.restore();
}

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

export default function EmergencyPauseAtmosphere({ active, activationId = null, startedAt = null, statusKnown = false, theme = 'dark-navy', clickRipple = true, reduceDecorativeEffects = false, effectQuality = 'balanced' }) {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(Boolean(active));
  const [phase, setPhase] = useState(active ? (theme === 'galaxion' && statusKnown ? 'active' : 'entering') : 'idle');
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden);
  const galaxionActivationConfirmedRef = useRef(false);
  const galaxionResumeConfirmedRef = useRef(false);
  const lastGalaxionStateRef = useRef({ active: Boolean(active), statusKnown, theme });
  const activeRef = useRef(active);
  const themeRef = useRef(theme);
  const decorativeEffectsReducedRef = useRef(reduceDecorativeEffects);
  const obsidianCanvasRef = useRef(null);
  activeRef.current = active;
  themeRef.current = theme;
  decorativeEffectsReducedRef.current = reduceDecorativeEffects;

  useEffect(() => {
    const canvas = obsidianCanvasRef.current;
    if (!visible || theme !== 'obsidian' || reducedMotion || reduceDecorativeEffects || !canvas) return undefined;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return undefined;

    let frameId = 0;
    let lastDraw = performance.now();
    let elapsedMs = 0;
    let nextWaveAt = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let pixelRatio = 1;
    const waveInterval = width <= 640 ? 3.1 : 2.35;
    const particles = [];

    const resize = () => {
      const previousWidth = width;
      const previousHeight = height;
      width = window.innerWidth;
      height = window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, width <= 640 ? 1.2 : 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      if (previousWidth && previousHeight) {
        particles.forEach((particle) => {
          particle.x *= width / previousWidth;
          particle.startY *= height / previousHeight;
        });
      }
    };

    const draw = (now) => {
      frameId = 0;
      if (document.hidden) return;
      if (now - lastDraw < 1000 / 30) {
        frameId = window.requestAnimationFrame(draw);
        return;
      }
      elapsedMs += Math.min(now - lastDraw, 100);
      lastDraw = now;
      const elapsed = elapsedMs / 1000;
      if (activeRef.current) {
        while (elapsed >= nextWaveAt) {
          particles.push(...createEmberfallWave(width, height, nextWaveAt, effectQuality));
          particles.sort((a, b) => EMBERFALL_DEPTH[b.kind] - EMBERFALL_DEPTH[a.kind]);
          nextWaveAt += waveInterval;
        }
      }

      context.clearRect(0, 0, width, height);
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        const progress = (elapsed - particle.delay) / particle.duration;
        if (progress < 0) continue;
        if (progress >= 1) {
          particles.splice(index, 1);
          continue;
        }
        paintEmberfallParticle(context, particle, progress, height);
      }
      frameId = window.requestAnimationFrame(draw);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
        return;
      }
      lastDraw = performance.now();
      if (!frameId) frameId = window.requestAnimationFrame(draw);
    };

    const resizeObserver = () => resize();
    resize();
    window.addEventListener('resize', resizeObserver, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (!document.hidden) frameId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resizeObserver);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      context.clearRect(0, 0, width, height);
    };
  }, [visible, theme, reducedMotion, reduceDecorativeEffects, effectQuality]);

  useEffect(() => {
    const onActivationConfirmed = () => {
      if (themeRef.current === 'galaxion') galaxionActivationConfirmedRef.current = true;
    };
    const onResumeConfirmed = () => {
      if (themeRef.current === 'galaxion') galaxionResumeConfirmedRef.current = true;
    };
    window.addEventListener('system:emergency-pause-activation-confirmed', onActivationConfirmed);
    window.addEventListener('system:emergency-pause-resume-confirmed', onResumeConfirmed);
    return () => {
      window.removeEventListener('system:emergency-pause-activation-confirmed', onActivationConfirmed);
      window.removeEventListener('system:emergency-pause-resume-confirmed', onResumeConfirmed);
    };
  }, []);

  useEffect(() => {
    let animationFrameId;
    let timeoutId;

    if (theme === 'galaxion') return undefined;
    if (active) {
      setVisible(true);
      setPhase('entering');
      animationFrameId = window.requestAnimationFrame(() => setPhase('active'));
    } else if (visible) {
      setPhase('ending');
      timeoutId = window.setTimeout(() => {
        setVisible(false);
        setPhase('idle');
      }, reducedMotion || decorativeEffectsReducedRef.current
        ? 240
        : themeRef.current === 'aurora' ? 5600 : themeRef.current === 'eclipse' ? 2500 : 1500);
    }

    return () => {
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [active, reducedMotion]);

  useEffect(() => {
    const previous = lastGalaxionStateRef.current;
    lastGalaxionStateRef.current = { active: Boolean(active), statusKnown, theme };
    if (theme !== 'galaxion') {
      galaxionActivationConfirmedRef.current = false;
      galaxionResumeConfirmedRef.current = false;
      return undefined;
    }
    if (!statusKnown) return undefined;

    // An explicit event is emitted only after the backend confirms the user's
    // activation. This distinguishes a fresh action from a restored active
    // pause when the first status read completes.
    if (active && galaxionActivationConfirmedRef.current) {
      galaxionActivationConfirmedRef.current = false;
      setVisible(true);
      setPhase('entering');
      const timeoutId = window.setTimeout(
        () => setPhase('active'),
        reducedMotion || decorativeEffectsReducedRef.current ? 240 : 5200,
      );
      return () => window.clearTimeout(timeoutId);
    }

    // The first authoritative status and a theme switch are settled restores,
    // not fresh activation events. Only a later server state change animates.
    if (!previous.statusKnown || previous.theme !== 'galaxion') {
      setVisible(Boolean(active));
      setPhase(active ? 'active' : 'idle');
      return undefined;
    }
    if (previous.active === Boolean(active)) return undefined;

    let timeoutId;
    if (active) {
      setVisible(true);
      setPhase('entering');
      timeoutId = window.setTimeout(
        () => setPhase('active'),
        reducedMotion || decorativeEffectsReducedRef.current ? 240 : 5200,
      );
    } else {
      setVisible(true);
      setPhase('ending');
      const resumeDuration = galaxionResumeConfirmedRef.current ? 6000 : reducedMotion || decorativeEffectsReducedRef.current ? 240 : 1500;
      galaxionResumeConfirmedRef.current = false;
      timeoutId = window.setTimeout(() => {
        setVisible(false);
        setPhase('idle');
      }, resumeDuration);
    }
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [active, statusKnown, theme, reducedMotion]);

  useLayoutEffect(() => {
    if (!visible) return undefined;
    document.body.classList.add('emergency-pause-atmosphere-running');
    return () => document.body.classList.remove('emergency-pause-atmosphere-running');
  }, [visible]);

  useLayoutEffect(() => {
    document.body.classList.toggle('obsidian-emergency-active', visible && theme === 'obsidian');
    return () => document.body.classList.remove('obsidian-emergency-active');
  }, [visible, theme]);

  useLayoutEffect(() => {
    document.body.classList.toggle('obsidian-emergency-effects-reduced', visible && theme === 'obsidian' && (reducedMotion || reduceDecorativeEffects));
    return () => document.body.classList.remove('obsidian-emergency-effects-reduced');
  }, [visible, theme, reducedMotion, reduceDecorativeEffects]);

  useLayoutEffect(() => {
    document.body.classList.toggle('aurora-emergency-active', visible && theme === 'aurora');
    return () => document.body.classList.remove('aurora-emergency-active');
  }, [visible, theme]);

  useLayoutEffect(() => {
    document.body.classList.toggle('eclipse-emergency-active', visible && theme === 'eclipse');
    return () => document.body.classList.remove('eclipse-emergency-active');
  }, [visible, theme]);

  useLayoutEffect(() => {
    document.body.classList.toggle('galaxion-emergency-active', visible && theme === 'galaxion');
    return () => document.body.classList.remove('galaxion-emergency-active');
  }, [visible, theme]);

  useLayoutEffect(() => {
    document.body.classList.toggle('galaxion-theme-active', theme === 'galaxion');
    return () => document.body.classList.remove('galaxion-theme-active');
  }, [theme]);

  useEffect(() => {
    const updateVisibility = () => setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  if (theme === 'aurora') {
    return <AuroraEmergencyAtmosphere visible={visible} phase={phase} documentVisible={documentVisible} reducedMotion={reducedMotion} reduceDecorativeEffects={reduceDecorativeEffects} effectQuality={effectQuality} />;
  }
  if (theme === 'eclipse') {
    return <EclipseEmergencyAtmosphere
      visible={visible}
      phase={phase}
      activationId={activationId}
      startedAt={startedAt}
      documentVisible={documentVisible}
      reducedMotion={reducedMotion}
      reduceDecorativeEffects={reduceDecorativeEffects}
      effectQuality={effectQuality}
    />;
  }
  if (theme === 'galaxion') {
    return <GalaxionAtmosphere
      visible={visible}
      phase={phase}
      active={active}
      documentVisible={documentVisible}
      reducedMotion={reducedMotion}
      reduceDecorativeEffects={reduceDecorativeEffects}
      effectQuality={effectQuality}
    />;
  }
  if (!visible && theme !== 'obsidian') return null;

  return createPortal(
    <>
      {visible && <div
        className={`emergency-pause-atmosphere emergency-pause-atmosphere--${phase}${reducedMotion ? ' is-reduced-motion' : ''}${reduceDecorativeEffects ? ' is-effects-reduced' : ''}`}
        data-document-visible={documentVisible ? 'true' : 'false'}
        data-system-theme={theme === 'obsidian' ? 'obsidian' : 'dark-navy'}
        aria-hidden="true"
      >
        <div className="emergency-pause-atmosphere__aura" />
        {theme === 'obsidian' && <canvas className="emergency-pause-atmosphere__active-canvas" ref={obsidianCanvasRef} />}
        {theme !== 'obsidian' && <>
        <div className="emergency-pause-atmosphere__leaves">
          {LEAVES.slice(0, effectQuality === 'low' ? 6 : effectQuality === 'high' ? LEAVES.length : 11).map((leaf, index) => <Leaf leaf={leaf} index={index} key={`leaf-${index}`} />)}
        </div>
        <div className="emergency-pause-atmosphere__particles">
          {PARTICLES.slice(0, effectQuality === 'low' ? 8 : effectQuality === 'high' ? PARTICLES.length : 15).map((particle, index) => (
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
        </>}
      </div>}
    </>,
    document.body,
  );
}
