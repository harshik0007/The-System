import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecoveryQuestWorker } from '../jobs/recoveryQuestWorker.js';

test('Recovery Quest worker performs startup catch-up, can run on demand, and stops cleanly', async () => {
  const userIds = ['disposable-user'];
  const processed = [];
  const worker = createRecoveryQuestWorker({
    intervalMs: 60_000,
    now: () => new Date('2026-11-19T12:00:00.000Z'),
    logger: { error() {} },
    findActiveUserIds: async () => userIds,
    processUser: async ({ userId, now }) => {
      processed.push({ userId, now: now.toISOString() });
      return { processed: true };
    },
  });

  worker.start();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(processed.length, 1, 'start runs catch-up immediately after worker start.');
  assert.equal(processed[0].now, '2026-11-19T12:00:00.000Z');
  const result = await worker.runNow();
  assert.equal(result.processedUsers, 1);
  assert.equal(processed.length, 2);
  await worker.stop();
  assert.equal(worker.running, false);
  assert.equal((await worker.runNow()).skipped, true, 'Stopped workers do not process users.');
});

test('Recovery Quest worker prevents overlapping cycles', async () => {
  let finish;
  let calls = 0;
  const worker = createRecoveryQuestWorker({
    logger: { error() {} },
    findActiveUserIds: async () => ['user'],
    processUser: async () => {
      calls += 1;
      await new Promise((resolve) => { finish = resolve; });
    },
  });
  worker.start();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal((await worker.runNow()).skipped, true);
  assert.equal(calls, 1);
  finish();
  await worker.stop();
});
