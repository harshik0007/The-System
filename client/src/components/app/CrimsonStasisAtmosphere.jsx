import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import '../../styles/crimson-stasis.css';

const CRIMSON_STASIS_CONFIG = Object.freeze({
  ENTER_MS: 4000,
  EXIT_MS: 4000,
  REDUCED_MS: 600,
  EASE: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  EXIT_EASE: 'ease-in-out',
  BREATH_MS: 8000,
  MIST_DRIFT_MS: 52000,
  PARTICLES_DESKTOP: 18,
  PARTICLES_MOBILE: 10,
  MAX_ALPHA: 0.35,
  EXIT_PARTICLE_MS: 2600,
  DARK_BLEND: 'screen',
  COLORS: Object.freeze({
    crimson: '#C8243A', crimsonRgb: '200 36 58',
    rose: '#E8607A', roseRgb: '232 96 122',
    blush: '#F4A6B7', blushRgb: '244 166 183',
    lavender: '#CFC9F2', lavenderRgb: '207 201 242',
    dawn: '#F7F4F8', dawnRgb: '247 244 248',
  }),
});

export default function CrimsonStasisAtmosphere({
  active,
  devPreview,
  theme = 'dark-navy',
  reduceDecorativeEffects = false,
  effectQuality = 'balanced',
}) {
  const osOrAppReducedMotion = useReducedMotion();
  const reducedMotion = osOrAppReducedMotion || reduceDecorativeEffects;
  const shouldShow = devPreview ?? active;
  const [phase, setPhase] = useState('idle');
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden);
  const canvasRef = useRef(null);
  const phaseRef = useRef(phase);
  const activeRef = useRef(shouldShow);
  const visible = phase !== 'idle';
  phaseRef.current = phase;
  activeRef.current = shouldShow;

  useEffect(() => {
    const onVisibilityChange = () => {
      const visible = !document.hidden;
      setDocumentVisible(visible);
      if (!visible && !activeRef.current && phaseRef.current === 'leaving') {
        // Hold the atmosphere while hidden. It will begin its exit when the tab returns.
        setPhase('active');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!documentVisible) return undefined;
    let frameId = 0;
    let timeoutId = 0;
    if (shouldShow) {
      if (phaseRef.current === 'idle') {
        setPhase('entering');
        frameId = window.requestAnimationFrame(() => setPhase('active'));
      } else {
        // Returning from the exit state reverses the existing transition in place.
        setPhase('active');
      }
    } else if (phaseRef.current !== 'idle') {
      setPhase('leaving');
      timeoutId = window.setTimeout(() => setPhase('idle'), reducedMotion
        ? CRIMSON_STASIS_CONFIG.REDUCED_MS
        : CRIMSON_STASIS_CONFIG.EXIT_MS);
    }
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [shouldShow, documentVisible, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || reducedMotion || !canvas) return undefined;
    const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!context) return undefined;

    const colors = [
      CRIMSON_STASIS_CONFIG.COLORS.crimson,
      CRIMSON_STASIS_CONFIG.COLORS.rose,
      CRIMSON_STASIS_CONFIG.COLORS.blush,
    ];
    const lowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
      || (navigator.deviceMemory && navigator.deviceMemory <= 4)
      || navigator.connection?.saveData;
    const sprites = createParticleSprites(colors);
    const width = { value: 0 };
    const height = { value: 0 };
    const pixelRatio = { value: 1 };
    const particles = createParticlePool(window.innerWidth, window.innerHeight, effectQuality, lowPower);
    let frameId = 0;
    let lastFrame = 0;
    let elapsed = 0;
    let exitElapsed = 0;
    let resizeTimer = 0;

    const resize = () => {
      const previousWidth = width.value || window.innerWidth;
      const previousHeight = height.value || window.innerHeight;
      width.value = window.innerWidth;
      height.value = window.innerHeight;
      pixelRatio.value = Math.min(lowPower ? 1.25 : 2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width.value * pixelRatio.value);
      canvas.height = Math.round(height.value * pixelRatio.value);
      context.setTransform(pixelRatio.value, 0, 0, pixelRatio.value, 0, 0);
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        particle.x *= width.value / previousWidth;
        particle.y *= height.value / previousHeight;
        particle.anchorX *= width.value / previousWidth;
      }
    };

    const drawFrame = (now) => {
      frameId = 0;
      if (document.hidden) return;
      const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
      lastFrame = now;
      elapsed += delta;
      if (activeRef.current) exitElapsed = 0;
      else exitElapsed = Math.min(CRIMSON_STASIS_CONFIG.EXIT_PARTICLE_MS, exitElapsed + delta * 1000);

      context.clearRect(0, 0, width.value, height.value);
      const breath = 0.925 + 0.075 * Math.sin((elapsed / (CRIMSON_STASIS_CONFIG.BREATH_MS / 1000)) * Math.PI * 2);
      const exitOpacity = activeRef.current
        ? 1
        : Math.max(0, 1 - exitElapsed / CRIMSON_STASIS_CONFIG.EXIT_PARTICLE_MS);

      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        if (particle.dead) continue;
        particle.y -= particle.riseSpeed * delta;
        if (particle.y < -42) {
          if (!activeRef.current) {
            particle.dead = true;
            continue;
          }
          particle.y = height.value + 42;
          particle.anchorX = randomBetween(0, width.value);
          particle.delay = elapsed + randomBetween(0, 1.5);
        }

        const sway = Math.sin((elapsed / particle.swayPeriod) * Math.PI * 2 + particle.swayPhase) * particle.swayWidth;
        const x = particle.anchorX + sway;
        const edge = Math.max(0, Math.min(1, x / 42, (width.value - x) / 42, (height.value - particle.y) / 42, (particle.y + 42) / 42));
        const fadeIn = Math.max(0, Math.min(1, (elapsed - particle.delay) / 2.5));
        const twinkle = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin((elapsed / particle.twinklePeriod) * Math.PI * 2 + particle.twinklePhase));
        const alpha = particle.alpha * fadeIn * twinkle * edge * breath * exitOpacity;
        if (alpha <= 0.001) continue;

        const sprite = sprites[particle.shape][particle.colorIndex];
        const drawSize = particle.size * (particle.shape === 'orb' ? 2.4 : 2.9);
        context.globalAlpha = alpha;
        if (particle.shape === 'star') {
          particle.rotation += particle.rotationSpeed * delta;
          context.save();
          context.translate(x, particle.y);
          context.rotate(particle.rotation);
          context.drawImage(sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
          context.restore();
        } else {
          context.drawImage(sprite, x - drawSize / 2, particle.y - drawSize / 2, drawSize, drawSize);
        }
      }
      context.globalAlpha = 1;
      frameId = window.requestAnimationFrame(drawFrame);
    };

    const scheduleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 90);
    };

    const start = () => {
      if (document.hidden || frameId) return;
      lastFrame = performance.now();
      frameId = window.requestAnimationFrame(drawFrame);
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (frameId) window.cancelAnimationFrame(frameId);
        frameId = 0;
        lastFrame = 0;
      } else start();
    };

    resize();
    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(scheduleResize)
      : null;
    if (resizeObserver) resizeObserver.observe(canvas.parentElement);
    window.addEventListener('resize', scheduleResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    start();
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      context.clearRect(0, 0, width.value, height.value);
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [visible, reducedMotion, effectQuality]);

  useLayoutEffect(() => {
    document.body.classList.toggle('crimson-stasis-running', visible);
    return () => document.body.classList.remove('crimson-stasis-running');
  }, [visible]);

  if (!visible) return null;
  const configStyle = {
    '--stasis-enter-ms': `${CRIMSON_STASIS_CONFIG.ENTER_MS}ms`,
    '--stasis-exit-ms': `${CRIMSON_STASIS_CONFIG.EXIT_MS}ms`,
    '--stasis-reduced-ms': `${CRIMSON_STASIS_CONFIG.REDUCED_MS}ms`,
    '--stasis-enter-ease': CRIMSON_STASIS_CONFIG.EASE,
    '--stasis-exit-ease': CRIMSON_STASIS_CONFIG.EXIT_EASE,
    '--stasis-breath-ms': `${CRIMSON_STASIS_CONFIG.BREATH_MS}ms`,
    '--stasis-mist-drift-ms': `${CRIMSON_STASIS_CONFIG.MIST_DRIFT_MS}ms`,
    '--stasis-crimson-rgb': CRIMSON_STASIS_CONFIG.COLORS.crimsonRgb,
    '--stasis-rose-rgb': CRIMSON_STASIS_CONFIG.COLORS.roseRgb,
    '--stasis-blush-rgb': CRIMSON_STASIS_CONFIG.COLORS.blushRgb,
    '--stasis-lavender-rgb': CRIMSON_STASIS_CONFIG.COLORS.lavenderRgb,
    '--stasis-dawn-rgb': CRIMSON_STASIS_CONFIG.COLORS.dawnRgb,
    '--stasis-dark-blend': CRIMSON_STASIS_CONFIG.DARK_BLEND,
  };

  return createPortal(
    <div
      className={`crimson-stasis${reducedMotion ? ' is-static' : ''}`}
      data-phase={phase}
      data-document-visible={documentVisible ? 'true' : 'false'}
      data-system-theme={theme}
      style={configStyle}
      aria-hidden="true"
    >
      <div className="crimson-stasis__mist" />
      <div className="crimson-stasis__edge" />
      {!reducedMotion && <canvas className="crimson-stasis__canvas" ref={canvasRef} />}
    </div>,
    document.body,
  );
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createParticleSprites(colors) {
  const result = { star: [], orb: [] };
  for (const shape of ['star', 'orb']) {
    for (const color of colors) {
      const sprite = document.createElement('canvas');
      sprite.width = 64;
      sprite.height = 64;
      const context = sprite.getContext('2d');
      if (!context) {
        result[shape].push(sprite);
        continue;
      }
      const glow = context.createRadialGradient(32, 32, 1, 32, 32, 31);
      glow.addColorStop(0, `${color}55`);
      glow.addColorStop(0.35, `${color}24`);
      glow.addColorStop(1, `${color}00`);
      context.fillStyle = glow;
      context.fillRect(0, 0, 64, 64);
      context.shadowColor = color;
      context.shadowBlur = 8;
      context.fillStyle = color;
      if (shape === 'orb') {
        context.beginPath();
        context.arc(32, 32, 4.2, 0, Math.PI * 2);
        context.fill();
      } else {
        context.beginPath();
        context.moveTo(32, 20);
        context.lineTo(35, 29);
        context.lineTo(44, 32);
        context.lineTo(35, 35);
        context.lineTo(32, 44);
        context.lineTo(29, 35);
        context.lineTo(20, 32);
        context.lineTo(29, 29);
        context.closePath();
        context.fill();
      }
      result[shape].push(sprite);
    }
  }
  return result;
}

