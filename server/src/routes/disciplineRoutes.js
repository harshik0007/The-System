import { Router } from 'express';
import * as controller from '../controllers/disciplineController.js';

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

export function createDisciplineRouter({ identityMiddleware } = {}) {
  const router = Router();
  router.use(identityMiddleware);
  router.get('/discipline/summary', asyncHandler(controller.getSummary));
  router.get('/discipline/calendar', asyncHandler(controller.getCalendar));
  router.get('/discipline/reward-cycle', asyncHandler(controller.getRewardCycle));
  router.get('/discipline/transactions', asyncHandler(controller.getTransactions));
  router.get('/discipline-points', asyncHandler(controller.getWallet));
  router.post('/discipline-points/redeem', asyncHandler(controller.redeem));
  return router;
}

