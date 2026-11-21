import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTaskBackend } from '../../context/TaskBackendContext.jsx';
import { useFlashMessages } from '../../context/FlashMessageContext.jsx';
import { EMERGENCY_PAUSES_PER_MONTH } from '../../utils/emergencyPauseManager.js';
import AppIcon from './AppIcon.jsx';
import { SkeletonLine } from './PageLoadingSkeleton.jsx';

const istDateTime = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric',
  hour: 'numeric', minute: '2-digit',
});

function formatRemaining(milliseconds) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return [days ? `${days}d` : '', `${hours}h`, `${minutes}m`].filter(Boolean).join(' ');
}

function formatDateTime(value) {
  return `${istDateTime.format(new Date(value))} IST`;
}

function estimateResume(now, durationDays) {
  const start = new Date(now);
  const selected = new Date(start.getTime() + Number(durationDays) * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' })
    .formatToParts(start);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const [year, month] = [Number(values.year), Number(values.month)];
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const monthBoundary = new Date(Date.UTC(nextYear, nextMonth - 1, 1) - 330 * 60_000);
  return selected.getTime() <= monthBoundary.getTime() ? selected : monthBoundary;
}

function PauseDialog({ mode, durationDays, setDurationDays, now, availableCount, allowance, pending, onClose, onActivate, onResume }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!mode) return undefined;
    const previousFocus = document.activeElement;
    const appRoot = document.getElementById('root');
    const previousInert = appRoot?.inert ?? false;
    if (appRoot) appRoot.inert = true;
    const focusable = () => [...(dialogRef.current?.querySelectorAll('button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])];
    focusable()[0]?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !pending) onClose();
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (appRoot) appRoot.inert = previousInert;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [mode, onClose, pending]);

  if (!mode) return null;
  const dialogMode = typeof mode === 'object' ? 'resume' : mode;
  const expectedResume = estimateResume(now, durationDays);
  const title = dialogMode === 'rules' ? 'Emergency Pause' : dialogMode === 'activate' ? 'Activate Emergency Pause?' : 'Resume Emergency Pause early?';

  return createPortal(
    <div className="emergency-pause-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <section className="emergency-pause-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="emergency-pause-dialog-title" tabIndex="-1">
        <button className="emergency-pause-modal__close" type="button" onClick={onClose} aria-label="Close dialog" disabled={pending}><AppIcon name="close" /></button>
        <span className="emergency-pause-modal__icon"><AppIcon name={mode === 'rules' ? 'shield' : 'clock'} /></span>
        <p className="app-eyebrow">THE SYSTEM · ACTIVITY CONTROL</p>
        <h2 id="emergency-pause-dialog-title">{title}</h2>

        {dialogMode === 'rules' && <div className="emergency-pause-modal__rules">
          <p>Emergency Pause temporarily suspends normal activity so members can take a break without losing their Discipline progress.</p>
          <ol>
            <li>You can activate Emergency Pause up to {allowance} times per IST calendar month during the current testing period.</li>
            <li>Each pause can last from 1 to 7 consecutive 24-hour days.</li>
            <li>You can resume early whenever you are ready; that activation remains used.</li>
            <li>Otherwise, the System resumes after your selected duration.</li>
            <li>A pause crossing into a new month ends at 00:00 IST on the first day of that month.</li>
            <li>Your scheduled Tasks are suspended during the pause.</li>
            <li>Your Recovery Quests and Recovery Windows are frozen.</li>
            <li>No Recovery Quest XP drain occurs at a reset that falls during the pause.</li>
            <li>Your Discipline Streak remains protected, without a fabricated qualifying day.</li>
            <li>Your recurring Discipline reward cycle keeps its existing qualifying-day progress.</li>
          </ol>
          <button className="emergency-pause-modal__primary" type="button" onClick={onClose}>Understood</button>
        </div>}

        {dialogMode === 'activate' && <form className="emergency-pause-modal__form" onSubmit={(event) => { event.preventDefault(); void onActivate(); }}>
          <div className="emergency-pause-modal__allowance"><span>Available this month</span><strong>{availableCount} / {allowance}</strong></div>
          <label className="emergency-pause-modal__field">Pause duration
            <select value={durationDays} onChange={(event) => setDurationDays(Number(event.target.value))} disabled={pending}>
              {Array.from({ length: 7 }, (_, index) => index + 1)
                .map((days) => <option key={days} value={days}>{days} {days === 1 ? 'day' : 'days'}</option>)}
            </select>
          </label>
          <div className="emergency-pause-modal__times"><p><span>Starts</span><strong>{formatDateTime(now)}</strong></p><p><span>Estimated resume</span><strong>{formatDateTime(expectedResume)}</strong></p></div>
          <div className="emergency-pause-modal__notice"><AppIcon name="activity" /><p>Scheduled Tasks and Recovery Quest actions pause. Active Recovery Windows are preserved, XP drain stops at paused resets, and protected dates keep your Discipline Streak. The server confirms the exact resume time when activated.</p></div>
          <div className="emergency-pause-modal__actions"><button type="button" className="emergency-pause-modal__secondary" onClick={onClose} disabled={pending}>Cancel</button><button type="submit" className="emergency-pause-modal__primary" disabled={pending || availableCount < 1}>{pending ? 'Activating…' : 'Confirm Emergency Pause'}</button></div>
        </form>}

        {dialogMode === 'resume' && <div className="emergency-pause-modal__form">
          <p className="emergency-pause-modal__intro">Normal scheduled activity and Recovery Quest processing will resume immediately after confirmation.</p>
          <div className="emergency-pause-modal__times"><p><span>Pause started</span><strong>{formatDateTime(mode.pause.startedAt)}</strong></p><p><span>Scheduled resume</span><strong>{formatDateTime(mode.pause.effectiveEndAt)}</strong></p></div>
          <div className="emergency-pause-modal__actions"><button type="button" className="emergency-pause-modal__secondary" onClick={onClose} disabled={pending}>Keep Pause Active</button><button type="button" className="emergency-pause-modal__primary" onClick={() => void onResume()} disabled={pending}>{pending ? 'Resuming…' : 'Resume Early'}</button></div>
        </div>}
      </section>
    </div>,
    document.body,
  );
}

export default function EmergencyPauseControls() {
  const {
    emergencyPause,
    emergencyPauseLoading,
    activateEmergencyPause,
    resumeEmergencyPause,
  } = useTaskBackend();
  const { notifySuccess, notifyError } = useFlashMessages();
  const [mode, setMode] = useState(null);
  const [durationDays, setDurationDays] = useState(1);
  const [now, setNow] = useState(Date.now());
  const requestInFlightRef = useRef(false);
  const closeDialog = useCallback(() => { if (!emergencyPauseLoading) setMode(null); }, [emergencyPauseLoading]);
  const isActive = Boolean(emergencyPause?.isActive);
  const activePause = emergencyPause?.pause || null;
  const usage = Number(emergencyPause?.activationsUsed) || 0;
  const availableCount = Number(emergencyPause?.activationsRemaining) || 0;
  const pauseAllowance = Number(emergencyPause?.allowance) || EMERGENCY_PAUSES_PER_MONTH;
  const remaining = activePause ? Math.max(0, Date.parse(activePause.effectiveEndAt) - now) : 0;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activate = useCallback(async () => {
    if (requestInFlightRef.current || emergencyPauseLoading) return;
    requestInFlightRef.current = true;
    try {
      await activateEmergencyPause(durationDays);
      notifySuccess('Emergency Pause activated. Your Rank and Discipline progress remain protected.');
      setMode(null);
    } catch (error) {
      notifyError(error?.message || 'Emergency Pause could not be activated. Refresh the status and try again.');
    } finally {
      requestInFlightRef.current = false;
    }
  }, [activateEmergencyPause, durationDays, emergencyPauseLoading, notifyError, notifySuccess]);

  const resume = useCallback(async () => {
    if (requestInFlightRef.current || emergencyPauseLoading) return;
    requestInFlightRef.current = true;
    try {
      await resumeEmergencyPause();
      notifySuccess('Emergency Pause ended early. Normal activity has resumed.');
      setMode(null);
    } catch (error) {
      notifyError(error?.message || 'Emergency Pause could not be resumed. Refresh the status and try again.');
    } finally {
      requestInFlightRef.current = false;
    }
  }, [emergencyPauseLoading, notifyError, notifySuccess, resumeEmergencyPause]);

  return <div className={`emergency-pause-control${isActive ? ' is-active' : ''}`}>
    {isActive && activePause ? <>
      <div className="emergency-pause-control__status"><span className="emergency-pause-control__status-dot" /><strong>Emergency Pause</strong><span className="emergency-pause-control__active-badge">ACTIVE</span></div>
      <div className="emergency-pause-control__details">
        <p><span>Started</span><strong>{formatDateTime(activePause.startedAt)}</strong></p>
        <p><span>Scheduled Resume</span><strong>{formatDateTime(activePause.effectiveEndAt)}</strong></p>
        <p><span>Remaining</span><strong aria-live="off">{formatRemaining(remaining)}</strong></p>
      </div>
      <div className="emergency-pause-control__actions"><button type="button" className="emergency-pause-control__resume" onClick={() => setMode({ pause: activePause })} disabled={emergencyPauseLoading}>Resume Early</button><button type="button" className="emergency-pause-control__rules" onClick={() => setMode('rules')}>Pause Rules</button></div>
    </> : <>
      <div className="emergency-pause-control__status"><span className="emergency-pause-control__status-dot" /><strong>Emergency Pause</strong></div>
      <div className="emergency-pause-control__actions"><button type="button" className="emergency-pause-control__activate" onClick={() => { setDurationDays(1); setMode('activate'); }} disabled={emergencyPauseLoading || !emergencyPause || availableCount === 0}>Emergency Pause</button><button type="button" className="emergency-pause-control__rules" onClick={() => setMode('rules')}>Pause Rules</button></div>
      <p className="emergency-pause-control__allowance">{emergencyPauseLoading && !emergencyPause ? <SkeletonLine width="medium" label="Loading Emergency Pause status" /> : emergencyPause ? `${usage} / ${pauseAllowance} used this month` : 'Emergency Pause status is unavailable.'}</p>
      {emergencyPause && availableCount === 0 && <p className="emergency-pause-control__limit">Allowance resets at the start of next IST calendar month.</p>}
    </>}
    <PauseDialog
      mode={mode}
      durationDays={durationDays}
      setDurationDays={setDurationDays}
      now={now}
      availableCount={availableCount}
      allowance={pauseAllowance}
      pending={emergencyPauseLoading}
      onClose={closeDialog}
      onActivate={activate}
      onResume={resume}
    />
  </div>;
}
