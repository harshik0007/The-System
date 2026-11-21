export const IST_TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET_MINUTES = 330;
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

function asValidDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('A valid date or instant is required.');
  return date;
}

function partsFor(date, options) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    ...options,
  }).formatToParts(date).map(({ type, value }) => [type, value]));
}

export function isValidIstDateKey(value) {
  if (typeof value !== 'string' || !dateKeyPattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function assertIstDateKey(value) {
  if (!isValidIstDateKey(value)) throw new TypeError('Date keys must be valid YYYY-MM-DD calendar dates.');
  return value;
}

export function getIstDateKey(value = new Date()) {
  const date = asValidDate(value);
  const { year, month, day } = partsFor(date, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${year}-${month}-${day}`;
}

export function getIstMonthKey(value = new Date()) {
  return getIstDateKey(value).slice(0, 7);
}

export function getIstWeekStart(dateKey = getIstDateKey()) {
  assertIstDateKey(dateKey);
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function getNextIstMidnight(value = new Date()) {
  const today = getIstDateKey(value);
  const [year, month, day] = today.split('-').map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextKey = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDay.getUTCDate()).padStart(2, '0')}`;
  return getIstMidnightInstant(nextKey);
}

export function getIstMidnightInstant(dateKey) {
  assertIstDateKey(dateKey);
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MINUTES * 60_000);
}

export function addIstCalendarDays(dateKey, amount) {
  assertIstDateKey(dateKey);
  if (!Number.isInteger(amount)) throw new TypeError('Calendar-day offsets must be integers.');
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function getNextIstWeekReset(value = new Date()) {
  return getIstMidnightInstant(addIstCalendarDays(getIstWeekStart(getIstDateKey(value)), 7));
}

export function compareIstDateKeys(left, right) {
  assertIstDateKey(left);
  assertIstDateKey(right);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function formatIstDateKey(dateKey, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  assertIstDateKey(dateKey);
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', ...options }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
