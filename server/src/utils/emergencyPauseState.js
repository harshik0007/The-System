import { getIstMidnightInstant } from './ist.js';

function nextMonthStart(monthKey) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey || '')) return null;
  const [year, month] = monthKey.split('-').map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return getIstMidnightInstant(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`);
}

/** The existing Pause state ends at its configured resume or the next IST month boundary. */
export function getEmergencyPauseResumeAt(run) {
  if (!run?.emergencyPause?.active) return null;
  const configured = run.emergencyPause.resumesAt ? new Date(run.emergencyPause.resumesAt) : null;
  const monthBoundary = nextMonthStart(run.emergencyPause.allowanceMonthKey);
  return [configured, monthBoundary].filter((date) => date && !Number.isNaN(date.getTime())).sort((a, b) => a - b)[0] || null;
}

export function isEmergencyPauseActive(run, at = new Date()) {
  if (!run?.emergencyPause?.active) return false;
  const start = run.emergencyPause.activatedAt ? new Date(run.emergencyPause.activatedAt) : run.startedAt ? new Date(run.startedAt) : null;
  const instant = new Date(at);
  const end = getEmergencyPauseResumeAt(run);
  return (!start || start.getTime() <= instant.getTime()) && (!end || end.getTime() > instant.getTime());
}

export function doesEmergencyPauseCoverInstant(run, instant) {
  return isEmergencyPauseActive(run, instant);
}
