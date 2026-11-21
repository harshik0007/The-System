function idOf(value) {
  const id = value?._id ?? value?.id ?? value;
  return id == null ? null : String(id);
}

export function toTaskDto(task, { addedEffectiveDate = null } = {}) {
  const action = task.accountabilityAction || {};
  return {
    id: idOf(task),
    scheduleId: idOf(task.taskScheduleId),
    title: task.title,
    name: task.title,
    description: task.description || '',
    cycleDays: [...(task.cycleDays || [])],
    accountabilityAction: {
      title: action.title || '',
      description: action.description || '',
      weakness: action.weakness || '',
    },
    actionTitle: action.title || '',
    actionDescription: action.description || '',
    weakness: action.weakness || '',
    revision: task.revision,
    status: task.status,
    effectiveDate: task.effectiveDate,
    createdEffectiveDate: task.createdEffectiveDate || addedEffectiveDate || null,
    updatedAt: task.updatedAt?.toISOString?.() || null,
  };
}

export function toScheduleDto(schedule, todayDate, todayCycleDay) {
  if (!schedule) return null;
  return {
    id: idOf(schedule),
    cycleLength: schedule.cycleLength,
    cycleAnchorDate: schedule.cycleAnchorDate,
    startDate: schedule.cycleAnchorDate,
    status: schedule.status,
    version: schedule.version,
    effectiveStartDate: schedule.effectiveStartDate,
    effectiveEndDate: schedule.effectiveEndDate || null,
    todayDate,
    todayCycleDay,
  };
}

export function toOccurrenceDto(occurrence) {
  const action = occurrence.snapshot.accountabilityAction?.toObject?.() ?? occurrence.snapshot.accountabilityAction;
  return {
    id: idOf(occurrence),
    taskId: idOf(occurrence.taskId),
    scheduleId: idOf(occurrence.taskScheduleId),
    date: occurrence.occurrenceDate,
    cycleDay: occurrence.cycleDay,
    snapshot: {
      title: occurrence.snapshot.title,
      name: occurrence.snapshot.title,
      description: occurrence.snapshot.description || '',
      accountabilityAction: { ...action },
      actionTitle: action.title,
      actionDescription: action.description,
      weakness: action.weakness || '',
      revision: occurrence.snapshot.revision,
    },
    status: occurrence.status,
    completedAt: occurrence.completedAt?.toISOString?.() || null,
    submission: {
      note: occurrence.submission?.note || '',
      fileName: occurrence.submission?.fileName || '',
    },
    createdAt: occurrence.createdAt?.toISOString?.() || null,
  };
}

export function toTaskSnapshot(task, status = task.status) {
  const action = task.accountabilityAction || {};
  return {
    title: task.title,
    description: task.description || '',
    cycleDays: [...task.cycleDays],
    accountabilityAction: {
      title: action.title || '',
      description: action.description || '',
      weakness: action.weakness || '',
    },
    revision: task.revision,
    status,
  };
}
