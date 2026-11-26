import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import '../../styles/crimson-stasis.css';

const CRIMSON_STASIS_CONFIG = Object.freeze({
  ENTER_MS: 4000,
  EXIT_MS: 5000,
  REDUCED_MS: 800,
  EASE_IN: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  EASE_OUT: 'cubic-bezier(0.45, 0, 0.55, 1)',
  BREATH_MS: 8000,
  DENSITY: 1.0,
  BRIGHTNESS: 1.15,
  PARTICLES_BASE_DESKTOP: 90,
  PARTICLES_BASE_MOBILE: 45,
  FILL_SECONDS: 25,
  EXIT_PARTICLE_FADE_MS: 2500,
  MAX_ALPHA: 0.62,
  BASE_AREA_DESKTOP: 1920 * 900,
  BASE_AREA_MOBILE: 390 * 844,
  MOBILE_BREAKPOINT: 640,
  PERF_FRAME_MS: 20,
  PERF_WINDOW_MS: 3000,
  PERF_FADE_MS: 900,
  PERF_FLOOR: 30,
  GOLDEN_RATIO: 0.61803398875,
  LAYER_SPLIT: Object.freeze([0.45, 0.35, 0.2]),
  LAYERS: Object.freeze([
    Object.freeze({ name: 'far', size: [1.4, 3.2], cross: [90, 140], sway: [10, 18], alpha: [0.1, 0.15] }),
    Object.freeze({ name: 'mid', size: [3.2, 6.2], cross: [60, 90], sway: [18, 30], alpha: [0.18, 0.28] }),
    Object.freeze({ name: 'near', size: [6, 10], cross: [40, 60], sway: [30, 40], alpha: [0.38, 0.62] }),
  ]),
  SHAPES: Object.freeze([
    Object.freeze({ name: 'star', weight: 0.3, scale: [3.5, 3.5] }),
    Object.freeze({ name: 'petal', weight: 0.3, scale: [2.8, 3.8] }),
    Object.freeze({ name: 'orb', weight: 0.3, scale: [3.2, 3.2] }),
    Object.freeze({ name: 'glint', weight: 0.1, scale: [3.5, 3.5] }),
  ]),
  BEAMS: Object.freeze([34, 41, 46, 39]),
  BOKEH: Object.freeze([58, 66, 74, 81, 63, 88]),
  AURORA_SECONDS: Object.freeze([58, 73]),
  COLORS: Object.freeze({
    crimson: '#C8243A', crimsonRgb: '200 36 58',
    rose: '#E8607A', roseRgb: '232 96 122',
    blush: '#F4A6B7', blushRgb: '244 166 183',
    lavender: '#B8B2F0', lavenderRgb: '184 178 240',
    dawn: '#F8F5FA', dawnRgb: '248 245 250',
  }),
});

const SHAPE_NAMES = CRIMSON_STASIS_CONFIG.SHAPES.map(({ name }) => name);

