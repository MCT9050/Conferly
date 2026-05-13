import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'line',
  // Use local staging in CI, or fall back to production
  use: {
    baseURL: process.env.STAGING_URL || 'http://localhost:4173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true,
  },
  // Automatically build and launch the application locally prior to running tests
  webServer: {
    command: 'npm run build && npx vite preview --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], headless: true },
    },
  ],
});