import { ValidationError } from '../utils/httpErrors.js';
import { getInclusiveDateRange, validateScheduleDefinition, validateTaskDefinition, validateTaskPatch } from '../utils/taskCycle.js';

const SCHEDULE_FIELDS = new Set(['cycleLength', 'cycleAnchorDate', 'tasks']);
const TASK_FIELDS = new Set(['title', 'description', 'cycleDays', 'accountabilityAction', 'weakness']);
const ACTION_FIELDS = new Set(['title', 'description', 'weakness']);
const SUBMISSION_FIELDS = new Set(['note', 'fileName']);

function unknownFields(value, allowed, prefix = '') {
  return Object.keys(value || {}).filter((key) => !allowed.has(key)).map((key) => ({ field: `${prefix}${key}`, code: 'FIELD_NOT_ALLOWED' }));
}

export function requireIdempotencyKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (key.length < 8 || key.length > 160) {
    throw new ValidationError('A valid Idempotency-Key header is required.', [{ field: 'Idempotency-Key', code: 'IDEMPOTENCY_KEY_REQUIRED' }]);
  }
  return key;
}

export function validateScheduleRequest(body) {
  const issues = unknownFields(body, SCHEDULE_FIELDS);
  const normalizedTasks = Array.isArray(body?.tasks) ? body.tasks : [];
  for (const [index, task] of normalizedTasks.entries()) {
    issues.push(...unknownFields(task, TASK_FIELDS, `tasks.${index}.`));
    issues.push(...unknownFields(task?.accountabilityAction, ACTION_FIELDS, `tasks.${index}.accountabilityAction.`));
  }
  const validation = validateScheduleDefinition({
    cycleLength: body?.cycleLength,
    cycleAnchorDate: body?.cycleAnchorDate,
    tasks: normalizedTasks,
  });
  issues.push(...validation.issues);
  if (issues.length) throw new ValidationError('Review the schedule fields and cycle-day assignments.', issues);
}

export function validateTaskRequest(body, cycleLength) {
  const issues = unknownFields(body, TASK_FIELDS);
  issues.push(...unknownFields(body?.accountabilityAction, ACTION_FIELDS, 'accountabilityAction.'));
  issues.push(...validateTaskDefinition(body, 'task', cycleLength).issues);
  if (issues.length) throw new ValidationError('Review the Task and Accountability Action fields.', issues);
}

export function validateTaskPatchRequest({ currentTask, patch, cycleLength, activeTasks }) {
  return validateTaskRescheduleRequest({ currentTask, patch, cycleLength, activeTasks });
}

export function validateTaskEditRequest({ currentTask, patch }) {
  const editFields = new Set(['title', 'description', 'accountabilityAction']);
  const issues = unknownFields(patch, editFields);
  if (Object.hasOwn(patch || {}, 'accountabilityAction')) {
    issues.push(...unknownFields(patch.accountabilityAction, new Set(['title', 'description']), 'accountabilityAction.'));
  }
  const next = {
    title: patch?.title ?? currentTask.title,
    description: patch?.description ?? currentTask.description,
    cycleDays: currentTask.cycleDays,
    accountabilityAction: {
      title: patch?.accountabilityAction?.title ?? currentTask.accountabilityAction.title,
      description: patch?.accountabilityAction?.description ?? currentTask.accountabilityAction.description,
      weakness: currentTask.accountabilityAction.weakness || '',
    },
    weakness: currentTask.accountabilityAction.weakness || '',
  };
  const taskIssues = validateTaskDefinition(next, 'task', Math.max(...currentTask.cycleDays, 1)).issues;
  if (!Object.keys(patch || {}).length) issues.push({ field: 'task', code: 'INVALID_TASK_PATCH' });
  issues.push(...taskIssues);
  if (issues.length) throw new ValidationError('Review the Task edit fields.', issues);
  return next;
}

export function validateTaskRescheduleRequest({ currentTask, patch, cycleLength, activeTasks }) {
  const issues = unknownFields(patch, new Set(['cycleDays']));
  const validation = validateTaskPatch({ task: currentTask, patch: patch || {}, cycleLength, activeTasks });
  issues.push(...validation.issues);
  if (issues.length) throw new ValidationError('Review the new cycle-day assignments and minimums.', issues);
  return validation.next;
}

export function validateDateRangeRequest(startDate, endDate) {
  try {
    getInclusiveDateRange(startDate, endDate);
  } catch {
    throw new ValidationError('Both dates must form a valid canonical IST date range of no more than 90 days.', [{ field: 'dateRange', code: 'INVALID_DATE_RANGE' }]);
  }
}

export function validateTaskCompletionRequest(body = {}) {
  const issues = unknownFields(body, SUBMISSION_FIELDS);
  for (const field of SUBMISSION_FIELDS) {
    const value = body[field];
    if (value !== undefined && typeof value !== 'string') {
      issues.push({ field, code: 'INVALID_TYPE' });
    } else if (typeof value === 'string' && value.length > (field === 'note' ? 2000 : 255)) {
      issues.push({ field, code: 'TOO_LONG' });
    }
  }
  if (issues.length) throw new ValidationError('Review the optional completion details.', issues);
  return {
    note: typeof body.note === 'string' ? body.note.trim() : '',
    fileName: typeof body.fileName === 'string' ? body.fileName.trim() : '',
  };
}
