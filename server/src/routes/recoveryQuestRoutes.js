import { Router } from 'express';
import * as recoveryController from '../controllers/recoveryQuestController.js';

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

export function createRecoveryQuestRouter({ identityMiddleware, controller = recoveryController } = {}) {
  const router = Router();
  router.use(identityMiddleware);
  router.get('/recovery-quests', asyncHandler(controller.listQuests));
  router.get('/recovery-quests/:questId', asyncHandler(controller.getQuest));
  router.post('/recovery-quests/:questId/complete', asyncHandler(controller.completeQuest));
  router.get('/grace-points', asyncHandler(controller.getGracePoints));
  router.get('/grace-points/transactions', asyncHandler(controller.getGracePointTransactions));
  router.get('/progression/current', asyncHandler(controller.getCurrentProgression));
  return router;
}
