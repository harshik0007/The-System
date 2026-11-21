import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressionRouter } from '../routes/progressionRoutes.js';
import { getXpTransactions, getRanks } from '../controllers/progressionController.js';

test('progression routes are identity-scoped and expose safe read-only M22 endpoints', () => {
  const identity = (_request, _response, next) => next();
  const router = createProgressionRouter({ identityMiddleware: identity });
  assert.equal(router.stack[0].handle, identity);
  const routes = router.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  assert.deepEqual(routes, [
    'GET /xp/summary',
    'GET /xp/transactions',
    'GET /ranks',
    'GET /ranks/current',
    'GET /ranks/next',
  ]);
  assert.equal(routes.some((route) => route.startsWith('POST ')), false, 'No client-controlled XP award endpoint is exposed.');
});

test('XP history validates pagination and caller-supplied authority fields before database access', async () => {
  const send = () => assert.fail('invalid query must be rejected before service access');
  await assert.rejects(() => getXpTransactions({ query: { userId: 'other' }, user: { id: 'member' } }, { json: send }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(() => getXpTransactions({ query: { limit: '101' }, user: { id: 'member' } }, { json: send }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(() => getXpTransactions({ query: { before: 'not-a-date', beforeId: 'nope' }, user: { id: 'member' } }, { json: send }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(() => getXpTransactions({ query: { before: '2026-11-19T00:00:00.000Z' }, user: { id: 'member' } }, { json: send }), { code: 'VALIDATION_ERROR' });
  const response = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; } };
  await getRanks({ query: {}, user: { id: 'member' } }, response);
  assert.equal(response.body.version, 'm22-v1');
  assert.equal(response.body.ranks.length, 7);
  assert.equal(response.body.ranks.at(-1).entryXpConfigured, false);
});
