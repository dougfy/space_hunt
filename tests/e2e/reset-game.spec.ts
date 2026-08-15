/**
 * E2E: Reset game state back to fresh start.
 *
 * Run this BEFORE the colony-ship-journey test to start from a clean slate.
 * Can also be run after tests to clean up.
 *
 * Usage:
 *   npx playwright test tests/e2e/reset-game.spec.ts --headed
 *
 * Prerequisites:
 *   - Run login.spec.ts first if session expired
 *   - Player must be an admin (WeirdAd4511 is admin)
 */

import { test, expect } from '@playwright/test';

const POST_URL = process.env.REDDIT_POST_URL ?? 'https://www.reddit.com/r/valcordia_space_dev/';

async function getGameFrame(page: import('@playwright/test').Page) {
  let gameFrame: import('@playwright/test').Frame | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    for (const frame of page.frames()) {
      const url = frame.url();
      if (url.includes('game.html') || url.includes('inline.html') || url.includes('play.html')) {
        gameFrame = frame;
        break;
      }
    }
    if (gameFrame) break;
    await page.waitForTimeout(500);
  }
  if (!gameFrame) throw new Error('Game frame not found');
  return gameFrame;
}

test.describe('Game Reset', () => {
  test.setTimeout(90_000);

  test('reset all game state via admin endpoint', async ({ page }) => {
    console.log('[RESET] Navigating to game...');
    await page.goto(POST_URL, { waitUntil: 'domcontentloaded' });
    const frame = await getGameFrame(page);

    // Dismiss inline overlay ("Play Here") if present to start the game
    console.log('[RESET] Looking for Play Here button...');
    try {
      const playBtn = frame.locator('#play-here');
      if (await playBtn.isVisible({ timeout: 8_000 })) {
        console.log('[RESET] Clicking "Play Here" to enter game...');
        await playBtn.click();
        await frame.page().waitForTimeout(3_000);
      }
    } catch { /* no overlay — may be game.html directly */ }

    // Wait for game to be available — try __testState first, fall back to frame context
    console.log('[RESET] Waiting for game state...');
    let state: Record<string, unknown> | null = null;
    for (let i = 0; i < 40; i++) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state = await frame.evaluate(() => (globalThis as any).__testState?.()) as Record<string, unknown> | null;
        if (state && state.playerName) break;
      } catch { /* not ready */ }
      await frame.page().waitForTimeout(1_500);
    }

    if (!state || !state.playerName) {
      console.log('[RESET] __testState not available (inline mode?) — using known username');
    } else {
      console.log('[RESET] Game loaded. Player:', state.playerName, '| Star:', state.homeStar);
      console.log('[RESET] Current buildings:', JSON.stringify(state.buildings));
    }

    const playerName = (state?.playerName as string) || 'WeirdAd4511';

    // Call the admin full reset endpoint from within the game iframe
    // The iframe's fetch() is authenticated by the Devvit session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await frame.evaluate(async (playerName: string) => {
      // Extract postId from the iframe's window.name (Devvit passes context there)
      let postId = '';
      try {
        const frameName = window.name || '';
        const parsed = JSON.parse(frameName);
        if (parsed?.signedRequestContext) {
          const jwt = parsed.signedRequestContext;
          const payload = JSON.parse(atob(jwt.split('.')[1]));
          postId = payload?.devvit?.post?.id ?? '';
        }
      } catch { /* ignore */ }

      if (!postId) {
        return { ok: false, error: 'Could not extract postId from iframe context' };
      }

      try {
        const res = await fetch('/api/admin/reset-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId, adminUser: playerName }),
        });
        return await res.json();
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    }, playerName);

    console.log('[RESET] Server response:', JSON.stringify(result));

    if (result && typeof result === 'object' && 'ok' in result && result.ok) {
      console.log('[RESET] ✓ Full reset successful!');
      console.log('[RESET]   Users cleared:', (result as Record<string, unknown>).usersCleared);
      console.log('[RESET]   Claims cleared:', (result as Record<string, unknown>).claimsCleared);
    } else {
      const errMsg = (result as Record<string, unknown>)?.error ?? JSON.stringify(result);
      throw new Error('Reset failed: ' + errMsg);
    }

    // Reload and verify fresh state
    console.log('[RESET] Reloading page to verify fresh state...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);

    const frame2 = await getGameFrame(page);

    // Wait for economy data to load in new session
    let freshState: Record<string, unknown> | null = null;
    for (let i = 0; i < 30; i++) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        freshState = await frame2.evaluate(() => (globalThis as any).__testState?.()) as Record<string, unknown> | null;
        if (freshState && freshState.playerName) break;
      } catch { /* not ready */ }
      await frame2.page().waitForTimeout(2_000);
    }

    if (freshState && freshState.buildings) {
      const buildings = freshState.buildings as Record<string, { level: number }>;
      const stationLevel = buildings.station?.level ?? 0;
      console.log('[RESET] Fresh state — station level:', stationLevel);
      expect(stationLevel).toBeLessThanOrEqual(1); // Fresh game starts at station 1
      console.log('[RESET] ✓ Fresh state confirmed — ready for testing!');
    } else {
      // Buildings null means economy hasn't loaded yet — that's fine for a fresh game
      console.log('[RESET] ✓ Reset complete — buildings not yet loaded (expected for fresh game)');
    }
  });
});
