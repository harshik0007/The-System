import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from './AppIcon.jsx';
import { SkeletonLine } from './PageLoadingSkeleton.jsx';
import { isResetConfirmationReady, RESET_CONFIRMATION_PHRASE } from '../../utils/systemDataReset.js';

const PRESERVED = [
  'Account identity, account creation date and original Member Since date.',
  'Reset Count remains unchanged. Only automatic Grace exhaustion reset increments it.',
  'Lifetime Longest Streak, profile information, privacy, appearance, accessibility and notification preferences.',
  'M25 Monthly Analysis summaries and retained history remain attached to the previous run.',
];

export default function ResetAndRestartDialog({ open, onClose, onConfirm, preview, loading = false, submitting = false, error = '' }) {
  const dialogRef = useRef(null);
  const warningRef = useRef(null);
  const [phrase, setPhrase] = useState('');
  const [hasReadWarning, setHasReadWarning] = useState(false);
  const [finalConfirmation, setFinalConfirmation] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const focusable = () => [...(dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])];
    focusable()[0]?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) onClose();
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open, onClose, submitting]);

  useEffect(() => {
    if (!open || !preview) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const warning = warningRef.current;
      if (warning && warning.scrollHeight <= warning.clientHeight + 2) setHasReadWarning(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, preview]);

  useEffect(() => {
    if (open) return;
    setPhrase('');
    setHasReadWarning(false);
    setFinalConfirmation(false);
  }, [open]);

  if (!open) return null;
  const ready = Boolean(preview) && !loading && !submitting && isResetConfirmationReady({ phrase, hasReadWarning, finalConfirmation });

  return createPortal(
    <div className="settings-dialog-backdrop settings-dialog-backdrop--danger" onMouseDown={(event) => { if (!submitting && event.target === event.currentTarget) onClose(); }}>
      <section className="settings-dialog settings-dialog--reset" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="reset-system-title" aria-describedby="reset-system-description" tabIndex="-1">
        <button type="button" className="settings-dialog__close" onClick={onClose} aria-label="Close reset confirmation" disabled={submitting}><AppIcon name="close" /></button>
        <span className="settings-dialog__icon settings-dialog__icon--danger"><AppIcon name="shield" /></span>
        <p className="app-eyebrow settings-dialog__danger-eyebrow">PERMANENT PROGRESSION RESET</p>
        <h2 id="reset-system-title">Reset &amp; Restart THE SYSTEM?</h2>
        <p id="reset-system-description" className="settings-dialog__intro">Your current Progression Run will be archived and a completely fresh Origin run will begin. This does not delete your account or permanently retained Monthly Analysis summaries.</p>
        <div className="settings-reset-warning"><strong>This operation cannot be undone.</strong><span>It starts a fresh Progression Run. Reset Count stays unchanged, and you will create a new Task Schedule before continuing.</span></div>
        {loading && <p className="settings-inline-note"><SkeletonLine width="long" label="Loading reset details from your account" /></p>}
        {preview && <div className="settings-reset-summary">
          <div className="settings-reset-list" ref={warningRef} tabIndex="0" aria-label="Information that will be reset" onScroll={(event) => { const element = event.currentTarget; if (element.scrollTop + element.clientHeight >= element.scrollHeight - 3) setHasReadWarning(true); }}>
            <p>THE FOLLOWING WILL RESET</p>
            <ul>{preview.reset.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="settings-reset-preserved">
            <p>THE FOLLOWING WILL REMAIN</p>
            <ul>{PRESERVED.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>}
        {!hasReadWarning && preview && <p className="settings-reset-scroll-hint">Scroll through the reset details above to continue.</p>}
        {error && <p className="settings-reset-error" role="alert">{error}</p>}
        <label className={`settings-reset-read${!hasReadWarning || !preview ? ' is-disabled' : ''}`}><input type="checkbox" checked={hasReadWarning && finalConfirmation} disabled={!hasReadWarning || !preview || loading || submitting} onChange={(event) => setFinalConfirmation(event.target.checked)} /><span>I have reviewed what resets and what remains, and I understand this action is permanent.</span></label>
        <label className="settings-reset-phrase" htmlFor="reset-confirmation-phrase">Type <code>{RESET_CONFIRMATION_PHRASE}</code> to confirm
          <input id="reset-confirmation-phrase" type="text" autoComplete="off" spellCheck="false" value={phrase} disabled={loading || submitting || !preview} onChange={(event) => setPhrase(event.target.value)} aria-describedby="reset-confirmation-hint" />
          <small id="reset-confirmation-hint">The phrase must match exactly, including capitalization.</small>
        </label>
        <div className="settings-dialog__actions"><button type="button" className="settings-dialog__cancel" onClick={onClose} disabled={submitting}>Cancel</button><button type="button" className="settings-dialog__submit settings-dialog__submit--danger" onClick={() => onConfirm({ confirmationPhrase: phrase, expectedRunNumber: preview?.expectedRunNumber })} disabled={!ready}>{submitting ? 'Restarting…' : 'Reset & Restart'}</button></div>
      </section>
    </div>,
    document.body,
  );
}