function createParticlePool(width, height, effectQuality, lowPower) {
  const mobile = width <= 640;
  let count = mobile ? CRIMSON_STASIS_CONFIG.PARTICLES_MOBILE : CRIMSON_STASIS_CONFIG.PARTICLES_DESKTOP;
  if (lowPower || effectQuality === 'low') count = Math.max(mobile ? 6 : 10, Math.round(count * 0.65));
  const particles = [];
  for (let index = 0; index < count; index += 1) {
    const depth = index / count;
    const shape = Math.random() < 0.34 ? 'star' : 'orb';
    particles.push({
      anchorX: randomBetween(0, width),
      x: 0,
      y: randomBetween(0, height),
      size: 3.2 + depth * 4.4,
      riseSpeed: 1.2 + depth * 5.6,
      swayWidth: 2 + depth * 5,
      swayPeriod: randomBetween(10, 20),
      swayPhase: randomBetween(0, Math.PI * 2),
      rotation: randomBetween(0, Math.PI * 2),
      rotationSpeed: randomBetween(-0.045, 0.045),
      twinklePeriod: randomBetween(5, 9),
      twinklePhase: randomBetween(0, Math.PI * 2),
      alpha: Math.min(CRIMSON_STASIS_CONFIG.MAX_ALPHA, 0.12 + depth * 0.23),
      colorIndex: index % 3,
      shape,
      delay: randomBetween(0, 3),
      dead: false,
    });
  }
  return particles;
}
