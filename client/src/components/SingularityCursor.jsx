import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import useCursorTopLayer, { isViewportPoint, subscribeCursorRuntimeEvent } from '../hooks/useCursorTopLayer.js';

const FINE_POINTER = '(hover: hover) and (pointer: fine)';
const HOVER_TARGET = 'a[href], button:not(:disabled), input[type="button"], input[type="submit"], input[type="reset"], [role="button"]:not([aria-disabled="true"]), [role="tab"], [data-clickable="true"]';
const NATIVE_POINTER_TARGET = '[data-native-cursor]';
const MAX_TAIL_SAMPLES = 20;
const MAX_TAIL_LENGTH = 138;

function closest(target, selector) {
  return target instanceof Element ? target.closest(selector) : null;
}

function getTailPoints(samples, currentX, currentY, length) {
  if (samples.length < 2 || length <= 0) return [{ x: 0, y: 0 }];
  const newestFirst = [{ x: currentX, y: currentY }, ...samples.slice().reverse()];
  const selected = [newestFirst[0]];
  let distance = 0;
  for (let index = 1; index < newestFirst.length; index += 1) {
    const newer = newestFirst[index - 1];
    const older = newestFirst[index];
    const segment = Math.hypot(newer.x - older.x, newer.y - older.y);
    if (segment <= 0.1) continue;
    if (distance + segment >= length) {
      const remaining = length - distance;
      const ratio = remaining / segment;
      selected.push({ x: newer.x + (older.x - newer.x) * ratio, y: newer.y + (older.y - newer.y) * ratio });
      break;
    }
    selected.push(older);
    distance += segment;
  }
  return selected.reverse().map((point) => ({ x: point.x - currentX, y: point.y - currentY }));
}

