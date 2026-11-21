import { Router } from 'express';
import * as controller from '../controllers/monthlyAnalysisController.js';

const asyncHandler = (handler) => (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);

export function createMonthlyAnalysisRouter({ identityMiddleware } = {}) {
  const router = Router();
  router.use(identityMiddleware);
  router.get('/monthly-analysis/current', asyncHandler(controller.getCurrent));
  router.get('/monthly-analysis/previous', asyncHandler(controller.getPrevious));
  router.get('/monthly-analysis/months', asyncHandler(controller.getMonths));
  router.get('/monthly-analysis/compare', asyncHandler(controller.compare));
  router.get('/monthly-analysis/reminders', asyncHandler(controller.getReminders));
  router.get('/monthly-analysis/:monthKey/details', asyncHandler(controller.getDetails));
  router.get('/monthly-analysis/:monthKey/pdf', asyncHandler(controller.downloadPdf));
  router.get('/monthly-analysis/:monthKey', asyncHandler(controller.getSummary));
  return router;
}

export const monthlyAnalysisRouter = createMonthlyAnalysisRouter;