export default function CrimsonStasisAtmosphere({
  active,
  devPreview,
  theme = 'dark-navy',
  reduceDecorativeEffects = false,
  effectQuality = 'balanced',
}) {
  const reducedMotion = useReducedMotion() || reduceDecorativeEffects;
  const shouldShow = devPreview ?? active;
  const density = getRequestedDensity(devPreview, effectQuality);
  const brightness = getRequestedBrightness(devPreview);
  const [phase, setPhase] = useState('idle');
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden);
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const frozenOpacityRef = useRef(null);
  const phaseRef = useRef(phase);
  const activeRef = useRef(shouldShow);
  const visible = phase !== 'idle';
  phaseRef.current = phase;
  activeRef.current = shouldShow;

  useEffect(() => {
    const onVisibilityChange = () => {
      const atmosphere = document.querySelector('.crimson-stasis');
      if (document.hidden) {
        if (atmosphere) {
          frozenOpacityRef.current = getComputedStyle(atmosphere).opacity;
          atmosphere.style.opacity = frozenOpacityRef.current;
        }
        setDocumentVisible(false);
        return;
      }
      const wasFrozen = frozenOpacityRef.current !== null;
      frozenOpacityRef.current = null;
      setDocumentVisible(true);
      if (wasFrozen && atmosphere) {
        window.requestAnimationFrame(() => {
          if (atmosphere.isConnected) atmosphere.style.removeProperty('opacity');
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!documentVisible) return undefined;
    if (shouldShow) {
      if (phaseRef.current === 'idle') setPhase('entering');
      else setPhase('active');
    } else if (phaseRef.current !== 'idle') {
      setPhase('leaving');
    }
    return undefined;
  }, [shouldShow, documentVisible]);

  useEffect(() => {
    if (!documentVisible) return undefined;
    if (phase === 'entering') {
      const frame = window.requestAnimationFrame(() => {
        const atmosphere = rootRef.current;
        if (!atmosphere) return;
        // Commit the initial opacity before switching phases so first mount
        // reliably animates from transparent to visible.
        window.getComputedStyle(atmosphere).opacity;
        if (activeRef.current) setPhase('active');
      });
      return () => window.cancelAnimationFrame(frame);
    }
    if (phase === 'leaving') {
      const timeout = window.setTimeout(
        () => { if (!activeRef.current) setPhase('idle'); },
        reducedMotion ? CRIMSON_STASIS_CONFIG.REDUCED_MS : CRIMSON_STASIS_CONFIG.EXIT_MS,
      );
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [phase, reducedMotion, documentVisible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || reducedMotion || !canvas) return undefined;
    const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!context) return undefined;

    const width = { value: 0 };
    const height = { value: 0 };
    const pixelRatio = { value: 1 };
    const sprites = createParticleSprites();
    let particles = [];
    let frameId = 0;
    let lastFrame = 0;
    let elapsed = 0;
    let resizeTimer = 0;
    let perfWindowStart = 0;
    let perfFrameTotal = 0;
    let perfFrames = 0;
    let metricWindowStart = 0;
    let metricFrames = 0;
    let metricRenderMs = 0;
    let guardTrips = 0;
    let initialCount = 0;
    let targetCount = 0;

    const resize = () => {
      width.value = window.innerWidth;
      height.value = window.innerHeight;
      pixelRatio.value = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width.value * pixelRatio.value);
      canvas.height = Math.round(height.value * pixelRatio.value);
      context.setTransform(pixelRatio.value, 0, 0, pixelRatio.value, 0, 0);
      const desiredCount = getParticleCount(width.value, height.value, density);
      const nextCount = guardTrips ? Math.min(desiredCount, targetCount) : desiredCount;
      if (particles.length !== nextCount) {
        particles = createParticlePool(width.value, height.value, nextCount);
        if (!initialCount) initialCount = desiredCount;
        targetCount = nextCount;
      } else {
        for (let index = 0; index < particles.length; index += 1) {
          const particle = particles[index];
          particle.xBase *= width.value / (particle.lastWidth || width.value);
          particle.y *= height.value / (particle.lastHeight || height.value);
          particle.lastWidth = width.value;
          particle.lastHeight = height.value;
          particle.fallSpeed = height.value / particle.crossSeconds;
        }
      }
      for (let index = 0; index < particles.length; index += 1) {
        particles[index].lastWidth = width.value;
        particles[index].lastHeight = height.value;
      }
    };

    const onFrame = (now) => {
      frameId = 0;
      if (document.hidden) return;
      const frameMs = lastFrame ? Math.min(now - lastFrame, 100) : 0;
      const delta = frameMs / 1000;
      lastFrame = now;
      elapsed += delta;
      const isLeaving = phaseRef.current === 'leaving';
      if (isLeaving) {
        for (const particle of particles) {
          if (!particle.alive) continue;
          if (!particle.retiring || particle.retireDuration !== CRIMSON_STASIS_CONFIG.EXIT_PARTICLE_FADE_MS / 1000) {
            particle.retiring = true;
            particle.retireAt = elapsed;
            particle.retireDuration = CRIMSON_STASIS_CONFIG.EXIT_PARTICLE_FADE_MS / 1000;
          }
        }
      }
      perfFrameTotal += frameMs;
      perfFrames += 1;
      if (!perfWindowStart) perfWindowStart = now;
      if (now - perfWindowStart >= CRIMSON_STASIS_CONFIG.PERF_WINDOW_MS) {
        if (perfFrames && perfFrameTotal / perfFrames > CRIMSON_STASIS_CONFIG.PERF_FRAME_MS) {
          guardTrips += 1;
          const nextTarget = Math.max(CRIMSON_STASIS_CONFIG.PERF_FLOOR, Math.floor(targetCount * 0.75));
          if (nextTarget < targetCount) {
            targetCount = nextTarget;
            let keep = targetCount;
            for (let index = 0; index < particles.length; index += 1) {
              const particle = particles[index];
              if (keep > 0) {
                particle.retiring = false;
                particle.retireAt = 0;
                particle.retireDuration = 0;
              } else if (!particle.retiring) {
                particle.retiring = true;
                particle.retireAt = elapsed;
                particle.retireDuration = CRIMSON_STASIS_CONFIG.PERF_FADE_MS / 1000;
              }
              if (keep > 0) keep -= 1;
            }
          }
          if (guardTrips >= 2) {
            canvas.parentElement?.setAttribute('data-ambient-disabled', 'true');
          }
        }
        perfWindowStart = now;
        perfFrameTotal = 0;
        perfFrames = 0;
      }

      context.clearRect(0, 0, width.value, height.value);
      const renderStartedAt = performance.now();
      const breath = 0.9 + 0.1 * (0.5 + 0.5 * Math.sin((elapsed / (CRIMSON_STASIS_CONFIG.BREATH_MS / 1000)) * Math.PI * 2));
      let visibleGlints = 0;
      for (let shapeIndex = 0; shapeIndex < SHAPE_NAMES.length; shapeIndex += 1) {
        const shapeName = SHAPE_NAMES[shapeIndex];
        for (let index = 0; index < particles.length; index += 1) {
          const particle = particles[index];
          if (!particle.alive) {
            if (!isLeaving && !particle.retiring && elapsed >= particle.spawnAt) {
              seedParticle(particle, index + particles.length, width.value, height.value, elapsed);
              particle.y = -particle.size * 2;
            } else continue;
          }
          if (particle.shape !== shapeName) continue;
          if (particle.retiring) {
            particle.retireAlpha = Math.max(0, 1 - (elapsed - particle.retireAt) / particle.retireDuration);
            if (particle.retireAlpha <= 0) {
              particle.alive = false;
              continue;
            }
          } else particle.retireAlpha = 1;

          particle.y += particle.fallSpeed * delta;
          particle.rotation += particle.rotationSpeed * delta;
          if (particle.y - particle.size > height.value) {
            particle.alive = false;
            if (!particle.retiring && activeRef.current) {
              particle.layer = chooseLayer();
              particle.spawnAt = elapsed + randomBetween(0, 5);
            }
            continue;
          }
          const progress = Math.max(0, Math.min(1, (particle.y + particle.size * 2) / (height.value + particle.size * 3)));
          const x = particle.xBase + Math.sin(elapsed / particle.swayPeriod + particle.swayPhase) * particle.swayWidth;
          const fadeIn = smoothStep(Math.min(1, progress / 0.12));
          const fadeOut = smoothStep(Math.min(1, (1 - progress) / 0.15));
          const twinkle = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(elapsed / particle.twinklePeriod + particle.twinklePhase));
          const pulse = particle.shape === 'glint' ? getGlintPulse(elapsed, particle.glintPeriod, particle.glintPhase) : 1;
          const alpha = clamp(particle.alpha * brightness * breath * fadeIn * fadeOut * twinkle * pulse * particle.retireAlpha, 0, 1);
          if (alpha <= 0.004) continue;
          if (particle.shape === 'glint') {
            if (visibleGlints >= 6) continue;
            visibleGlints += 1;
          }

          const sprite = particle.layer === 0
            ? sprites.far[particle.shape][particle.colorIndex]
            : sprites.normal[particle.shape][particle.colorIndex];
          const shape = CRIMSON_STASIS_CONFIG.SHAPES[shapeIndex];
          const flip = particle.shape === 'petal'
            ? 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(elapsed / particle.flipPeriod + particle.flipPhase))
            : 1;
          context.globalAlpha = alpha;
          context.globalCompositeOperation = particle.layer === 2 ? 'lighter' : 'source-over';
          context.save();
          context.translate(x, particle.y);
          context.rotate(particle.rotation);
          context.scale(flip, 1);
          context.drawImage(sprite, -particle.size * shape.scale[0] / 2, -particle.size * shape.scale[1] / 2, particle.size * shape.scale[0], particle.size * shape.scale[1]);
          context.restore();
        }
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      metricRenderMs += performance.now() - renderStartedAt;
      metricFrames += 1;
      if (!metricWindowStart) metricWindowStart = now;
      if (devPreview && now - metricWindowStart >= 5000) {
        const span = (now - metricWindowStart) / 1000;
        const fps = metricFrames / span;
        const canvasCpu = Math.min(100, (metricRenderMs / (span * 1000)) * 100);
        console.info(`[Crimson Stasis] density=${density.toFixed(1)} fps=${fps.toFixed(1)} canvasCPU≈${canvasCpu.toFixed(1)}% particles=${targetCount}/${initialCount}`);
        metricWindowStart = now;
        metricFrames = 0;
        metricRenderMs = 0;
      }
      frameId = window.requestAnimationFrame(onFrame);
    };

    const scheduleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 80);
    };
    const start = () => {
      if (document.hidden || frameId) return;
      lastFrame = performance.now();
      frameId = window.requestAnimationFrame(onFrame);
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (frameId) window.cancelAnimationFrame(frameId);
        frameId = 0;
        lastFrame = 0;
      } else {
        resize();
        start();
      }
    };

    resize();
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleResize) : null;
    resizeObserver?.observe(canvas.parentElement);
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
  }, [visible, reducedMotion, devPreview, effectQuality, density, brightness]);

  useLayoutEffect(() => {
    document.body.classList.toggle('crimson-stasis-running', visible);
    document.body.classList.toggle('emergency-pause-atmosphere-running', visible);
    document.body.classList.toggle('obsidian-emergency-active', visible && theme === 'obsidian');
    document.body.classList.toggle('obsidian-emergency-effects-reduced', visible && theme === 'obsidian' && reducedMotion);
    document.body.classList.toggle('galaxion-theme-active', theme === 'galaxion');
    return () => {
      document.body.classList.remove('crimson-stasis-running');
      document.body.classList.remove('emergency-pause-atmosphere-running');
      document.body.classList.remove('obsidian-emergency-active');
      document.body.classList.remove('obsidian-emergency-effects-reduced');
      document.body.classList.remove('galaxion-theme-active');
    };
  }, [visible, theme, reducedMotion]);

  if (!visible) return null;
  const cssVars = {
    '--stasis-enter-ms': `${CRIMSON_STASIS_CONFIG.ENTER_MS}ms`,
    '--stasis-exit-ms': `${CRIMSON_STASIS_CONFIG.EXIT_MS}ms`,
    '--stasis-reduced-ms': `${CRIMSON_STASIS_CONFIG.REDUCED_MS}ms`,
    '--stasis-enter-ease': CRIMSON_STASIS_CONFIG.EASE_IN,
    '--stasis-exit-ease': CRIMSON_STASIS_CONFIG.EASE_OUT,
    '--stasis-breath-ms': `${CRIMSON_STASIS_CONFIG.BREATH_MS}ms`,
    '--stasis-brightness': brightness,
    '--stasis-mist-alpha': clamp(0.22 * brightness, 0, 1),
    '--stasis-beam-alpha': clamp(0.06 * brightness, 0, 1),
    '--stasis-bokeh-alpha': clamp(0.08 * brightness, 0, 1),
    '--stasis-aurora-alpha': clamp(0.15 * brightness, 0, 1),
    '--stasis-floor-alpha': clamp(0.34 * brightness, 0, 1),
    '--stasis-edge-low': clamp(0.42 * brightness, 0, 1),
    '--stasis-edge-high': clamp(0.68 * brightness, 0, 1),
    '--stasis-crimson-rgb': CRIMSON_STASIS_CONFIG.COLORS.crimsonRgb,
    '--stasis-rose-rgb': CRIMSON_STASIS_CONFIG.COLORS.roseRgb,
    '--stasis-blush-rgb': CRIMSON_STASIS_CONFIG.COLORS.blushRgb,
    '--stasis-lavender-rgb': CRIMSON_STASIS_CONFIG.COLORS.lavenderRgb,
    '--stasis-dawn-rgb': CRIMSON_STASIS_CONFIG.COLORS.dawnRgb,
  };
  return createPortal(
    <div
      ref={rootRef}
      className={`crimson-stasis${reducedMotion ? ' is-static' : ''}`}
      data-phase={phase}
      data-document-visible={documentVisible ? 'true' : 'false'}
      data-system-theme={theme}
      style={cssVars}
      aria-hidden="true"
    >
      <div className="crimson-stasis__mist" />
      <div className="crimson-stasis__aurora">
        <span style={{ '--stasis-layer-duration': `${CRIMSON_STASIS_CONFIG.AURORA_SECONDS[0]}s` }} />
        <span style={{ '--stasis-layer-duration': `${CRIMSON_STASIS_CONFIG.AURORA_SECONDS[1]}s` }} />
      </div>
      <div className="crimson-stasis__floor" />
      <div className="crimson-stasis__edge" />
      {!reducedMotion && <>
        <div className="crimson-stasis__beams">
          {CRIMSON_STASIS_CONFIG.BEAMS.map((seconds, index) => <span key={index} style={{ '--stasis-layer-duration': `${seconds}s`, '--stasis-index': index }} />)}
        </div>
        <div className="crimson-stasis__bokeh">
          {CRIMSON_STASIS_CONFIG.BOKEH.map((seconds, index) => <span key={index} style={{ '--stasis-layer-duration': `${seconds}s`, '--stasis-index': index }} />)}
        </div>
        <canvas className="crimson-stasis__canvas" ref={canvasRef} />
      </>}
    </div>,
    document.body,
  );
}

