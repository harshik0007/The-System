import { addIstCalendarDays, getIstDateKey, getIstMidnightInstant } from './ist.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function deriveDisciplineRewardCycleCalendar({ startDate, requiredQualifyingDays }) {
  const baselineTargetDate = addIstCalendarDays(startDate, requiredQualifyingDays);
  return {
    cycleStartedAt: getIstMidnightInstant(startDate),
    baselineTargetDate,
    baselineTargetAt: getIstMidnightInstant(baselineTargetDate),
  };
}

/** Lazily backfills timing for an existing cycle without changing its snapshots or earned progress. */
export function initializeDisciplineRewardCycleCalendar(cycle) {
  const derived = deriveDisciplineRewardCycleCalendar({
    startDate: cycle.startDate,
    requiredQualifyingDays: cycle.requiredQualifyingDays,
  });
  const baselineTargetDate = cycle.baselineTargetDate || derived.baselineTargetDate;
  let changed = false;
  const missingFields = {
    cycleStartedAt: derived.cycleStartedAt,
    baselineTargetDate,
    baselineTargetAt: getIstMidnightInstant(baselineTargetDate),
  };
  for (const [field, value] of Object.entries(missingFields)) {
    if (cycle[field] != null) continue;
    cycle[field] = value;
    changed = true;
  }
  return changed;
}

function calendarDifference(fromDate, toDate) {
  const from = Date.parse(`${fromDate}T00:00:00.000Z`);
  const to = Date.parse(`${toDate}T00:00:00.000Z`);
  return Math.round((to - from) / DAY_MS);
}

export function getDisciplineRewardCycleCalendarStatus(cycle, now = new Date()) {
  const derived = deriveDisciplineRewardCycleCalendar({
    startDate: cycle.startDate,
    requiredQualifyingDays: cycle.requiredQualifyingDays,
  });
  const baselineTargetDate = cycle.baselineTargetDate || derived.baselineTargetDate;
  const baselineTargetAt = cycle.baselineTargetAt || getIstMidnightInstant(baselineTargetDate);
  const instant = new Date(now);
  const calendarTargetPassed = instant.getTime() >= baselineTargetAt.getTime();
  const remainingQualifyingDays = Math.max(0, cycle.requiredQualifyingDays - cycle.completedQualifyingDays);
  return {
    cycleStartedAt: cycle.cycleStartedAt || derived.cycleStartedAt,
    baselineTargetDate,
    baselineTargetAt,
    calendarDaysRemaining: Math.max(0, calendarDifference(getIstDateKey(instant), baselineTargetDate)),
    calendarTargetPassed,
    calendarStatus: cycle.status === 'completed'
      ? 'completed'
      : calendarTargetPassed && remainingQualifyingDays > 0
        ? 'awaiting-qualification'
        : calendarTargetPassed
          ? 'target-reached'
          : 'countdown',
  };
}
