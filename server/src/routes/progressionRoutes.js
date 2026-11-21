import { Router } from 'express';
import * as controller from '../controllers/progressionController.js';

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

export function createProgressionRouter({ identityMiddleware } = {}) {
  const router = Router();
  router.use(identityMiddleware);
  router.get('/xp/summary', asyncHandler(controller.getXpSummary));
  router.get('/xp/transactions', asyncHandler(controller.getXpTransactions));
  router.get('/ranks', asyncHandler(controller.getRanks));
  router.get('/ranks/current', asyncHandler(controller.getCurrentRank));
  router.get('/ranks/next', asyncHandler(controller.getNextRank));
  return router;
}