function getRequestedDensity(devPreview, effectQuality) {
  const qualityScale = effectQuality === 'low' ? 0.65 : effectQuality === 'high' ? 1.15 : 1;
  if (!devPreview) return CRIMSON_STASIS_CONFIG.DENSITY * qualityScale;
  const requested = Number(new URLSearchParams(window.location.search).get('density'));
  return (Number.isFinite(requested) && requested > 0 ? clamp(requested, 0.5, 2) : CRIMSON_STASIS_CONFIG.DENSITY) * qualityScale;
}

function getRequestedBrightness(devPreview) {
  if (!devPreview) return CRIMSON_STASIS_CONFIG.BRIGHTNESS;
  const requested = Number(new URLSearchParams(window.location.search).get('brightness'));
  return Number.isFinite(requested) && requested > 0 ? clamp(requested, 0.5, 1.8) : CRIMSON_STASIS_CONFIG.BRIGHTNESS;
}

function getParticleCount(width, height, density) {
  const mobile = width <= CRIMSON_STASIS_CONFIG.MOBILE_BREAKPOINT;
  const baseArea = mobile ? CRIMSON_STASIS_CONFIG.BASE_AREA_MOBILE : CRIMSON_STASIS_CONFIG.BASE_AREA_DESKTOP;
  const base = mobile ? CRIMSON_STASIS_CONFIG.PARTICLES_BASE_MOBILE : CRIMSON_STASIS_CONFIG.PARTICLES_BASE_DESKTOP;
  const [minimum, maximum] = mobile ? [25, 70] : [40, 140];
  return Math.round(clamp(base * (width * height / baseArea), minimum, maximum) * density);
}

