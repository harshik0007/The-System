import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createDefaultUserPreferences } from '../utils/userPreferences.js';
import { useOptionalUserPreferences } from '../context/UserPreferencesContext.jsx';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import useCursorTopLayer, { subscribeCursorRuntimeEvent } from '../hooks/useCursorTopLayer.js';

const HOVERABLE = 'a[href], button:not(:disabled), [role="button"], [role="tab"], [data-cursor-hover]';
const NATIVE_POINTER_TARGET = '[data-native-cursor]';

export default function EclipseCursor({ initialPointer = null }) {
  const preferenceContext = useOptionalUserPreferences();
  const preferences = preferenceContext?.preferences || createDefaultUserPreferences();
  const preferencesReady = preferenceContext?.ready ?? true;
  const reducedMotion = useReducedMotion();
  const rootRef = useRef(null);
  const pointerRef = useRef(null);
  const frameRef = useRef(0);
  const pendingPointRef = useRef(null);
  const clickTimersRef = useRef(new Set());
  const [supportsCursor, setSupportsCursor] = useState(false);
  const cursorEnabled = supportsCursor && preferencesReady && preferences.appearance.voidShardCursor && !reducedMotion;
  const clickEnabled = supportsCursor && preferencesReady && preferences.appearance.clickRipple
    && !preferences.appearance.reduceDecorativeEffects && !reducedMotion;
  if (initialPointer?.inside) pendingPointRef.current = initialPointer;

  useCursorTopLayer(rootRef, cursorEnabled || clickEnabled);

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 769px)');
    const update = () => setSupportsCursor(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const documentRoot = document.documentElement;
    if (!root || (!cursorEnabled && !clickEnabled)) {
      return () => documentRoot.classList.remove('has-eclipse-cursor');
    }

    const render = () => {
      frameRef.current = 0;
      const point = pendingPointRef.current;
      if (point && cursorEnabled && pointerRef.current) {
        pointerRef.current.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-2px, -2px)`;
      }
    };
    const track = (event) => {
      if (event.pointerType === 'touch') return;
      pendingPointRef.current = { x: event.clientX, y: event.clientY };
      const nativeTarget = Boolean(event.target instanceof Element && event.target.closest(NATIVE_POINTER_TARGET));
      root.classList.toggle('is-native-mode', nativeTarget);
      pointerRef.current?.classList.toggle('is-offscreen', nativeTarget);
      documentRoot.classList.toggle('has-eclipse-cursor', cursorEnabled && !nativeTarget);
      if (!frameRef.current) frameRef.current = window.requestAnimationFrame(render);
    };
    const hover = (event) => root.classList.toggle('is-hovering', Boolean(event.target instanceof Element && event.target.closest(HOVERABLE)));
    const leave = () => {
      pointerRef.current?.classList.add('is-offscreen');
      root.classList.remove('is-hovering', 'is-pressed', 'is-native-mode');
      documentRoot.classList.remove('has-eclipse-cursor');
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
    const press = (event) => {
      if (!clickEnabled || event.pointerType === 'touch') return;
      const wave = document.createElement('i');
      wave.className = 'eclipse-cursor__click-wave';
      wave.style.left = `${event.clientX}px`;
      wave.style.top = `${event.clientY}px`;
      wave.setAttribute('aria-hidden', 'true');
      root.append(wave);
      if (cursorEnabled) root.classList.add('is-pressed');
      const timeout = window.setTimeout(() => {
        wave.remove();
        clickTimersRef.current.delete(timeout);
        root.classList.remove('is-pressed');
      }, 620);
      clickTimersRef.current.add(timeout);
    };
    const restore = (event) => {
      if (event.pointerType !== 'touch') track(event);
    };

    const unsubscribeMove = cursorEnabled ? subscribeCursorRuntimeEvent('move', track) : () => {};
    const unsubscribeEnter = cursorEnabled ? subscribeCursorRuntimeEvent('enter', restore) : () => {};
    const unsubscribeLeave = cursorEnabled ? subscribeCursorRuntimeEvent('leave', leave) : () => {};
    const unsubscribeHover = cursorEnabled ? subscribeCursorRuntimeEvent('over', hover) : () => {};
    const unsubscribeOverTarget = cursorEnabled ? subscribeCursorRuntimeEvent('over', track) : () => {};
    const unsubscribeDown = clickEnabled ? subscribeCursorRuntimeEvent('down', press) : () => {};
    const unsubscribeVisibility = cursorEnabled ? subscribeCursorRuntimeEvent('visibility', () => { if (document.hidden) leave(); }) : () => {};
    if (cursorEnabled && initialPointer?.inside) track({ ...initialPointer, pointerType: 'mouse', target: document.elementFromPoint(initialPointer.x, initialPointer.y) });

    return () => {
      documentRoot.classList.remove('has-eclipse-cursor');
      unsubscribeMove();
      unsubscribeEnter();
      unsubscribeLeave();
      unsubscribeHover();
      unsubscribeOverTarget();
      unsubscribeDown();
      unsubscribeVisibility();
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      clickTimersRef.current.forEach((timeout) => window.clearTimeout(timeout));
      clickTimersRef.current.clear();
      root.querySelectorAll('.eclipse-cursor__click-wave').forEach((wave) => wave.remove());
    };
  }, [clickEnabled, cursorEnabled]);

  if (!cursorEnabled && !clickEnabled) return null;
  return createPortal(
    <div className="eclipse-cursor" ref={rootRef} aria-hidden="true" popover="manual">
      {cursorEnabled && <span className="eclipse-cursor__position is-offscreen" ref={pointerRef}>
        <svg className="eclipse-cursor__pointer" viewBox="0 0 36 44" fill="none" focusable="false">
          <path className="eclipse-cursor__pointer-edge" d="M3 2 4.2 36 12 28.5 18.2 41.5 23.1 39.1 16.8 25.7 32.3 25.6Z" />
          <path className="eclipse-cursor__pointer-core" d="M7 8.2 7.8 27.4 12.8 22.6 18.2 34.1 20 33.2 14.5 21.7 25.7 21.6Z" />
          <path className="eclipse-cursor__pointer-glint" d="m6.4 6.8.5 16.6 4.2-4" />
          <circle className="eclipse-cursor__pointer-orbit" cx="17.5" cy="17.8" r="2.2" />
        </svg>
        <i className="eclipse-cursor__satellite eclipse-cursor__satellite--one" />
        <i className="eclipse-cursor__satellite eclipse-cursor__satellite--two" />
      </span>}
    </div>,
    document.body,
  );
}
