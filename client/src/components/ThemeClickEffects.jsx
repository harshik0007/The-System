import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUserPreferences } from '../context/UserPreferencesContext.jsx';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import useTopLayerPopover from '../hooks/useTopLayerPopover.js';

const FINE_POINTER = '(hover: hover) and (pointer: fine)';
const DESKTOP_FINE_POINTER = '(hover: hover) and (pointer: fine) and (min-width: 769px)';
const MAX_ACTIVE_EFFECTS = 5;

function createObsidianEffect(x, y) {
  const impact = document.createElement('div');
  impact.className = 'obsidian-click-impact';
  impact.style.setProperty('--impact-x', `${x - 41}px`);
  impact.style.setProperty('--impact-y', `${y - 41}px`);

  [32, 48, 64].forEach((size) => {
    const ring = document.createElement('span');
    ring.className = 'obsidian-impact-ring';
    ring.style.setProperty('--ring-size', `${size}px`);
    impact.append(ring);
  });
  [-150, -105, -60, -15, 30, 75, 120, 165].forEach((angle) => {
    const fragment = document.createElement('span');
    fragment.className = 'obsidian-impact-fragment';
    fragment.style.setProperty('--fragment-angle', `${angle}deg`);
    impact.append(fragment);
  });
  [-135, -90, -45, 0, 45, 90, 135, 180].forEach((angle) => {
    const particle = document.createElement('span');
    particle.className = 'obsidian-impact-particle';
    particle.style.setProperty('--fragment-angle', `${angle}deg`);
    impact.append(particle);
  });
  impact.classList.add('is-active');
  return impact;
}

function createClickEffect(theme, x, y) {
  if (theme === 'obsidian') return createObsidianEffect(x, y);

  if (theme === 'aurora' || theme === 'eclipse') {
    const wave = document.createElement('span');
    wave.className = theme === 'aurora' ? 'theme-click-wave theme-click-wave--aurora' : 'theme-click-wave theme-click-wave--eclipse';
    wave.style.left = `${x}px`;
    wave.style.top = `${y}px`;
    return wave;
  }

  if (theme === 'galaxion') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '-36 -28 72 56');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('theme-click-wave', 'theme-click-wave--galaxion');
    svg.style.left = `${x}px`;
    svg.style.top = `${y}px`;
    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ellipse.setAttribute('cx', '0');
    ellipse.setAttribute('cy', '0');
    ellipse.setAttribute('rx', '12');
    ellipse.setAttribute('ry', '7');
    svg.append(ellipse);
    return svg;
  }

  const ripple = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ripple.setAttribute('viewBox', '0 0 42 42');
  ripple.setAttribute('fill', 'none');
  ripple.classList.add('theme-click-wave', 'theme-click-wave--dark-navy');
  ripple.style.left = `${x - 20}px`;
  ripple.style.top = `${y - 20}px`;
  const shard = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shard.setAttribute('d', 'm12 2 27 16-10 21L2 26Z');
  ripple.append(shard);
  return ripple;
}

export default function ThemeClickEffects() {
  const { preferences, ready } = useUserPreferences();
  const reducedMotion = useReducedMotion();
  const layerRef = useRef(null);
  const timersRef = useRef(new Set());
  const [supportsPointer, setSupportsPointer] = useState(false);
  const theme = preferences.appearance.theme;
  const reduceDecorative = preferences.appearance.reduceDecorativeEffects;
  const clickEnabled = supportsPointer
    && ready
    && preferences.appearance.clickRipple
    && !reducedMotion
    && !((theme === 'obsidian' || theme === 'aurora' || theme === 'eclipse') && reduceDecorative);

  useTopLayerPopover(layerRef, clickEnabled);

  useEffect(() => {
    const query = window.matchMedia(theme === 'galaxion' ? FINE_POINTER : DESKTOP_FINE_POINTER);
    const update = () => setSupportsPointer(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [theme]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!clickEnabled || !layer) return undefined;

    const removeEffect = (effect) => {
      if (effect.__clickEffectTimer) {
        window.clearTimeout(effect.__clickEffectTimer);
        timersRef.current.delete(effect.__clickEffectTimer);
      }
      effect.remove();
    };

    const handlePointerDown = (event) => {
      if (event.pointerType === 'touch' || document.body.classList.contains('theme-transition-overlay-active')) return;
      while (layer.children.length >= MAX_ACTIVE_EFFECTS) removeEffect(layer.firstElementChild);
      const effect = createClickEffect(theme, event.clientX, event.clientY);
      layer.append(effect);
      const timer = window.setTimeout(() => {
        effect.remove();
        timersRef.current.delete(timer);
      }, theme === 'obsidian' ? 700 : theme === 'aurora' ? 740 : 620);
      effect.__clickEffectTimer = timer;
      timersRef.current.add(timer);
    };

    document.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
      layer.replaceChildren();
    };
  }, [clickEnabled, theme]);

  if (!clickEnabled) return null;
  return createPortal(
    <div className="theme-click-effects" ref={layerRef} aria-hidden="true" popover="manual" />,
    document.body,
  );
}
