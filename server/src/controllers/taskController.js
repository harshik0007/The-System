import mongoose from 'mongoose';
import {
  archiveTaskInCurrentSchedule,
  addTaskToCurrentSchedule,
  editTaskInCurrentSchedule,
  getTaskForCurrentRun,
  rescheduleTaskInCurrentSchedule,
} from '../services/taskManagementService.js';
import {
  createInitialTaskSchedule,
  getCurrentOccurrences,
  getCurrentTaskAllowance,
  getCurrentTaskSchedule,
  listCurrentTasks,
} from '../services/taskScheduleService.js';
import { completeCurrentTaskOccurrence, ensureOccurrencesForCurrentRun } from '../services/taskOccurrenceService.js';
import { ValidationError } from '../utils/httpErrors.js';
import { requireIdempotencyKey, validateDateRangeRequest, validateScheduleRequest, validateTaskCompletionRequest } from '../validators/taskValidation.js';

function taskIdFrom(request) {
  const { taskId } = request.params;
  if (!mongoose.isValidObjectId(taskId)) {
    throw new ValidationError('The Task identifier is invalid.', [{ field: 'taskId', code: 'INVALID_ID' }]);
  }
  return taskId;
}

function idempotencyKeyFrom(request) {
  return requireIdempotencyKey(request.get('Idempotency-Key'));
}

export async function getSchedule(request, response) {
  response.json(await getCurrentTaskSchedule(request.user.id));
}

export async function createSchedule(request, response) {
  validateScheduleRequest(request.body);
  const result = await createInitialTaskSchedule(request.user.id, request.body, idempotencyKeyFrom(request));
  response.status(result.idempotentReplay ? 200 : 201).json(result);
}

export async function listTasks(request, response) {
  response.json({ tasks: await listCurrentTasks(request.user.id) });
}

export async function getTask(request, response) {
  response.json({ task: await getTaskForCurrentRun(request.user.id, taskIdFrom(request)) });
}

export async function addTask(request, response) {
  const result = await addTaskToCurrentSchedule(request.user.id, request.body, idempotencyKeyFrom(request));
  response.status(result.idempotentReplay ? 200 : 201).json(result);
}

export async function editTask(request, response) {
  const result = await editTaskInCurrentSchedule(request.user.id, taskIdFrom(request), request.body, idempotencyKeyFrom(request));
  response.json(result);
}

export async function rescheduleTask(request, response) {
  const result = await rescheduleTaskInCurrentSchedule(request.user.id, taskIdFrom(request), request.body, idempotencyKeyFrom(request));
  response.json(result);
}

export async function deleteTask(request, response) {
  const result = await archiveTaskInCurrentSchedule(request.user.id, taskIdFrom(request), idempotencyKeyFrom(request));
  response.json(result);
}

export async function listOccurrences(request, response) {
  const extraFields = Object.keys(request.query || {}).filter((field) => !['startDate', 'endDate'].includes(field));
  if (extraFields.length) throw new ValidationError('The occurrence request contains unsupported fields.', extraFields.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
  const { startDate, endDate } = request.query;
  validateDateRangeRequest(startDate, endDate);
  response.json({ occurrences: await getCurrentOccurrences(request.user.id, startDate, endDate) });
}

export async function ensureOccurrences(request, response) {
  const allowed = new Set(['startDate', 'endDate']);
  const extraFields = Object.keys(request.body || {}).filter((field) => !allowed.has(field));
  if (extraFields.length) throw new ValidationError('The occurrence request contains unsupported fields.', extraFields.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
  const { startDate, endDate } = request.body || {};
  validateDateRangeRequest(startDate, endDate);
  const occurrences = await ensureOccurrencesForCurrentRun({ userId: request.user.id, startDate, endDate });
  response.json({ occurrences });
}

export async function completeOccurrence(request, response) {
  const occurrenceId = request.params.occurrenceId;
  if (!mongoose.isValidObjectId(occurrenceId)) {
    throw new ValidationError('The Task occurrence identifier is invalid.', [{ field: 'occurrenceId', code: 'INVALID_ID' }]);
  }
  const submission = validateTaskCompletionRequest(request.body || {});
  const result = await completeCurrentTaskOccurrence({
    userId: request.user.id,
    occurrenceId,
    submission,
    idempotencyKey: idempotencyKeyFrom(request),
  });
  response.json(result);
}

export async function getAllowance(request, response) {
  response.json(await getCurrentTaskAllowance(request.user.id));
}
