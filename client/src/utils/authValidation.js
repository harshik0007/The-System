export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { id: 'lower', label: 'One lowercase letter', test: (value) => /[a-z]/.test(value) },
  { id: 'upper', label: 'One uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'One number', test: (value) => /\d/.test(value) },
];

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function passwordRules(value) {
  return PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(value) }));
}

export function isStrongPassword(value) {
  return passwordRules(value).every((rule) => rule.passed);
}

export function validatePasswordChange({ currentPassword = '', newPassword = '', confirmPassword = '' } = {}) {
  const errors = {};
  if (!currentPassword) errors.currentPassword = 'Enter your current password.';
  if (!newPassword) errors.newPassword = 'Enter a new password.';
  else if (!isStrongPassword(newPassword)) errors.newPassword = 'Meet each password requirement.';
  if (!confirmPassword) errors.confirmPassword = 'Confirm your new password.';
  else if (confirmPassword !== newPassword) errors.confirmPassword = 'Passwords do not match.';
  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.newPassword = 'Your new password must differ from your current password.';
  }
  return errors;
}
