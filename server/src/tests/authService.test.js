import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config/env.js';
import { createAuthService } from '../services/authService.js';
import { getPasswordValidationError } from '../services/passwordService.js';

const testPasswordTools = {
  getPasswordValidationError,
  hashPassword: async (value) => `test-hash:${value}`,
  verifyPassword: async (value, hash) => hash === `test-hash:${value}`,
  passwordHashNeedsUpgrade: () => false,
  performDummyPasswordVerification: async () => false,
};

function query(value) {
  return {
    select() { return this; }, session() { return this; }, sort() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
}

function fixture({ user = null, users = [], duplicate = null, settings = { recoveryCodeHmacSecret: 'r'.repeat(48), googleOAuthEnabled: true } } = {}) {
  const created = [];
  const progressionInitializations = [];
  let progressionCreated = 0;
  const UserModel = {
    exists: async (filter) => {
      if (filter.emailNormalized && users.some((entry) => entry.emailNormalized === filter.emailNormalized)) return { _id: 'existing-email' };
      if (filter.usernameNormalized && users.some((entry) => entry.usernameNormalized === filter.usernameNormalized)) return { _id: 'existing-username' };
      return null;
    },
    create: async (rows) => {
      if (duplicate) throw duplicate;
      const doc = { ...rows[0], _id: `member-${created.length + 1}`, save: async () => {} };
      created.push(doc);
      return [doc];
    },
    findOne: (filter = {}) => {
      if (filter.emailNormalized) return query(users.find((entry) => entry.emailNormalized === filter.emailNormalized) || null);
      if (filter.usernameNormalized) return query(users.find((entry) => entry.usernameNormalized === filter.usernameNormalized) || null);
      if (filter.googleSub) return query(users.find((entry) => entry.googleSub === filter.googleSub) || null);
      if (filter.$or) {
        const match = users.find((entry) => filter.$or.some((condition) => (
          (condition.emailNormalized && entry.emailNormalized === condition.emailNormalized)
          || (condition.usernameNormalized && entry.usernameNormalized === condition.usernameNormalized)
        )));
        return query(match || user);
      }
      return query(user);
    },
    findOneAndUpdate: async (filter, update) => {
      if (!user || String(user._id) !== String(filter._id)) return null;
      Object.assign(user, update.$set);
      return user;
    },
    updateOne: async () => ({ modifiedCount: 1 }),
  };
  const ProgressionRunModel = {
    findOne: (filter) => query(filter.status === 'active' ? null : null),
  };
  const service = createAuthService({
    UserModel,
    ProgressionRunModel,
    rateLimits: { check: async () => {} },
    transaction: async (work) => work({ id: 'transaction' }),
    settings,
    passwordTools: testPasswordTools,
    initializeProgression: async (options) => { progressionCreated += 1; progressionInitializations.push(options); return { _id: `run-${progressionCreated}`, startedOn: '2026-11-21' }; },
  });
  return { service, UserModel, created, progressionInitializations, get progressionCreated() { return progressionCreated; } };
}

const validSignup = {
  firstName: 'Harshik', middleName: '', lastName: 'Member', username: 'Harshik_007',
  email: ' Person@Example.com ', password: 'abc123!x', confirmPassword: 'abc123!x', termsAccepted: true,
};

test('local signup normalizes unique identities, creates one active account and one progression with ten recovery codes', async () => {
  const state = fixture();
  const result = await state.service.signup(validSignup);
  const user = state.created[0];
  assert.equal(state.created.length, 1);
  assert.equal(state.progressionCreated, 1);
  assert.equal(user.emailNormalized, 'person@example.com');
  assert.equal(user.usernameNormalized, 'harshik_007');
  assert.equal(user.username, 'Harshik_007');
  assert.deepEqual([user.firstName, user.middleName, user.lastName], ['Harshik', '', 'Member']);
  assert.equal(user.accountStatus, 'active');
  assert.equal(user.emailVerified, false);
  assert.equal(user.authProviders.localPassword, true);
  assert.notEqual(user.passwordHash, validSignup.password);
  assert.equal(result.recoveryCodes.length, 10);
  assert.equal(result.member.username, 'Harshik_007');
  assert.equal(result.requiresScheduleSetup, true);
  assert.equal(JSON.stringify(user.recoveryCodeHashes).includes(result.recoveryCodes[0]), false);
});

test('local signup remains available in development when no stable .env secrets are configured', async () => {
  const state = fixture({ settings: loadConfig({ NODE_ENV: 'development' }) });
  const result = await state.service.signup(validSignup);
  assert.equal(result.recoveryCodes.length, 10);
  assert.equal(state.created.length, 1);
});

test('signup rejects terms, malformed username and duplicate username/email without creating another User', async () => {
  const terms = fixture();
  await assert.rejects(terms.service.signup({ ...validSignup, termsAccepted: false }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(terms.service.signup({ ...validSignup, username: '007player' }), { code: 'VALIDATION_ERROR' });
  assert.equal(terms.created.length, 0);
  const emailDuplicate = fixture({ users: [{ emailNormalized: 'person@example.com', authMethod: 'local', authProviders: { localPassword: true, google: false }, passwordHash: 'existing-hash' }] });
  await assert.rejects(emailDuplicate.service.signup(validSignup), { code: 'EMAIL_ALREADY_EXISTS', status: 409 });
  const usernameDuplicate = fixture({ users: [{ usernameNormalized: 'harshik_007' }] });
  await assert.rejects(usernameDuplicate.service.signup(validSignup), { code: 'USERNAME_ALREADY_TAKEN', status: 409 });
});

test('Mongo duplicate-key races become stable email and username conflict errors', async () => {
  const duplicateEmail = Object.assign(new Error('duplicate key'), { code: 11000, keyPattern: { emailNormalized: 1 } });
  const emailState = fixture({ duplicate: duplicateEmail });
  await assert.rejects(emailState.service.signup(validSignup), { code: 'EMAIL_ALREADY_EXISTS', status: 409 });
  const duplicateUsername = Object.assign(new Error('duplicate key'), { code: 11000, keyPattern: { usernameNormalized: 1 } });
  const usernameState = fixture({ duplicate: duplicateUsername });
  await assert.rejects(usernameState.service.signup(validSignup), { code: 'USERNAME_ALREADY_TAKEN', status: 409 });
});

test('login accepts email or username, while unknown and wrong credentials share a generic response', async () => {
  const account = { _id: 'member-1', emailNormalized: 'person@example.com', username: 'harshik_007', passwordHash: 'test-hash:abc123!x', authVersion: 0, authMethod: 'local', accountStatus: 'active', authProviders: { localPassword: true } };
  const state = fixture({ user: account });
  const email = await state.service.login({ identifier: ' PERSON@example.com ', password: 'abc123!x' });
  assert.equal(email.member.username, 'harshik_007');
  const username = await state.service.login({ identifier: 'HARSHIK_007', password: 'abc123!x' });
  assert.equal(username.member.id, 'member-1');
  await assert.rejects(state.service.login({ identifier: 'harshik_007', password: 'incorrect password' }), { code: 'INVALID_CREDENTIALS', status: 401 });
  const unknown = fixture();
  await assert.rejects(unknown.service.login({ identifier: 'unknown@example.com', password: 'some submitted password' }), { code: 'INVALID_CREDENTIALS', status: 401 });
});

test('successful legacy login upgrades only the verified password hash', async () => {
  const account = { _id: 'member-legacy', emailNormalized: 'person@example.com', username: 'harshik_007', passwordHash: 'legacy-scrypt-hash', authVersion: 4, authMethod: 'local', accountStatus: 'active', authProviders: { localPassword: true } };
  const state = fixture({ user: account });
  const updateCalls = [];
  state.UserModel.updateOne = async (...args) => { updateCalls.push(args); return { modifiedCount: 1 }; };
  const service = createAuthService({
    UserModel: state.UserModel,
    rateLimits: { check: async () => {} },
    settings: { recoveryCodeHmacSecret: 'r'.repeat(48) },
    passwordTools: {
      ...testPasswordTools,
      verifyPassword: async (password, hash) => password === 'abc123!x' && hash === 'legacy-scrypt-hash',
      passwordHashNeedsUpgrade: (hash) => hash === 'legacy-scrypt-hash',
      hashPassword: async () => 'argon2id-upgraded-hash',
    },
  });
  await service.login({ identifier: 'person@example.com', password: 'abc123!x' });
  assert.equal(updateCalls.length, 1);
  assert.deepEqual(updateCalls[0][0], { _id: 'member-legacy', passwordHash: 'legacy-scrypt-hash', authVersion: 4 });
  assert.deepEqual(updateCalls[0][1], { $set: { passwordHash: 'argon2id-upgraded-hash' } });
});

test('a legacy account carrying both Local and Google credentials is rejected instead of mixing providers', async () => {
  const mixed = {
    _id: 'member-mixed', emailNormalized: 'person@example.com', username: 'harshik_007',
    passwordHash: 'test-hash:abc123!x', googleSub: 'google-sub-1', authVersion: 0,
    authMethod: 'local', accountStatus: 'active', authProviders: { localPassword: true, google: true },
  };
  const state = fixture({ user: mixed });
  await assert.rejects(state.service.login({ identifier: 'person@example.com', password: 'abc123!x' }), { code: 'ACCOUNT_METHOD_CONFLICT', status: 409 });
});

test('Passport Google profile requires a verified email before profile completion can continue', async () => {
  const state = fixture();
  const profile = { id: 'google-sub-1', emails: [{ value: 'google@example.com', verified: true }], name: { givenName: 'Google', familyName: 'Member' }, _json: { email_verified: true } };
  const valid = await state.service.googleOAuthSignIn({ profile });
  assert.equal(valid.kind, 'profile-completion-required');
  assert.equal(valid.profile.email, 'google@example.com');
  assert.equal(valid.pendingRegistration.sub, 'google-sub-1');
  assert.equal(state.created.length, 0);
  await assert.rejects(state.service.googleOAuthSignIn({ profile: { ...profile, emails: [{ value: 'google@example.com', verified: false }], _json: { email_verified: false } } }), { code: 'GOOGLE_IDENTITY_INVALID', status: 401 });
  const mixedEmailProfile = {
    ...profile,
    emails: [
      { value: 'unverified@example.com', verified: false },
      { value: 'verified@example.com', verified: true },
    ],
    _json: { email_verified: false },
  };
  const verifiedOnly = await state.service.googleOAuthSignIn({ profile: mixedEmailProfile });
  assert.equal(verifiedOnly.profile.email, 'verified@example.com', 'only the verified email address may be used');
  const localAccount = { emailNormalized: 'google@example.com', authMethod: 'local', authProviders: { localPassword: true }, passwordHash: 'existing-local-hash' };
  await assert.rejects(fixture({ users: [localAccount] }).service.googleOAuthSignIn({ profile }), { code: 'ACCOUNT_METHOD_CONFLICT', status: 409 });
});

test('Google profile completion creates a Google-only account without a synthetic password or recovery codes', async () => {
  const state = fixture();
  const result = await state.service.completeGoogleSignup({
    pendingRegistration: { sub: 'google-sub-2', email: 'google@example.com', expiresAt: Date.now() + 60_000 },
    firstName: 'Google', middleName: '', lastName: 'Member', username: 'GoogleMember', termsAccepted: true,
  });
  const user = state.created[0];
  assert.equal(state.progressionCreated, 1);
  assert.equal(user.authMethod, 'google');
  assert.deepEqual(user.authProviders, { localPassword: false, google: true });
  assert.equal(user.passwordHash, undefined);
  assert.equal(user.recoveryCodeHashes, undefined);
  assert.equal(user.emailVerified, true);
  assert.equal(user.googleSub, 'google-sub-2');
  assert.equal(result.member.authMethod, 'google');
});
