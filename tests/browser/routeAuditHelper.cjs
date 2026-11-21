const fs = require('node:fs');
const path = require('node:path');
const pageCaptures = new WeakMap();

function attachBrowserEventCapture(page) {
  const existing = pageCaptures.get(page);
  if (existing) {
    for (const key of Object.keys(existing)) existing[key] = [];
    return existing;
  }

  const events = {
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    failedRequests: [],
    httpFailures: [],
    apiTimings: [],
  };
  const requestStarts = new WeakMap();

  page.on('console', (message) => {
    const location = message.location();
    const entry = {
      text: message.text(),
      location: location?.url ? {
        url: safeUrl(location.url),
        lineNumber: location.lineNumber,
        columnNumber: location.columnNumber,
      } : null,
    };
    if (message.type() === 'error') events.consoleErrors.push(entry);
    if (message.type() === 'warning') events.consoleWarnings.push(entry);
  });
  page.on('pageerror', (error) => events.pageErrors.push({ message: error.message, name: error.name }));
  page.on('request', (request) => requestStarts.set(request, Date.now()));
  page.on('requestfailed', (request) => {
    events.failedRequests.push({
      method: request.method(),
      url: safeUrl(request.url()),
      error: request.failure()?.errorText || 'Request failed',
    });
  });
  page.on('response', async (response) => {
    const request = response.request();
    const url = safeUrl(response.url());
    const durationMs = Math.max(0, Date.now() - (requestStarts.get(request) || Date.now()));
    if (/\/api(?:\/|$)/.test(new URL(response.url()).pathname)) {
      events.apiTimings.push({ method: request.method(), url, status: response.status(), durationMs });
    }
    if (response.status() >= 400) {
      events.httpFailures.push({ method: request.method(), url, status: response.status(), durationMs });
    }
  });

  page.addInitScript(() => {
    window.__playwrightUnhandledRejections = [];
    window.__playwrightGsapWarningStacks = [];
    Error.stackTraceLimit = 40;
    const originalWarn = window.console.warn.bind(window.console);
    window.console.warn = (...args) => {
      if (args.join(' ').includes('GSAP target')) {
        window.__playwrightGsapWarningStacks.push(new Error().stack || 'No stack available');
      }
      originalWarn(...args);
    };
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      window.__playwrightUnhandledRejections.push({
        message: reason instanceof Error ? reason.message : String(reason),
      });
    });
  });

  pageCaptures.set(page, events);

  return events;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    const sanitizedPath = url.pathname.replace(/(\/app\/profile\/)[^/]+/g, '$1:memberId');
    return `${url.origin}${sanitizedPath}`;
  } catch {
    return value.split('?')[0];
  }
}

async function waitForPageContent(page, expectedHeading, timeoutMs = 12_000) {
  const rootSelector = 'main, #root, [data-testid="app-layout"]';
  await page.locator(rootSelector).first().waitFor({ state: 'visible', timeout: timeoutMs });
  await page.waitForFunction(() => {
    const loading = document.querySelector('.route-loading-state');
    if (loading && getComputedStyle(loading).display !== 'none') return false;
    const main = document.querySelector('main') || document.querySelector('#root');
    return Boolean(main && (main.innerText || '').trim().length > 20);
  }, null, { timeout: timeoutMs });

  if (expectedHeading) {
    await page.getByRole('heading', { name: expectedHeading, exact: false }).first().waitFor({ state: 'visible', timeout: timeoutMs });
  }
  return {
    title: await page.title(),
    headings: await page.locator('h1').allTextContents(),
    headingVisible: await page.locator('h1').first().isVisible().catch(() => false),
    contentLength: await page.locator('body').innerText().then((text) => text.trim().length),
  };
}

async function measureLayout(page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth || window.innerWidth;
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    const contentSelectors = 'h1, h2, h3, p, button, a, input, select, textarea, th, td, .app-panel, .monthly-panel';
    const outOfBounds = [...document.querySelectorAll(contentSelectors)].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden'
        && style.display !== 'none' && rect.left < width && rect.right > width + 2;
    }).slice(0, 20).map((element) => ({
      tag: element.tagName.toLowerCase(),
      className: typeof element.className === 'string' ? element.className.slice(0, 100) : '',
      text: (element.innerText || element.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 80),
      right: Math.round(element.getBoundingClientRect().right),
    }));
    const unnamedButtons = [...document.querySelectorAll('button')].filter((button) => {
      const rect = button.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || getComputedStyle(button).visibility === 'hidden') return false;
      return !(button.getAttribute('aria-label') || button.getAttribute('title') || button.innerText.trim());
    }).slice(0, 20).map((button) => button.className || 'button');
    return {
      viewportWidth: window.innerWidth,
      documentWidth,
      horizontalOverflow: documentWidth > width + 1,
      outOfBoundsContent: outOfBounds,
      unnamedVisibleButtons: unnamedButtons,
    };
  });
}

async function auditRoute(page, route, options = {}) {
  const routePath = typeof route === 'string' ? route : route.path;
  const expectedHeading = options.expectedHeading || route.expectedHeading || null;
  const events = attachBrowserEventCapture(page);
  const result = {
    route: options.reportPath || routePath,
    navigated: false,
    httpStatus: null,
    navigationOk: false,
    contentVisible: false,
    persistentLoadingFallback: false,
    blank: false,
    page: null,
    unhandledRejections: [],
    screenshot: null,
    error: null,
    events,
  };

  try {
    const baseUrl = process.env.PW_BASE_URL || 'http://localhost:5174';
    const response = await page.goto(new URL(routePath, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    result.navigated = true;
    result.httpStatus = response?.status() ?? null;
    result.navigationOk = response?.ok() ?? false;
    result.page = await waitForPageContent(page, expectedHeading, options.contentTimeoutMs || 12_000);
    result.networkSettled = await page.waitForLoadState('networkidle', {
      timeout: options.networkIdleTimeoutMs || 12_000,
    }).then(() => true).catch(() => false);
    result.unresolvedLoading = await page.evaluate(() => {
      const main = document.querySelector('main') || document.querySelector('#root');
      if (!main) return [];
      return (main.innerText || '').split('\n').map((line) => line.trim())
        .filter((line) => /^Loading\b/i.test(line)).slice(0, 10);
    });
    result.contentVisible = result.page.contentLength > 20;
    result.layout = await measureLayout(page);
  } catch (error) {
    result.error = { message: error.message, name: error.name };
    try {
      result.persistentLoadingFallback = await page.locator('.route-loading-state').isVisible();
      result.blank = (await page.locator('body').innerText().catch(() => '')).trim().length < 20;
    } catch {
      result.blank = true;
    }
  }

  result.unhandledRejections = await page.evaluate(() => window.__playwrightUnhandledRejections || []).catch(() => []);
  result.gsapWarningStacks = await page.evaluate(() => window.__playwrightGsapWarningStacks || []).catch(() => []);

  if (options.screenshotPath) {
    fs.mkdirSync(path.dirname(options.screenshotPath), { recursive: true });
    await page.screenshot({ path: options.screenshotPath, fullPage: true, animations: 'disabled' }).catch((error) => {
      result.screenshotError = error.message;
    });
    if (!result.screenshotError) result.screenshot = options.screenshotPath;
  }
  if (options.eventsPath) {
    fs.mkdirSync(path.dirname(options.eventsPath), { recursive: true });
    fs.writeFileSync(options.eventsPath, `${JSON.stringify(result, null, 2)}\n`);
  }
  result.events = JSON.parse(JSON.stringify(events));
  return result;
}

module.exports = { attachBrowserEventCapture, auditRoute, measureLayout, waitForPageContent };