function createParticlePool(width, height, count) {
  const pool = new Array(count);
  const farEnd = Math.round(count * CRIMSON_STASIS_CONFIG.LAYER_SPLIT[0]);
  const midEnd = farEnd + Math.round(count * CRIMSON_STASIS_CONFIG.LAYER_SPLIT[1]);
  for (let index = 0; index < count; index += 1) {
    const layer = index < farEnd ? 0 : index < midEnd ? 1 : 2;
    pool[index] = {
      alive: false,
      layer,
      spawnAt: randomBetween(0, CRIMSON_STASIS_CONFIG.FILL_SECONDS),
      lastWidth: width,
      lastHeight: height,
    };
  }
  return pool;
}

function chooseLayer() {
  const roll = Math.random();
  if (roll < CRIMSON_STASIS_CONFIG.LAYER_SPLIT[0]) return 0;
  if (roll < CRIMSON_STASIS_CONFIG.LAYER_SPLIT[0] + CRIMSON_STASIS_CONFIG.LAYER_SPLIT[1]) return 1;
  return 2;
}

function seedParticle(particle, sequence, width, height, elapsed) {
  const layerIndex = particle.layer;
  const layer = CRIMSON_STASIS_CONFIG.LAYERS[layerIndex];
  const config = CRIMSON_STASIS_CONFIG;
  const golden = (sequence * config.GOLDEN_RATIO) % 1;
  const swayPeriodSeconds = randomBetween(10, 20);
  const shapeRoll = Math.random();
  let accumulated = 0;
  let shape = config.SHAPES[0];
  for (let index = 0; index < config.SHAPES.length; index += 1) {
    accumulated += config.SHAPES[index].weight;
    if (shapeRoll <= accumulated) { shape = config.SHAPES[index]; break; }
  }
  const isLavender = Math.random() < 0.15;
  const colorIndex = isLavender ? 3 : Math.floor(Math.random() * 3);
  const layerAlpha = randomBetween(layer.alpha[0], layer.alpha[1]);
  particle.layer = layerIndex;
  particle.shape = shape.name;
  particle.colorIndex = colorIndex;
  particle.xBase = ((golden + randomBetween(-0.025, 0.025) + 1) % 1) * width;
  particle.y = 0;
  particle.size = randomBetween(layer.size[0] * 0.7, layer.size[1] * 1.3);
  particle.crossSeconds = randomBetween(layer.cross[0], layer.cross[1]);
  particle.fallSpeed = height / particle.crossSeconds;
  particle.swayWidth = randomBetween(layer.sway[0], layer.sway[1]);
  particle.swayPeriod = swayPeriodSeconds;
  particle.swayPhase = randomBetween(0, Math.PI * 2);
  particle.rotation = randomBetween(-Math.PI, Math.PI);
  particle.rotationSpeed = randomBetween(-0.05236, 0.05236);
  particle.twinklePeriod = randomBetween(5, 9);
  particle.twinklePhase = randomBetween(0, Math.PI * 2);
  particle.alpha = Math.min(config.MAX_ALPHA, layerAlpha);
  particle.flipPeriod = randomBetween(5, 8);
  particle.flipPhase = randomBetween(0, Math.PI * 2);
  particle.glintPeriod = randomBetween(4, 8);
  particle.glintPhase = randomBetween(0, particle.glintPeriod);
  particle.spawnedAt = elapsed;
  particle.retiring = false;
  particle.retireAlpha = 1;
  particle.retireDuration = 0;
  particle.lastWidth = width;
  particle.lastHeight = height;
  particle.alive = true;
}

