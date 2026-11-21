/** Returns all unique Task occurrences eligible for one IST date/cycle day, without filtering completion status or limiting the list. */
export function selectEligibleTaskOccurrences(occurrences, date, cycleDay) {
  const unique = new Map();
  for (const occurrence of occurrences || []) {
    if (occurrence.date !== date || occurrence.cycleDay !== cycleDay) continue;
    const key = occurrence.taskId ? `${date}:${occurrence.taskId}` : occurrence.id;
    if (key == null || unique.has(String(key))) continue;
    unique.set(String(key), occurrence);
  }
  return [...unique.values()];
}
