import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountDeletionService, ACCOUNT_OWNED_DATA_MODELS } from '../services/accountDeletionService.js';

function makeFixture(userFields = {}, settings = {}, overrides = {}) {
  const user = {
    _id: 'member-owned', identityKind: 'account', accountStatus: 'active', authMethod: 'local',
    authProviders: { localPassword: true, google: false }, passwordHash: 'stored-hash', authVersion: 4,
    ...userFields,
  };
  const deletedFilters = [];
  const fakeSession = {};
  let userRemoved = false;
  const UserModel = {
    findOne(filter) {
      const query = {
        select() { return query; },
        session() { return query; },
        then(resolve, reject) {
          const match = !userRemoved && String(filter._id) === String(user._id)
            && filter.identityKind === user.identityKind && filter.accountStatus === user.accountStatus;
          return Promise.resolve(match ? user : null).then(resolve, reject);
        },
      };
      return query;
    },
    async updateOne(filter, update) {
      if (userRemoved || user.accountStatus !== filter.accountStatus || user.authVersion !== filter.authVersion) return { matchedCount: 0 };
      user.accountStatus = update.$set.accountStatus;
      user.authVersion += update.$inc.authVersion;
      return { matchedCount: 1 };
    },
    async deleteOne(filter) {
      if (user.accountStatus !== filter.accountStatus) return { deletedCount: 0 };
      userRemoved = true;
      return { deletedCount: 1 };
    },
  };
  const ownedModels = ACCOUNT_OWNED_DATA_MODELS.map((name, index) => ({
    modelName: name.modelName || `OwnedModel${index}`,
    async deleteMany(filter, options) { deletedFilters.push({ filter, options }); return { deletedCount: 1 }; },
  }));
  let sessionCleanedFor = null;
  const service = createAccountDeletionService({
    UserModel,
    ownedModels,
    rateLimits: { check: async () => {} },
    transaction: async (work) => work(fakeSession),
    verifyPasswordFn: async (password, hash) => password === 'current-secret' && hash === 'stored-hash',
    sessionCleanup: overrides.sessionCleanup || (async (id) => { sessionCleanedFor = id; }),
    settings,
  });
  return { service, user, deletedFilters, get userRemoved() { return userRemoved; }, get sessionCleanedFor() { return sessionCleanedFor; }, fakeSession };
}

test('account deletion requires the exact phrase and verifies local password before starting transaction', async () => {
  const fixture = makeFixture();
  await assert.rejects(fixture.service.deleteAccount({ userId: 'member-owned', confirmationPhrase: 'delete', currentPassword: 'current-secret' }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(fixture.service.deleteAccount({ userId: 'member-owned', confirmationPhrase: 'DELETE', currentPassword: 'wrong' }), { code: 'CURRENT_PASSWORD_INVALID' });
  assert.equal(fixture.deletedFilters.length, 0);
  assert.equal(fixture.userRemoved, false);
});

test('local account deletion removes only explicitly user-owned records transactionally then clears that user sessions', async () => {
  const fixture = makeFixture();
  const result = await fixture.service.deleteAccount({ userId: 'member-owned', confirmationPhrase: 'DELETE', currentPassword: 'current-secret' });
  assert.deepEqual(result, { deleted: true });
  assert.equal(fixture.deletedFilters.length, ACCOUNT_OWNED_DATA_MODELS.length);
  assert.ok(fixture.deletedFilters.every(({ filter, options }) => filter.userId === 'member-owned' && options.session === fixture.fakeSession));
  assert.equal(fixture.userRemoved, true);
  assert.equal(fixture.sessionCleanedFor, 'member-owned');
});

test('session cleanup failure after committed deletion does not report a false deletion failure', async () => {
  const fixture = makeFixture({}, {}, { sessionCleanup: async () => { throw Object.assign(new Error('session store unavailable'), { code: 'STORE_UNAVAILABLE' }); } });
  const originalError = console.error;
  const logEntries = [];
  console.error = (...values) => logEntries.push(values);
  try {
    const result = await fixture.service.deleteAccount({
      userId: 'member-owned', confirmationPhrase: 'DELETE', currentPassword: 'current-secret',
    });
    assert.deepEqual(result, { deleted: true });
    assert.equal(fixture.userRemoved, true);
    assert.equal(logEntries.length, 1);
    assert.equal(JSON.stringify(logEntries[0]).includes('session store unavailable'), false);
  } finally {
    console.error = originalError;
  }
});

test('Google deletion authorization is short-lived and bound to the current THE SYSTEM and Google identities', async () => {
  const fixture = makeFixture({
    authMethod: 'google', authProviders: { localPassword: false, google: true },
    passwordHash: undefined, googleSub: 'google-owner-123',
  }, { googleOAuthEnabled: true });
  const begun = await fixture.service.beginGoogleReauthentication({ userId: 'member-owned', ip: '127.0.0.1' });
  assert.equal(begun.userId, 'member-owned');
  assert.ok(begun.expiresAt > Date.now());
  await assert.rejects(fixture.service.finishGoogleReauthentication({ userId: 'other-member', intent: begun, googleSub: 'google-owner-123' }), { code: 'GOOGLE_REAUTH_EXPIRED' });
  await assert.rejects(fixture.service.finishGoogleReauthentication({ userId: 'member-owned', intent: begun, googleSub: 'different-google-account' }), { code: 'GOOGLE_IDENTITY_MISMATCH' });
});

test('Google-only account deletion requires a fresh matching authorization and no password', async () => {
  const fixture = makeFixture({
    authMethod: 'google', authProviders: { localPassword: false, google: true },
    passwordHash: undefined, googleSub: 'google-owner-123',
  });
  const authorization = { userId: 'member-owned', googleSub: 'google-owner-123', authVersion: 4, expiresAt: Date.now() + 60_000 };
  await assert.rejects(fixture.service.deleteAccount({ userId: 'member-owned', confirmationPhrase: 'DELETE', authorization: { ...authorization, userId: 'other-member' } }), { code: 'FRESH_GOOGLE_REAUTH_REQUIRED' });
  await assert.rejects(fixture.service.deleteAccount({ userId: 'member-owned', confirmationPhrase: 'DELETE', currentPassword: 'anything', authorization }), { code: 'VALIDATION_ERROR' });
  const result = await fixture.service.deleteAccount({ userId: 'member-owned', confirmationPhrase: 'DELETE', authorization });
  assert.deepEqual(result, { deleted: true });
  assert.equal(fixture.userRemoved, true);
});
