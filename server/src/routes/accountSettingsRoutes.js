import { Router } from 'express';
import * as controller from '../controllers/accountSettingsController.js';

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

export function createAccountSettingsRouter({ identityMiddleware } = {}) {
  const router = Router();
  router.use(identityMiddleware);
  router.get('/account/settings', asyncHandler(controller.getSettings));
  router.put('/account/preferences', asyncHandler(controller.savePreferences));
  router.get('/account/reset-preview', asyncHandler(controller.resetPreview));
  router.post('/account/reset-and-restart', asyncHandler(controller.resetAndRestart));
  return router;
}
