import { pathToFileURL } from 'node:url';
import { config } from './config/env.js';
import app from './app.js';
import { connectDatabase, disconnectDatabase, isDatabaseReady } from './config/database.js';
import { recoveryQuestWorker } from './jobs/recoveryQuestWorker.js';
import { monthlyAnalysisWorker } from './jobs/monthlyAnalysisWorker.js';
import { initializeAuthStorage } from './services/authStorage.js';
import { inspectPortOwners } from './utils/portOwner.js';

const RETRY_DELAY_MS = 5000;

function redactStartupValue(value) {
  return String(value || '')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, '[redacted MongoDB URI]')
    .replace(/\bBearer\s+[^\s"'`]+/gi, 'Bearer [redacted]')
    .replace(/((?:[a-z0-9_-]*(?:password|secret|token|api[_-]?key)|password|secret|token|api[_-]?key)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/(\s--?(?:password|secret|token|api[_-]?key|client-secret)(?:=|\s+))(?:"[^"]*"|'[^']*'|\S+)/gi, '$1[redacted]');
}

export function logStartupError(error, { nodeEnv = config.nodeEnv, logger = console.error } = {}) {
  const details = {
    errorName: error?.name || 'Error',
    code: error?.code || null,
    message: redactStartupValue(error?.message || 'No error message provided.'),
  };
  if (nodeEnv === 'development' && error?.stack) details.stack = redactStartupValue(error.stack);
  logger('[api-startup-error]', JSON.stringify(details));
}

export async function startServer() {
  let server;
  try {
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(config.port, config.host, () => resolve(listener));
      listener.once('error', reject);
    });
  } catch (error) {
    if (error?.code === 'EADDRINUSE') {
      const { owners, inspectionError } = await inspectPortOwners(config.port);
      if (owners.length) {
        const details = owners.map((owner) => {
          const identity = [owner.processName, owner.executablePath, owner.commandLine]
            .filter(Boolean)
            .map(redactStartupValue)
            .join(' | ');
          return `PID ${owner.pid}${identity ? ` (${identity})` : ''}`;
        }).join('; ');
        console.error(`[api-port-conflict] Port ${config.port} on ${config.host} is owned by ${details}. No process was stopped.`);
      } else {
        console.error(`[api-port-conflict] Port ${config.port} on ${config.host} is occupied, but its owner could not be inspected${inspectionError ? ` (${redactStartupValue(inspectionError)})` : ''}. No process was stopped.`);
      }
    }
    throw error;
  }

  const listenerAddress = server.address();
  const listeningPort = typeof listenerAddress === 'object' && listenerAddress ? listenerAddress.port : config.port;
  console.info(`THE SYSTEM API listening on ${config.host}:${listeningPort}.`);
  let retryTimer;
  let stopping = false;
  let authStorageReady = false;

  const connectWithRetry = async () => {
    if (stopping) return;
    try {
      if (!isDatabaseReady()) await connectDatabase();
      if (!authStorageReady) {
        await initializeAuthStorage();
        authStorageReady = true;
      }
      console.info('THE SYSTEM API database connection is ready.');
      recoveryQuestWorker.start();
      monthlyAnalysisWorker.start();
    } catch (error) {
      logStartupError(error);
      console.warn(`THE SYSTEM API database is unavailable; readiness is degraded. Retrying the database connection in ${RETRY_DELAY_MS}ms.`);
      if (!stopping) {
        retryTimer = setTimeout(connectWithRetry, RETRY_DELAY_MS);
        retryTimer.unref?.();
      }
    }
  };

  void connectWithRetry();

  const close = async () => {
    if (stopping) return;
    stopping = true;
    clearTimeout(retryTimer);
    await recoveryQuestWorker.stop();
    await monthlyAnalysisWorker.stop();
    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  };

  return { server, close };
}

const isMainModule = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  startServer().then(({ close }) => {
    let closing = false;
    const shutdown = async (signal) => {
      if (closing) return;
      closing = true;
      console.info(`THE SYSTEM API received ${signal}; shutting down.`);
      try {
        await close();
      } catch {
        console.error('THE SYSTEM API shutdown encountered an error.');
        process.exitCode = 1;
      }
    };
    process.once('SIGINT', () => void shutdown('SIGINT'));
    process.once('SIGTERM', () => void shutdown('SIGTERM'));
  }).catch((error) => {
    logStartupError(error);
    process.exitCode = 1;
  });
}
