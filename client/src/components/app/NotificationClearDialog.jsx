import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from './AppIcon.jsx';

export default function NotificationClearDialog({ open, onClose, onConfirm, busy = false, error = '' }) {
  const dialogRef = useRef(null);
  const busyRef = useRef(busy);
  const closeRef = useRef(onClose);
  busyRef.current = busy;
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const appRoot = document.getElementById('root');
    const previousInert = appRoot?.inert ?? false;
    if (appRoot) appRoot.inert = true;
    const getFocusable = () => [...(dialogRef.current?.querySelectorAll('button:not(:disabled)') || [])];
    getFocusable()[0]?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busyRef.current) closeRef.current();
      if (event.key !== 'Tab') return;
      const items = getFocusable();
      const first = items[0]; const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (appRoot) appRoot.inert = previousInert;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="account-action-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="account-action-dialog notifications-delete-dialog" ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="notifications-delete-title" aria-describedby="notifications-delete-description" tabIndex="-1">
        <button type="button" className="account-action-dialog__close" onClick={onClose} disabled={busy} aria-label="Close delete notifications confirmation"><AppIcon name="close" /></button>
        <span className="account-action-dialog__icon account-action-dialog__icon--danger"><AppIcon name="trash" /></span>
        <p className="app-eyebrow notifications-delete-dialog__eyebrow">NOTIFICATION HISTORY</p>
        <h2 id="notifications-delete-title">Delete all notifications?</h2>
        <p id="notifications-delete-description">This permanently removes every notification currently saved to your account. New notifications will still arrive.</p>
        {error && <p className="account-action-dialog__feedback" role="alert">{error}</p>}
        <div className="account-action-dialog__actions">
          <button type="button" className="account-action-dialog__cancel" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="account-action-dialog__confirm account-action-dialog__confirm--danger" onClick={onConfirm} disabled={busy} aria-busy={busy}>
            {busy ? 'Deleting…' : 'Delete all'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
