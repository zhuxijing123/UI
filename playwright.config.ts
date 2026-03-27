import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './tests',
  testMatch: '*.ts',

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests once (video captured on first retry)
  retries: 1,

  // Reporter to use
  reporter: 'html',

  // Shared settings for all tests
  use: {
    // Base URL for the dev server
    baseURL: 'http://localhost:5174',

    // Collect trace when retrying a failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on first retry
    video: 'on-first-retry',
  },

  // Browser projects
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
