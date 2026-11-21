import {
  addIstCalendarDays,
  assertIstDateKey,
  getIstDateKey,
  getIstWeekStart,
} from './ist.js';

export const MAX_OCCURRENCE_RANGE_DAYS = 90;
export const WEEKLY_TASK_CHANGE_LIMIT = 3;
export const DAILY_ORIGINAL_TASK_MINIMUM = 7;

export function getCycleAnchorDate(cycleLength, requestedAnchorDate, effectiveDate = getIstDateKey()) {
  if (!Number.isInteger(cycleLength) || cycleLength < 1 || cycleLength > 7) {
    throw new TypeError('Cycle length must be an integer from 1 through 7.');
  }
  assertIstDateKey(effectiveDate);
  if (cycleLength === 7) return getIstWeekStart(effectiveDate);
  return assertIstDateKey(requestedAnchorDate);
}

export function getCycleDayForDateKey(dateKey, cycleLength, cycleAnchorDate) {
  assertIstDateKey(dateKey);
  if (!Number.isInteger(cycleLength) || cycleLength < 1 || cycleLength > 7) return null;
  if (cycleLength === 7) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return ((weekday + 6) % 7) + 1;
  }

  assertIstDateKey(cycleAnchorDate);
  if (dateKey < cycleAnchorDate) return null;
  const [startYear, startMonth, startDay] = cycleAnchorDate.split('-').map(Number);
  const [year, month, day] = dateKey.split('-').map(Number);
  const anchorOrdinal = Date.UTC(startYear, startMonth - 1, startDay) / 86_400_000;
  const dateOrdinal = Date.UTC(year, month - 1, day) / 86_400_000;
  return ((dateOrdinal - anchorOrdinal) % cycleLength) + 1;
}

/** Return the first matching cycle-day occurrence strictly after the current IST date. */
export function getNextEligibleCycleDate({
  now = new Date(),
  cycleLength,
  cycleAnchorDate,
  cycleDays,
  effectiveStartDate,
}) {
  if (!Number.isInteger(cycleLength) || cycleLength < 1 || cycleLength > 7) {
    throw new TypeError('Cycle length must be an integer from 1 through 7.');
  }
  if (!Array.isArray(cycleDays) || cycleDays.length === 0
    || cycleDays.some((day) => !Number.isInteger(day) || day < 1 || day > cycleLength)) {
    throw new TypeError('At least one valid scheduled cycle day is required.');
  }
  if (cycleLength !== 7) assertIstDateKey(cycleAnchorDate);
  if (effectiveStartDate) assertIstDateKey(effectiveStartDate);

  const today = getIstDateKey(now);
  const tomorrow = addIstCalendarDays(today, 1);
  const firstEligibleDate = effectiveStartDate && effectiveStartDate > tomorrow
    ? effectiveStartDate
    : tomorrow;

  for (let offset = 0; offset <= cycleLength; offset += 1) {
    const dateKey = addIstCalendarDays(firstEligibleDate, offset);
    const cycleDay = getCycleDayForDateKey(dateKey, cycleLength, cycleAnchorDate);
    if (cycleDays.includes(cycleDay)) return dateKey;
  }

  throw new RangeError('No eligible scheduled occurrence was found in the configured cycle.');
}

export function getInclusiveDateRange(startDate, endDate, maximumDays = MAX_OCCURRENCE_RANGE_DAYS) {
  assertIstDateKey(startDate);
  assertIstDateKey(endDate);
  if (endDate < startDate) throw new TypeError('The range end must be on or after its start.');
  const dates = [];
  for (let dateKey = startDate; dateKey <= endDate; dateKey = addIstCalendarDays(dateKey, 1)) {
    dates.push(dateKey);
    if (dates.length > maximumDays) throw new RangeError(`A date range may contain at most ${maximumDays} days.`);
  }
  return dates;
}

