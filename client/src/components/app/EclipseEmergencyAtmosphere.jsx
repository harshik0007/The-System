import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import EclipseParticleCanvas from './EclipseParticleCanvas.jsx';

export default function EclipseEmergencyAtmosphere({
  visible,
  phase: serverPhase = 'active',
  activationId,
  startedAt,
  documentVisible = true,
  reducedMotion,
  reduceDecorativeEffects,
  effectQuality = 'balanced',
}) {
  const [visualPhase, setVisualPhase] = useState('active');
  const entryDecisionRef = useRef({ key: null, shouldEnter: false });
  const staticOnly = reducedMotion || reduceDecorativeEffects;

  useEffect(() => {
    if (!visible) return undefined;
    const key = activationId || startedAt;
    let shouldEnter = entryDecisionRef.current.key === key ? entryDecisionRef.current.shouldEnter : false;
    if (entryDecisionRef.current.key !== key && serverPhase === 'entering' && key && startedAt) {
      const startedAtMs = Date.parse(startedAt);
      const newlyActivated = Number.isFinite(startedAtMs) && Date.now() - startedAtMs <= 7000;
      let alreadySeen = false;
      try {
        const storeKey = `the-system-eclipse-totality:${key}`;
        alreadySeen = window.sessionStorage.getItem(storeKey) === 'seen';
        window.sessionStorage.setItem(storeKey, 'seen');
      } catch {
        // The renderer still works without session storage; it only affects entrance replay.
      }
      shouldEnter = newlyActivated && !alreadySeen && !staticOnly;
      entryDecisionRef.current = { key, shouldEnter };
    } else if (entryDecisionRef.current.key !== key) {
      entryDecisionRef.current = { key, shouldEnter: false };
    }

    if (!shouldEnter || staticOnly) {
      setVisualPhase('active');
      return undefined;
    }
    setVisualPhase('entering');
    const timeout = window.setTimeout(() => setVisualPhase('active'), 2300);
    return () => window.clearTimeout(timeout);
  }, [activationId, startedAt, visible]);

  useEffect(() => {
    if (visible && serverPhase === 'ending') setVisualPhase('ending');
  }, [serverPhase, visible]);

  if (!visible) return null;

  const moon = (
    <div className="eclipse-totality__moon" role="presentation">
      <i className="eclipse-totality__moon-corona" />
      <i className="eclipse-totality__moon-silver-rim" />
      <i className="eclipse-totality__moon-disc" />
      <i className="eclipse-totality__moon-shadow" />
      <i className="eclipse-totality__moon-crater eclipse-totality__moon-crater--one" />
      <i className="eclipse-totality__moon-crater eclipse-totality__moon-crater--two" />
      <i className="eclipse-totality__moon-crater eclipse-totality__moon-crater--three" />
      {!staticOnly && <>
        <i className="eclipse-totality__resonance-ring eclipse-totality__resonance-ring--one" />
        <i className="eclipse-totality__resonance-ring eclipse-totality__resonance-ring--two" />
        <i className="eclipse-totality__moon-glint" />
      </>}
    </div>
  );

  return createPortal(
    <div
      className={`eclipse-totality${staticOnly ? ' is-static' : ''}${reduceDecorativeEffects ? ' is-effects-reduced' : ''}`}
      data-phase={visualPhase}
      data-document-visible={documentVisible ? 'true' : 'false'}
      aria-hidden="true"
    >
      <div className="eclipse-totality__field" />
      {staticOnly
        ? moon
        : <EclipseParticleCanvas emitting={serverPhase !== 'ending'} documentVisible={documentVisible} effectQuality={effectQuality}>{moon}</EclipseParticleCanvas>}
    </div>,
    document.body,
  );
}
