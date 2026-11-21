import test from 'node:test';
import assert from 'node:assert/strict';
import passport, { Passport } from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { configurePassport } from '../config/passport.js';

function callbackResult(run) {
  return new Promise((resolve, reject) => run((error, ...values) => error ? reject(error) : resolve(values)));
}

test('Passport Local delegates identifier and password checks to the auth service', async () => {
  const instance = new Passport();
  const account = { _id: 'user-1', accountStatus: 'active' };
  let loginArguments;
  configurePassport({
    passportInstance: instance,
    UserModel: {},
    service: { login: async (details) => { loginArguments = details; return { sessionUser: account, member: { id: 'user-1' } }; } },
    settings: { googleOAuthEnabled: false },
  });

  const [user, info] = await callbackResult((done) => instance._strategy('local')._verify({ ip: '127.0.0.1' }, 'member@example.com', 'password123!', done));
  assert.equal(user, account);
  assert.equal(info.authResult.member.id, 'user-1');
  assert.deepEqual(loginArguments, { identifier: 'member@example.com', password: 'password123!', ip: '127.0.0.1' });
});

test('Passport stores only the User ID and deserializes active account records', async () => {
  const instance = new Passport();
  const account = { _id: 'user-2', accountStatus: 'active', username: 'member_two' };
  let queryFilter;
  configurePassport({
    passportInstance: instance,
    UserModel: {
      findOne(filter) {
        queryFilter = filter;
        return { select() { return { lean: async () => account }; } };
      },
    },
    service: {},
    settings: { googleOAuthEnabled: false },
  });

  const serialized = await callbackResult((done) => instance._serializers.at(-1)(account, done));
  assert.deepEqual(serialized, ['user-2']);
  const deserialized = await callbackResult((done) => instance._deserializers.at(-1)('user-2', done));
  assert.deepEqual(queryFilter, { _id: 'user-2', identityKind: 'account', accountStatus: 'active' });
  assert.equal(deserialized[0].id, 'user-2');
  assert.equal(deserialized[0].username, 'member_two');
});

test('Passport Google uses the registered frontend callback and session-backed OAuth state', async () => {
  const instance = new Passport();
  const pending = { kind: 'profile-completion-required', pendingRegistration: { sub: 'google-sub' } };
  let verifiedProfile;
  configurePassport({
    passportInstance: instance,
    UserModel: {},
    service: { googleOAuthSignIn: async ({ profile }) => { verifiedProfile = profile; return pending; } },
    settings: {
      googleOAuthEnabled: true,
      googleClientId: 'server-client-id',
      googleClientSecret: 'server-client-secret',
      googleCallbackUrl: 'http://localhost:5175/api/v1/auth/google/callback',
    },
  });

  const strategy = instance._strategy('google');
  assert.ok(strategy instanceof GoogleStrategy);
  assert.equal(strategy._callbackURL, 'http://localhost:5175/api/v1/auth/google/callback');
  assert.ok(strategy._stateStore, 'OAuth state must be verified through the session');
  const profile = { id: 'google-sub', emails: [{ value: 'member@example.com', verified: true }] };
  const [user, info] = await callbackResult((done) => strategy._verify({ ip: '127.0.0.1' }, 'access', 'refresh', profile, done));
  assert.equal(user, false);
  assert.equal(info.googlePending, pending);
  assert.equal(verifiedProfile, profile);
});

test('Passport registers isolated Google re-authentication for account deletion without invoking login', async () => {
  const instance = new Passport();
  configurePassport({
    passportInstance: instance,
    UserModel: {},
    service: { googleOAuthSignIn: async () => { throw new Error('login strategy must not run'); } },
    settings: {
      googleOAuthEnabled: true,
      googleClientId: 'server-client-id',
      googleClientSecret: 'server-client-secret',
      googleCallbackUrl: 'http://localhost:5175/api/v1/auth/google/callback',
    },
  });
  const strategy = instance._strategy('google-delete-reauth');
  assert.ok(strategy instanceof GoogleStrategy);
  assert.equal(strategy._callbackURL, 'http://localhost:5175/api/v1/auth/google/callback');
  assert.ok(strategy._stateStore, 'fresh re-authentication must validate OAuth state');
  const profile = { id: 'google-sub-for-current-account' };
  const [verified] = await callbackResult((done) => strategy._verify({}, 'access-token', 'refresh-token', profile, done));
  assert.equal(verified, profile);
});

test('the application Passport singleton is configured once and remains a Passport instance', () => {
  assert.equal(typeof passport.authenticate, 'function');
});
