import { addIstCalendarDays, getIstDateKey, getIstMidnightInstant, isValidIstDateKey } from './ist.js';

const monthKeyPattern = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function assertMonthKey(monthKey) {
  if (typeof monthKey !== 'string' || !monthKeyPattern.test(monthKey)) throw new TypeError('month must use YYYY-MM format.');
  return monthKey;
}

export function shiftMonthKey(monthKey, offset) {
  assertMonthKey(monthKey);
  if (!Number.isInteger(offset)) throw new TypeError('Month offset must be an integer.');
  const [year, month] = monthKey.split('-').map(Number);
  const instant = new Date(Date.UTC(year, month - 1 + offset, 1, 12));
  return `${instant.getUTCFullYear()}-${String(instant.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getIstMonthBounds(monthKey) {
  assertMonthKey(monthKey);
  const startDate = `${monthKey}-01`;
  const nextMonth = shiftMonthKey(monthKey, 1);
  const endDate = `${nextMonth}-01`;
  return { monthKey, startDate, endDate, startAt: getIstMidnightInstant(startDate), endAt: getIstMidnightInstant(endDate) };
}

export function getDetailExpiry(monthKey) {
  return getIstMonthBounds(shiftMonthKey(monthKey, 2)).startAt;
}

export function getRetainedMonthKeys(now = new Date()) {
  const current = getIstDateKey(now).slice(0, 7);
  return [shiftMonthKey(current, -1), current];
}

export function isDetailRetained(monthKey, now = new Date()) {
  return getRetainedMonthKeys(now).includes(assertMonthKey(monthKey));
}

export function dateKeyRangeForInstantInterval(start, end) {
  const startAt = new Date(start);
  const endAt = new Date(end);
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt) return [];
  const lastIncluded = new Date(endAt.getTime() - 1);
  let date = getIstDateKey(startAt);
  const finalDate = getIstDateKey(lastIncluded);
  const result = [];
  while (date <= finalDate) {
    result.push(date);
    date = addIstCalendarDays(date, 1);
  }
  return result;
}

export function monthDateBounds(monthKey, runStartedOn, now = new Date(), runEndedOn = null) {
  const month = getIstMonthBounds(monthKey);
  const today = getIstDateKey(now);
  const coveredFrom = runStartedOn > month.startDate ? runStartedOn : month.startDate;
  const lastCalendarDate = addIstCalendarDays(month.endDate, -1);
  const periodEnd = runEndedOn && runEndedOn < lastCalendarDate ? runEndedOn : lastCalendarDate;
  const coveredThrough = periodEnd > today ? today : periodEnd;
  return { ...month, coveredFrom, coveredThrough, partial: monthKey >= getIstDateKey(now).slice(0, 7) && !runEndedOn };
}

export function validMonthDateRange(monthKey, startDate, endDate) {
  assertMonthKey(monthKey);
  return isValidIstDateKey(startDate) && isValidIstDateKey(endDate) && startDate <= endDate;
}
