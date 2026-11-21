import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const MAX_PARTICLES = { high: 20, balanced: 14, low: 8, reduced: 5 };
const ASTEROID_COUNT = 4;
const STAR_COLORS = ['#527DCD', '#5540A0', '#B45CA9', '#E9E9F1', '#D3A477'];
const ASTEROID_COLORS = ['#BCC0CE', '#9FA2AE', '#B28B7F'];

function getQuality(width, reducedMotion, reduceDecorativeEffects, effectQuality = 'balanced') {
  if (reducedMotion || reduceDecorativeEffects) return 'reduced';
  if (effectQuality === 'low') return 'low';
  if (effectQuality === 'high') return 'high';
  if (effectQuality === 'balanced') return 'balanced';
  if (width <= 700 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)) return 'low';
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency >= 8) return 'high';
  return 'balanced';
}

function chooseParticle(width, quality, forcedType = null) {
  const chance = Math.random();
  const type = forcedType || (chance < 0.14 ? 'dust'
    : chance < 0.55 ? 'star'
      : chance < 0.78 ? 'comet' : 'meteor');
  const color = type === 'asteroid'
    ? ASTEROID_COLORS[Math.floor(Math.random() * ASTEROID_COLORS.length)]
    : STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
  const speed = type === 'dust' ? 12 + Math.random() * 18
    : type === 'asteroid' ? 8 + Math.random() * 8
      : type === 'star' ? 26 + Math.random() * 32
        : type === 'comet' ? 58 + Math.random() * 34
          : 92 + Math.random() * 58;
  const angle = (Math.random() - 0.5) * (type === 'meteor' ? 0.58 : 0.42);
  // Stone fragments use their own foreground canvas so opaque page cards do
  // not hide them. Keep every other particle in the atmospheric background.
  const isForeground = type === 'asteroid';
  return {
    type,
    color,
    x: Math.random() * width,
    y: -10 - Math.random() * 100,
    vx: Math.sin(angle) * speed,
    vy: Math.cos(angle) * speed,
    size: type === 'dust' ? .45 + Math.random() * .65
      : type === 'asteroid' ? 6 + Math.random() * 3.2
        : type === 'star' ? 1.05 + Math.random() * 1.45
          : type === 'comet' ? 1.35 + Math.random() * 1.1
            : 1.8 + Math.random() * 1.3,
    tail: type === 'meteor' ? 96 + Math.random() * 92 : type === 'comet' ? 42 + Math.random() * 46 : 0,
    thickness: type === 'meteor' ? 1.1 + Math.random() * .65 : .55 + Math.random() * .45,
    alpha: type === 'dust' ? .12 + Math.random() * .14
      : type === 'asteroid' ? .76 + Math.random() * .18
        : type === 'star' ? .3 + Math.random() * .3
          : type === 'comet' ? .28 + Math.random() * .22
            : .34 + Math.random() * .25,
    rotation: Math.random() * Math.PI,
    spin: type === 'asteroid' ? (Math.random() - .5) * .34 : (Math.random() - .5) * .8,
    life: 0,
    isForeground,
  };
}

