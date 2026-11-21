const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { discoverRoutes } = require('../../scripts/discover-browser-routes.cjs');
const { auditRoute, attachBrowserEventCapture } = require('./routeAuditHelper.cjs');

const rankNames = {
  origin: 'Origin', ember: 'Ember', surge: 'Surge', vector: 'Vector',
  apex: 'Apex', zenith: 'Zenith', continuum: 'Continuum',
};
const legalTitles = {
  terms: 'Terms & Conditions', privacy: 'Privacy Policy', cookies: 'Cookie Policy',
  'acceptable-use': 'Acceptable Use Policy', 'community-guidelines': 'Community Guidelines',
  'proof-verification': 'Proof Verification Policy', 'ai-disclosure': 'AI & Proof Verification Policy',
  'data-retention': 'Data Retention & Deletion', 'account-reset': 'Account & Progression Reset',
  grievance: 'Grievance',
};
const headings = {
  '/': 'Progress is built, not given',
  '/signup': 'Create your access', '/login': 'Welcome back',
  '/forgot-password': 'Reset your password', '/reset-password': 'Choose a new password',
  '/account-recovery': 'Account recovery', '/about': 'Progress is built, not given',
  '/how-it-works': 'From intention to verified progress', '/features': 'Tools for a more intentional life',
  '/ranks': 'Seven Ranks', '/rules': 'Know the commitments', '/faq': 'Frequently asked questions',
  '/getting-started': 'Make your first commitment count', '/contact': 'How can we help',
  '/app': 'Welcome back', '/app/dashboard': 'Welcome back', '/app/tasks': 'Daily Tasks',
  '/app/recovery-quests': 'Recovery Quests', '/app/discipline': 'Discipline',
  '/app/leaderboard': 'Community Leaderboard', '/app/settings': 'Settings',
  '/app/monthly-analysis': 'Monthly Analysis', '/app/notifications': 'Notifications',
};

function expectedHeading(route) {
  if (headings[route.path]) return headings[route.path];
  if (route.path.startsWith('/ranks/')) return rankNames[route.dataKey] || null;
  if (route.path.startsWith('/legal/')) return legalTitles[route.dataKey] || null;
  return null;
}

function safeFileName(route) {
  if (route.path === '/') return 'landing';
  if (route.routePattern === '/app/profile/:memberId') return 'app-profile-public-member';
  return route.path.slice(1).replaceAll('/', '-');
}

