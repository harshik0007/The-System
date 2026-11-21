import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import EclipseMoonMark from '../EclipseMoonMark.jsx';
import GalaxionTransitionMark from '../GalaxionTransitionMark.jsx';

const STANDARD_STAGES = [
  { id: 'identity', label: 'Identity', description: 'Initializing the destination emblem and accent' },
  { id: 'activation', label: 'Activation', description: 'Revealing the selected theme identity' },
  { id: 'surfaces', label: 'Surfaces', description: 'Transforming backgrounds and surfaces' },
  { id: 'interface', label: 'Interface', description: 'Updating navigation and components' },
  { id: 'interactions', label: 'Interactions', description: 'Preparing cursor and control styling' },
  { id: 'complete', label: 'Complete', description: 'Finalizing the theme activation' },
];
const GALAXION_STAGES = [
  { id: 'singularity', label: 'Singularity', description: 'The event horizon settles into stillness' },
  { id: 'accretion', label: 'Accretion', description: 'Stars, a planet and meteors fall toward the black hole' },
  { id: 'formation', label: 'Lensing', description: 'Blue-violet light bends around the dark core' },
  { id: 'identity', label: 'Reveal', description: 'The Galaxy Within comes into focus' },
];

function getStageIndex(stages, themeId, elapsedMs) {
  if (themeId === 'galaxion') {
    if (elapsedMs >= 5500) return 3;
    if (elapsedMs >= 3500) return 2;
    if (elapsedMs >= 1500) return 1;
    return 0;
  }
  return Math.min(stages.length - 1, Math.floor(elapsedMs / 1000));
}

function transitionStyle(theme) {
  const identity = theme?.transition;
  return {
    '--transition-accent': identity?.accent,
    '--transition-secondary': identity?.secondary,
    '--transition-background': identity?.background,
    '--transition-surface': identity?.surface,
    '--transition-text': identity?.text,
    '--transition-completion': identity?.completion,
  };
}

