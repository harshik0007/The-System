import { runMonthlyAnalysisWorkerOnce } from '../services/monthlyAnalysisService.js';

export function createMonthlyAnalysisWorker({ intervalMs = 60_000, logger = console, processOnce = runMonthlyAnalysisWorkerOnce } = {}) {
  let timer = null;
  let stopped = true;
  let running = false;
  const runOnce = async () => {
    if (stopped || running) return { skipped: true };
    running = true;
    try { return await processOnce({ logger }); }
    catch (error) {
      logger.error?.(`[monthly-analysis-worker-error] ${JSON.stringify({ name: error?.name || 'Error', message: error?.message || 'Worker failed.' })}`);
      return { error };
    } finally { running = false; }
  };
  return Object.freeze({
    start() {
      if (!stopped) return;
      stopped = false;
      void runOnce();
      timer = setInterval(() => { void runOnce(); }, intervalMs);
      timer.unref?.();
    },
    runNow() { return runOnce(); },
    async stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
      while (running) await new Promise((resolve) => setTimeout(resolve, 5));
    },
    get running() { return running; },
  });
}

export const monthlyAnalysisWorker = createMonthlyAnalysisWorker();
