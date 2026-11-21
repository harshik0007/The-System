import ProgressionRun from '../models/ProgressionRun.js';
import { processRecoveryQuestWorkerUser } from '../services/recoveryQuestService.js';

export function createRecoveryQuestWorker({
  intervalMs = 15_000,
  now = () => new Date(),
  logger = console,
  findActiveUserIds = () => ProgressionRun.distinct('userId', { status: 'active' }),
  processUser = processRecoveryQuestWorkerUser,
} = {}) {
  let timer = null;
  let running = false;
  let stopped = true;

  const runOnce = async () => {
    if (running || stopped) return { skipped: true };
    running = true;
    try {
      const userIds = await findActiveUserIds();
      const results = [];
      for (const userId of userIds) {
        try {
          results.push(await processUser({ userId, now: now() }));
        } catch (error) {
          logger.error?.('[recovery-quest-worker-user-error]', JSON.stringify({ userId: String(userId), name: error?.name || 'Error', message: error?.message || 'Processing failed.' }));
        }
      }
      return { processedUsers: results.length, results };
    } catch (error) {
      logger.error?.('[recovery-quest-worker-error]', JSON.stringify({ name: error?.name || 'Error', message: error?.message || 'Processing failed.' }));
      return { error };
    } finally {
      running = false;
    }
  };

  return Object.freeze({
    start() {
      if (!stopped) return;
      stopped = false;
      void runOnce(); // Startup catch-up after database readiness.
      timer = setInterval(() => { void runOnce(); }, intervalMs);
      timer.unref?.();
    },
    async runNow() { return runOnce(); },
    async stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
      while (running) await new Promise((resolve) => setTimeout(resolve, 5));
    },
    get running() { return running; },
  });
}

export const recoveryQuestWorker = createRecoveryQuestWorker();
