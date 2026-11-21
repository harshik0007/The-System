const { test, expect } = require('@playwright/test');

const authRoutes = [
  ['/signup', 'Create your access'],
  ['/login', 'Welcome back'],
  ['/forgot-password', 'Recover your password'],
  ['/reset-password', 'Recover your password'],
  ['/account-recovery', 'Account recovery'],
];

test('public authentication screens render without console errors or horizontal overflow', async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];
  const responseChecks = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) responseChecks.push((async () => {
      let body = '';
      try { body = (await response.text()).slice(0, 240); } catch { /* response may be aborted during route changes */ }
      failedResponses.push(`${response.status()} ${response.request().method()} ${response.url()} ${body}`);
    })());
  });

  for (const [path, heading] of authRoutes) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth, `${path} should not overflow horizontally`).toBeLessThanOrEqual(dimensions.width + 1);
  }

  await Promise.all(responseChecks);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors, failedResponses.join('\n')).toEqual([]);
});

test('signup validation and password visibility work without sending an API request', async ({ page }) => {
  const authMutations = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/auth/signup') && request.method() === 'POST') authMutations.push(request.url());
  });

  await page.goto('/signup');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Enter your first name.')).toBeVisible();
  await expect(page.getByText('Enter your last name.')).toBeVisible();
  await expect(page.getByText(/Use 3–24 characters, start with a letter/)).toBeVisible();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await expect(page.getByText('Please acknowledge the terms to continue.')).toBeVisible();
  await expect.poll(() => authMutations.length).toBe(0);

  await page.getByLabel('Password', { exact: true }).fill('a long demonstration passphrase');
  const password = page.locator('#signup-password');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');
});
