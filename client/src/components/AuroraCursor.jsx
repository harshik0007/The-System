import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import { useOptionalUserPreferences } from '../context/UserPreferencesContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createDefaultUserPreferences } from '../utils/userPreferences.js';
import useCursorTopLayer, { subscribeCursorRuntimeEvent } from '../hooks/useCursorTopLayer.js';

const HOVERABLE = 'a[href], button:not(:disabled), [role="button"], [role="tab"], [data-cursor-hover]';
const NATIVE_POINTER_TARGET = '[data-native-cursor]';

export default function AuroraCursor({ initialPointer = null }) {
  const preferenceContext = useOptionalUserPreferences();
  const { loading: authLoading } = useAuth();
  const preferences = preferenceContext?.preferences || createDefaultUserPreferences();
  const reducedMotion = useReducedMotion();
  const cursorRef = useRef(null);
  const positionerRef = useRef(null);
  const frameRef = useRef(0);
  const pendingPositionRef = useRef(null);
  const clickTimeoutsRef = useRef(new Set());
  const [pointerSupported, setPointerSupported] = useState(false);
  const preferencesReady = preferenceContext?.ready ?? true;
  const cursorEnabled = pointerSupported && preferencesReady && !authLoading && preferences.appearance.voidShardCursor && !reducedMotion;
  const rippleEnabled = pointerSupported && preferencesReady && !authLoading && preferences.appearance.clickRipple && !reducedMotion && !preferences.appearance.reduceDecorativeEffects;
  if (initialPointer?.inside) pendingPositionRef.current = initialPointer;

  useCursorTopLayer(cursorRef, cursorEnabled || rippleEnabled);

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 769px)');
    const update = () => setPointerSupported(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('has-aurora-cursor', cursorEnabled);
    const cursor = cursorRef.current;
    if (!cursor || (!cursorEnabled && !rippleEnabled)) return () => root.classList.remove('has-aurora-cursor');

    const renderPosition = () => {
      frameRef.current = 0;
      const position = pendingPositionRef.current;
      if (!position || !cursorEnabled) return;
      if (positionerRef.current) positionerRef.current.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-2px, -2px)`;
    };
    const track = (event) => {
      if (event.pointerType === 'touch') return;
      pendingPositionRef.current = { x: event.clientX, y: event.clientY };
      const nativeTarget = Boolean(event.target instanceof Element && event.target.closest(NATIVE_POINTER_TARGET));
      cursor.classList.toggle('is-native-mode', nativeTarget);
      positionerRef.current?.classList.toggle('is-offscreen', nativeTarget);
      if (!frameRef.current) frameRef.current = window.requestAnimationFrame(renderPosition);
    };
    const leave = () => positionerRef.current?.classList.add('is-offscreen');
    const over = (event) => cursor.classList.toggle('is-hovering', Boolean(event.target instanceof Element && event.target.closest(HOVERABLE)));
    const press = (event) => {
      if (!rippleEnabled || event.pointerType === 'touch') return;
      const ripple = document.createElement('span');
      ripple.className = 'aurora-click-wave';
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;
      ripple.setAttribute('aria-hidden', 'true');
      cursor.append(ripple);
      const timeout = window.setTimeout(() => {
        ripple.remove();
        clickTimeoutsRef.current.delete(timeout);
      }, 760);
      clickTimeoutsRef.current.add(timeout);
    };

    const unsubscribeMove = cursorEnabled ? subscribeCursorRuntimeEvent('move', track) : () => {};
    const unsubscribeEnter = cursorEnabled ? subscribeCursorRuntimeEvent('enter', track) : () => {};
    const unsubscribeLeave = cursorEnabled ? subscribeCursorRuntimeEvent('leave', leave) : () => {};
    const unsubscribeOver = cursorEnabled ? subscribeCursorRuntimeEvent('over', over) : () => {};
    const unsubscribeDown = rippleEnabled ? subscribeCursorRuntimeEvent('down', press) : () => {};
    const unsubscribeVisibility = cursorEnabled ? subscribeCursorRuntimeEvent('visibility', () => { if (document.hidden) leave(); }) : () => {};
    if (cursorEnabled && initialPointer?.inside) track({ ...initialPointer, pointerType: 'mouse', target: document.elementFromPoint(initialPointer.x, initialPointer.y) });

    return () => {
      root.classList.remove('has-aurora-cursor');
      unsubscribeMove();
      unsubscribeEnter();
      unsubscribeLeave();
      unsubscribeOver();
      unsubscribeDown();
      unsubscribeVisibility();
      window.cancelAnimationFrame(frameRef.current);
      clickTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      clickTimeoutsRef.current.clear();
      cursor.querySelectorAll('.aurora-click-wave').forEach((wave) => wave.remove());
    };
  }, [cursorEnabled, rippleEnabled]);

  if (!cursorEnabled && !rippleEnabled) return null;
  return createPortal(
    <div className="aurora-cursor" ref={cursorRef} aria-hidden="true" popover="manual">
      {cursorEnabled && <span className="aurora-cursor__sprite is-offscreen" ref={positionerRef}>
        <svg className="aurora-cursor__pointer" viewBox="0 0 34 42" fill="none">
          <path className="aurora-cursor__edge" d="M2 1.5 2.4 35 10.1 27.4 15.9 40.2 21.2 37.8 15.2 24.4 30.3 24.8Z" />
          <path className="aurora-cursor__inner" d="m5.2 6.3.3 21.1 5.8-5.6 5.9 13.1 1.8-.8-5.8-13.2 11.2.3Z" />
          <path className="aurora-cursor__glint" d="m4.2 5.2.2 17.7 4.4-4.2" />
          <path className="aurora-cursor__core" d="m12.4 12.5 3.1-3.1 3.1 3.1-3.1 3.1z" />
        </svg>
        <i className="aurora-cursor__shard aurora-cursor__shard--one" /><i className="aurora-cursor__shard aurora-cursor__shard--two" />
      </span>}
    </div>,
    document.body,
  );
}
