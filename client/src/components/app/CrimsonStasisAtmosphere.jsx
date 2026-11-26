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
}) {
  const osOrAppReducedMotion = useReducedMotion();
  const reducedMotion = osOrAppReducedMotion || reduceDecorativeEffects;
  const shouldShow = devPreview ?? active;
  const [phase, setPhase] = useState('idle');
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden);
  const phaseRef = useRef(phase);
  const activeRef = useRef(shouldShow);
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

  const visible = phase !== 'idle';
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
    </div>,
    document.body,
  );
}