function smoothPath(points) {
  if (points.length < 2) return '';
  const point = (index) => points[Math.min(points.length - 1, Math.max(0, index))];
  const format = (value) => value.toFixed(2);
  let path = `M ${format(points[0].x)} ${format(points[0].y)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const before = point(index - 1);
    const start = point(index);
    const end = point(index + 1);
    const after = point(index + 2);
    // Catmull-Rom to cubic Bezier keeps pointer turns connected without sharp joins.
    const control1 = { x: start.x + (end.x - before.x) / 6, y: start.y + (end.y - before.y) / 6 };
    const control2 = { x: end.x - (after.x - start.x) / 6, y: end.y - (after.y - start.y) / 6 };
    path += ` C ${format(control1.x)} ${format(control1.y)} ${format(control2.x)} ${format(control2.y)} ${format(end.x)} ${format(end.y)}`;
  }
  return path;
}

export default function SingularityCursor({ enabled = true, clickEffectEnabled = true, initialPointer = null }) {
  const rootRef = useRef(null);
  const tailPathsRef = useRef([]);
  const gradientRefs = useRef([]);
  const dustRefs = useRef([]);
  const frameRef = useRef(0);
  const pressTimerRef = useRef(0);
  const reducedMotion = useReducedMotion();
  const showClickEffect = clickEffectEnabled && !reducedMotion;
  const active = enabled || showClickEffect;

  useCursorTopLayer(rootRef, active);

  useEffect(() => {
    const root = rootRef.current;
    const documentRoot = document.documentElement;
    const pointerQuery = window.matchMedia(FINE_POINTER);
    if (!root || !active || !pointerQuery.matches) {
      documentRoot.classList.remove('has-singularity-pointer');
      root?.classList.add('is-offscreen');
      return undefined;
    }

    const samples = [];
    const pointer = { x: 0, y: 0, lastX: null, lastY: null, lastMoveAt: 0, speed: 0, inside: false, selecting: false, nativeTarget: false, target: null, downX: 0, downY: 0 };
    const pathElements = tailPathsRef.current;
    const gradients = gradientRefs.current;
    const dustElements = dustRefs.current;
    const transitioning = () => document.body.classList.contains('theme-transition-overlay-active');
    const updateMode = () => {
      const showStar = enabled && pointer.inside && !pointer.nativeTarget && !transitioning();
      documentRoot.classList.toggle('has-singularity-pointer', showStar);
      root.classList.toggle('is-native-mode', pointer.nativeTarget);
      if (showStar || root.classList.contains('is-clicking')) root.classList.remove('is-offscreen');
      else root.classList.add('is-offscreen');
      if (transitioning()) root.classList.add('is-offscreen');
    };
    const setPosition = (x, y) => {
      pointer.x = x;
      pointer.y = y;
      root.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const hideTail = () => {
      pathElements.forEach((path) => path?.setAttribute('d', ''));
      dustElements.forEach((dust) => dust?.setAttribute('opacity', '0'));
      root.style.setProperty('--tail-opacity', '0');
      root.style.setProperty('--tail-length', '0');
    };
    const renderTail = (time) => {
      frameRef.current = 0;
      if (!pointer.inside || reducedMotion || !enabled) {
        hideTail();
        return;
      }
      const idle = Math.max(0, time - pointer.lastMoveAt);
      const fade = Math.max(0, 1 - idle / 480);
      if (fade <= 0.01) {
        hideTail();
        return;
      }
      const speedLength = Math.min(MAX_TAIL_LENGTH, Math.max(10, pointer.speed * 135));
      const shrink = Math.min(1, Math.max(0, 1 - idle / 360));
      const length = speedLength * shrink;
      const points = getTailPoints(samples, pointer.x, pointer.y, length);
      const path = smoothPath(points);
      pathElements.forEach((element) => element?.setAttribute('d', path));
      const tailTip = points[0] || { x: -8, y: 0 };
      gradients.forEach((gradient) => {
        gradient?.setAttribute('x1', tailTip.x.toFixed(2));
        gradient?.setAttribute('y1', tailTip.y.toFixed(2));
        gradient?.setAttribute('x2', '0');
        gradient?.setAttribute('y2', '0');
      });
      root.style.setProperty('--tail-opacity', fade.toFixed(3));
      const first = points[0] || { x: -8, y: 0 };
      const second = points[Math.floor(points.length * .42)] || first;
      dustElements[0]?.setAttribute('cx', second.x.toFixed(1));
      dustElements[0]?.setAttribute('cy', second.y.toFixed(1));
      dustElements[0]?.setAttribute('opacity', String(fade * .5));
      dustElements[1]?.setAttribute('cx', first.x.toFixed(1));
      dustElements[1]?.setAttribute('cy', first.y.toFixed(1));
      dustElements[1]?.setAttribute('opacity', String(fade * .34));
      if (idle < 560) frameRef.current = window.requestAnimationFrame(renderTail);
    };
    const scheduleTail = () => {
      if (!frameRef.current) frameRef.current = window.requestAnimationFrame(renderTail);
    };
    const move = (event) => {
      if (event.pointerType === 'touch' || !isViewportPoint(event.clientX, event.clientY)) return;
      const now = performance.now();
      if (pointer.lastX !== null && pointer.lastY !== null) {
        const distance = Math.hypot(event.clientX - pointer.lastX, event.clientY - pointer.lastY);
        const elapsed = Math.max(4, now - pointer.lastMoveAt);
        const measuredSpeed = Math.min(2.2, distance / elapsed);
        pointer.speed = pointer.speed * 0.58 + measuredSpeed * 0.42;
      }
      pointer.inside = true;
      pointer.target = event.target;
      pointer.nativeTarget = Boolean(closest(event.target, NATIVE_POINTER_TARGET));
      if (event.buttons && !closest(event.target, HOVER_TARGET)
        && Math.hypot(event.clientX - pointer.downX, event.clientY - pointer.downY) > 4) pointer.selecting = true;
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      pointer.lastMoveAt = now;
      setPosition(event.clientX, event.clientY);
      root.classList.toggle('is-hovering', Boolean(closest(event.target, HOVER_TARGET)));
      samples.push({ x: event.clientX, y: event.clientY, time: now });
      while (samples.length > MAX_TAIL_SAMPLES) samples.shift();
      const oldestAllowed = now - 620;
      while (samples.length > 2 && samples[0].time < oldestAllowed) samples.shift();
      updateMode();
      if (enabled && !reducedMotion && !pointer.nativeTarget && !pointer.selecting) scheduleTail();
      else hideTail();
    };
    const leave = () => {
      pointer.inside = false;
      pointer.selecting = false;
      pointer.lastX = null;
      pointer.lastY = null;
      samples.length = 0;
      root.classList.remove('is-hovering', 'is-pressed', 'is-clicking', 'is-native-mode');
      documentRoot.classList.remove('has-singularity-pointer');
      root.classList.add('is-offscreen');
      hideTail();
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      window.clearTimeout(pressTimerRef.current);
    };
    const down = (event) => {
      if (event.pointerType === 'touch') return;
      pointer.inside = true;
      pointer.target = event.target;
      pointer.nativeTarget = Boolean(closest(event.target, NATIVE_POINTER_TARGET));
      pointer.downX = event.clientX;
      pointer.downY = event.clientY;
      setPosition(event.clientX, event.clientY);
      if (enabled) root.classList.add('is-pressed');
      if (showClickEffect && !pointer.nativeTarget && !transitioning()) {
        root.classList.remove('is-clicking');
        void root.offsetWidth;
        root.classList.add('is-clicking');
      }
      updateMode();
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = window.setTimeout(() => root.classList.remove('is-pressed', 'is-clicking'), 380);
    };
    const up = (event) => {
      pointer.selecting = false;
      if (event?.target) {
        pointer.target = event.target;
        pointer.nativeTarget = Boolean(closest(event.target, NATIVE_POINTER_TARGET));
      }
      root.classList.remove('is-pressed');
      updateMode();
      window.clearTimeout(pressTimerRef.current);
    };
    const syncOverlay = () => updateMode();
    const syncPointerSupport = () => {
      if (!pointerQuery.matches) leave();
    };
    const observer = new MutationObserver(syncOverlay);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    pointerQuery.addEventListener('change', syncPointerSupport);
    const unsubscribeMove = subscribeCursorRuntimeEvent('move', move);
    const unsubscribeEnter = subscribeCursorRuntimeEvent('enter', move);
    const unsubscribeLeave = subscribeCursorRuntimeEvent('leave', leave);
    const unsubscribeDown = subscribeCursorRuntimeEvent('down', down);
    const unsubscribeUp = subscribeCursorRuntimeEvent('up', up);
    const unsubscribeCancel = subscribeCursorRuntimeEvent('cancel', up);
    const unsubscribeVisibility = subscribeCursorRuntimeEvent('visibility', () => { if (document.hidden) leave(); });
    if (initialPointer?.inside) move({ ...initialPointer, pointerType: 'mouse', target: document.elementFromPoint(initialPointer.x, initialPointer.y), buttons: 0 });
    return () => {
      unsubscribeMove();
      unsubscribeEnter();
      unsubscribeLeave();
      unsubscribeDown();
      unsubscribeUp();
      unsubscribeCancel();
      unsubscribeVisibility();
      pointerQuery.removeEventListener('change', syncPointerSupport);
      observer.disconnect();
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      window.clearTimeout(pressTimerRef.current);
      documentRoot.classList.remove('has-singularity-pointer');
      root.className = `singularity-pointer is-offscreen${enabled ? '' : ' is-ripple-only'}`;
      root.style.removeProperty('transform');
    };
  }, [active, enabled, reducedMotion, showClickEffect]);

  if (!active || !window.matchMedia(FINE_POINTER).matches) return null;
  return createPortal(
    <div className={`singularity-pointer is-offscreen${enabled ? '' : ' is-ripple-only'}`} ref={rootRef} aria-hidden="true" popover="manual">
      {enabled && <svg className="singularity-pointer__trail" viewBox="-160 -160 320 320" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="celestial-tail-main" x1="-100" y1="0" x2="0" y2="0" gradientUnits="userSpaceOnUse" ref={(node) => { gradientRefs.current[0] = node; }}>
            <stop offset="0" stopColor="#A77BFF" stopOpacity="0" />
            <stop offset=".42" stopColor="#477BFF" stopOpacity=".48" />
            <stop offset=".82" stopColor="#99D8FF" stopOpacity=".82" />
            <stop offset="1" stopColor="#F1F3FF" stopOpacity=".96" />
          </linearGradient>
          <linearGradient id="celestial-tail-side" x1="-100" y1="0" x2="0" y2="0" gradientUnits="userSpaceOnUse" ref={(node) => { gradientRefs.current[1] = node; }}>
            <stop offset="0" stopColor="#A77BFF" stopOpacity="0" />
            <stop offset=".58" stopColor="#A77BFF" stopOpacity=".42" />
            <stop offset="1" stopColor="#99D8FF" stopOpacity=".7" />
          </linearGradient>
        </defs>
        <path className="singularity-pointer__tail singularity-pointer__tail--soft" ref={(node) => { tailPathsRef.current[0] = node; }} />
        <path className="singularity-pointer__tail singularity-pointer__tail--main" ref={(node) => { tailPathsRef.current[1] = node; }} />
        <path className="singularity-pointer__tail singularity-pointer__tail--side" ref={(node) => { tailPathsRef.current[2] = node; }} />
        <circle className="singularity-pointer__dust singularity-pointer__dust--one" r="1.15" ref={(node) => { dustRefs.current[0] = node; }} />
        <circle className="singularity-pointer__dust singularity-pointer__dust--two" r=".75" ref={(node) => { dustRefs.current[1] = node; }} />
      </svg>}
      {enabled && <svg className="singularity-pointer__star" viewBox="-16 -16 32 32" aria-hidden="true" focusable="false">
        <path className="singularity-pointer__star-halo" d="M0 -14 2.3 -2.3 14 0 2.3 2.3 0 14 -2.3 2.3 -14 0 -2.3 -2.3Z" />
        <path className="singularity-pointer__star-face" d="M0 -12 1.8 -1.8 12 0 1.8 1.8 0 12 -1.8 1.8 -12 0 -1.8 -1.8Z" />
        <path className="singularity-pointer__star-glint" d="M0 -8 1.05 -1.05 8 0 1.05 1.05 0 8 -1.05 1.05 -8 0 -1.05 -1.05Z" />
      </svg>}
      {showClickEffect && <svg className="singularity-pointer__click-flash" viewBox="-36 -28 72 56" aria-hidden="true" focusable="false">
        <ellipse className="singularity-pointer__click-wave" cx="0" cy="0" rx="12" ry="7" />
      </svg>}
    </div>,
    document.body,
  );
}
