import { defineConfig, devices } from '@playwright/test';

// E2E drives a live server + database. Refuse to run against the production
// database unless explicitly allowed — prevents UI test runs from creating
// junk customers/subscriptions in prod (SRS §21).
const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const looksProd = /neon\.tech/i.test(dbUrl) && !process.env.TEST_DATABASE_URL;
if (looksProd && process.env.ALLOW_E2E_ON_PROD !== 'true') {
  throw new Error(
    '[E2E GUARD] Refusing to run Playwright against the production database. ' +
    'Set TEST_DATABASE_URL to a test database, or ALLOW_E2E_ON_PROD=true to override.'
  );
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
