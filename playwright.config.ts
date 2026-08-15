import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  retries: 0,
  use: {
    // Use a persistent browser context with Reddit login state.
    // Generate with: npx playwright codegen --save-storage=tests/e2e/reddit-auth.json https://www.reddit.com
    storageState: 'tests/e2e/reddit-auth.json',
    headless: false, // Reddit needs headed mode for auth
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
