/**
 * TEST-008: Coach Marks (first-session tutorial)
 *
 * Captures the two coach-mark steps so the look can be reviewed:
 *   Step 1/2 — ring + callout on the BUILD tab
 *   Step 2/2 — ring + callout on the STATION upgrade button
 *
 * Screenshots land in test-screenshots/coach-marks/.
 *
 * Usage: npx playwright test tests/e2e/008-coach-marks.spec.ts --headed
 */

import { test, expect } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, '..', '..', 'test-screenshots', 'coach-marks');

const POST_URL = process.env.REDDIT_POST_URL ?? 'https://www.reddit.com/r/valcordia_space_dev/';

async function findGameFrame(page: import('@playwright/test').Page, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const frame of page.frames()) {
      const url = frame.url();
      if (url.includes('game.html') || url.includes('inline.html') || url.includes('play.html')) return frame;
    }
    await page.waitForTimeout(500);
  }
  throw new Error('Game frame not found');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function testState(frame: import('@playwright/test').Frame): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return frame.evaluate(() => (globalThis as any).__testState?.() ?? null);
}

async function shot(frame: import('@playwright/test').Frame, label: string) {
  mkdirSync(SHOT_DIR, { recursive: true });
  await frame.locator('#game-canvas').screenshot({ path: join(SHOT_DIR, `${label}.png`) });
}

test.describe('TEST-008: Coach Marks', () => {
  test.setTimeout(180_000);

  test('two-step coach: BUILD tab then STATION upgrade', async ({ page }) => {
    await page.goto(POST_URL, { waitUntil: 'domcontentloaded' });
    let frame = await findGameFrame(page);

    const fullBtn = frame.locator('#play-full');
    if (await fullBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await fullBtn.click();
      await page.waitForTimeout(3_000);
      frame = await findGameFrame(page);
    }

    const gotIt = page.locator('button:has-text("Got it")').first();
    if (await gotIt.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await gotIt.click();
      await page.waitForTimeout(1_000);
    }

    for (let i = 0; i < 30; i++) {
      if (await testState(frame)) break;
      await page.waitForTimeout(1_500);
    }

    // Step 1: coach points at the BUILD tab
    await page.waitForTimeout(2_000);
    let state = await testState(frame);
    expect(state?.coach?.active, 'coach should be active for admin/new user').toBe(true);
    expect(state.coach.step).toBe('open_build');
    await shot(frame, 'step1-build-tab');

    // Open BUILD ('b') → coach advances to the station upgrade step
    await frame.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'b', bubbles: true }));
    });
    await page.waitForTimeout(1_500);

    state = await testState(frame);
    expect(state.coach.step).toBe('upgrade_station');
    await shot(frame, 'step2-station-upgrade');

    console.log(`[COACH] screenshots written to ${SHOT_DIR}`);
  });
});
