import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../config/env.js';
import { destroyCurrentAuthSession, sessionSecurity } from '../services/authSessionService.js';

test('sign out calls Passport logout before destroying its session and clears only the auth cookie', async () => {
  const calls = [];
  const request = {
    user: { id: 'member-1' },
    logout(callback) { calls.push('passport-logout'); callback(null); },
    session: { destroy(callback) { calls.push('session-destroy'); callback(null); } },
    authSession: { authenticated: true }, authMember: { id: 'member-1' },
  };
  const response = {
    clearCookie(name, options) { calls.push(['clear-cookie', name, options]); },
    setHeader(name, value) { calls.push(['header', name, value]); },
  };

  await destroyCurrentAuthSession(request, response);
  assert.deepEqual(calls.slice(0, 2), ['passport-logout', 'session-destroy']);
  assert.deepEqual(calls[2], ['clear-cookie', sessionSecurity.cookieName, {
    path: '/', httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax',
  }]);
  assert.equal(request.user, undefined);
  assert.equal(request.authSession, null);
  assert.equal(request.authMember, null);
});

test('repeated sign out safely handles an already anonymous request', async () => {
  let cookieCleared = 0;
  let destroyed = 0;
  await destroyCurrentAuthSession({}, {
    clearCookie(name) { assert.equal(name, sessionSecurity.cookieName); cookieCleared += 1; },
    setHeader() {},
  });
  await destroyCurrentAuthSession({ session: { destroy(callback) { destroyed += 1; callback(null); } } }, {
    clearCookie() { cookieCleared += 1; },
    setHeader() {},
  });
  assert.equal(cookieCleared, 2);
  assert.equal(destroyed, 1);
});

test('successful session destruction completes sign out if Passport cleanup callback fails', async () => {
  const calls = [];
  const request = {
    user: { id: 'member-1' },
    logout(callback) { callback(new Error('passport logout failure')); },
    session: { destroy(callback) { calls.push('destroy'); callback(null); } },
  };
  const response = { clearCookie() { calls.push('clear'); }, setHeader() {} };
  await destroyCurrentAuthSession(request, response);
  assert.deepEqual(calls, ['destroy', 'clear']);
  assert.equal(request.user, undefined);
});
