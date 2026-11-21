import { getCycleDay, getIstDateKey, getTaskOccurrenceKey } from './taskScheduleBuilder.js';
import { isEmergencyPauseDate } from './emergencyPauseManager.js';

export function addIstCalendarDays(dateKey, amount) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return getIstDateKey(date);
}

export function getRollingActivityDates(todayKey = getIstDateKey(), length = 365) {
  return Array.from({ length }, (_, index) => addIstCalendarDays(todayKey, index - length + 1));
}

export function shouldShowHistoricalResetWarning(record, selectedDate, todayKey) {
  return record?.hasDailyResetRecord === false && selectedDate !== todayKey;
}

function getTaskDefinitionsForDate(schedule, dateKey) {
  const history = schedule.taskHistory || [];
  const currentTasks = schedule?.tasks || [];
  if (!dateKey || (!currentTasks.length && !history.length)) return [];
  const taskIds = new Set([...currentTasks.map((task) => task.id), ...history.map((task) => task.id)]);
  return [...taskIds].map((taskId) => {
    const futureVersions = history.filter((task) => task.id === taskId && task.changedAt > dateKey).sort((a, b) => a.changedAt.localeCompare(b.changedAt));
    if (futureVersions.length) return futureVersions[0];
    return currentTasks.find((task) => task.id === taskId) || history.filter((task) => task.id === taskId).at(-1);
  }).filter(Boolean);
}

export function getScheduleDaySnapshot(schedule, dateKey, { todayKey = getIstDateKey() } = {}) {
  if (!dateKey || (!schedule?.tasks?.length && !schedule?.taskHistory?.length)) return { scheduledTaskCount: 0, completedTaskCount: 0, tasks: [] };
  const date = new Date(`${dateKey}T12:00:00Z`);
  const cycleDay = getCycleDay(date, schedule.cycleLength, schedule.startDate);
  const tasks = getTaskDefinitionsForDate(schedule, dateKey)
    .filter((task) => (task.cycleDays || []).includes(cycleDay))
    .map((task) => {
      const occurrenceKey = getTaskOccurrenceKey(task.id, cycleDay, dateKey);
      const occurrence = schedule.occurrences?.[occurrenceKey];
      const status = occurrence?.status || 'scheduled';
      return { id: task.id, status, occurrenceKey };
    });
  return {
    scheduledTaskCount: tasks.length,
    completedTaskCount: tasks.filter((task) => task.status === 'completed').length,
    tasks,
  };
}

export function countRecoveryQuestsActiveOnDate(recoveryState, dateKey) {
  return (recoveryState?.quests || []).filter((quest) => {
    if (!quest.activationDate || quest.activationDate > dateKey) return false;
    if (quest.completedDate && quest.completedDate <= dateKey) return false;
    if (quest.expiryDate && quest.expiryDate <= dateKey) return false;
    if (quest.clearedDate && quest.clearedDate <= dateKey) return false;
    return quest.status === 'active' || ['completed', 'expired', 'threshold-cleared'].includes(quest.status);
  }).length;
}

export function getVisibleActivityRecord({ dateKey, disciplineState, schedule, todayKey = getIstDateKey(), emergencyPauseDates = [], emergencyPauseState }) {
  if (dateKey < disciplineState.memberSince || dateKey > todayKey) return null;
  const savedRecord = disciplineState.dailyRecords[dateKey];
  const emergencyPause = emergencyPauseDates.includes(dateKey) || isEmergencyPauseDate(emergencyPauseState, dateKey);
  if (savedRecord) return emergencyPause && !savedRecord.emergencyPause
    ? { ...savedRecord, emergencyPause: true, qualifies: true, qualificationStatus: 'emergency-pause-protected' }
    : savedRecord;
  const taskSnapshot = getScheduleDaySnapshot(schedule, dateKey, { todayKey });
  const isCurrentDay = dateKey === todayKey;
  const qualifies = emergencyPause || taskSnapshot.completedTaskCount >= 5;
  return {
    date: dateKey,
    scheduledTaskCount: taskSnapshot.scheduledTaskCount,
    completedTaskCount: taskSnapshot.completedTaskCount,
    completionPercent: taskSnapshot.scheduledTaskCount ? Math.round(taskSnapshot.completedTaskCount / taskSnapshot.scheduledTaskCount * 100) : 0,
    qualifies,
    qualificationStatus: emergencyPause
      ? 'emergency-pause-protected'
      : qualifies
        ? 'qualified'
        : isCurrentDay
          ? 'in-progress'
          : 'unrecorded',
    emergencyPause,
    xpDrained: 0,
    dailyRankXpAwarded: 0,
    dpRewardAwarded: 0,
    hasDailyResetRecord: false,
  };
}

export function getActivityQualificationLabel(record, dateKey, todayKey = getIstDateKey()) {
  if (record?.emergencyPause || record?.qualificationStatus === 'emergency-pause-protected') return 'Protected';
  if (record?.qualificationStatus === 'qualified' || record?.qualifies) return 'Qualified';
  if (record?.qualificationStatus === 'not-qualified') return 'Not qualified';
  if (dateKey === todayKey && record?.qualificationStatus === 'in-progress') return 'In Progress';
  return 'No reset record';
}
