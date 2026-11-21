import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCoreTaskRequests } from './taskBackendLoader.js';

test('core Task endpoints are requested once and settle independently', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const api = {
    currentSchedule: (options) => { calls.push(['schedule', options.signal]); return Promise.resolve({ schedule: null }); },
    tasks: (options) => { calls.push(['tasks', options.signal]); return Promise.reject(new Error('Tasks unavailable')); },
    allowance: (options) => { calls.push(['allowance', options.signal]); return Promise.resolve({ maximum: 3, used: 0 }); },
  };

  const results = await loadCoreTaskRequests(api, signal);

  assert.deepEqual(calls.map(([name]) => name), ['schedule', 'tasks', 'allowance']);
  assert.ok(calls.every(([, requestSignal]) => requestSignal === signal));
  assert.deepEqual(results.map(({ status }) => status), ['fulfilled', 'rejected', 'fulfilled']);
  assert.equal(results[0].value.schedule, null);
  assert.equal(results[2].value.maximum, 3);
});
