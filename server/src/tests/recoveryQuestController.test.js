import test from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentProgression, getGracePoints, listQuests } from '../controllers/recoveryQuestController.js';

test('Recovery Quest and progression read APIs reject caller-supplied identity queries', async () => {
  const request = { query: { userId: 'another-member' }, user: { id: 'resolved-member' } };
  for (const handler of [listQuests, getGracePoints, getCurrentProgression]) {
    await assert.rejects(() => handler(request, { json() { assert.fail('invalid query must be rejected before database access'); } }), {
      code: 'VALIDATION_ERROR',
    });
  }
});

test('Grace Point transaction history allows only a bounded limit query', async () => {
  const { getGracePointTransactions } = await import('../controllers/recoveryQuestController.js');
  await assert.rejects(() => getGracePointTransactions({ query: { userId: 'another-member' }, user: { id: 'resolved-member' } }, {}), {
    code: 'VALIDATION_ERROR',
  });
  await assert.rejects(() => getGracePointTransactions({ query: { limit: '101' }, user: { id: 'resolved-member' } }, {}), {
    code: 'VALIDATION_ERROR',
  });
});
