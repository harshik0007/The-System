import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from './AppIcon.jsx';
import { isResetConfirmationReady, RESET_CONFIRMATION_PHRASE } from '../../utils/systemDataReset.js';

const RESET_DATA = [
  'Scheduled task schedules and assignments.',
  'Completed and missed task history.',
  'Accountability Action history.',
  'All active, completed, expired and threshold-cleared Recovery Quests.',
  'Recovery Quest history and snapshots.',
  'Discipline Streak and longest-streak history.',
  'Discipline Activity Map history.',
  'Discipline Point balance and reward history.',
  'Grace Point balance and transaction history.',
  'XP balance and XP event history.',
  'Current Level and Level history.',
  'Current Rank and Rank progression history.',
  'One-time Rank-entry reward eligibility and history.',
  'Daily Rank XP history.',
  'Current progression run and previous progression-run summaries.',
  'Personal Best records in Overall, Discipline and XP rankings.',
  'Highest Rank Achieved record.',
  'Monthly Analysis summaries and detailed history.',
  'History expiry reminders and their scheduling records.',
  'Emergency Pause history and monthly usage.',
  'Redemption history and active cooldowns.',
  'User-created profile customizations and preferences, which return to their defaults.',
];

export default function ResetAndRestartDialog({ open, onClose, onConfirm }) {
  const dialogRef = useRef(null);
  const warningRef = useRef(null);
  const [phrase, setPhrase] = useState('');
  const [hasReadWarning, setHasReadWarning] = useState(false);
  const [finalConfirmation, setFinalConfirmation] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const warning = warningRef.current;
    if (warning && warning.scrollHeight <= warning.clientHeight + 2) setHasReadWarning(true);
    const focusable = () => [...(dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])];
    focusable()[0]?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
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
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    setPhrase('');
    setHasReadWarning(false);
    setFinalConfirmation(false);
  }, [open]);

  if (!open) return null;
  const ready = isResetConfirmationReady({ phrase, hasReadWarning, finalConfirmation });

  return createPortal(
    <div className="settings-dialog-backdrop settings-dialog-backdrop--danger" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="settings-dialog settings-dialog--reset" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="reset-system-title" aria-describedby="reset-system-description" tabIndex="-1">
        <button type="button" className="settings-dialog__close" onClick={onClose} aria-label="Close reset confirmation"><AppIcon name="close" /></button>
        <span className="settings-dialog__icon settings-dialog__icon--danger"><AppIcon name="shield" /></span>
        <p className="app-eyebrow settings-dialog__danger-eyebrow">PERMANENT PROGRESS RESET</p>
        <h2 id="reset-system-title">Reset &amp; Restart THE SYSTEM?</h2>
        <p id="reset-system-description" className="settings-dialog__intro">This will permanently erase your existing progress, historical records and achievements. Your account and login credentials will remain active, but your THE SYSTEM journey will start again from the beginning.</p>
        <div className="settings-reset-warning"><strong>This operation cannot be undone.</strong><span>This frontend reset affects this browser session only. Server-side and multi-device data deletion require backend integration.</span></div>
        <div className="settings-reset-list" ref={warningRef} tabIndex="0" aria-label="Information that will be erased" onScroll={(event) => { const element = event.currentTarget; if (element.scrollTop + element.clientHeight >= element.scrollHeight - 3) setHasReadWarning(true); }}>
          <p>THE FOLLOWING WILL BE ERASED</p>
          <ul>{RESET_DATA.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        {!hasReadWarning && <p className="settings-reset-scroll-hint">Scroll through the full list above to continue.</p>}
        <label className={`settings-reset-read${!hasReadWarning ? ' is-disabled' : ''}`}><input type="checkbox" checked={hasReadWarning && finalConfirmation} disabled={!hasReadWarning} onChange={(event) => setFinalConfirmation(event.target.checked)} /><span>I have read the full warning and understand this reset is permanent.</span></label>
        <label className="settings-reset-phrase" htmlFor="reset-confirmation-phrase">Type <code>{RESET_CONFIRMATION_PHRASE}</code> to confirm
          <input id="reset-confirmation-phrase" type="text" autoComplete="off" spellCheck="false" value={phrase} onChange={(event) => setPhrase(event.target.value)} aria-describedby="reset-confirmation-hint" />
          <small id="reset-confirmation-hint">The phrase must match exactly, including spaces and capitalization.</small>
        </label>
        <div className="settings-dialog__actions"><button type="button" className="settings-dialog__cancel" onClick={onClose}>Cancel</button><button type="button" className="settings-dialog__submit settings-dialog__submit--danger" onClick={onConfirm} disabled={!ready}>Reset &amp; Restart</button></div>
      </section>
    </div>,
    document.body,
  );
}
