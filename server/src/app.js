import express from 'express';
import { config } from './config/env.js';
import { passportInstance } from './config/passport.js';
import { isDatabaseReady } from './config/database.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { createApiV1Router } from './routes/apiV1.js';
import { createAuthSessionMiddleware, createExpressSessionMiddleware } from './services/authSessionService.js';
import { createCsrfProtection } from './middleware/csrfProtection.js';
import { requireAuthenticatedUser } from './middleware/requireAuthenticatedUser.js';

export function createApp({
  databaseReady = isDatabaseReady,
  nodeEnv = config.nodeEnv,
  corsOrigins = config.trustedOrigins,
  trustedOrigins = corsOrigins,
  testIdentityMiddleware,
  sessionMiddleware,
  authIdentityMiddleware,
  passportMiddleware = passportInstance,
} = {}) {
  if (testIdentityMiddleware && nodeEnv !== 'test') {
    throw new Error('Test identity injection is available only when NODE_ENV is test.');
  }
  const resolvedSessionMiddleware = sessionMiddleware || createExpressSessionMiddleware({ nodeEnv });
  const resolvedAuthIdentityMiddleware = authIdentityMiddleware || createAuthSessionMiddleware();
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxyHops > 0) app.set('trust proxy', config.trustProxyHops);
  app.use(requestIdMiddleware);
  app.use(securityHeaders);
  app.use(createCorsMiddleware(corsOrigins));
  app.use(express.json({ limit: config.jsonLimit, strict: true }));

  app.get('/api/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      service: 'the-system-api',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/ready', (request, response) => {
    const ready = Boolean(databaseReady());
    response.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      dependencies: { database: ready ? 'available' : 'unavailable' },
      requestId: request.requestId,
    });
  });

  app.use('/api/v1', resolvedSessionMiddleware);
  app.use('/api/v1', passportMiddleware.initialize());
  app.use('/api/v1', passportMiddleware.session());
  app.use('/api/v1', resolvedAuthIdentityMiddleware);
  // Keep CSRF validation ahead of every API handler so rejected mutations
  // cannot perform domain work before the client refreshes and retries once.
  app.use('/api/v1', createCsrfProtection({ trustedOrigins, nodeEnv, testIdentityInjected: Boolean(testIdentityMiddleware) }));
  app.use('/api/v1', createApiV1Router({ identityMiddleware: testIdentityMiddleware || requireAuthenticatedUser, passport: passportMiddleware }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = createApp();
export default app;
