export const INITIAL_GRACE_POINTS = 3;
export const RECOVERY_WINDOW_DAYS = 3;
export const ACTIVE_QUEST_LIMIT = 5;

export const RECOVERY_STATUS = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  THRESHOLD_CLEARED: 'threshold-cleared',
});

export function createRecoveryQuestState(demoTasks, activationDate = new Date().toISOString().slice(0, 10)) {
  const task = demoTasks.find((item) => item.id === 'task-04') || demoTasks[0];
  const actionTitle = task?.actionTitle || task?.accountabilityAction || '';
  const actionDescription = task?.actionDescription || task?.accountabilityActionDescription || '';
  const quests = [];

  if (task && actionTitle) {
    quests.push(makeQuest({
      id: 'recovery-demo-missed-task-04',
      occurrenceKey: 'demo:task-04',
      task,
      actionId: task.actionId || `${task.id}-accountability-action`,
      actionTitle,
      actionDescription,
      activationDate,
      remainingDays: 2,
    }));
  }

  return {
    gracePoints: INITIAL_GRACE_POINTS,
    quests,
    gracePointEvents: [],
    activity: [],
  };
}

function makeQuest({ id, occurrenceKey, task, actionId, actionTitle, actionDescription, activationDate, remainingDays = RECOVERY_WINDOW_DAYS }) {
  const elapsedDays = RECOVERY_WINDOW_DAYS - remainingDays;
  return {
    id,
    occurrenceKey,
    originalTaskId: task.id,
    originalTaskName: task.name,
    accountabilityActionId: actionId,
    accountabilityActionTitle: actionTitle,
    accountabilityActionDescription: actionDescription,
    activationDate,
    recoveryWindowDays: RECOVERY_WINDOW_DAYS,
    remainingDays,
    recoveryDay: Math.min(RECOVERY_WINDOW_DAYS, elapsedDays + 1),
    status: RECOVERY_STATUS.ACTIVE,
    completedDate: null,
    expiryDate: null,
    thresholdEventId: null,
    gracePointEventId: null,
  };
}

function addActivity(state, event) {
  return [event, ...state.activity];
}

function gracePointEvent(state, { id, kind, date, questId, title, detail }) {
  const appliedAmount = Math.min(1, Math.max(0, state.gracePoints));
  const event = {
    id,
    kind,
    date,
    questId: questId || null,
    title,
    detail: appliedAmount === 0 ? `${detail} The balance was already at zero and remains there.` : detail,
    amount: 1,
    appliedAmount,
    balanceBefore: state.gracePoints,
    balanceAfter: Math.max(0, state.gracePoints - 1),
  };
  return {
    ...state,
    gracePoints: event.balanceAfter,
    gracePointEvents: [event, ...state.gracePointEvents],
    activity: addActivity(state, event),
  };
}

export function generateRecoveryQuest(state, task, { occurrenceKey, activationDate, actionId } = {}) {
  if (!task || !occurrenceKey) return { state, quest: null, thresholdTriggered: false, duplicate: false };
  const existing = state.quests.find((quest) => quest.occurrenceKey === occurrenceKey);
  if (existing) return { state, quest: existing, thresholdTriggered: false, duplicate: true };

  const actionTitle = task.actionTitle || task.accountabilityAction || '';
  const actionDescription = task.actionDescription || task.accountabilityActionDescription || '';
  if (!actionTitle.trim()) return { state, quest: null, thresholdTriggered: false, duplicate: false };

  const quest = makeQuest({
    id: `recovery-${occurrenceKey}`,
    occurrenceKey,
    task,
    actionId: actionId || task.accountabilityActionId || task.actionId || `${task.id}-accountability-action`,
    actionTitle,
    actionDescription,
    activationDate: activationDate || new Date().toISOString().slice(0, 10),
  });
  let nextState = { ...state, quests: [...state.quests, quest] };
  nextState = { ...nextState, activity: addActivity(nextState, {
    id: `activity-generated-${quest.id}`,
    kind: 'generated',
    date: quest.activationDate,
    questId: quest.id,
    title: 'Recovery Quest activated',
    detail: `Created from the missed task “${quest.originalTaskName}”.`,
  }) };

  const active = nextState.quests.filter((item) => item.status === RECOVERY_STATUS.ACTIVE);
  if (active.length <= ACTIVE_QUEST_LIMIT) return { state: nextState, quest, thresholdTriggered: false, duplicate: false };

  const eventId = `grace-point-threshold-${quest.id}`;
  nextState = gracePointEvent(nextState, {
    id: eventId,
    kind: 'threshold',
    date: quest.activationDate,
    title: 'Recovery Quest Limit Exceeded — -1 Grace Point',
    detail: 'The number of active Recovery Quests exceeded 5. One Grace Point was deducted, and all active Recovery Quests were cleared.',
  });
  nextState.quests = nextState.quests.map((item) => item.status === RECOVERY_STATUS.ACTIVE
    ? { ...item, status: RECOVERY_STATUS.THRESHOLD_CLEARED, clearedDate: quest.activationDate, thresholdEventId: eventId }
    : item);
  return { state: nextState, quest: nextState.quests.find((item) => item.id === quest.id), thresholdTriggered: true, duplicate: false };
}

export function completeRecoveryQuest(state, questId, completionDate = new Date().toISOString().slice(0, 10)) {
  const quest = state.quests.find((item) => item.id === questId && item.status === RECOVERY_STATUS.ACTIVE);
  if (!quest) return state;
  const event = {
    id: `activity-completed-${quest.id}`,
    kind: 'completed',
    date: completionDate,
    questId,
    title: 'Recovery Quest completed',
    detail: `Completed the Accountability Action linked to “${quest.originalTaskName}”. No XP was awarded.`,
  };
  return {
    ...state,
    quests: state.quests.map((item) => item.id === questId
      ? { ...item, status: RECOVERY_STATUS.COMPLETED, completedDate: completionDate }
      : item),
    activity: addActivity(state, event),
  };
}

export function expireRecoveryQuest(state, questId, expiryDate = new Date().toISOString().slice(0, 10)) {
  const quest = state.quests.find((item) => item.id === questId && item.status === RECOVERY_STATUS.ACTIVE);
  if (!quest) return state;
  const eventId = `grace-point-expiry-${quest.id}`;
  let nextState = gracePointEvent(state, {
    id: eventId,
    kind: 'expiry',
    date: expiryDate,
    questId,
    title: 'Recovery Quest expired — -1 Grace Point',
    detail: `“${quest.accountabilityActionTitle}” expired after its Recovery Window.`,
  });
  nextState.quests = nextState.quests.map((item) => item.id === questId
      ? { ...item, status: RECOVERY_STATUS.EXPIRED, expiryDate, gracePointEventId: eventId, remainingDays: 0 }
    : item);
  return nextState;
}
