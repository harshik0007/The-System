import { createHmac, randomBytes } from 'node:crypto';
import { isValidEmail, normalizeEmail } from './authPrimitives.js';

const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'api', 'auth', 'help', 'leaderboard', 'login', 'logout', 'me',
  'profile', 'root', 'settings', 'signup', 'support', 'system', 'the-system', 'user', 'users',
]);

const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{2,23}$/;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\p{Zs}'’.-]*$/u;

export function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validateUsername(value) {
  const username = typeof value === 'string' ? value.trim() : '';
  if (!USERNAME_PATTERN.test(username)) {
    return { error: 'Use 3–24 characters, start with a letter, and use only letters, numbers or underscores.', username, normalized: normalizeUsername(username) };
  }
  const normalized = normalizeUsername(username);
  if (RESERVED_USERNAMES.has(normalized)) {
    return { error: 'That username is reserved. Choose another one.', username, normalized };
  }
  return { error: null, username, normalized };
}

export function validatePersonalName(value, label, { required = true } = {}) {
  const name = typeof value === 'string' ? value.trim().normalize('NFC') : '';
  if (!name && !required) return { value: '', error: null };
  if ((!name && required) || [...name].length > 80 || (name && !NAME_PATTERN.test(name))) {
    return { value: name, error: `${label} must contain a valid name of up to 80 characters.` };
  }
  return { value: name, error: null };
}

export function normalizeLoginIdentifier(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validateIdentityEmail(value) {
  const normalized = normalizeEmail(value);
  return isValidEmail(normalized) ? normalized : '';
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const hex = randomBytes(16).toString('hex').toUpperCase();
    return `${hex.slice(0, 8)}-${hex.slice(8, 16)}-${hex.slice(16, 24)}-${hex.slice(24)}`;
  });
}

export function normalizeRecoveryCode(value) {
  return typeof value === 'string' ? value.replace(/[^a-f0-9]/gi, '').toUpperCase() : '';
}

export function recoveryCodeDigest(value, secret) {
  const code = normalizeRecoveryCode(value);
  if (!code || !secret || Buffer.byteLength(secret) < 32) return '';
  return createHmac('sha256', secret).update(code).digest('hex');
}

export function isRecoveryCodeFormat(value) {
  return /^[A-F0-9]{32}$/.test(normalizeRecoveryCode(value));
}

export const reservedUsernames = RESERVED_USERNAMES;
