import { createHash } from 'node:crypto';

export function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().normalize('NFC').toLowerCase();
}

export function isValidEmail(value) {
  return typeof value === 'string'
    && Buffer.byteLength(value, 'utf8') <= 254
    && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

export function accountRateKey(value) {
  return createHash('sha256').update(normalizeEmail(value)).digest('hex');
}
