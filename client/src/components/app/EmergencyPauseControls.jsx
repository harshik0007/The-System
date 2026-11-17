import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
import {
  EMERGENCY_PAUSE_MAX_DAYS,
  EMERGENCY_PAUSE_MIN_DAYS,
  EMERGENCY_PAUSES_PER_MONTH,
  getEmergencyPauseMonthlyUsage,
  getEmergencyPauseRemainingMs,
} from '../../utils/emergencyPauseManager.js';
import AppIcon from './AppIcon.jsx';

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

function PauseDialog({ mode, durationDays, setDurationDays, now, availableCount, onClose, onActivate, onResume }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!mode) return undefined;
    const previousFocus = document.activeElement;
    const focusable = () => [...(dialogRef.current?.querySelectorAll('button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])];
    focusable()[0]?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
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
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [mode, onClose]);

  if (!mode) return null;
  const dialogMode = typeof mode === 'object' ? 'resume' : mode;
  const expectedResume = new Date(now + Number(durationDays) * 24 * 60 * 60 * 1000);
  const title = dialogMode === 'rules' ? 'Emergency Pause' : dialogMode === 'activate' ? 'Activate Emergency Pause?' : 'Resume Emergency Pause early?';

  return createPortal(
    <div className="emergency-pause-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="emergency-pause-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="emergency-pause-dialog-title" tabIndex="-1">
        <button className="emergency-pause-modal__close" type="button" onClick={onClose} aria-label="Close dialog"><AppIcon name="close" /></button>
        <span className="emergency-pause-modal__icon"><AppIcon name={mode === 'rules' ? 'shield' : 'clock'} /></span>
        <p className="app-eyebrow">THE SYSTEM · ACTIVITY CONTROL</p>
        <h2 id="emergency-pause-dialog-title">{title}</h2>

        {dialogMode === 'rules' && <div className="emergency-pause-modal__rules">
          <p>Emergency Pause temporarily suspends normal activity so members can take a break without losing their Discipline progress.</p>
          <ol>
            <li>You can activate Emergency Pause twice per calendar month.</li>
            <li>Each pause can last from 1 to 7 consecutive days.</li>
            <li>You can resume early whenever you are ready.</li>
            <li>Otherwise, the System automatically resumes after your selected duration.</li>
            <li>Your monthly allowance resets at the beginning of a new calendar month.</li>
            <li>Your scheduled tasks are suspended during the pause.</li>
            <li>Your Recovery Quests and Recovery Windows are frozen.</li>
            <li>No Recovery Quest XP drain occurs during the pause.</li>
            <li>Your Discipline Streak remains protected.</li>
            <li>Your recurring Discipline reward countdown continues normally.</li>
            <li>You are not required to complete five scheduled tasks on protected pause days.</li>
          </ol>
          <button className="emergency-pause-modal__primary" type="button" onClick={onClose}>Understood</button>
        </div>}

        {dialogMode === 'activate' && <form className="emergency-pause-modal__form" onSubmit={(event) => { event.preventDefault(); onActivate(); }}>
          <div className="emergency-pause-modal__allowance"><span>Available this month</span><strong>{availableCount} / {EMERGENCY_PAUSES_PER_MONTH}</strong></div>
          <label className="emergency-pause-modal__field">Pause duration
            <select value={durationDays} onChange={(event) => setDurationDays(Number(event.target.value))}>
              {Array.from({ length: EMERGENCY_PAUSE_MAX_DAYS }, (_, index) => index + EMERGENCY_PAUSE_MIN_DAYS)
                .map((days) => <option key={days} value={days}>{days} {days === 1 ? 'day' : 'days'}</option>)}
            </select>
          </label>
          <div className="emergency-pause-modal__times"><p><span>Starts</span><strong>{formatDateTime(now)}</strong></p><p><span>Scheduled resume</span><strong>{formatDateTime(expectedResume)}</strong></p></div>
          <div className="emergency-pause-modal__notice"><AppIcon name="activity" /><p>Scheduled Tasks and Recovery Quest actions pause. Active Recovery Windows are preserved, XP drain stops, and protected days keep your Discipline Streak. Recurring Discipline rewards continue on schedule.</p></div>
          <div className="emergency-pause-modal__actions"><button type="button" className="emergency-pause-modal__secondary" onClick={onClose}>Cancel</button><button type="submit" className="emergency-pause-modal__primary">Confirm Emergency Pause</button></div>
        </form>}

        {dialogMode === 'resume' && <div className="emergency-pause-modal__form">
          <p className="emergency-pause-modal__intro">Normal scheduled activity and Recovery Quest processing will resume immediately after confirmation.</p>
          <div className="emergency-pause-modal__times"><p><span>Pause started</span><strong>{formatDateTime(mode.pause.startAt)}</strong></p><p><span>Scheduled resume</span><strong>{formatDateTime(mode.pause.scheduledResumeAt)}</strong></p></div>
          <div className="emergency-pause-modal__actions"><button type="button" className="emergency-pause-modal__secondary" onClick={onClose}>Keep Pause Active</button><button type="button" className="emergency-pause-modal__primary" onClick={onResume}>Resume Early</button></div>
        </div>}
      </section>
    </div>,
    document.body,
  );
}

export default function EmergencyPauseControls() {
  const { emergencyPauseState, activeEmergencyPause, isEmergencyPauseActive, activateEmergencyPause, resumeEmergencyPauseEarly } = useTaskSchedule();
  const [mode, setMode] = useState(null);
  const [durationDays, setDurationDays] = useState(1);
  const [now, setNow] = useState(Date.now());
  const [feedback, setFeedback] = useState('');
  const closeDialog = useCallback(() => setMode(null), []);
  const usage = getEmergencyPauseMonthlyUsage(emergencyPauseState, now);
  const availableCount = Math.max(0, EMERGENCY_PAUSES_PER_MONTH - usage);
  const remaining = activeEmergencyPause ? getEmergencyPauseRemainingMs(activeEmergencyPause, now) : 0;
  const latestPause = emergencyPauseState.pauses?.at(-1);
  const automaticResumeMessage = useMemo(() => {
    if (isEmergencyPauseActive || latestPause?.status !== 'automatically-resumed') return '';
    const resumedAt = Date.parse(latestPause.actualResumeAt);
    return Number.isFinite(resumedAt) && now - resumedAt < 5 * 60_000
      ? 'Emergency Pause ended at its scheduled time. Normal activity has resumed.' : '';
  }, [isEmergencyPauseActive, latestPause, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = window.setTimeout(() => setFeedback(''), 7000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const activate = () => {
    const result = activateEmergencyPause(durationDays);
    if (result.error) {
      setFeedback(result.error === 'monthly-limit'
        ? 'Both Emergency Pauses have been used this month. The allowance resets next calendar month.'
        : result.error === 'already-active'
          ? 'An Emergency Pause is already active.'
          : 'Choose a duration from 1 to 7 days.');
      setMode(null);
      return;
    }
    setFeedback('Emergency Pause activated. Your Rank and Discipline progress remain protected.');
    setMode(null);
  };

  const resume = () => {
    const result = resumeEmergencyPauseEarly();
    if (result.error) {
      setFeedback('This Emergency Pause has already ended. Normal activity has resumed.');
    } else {
      setFeedback('Emergency Pause ended early. Normal activity has resumed.');
    }
    setMode(null);
  };

  return <div className={`emergency-pause-control${isEmergencyPauseActive ? ' is-active' : ''}`}>
    {isEmergencyPauseActive && activeEmergencyPause ? <>
      <div className="emergency-pause-control__status"><span className="emergency-pause-control__status-dot" /><strong>Emergency Pause Active</strong></div>
      <div className="emergency-pause-control__details">
        <p><span>Started</span><strong>{formatDateTime(activeEmergencyPause.startAt)}</strong></p>
        <p><span>Scheduled Resume</span><strong>{formatDateTime(activeEmergencyPause.scheduledResumeAt)}</strong></p>
        <p><span>Remaining</span><strong aria-live="off">{formatRemaining(remaining)}</strong></p>
      </div>
      <div className="emergency-pause-control__actions"><button type="button" className="emergency-pause-control__resume" onClick={() => setMode({ pause: activeEmergencyPause })}>Resume Early</button><button type="button" className="emergency-pause-control__rules" onClick={() => setMode('rules')}>Pause Rules</button></div>
    </> : <>
      <div className="emergency-pause-control__status"><span className="emergency-pause-control__status-dot" /><strong>Emergency Pause</strong></div>
      <div className="emergency-pause-control__actions"><button type="button" className="emergency-pause-control__activate" onClick={() => { setDurationDays(1); setMode('activate'); }} disabled={availableCount === 0}>Emergency Pause</button><button type="button" className="emergency-pause-control__rules" onClick={() => setMode('rules')}>Pause Rules</button></div>
      <p className="emergency-pause-control__allowance">{usage} / {EMERGENCY_PAUSES_PER_MONTH} used this month</p>
      {availableCount === 0 && <p className="emergency-pause-control__limit">Allowance resets at the start of next calendar month.</p>}
    </>}
    {(feedback || automaticResumeMessage) && <p className="emergency-pause-control__feedback" role="status">{feedback || automaticResumeMessage}</p>}
    <PauseDialog
      mode={mode}
      durationDays={durationDays}
      setDurationDays={setDurationDays}
      now={now}
      availableCount={availableCount}
      onClose={closeDialog}
      onActivate={activate}
      onResume={resume}
    />
  </div>;
}
