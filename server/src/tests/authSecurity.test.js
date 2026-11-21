import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { createAuthRateLimitService } from '../services/authRateLimitService.js';
import { createAuthSessionMiddleware, sessionSecurity } from '../services/authSessionService.js';
import { passwordHashConfiguration, getPasswordValidationError, hashPassword, passwordHashNeedsUpgrade, verifyPassword } from '../services/passwordService.js';
import { createCsrfProtection } from '../middleware/csrfProtection.js';
import { generateRecoveryCodes, isRecoveryCodeFormat, recoveryCodeDigest } from '../utils/identity.js';

test('password hashing uses Argon2id and enforces the exact eight-character composition policy', async () => {
  const password = 'café123!';
  assert.equal(getPasswordValidationError('abc123!'), 'Use at least 8 characters.');
  for (const accepted of ['abc123!x', 'Abcdef1!', 'a234567!', 'abc123!!', `a1!${'z'.repeat(61)}`]) {
    assert.equal(getPasswordValidationError(accepted), null, `${accepted.slice(0, 12)} must be accepted`);
  }
  for (const rejected of ['12345678!', 'abcdefgh!', 'abc12345']) assert.notEqual(getPasswordValidationError(rejected), null);
  assert.equal(getPasswordValidationError('a'.repeat(1022) + '1!x'), 'Use a password of no more than 1,024 UTF-8 bytes.');
  assert.equal(getPasswordValidationError('😀😀😀1!a'), 'Use at least 8 characters.');
  assert.equal(getPasswordValidationError('a'.repeat(1022) + '1!x'), 'Use a password of no more than 1,024 UTF-8 bytes.');
  assert.equal(passwordHashConfiguration.algorithm, 'argon2id');
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.ok(first.startsWith('$argon2id$'));
  assert.equal(passwordHashNeedsUpgrade(first), false);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('incorrect passphrase', first), false);
});

test('legacy scrypt hashes verify and are marked for transparent Argon2id upgrade', async () => {
  const scrypt = promisify(scryptCallback);
  const password = 'Abcdef1!';
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
  const legacyHash = `$scrypt$N=131072,r=8,p=1$${salt.toString('base64url')}$${Buffer.from(key).toString('base64url')}`;
  assert.equal(await verifyPassword(password, legacyHash), true);
  assert.equal(await verifyPassword('wrong password', legacyHash), false);
  assert.equal(passwordHashNeedsUpgrade(legacyHash), true);
});

test('recovery codes are random one-time values with server-keyed digests only', () => {
  const codes = generateRecoveryCodes(10);
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  assert.ok(codes.every(isRecoveryCodeFormat));
  const digest = recoveryCodeDigest(codes[0], 'r'.repeat(48));
  assert.equal(digest.length, 64);
  assert.equal(digest.includes(codes[0]), false);
  assert.notEqual(digest, recoveryCodeDigest(codes[0], 's'.repeat(48)));
  assert.equal(recoveryCodeDigest(codes[0], ''), '');
});

test('session-bound CSRF accepts only the token stored in that server session and trusted origin', () => {
  const settings = { nodeEnv: 'development', trustedOrigins: ['http://localhost:5173'] };
  const protect = createCsrfProtection(settings);
  const request = { method: 'POST', session: { csrfToken: 'session-token' }, headers: { origin: 'http://localhost:5173', 'x-csrf-token': 'session-token' } };
  let error;
  protect(request, {}, (value) => { error = value; });
  assert.equal(error, undefined);
  protect({ ...request, headers: { ...request.headers, 'x-csrf-token': 'another-session-token' } }, {}, (value) => { error = value; });
  assert.equal(error.code, 'INVALID_CSRF_TOKEN');
  protect({ ...request, headers: { ...request.headers, origin: 'https://untrusted.example' } }, {}, (value) => { error = value; });
  assert.equal(error.code, 'ORIGIN_NOT_ALLOWED');
  error = undefined;
  protect({ method: 'GET', headers: {} }, {}, (value) => { error = value; });
  assert.equal(error, undefined);
  assert.equal(sessionSecurity.csrfTokenMatches('same', 'same'), true);
  assert.equal(sessionSecurity.csrfTokenMatches('same', 'other'), false);
});

test('session identity uses Passport deserialization, rejects stale authVersion and never accepts a client identity', async () => {
  const member = { _id: 'member-1', username: 'secure_member', emailNormalized: 'secure@example.com', accountStatus: 'active', authVersion: 3, authProviders: { localPassword: true } };
  const middleware = createAuthSessionMiddleware({ now: () => new Date(10_000) });
  const request = { session: { auth: { userId: 'member-1', authVersion: 3, issuedAt: 1_000 }, csrfToken: 'csrf' }, user: { ...member, id: 'member-1' }, body: { userId: 'attacker-selected-id' } };
  await new Promise((resolve, reject) => middleware(request, { setHeader() {}, clearCookie() {} }, (error) => error ? reject(error) : resolve()));
  assert.deepEqual(request.user, { id: 'member-1', identityKind: 'account' });
  assert.equal(request.authMember.username, 'secure_member');

  const stale = createAuthSessionMiddleware({ now: () => new Date(10_000) });
  const staleRequest = { session: { auth: { userId: 'member-1', authVersion: 3, issuedAt: 1_000 }, destroy(callback) { callback(); } }, user: { ...member, authVersion: 4, id: 'member-1' } };
  await new Promise((resolve, reject) => stale(staleRequest, { setHeader() {}, clearCookie() {} }, (error) => error ? reject(error) : resolve()));
  assert.equal(staleRequest.user, undefined);
  assert.equal(staleRequest.authSession, null);
});

test('authentication rate limits use hashed account identifiers and return 429 after the configured limit', async () => {
  const identifiers = [];
  const counts = new Map();
  const service = createAuthRateLimitService({ nodeEnv: 'production', RateLimitModel: {
    async findOneAndUpdate(filter, update) {
      identifiers.push(filter._id);
      const count = (counts.get(filter._id) || 0) + update.$inc.count;
      counts.set(filter._id, count);
      return { count };
    },
  } });
  for (let index = 0; index < 3; index += 1) await service.check({ action: 'signup', ip: '127.0.0.1', accountKey: 'person@example.com' });
  await assert.rejects(service.check({ action: 'signup', ip: '127.0.0.1', accountKey: 'person@example.com' }), { status: 429, code: 'RATE_LIMITED' });
  assert.ok(identifiers.every((identifier) => !identifier.includes('person@example.com')));
});
