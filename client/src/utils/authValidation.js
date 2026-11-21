export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (value) => [...value].length >= 8 },
  { id: 'letter', label: 'At least 1 letter', test: (value) => /\p{L}/u.test(value) },
  { id: 'digit', label: 'At least 1 number (0–9)', test: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'At least 1 symbol (not whitespace)', test: (value) => /[\p{P}\p{S}]/u.test(value) },
  { id: 'maximum', label: 'No more than 1,024 UTF-8 bytes', test: (value) => new TextEncoder().encode(value).length <= 1024 },
];

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function passwordRules(value) {
  return PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(value) }));
}

export function isStrongPassword(value) {
  return typeof value === 'string' && passwordRules(value).every((rule) => rule.passed);
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
