import { useEffect, useRef } from 'react';

const FRAME_INTERVAL_MS = 1000 / 30;
const PARTICLE_TARGETS = Object.freeze({
  silver: 40,
  dust: 12,
  beams: 4,
});

const SILVER = ['#E7DFFF', '#C8C9E0', '#F4F2FF'];
const VIOLET = ['#A78BFA', '#C8B6FF', '#7657FF'];
const DUST = ['#E7DFFF', '#C8C9E0', '#BDA9FF'];

function getDensityScale(width, effectQuality = 'balanced') {
  if (effectQuality === 'low') return 0.34;
  if (effectQuality === 'balanced') return 0.62;
  if (effectQuality === 'high') return 1;
  const cpuCount = Number(navigator.hardwareConcurrency) || 8;
  const memory = Number(navigator.deviceMemory) || 8;
  if (width <= 640) return 0.28;
  if (width <= 1024) return 0.56;
  if (cpuCount <= 4 || memory <= 4) return 0.5;
  if (cpuCount <= 8 || memory <= 8) return 0.75;
  return 1;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function makeParticle(kind, width, height, initial = false) {
  const isBeam = kind === 'beam';
  const size = kind === 'beam'
    ? randomBetween(90, 300)
    : kind === 'dust'
      ? randomBetween(0.65, 1.35)
      : randomBetween(0.75, 1.8);
  const speed = isBeam
    ? randomBetween(36, 76)
    : kind === 'dust'
      ? randomBetween(14, 32)
      : randomBetween(18, 42);
  const startY = isBeam ? -size : -randomBetween(0, initial ? height * 0.72 : Math.max(50, height * 0.18));
  return {
    kind,
    x: randomBetween(0, width),
    y: startY,
    size,
    speed,
    drift: randomBetween(-10, 10),
    sway: randomBetween(2, 12),
    swayRate: randomBetween(0.12, 0.42),
    rotation: randomBetween(0, Math.PI * 2),
    rotationSpeed: randomBetween(-0.36, 0.36),
    opacity: isBeam ? randomBetween(0.12, 0.2) : kind === 'dust'
      ? randomBetween(0.1, 0.2)
      : randomBetween(0.16, 0.3),
    color: kind === 'beam'
        ? pick(Math.random() < 0.68 ? VIOLET : SILVER)
        : kind === 'dust'
          ? pick(DUST)
          : pick(SILVER),
    depth: isBeam || Math.random() < 0.56 ? 'back' : 'front',
    beamLength: isBeam ? randomBetween(120, 360) : 0,
    sparkle: kind === 'silver' && Math.random() < 0.045,
    beamWidth: isBeam ? randomBetween(0.55, 1.35) : 0,
  };
}

function buildPool(width, height, effectQuality) {
  const scale = getDensityScale(width, effectQuality);
  const groups = [
    ['silver', PARTICLE_TARGETS.silver],
    ['dust', PARTICLE_TARGETS.dust],
    ['beam', PARTICLE_TARGETS.beams],
  ];
  return groups.flatMap(([kind, count]) => Array.from(
    { length: Math.max(kind === 'beam' ? 3 : 1, Math.round(count * scale)) },
    () => makeParticle(kind, width, height, true),
  ));
}

function drawParticle(context, particle, elapsed) {
  context.globalAlpha = particle.opacity;
  if (particle.kind === 'beam') {
    context.beginPath();
    context.moveTo(particle.x, particle.y - particle.beamLength);
    context.lineTo(particle.x + particle.drift * 0.18, particle.y);
    context.strokeStyle = particle.color;
    context.lineWidth = particle.beamWidth * 4;
    context.globalAlpha = particle.opacity * 0.16;
    context.stroke();
    context.globalAlpha = particle.opacity;
    context.lineWidth = particle.beamWidth * 0.72;
    context.stroke();
    return;
  }
  const shimmer = particle.kind === 'dust' ? 0.76 : 0.86 + Math.sin(elapsed * 0.0018 + particle.x) * 0.14;
  context.globalAlpha = particle.opacity * shimmer;
  context.fillStyle = particle.color;
  context.beginPath();
  context.arc(particle.x, particle.y, particle.size * (particle.sparkle ? 1.4 : 1), 0, Math.PI * 2);
  context.fill();
  if (particle.sparkle) {
    context.globalAlpha = particle.opacity * 0.48;
    context.strokeStyle = '#F4F2FF';
    context.lineWidth = 0.65;
    context.beginPath();
    context.moveTo(particle.x - 3, particle.y);
    context.lineTo(particle.x + 3, particle.y);
    context.moveTo(particle.x, particle.y - 3);
    context.lineTo(particle.x, particle.y + 3);
    context.stroke();
  }
}

export default function EclipseParticleCanvas({ emitting, documentVisible, children, effectQuality = 'balanced' }) {
  const backCanvasRef = useRef(null);
  const frontCanvasRef = useRef(null);
  const emittingRef = useRef(emitting);
  const visibleRef = useRef(documentVisible);

  emittingRef.current = emitting;
  visibleRef.current = documentVisible;

  useEffect(() => {
    const backCanvas = backCanvasRef.current;
    const frontCanvas = frontCanvasRef.current;
    const backContext = backCanvas?.getContext('2d', { alpha: true, desynchronized: true });
    const frontContext = frontCanvas?.getContext('2d', { alpha: true, desynchronized: true });
    if (!backCanvas || !frontCanvas || !backContext || !frontContext) return undefined;

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let particles = [];
    let animationFrame = 0;
    let lastFrame = 0;
    let elapsed = 0;

    const resize = () => {
      const previousWidth = width;
      const previousHeight = height;
      width = window.innerWidth;
      height = window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, width <= 640 ? 1 : 1.25);
      for (const canvas of [backCanvas, frontCanvas]) {
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      backContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      frontContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      if (previousWidth && previousHeight && particles.length) {
        const sx = width / previousWidth;
        const sy = height / previousHeight;
        particles.forEach((particle) => { particle.x *= sx; particle.y *= sy; });
      } else {
        particles = buildPool(width, height, effectQuality);
      }
    };

    const tick = (timestamp) => {
      animationFrame = 0;
      if (!visibleRef.current || document.hidden) return;
      if (timestamp - lastFrame < FRAME_INTERVAL_MS) {
        animationFrame = window.requestAnimationFrame(tick);
        return;
      }
      const delta = Math.min((timestamp - lastFrame) / 1000 || 0, 0.08);
      lastFrame = timestamp;
      elapsed += delta * 1000;
      backContext.clearRect(0, 0, width, height);
      frontContext.clearRect(0, 0, width, height);

      for (const particle of particles) {
        particle.y += particle.speed * delta;
        particle.x += (particle.drift + Math.sin(elapsed * 0.001 * particle.swayRate + particle.rotation) * particle.sway) * delta;
        particle.rotation += particle.rotationSpeed * delta;
        if (particle.x < -particle.size * 2) particle.x = width + particle.size;
        if (particle.x > width + particle.size * 2) particle.x = -particle.size;
        const tail = particle.kind === 'beam' ? particle.beamLength : particle.size * 2;
        if (particle.y - tail > height + 4) {
          if (emittingRef.current) {
            const next = makeParticle(particle.kind, width, height, false);
            Object.assign(particle, next, { y: -randomBetween(12, Math.max(40, height * 0.14)) });
          } else {
            particle.opacity = 0;
          }
          continue;
        }
        if (particle.opacity <= 0) continue;
        drawParticle(particle.depth === 'back' ? backContext : frontContext, particle, elapsed);
      }
      backContext.globalAlpha = 1;
      frontContext.globalAlpha = 1;
      animationFrame = window.requestAnimationFrame(tick);
    };

    const onVisibilityChange = () => {
      if (document.hidden || !visibleRef.current) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        return;
      }
      lastFrame = performance.now();
      if (!animationFrame) animationFrame = window.requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (visibleRef.current && !document.hidden) animationFrame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      backContext.clearRect(0, 0, width, height);
      frontContext.clearRect(0, 0, width, height);
      particles = [];
    };
  }, [effectQuality]);

  return (
    <>
      <canvas ref={backCanvasRef} className="eclipse-totality__particle-canvas eclipse-totality__particle-canvas--back" aria-hidden="true" />
      {children}
      <canvas ref={frontCanvasRef} className="eclipse-totality__particle-canvas eclipse-totality__particle-canvas--front" aria-hidden="true" />
    </>
  );
}
