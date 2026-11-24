import { useEffect } from 'react';

/** Keeps decorative, non-interactive overlays above dialogs and popovers. */
export default function useTopLayerPopover(rootRef, active) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !active || typeof root.showPopover !== 'function') return undefined;

    let promoting = false;
    const promote = () => {
      if (promoting || !root.isConnected) return;
      promoting = true;
      try {
        if (root.matches(':popover-open')) root.hidePopover();
        root.showPopover();
      } catch {
        // The fixed overlay remains a fallback if the browser lacks popovers.
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
        // The node may already be disconnected as its overlay unmounts.
      }
    };
  }, [active, rootRef]);
}