export function validateTaskDefinition(task, prefix = 'task', cycleLength = 7) {
  const issues = [];
  const title = typeof task?.title === 'string' ? task.title.trim() : '';
  const description = typeof task?.description === 'string' ? task.description.trim() : '';
  const action = task?.accountabilityAction;
  const actionTitle = typeof action?.title === 'string' ? action.title.trim() : '';
  const actionDescription = typeof action?.description === 'string' ? action.description.trim() : '';
  const cycleDays = task?.cycleDays;

  if (!title || title.length > 100) issues.push({ field: `${prefix}.title`, code: 'INVALID_TASK_TITLE' });
  if (description.length > 300) issues.push({ field: `${prefix}.description`, code: 'TASK_DESCRIPTION_TOO_LONG' });
  if (!Array.isArray(cycleDays) || cycleDays.length === 0) {
    issues.push({ field: `${prefix}.cycleDays`, code: 'CYCLE_DAY_REQUIRED' });
  } else {
    if (new Set(cycleDays).size !== cycleDays.length) issues.push({ field: `${prefix}.cycleDays`, code: 'DUPLICATE_CYCLE_DAY' });
    if (cycleDays.some((day) => !Number.isInteger(day) || day < 1 || day > cycleLength)) {
      issues.push({ field: `${prefix}.cycleDays`, code: 'INVALID_CYCLE_DAY' });
    }
  }
  if (!actionTitle || actionTitle.length > 100) issues.push({ field: `${prefix}.accountabilityAction.title`, code: 'ACCOUNTABILITY_ACTION_REQUIRED' });
  if (!actionDescription || actionDescription.length > 300) issues.push({ field: `${prefix}.accountabilityAction.description`, code: 'ACCOUNTABILITY_ACTION_REQUIRED' });
  if (typeof task?.weakness === 'string' && task.weakness.length > 240) issues.push({ field: `${prefix}.weakness`, code: 'WEAKNESS_TOO_LONG' });
  return { valid: issues.length === 0, issues };
}

export function validateScheduleDefinition({ cycleLength, cycleAnchorDate, tasks }) {
  const issues = [];
  const validCycleLength = Number.isInteger(cycleLength) && cycleLength >= 1 && cycleLength <= 7;
  if (!validCycleLength) issues.push({ field: 'cycleLength', code: 'INVALID_CYCLE_LENGTH' });
  if (validCycleLength && cycleLength !== 7) {
    try { assertIstDateKey(cycleAnchorDate); } catch { issues.push({ field: 'cycleAnchorDate', code: 'INVALID_CYCLE_ANCHOR' }); }
  }
  if (!Array.isArray(tasks) || tasks.length < DAILY_ORIGINAL_TASK_MINIMUM) {
    issues.push({ field: 'tasks', code: 'INSUFFICIENT_TASKS' });
    return { valid: false, issues, dayCounts: [] };
  }

  const dayCounts = Array.from({ length: validCycleLength ? cycleLength : 0 }, (_, index) => ({ day: index + 1, count: 0 }));
  tasks.forEach((task, index) => {
    issues.push(...validateTaskDefinition(task, `tasks.${index}`, validCycleLength ? cycleLength : 7).issues);
    for (const day of Array.isArray(task?.cycleDays) ? task.cycleDays : []) {
      if (Number.isInteger(day) && day >= 1 && day <= dayCounts.length) dayCounts[day - 1].count += 1;
    }
  });
  for (const day of dayCounts) {
    if (day.count < DAILY_ORIGINAL_TASK_MINIMUM) issues.push({ field: 'tasks', cycleDay: day.day, code: 'MINIMUM_TASK_COUNT_NOT_MET' });
  }
  return { valid: issues.length === 0, issues, dayCounts };
}

export function validateTaskPatch({ task, patch, cycleLength, activeTasks }) {
  const allowed = new Set(['title', 'description', 'cycleDays', 'accountabilityAction', 'weakness']);
  const keys = Object.keys(patch || {});
  const issues = [];
  if (keys.length === 0 || keys.some((key) => !allowed.has(key))) issues.push({ field: 'task', code: 'INVALID_TASK_PATCH' });
  const next = {
    title: patch.title ?? task.title,
    description: patch.description ?? task.description,
    cycleDays: patch.cycleDays ?? task.cycleDays,
    accountabilityAction: patch.accountabilityAction ?? task.accountabilityAction,
    weakness: patch.weakness ?? task.weakness,
  };
  const candidates = activeTasks
    .filter((item) => String(item._id || item.id) !== String(task._id || task.id))
    .map((item) => ({ ...item, cycleLength }));
  candidates.push({ ...next, cycleLength });
  const validation = validateScheduleDefinition({ cycleLength, cycleAnchorDate: '2000-01-03', tasks: candidates });
  const taskFieldIssues = validation.issues.filter(({ code }) => code !== 'INSUFFICIENT_TASKS' && code !== 'MINIMUM_TASK_COUNT_NOT_MET');
  const coverageIssues = validation.issues.filter(({ code }) => code === 'MINIMUM_TASK_COUNT_NOT_MET');
  return { valid: issues.length === 0 && taskFieldIssues.length === 0 && coverageIssues.length === 0, issues: [...issues, ...taskFieldIssues, ...coverageIssues], next };
}
