import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import { useOptionalUserPreferences } from '../context/UserPreferencesContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createDefaultUserPreferences } from '../utils/userPreferences.js';
import useCursorTopLayer, { isViewportPoint, subscribeCursorRuntimeEvent } from '../hooks/useCursorTopLayer.js';

const INTERACTIVE_SELECTOR = 'a[href], button:not(:disabled), [role="button"], [role="tab"], [data-cursor-hover]';
const EXCLUDED_TEXT_SELECTOR = 'button, [role="button"], [role="tab"], input, textarea, select, [contenteditable="true"], a[href]';
const NATIVE_POINTER_SELECTOR = '[data-native-cursor]';

function closestElement(target, selector) {
  return target instanceof Element ? target.closest(selector) : null;
}

function isTextSelectable(target) {
  return target instanceof Element && !closestElement(target, EXCLUDED_TEXT_SELECTOR);
}

export default function VoidShardCursor({ initialPointer = null }) {
  const preferenceContext = useOptionalUserPreferences();
  const { loading: authLoading } = useAuth();
  const preferences = preferenceContext?.preferences || createDefaultUserPreferences();
  const reducedMotion = useReducedMotion();
  const cursorRef = useRef(null);
  const mainRef = useRef(null);
  const fragmentARef = useRef(null);
  const fragmentBRef = useRef(null);
  const rippleRef = useRef(null);
  const impactRef = useRef(null);
  const frameRef = useRef(0);
  const pointerPositionRef = useRef({ x: 0, y: 0, inside: false });
  const pressTimerRef = useRef(0);
  const rippleTimerRef = useRef(0);
  const impactTimerRef = useRef(0);
  const motionRef = useRef({
    x: 0, y: 0, targetX: 0, targetY: 0,
    fragmentAX: 0, fragmentAY: 0, fragmentBX: 0, fragmentBY: 0,
    velocityX: 0, velocityY: 0, nextVelocityX: 0, nextVelocityY: 0,
    scrollVelocity: 0, nextScrollVelocity: 0, lastScrollY: 0, lastScrollTime: 0,
    lastX: 0, lastY: 0, lastTime: 0, initialized: false,
    hovering: false, selecting: false, selectedText: false,
  });
  const [pointerSupported, setPointerSupported] = useState(false);
  const systemRequestsReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionAllowed = !reducedMotion && !systemRequestsReducedMotion;
  const obsidianTheme = preferences.appearance.theme === 'obsidian';
  const preferencesReady = preferenceContext?.ready ?? true;
  const cursorEnabled = pointerSupported && preferencesReady && !authLoading && preferences.appearance.voidShardCursor && motionAllowed;
  const rippleEnabled = pointerSupported && preferencesReady && !authLoading && preferences.appearance.clickRipple && motionAllowed;
  const clickEffectEnabled = rippleEnabled && (!obsidianTheme || !preferences.appearance.reduceDecorativeEffects);
  const active = cursorEnabled || clickEffectEnabled;
  if (initialPointer) pointerPositionRef.current = initialPointer;

  useCursorTopLayer(cursorRef, active);

  useEffect(() => {
    const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 769px)');
    const syncSupport = () => {
      setPointerSupported(pointerQuery.matches);
    };

    syncSupport();
    pointerQuery.addEventListener('change', syncSupport);

    return () => {
      pointerQuery.removeEventListener('change', syncSupport);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('has-void-shard-cursor', cursorEnabled);
    return () => document.documentElement.classList.remove('has-void-shard-cursor');
  }, [cursorEnabled]);

  useEffect(() => {
    if (!active) return undefined;

    const root = cursorRef.current;
    const main = mainRef.current;
    const fragmentA = fragmentARef.current;
    const fragmentB = fragmentBRef.current;
    const ripple = rippleRef.current;
    const impact = impactRef.current;
    const motion = motionRef.current;
    if (!root || (!obsidianTheme && clickEffectEnabled && !ripple) || (obsidianTheme && clickEffectEnabled && !impact) || (cursorEnabled && (!main || !fragmentA || !fragmentB))) return undefined;

    const syncHover = (target) => {
      if (!cursorEnabled) return;
      const nativeTarget = Boolean(closestElement(target, NATIVE_POINTER_SELECTOR));
      root.classList.toggle('is-native-mode', nativeTarget);
      if (nativeTarget) {
        if (motion.hovering) {
          motion.hovering = false;
          root.classList.remove('is-hovering');
        }
        return;
      }
      const hoverable = Boolean(closestElement(target, INTERACTIVE_SELECTOR));
      if (hoverable !== motion.hovering) {
        motion.hovering = hoverable;
        root.classList.toggle('is-hovering', hoverable);
        queueFrame();
      }
    };

    const renderFrame = () => {
      const ease = 0.78;
      motion.x += (motion.targetX - motion.x) * ease;
      motion.y += (motion.targetY - motion.y) * ease;
      motion.velocityX += (motion.nextVelocityX - motion.velocityX) * 0.36;
      motion.velocityY += (motion.nextVelocityY - motion.velocityY) * 0.36;
      motion.scrollVelocity += (motion.nextScrollVelocity - motion.scrollVelocity) * 0.28;
      motion.nextVelocityX *= 0.7;
      motion.nextVelocityY *= 0.7;
      motion.nextScrollVelocity *= 0.68;

      const open = motion.hovering ? 1 : 0;
      const trailX = -motion.velocityX * 9;
      const trailY = -motion.velocityY * 9;
      const aX = motion.x - 13 + trailX - open * 7;
      const aY = motion.y + 10 + trailY - open * 5;
      const bX = motion.x + 30 + trailX + open * 10;
      const bY = motion.y + 28 + trailY + open * 10;
      if (!motion.initialized) {
        motion.fragmentAX = aX;
        motion.fragmentAY = aY;
        motion.fragmentBX = bX;
        motion.fragmentBY = bY;
        motion.initialized = true;
      }
      motion.fragmentAX += (aX - motion.fragmentAX) * 0.38;
      motion.fragmentAY += (aY - motion.fragmentAY) * 0.38;
      motion.fragmentBX += (bX - motion.fragmentBX) * 0.3;
      motion.fragmentBY += (bY - motion.fragmentBY) * 0.3;

      const stretchX = 1 + Math.min(0.055, Math.abs(motion.velocityX) * 0.045);
      const stretchY = 1 + Math.min(0.055, Math.abs(motion.velocityY) * 0.035 + Math.abs(motion.scrollVelocity) * 0.018);
      const rotation = Math.max(-5, Math.min(5, motion.velocityX * 2.2));
      main.style.transform = `translate3d(${motion.targetX}px, ${motion.targetY}px, 0) rotate(${rotation}deg) scale(${stretchX}, ${stretchY})`;
      fragmentA.style.transform = `translate3d(${motion.fragmentAX}px, ${motion.fragmentAY}px, 0)`;
      fragmentB.style.transform = `translate3d(${motion.fragmentBX}px, ${motion.fragmentBY}px, 0)`;

      const stillFollowing =
        Math.abs(motion.targetX - motion.x) > 0.08 ||
        Math.abs(motion.targetY - motion.y) > 0.08 ||
        Math.abs(motion.velocityX) > 0.012 ||
        Math.abs(motion.velocityY) > 0.012 ||
        Math.abs(motion.scrollVelocity) > 0.012 ||
        Math.abs(aX - motion.fragmentAX) > 0.08 ||
        Math.abs(aY - motion.fragmentAY) > 0.08 ||
        Math.abs(bX - motion.fragmentBX) > 0.08 ||
        Math.abs(bY - motion.fragmentBY) > 0.08;

      if (stillFollowing) frameRef.current = window.requestAnimationFrame(renderFrame);
      else frameRef.current = 0;
    };

    function queueFrame() {
      if (!frameRef.current) frameRef.current = window.requestAnimationFrame(renderFrame);
    }

    const handlePointerMove = (event) => {
      if (!cursorEnabled) return;
      if (event.pointerType === 'touch' || !isViewportPoint(event.clientX, event.clientY)) return;
      const now = performance.now();
      pointerPositionRef.current = { x: event.clientX, y: event.clientY, inside: true };
      if (!motion.initialized) {
        motion.x = event.clientX;
        motion.y = event.clientY;
        motion.targetX = event.clientX;
        motion.targetY = event.clientY;
        motion.fragmentAX = event.clientX - 13;
        motion.fragmentAY = event.clientY + 10;
        motion.fragmentBX = event.clientX + 30;
        motion.fragmentBY = event.clientY + 28;
        motion.velocityX = 0;
        motion.velocityY = 0;
        motion.nextVelocityX = 0;
        motion.nextVelocityY = 0;
        motion.lastX = event.clientX;
        motion.lastY = event.clientY;
        motion.initialized = true;
        main.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
        fragmentA.style.transform = `translate3d(${motion.fragmentAX}px, ${motion.fragmentAY}px, 0)`;
        fragmentB.style.transform = `translate3d(${motion.fragmentBX}px, ${motion.fragmentBY}px, 0)`;
      }
      const elapsed = Math.max(8, now - (motion.lastTime || now));
      motion.nextVelocityX = Math.max(-1, Math.min(1, (event.clientX - motion.lastX) / elapsed * 2.2));
      motion.nextVelocityY = Math.max(-1, Math.min(1, (event.clientY - motion.lastY) / elapsed * 2.2));
      motion.lastX = event.clientX;
      motion.lastY = event.clientY;
      motion.lastTime = now;
      motion.targetX = event.clientX;
      motion.targetY = event.clientY;
      root.classList.remove('is-offscreen');
      syncHover(event.target);
      queueFrame();
    };

    const handleScroll = (event) => {
      if (!cursorEnabled) return;
      const now = performance.now();
      const scrollSource = event.target === document ? document.scrollingElement : event.target;
      const currentScrollY = Number(scrollSource?.scrollTop ?? window.scrollY);
      const elapsed = Math.max(16, now - (motion.lastScrollTime || now));
      motion.nextScrollVelocity = Math.max(-1, Math.min(1, (currentScrollY - motion.lastScrollY) / elapsed * 0.5));
      motion.lastScrollY = currentScrollY;
      motion.lastScrollTime = now;
      queueFrame();
    };

    const handlePointerDown = (event) => {
      if (event.pointerType === 'touch') return;
      if (cursorEnabled) motion.selecting = isTextSelectable(event.target);

      if (cursorEnabled && !motion.selecting) {
        root.classList.add('is-pressed');
        window.clearTimeout(pressTimerRef.current);
        pressTimerRef.current = window.setTimeout(() => root.classList.remove('is-pressed'), 150);
      }

      if (!clickEffectEnabled) return;
      if (!cursorEnabled) root.classList.remove('is-offscreen');

      if (obsidianTheme && impact) {
        impact.style.setProperty('--impact-x', `${event.clientX - 41}px`);
        impact.style.setProperty('--impact-y', `${event.clientY - 41}px`);
        impact.classList.remove('is-active');
        void impact.offsetWidth;
        impact.classList.add('is-active');
        window.clearTimeout(impactTimerRef.current);
        impactTimerRef.current = window.setTimeout(() => {
          impact.classList.remove('is-active');
          if (!cursorEnabled) root.classList.add('is-offscreen');
          impactTimerRef.current = 0;
        }, 680);
        return;
      }

      root.classList.add('is-rippling');
      window.clearTimeout(rippleTimerRef.current);
      rippleTimerRef.current = window.setTimeout(() => {
        root.classList.remove('is-rippling');
        if (!cursorEnabled) root.classList.add('is-offscreen');
        rippleTimerRef.current = 0;
      }, 360);

      ripple.style.left = `${event.clientX - 20}px`;
      ripple.style.top = `${event.clientY - 20}px`;
      if (typeof ripple.animate === 'function') {
        ripple.getAnimations().forEach((animation) => animation.cancel());
        ripple.animate(
          [
            { opacity: 0.5, transform: 'scale(.18) rotate(0deg)' },
            { opacity: 0, transform: 'scale(1.3) rotate(18deg)' },
          ],
          { duration: 330, easing: 'cubic-bezier(.2,.7,.2,1)' },
        );
      } else {
        ripple.classList.remove('is-active');
        void ripple.offsetHeight;
        ripple.classList.add('is-active');
      }
    };

    const handlePointerUp = () => {
      if (!cursorEnabled) return;
      motion.selecting = false;
      motion.selectedText = Boolean(window.getSelection()?.toString());
      if (!motion.selectedText) {
        syncHover(document.elementFromPoint(motion.targetX, motion.targetY));
      }
    };

    const handleWindowPointerEnter = (event) => {
      if (!cursorEnabled || event.pointerType === 'touch') return;
      if (!isViewportPoint(event.clientX, event.clientY)) return;
      handlePointerMove(event);
    };

    const handleWindowPointerLeave = () => {
      if (!cursorEnabled) return;
      suspendCursor();
    };

    const suspendCursor = () => {
      pointerPositionRef.current.inside = false;
      root.classList.add('is-offscreen');
      root.classList.remove('is-hovering', 'is-pressed');
      motion.hovering = false;
      motion.initialized = false;
      motion.lastTime = 0;
      motion.lastX = 0;
      motion.lastY = 0;
      motion.velocityX = 0;
      motion.velocityY = 0;
      motion.nextVelocityX = 0;
      motion.nextVelocityY = 0;
      motion.nextScrollVelocity = 0;
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      window.clearTimeout(pressTimerRef.current);
      window.clearTimeout(rippleTimerRef.current);
      window.clearTimeout(impactTimerRef.current);
      pressTimerRef.current = 0;
      rippleTimerRef.current = 0;
      impactTimerRef.current = 0;
      root.classList.remove('is-rippling');
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      } else if (motion.initialized) {
        queueFrame();
      }
    };

    const handlePointerCancel = (event) => {
      if (!cursorEnabled || event.pointerType === 'touch') return;
      motion.selecting = false;
      root.classList.remove('is-pressed');
      if (isViewportPoint(event.clientX, event.clientY)) handlePointerMove(event);
    };

    const handleSelectionChange = () => {
      if (!cursorEnabled) return;
      motion.selectedText = Boolean(window.getSelection()?.toString());
      if (!motion.selectedText) syncHover(document.elementFromPoint(motion.targetX, motion.targetY));
    };

    const unsubscribeMove = cursorEnabled ? subscribeCursorRuntimeEvent('move', handlePointerMove) : () => {};
    const unsubscribeScroll = cursorEnabled ? subscribeCursorRuntimeEvent('scroll', handleScroll) : () => {};
    const unsubscribeEnter = cursorEnabled ? subscribeCursorRuntimeEvent('enter', handleWindowPointerEnter) : () => {};
    const unsubscribeLeave = cursorEnabled ? subscribeCursorRuntimeEvent('leave', handleWindowPointerLeave) : () => {};
    const unsubscribeDown = subscribeCursorRuntimeEvent('down', handlePointerDown);
    const unsubscribeUp = cursorEnabled ? subscribeCursorRuntimeEvent('up', handlePointerUp) : () => {};
    const unsubscribeCancel = cursorEnabled ? subscribeCursorRuntimeEvent('cancel', handlePointerCancel) : () => {};
    const unsubscribeVisibility = cursorEnabled ? subscribeCursorRuntimeEvent('visibility', handleVisibilityChange) : () => {};
    if (cursorEnabled) document.addEventListener('selectionchange', handleSelectionChange);

    const lastPointer = pointerPositionRef.current;
    if (cursorEnabled && lastPointer.inside && isViewportPoint(lastPointer.x, lastPointer.y)) {
      handlePointerMove({
        clientX: lastPointer.x,
        clientY: lastPointer.y,
        pointerType: 'mouse',
        target: document.elementFromPoint(lastPointer.x, lastPointer.y),
      });
    }

    return () => {
      unsubscribeMove();
      unsubscribeScroll();
      unsubscribeEnter();
      unsubscribeLeave();
      unsubscribeDown();
      unsubscribeUp();
      unsubscribeCancel();
      unsubscribeVisibility();
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.cancelAnimationFrame(frameRef.current);
      window.clearTimeout(pressTimerRef.current);
      window.clearTimeout(rippleTimerRef.current);
      window.clearTimeout(impactTimerRef.current);
      motion.initialized = false;
      if (ripple && typeof ripple.getAnimations === 'function') {
        ripple.getAnimations().forEach((animation) => animation.cancel());
      }
      ripple?.classList.remove('is-active');
      impact?.classList.remove('is-active');
      root.className = 'void-shard-cursor is-offscreen';
    };
  }, [active, clickEffectEnabled, cursorEnabled, obsidianTheme]);

  if (!active) return null;

  return createPortal((
    <div className={`void-shard-cursor is-offscreen${cursorEnabled ? '' : ' is-ripple-only'}`} popover="manual" ref={cursorRef} aria-hidden="true">
      <span className="void-shard-position void-shard-position--main" ref={mainRef}>
        {obsidianTheme ? <svg className="obsidian-cursor-art" viewBox="0 0 34 42" fill="none">
          <path className="obsidian-cursor-edge" d="M1 1 2 36 10 27 16 41 22 38 16 24 32 25Z" />
          <path className="obsidian-cursor-inner" d="M4 6 5 30 11 23 17 37 19 36 13 21 27 22Z" />
          <path className="obsidian-cursor-core" d="m11 16 3-3 3 3-3 3z" />
        </svg> : <svg className="void-shard-art void-shard-art--pointer" viewBox="0 0 34 42" fill="none">
          <defs>
            <linearGradient id="void-shard-pointer-fill" x1="2" y1="1" x2="28" y2="39" gradientUnits="userSpaceOnUse">
              <stop stopColor="#15385b" stopOpacity=".96" />
              <stop offset=".55" stopColor="#081626" stopOpacity=".98" />
              <stop offset="1" stopColor="#123653" stopOpacity=".96" />
            </linearGradient>
            <linearGradient id="void-shard-pointer-light" x1="2" y1="3" x2="13" y2="25" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8ceaff" stopOpacity=".72" />
              <stop offset="1" stopColor="#4bbcff" stopOpacity=".08" />
            </linearGradient>
          </defs>
          <path className="void-shard-pointer-fill" d="M0 0 0.45 34.5 9.3 25.1 15.1 40.3 20.7 38 14.8 23.7 29.8 24.2Z" />
          <path className="void-shard-pointer-edge" d="M0 0 0.45 34.5 9.3 25.1 15.1 40.3 20.7 38 14.8 23.7 29.8 24.2Z" />
          <path className="void-shard-pointer-light" d="M2.5 4.5 2.85 28.4 8.7 22.1 12.4 22.8Z" />
          <path className="void-shard-pointer-glint" d="m2.2 5.8.3 23.1 5.2-5.6" />
        </svg>}
        {obsidianTheme && <>
          <i className="obsidian-cursor-spark obsidian-cursor-spark--one" />
          <i className="obsidian-cursor-spark obsidian-cursor-spark--two" />
          <i className="obsidian-cursor-spark obsidian-cursor-spark--three" />
        </>}
      </span>
      <span className="void-shard-position void-shard-position--fragment-a" ref={fragmentARef}>
        {obsidianTheme ? <svg className="void-shard-art obsidian-cursor-art" viewBox="0 0 20 22" fill="none"><path className="obsidian-cursor-fragment" d="m2 3 15 2-4 6 5 4-12 5 2-8Z" /></svg> : <svg className="void-shard-art void-shard-art--fragment-a" viewBox="0 0 20 22" fill="none">
          <path d="m2 3 15 2-4 6 5 4-12 5 2-8Z" />
        </svg>}
      </span>
      <span className="void-shard-position void-shard-position--fragment-b" ref={fragmentBRef}>
        {obsidianTheme ? <svg className="void-shard-art obsidian-cursor-art" viewBox="0 0 18 20" fill="none"><path className="obsidian-cursor-fragment obsidian-cursor-fragment--b" d="m3 1 12 7-4 4 4 5-11 2 2-9Z" /></svg> : <svg className="void-shard-art void-shard-art--fragment-b" viewBox="0 0 18 20" fill="none">
          <path d="m3 1 12 7-4 4 4 5-11 2 2-9Z" />
        </svg>}
      </span>
      {obsidianTheme && clickEffectEnabled && <div ref={impactRef} className="obsidian-click-impact" aria-hidden="true">
        {[32, 48, 64].map((size) => <span className="obsidian-impact-ring" key={`ring-${size}`} style={{ '--ring-size': `${size}px` }} />)}
        {[-150, -105, -60, -15, 30, 75, 120, 165].map((angle) => <span className="obsidian-impact-fragment" key={`fragment-${angle}`} style={{ '--fragment-angle': `${angle}deg` }} />)}
        {[-135, -90, -45, 0, 45, 90, 135, 180].map((angle) => <span className="obsidian-impact-particle" key={`particle-${angle}`} style={{ '--fragment-angle': `${angle}deg` }} />)}
      </div>}
      {!obsidianTheme && clickEffectEnabled && <svg className="void-shard-ripple" ref={rippleRef} viewBox="0 0 42 42" fill="none">
        <path d="m12 2 27 16-10 21L2 26Z" />
      </svg>}
    </div>
  ), document.body);
}