export default function ThemeTransitionOverlay({ theme, startedAt, saved = false, savedAt = null, reducedMotion = false, onComplete }) {
  const overlayRef = useRef(null);
  const reducedMotionRef = useRef(reducedMotion);
  const onCompleteRef = useRef(onComplete);
  const isGalaxionAscension = theme?.id === 'galaxion';
  const sequenceSeconds = theme?.transition?.durationSeconds || 6;
  const sequenceMs = sequenceSeconds * 1000;
  const stages = isGalaxionAscension ? GALAXION_STAGES : STANDARD_STAGES;
  const [elapsedMs, setElapsedMs] = useState(0);
  const [completionReady, setCompletionReady] = useState(false);
  const [exiting, setExiting] = useState(false);
  const themeName = theme?.name || 'Selected theme';
  const stageIndex = getStageIndex(stages, theme?.id, elapsedMs);
  const waitingForServer = elapsedMs >= sequenceMs && !saved;
  const waitingForTheme = elapsedMs >= sequenceMs && saved && !completionReady;
  const progress = completionReady ? 100 : waitingForServer || waitingForTheme
    ? 95
    : Math.min(95, Math.round((elapsedMs / sequenceMs) * 95));

  reducedMotionRef.current = reducedMotion;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let timeoutId = 0;
    const tick = () => {
      const elapsed = Math.max(0, Math.min(sequenceMs, performance.now() - startedAt));
      setElapsedMs(elapsed);
      if (elapsed < sequenceMs) {
        timeoutId = window.setTimeout(tick, Math.min(250, Math.max(0, sequenceMs - elapsed)));
      }
    };
    tick();
    return () => window.clearTimeout(timeoutId);
  }, [sequenceMs, startedAt]);

  useEffect(() => {
    if (!saved || savedAt == null) return undefined;
    const completionAt = Math.max(startedAt + (isGalaxionAscension ? sequenceMs : 5000), savedAt + 0);
    const finishAt = Math.max(startedAt + sequenceMs, savedAt + (isGalaxionAscension ? 450 : 1450));
    const completionTimeout = window.setTimeout(() => setCompletionReady(true), Math.max(0, completionAt - performance.now()));
    const exitTimeout = window.setTimeout(() => {
      setExiting(true);
    }, Math.max(0, finishAt - performance.now()));
    const completeTimeout = window.setTimeout(() => onCompleteRef.current?.(), Math.max(0, finishAt - performance.now()) + (reducedMotionRef.current ? 0 : 450));
    return () => {
      window.clearTimeout(completionTimeout);
      window.clearTimeout(exitTimeout);
      window.clearTimeout(completeTimeout);
    };
  }, [isGalaxionAscension, reducedMotion, saved, savedAt, sequenceMs, startedAt]);

  useLayoutEffect(() => {
    if (!saved || savedAt == null) return undefined;
    const root = document.documentElement;
    root.classList.add('theme-transition-running');
    return () => {
      root.classList.remove('theme-transition-running');
    };
  }, [saved, savedAt]);

  useLayoutEffect(() => {
    const appRoot = document.getElementById('root');
    const priorInert = appRoot?.inert ?? false;
    const priorOverflow = document.body.style.overflow;
    const priorDocumentOverflow = document.documentElement.style.overflow;
    const priorFocus = document.activeElement;
    const overlay = overlayRef.current;

    if (appRoot) appRoot.inert = true;
    document.body.classList.add('theme-transition-overlay-active');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    overlay?.focus({ preventScroll: true });

    const keepFocusInOverlay = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        overlay?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', keepFocusInOverlay, true);

    return () => {
      window.removeEventListener('keydown', keepFocusInOverlay, true);
      if (appRoot) appRoot.inert = priorInert;
      document.body.classList.remove('theme-transition-overlay-active');
      document.body.style.overflow = priorOverflow;
      document.documentElement.style.overflow = priorDocumentOverflow;
      if (priorFocus instanceof HTMLElement && priorFocus.isConnected && !appRoot?.inert) {
        priorFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  const emblem = theme?.transition?.emblem;
  const currentStage = stages[stageIndex];
  const stageText = completionReady
    ? 'Theme equipped'
    : waitingForServer
      ? 'Finalizing with your account…'
      : waitingForTheme
        ? 'Your selection is saved. Finishing the appearance…'
        : currentStage.description;
  const saveStatus = completionReady
    ? isGalaxionAscension ? 'GALAXION EQUIPPED' : theme?.id === 'eclipse' ? 'ECLIPSE EQUIPPED' : 'THEME EQUIPPED'
    : saved
      ? waitingForTheme
        ? 'Saved to your account · finishing visual changes…'
        : 'Saved to your account · completing activation…'
      : 'Saving your selection securely…';

  return createPortal(
    <div
      ref={overlayRef}
      className={`theme-transition-wash${reducedMotion ? ' is-reduced' : ''}${completionReady ? ' is-complete' : ''}${exiting ? ' is-exiting' : ''}`}
      data-transition-theme={theme?.id || 'dark-navy'}
      data-stage-id={currentStage.id}
      data-stage-index={stageIndex}
      style={transitionStyle(theme)}
      role="dialog"
      aria-busy={!completionReady}
      aria-modal="true"
      aria-labelledby="theme-transition-title"
      aria-describedby="theme-transition-description"
      tabIndex={-1}
    >
      <div className="theme-transition-wash__backdrop" />
      <section className={`theme-transition-wash__panel${completionReady ? ' is-complete' : ''}`}>
        <span className={`theme-transition-wash__sigil${isGalaxionAscension ? ' galaxion-ascension__sigil' : ''}`} aria-hidden="true">
          {isGalaxionAscension
            ? <GalaxionTransitionMark />
            : theme?.id === 'eclipse'
            ? <EclipseMoonMark className="eclipse-moon-mark--transition" />
            : <svg viewBox={emblem?.viewBox || '0 0 40 40'} fill="none" focusable="false">
              {(emblem?.paths || []).map((path, index) => <path d={path} key={`${theme?.id || 'theme'}-emblem-${index}`} />)}
            </svg>}
        </span>
        <p className="theme-transition-wash__eyebrow">{isGalaxionAscension ? 'RANK 01 · SINGULARITY SEQUENCE' : 'THEME ACTIVATION'}</p>
        <h2 id="theme-transition-title">{isGalaxionAscension ? 'GALAXION' : `Equipping ${themeName}`}</h2>
        <p id="theme-transition-description" className="theme-transition-wash__stage" aria-live="polite" aria-atomic="true">
          {stageText}
        </p>
        {!(isGalaxionAscension && (waitingForServer || waitingForTheme)) && <div className="theme-transition-wash__progress" role="progressbar" aria-label={`${themeName} visual transition progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span style={{ '--transition-progress': `${progress}%` }} />
        </div>}
        <ol className="theme-transition-wash__stages" aria-label={isGalaxionAscension ? 'Four Singularity Ascension stages' : 'Six theme activation stages'}>
          {stages.map((stage, index) => <li
            key={stage.id}
            className={`${index < stageIndex || (completionReady && index === stageIndex) ? 'is-complete' : ''}${index === stageIndex && !completionReady ? ' is-current' : ''}`}
            aria-current={index === stageIndex ? 'step' : undefined}
          >
            <span aria-hidden="true" />
            <span className="theme-transition-wash__stage-label">{stage.label}</span>
          </li>)}
        </ol>
        <span className={`theme-transition-wash__saved${completionReady ? ' is-saved' : ''}`} role="status">{saveStatus}</span>
      </section>
    </div>,
    document.body,
  );
}