function createParticleSprites() {
  const normal = {};
  const far = {};
  const colorHex = [
    CRIMSON_STASIS_CONFIG.COLORS.crimson,
    CRIMSON_STASIS_CONFIG.COLORS.rose,
    CRIMSON_STASIS_CONFIG.COLORS.blush,
    CRIMSON_STASIS_CONFIG.COLORS.lavender,
  ];
  for (let shapeIndex = 0; shapeIndex < SHAPE_NAMES.length; shapeIndex += 1) {
    const shape = SHAPE_NAMES[shapeIndex];
    normal[shape] = [];
    far[shape] = [];
    for (let colorIndex = 0; colorIndex < colorHex.length; colorIndex += 1) {
      normal[shape][colorIndex] = createSprite(shape, colorHex[colorIndex], false);
      far[shape][colorIndex] = createSprite(shape, colorHex[colorIndex], true);
    }
  }
  return { normal, far };
}

function createSprite(shape, color, blurred) {
  const sprite = document.createElement('canvas');
  sprite.width = 72;
  sprite.height = 72;
  const ctx = sprite.getContext('2d');
  if (!ctx) return sprite;
  const glow = ctx.createRadialGradient(36, 36, 1, 36, 36, 34);
  glow.addColorStop(0, `${color}64`);
  glow.addColorStop(0.32, `${color}38`);
  glow.addColorStop(1, `${color}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 72, 72);
  if (blurred) ctx.filter = 'blur(1px)';
  ctx.shadowColor = color;
  ctx.shadowBlur = blurred ? 0 : 12;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (shape === 'orb') {
    ctx.arc(36, 36, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === 'petal') {
    ctx.moveTo(36, 13); ctx.bezierCurveTo(53, 22, 51, 43, 36, 58); ctx.bezierCurveTo(20, 43, 19, 22, 36, 13); ctx.closePath(); ctx.fill();
  } else if (shape === 'glint' || shape === 'star') {
    const radius = shape === 'glint' ? 17 : 22;
    ctx.moveTo(36, 36 - radius); ctx.lineTo(40, 32); ctx.lineTo(36 + radius, 36); ctx.lineTo(40, 40); ctx.lineTo(36, 36 + radius); ctx.lineTo(32, 40); ctx.lineTo(36 - radius, 36); ctx.lineTo(32, 32); ctx.closePath(); ctx.fill();
  }
  ctx.filter = 'none';
  return sprite;
}

function getGlintPulse(elapsed, period, phase) {
  const time = ((elapsed + phase) % period + period) % period;
  if (time >= 1) return 0.38;
  return 0.38 + 0.62 * Math.sin((time / 1) * Math.PI);
}

function smoothStep(value) { return value * value * (3 - 2 * value); }
function randomBetween(min, max) { return min + Math.random() * (max - min); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
