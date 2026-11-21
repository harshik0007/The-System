import test from 'node:test';
import assert from 'node:assert/strict';
import { isResetConfirmationReady, RESET_CONFIRMATION_PHRASE, TASK_SCHEDULE_SESSION_KEY } from './systemDataReset.js';

test('manual reset confirmation requires the exact phrase, warning acknowledgement and final confirmation', () => {
  assert.equal(isResetConfirmationReady({ phrase: RESET_CONFIRMATION_PHRASE, hasReadWarning: false, finalConfirmation: true }), false);
  assert.equal(isResetConfirmationReady({ phrase: RESET_CONFIRMATION_PHRASE, hasReadWarning: true, finalConfirmation: false }), false);
  assert.equal(isResetConfirmationReady({ phrase: 'reset my system', hasReadWarning: true, finalConfirmation: true }), false);
  assert.equal(isResetConfirmationReady({ phrase: RESET_CONFIRMATION_PHRASE, hasReadWarning: true, finalConfirmation: true }), true);
});

test('legacy preview state key is retained only for account-scope cleanup', () => {
  assert.equal(TASK_SCHEDULE_SESSION_KEY, 'the-system-discipline-demo-v1');
});
