import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import AuroraEmergencyAtmosphere from './AuroraEmergencyAtmosphere.jsx';
import EclipseEmergencyAtmosphere from './EclipseEmergencyAtmosphere.jsx';
import GalaxionAtmosphere from './GalaxionAtmosphere.jsx';
import '../../styles/emergency-pause-atmosphere.css';

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

export default function ThemeEmergencyPauseAtmosphere({ active, activationId = null, startedAt = null, statusKnown = false, theme = 'dark-navy', clickRipple = true, reduceDecorativeEffects = false, effectQuality = 'balanced' }) {
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
  if (!visible) return null;

  return createPortal(
    <div
      className={'emergency-pause-atmosphere emergency-pause-atmosphere--' + phase + (reducedMotion ? ' is-reduced-motion' : '') + (reduceDecorativeEffects ? ' is-effects-reduced' : '')}
      data-document-visible={documentVisible ? 'true' : 'false'}
      data-system-theme="obsidian"
      aria-hidden="true"
    >
      <div className="emergency-pause-atmosphere__aura" />
      <canvas className="emergency-pause-atmosphere__active-canvas" ref={obsidianCanvasRef} />
    </div>,
    document.body,
  );
}
