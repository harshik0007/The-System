const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const baseUrl = () => process.env.PW_BASE_URL || 'http://localhost:5174';
const artifactsRoot = () => path.resolve(process.env.PW_ARTIFACTS_DIR || 'artifacts/stability-audit');

async function isolateApplicationApi(page) {
  const mutationAttempts = [];
  let occurrenceEnsures = 0;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const pathname = new URL(request.url()).pathname;

    if (method === 'GET' && pathname.endsWith('/emergency-pause')) {
      await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        currentIstMonth: '2026-11',
        allowance: 2,
        activationsUsed: 1,
        activationsRemaining: 1,
        isActive: true,
        pause: {
          id: 'edge-fixture-pause',
          durationDays: 1,
          startedAt: '2026-11-19T03:15:00.000Z',
          selectedEndAt: '2026-11-20T03:15:00.000Z',
          effectiveEndAt: '2026-11-20T03:15:00.000Z',
          remainingMs: 86_400_000,
        },
        progressionRunId: 'isolated-edge-fixture',
        serverNow: '2026-11-19T03:15:00.000Z',
      }),
      });
      return;
    }

    if (method === 'POST' && pathname.endsWith('/task-occurrences/ensure')) {
      occurrenceEnsures += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ occurrences: [] }) });
      return;
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      mutationAttempts.push(`${method} ${pathname}`);
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'Blocked by isolated edge-case browser test.' }) });
      return;
    }

    await route.continue();
  });
  return { mutationAttempts, getOccurrenceEnsures: () => occurrenceEnsures };
}

test('isolated server-reported active Pause displays Crimson Serenity without blocking app controls', async ({ page }, testInfo) => {
  const outputDirectory = path.join(artifactsRoot(), 'edge-cases');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const apiIsolation = await isolateApplicationApi(page);
  await page.goto(new URL('/app/dashboard', baseUrl()).toString(), { waitUntil: 'domcontentloaded' });

  const atmosphere = page.locator('.emergency-pause-atmosphere');
  await expect(atmosphere).toHaveClass(/emergency-pause-atmosphere--active/);
  await expect(page.locator('body')).toHaveClass(/emergency-pause-atmosphere-running/);
  await expect(page.getByText('Emergency Pause Active', { exact: true })).toBeVisible();
  await expect(page.getByText('1 / 2 used this month', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Resume Early' })).toBeVisible();
  await expect(atmosphere.locator('.emergency-pause-atmosphere__leaf')).toHaveCount(20);
  await expect(atmosphere.locator('.emergency-pause-atmosphere__particle')).toHaveCount(26);

  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outputDirectory, `active-pause-${testInfo.project.name}.png`) });
  await page.getByRole('button', { name: 'Pause Rules', exact: true }).click();
  const rulesDialog = page.getByRole('dialog', { name: 'Emergency Pause' });
  await expect(rulesDialog).toBeVisible();
  await rulesDialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/tasks$/);
  await expect(page.locator('.emergency-pause-atmosphere')).toHaveClass(/emergency-pause-atmosphere--active/);
  await expect(page.locator('body')).toHaveClass(/emergency-pause-atmosphere-running/);
  expect(apiIsolation.getOccurrenceEnsures()).toBeGreaterThan(0);
  expect(apiIsolation.mutationAttempts).toEqual([]);
});

test('server-reported active Pause leaves a static aura for reduced-motion users', async ({ page }, testInfo) => {
  const outputDirectory = path.join(artifactsRoot(), 'edge-cases');
  fs.mkdirSync(outputDirectory, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const apiIsolation = await isolateApplicationApi(page);
  await page.goto(new URL('/app/dashboard', baseUrl()).toString(), { waitUntil: 'domcontentloaded' });

  const atmosphere = page.locator('.emergency-pause-atmosphere');
  await expect(atmosphere).toHaveClass(/is-reduced-motion/);
  await expect(atmosphere).toHaveClass(/emergency-pause-atmosphere--active/);
  await expect(atmosphere.locator('.emergency-pause-atmosphere__aura')).toBeVisible();
  await expect(atmosphere.locator('.emergency-pause-atmosphere__leaf:visible')).toHaveCount(0);
  await expect(atmosphere.locator('.emergency-pause-atmosphere__particle:visible')).toHaveCount(0);
  expect(apiIsolation.mutationAttempts).toEqual([]);
  await page.screenshot({ path: path.join(outputDirectory, `active-pause-reduced-motion-${testInfo.project.name}.png`), fullPage: true, animations: 'disabled' });
});
