import { Router } from 'express';
import * as controller from '../controllers/notificationController.js';

const asyncHandler = (handler) => (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);

export function createNotificationRouter({ identityMiddleware } = {}) {
  const router = Router();
  router.use(identityMiddleware);
  router.get('/notifications/categories', asyncHandler(controller.categories));
  router.get('/notifications/unread-count', asyncHandler(controller.unreadCount));
  router.get('/notifications', asyncHandler(controller.list));
  router.patch('/notifications/:notificationId/read', asyncHandler(controller.markOneRead));
  router.post('/notifications/read-all', asyncHandler(controller.markAllRead));
  router.get('/notification-preferences', asyncHandler(controller.getPreferences));
  router.patch('/notification-preferences', asyncHandler(controller.updatePreferences));
  return router;
}

export const notificationRouter = createNotificationRouter;
