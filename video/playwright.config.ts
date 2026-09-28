import { defineConfig } from '@playwright/test';

// Captures the frames for the showcase video (see video/README.md).
// Run: npm run build && npx playwright test -c video/playwright.config.ts
export default defineConfig({
  testDir: '.', workers: 1, timeout: 30 * 60_000,
  expect: { timeout: 20_000 },
  use: { baseURL: 'http://127.0.0.1:4188', channel: process.env.BEE_TEST_BROWSER ? undefined : 'chrome', launchOptions: { executablePath: process.env.BEE_TEST_BROWSER }, viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:4188', reuseExistingServer: true, timeout: 20_000 },
});
