import test from 'node:test';
import assert from 'node:assert/strict';
import { taskApi } from './taskApi.js';

async function withFetch(t, fetchImplementation) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    if (String(url).endsWith('/api/v1/auth/csrf')) {
      return Promise.resolve(new Response(JSON.stringify({ csrfToken: 'test-csrf-token' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return fetchImplementation(url, options);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
}

test('a non-JSON proxy 500 is distinguished from an Express API error', async (t) => {
  await withFetch(t, async () => new Response('Failed to proxy request', {
    status: 500,
    headers: { 'Content-Type': 'text/plain' },
  }));

  await assert.rejects(taskApi.tasks(), (error) => {
    assert.equal(error.status, 500);
    assert.equal(error.code, 'UPSTREAM_UNAVAILABLE');
    assert.equal(error.requestId, null);
    assert.match(error.message, /could not complete that request/);
    return true;
  });
});

test('structured Express errors preserve their safe message, code and request ID', async (t) => {
  await withFetch(t, async () => new Response(JSON.stringify({
    error: { code: 'IDENTITY_UNAVAILABLE', message: 'Development identity is unavailable.', requestId: 'request-123' },
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'request-123' },
  }));

  await assert.rejects(taskApi.allowance(), (error) => {
    assert.equal(error.status, 503);
    assert.equal(error.code, 'IDENTITY_UNAVAILABLE');
    assert.equal(error.requestId, 'request-123');
    assert.equal(error.message, 'Development identity is unavailable.');
    return true;
  });
});

test('network failures are reported as unavailable service errors', async (t) => {
  await withFetch(t, async () => { throw new TypeError('fetch failed'); });

  await assert.rejects(taskApi.currentSchedule(), (error) => {
    assert.equal(error.status, 0);
    assert.equal(error.code, 'NETWORK_ERROR');
    return true;
  });
});

test('Emergency Pause endpoints keep status reads server sourced and mutation requests idempotent', async (t) => {
  const calls = [];
  await withFetch(t, async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  await taskApi.emergencyPauseStatus();
  await taskApi.activateEmergencyPause(4, 'pause-activation-key-01');
  await taskApi.resumeEmergencyPause('pause-resume-key-0001');

  assert.equal(calls[0].url, '/api/v1/emergency-pause');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[1].url, '/api/v1/emergency-pause/activate');
  assert.deepEqual(JSON.parse(calls[1].options.body), { durationDays: 4 });
  assert.equal(calls[1].options.headers['Idempotency-Key'], 'pause-activation-key-01');
  assert.equal(calls[2].url, '/api/v1/emergency-pause/resume');
  assert.deepEqual(JSON.parse(calls[2].options.body), {});
  assert.equal(calls[2].options.headers['Idempotency-Key'], 'pause-resume-key-0001');
});

test('notification APIs use bounded server-backed filters and member-scoped mutations', async (t) => {
  const calls = [];
  await withFetch(t, async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  await taskApi.notifications({ category: 'recovery-quests', readState: 'unread', cursor: 'opaque-cursor', limit: 10 });
  await taskApi.notificationUnreadCount();
  await taskApi.markNotificationRead('notice-123');
  await taskApi.markAllNotificationsRead();
  await taskApi.notificationPreferences();

  assert.match(calls[0].url, /\/api\/v1\/notifications\?/);
  const listUrl = new URL(calls[0].url, 'http://localhost');
  assert.equal(listUrl.searchParams.get('category'), 'recovery-quests');
  assert.equal(listUrl.searchParams.get('readState'), 'unread');
  assert.equal(listUrl.searchParams.get('cursor'), 'opaque-cursor');
  assert.equal(listUrl.searchParams.get('limit'), '10');
  assert.equal(calls[1].url, '/api/v1/notifications/unread-count');
  assert.equal(calls[2].url, '/api/v1/notifications/notice-123/read');
  assert.equal(calls[2].options.method, 'PATCH');
  assert.equal(calls[3].options.method, 'POST');
  assert.equal(calls[4].url, '/api/v1/notification-preferences');
});
