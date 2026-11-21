import argon2 from 'argon2';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
});
const SCRYPT_N = 2 ** 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const LEGACY_KEY_LENGTH = 64;
const LEGACY_MAX_MEMORY = 256 * 1024 * 1024;
const MAX_PASSWORD_BYTES = 1024;
const MAX_CONCURRENT_DERIVATIONS = 2;
let activeDerivations = 0;
const derivationQueue = [];
let dummyHashPromise;

async function acquireDerivationSlot() {
  if (activeDerivations < MAX_CONCURRENT_DERIVATIONS) {
    activeDerivations += 1;
    return;
  }
  await new Promise((resolve) => derivationQueue.push(resolve));
}

function releaseDerivationSlot() {
  const next = derivationQueue.shift();
  if (next) next();
  else activeDerivations = Math.max(0, activeDerivations - 1);
}

async function derive(password, salt, n = SCRYPT_N, r = SCRYPT_R, p = SCRYPT_P) {
  await acquireDerivationSlot();
  try {
    return await scrypt(password, salt, LEGACY_KEY_LENGTH, { N: n, r, p, maxmem: LEGACY_MAX_MEMORY });
  } finally {
    releaseDerivationSlot();
  }
}

export function getPasswordValidationError(password) {
  if (typeof password !== 'string') return 'Enter a password.';
  if ([...password].length < 8) return 'Use at least 8 characters.';
  if (!/\p{L}/u.test(password)) return 'Include at least one letter.';
  if (!/[0-9]/.test(password)) return 'Include at least one number from 0 to 9.';
  if (!/[\p{P}\p{S}]/u.test(password)) return 'Include at least one symbol other than whitespace.';
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) return 'Use a password of no more than 1,024 UTF-8 bytes.';
  return null;
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new TypeError('Password input exceeds the supported limit.');
  }
  await acquireDerivationSlot();
  try {
    return await argon2.hash(password, ARGON2_OPTIONS);
  } finally {
    releaseDerivationSlot();
  }
}

export async function verifyPassword(password, encodedHash) {
  if (typeof password !== 'string' || typeof encodedHash !== 'string' || Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) return false;
  if (encodedHash.startsWith('$argon2id$')) {
    await acquireDerivationSlot();
    try { return await argon2.verify(encodedHash, password); }
    catch { return false; }
    finally { releaseDerivationSlot(); }
  }
  // Existing M29 local accounts may still have a scrypt hash. Verify it once
  // at login and transparently replace it with Argon2id after valid sign-in.
  const match = /^\$scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9_-]{20,})\$([A-Za-z0-9_-]{80,})$/.exec(encodedHash);
  if (!match) return false;
  const [, nText, rText, pText, saltText, keyText] = match;
  const n = Number(nText); const r = Number(rText); const p = Number(pText);
  if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false;
  try {
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(keyText, 'base64url');
    if (salt.length !== 16 || expected.length !== LEGACY_KEY_LENGTH) return false;
    const actual = Buffer.from(await derive(password, salt, n, r, p));
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function performDummyPasswordVerification(password) {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(`${randomBytes(32).toString('base64url')}unused`);
  }
  return verifyPassword(password, await dummyHashPromise);
}

export function passwordHashNeedsUpgrade(encodedHash) {
  if (typeof encodedHash !== 'string' || !encodedHash.startsWith('$argon2id$')) return true;
  try { return argon2.needsRehash(encodedHash, ARGON2_OPTIONS); }
  catch { return true; }
}

export const passwordHashConfiguration = Object.freeze({
  algorithm: 'argon2id',
  memoryCost: ARGON2_OPTIONS.memoryCost,
  timeCost: ARGON2_OPTIONS.timeCost,
  parallelism: ARGON2_OPTIONS.parallelism,
  hashLength: ARGON2_OPTIONS.hashLength,
  maxPasswordBytes: MAX_PASSWORD_BYTES,
  legacyAlgorithm: 'scrypt',
});
