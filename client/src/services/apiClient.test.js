import test from 'node:test';
import assert from 'node:assert/strict';
import { invalidateCsrfToken, requestApi } from './apiClient.js';

test('state-changing API calls send cookies and a session CSRF token', async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (String(url).endsWith('/api/v1/auth/csrf')) {
      return new Response(JSON.stringify({ csrfToken: 'opaque-csrf-value' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ accepted: true }), { status: 202, headers: { 'Content-Type': 'application/json' } });
  };
  invalidateCsrfToken();
  t.after(() => { globalThis.fetch = originalFetch; invalidateCsrfToken(); });

  const signupBody = { firstName: 'Member', middleName: '', lastName: 'Test', username: 'member_test', email: 'member@example.test', password: 'abc123!x', confirmPassword: 'abc123!x', termsAccepted: true };
  const result = await requestApi('/auth/signup', { method: 'POST', body: signupBody });
  assert.deepEqual(result, { accepted: true });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[1].options.credentials, 'include');
  assert.equal(calls[1].options.headers['X-CSRF-Token'], 'opaque-csrf-value');
  assert.equal(calls[1].options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[1].options.body), signupBody);
});

test('safe API reads do not request a CSRF token', async (t) => {
  const originalFetch = globalThis.fetch;
  let called = null;
  globalThis.fetch = async (url, options) => {
    called = { url, options };
    return new Response(JSON.stringify({ authenticated: false, member: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await requestApi('/auth/me');
  assert.equal(result.authenticated, false);
  assert.equal(called.url, '/api/v1/auth/me');
  assert.equal(called.options.credentials, 'include');
});

test('private 401 responses stay safe in non-browser runtimes', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in.' } }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(requestApi('/private-data'), (error) => error.status === 401 && error.code === 'AUTHENTICATION_REQUIRED');
});
