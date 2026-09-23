import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', workers: 1, timeout: 60_000,
  expect: { timeout: 8000 },
  use: { baseURL: 'http://127.0.0.1:4188', channel: process.env.BEE_TEST_BROWSER ? undefined : 'chrome', launchOptions: { executablePath: process.env.BEE_TEST_BROWSER }, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:4188', reuseExistingServer: true, timeout: 20_000 },
  projects: [{ name: 'desktop-chrome' }],
});
