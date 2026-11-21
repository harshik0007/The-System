import test from 'node:test';
import assert from 'node:assert/strict';
import { createDisciplineRouter } from '../routes/disciplineRoutes.js';
import { getCalendar, getSummary, redeem } from '../controllers/disciplineController.js';

test('Discipline routes use the resolved identity and expose only approved read/redeem actions', () => {
  const identity = (_request, _response, next) => next();
  const router = createDisciplineRouter({ identityMiddleware: identity });
  assert.equal(router.stack[0].handle, identity);
  const routes = router.stack.filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  assert.deepEqual(routes, [
    'GET /discipline/summary',
    'GET /discipline/calendar',
    'GET /discipline/reward-cycle',
    'GET /discipline/transactions',
    'GET /discipline-points',
    'POST /discipline-points/redeem',
  ]);
});

test('Discipline controllers reject authority fields and invalid inputs before database access', async () => {
  const response = { json: () => assert.fail('invalid input must not reach a service response') };
  await assert.rejects(() => getSummary({ query: { userId: 'another-user' }, user: { id: 'resolved-user' } }, response), { code: 'VALIDATION_ERROR' });
  await assert.rejects(() => getCalendar({ query: { startDate: '2026-11-19' }, user: { id: 'resolved-user' } }, response), { code: 'VALIDATION_ERROR' });
  await assert.rejects(() => getCalendar({ query: { userId: 'another-user' }, user: { id: 'resolved-user' } }, response), { code: 'VALIDATION_ERROR' });
  await assert.rejects(() => redeem({
    query: {},
    body: { amount: 100 },
    get: () => 'valid-idempotency-key',
    user: { id: 'resolved-user' },
  }, { status: () => response, json: response.json }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(() => redeem({
    query: {},
    body: {},
    get: () => undefined,
    user: { id: 'resolved-user' },
  }, { status: () => response, json: response.json }), { code: 'VALIDATION_ERROR' });
});
