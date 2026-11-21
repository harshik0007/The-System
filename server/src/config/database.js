import mongoose from 'mongoose';
import { config } from './env.js';

export function createDatabaseManager(mongooseClient, { uri, nodeEnv = 'development' } = {}) {
  let connectionAttempt;

  async function connectDatabase(targetUri = uri) {
    if (!targetUri) throw new Error('MONGODB_URI is not configured.');
    if (mongooseClient.connection.readyState === 1) return mongooseClient.connection;
    if (connectionAttempt) return connectionAttempt;

    connectionAttempt = mongooseClient.connect(targetUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: nodeEnv !== 'production',
    }).then(() => mongooseClient.connection).finally(() => {
      connectionAttempt = undefined;
    });

    return connectionAttempt;
  }

  async function disconnectDatabase() {
    if (connectionAttempt) {
      try {
        await connectionAttempt;
      } catch {
        // An unavailable initial connection is already represented by readiness=false.
      }
    }
    if (mongooseClient.connection.readyState !== 0) await mongooseClient.disconnect();
  }

  return Object.freeze({
    connectDatabase,
    isDatabaseReady: () => mongooseClient.connection.readyState === 1,
    disconnectDatabase,
  });
}

const databaseManager = createDatabaseManager(mongoose, {
  uri: config.mongoUri,
  nodeEnv: config.nodeEnv,
});

export const { connectDatabase, isDatabaseReady, disconnectDatabase } = databaseManager;
