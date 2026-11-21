import { Router } from 'express';
import * as taskController from '../controllers/taskController.js';

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

export function createTaskRouter({ identityMiddleware, controller = taskController } = {}) {
  const router = Router();
  router.use(identityMiddleware);

  router.get('/task-schedules/current', asyncHandler(controller.getSchedule));
  router.post('/task-schedules', asyncHandler(controller.createSchedule));
  router.get('/tasks', asyncHandler(controller.listTasks));
  router.get('/tasks/:taskId', asyncHandler(controller.getTask));
  router.post('/tasks', asyncHandler(controller.addTask));
  router.patch('/tasks/:taskId/reschedule', asyncHandler(controller.rescheduleTask));
  router.patch('/tasks/:taskId', asyncHandler(controller.editTask));
  router.delete('/tasks/:taskId', asyncHandler(controller.deleteTask));
  router.get('/task-occurrences', asyncHandler(controller.listOccurrences));
  router.post('/task-occurrences/ensure', asyncHandler(controller.ensureOccurrences));
  router.post('/task-occurrences/:occurrenceId/complete', asyncHandler(controller.completeOccurrence));
  router.get('/task-schedule-changes/allowance', asyncHandler(controller.getAllowance));

  return router;
}
