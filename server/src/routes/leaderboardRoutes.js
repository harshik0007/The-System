import { Router } from 'express';
import * as controller from '../controllers/leaderboardController.js';

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

export function createLeaderboardRouter({ identityMiddleware } = {}) {
  const router = Router();
  router.get('/leaderboard', identityMiddleware, asyncHandler(controller.getRankings));
  router.get('/leaderboard/profiles/:publicHandle', identityMiddleware, asyncHandler(controller.getPublicProfile));
  router.get('/leaderboard/profile-settings', identityMiddleware, asyncHandler(controller.getProfileSettings));
  router.put('/leaderboard/profile-settings', identityMiddleware, asyncHandler(controller.updateProfileSettings));
  return router;
}
