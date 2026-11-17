export function getDailyTaskMetrics(tasks) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const submitted = tasks.filter((task) => task.status === 'submitted').length;
  const scheduled = tasks.filter((task) => task.status === 'scheduled').length;
  const missed = tasks.filter((task) => task.status === 'missed').length;
  const percentage = total ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    submitted,
    scheduled,
    missed,
    remaining: Math.max(0, total - completed),
    percentage,
  };
}

export function getIstScheduleContext(date = new Date(), cycleLength = 7, cycleDayOneDate) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const weekdayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const weekdayIndex = Math.max(0, weekdayOrder.indexOf(values.weekday));
  const safeLength = Math.max(1, Math.min(7, Number(cycleLength) || 7));

  let cycleDay;
  if (safeLength === 7) {
    cycleDay = weekdayIndex + 1;
  } else {
    const startDate = cycleDayOneDate ? new Date(`${cycleDayOneDate}T00:00:00Z`) : new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
    const currentDate = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
    const elapsedDays = Math.floor((currentDate - startDate) / 86_400_000);
    cycleDay = ((elapsedDays % safeLength) + safeLength) % safeLength + 1;
  }

  const scheduleDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

  return { weekday: values.weekday, scheduleDate, cycleDay, cycleLength: safeLength };
}
