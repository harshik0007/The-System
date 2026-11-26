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
  DENSITY: 1.5,
  BRIGHTNESS: 1.15,
  PARTICLES_BASE_DESKTOP: 180,
  PARTICLES_BASE_MOBILE: 90,
  MAX_ALPHA: 0.85,
  BASE_AREA_DESKTOP: 1920 * 900,
  BASE_AREA_MOBILE: 390 * 844,
  MOBILE_BREAKPOINT: 640,
  PERF_FRAME_MS: 18,
  PERF_WINDOW_MS: 3000,
  PERF_FADE_MS: 900,
  PERF_FLOOR: 80,
  GOLDEN_RATIO: 0.61803398875,
  Y_GOLDEN_RATIO: 0.75487766625,
  LAYER_SPLIT: Object.freeze([0.5, 0.32, 0.18]),
  LAYERS: Object.freeze([
    Object.freeze({ name: 'far', size: [1.4, 3.2], cross: [26, 40], sway: [15, 25], alpha: [0.28, 0.4] }),
    Object.freeze({ name: 'mid', size: [3.2, 6.2], cross: [16, 26], sway: [24, 38], alpha: [0.45, 0.6] }),
    Object.freeze({ name: 'near', size: [6, 10], cross: [10, 16], sway: [36, 50], alpha: [0.65, 0.85] }),
  ]),
  SHAPES: Object.freeze([
    Object.freeze({ name: 'star', weight: 0.22, scale: [3.5, 3.5] }),
    Object.freeze({ name: 'petal', weight: 0.22, scale: [2.8, 3.8] }),
    Object.freeze({ name: 'orb', weight: 0.2, scale: [3.2, 3.2] }),
    Object.freeze({ name: 'dust', weight: 0.2, scale: [1.2, 1.2] }),
    Object.freeze({ name: 'glint', weight: 0.08, scale: [3.5, 3.5] }),
    Object.freeze({ name: 'streak', weight: 0.05, scale: [4, 1.7] }),
    Object.freeze({ name: 'ring', weight: 0.03, scale: [3, 3] }),
  ]),
  BEAMS: Object.freeze([28, 34, 38, 32, 40, 36]),
  BOKEH: Object.freeze([44, 51, 58, 63, 47, 69, 55, 60, 66]),
  AURORA_SECONDS: Object.freeze([58, 73]),
  COLORS: Object.freeze({
    crimson: '#E02E4A', crimsonRgb: '224 46 74',
    rose: '#F5688A', roseRgb: '245 104 138',
    blush: '#FFBACB', blushRgb: '255 186 203',
    lavender: '#CBC5FF', lavenderRgb: '203 197 255',
    gold: '#FFE6B8', goldRgb: '255 230 184',
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

    const resize = (reseed = false) => {
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
          if (reseed) {
            if (particle.alive) {
              const wasRetiring = particle.retiring;
              const retireAt = particle.retireAt;
              seedParticle(particle, index, width.value, height.value, elapsed, false);
              particle.y = ((index * CRIMSON_STASIS_CONFIG.Y_GOLDEN_RATIO) % 1) * height.value;
              particle.retiring = wasRetiring;
              particle.retireAt = retireAt;
            }
          }
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
              } else if (!particle.retiring) {
                particle.retiring = true;
                particle.retireAt = elapsed;
              }
              if (keep > 0) keep -= 1;
            }
          }
          if (guardTrips >= 2) {
            canvas.parentElement?.setAttribute('data-ambient-disabled', 'true');
            for (let index = 0; index < particles.length; index += 1) {
              if (particles[index].shape === 'ring' && !particles[index].retiring) {
                particles[index].retiring = true;
                particles[index].retireAt = elapsed;
              }
            }
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
          if (!particle.alive || particle.shape !== shapeName) continue;
          if (particle.retiring) {
            particle.retireAlpha = Math.max(0, 1 - (elapsed - particle.retireAt) / (CRIMSON_STASIS_CONFIG.PERF_FADE_MS / 1000));
            if (particle.retireAlpha <= 0) {
              particle.alive = false;
              continue;
            }
          } else particle.retireAlpha = 1;

          particle.y += particle.fallSpeed * delta;
          particle.rotation += particle.rotationSpeed * delta;
          if (particle.y - particle.size > height.value) {
            if (!particle.retiring) seedParticle(particle, index + particles.length, width.value, height.value, elapsed, true);
            else particle.alive = false;
            continue;
          }
          const progress = Math.max(0, Math.min(1, (particle.y + particle.size * 2) / (height.value + particle.size * 3)));
          const x = particle.xBase + Math.sin(elapsed / particle.swayPeriod + particle.swayPhase) * particle.swayWidth;
          const fadeIn = smoothStep(Math.min(1, progress / 0.08));
          const fadeOut = smoothStep(Math.min(1, (1 - progress) / 0.1));
          const twinkle = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(elapsed / particle.twinklePeriod + particle.twinklePhase));
          const pulse = particle.shape === 'glint' ? getGlintPulse(elapsed, particle.glintPeriod, particle.glintPhase) : 1;
          const alpha = clamp(particle.alpha * brightness * breath * fadeIn * fadeOut * twinkle * pulse * particle.retireAlpha, 0, 1);
          if (alpha <= 0.004) continue;
          if (particle.shape === 'glint') {
            if (visibleGlints >= 16) continue;
            visibleGlints += 1;
          }
          if (particle.shape === 'ring' && guardTrips >= 2) continue;

          const sprite = particle.layer === 0
            ? sprites.far[particle.shape][particle.colorIndex]
            : sprites.normal[particle.shape][particle.colorIndex];
          const shape = CRIMSON_STASIS_CONFIG.SHAPES[shapeIndex];
          const flip = particle.shape === 'petal'
            ? 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(elapsed / particle.flipPeriod + particle.flipPhase))
            : 1;
          const grow = particle.shape === 'ring' ? 1 + 0.2 * progress : 1;
          context.globalAlpha = alpha;
          context.globalCompositeOperation = particle.layer === 2 ? 'lighter' : 'source-over';
          context.save();
          context.translate(x, particle.y);
          context.rotate(particle.rotation);
          context.scale(flip * grow, grow);
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
      resizeTimer = window.setTimeout(() => resize(false), 80);
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
        resize(true);
        start();
      }
    };

    resize(true);
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
    document.body.classList.toggle('obsidian-emergency-active', visible && theme === 'obsidian');
    document.body.classList.toggle('obsidian-emergency-effects-reduced', visible && theme === 'obsidian' && reducedMotion);
    document.body.classList.toggle('galaxion-theme-active', theme === 'galaxion');
    return () => {
      document.body.classList.remove('crimson-stasis-running');
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
    '--stasis-beam-alpha': clamp(0.14 * brightness, 0, 1),
    '--stasis-bokeh-alpha': clamp(0.14 * brightness, 0, 1),
    '--stasis-aurora-alpha': clamp(0.15 * brightness, 0, 1),
    '--stasis-floor-alpha': clamp(0.34 * brightness, 0, 1),
    '--stasis-edge-low': clamp(0.42 * brightness, 0, 1),
    '--stasis-edge-high': clamp(0.68 * brightness, 0, 1),
    '--stasis-crimson-rgb': CRIMSON_STASIS_CONFIG.COLORS.crimsonRgb,
    '--stasis-rose-rgb': CRIMSON_STASIS_CONFIG.COLORS.roseRgb,
    '--stasis-blush-rgb': CRIMSON_STASIS_CONFIG.COLORS.blushRgb,
    '--stasis-lavender-rgb': CRIMSON_STASIS_CONFIG.COLORS.lavenderRgb,
    '--stasis-gold-rgb': CRIMSON_STASIS_CONFIG.COLORS.goldRgb,
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
  const [minimum, maximum] = mobile ? [50, 170] : [100, 360];
  return Math.round(clamp(base * (width * height / baseArea), minimum, maximum) * density);
}

