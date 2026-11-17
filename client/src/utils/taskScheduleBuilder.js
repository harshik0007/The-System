export const CYCLE_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function getIstDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getTaskOccurrenceKey(taskId, cycleDay, dateKey) {
  return `${taskId}:${cycleDay}:${dateKey}`;
}

export function createCycleDays(cycleLength, startDate) {
  return Array.from({ length: cycleLength }, (_, index) => {
    const dayNumber = index + 1;
    if (cycleLength === 7) {
      return { dayNumber, label: CYCLE_WEEKDAYS[index], sublabel: `Calendar Day ${dayNumber}` };
    }

    const date = new Date(`${startDate}T12:00:00`);
    date.setDate(date.getDate() + index);
    const formatted = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
    return { dayNumber, label: `Day ${String(dayNumber).padStart(2, '0')}`, sublabel: formatted };
  });
}

export function getScheduledTasksForDay(tasks, dayNumber) {
  return tasks.filter((task) => task.cycleDays.includes(dayNumber));
}

export function getScheduleValidation(cycleLength, startDate, tasks) {
  const issues = [];
  if (!cycleLength) issues.push({ type: 'cycle', message: 'Choose a recurring cycle length.' });
  if (cycleLength && cycleLength < 7 && !startDate) issues.push({ type: 'date', message: 'Choose the date when Day 1 begins.' });

  const dayCounts = Array.from({ length: cycleLength || 0 }, (_, index) => {
    const dayNumber = index + 1;
    const count = getScheduledTasksForDay(tasks, dayNumber).length;
    return { dayNumber, count, remaining: Math.max(0, 7 - count), valid: count >= 7 };
  });

  for (const day of dayCounts) {
    if (!day.valid) {
      issues.push({ type: 'day', dayNumber: day.dayNumber, message: `Day ${String(day.dayNumber).padStart(2, '0')} needs ${day.remaining} more ${day.remaining === 1 ? 'Task' : 'Tasks'} (minimum 7).` });
    }
  }

  for (const [index, task] of tasks.entries()) {
    if (!task.name.trim()) issues.push({ type: 'task', taskId: task.id, message: `Task ${index + 1} needs a name.` });
    if (!task.cycleDays.length) issues.push({ type: 'task', taskId: task.id, message: `Task “${task.name || `Task ${index + 1}`}” needs at least one cycle day.` });
    if (!task.actionTitle.trim()) issues.push({ type: 'action', taskId: task.id, message: `Add an Accountability Action title for “${task.name || `Task ${index + 1}`}”.` });
    if (!task.actionDescription.trim()) issues.push({ type: 'action', taskId: task.id, message: `Add an Accountability Action description for “${task.name || `Task ${index + 1}`}”.` });
  }

  return { valid: issues.length === 0, issues, dayCounts };
}

export function getCycleDay(date = new Date(), cycleLength = 7, startDate = '') {
  if (cycleLength === 7) {
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(date);
    return CYCLE_WEEKDAYS.indexOf(weekday) + 1;
  }

  if (!startDate) return 1;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const current = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  const start = new Date(`${startDate}T00:00:00Z`);
  const elapsedDays = Math.floor((current - start) / 86_400_000);
  if (elapsedDays <= 0) return 1;
  return (elapsedDays % cycleLength) + 1;
}
