const path = require('node:path');
const { defineConfig } = require('@playwright/test');

const artifactsDirectory = path.resolve(
  process.env.PW_ARTIFACTS_DIR || 'artifacts/stability-audit',
);

module.exports = defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.cjs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  outputDir: path.join(artifactsDirectory, 'test-output'),
  reporter: [['list']],
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:5175',
    browserName: 'chromium',
    channel: process.env.PW_BROWSER_CHANNEL || 'chrome',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { viewport: { width: 1440, height: 900 }, isMobile: false },
    },
    {
      name: 'mobile-chrome',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'tablet-chrome',
      use: {
        viewport: { width: 768, height: 1024 },
        isMobile: false,
        hasTouch: true,
        deviceScaleFactor: 1,
      },
    },
  ],
});
