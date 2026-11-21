import { Router } from 'express';
import * as emergencyPauseController from '../controllers/emergencyPauseController.js';

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

export function createEmergencyPauseRouter({ identityMiddleware, controller = emergencyPauseController } = {}) {
  const router = Router();
  router.use(identityMiddleware);
  router.get('/emergency-pause', asyncHandler(controller.getStatus));
  router.post('/emergency-pause/activate', asyncHandler(controller.activate));
  router.post('/emergency-pause/resume', asyncHandler(controller.resume));
  return router;
}
