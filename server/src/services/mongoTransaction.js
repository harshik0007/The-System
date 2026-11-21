import mongoose from 'mongoose';

/** Runs one logical operation in a transaction, retrying duplicate-key races in a fresh session. */
export async function withMongoTransaction(work, {
  startSession = () => mongoose.startSession(),
  duplicateKeyRetries = 2,
} = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const session = await startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } catch (error) {
      if (error?.code === 11000 && attempt < duplicateKeyRetries) continue;
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
