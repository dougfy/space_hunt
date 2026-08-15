/**
 * Playwright: Log into Reddit and save session state.
 *
 * Usage:
 *   npx playwright test tests/e2e/login.spec.ts --headed
 *
 * This saves auth to tests/e2e/reddit-auth.json for all other tests to use.
 * Re-run whenever the session expires.
 */

import { test } from '@playwright/test';
import { readFileSync } from 'fs';

const USERNAME = 'WeirdAd4511';
const PASSWORD_FILE = '/tmp/.reddit-test-pw';

test.use({ storageState: undefined }); // Don't load existing auth — we're creating it

test('login to Reddit and save session', async ({ page, context }) => {
  test.setTimeout(60_000);

  const password = readFileSync(PASSWORD_FILE, 'utf-8').trim();

  // Navigate to Reddit login
  await page.goto('https://www.reddit.com/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2_000);

  // Fill credentials — Reddit uses custom faceplate-text-input elements
  // The actual <input> is inside the custom element
  const usernameInput = page.locator('#login-username input, input[name="username"]').first();
  const passwordInput = page.locator('#login-password input, input[name="password"]').first();

  // If the inputs are inside shadow DOM, we need to use the custom element's fill behavior
  try {
    await usernameInput.fill(USERNAME);
    await passwordInput.fill(password);
  } catch {
    // Fallback: type into the custom element directly via keyboard
    const userField = page.locator('#login-username, faceplate-text-input[name="username"]').first();
    await userField.click();
    await page.keyboard.type(USERNAME);
    const passField = page.locator('#login-password, faceplate-text-input[name="password"]').first();
    await passField.click();
    await page.keyboard.type(password);
  }

  // Submit — Reddit's login button may be a custom element or standard button
  const submitBtn = page.locator('button:has-text("Log In"), button:has-text("Sign In"), button[type="submit"], faceplate-button:has-text("Log In")').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await submitBtn.click();

  // Wait for login to complete — either redirect away from /login or stay on page with user avatar
  // Reddit may show CAPTCHA, 2FA, or other challenges
  console.log('[LOGIN] Waiting for login to complete...');
  let loggedIn = false;
  for (let i = 0; i < 30; i++) {
    const url = page.url();
    if (!url.includes('/login') && !url.includes('/register')) {
      loggedIn = true;
      break;
    }
    // Check if there's an error message
    const error = await page.locator('.AnimatedForm__errorMessage, [class*="error"]').first().textContent().catch(() => null);
    if (error) {
      console.log('[LOGIN] Error on page:', error.trim());
    }
    await page.waitForTimeout(1_000);
  }

  if (!loggedIn) {
    // Maybe login requires manual intervention (CAPTCHA) — wait longer
    console.log('[LOGIN] Still on login page — may need manual CAPTCHA solve. Waiting 30s...');
    await page.waitForTimeout(30_000);
  }

  await page.waitForTimeout(3_000);

  // Verify we're logged in by checking for user menu
  const isLoggedIn = await page.locator('[data-testid="user-drawer-avatar-logged-in"], faceplate-partial[id*="user-drawer"]').first().isVisible({ timeout: 10_000 }).catch(() => false);
  if (isLoggedIn) {
    console.log('[LOGIN] ✓ Successfully logged in as', USERNAME);
  } else {
    console.log('[LOGIN] ⚠ Login may have succeeded but user avatar not found — saving state anyway');
  }

  // Save storage state
  await context.storageState({ path: 'tests/e2e/reddit-auth.json' });
  console.log('[LOGIN] ✓ Session saved to tests/e2e/reddit-auth.json');
});
