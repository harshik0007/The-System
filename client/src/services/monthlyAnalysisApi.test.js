import test from 'node:test';
import assert from 'node:assert/strict';
import { taskApi } from './taskApi.js';

test('monthly analysis service requests server-owned report routes without client identity fields', async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ data: { summary: null, months: [] } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  await taskApi.monthlyAnalysisCurrent();
  await taskApi.monthlyAnalysisPrevious();
  await taskApi.monthlyAnalysisMonths();
  await taskApi.monthlyAnalysisSummary('2026-11');
  await taskApi.monthlyAnalysisDetails('2026-11', { limit: 25 });
  await taskApi.monthlyAnalysisCompare('2026-10', '2026-11');
  await taskApi.monthlyAnalysisReminders();
  assert.deepEqual(calls.map((call) => new URL(call.url, 'http://localhost').pathname), [
    '/api/v1/monthly-analysis/current', '/api/v1/monthly-analysis/previous', '/api/v1/monthly-analysis/months',
    '/api/v1/monthly-analysis/2026-11', '/api/v1/monthly-analysis/2026-11/details',
    '/api/v1/monthly-analysis/compare', '/api/v1/monthly-analysis/reminders',
  ]);
  assert.ok(calls.every(({ options }) => !options.body));
  assert.ok(calls.every(({ url }) => !String(url).includes('userId') && !String(url).includes('progressionRunId')));
});

test('monthly PDF download rejects non-PDF success responses and uses a server-authored endpoint', async (t) => {
  const originalFetch = globalThis.fetch;
  let calledUrl;
  globalThis.fetch = async (url) => {
    calledUrl = String(url);
    return new Response(JSON.stringify({ error: { message: 'unexpected JSON' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  await assert.rejects(taskApi.downloadMonthlyAnalysisPdf('2026-11', '2026-10'), /invalid report file/);
  assert.equal(new URL(calledUrl, 'http://localhost').pathname, '/api/v1/monthly-analysis/2026-11/pdf');
  assert.equal(new URL(calledUrl, 'http://localhost').searchParams.get('compare'), '2026-10');
});
