/**
 * TEST-007: Validate admin set-state endpoint.
 *
 * Sets mid-game state and verifies buildings/resources update.
 *
 * Usage: npx playwright test tests/e2e/007-admin-set-state.spec.ts --headed
 */

import { test, expect } from '@playwright/test';
import { setGameState, PRESET_MID_GAME } from './admin-helper';

const POST_URL = 'https://www.reddit.com/r/valcordia_space_dev/comments/1uvhdm8/spacehunt/';

async function findGameFrame(page: import('@playwright/test').Page) {
  for (let i = 0; i < 60; i++) {
    for (const frame of page.frames()) {
      if (frame.url().includes('game.html') || frame.url().includes('inline.html') || frame.url().includes('play.html')) {
        return frame;
      }
    }
    await page.waitForTimeout(500);
  }
  throw new Error('Game frame not found');
}

test('admin set-state sets mid-game buildings and resources', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto(POST_URL, { waitUntil: 'domcontentloaded' });
  const frame = await findGameFrame(page);

  // Click Play Here if needed
  try {
    const playBtn = frame.locator('#play-here');
    if (await playBtn.isVisible({ timeout: 5_000 })) await playBtn.click();
  } catch { /* no overlay */ }

  // Enter expanded mode (inline mode may not poll economy)
  try {
    const fullBtn = frame.locator('#play-full');
    if (await fullBtn.isVisible({ timeout: 3_000 })) {
      await fullBtn.click();
      await page.waitForTimeout(3_000);
      // Re-find frame
      for (let i = 0; i < 30; i++) {
        for (const f of page.frames()) {
          if (f.url().includes('play.html') || f.url().includes('game.html')) {
            frame = f;
            break;
          }
        }
        if (frame.url().includes('play.html')) break;
        await page.waitForTimeout(500);
      }
    }
  } catch { /* already in expanded */ }

  // Dismiss "Got it" dialog
  try {
    const gotIt = page.locator('button:has-text("Got it")').first();
    if (await gotIt.isVisible({ timeout: 3_000 })) await gotIt.click();
  } catch { /* no dialog */ }

  // Wait for game state
  for (let i = 0; i < 30; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await frame.evaluate(() => (globalThis as any).__testState?.());
    if (s?.playerName) break;
    await page.waitForTimeout(1_500);
  }

  // Wait for economy data to load (so we have correct starIndex)
  for (let i = 0; i < 20; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await frame.evaluate(() => (globalThis as any).__testState?.());
    if (s?.playerName && s?.store) break;
    await page.waitForTimeout(2_000);
  }

  // Set mid-game state
  console.log('[ADMIN] Setting mid-game state...');
  const result = await setGameState(frame, PRESET_MID_GAME);
  console.log('[ADMIN] Result:', JSON.stringify(result));
  expect(result.ok).toBe(true);

  // Wait for economy poll to reflect new state — re-find frame and poll
  let verifyFrame = frame;
  // Re-find game frame in case it changed
  for (const f of page.frames()) {
    if (f.url().includes('play.html') || f.url().includes('game.html')) {
      verifyFrame = f;
      break;
    }
  }

  let state: Record<string, unknown> | null = null;
  for (let i = 0; i < 15; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = await verifyFrame.evaluate(() => (globalThis as any).__testState?.()) as Record<string, unknown> | null;
    if (state?.buildings) {
      console.log('[ADMIN] Economy data arrived at poll', i);
      break;
    }
    console.log('[ADMIN] Poll', i, '— buildings still null, starIndex:', state?.starIndex, 'playing:', state?.playing);
    await page.waitForTimeout(2_000);
  }

  // Verify state changed
  console.log('[ADMIN] Buildings after:', JSON.stringify(state?.buildings));
  console.log('[ADMIN] Store after:', JSON.stringify(state?.store));
  console.log('[ADMIN] Ships after:', JSON.stringify(state?.ships));

  // Verify key buildings set correctly
  expect(state?.buildings?.station?.level).toBe(4);
  expect(state?.buildings?.dock?.level).toBe(3);
  expect(state?.buildings?.mine?.level).toBe(3);
  expect(state?.store?.ore).toBeGreaterThanOrEqual(1900); // ~2000 minus small production tick

  console.log('[ADMIN] ✓ Mid-game state verified!');
});
