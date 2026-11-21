import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ThemePreviewVisual from './ThemePreviewVisual.jsx';

export default function ThemePreviewDialog({ theme, unlocked, active, onClose, returnFocusRef }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = returnFocusRef?.current || document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById('root');
    const previousInert = appRoot?.inert ?? false;
    document.body.style.overflow = 'hidden';
    if (appRoot) appRoot.inert = true;
    closeRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = [...(dialogRef.current?.querySelectorAll('button:not(:disabled)') || [])];
        if (focusable.length < 2) {
          event.preventDefault();
          closeRef.current?.focus({ preventScroll: true });
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (appRoot) appRoot.inert = previousInert;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [returnFocusRef]);

  return createPortal(
    <div className="theme-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        ref={dialogRef}
        className={`theme-preview-dialog theme-preview-dialog--${theme.id}`}
        style={{ '--preview-accent': theme.colors[2] }}
        id="theme-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-preview-title"
        aria-describedby="theme-preview-description"
      >
        <header className="theme-preview-dialog__header">
          <div>
            <p className="app-eyebrow">THEME PREVIEW</p>
            <h2 id="theme-preview-title">{theme.name}</h2>
            {theme.subtitle && <p className="theme-preview-dialog__subtitle">{theme.subtitle}</p>}
          </div>
          <button ref={closeRef} className="theme-preview-dialog__close" type="button" onClick={onClose} aria-label="Close theme preview">×</button>
        </header>
        <ThemePreviewVisual theme={theme} size="dialog" />
        <div className="theme-preview-dialog__details">
          <p id="theme-preview-description">{theme.description}</p>
          <div className="theme-preview-dialog__entitlement">
            <span>{theme.requirement}</span>
            <strong className={unlocked ? 'is-unlocked' : 'is-locked'}>{active ? 'ACTIVE' : unlocked ? 'UNLOCKED' : 'LOCKED'}</strong>
          </div>
        </div>
        <footer className="theme-preview-dialog__footer">
          <p>{unlocked ? 'Preview only. Your saved theme and settings will not change.' : `${theme.requirement} is required before this theme can be equipped.`}</p>
          <button className="theme-preview-dialog__done" type="button" onClick={onClose}>Close preview</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
