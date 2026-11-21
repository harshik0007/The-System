import { useEffect } from 'react';

/** Share inclusive viewport-edge checks across every theme cursor renderer. */
export function isViewportPoint(x, y, width = window.innerWidth, height = window.innerHeight) {
  return Number.isFinite(x) && Number.isFinite(y)
    && x >= 0 && y >= 0 && x <= width && y <= height;
}

/** Keeps the active decorative cursor above dialogs while leaving all input untouched. */
export default function useCursorTopLayer(rootRef, active) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !active || typeof root.showPopover !== 'function') return undefined;

    let promoting = false;
    const promote = () => {
      if (promoting || !root.isConnected) return;
      promoting = true;
      try {
        // Reopening an already-open manual popover moves it to the end of the
        // browser top layer. That matters when a dialog or another popover was
        // opened after the cursor.
        if (root.matches(':popover-open')) root.hidePopover();
        root.showPopover();
      } catch {
        // The high, shared cursor layer remains the fallback on older browsers.
      } finally {
        promoting = false;
      }
    };

    promote();
    const observer = new MutationObserver((records) => {
      if (records.some(({ target }) => target instanceof HTMLDialogElement && target.open)) promote();
    });
    observer.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    const onToggle = (event) => {
      if (event.target !== root && event.newState === 'open' && event.target.matches?.('[popover]')) promote();
    };
    document.addEventListener('toggle', onToggle, true);

    return () => {
      document.removeEventListener('toggle', onToggle, true);
      observer.disconnect();
      try {
        if (root.matches(':popover-open')) root.hidePopover();
      } catch {
        // The node may already be disconnected as its theme renderer unmounts.
      }
    };
  }, [active, rootRef]);
}

export function dispatchCursorRuntimeEvent(name, sourceEvent) {
  window.dispatchEvent(new CustomEvent(`the-system:cursor:${name}`, { detail: sourceEvent }));
}

export function subscribeCursorRuntimeEvent(name, handler) {
  const eventName = `the-system:cursor:${name}`;
  const forward = (event) => handler(event.detail);
  window.addEventListener(eventName, forward);
  return () => window.removeEventListener(eventName, forward);
}
