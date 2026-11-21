import test from 'node:test';
import assert from 'node:assert/strict';
import { isStrongPassword, validatePasswordChange } from './authValidation.js';

test('password change requires all fields', () => {
  assert.deepEqual(validatePasswordChange(), {
    currentPassword: 'Enter your current password.',
    newPassword: 'Enter a new password.',
    confirmPassword: 'Confirm your new password.',
  });
});

test('password change accepts a matching password that follows the exact composition policy', () => {
  assert.deepEqual(validatePasswordChange({
    currentPassword: 'OldPassword123456!',
    newPassword: 'NewPassword123456!',
    confirmPassword: 'NewPassword123456!',
  }), {});
});

test('password change rejects a weak, mismatched or unchanged password', () => {
  assert.deepEqual(validatePasswordChange({ currentPassword: 'OldPassword123456!', newPassword: 'weak', confirmPassword: 'different' }), {
    newPassword: 'Meet each password requirement.',
    confirmPassword: 'Passwords do not match.',
  });
  assert.deepEqual(validatePasswordChange({ currentPassword: 'OldPassword123456!', newPassword: 'OldPassword123456!', confirmPassword: 'OldPassword123456!' }), {
    newPassword: 'Your new password must differ from your current password.',
  });
});

test('password policy implements the exact 8-character minimum and four composition checks', () => {
  assert.equal(isStrongPassword('abc123!x'), true);
  assert.equal(isStrongPassword('Abcdef1!'), true);
  assert.equal(isStrongPassword('a234567!'), true);
  assert.equal(isStrongPassword('abc123!!'), true);
  assert.equal(isStrongPassword('abcdefgh'), false);
  assert.equal(isStrongPassword('abcd1234'), false);
  assert.equal(isStrongPassword('abcdef!x'), false);
  assert.equal(isStrongPassword('abc 123!'), true);
  assert.equal(isStrongPassword('😀😀😀1!a'), false);
  assert.equal(isStrongPassword(`a1!${'é'.repeat(512)}`), false);
});
