import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const INTERACTIVE_SELECTOR = 'a[href], button:not(:disabled), [role="button"], [role="tab"], [data-cursor-hover]';
const TEXT_ENTRY_SELECTOR = 'input:not([type]), input:is([type="text"], [type="email"], [type="password"], [type="search"], [type="url"], [type="tel"], [type="number"]), textarea, [contenteditable="true"], [role="textbox"]';
const EXCLUDED_TEXT_SELECTOR = 'button, [role="button"], [role="tab"], input, textarea, select, [contenteditable="true"], a[href]';

function closestElement(target, selector) {
  return target instanceof Element ? target.closest(selector) : null;
}

function isTextEntry(target) {
  return Boolean(closestElement(target, TEXT_ENTRY_SELECTOR));
}

function isTextSelectable(target) {
  return target instanceof Element && !closestElement(target, EXCLUDED_TEXT_SELECTOR);
}

export default function VoidShardCursor() {
  const cursorRef = useRef(null);
  const mainRef = useRef(null);
  const fragmentARef = useRef(null);
  const fragmentBRef = useRef(null);
  const rippleRef = useRef(null);
  const frameRef = useRef(0);
  const focusFrameRef = useRef(0);
  const pressTimerRef = useRef(0);
  const rippleTimerRef = useRef(0);
  const motionRef = useRef({
    x: 0, y: 0, targetX: 0, targetY: 0,
    fragmentAX: 0, fragmentAY: 0, fragmentBX: 0, fragmentBY: 0,
    velocityX: 0, velocityY: 0, nextVelocityX: 0, nextVelocityY: 0,
    scrollVelocity: 0, nextScrollVelocity: 0, lastScrollY: 0, lastScrollTime: 0,
    lastX: 0, lastY: 0, lastTime: 0, initialized: false,
    hovering: false, native: false, selecting: false, selectedText: false,
  });
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 769px)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const root = document.documentElement;

    const syncSupport = () => {
      const canShowCursor = pointerQuery.matches && !motionQuery.matches;
      setEnabled(canShowCursor);
      root.classList.toggle('has-void-shard-cursor', canShowCursor);
      if (!canShowCursor) root.removeAttribute('data-void-native-cursor');
    };

    syncSupport();
    pointerQuery.addEventListener('change', syncSupport);
    motionQuery.addEventListener('change', syncSupport);

    return () => {
      pointerQuery.removeEventListener('change', syncSupport);
      motionQuery.removeEventListener('change', syncSupport);
      root.classList.remove('has-void-shard-cursor');
      root.removeAttribute('data-void-native-cursor');
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const root = cursorRef.current;
    const main = mainRef.current;
    const fragmentA = fragmentARef.current;
    const fragmentB = fragmentBRef.current;
    const ripple = rippleRef.current;
    const motion = motionRef.current;
    if (!root || !main || !fragmentA || !fragmentB || !ripple) return undefined;

    const syncNativeMode = () => {
      // Keep the custom pointer visible while selecting regular page text.
      // Use the native cursor only while the pointer is over an editable field.
      const nativeMode = motion.native;
      root.classList.toggle('is-native', nativeMode);
      if (nativeMode) document.documentElement.setAttribute('data-void-native-cursor', 'true');
      else document.documentElement.removeAttribute('data-void-native-cursor');
      if (nativeMode && motion.hovering) {
        motion.hovering = false;
        root.classList.remove('is-hovering');
      }
    };

    const syncHover = (target) => {
      if (motion.native || motion.selecting || motion.selectedText) return;
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
      if (event.pointerType === 'touch') return;
      const now = performance.now();
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
      motion.native = isTextEntry(event.target);
      root.classList.remove('is-offscreen');
      syncNativeMode();
      syncHover(event.target);
      queueFrame();
    };

    const handleScroll = () => {
      const now = performance.now();
      const currentScrollY = window.scrollY;
      const elapsed = Math.max(16, now - (motion.lastScrollTime || now));
      motion.nextScrollVelocity = Math.max(-1, Math.min(1, (currentScrollY - motion.lastScrollY) / elapsed * 0.5));
      motion.lastScrollY = currentScrollY;
      motion.lastScrollTime = now;
      queueFrame();
    };

    const handlePointerDown = (event) => {
      if (event.pointerType === 'touch') return;
      motion.native = isTextEntry(event.target);
      motion.selecting = isTextSelectable(event.target);
      syncNativeMode();

      if (!motion.native && !motion.selecting) {
        root.classList.add('is-pressed');
        window.clearTimeout(pressTimerRef.current);
        pressTimerRef.current = window.setTimeout(() => root.classList.remove('is-pressed'), 150);
      }

      root.classList.add('is-rippling');
      window.clearTimeout(rippleTimerRef.current);
      rippleTimerRef.current = window.setTimeout(() => {
        root.classList.remove('is-rippling');
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
      motion.selecting = false;
      motion.selectedText = Boolean(window.getSelection()?.toString());
      syncNativeMode();
      if (!motion.native && !motion.selectedText) {
        syncHover(document.elementFromPoint(motion.targetX, motion.targetY));
      }
    };

    const handlePointerOut = (event) => {
      if (event.relatedTarget !== null) return;
      suspendCursor();
    };

    const suspendCursor = () => {
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
      pressTimerRef.current = 0;
      rippleTimerRef.current = 0;
      root.classList.remove('is-rippling');
    };

    const handleVisibilityChange = () => {
      if (document.hidden) suspendCursor();
    };

    const handlePointerCancel = () => suspendCursor();

    const handleSelectionChange = () => {
      motion.selectedText = Boolean(window.getSelection()?.toString());
      syncNativeMode();
      if (!motion.selectedText) syncHover(document.elementFromPoint(motion.targetX, motion.targetY));
    };

    const handleFocusChange = () => {
      window.cancelAnimationFrame(focusFrameRef.current);
      focusFrameRef.current = window.requestAnimationFrame(() => {
        focusFrameRef.current = 0;
        const target = document.elementFromPoint(motion.targetX, motion.targetY);
        motion.native = isTextEntry(target);
        syncNativeMode();
        if (!motion.native && !motion.selecting && !motion.selectedText) syncHover(target);
      });
    };

    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('pointerdown', handlePointerDown, { passive: true });
    document.addEventListener('pointerup', handlePointerUp, { passive: true });
    document.addEventListener('pointercancel', handlePointerCancel, { passive: true });
    document.addEventListener('pointerout', handlePointerOut, { passive: true });
    window.addEventListener('blur', suspendCursor);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', handleFocusChange);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
      document.removeEventListener('pointerout', handlePointerOut);
      window.removeEventListener('blur', suspendCursor);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('focusout', handleFocusChange);
      window.cancelAnimationFrame(frameRef.current);
      window.cancelAnimationFrame(focusFrameRef.current);
      window.clearTimeout(pressTimerRef.current);
      window.clearTimeout(rippleTimerRef.current);
      motion.initialized = false;
      if (typeof ripple.getAnimations === 'function') {
        ripple.getAnimations().forEach((animation) => animation.cancel());
      }
      ripple.classList.remove('is-active');
      root.className = 'void-shard-cursor is-offscreen';
    };
  }, [enabled]);

  if (!enabled) return null;

  return createPortal((
    <div className="void-shard-cursor is-offscreen" ref={cursorRef} aria-hidden="true">
      <span className="void-shard-position void-shard-position--main" ref={mainRef}>
        <svg className="void-shard-art void-shard-art--pointer" viewBox="0 0 34 42" fill="none">
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
        </svg>
      </span>
      <span className="void-shard-position void-shard-position--fragment-a" ref={fragmentARef}>
        <svg className="void-shard-art void-shard-art--fragment-a" viewBox="0 0 20 22" fill="none">
          <path d="m2 3 15 2-4 6 5 4-12 5 2-8Z" />
        </svg>
      </span>
      <span className="void-shard-position void-shard-position--fragment-b" ref={fragmentBRef}>
        <svg className="void-shard-art void-shard-art--fragment-b" viewBox="0 0 18 20" fill="none">
          <path d="m3 1 12 7-4 4 4 5-11 2 2-9Z" />
        </svg>
      </span>
      <svg className="void-shard-ripple" ref={rippleRef} viewBox="0 0 42 42" fill="none">
        <path d="m12 2 27 16-10 21L2 26Z" />
      </svg>
    </div>
  ), document.body);
}