function createParticlePool(width, height, count) {
  const pool = new Array(count);
  const farEnd = Math.round(count * CRIMSON_STASIS_CONFIG.LAYER_SPLIT[0]);
  const midEnd = farEnd + Math.round(count * CRIMSON_STASIS_CONFIG.LAYER_SPLIT[1]);
  for (let index = 0; index < count; index += 1) {
    const layer = index < farEnd ? 0 : index < midEnd ? 1 : 2;
    pool[index] = { alive: true, layer, lastWidth: width, lastHeight: height };
    seedParticle(pool[index], index, width, height, 0, false);
    pool[index].y = ((index * CRIMSON_STASIS_CONFIG.Y_GOLDEN_RATIO) % 1) * height;
  }
  return pool;
}

function seedParticle(particle, sequence, width, height, elapsed, recycling) {
  const layerIndex = particle.layer;
  const layer = CRIMSON_STASIS_CONFIG.LAYERS[layerIndex];
  const config = CRIMSON_STASIS_CONFIG;
  const golden = (sequence * config.GOLDEN_RATIO) % 1;
  const swayPeriodSeconds = randomBetween(6, 12);
  const shapeRoll = Math.random();
  let accumulated = 0;
  let shape = config.SHAPES[0];
  for (let index = 0; index < config.SHAPES.length; index += 1) {
    accumulated += config.SHAPES[index].weight;
    if (shapeRoll <= accumulated) { shape = config.SHAPES[index]; break; }
  }
  const isGold = shape.name === 'glint' && Math.random() < 0.62;
  const isLavender = !isGold && Math.random() < 0.15;
  const colorIndex = isGold ? 4 : isLavender ? 3 : Math.floor(Math.random() * 3);
  const layerAlpha = randomBetween(layer.alpha[0], layer.alpha[1]);
  particle.layer = layerIndex;
  particle.shape = shape.name;
  particle.colorIndex = colorIndex;
  particle.xBase = ((golden + randomBetween(-0.025, 0.025) + 1) % 1) * width;
  particle.y = 0;
  particle.size = shape.name === 'dust' ? randomBetween(1, 3) : randomBetween(layer.size[0] * 0.7, layer.size[1] * 1.3);
  if (recycling) particle.y = -2 * particle.size;
  particle.crossSeconds = shape.name === 'streak' ? 40 : randomBetween(layer.cross[0], layer.cross[1]);
  particle.fallSpeed = height / particle.crossSeconds;
  particle.swayWidth = randomBetween(layer.sway[0], layer.sway[1]);
  particle.swayPeriod = swayPeriodSeconds;
  particle.swayPhase = randomBetween(0, Math.PI * 2);
  particle.rotation = randomBetween(-Math.PI, Math.PI);
  particle.rotationSpeed = randomBetween(-0.1047, 0.1047);
  particle.twinklePeriod = randomBetween(4, 8);
  particle.twinklePhase = randomBetween(0, Math.PI * 2);
  particle.alpha = Math.min(config.MAX_ALPHA, shape.name === 'dust' ? randomBetween(0.4, 0.65) : layerAlpha);
  particle.flipPeriod = randomBetween(5, 8);
  particle.flipPhase = randomBetween(0, Math.PI * 2);
  particle.glintPeriod = randomBetween(4, 8);
  particle.glintPhase = randomBetween(0, particle.glintPeriod);
  particle.spawnedAt = elapsed;
  particle.retiring = false;
  particle.retireAlpha = 1;
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
    CRIMSON_STASIS_CONFIG.COLORS.gold,
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
  ctx.shadowBlur = blurred ? 0 : shape === 'dust' ? 1 : 12;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = shape === 'ring' || shape === 'streak' ? 2 : 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (shape === 'orb') {
    ctx.arc(36, 36, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === 'dust') {
    ctx.arc(36, 36, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === 'petal') {
    ctx.moveTo(36, 13); ctx.bezierCurveTo(53, 22, 51, 43, 36, 58); ctx.bezierCurveTo(20, 43, 19, 22, 36, 13); ctx.closePath(); ctx.fill();
  } else if (shape === 'glint' || shape === 'star') {
    const radius = shape === 'glint' ? 17 : 22;
    ctx.moveTo(36, 36 - radius); ctx.lineTo(40, 32); ctx.lineTo(36 + radius, 36); ctx.lineTo(40, 40); ctx.lineTo(36, 36 + radius); ctx.lineTo(32, 40); ctx.lineTo(36 - radius, 36); ctx.lineTo(32, 32); ctx.closePath(); ctx.fill();
  } else if (shape === 'streak') {
    ctx.moveTo(20, 40); ctx.quadraticCurveTo(35, 29, 54, 32); ctx.stroke();
  } else if (shape === 'ring') {
    ctx.arc(36, 36, 17, 0, Math.PI * 2); ctx.stroke();
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
