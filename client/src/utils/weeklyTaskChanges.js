const IST_ZONE = 'Asia/Kolkata';

function getIstDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function addDays(dateKey, amount) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dateFromKey(dateKey) {
  return new Date(`${dateKey}T12:00:00Z`);
}

function formatDate(dateKey, options) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: IST_ZONE, ...options }).format(dateFromKey(dateKey));
}

export function getWeeklyChangePeriod(referenceDate = new Date()) {
  const parts = typeof referenceDate === 'string'
    ? Object.fromEntries(referenceDate.split('-').map((value, index) => [['year', 'month', 'day'][index], value]))
    : getIstDateParts(referenceDate);
  const currentKey = `${parts.year}-${parts.month}-${parts.day}`;
  const date = dateFromKey(currentKey);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  const weekStartDate = addDays(currentKey, -mondayOffset);
  const weekEndDate = addDays(weekStartDate, 6);
  const nextResetDate = addDays(weekStartDate, 7);
  const start = dateFromKey(weekStartDate);
  const end = dateFromKey(weekEndDate);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const startLabel = formatDate(weekStartDate, { day: 'numeric', ...(sameMonth ? {} : { month: 'short' }), ...(!sameYear ? { year: 'numeric' } : {}) });
  const endLabel = formatDate(weekEndDate, { day: 'numeric', month: 'short', year: 'numeric' });

  return {
    weekStartDate,
    weekEndDate,
    nextResetDate,
    rangeLabel: `${startLabel}–${endLabel}`,
    nextResetLabel: formatDate(nextResetDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
  };
}

export function getWeeklyChangeAllowance(allowance, referenceDate = new Date()) {
  const period = getWeeklyChangePeriod(referenceDate);
  const sameWeek = allowance?.weekStartDate === period.weekStartDate;
  const maximum = Math.max(0, Number(allowance?.maximum) || 3);
  const used = sameWeek ? Math.min(maximum, Math.max(0, Number(allowance?.used) || 0)) : 0;
  return { ...period, maximum, used, remaining: maximum - used };
}

export function consumeWeeklyChange(allowance, referenceDate = new Date()) {
  const current = getWeeklyChangeAllowance(allowance, referenceDate);
  if (current.remaining < 1) return { allowed: false, allowance };
  return {
    allowed: true,
    allowance: { maximum: current.maximum, used: current.used + 1, weekStartDate: current.weekStartDate },
    current,
  };
}
