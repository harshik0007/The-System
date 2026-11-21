import { Router } from 'express';
import { requireAuthenticatedUser } from '../middleware/requireAuthenticatedUser.js';
import { createAuthRouter } from './authRoutes.js';
import { createTaskRouter } from './taskRoutes.js';
import { createRecoveryQuestRouter } from './recoveryQuestRoutes.js';
import { createProgressionRouter } from './progressionRoutes.js';
import { createDisciplineRouter } from './disciplineRoutes.js';
import { createEmergencyPauseRouter } from './emergencyPauseRoutes.js';
import { createMonthlyAnalysisRouter } from './monthlyAnalysisRoutes.js';
import { createLeaderboardRouter } from './leaderboardRoutes.js';
import { createNotificationRouter } from './notificationRoutes.js';
import { createAccountSettingsRouter } from './accountSettingsRoutes.js';

export function createApiV1Router({ identityMiddleware = requireAuthenticatedUser, authController, passport } = {}) {
  const router = Router();
  router.use(createAuthRouter({ identityMiddleware, ...(authController ? { controller: authController } : {}), ...(passport ? { passport } : {}) }));
  router.use(createTaskRouter({ identityMiddleware }));
  router.use(createRecoveryQuestRouter({ identityMiddleware }));
  router.use(createProgressionRouter({ identityMiddleware }));
  router.use(createDisciplineRouter({ identityMiddleware }));
  router.use(createEmergencyPauseRouter({ identityMiddleware }));
  router.use(createMonthlyAnalysisRouter({ identityMiddleware }));
  router.use(createLeaderboardRouter({ identityMiddleware }));
  router.use(createNotificationRouter({ identityMiddleware }));
  router.use(createAccountSettingsRouter({ identityMiddleware }));
  return router;
}