function rgba(hex, alpha) {
  const value = hex.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function placeAsteroidAtSide(particle, width, height, index = Math.floor(Math.random() * ASTEROID_COUNT), initial = true) {
  const effectRoot = document.querySelector('.galaxion-emergency');
  const holeSize = Number.parseFloat(effectRoot
    ? window.getComputedStyle(effectRoot).getPropertyValue('--galaxion-hole-size')
    : '0');
  const safeHoleSize = Number.isFinite(holeSize) ? holeSize : 0;
  const leftOuter = Math.max(16, Math.min(width * .18, (width - safeHoleSize) / 2 - 18));
  const leftInner = Math.max(leftOuter + 10, (width - safeHoleSize) / 2 - 18);
  const lanes = [leftOuter, leftInner, width - leftInner, width - leftOuter];
  const lane = Math.min(ASTEROID_COUNT - 1, Math.max(0, index));
  particle.x = lanes[lane];
  particle.y = initial ? height * [.16, .39, .63, .84][lane] : -18 - Math.random() * 70;
  // Drift gently out toward the nearest edge, away from the central hole.
  particle.vx = (lane < 2 ? -1 : 1) * (2 + Math.random() * 4);
  particle.vy = 8 + Math.random() * 8;
  particle.isForeground = true;
}

function makeStarPath() {
  if (typeof Path2D !== 'function') return null;
  const path = new Path2D();
  path.moveTo(0, -1);
  path.lineTo(.17, -.22);
  path.lineTo(1, 0);
  path.lineTo(.17, .22);
  path.lineTo(0, 1);
  path.lineTo(-.17, .22);
  path.lineTo(-1, 0);
  path.lineTo(-.17, -.22);
  path.closePath();
  return path;
}

function drawParticle(context, particle, starPath) {
  const { type, color, x, y, vx, vy, size, tail, thickness, alpha, rotation } = particle;
  context.save();
  context.globalAlpha = alpha;
  if (type === 'dust') {
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 0;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }
  if (type === 'asteroid') {
    context.translate(x, y);
    context.rotate(rotation);
    context.scale(size, size * .78);
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 0;
    context.beginPath();
    context.moveTo(-.72, -.5);
    context.lineTo(-.28, -.96);
    context.lineTo(.31, -.76);
    context.lineTo(.9, -.22);
    context.lineTo(.67, .47);
    context.lineTo(.17, .88);
    context.lineTo(-.53, .72);
    context.lineTo(-.96, .12);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = 'rgba(5, 5, 7, .48)';
    context.beginPath();
    context.ellipse(.3, -.18, .16, .11, -.35, 0, Math.PI * 2);
    context.ellipse(-.42, .24, .1, .075, .25, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(233, 233, 241, .38)';
    context.lineWidth = .08;
    context.beginPath();
    context.moveTo(-.72, -.5);
    context.lineTo(-.28, -.96);
    context.lineTo(.31, -.76);
    context.stroke();
    context.restore();
    return;
  }
  if (type === 'star') {
    context.translate(x, y);
    context.rotate(rotation);
    context.scale(size, size);
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 0;
    if (starPath) context.fill(starPath);
    else {
      context.beginPath();
      context.moveTo(0, -1);
      context.lineTo(.17, -.22);
      context.lineTo(1, 0);
      context.lineTo(.17, .22);
      context.lineTo(0, 1);
      context.lineTo(-.17, .22);
      context.lineTo(-1, 0);
      context.lineTo(-.17, -.22);
      context.closePath();
      context.fill();
    }
    context.restore();
    return;
  }

  const speed = Math.hypot(vx, vy) || 1;
  const tailX = x - (vx / speed) * tail;
  const tailY = y - (vy / speed) * tail;
  const trail = context.createLinearGradient(tailX, tailY, x, y);
  trail.addColorStop(0, rgba(color, 0));
  trail.addColorStop(.68, rgba(color, alpha * (type === 'meteor' ? .55 : .38)));
  trail.addColorStop(1, rgba('#E9E9F1', alpha * .82));
  if (type === 'meteor') {
    context.strokeStyle = trail;
    context.lineWidth = thickness * 3.2;
    context.lineCap = 'round';
    context.shadowColor = color;
    context.shadowBlur = 0;
    context.beginPath();
    context.moveTo(tailX, tailY);
    context.lineTo(x, y);
    context.stroke();
  }
  context.strokeStyle = trail;
  context.lineWidth = thickness;
  context.lineCap = 'round';
  context.shadowColor = color;
  context.shadowBlur = 0;
  context.beginPath();
  context.moveTo(tailX, tailY);
  context.lineTo(x, y);
  context.stroke();
  context.fillStyle = rgba('#E9E9F1', alpha * .68);
  context.beginPath();
  context.arc(x, y, size, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export default function GalaxionAtmosphere({ visible, phase = 'idle', active = false, documentVisible = true, reducedMotion = false, reduceDecorativeEffects = false, effectQuality = 'balanced' }) {
  const backgroundCanvasRef = useRef(null);
  const foregroundCanvasRef = useRef(null);
  const activeRef = useRef(active);
  const phaseRef = useRef(phase);
  activeRef.current = active;
  phaseRef.current = phase;

  useEffect(() => {
    const backgroundCanvas = backgroundCanvasRef.current;
    const foregroundCanvas = foregroundCanvasRef.current;
    if (!visible || !backgroundCanvas || !foregroundCanvas || reducedMotion || reduceDecorativeEffects) return undefined;
    const backgroundContext = backgroundCanvas.getContext('2d', { alpha: true });
    const foregroundContext = foregroundCanvas.getContext('2d', { alpha: true });
    if (!backgroundContext || !foregroundContext) return undefined;

    let frameId = 0;
    let previousTime = 0;
    let collapseStartedAt = null;
    let collapseRadius = 0;
    let spawnClock = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let quality = getQuality(width, reducedMotion, reduceDecorativeEffects, effectQuality);
    let pixelRatio = 1;
    let seededFragments = false;
    const particles = [];
    const particlePool = [];
    const starPath = makeStarPath();
    const maxParticles = () => MAX_PARTICLES[quality];
    const contexts = [backgroundContext, foregroundContext];
    const canvases = [backgroundCanvas, foregroundCanvas];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      quality = getQuality(width, reducedMotion, reduceDecorativeEffects, effectQuality);
      pixelRatio = Math.min(window.devicePixelRatio || 1, width <= 700 ? 1 : 1.3);
      canvases.forEach((canvas, index) => {
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        contexts[index].setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      });
      if (!seededFragments && activeRef.current) {
        Array.from({ length: ASTEROID_COUNT }, (_, index) => {
          const fragment = chooseParticle(width, quality, 'asteroid');
          placeAsteroidAtSide(fragment, width, height, index);
          particles.push(fragment);
        });
        seededFragments = true;
      }
      while (particles.length > maxParticles()) particlePool.push(particles.pop());
    };

    const draw = (time) => {
      frameId = 0;
      if (document.hidden) return;
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
      previousTime = time;
      const isCollapsing = phaseRef.current === 'ending';
      if (isCollapsing && collapseStartedAt === null) {
        collapseStartedAt = time;
        const effectRoot = document.querySelector('.galaxion-emergency');
        const holeSize = Number.parseFloat(window.getComputedStyle(effectRoot || backgroundCanvas.parentElement).getPropertyValue('--galaxion-hole-size'));
        collapseRadius = (Number.isFinite(holeSize) ? holeSize : Math.min(width, height) * .68) / 2;
      } else if (!isCollapsing) {
        collapseStartedAt = null;
      }
      const collapseProgress = isCollapsing
        ? Math.min(1, Math.max(0, (time - collapseStartedAt) / 6000))
        : 0;
      contexts.forEach((context) => context.clearRect(0, 0, width, height));

      if (activeRef.current) {
        spawnClock += delta;
        const interval = quality === 'high' ? .95 : quality === 'low' ? 1.45 : 1.15;
        // Do not accumulate a backlog while at the cap; it would spawn a burst
        // when a particle leaves the viewport.
        if (particles.length >= maxParticles()) spawnClock = Math.min(spawnClock, interval);
        while (spawnClock >= interval && particles.length < maxParticles()) {
          const next = chooseParticle(width, quality);
          const particle = particlePool.pop() || {};
          Object.assign(particle, next);
          particles.push(particle);
          spawnClock -= interval;
        }
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.life += delta;
        if (particle.type === 'asteroid') particle.rotation += particle.spin * delta;
        if (isCollapsing) {
          const dx = width / 2 - particle.x;
          const dy = height / 2 - particle.y;
          const distance = Math.hypot(dx, dy);
          if (distance < collapseRadius * .34) {
            particlePool.push(particle);
            particles[index] = particles[particles.length - 1];
            particles.pop();
            continue;
          }
          const targetSpeed = 105 + collapseProgress * 610;
          const steering = Math.min(1, delta * (1.4 + collapseProgress * 3));
          particle.vx += ((dx / distance) * targetSpeed - particle.vx) * steering;
          particle.vy += ((dy / distance) * targetSpeed - particle.vy) * steering;
        }
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        // Keep the existing fragments on screen while they spiral inward.
        if (!isCollapsing && particle.type === 'asteroid' && particle.y - particle.size > height + 12) {
          placeAsteroidAtSide(particle, width, height, Math.floor(Math.random() * ASTEROID_COUNT), false);
          continue;
        }
        if (!isCollapsing && particle.type !== 'asteroid' && particle.y - particle.tail > height + 12) {
          particlePool.push(particle);
          particles[index] = particles[particles.length - 1];
          particles.pop();
          continue;
        }
        const fadeIn = Math.min(1, Math.max(0, (particle.y + particle.size + 12) / 100));
        const fadeOut = Math.min(1, Math.max(0, (height + 90 - particle.y) / 110));
        const distanceToHole = isCollapsing ? Math.hypot(width / 2 - particle.x, height / 2 - particle.y) : Infinity;
        const swallowedFade = isCollapsing && distanceToHole < collapseRadius
          ? Math.max(0, distanceToHole / collapseRadius)
          : 1;
        const originalAlpha = particle.alpha;
        particle.alpha = originalAlpha * (isCollapsing ? 1 : fadeIn * fadeOut) * swallowedFade;
        drawParticle(particle.isForeground ? foregroundContext : backgroundContext, particle, starPath);
        particle.alpha = originalAlpha;
      }
      frameId = window.requestAnimationFrame(draw);
    };

    const syncVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
        previousTime = 0;
      } else if (!frameId) {
        previousTime = 0;
        frameId = window.requestAnimationFrame(draw);
      }
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', syncVisibility);
    if (!document.hidden) frameId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', syncVisibility);
      particles.length = 0;
      particlePool.length = 0;
      contexts.forEach((context) => context.clearRect(0, 0, width, height));
    };
  }, [visible, reducedMotion, reduceDecorativeEffects, effectQuality]);

  return createPortal(
    <>
      <div className="galaxion-ambient" aria-hidden="true" />
      {visible && <div
        className={`galaxion-emergency is-${phase}${reducedMotion ? ' is-reduced-motion' : ''}${reduceDecorativeEffects ? ' is-effects-reduced' : ''}${documentVisible ? '' : ' is-paused'}`}
        aria-hidden="true"
        data-emergency-active={active ? 'true' : 'false'}
      >
        <div className="galaxion-emergency__nebula" aria-hidden="true" />
        <canvas ref={backgroundCanvasRef} className="galaxion-emergency__particles galaxion-emergency__particles--background" />
        <div className="galaxion-emergency__galaxy" aria-hidden="true">
          <span className="galaxion-emergency__accretion-disc galaxion-emergency__accretion-disc--back" />
          <span className="galaxion-emergency__black-hole" />
          <span className="galaxion-emergency__accretion-disc galaxion-emergency__accretion-disc--front" />
        </div>
      </div>}
      {visible && <div
        className={`galaxion-emergency__foreground-layer${phase === 'ending' ? ' is-ending' : ''}${reducedMotion ? ' is-reduced-motion' : ''}${reduceDecorativeEffects ? ' is-effects-reduced' : ''}`}
        aria-hidden="true"
      >
        <canvas ref={foregroundCanvasRef} className="galaxion-emergency__particles galaxion-emergency__particles--foreground" />
      </div>}
    </>,
    document.body,
  );
}
