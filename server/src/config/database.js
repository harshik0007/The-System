import mongoose from 'mongoose';
import { config } from './env.js';

/** Connect to MongoDB when a future database-backed module requires it. */
export async function connectDatabase(uri = config.mongoUri) {
  if (!uri) {
    throw new Error('MONGODB_URI is not configured.');
  }

  await mongoose.connect(uri);
  return mongoose.connection;
}