async function getPublicMemberPath(page, baseUrl) {
  await page.goto(new URL('/app/leaderboard', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Community Leaderboard' }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#leaderboard-results').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForFunction(() => {
    const results = document.querySelector('#leaderboard-results');
    return results && !results.innerText.includes('Loading standings');
  }, null, { timeout: 15_000 });
  const links = await page.locator('a[href^="/app/profile/"]').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
  for (const href of links) {
    if (!href) continue;
    const segment = decodeURIComponent(href.split('/').filter(Boolean).at(-1) || '');
    if (segment.length >= 3 && !/^[a-f\d]{24}$/i.test(segment)) return `/app/profile/${encodeURIComponent(segment)}`;
  }
  return null;
}

test('complete 44-route stability sweep with responsive evidence', async ({ page }, testInfo) => {
  test.setTimeout(25 * 60 * 1000);
  attachBrowserEventCapture(page);
  const routes = discoverRoutes();
  const baseUrl = process.env.PW_BASE_URL || 'http://localhost:5174';
  const artifactsRoot = path.resolve(process.env.PW_ARTIFACTS_DIR || 'artifacts/stability-audit');
  const projectDirectory = path.join(artifactsRoot, 'full-44', testInfo.project.name);
  const screenshotDirectory = path.join(projectDirectory, 'screenshots');
  const eventDirectory = path.join(projectDirectory, 'events');
  fs.mkdirSync(screenshotDirectory, { recursive: true });
  fs.mkdirSync(eventDirectory, { recursive: true });

  let publicProfilePath = null;
  try { publicProfilePath = await getPublicMemberPath(page, baseUrl); } catch { publicProfilePath = null; }

  const results = [];
  for (const route of routes) {
    const dynamicPublicProfile = route.routePattern === '/app/profile/:memberId';
    if (dynamicPublicProfile && !publicProfilePath) {
      results.push({
        route: route.path,
        result: 'blocked',
        reason: 'The live Leaderboard returned no publicHandle-based profile link; a member identifier was not invented or taken from private data.',
        viewport: testInfo.project.use.viewport,
        screenshot: null,
        events: { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [], httpFailures: [], apiTimings: [] },
      });
      continue;
    }

    const routePath = dynamicPublicProfile ? publicProfilePath : route.testPath;
    const fileName = safeFileName(route);
    const screenshotPath = path.join(screenshotDirectory, `${fileName}.png`);
    const eventsPath = path.join(eventDirectory, `${fileName}.json`);
    const result = await auditRoute(page, routePath, {
      expectedHeading: expectedHeading(route),
      reportPath: route.path,
      screenshotPath,
      eventsPath,
      contentTimeoutMs: 15_000,
    });
    result.viewport = testInfo.project.use.viewport;
    result.routePattern = route.routePattern || null;
    result.consoleCounts = {
      errors: result.events.consoleErrors.length,
      warnings: result.events.consoleWarnings.length,
      gsapMissingTargets: result.events.consoleWarnings.filter((warning) => /GSAP target .* not found/.test(warning.text)).length,
    };
    result.networkCounts = {
      failed: result.events.failedRequests.length,
      expectedNavigationCancellations: result.events.failedRequests.filter((request) => /ERR_ABORTED|aborted/i.test(request.error)).length,
      httpFailures: result.events.httpFailures.length,
      apiResponses: result.events.apiTimings.length,
    };
    const unexpectedRequestFailures = result.events.failedRequests
      .filter((request) => !/ERR_ABORTED|aborted/i.test(request.error));
    result.failureReasons = [
      ...(result.navigationOk ? [] : ['Document navigation did not return a successful response.']),
      ...(result.contentVisible && result.page?.headingVisible && !result.persistentLoadingFallback && !result.blank
        ? [] : ['Expected route content did not render.']),
      ...(result.unresolvedLoading?.length ? [`Loading content remained after navigation settled: ${result.unresolvedLoading.join(' | ')}`] : []),
      ...(result.networkSettled === false ? ['Route data did not settle before the capture timeout.'] : []),
      ...(result.events.httpFailures.length ? [`${result.events.httpFailures.length} HTTP response(s) returned an error.`] : []),
      ...(result.events.consoleErrors.length ? [`${result.events.consoleErrors.length} browser console error(s) were recorded.`] : []),
      ...(result.events.pageErrors.length ? [`${result.events.pageErrors.length} uncaught page error(s) were recorded.`] : []),
      ...(unexpectedRequestFailures.length ? [`${unexpectedRequestFailures.length} unexpected request(s) failed.`] : []),
      ...(!result.screenshot ? ['Route screenshot was not captured.'] : []),
    ];
    result.result = result.navigated && result.navigationOk && result.contentVisible
      && result.page?.headingVisible && !result.persistentLoadingFallback && !result.blank
      && Boolean(result.screenshot) && result.failureReasons.length === 0 ? 'visited' : 'failed';
    results.push(result);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  }

  const summary = {
    audit: 'Complete 44-route browser stability audit',
    project: testInfo.project.name,
    viewport: testInfo.project.use.viewport,
    discoveredRouteCount: routes.length,
    inspectedCount: results.filter((result) => result.result === 'visited').length,
    blockedCount: results.filter((result) => result.result === 'blocked').length,
    failedCount: results.filter((result) => result.result === 'failed').length,
    publicProfileResolved: Boolean(publicProfilePath),
    routes: results,
  };
  const summaryPath = path.join(projectDirectory, 'route-results.json');
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  expect(routes, 'The browser audit must use the complete registered route inventory').toHaveLength(44);
  expect(results, 'Every discovered route must have an audit result, including explicit blocks').toHaveLength(44);
  expect(summary.failedCount, 'Routes must render without browser errors or failed HTTP responses').toBe(0);
  expect(results.filter((result) => result.consoleCounts?.gsapMissingTargets > 0), 'GSAP must not warn about missing targets').toHaveLength(0);
});
