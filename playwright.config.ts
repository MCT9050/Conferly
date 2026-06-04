import { defineConfig, devices } from '@playwright/test';

/**
 * Funding-Ready Playwright Configuration
 * This config handles automatic switching between local development 
 * and production environments (conferly.site).
 */

const isProductionTest = process.env.BASE_URL?.includes('conferly.site');
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  /* Maximum time one test can run for. */
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: isCI,
  /* Retry on CI only */
  retries: isCI ? 2 : 0,
  /* Limit workers to 1 in CI/Production testing to prevent resource timeouts */
  workers: isProductionTest || isCI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['line'], ['html', { open: 'never' }]],
  
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    /* Collect trace when retrying the failed test. */
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true,
  },

  /* 
    PHASE 1 & 2 FIX: 
    Only start the local webServer if we are NOT testing production 
    and NOT explicitly skipping it via BASE_URL.
  */
  webServer: (isProductionTest || isCI) ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60 * 1000, // Explicitly match the 60s to ensure we control the timeout
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
