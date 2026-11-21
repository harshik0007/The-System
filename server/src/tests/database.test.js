import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabaseManager } from '../config/database.js';

test('Mongo connection lifecycle shares concurrent attempts, reports readiness and shuts down cleanly', async () => {
  let connectCalls = 0;
  let disconnectCalls = 0;
  let finishConnect;
  const connection = { readyState: 0 };
  const mongooseClient = {
    connection,
    connect: () => {
      connectCalls += 1;
      return new Promise((resolve) => { finishConnect = () => { connection.readyState = 1; resolve(); }; });
    },
    async disconnect() { disconnectCalls += 1; connection.readyState = 0; },
  };
  const manager = createDatabaseManager(mongooseClient, { uri: 'mongodb://test.invalid/db', nodeEnv: 'production' });
  const first = manager.connectDatabase();
  const second = manager.connectDatabase();
  assert.equal(connectCalls, 1);
  assert.equal(manager.isDatabaseReady(), false);
  finishConnect();
  const [firstConnection, secondConnection] = await Promise.all([first, second]);
  assert.equal(firstConnection, connection);
  assert.equal(secondConnection, connection);
  assert.equal(manager.isDatabaseReady(), true);
  await manager.disconnectDatabase();
  assert.equal(disconnectCalls, 1);
  assert.equal(manager.isDatabaseReady(), false);
});

test('Mongo connection can retry after an initial failure and rejects a missing URI', async () => {
  let calls = 0;
  const connection = { readyState: 0 };
  const manager = createDatabaseManager({
    connection,
    async connect() {
      calls += 1;
      if (calls === 1) throw new Error('connection failed');
      connection.readyState = 1;
    },
    async disconnect() { connection.readyState = 0; },
  }, { uri: 'mongodb://test.invalid/db' });

  await assert.rejects(manager.connectDatabase(), /connection failed/);
  assert.equal(manager.isDatabaseReady(), false);
  await manager.connectDatabase();
  assert.equal(calls, 2);
  assert.equal(manager.isDatabaseReady(), true);

  await assert.rejects(createDatabaseManager({ connection: { readyState: 0 }, connect() {} }).connectDatabase(), /not configured/);
});
