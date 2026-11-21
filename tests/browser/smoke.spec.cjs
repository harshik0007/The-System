const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { auditRoute } = require('./routeAuditHelper.cjs');

const smokeRoutes = [
  { path: '/', expectedHeading: 'Progress is built, not given' },
  { path: '/app/dashboard', expectedHeading: 'Welcome back' },
  { path: '/app/discipline', expectedHeading: 'Discipline' },
];

test('read-only landing, dashboard and discipline smoke routes', async ({ page }, testInfo) => {
  const artifactsRoot = path.resolve(process.env.PW_ARTIFACTS_DIR || 'artifacts/stability-audit');
  const projectDirectory = path.join(artifactsRoot, 'smoke', testInfo.project.name);
  const results = [];

  for (const route of smokeRoutes) {
    const name = route.path === '/' ? 'landing' : route.path.slice(1).replaceAll('/', '-');
    const result = await auditRoute(page, route, {
      screenshotPath: path.join(projectDirectory, `${name}.png`),
      eventsPath: path.join(projectDirectory, `${name}.events.json`),
      contentTimeoutMs: 15_000,
    });
    results.push(result);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  }

  const summaryPath = path.join(projectDirectory, 'summary.json');
  require('node:fs').mkdirSync(projectDirectory, { recursive: true });
  require('node:fs').writeFileSync(summaryPath, `${JSON.stringify({ project: testInfo.project.name, viewport: testInfo.project.use.viewport, routes: results }, null, 2)}\n`);
  expect(results).toHaveLength(smokeRoutes.length);
  for (const result of results) {
    expect(result.navigated, `${result.route} should navigate`).toBeTruthy();
    expect(result.navigationOk, `${result.route} should return a successful document response`).toBeTruthy();
    expect(result.contentVisible, `${result.route} should render meaningful content`).toBeTruthy();
    expect(result.persistentLoadingFallback, `${result.route} should not remain on the lazy-loading fallback`).toBeFalsy();
    expect(result.blank, `${result.route} should not be blank`).toBeFalsy();
    expect(result.screenshot, `${result.route} screenshot should be saved`).toBeTruthy();
  }
});
