import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePasswordChange } from './authValidation.js';

test('password change requires all fields', () => {
  assert.deepEqual(validatePasswordChange(), {
    currentPassword: 'Enter your current password.',
    newPassword: 'Enter a new password.',
    confirmPassword: 'Confirm your new password.',
  });
});

test('password change accepts a matching password that follows the existing policy', () => {
  assert.deepEqual(validatePasswordChange({
    currentPassword: 'OldPassword9',
    newPassword: 'NewPassword8',
    confirmPassword: 'NewPassword8',
  }), {});
});

test('password change rejects a weak, mismatched or unchanged password', () => {
  assert.deepEqual(validatePasswordChange({ currentPassword: 'OldPassword9', newPassword: 'weak', confirmPassword: 'different' }), {
    newPassword: 'Meet each password requirement.',
    confirmPassword: 'Passwords do not match.',
  });
  assert.deepEqual(validatePasswordChange({ currentPassword: 'OldPassword9', newPassword: 'OldPassword9', confirmPassword: 'OldPassword9' }), {
    newPassword: 'Your new password must differ from your current password.',
  });
});
