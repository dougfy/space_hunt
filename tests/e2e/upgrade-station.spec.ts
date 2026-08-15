/**
 * Playwright E2E: Log in, start game, open BUILD panel, upgrade station.
 *
 * Usage:
 *   npx playwright test tests/e2e/upgrade-station.spec.ts --headed
 *
 * Requirements:
 *   - Must be logged into Reddit in the browser profile (uses storageState)
 *   - Set REDDIT_POST_URL env var to the target post, or it defaults to playtest sub
 *
 * Keyboard shortcut reference:
 *   b = BUILD panel, n = SHIPS panel, t = STATUS, f = FLEET, c = COMS
 *   u = undock, e = scan, g = recenter, z = zoom, Escape = close panel
 *   1-9 = press Nth button in active panel (BUILD: 1=Station, 2=Hab, ...)
 */

import { test, expect } from '@playwright/test';

// Default to playtest subreddit — override with REDDIT_POST_URL env var
const POST_URL = process.env.REDDIT_POST_URL ?? 'https://www.reddit.com/r/valcordia_space_dev/';

/** Wait for the game iframe inside the Devvit embed and return its Frame. */
async function getGameFrame(page: import('@playwright/test').Page): Promise<import('@playwright/test').Frame> {
  // Devvit renders custom posts inside nested iframes:
  //   page → <shreddit-app> → <devvit2-custom-post> (shadow) → <devvit2-surface> (shadow) → <iframe>
  // The game canvas lives inside the innermost iframe.
  // Playwright auto-discovers all frames regardless of shadow DOM nesting.

  let gameFrame: import('@playwright/test').Frame | null = null;

  // Poll for the game frame by URL pattern (game.html, inline.html, or play.html)
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

  // Fallback: find any frame with #game-canvas
  if (!gameFrame) {
    for (const frame of page.frames()) {
      try {
        const hasCanvas = await frame.evaluate(() => !!document.querySelector('#game-canvas'));
        if (hasCanvas) {
          gameFrame = frame;
          break;
        }
      } catch {
        // Cross-origin or detached frame — skip
      }
    }
  }

  if (!gameFrame) {
    throw new Error('Could not find game iframe. Available frames: ' + page.frames().map(f => f.url()).join(', '));
  }

  return gameFrame;
}

/** Wait until the game's __testState hook is available and returns data. */
async function waitForGameReady(frame: import('@playwright/test').Frame, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const state = await frame.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fn = (globalThis as any).__testState;
        return fn ? fn() : null;
      });
      // Ready when __testState returns anything non-null
      if (state) return;
    } catch {
      // Frame not ready yet
    }
    await frame.page().waitForTimeout(500);
  }
  throw new Error('Game did not reach ready state within timeout');
}

/** Get the current test state snapshot from the game. */
async function getTestState(frame: import('@playwright/test').Frame) {
  return frame.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (globalThis as any).__testState;
    return fn ? fn() : null;
  });
}

/** Press a key in the game iframe. */
async function pressKey(frame: import('@playwright/test').Frame, key: string): Promise<void> {
  await frame.locator('#game-canvas').press(key);
}

/** Wait for economy poll to refresh state (server polls every 5s). */
async function waitForEconomyRefresh(frame: import('@playwright/test').Frame, delayMs = 6_000): Promise<void> {
  await frame.page().waitForTimeout(delayMs);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Valcordia Space E2E', () => {
  test.setTimeout(120_000); // 2 minutes — Reddit pages are slow

  test('upgrade station from fresh game', async ({ page }) => {
    // 1. Navigate and find game
    await page.goto(POST_URL, { waitUntil: 'domcontentloaded' });
    const frame = await getGameFrame(page);

    // Dismiss inline overlay if present
    const playBtn = frame.locator('#play-here');
    if (await playBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await playBtn.click();
    }

    await waitForGameReady(frame);
    console.log('[E2E] Game loaded');

    // 2. Wait for economy data to arrive — poll until resources show up
    console.log('[E2E] Waiting for economy data...');
    let state = await getTestState(frame);
    for (let i = 0; i < 20 && !state?.store; i++) {
      await frame.page().waitForTimeout(2_000);
      state = await getTestState(frame);
    }

    console.log('[E2E] Player:', state!.playerName, '| Star:', state!.homeStar);
    console.log('[E2E] Docked:', state!.docked, '| Ship:', state!.shipShape);
    console.log('[E2E] Resources:', JSON.stringify(state!.store));
    console.log('[E2E] Buildings:', JSON.stringify(state!.buildings));

    // 3. Must be docked to build
    expect(state!.docked).toBe(true);

    // Record baseline
    const stationBefore = state!.buildings?.station;
    const levelBefore = stationBefore?.level ?? 0;
    const statusBefore = stationBefore?.status ?? 'NONE';
    console.log('[E2E] Station before: level', levelBefore, 'status', statusBefore);

    // Skip if already upgrading
    if (statusBefore === 'UPGRADING') {
      console.log('[E2E] SKIP — station already upgrading');
      return;
    }

    // 4. Open BUILD panel (key: b)
    await pressKey(frame, 'b');
    await frame.page().waitForTimeout(500);

    state = await getTestState(frame);
    expect(state!.openPanel).toBe(1); // 1 = BUILD panel
    console.log('[E2E] BUILD panel opened');
    console.log('[E2E] Buttons:', state!.buildButtons.map(b => `${b.label}:${b.enabled ? 'ON' : 'off'}`).join('  '));

    // 5. Check station button is enabled (index 0)
    const stationBtn = state!.buildButtons[0];
    expect(stationBtn).toBeTruthy();
    expect(stationBtn.enabled).toBe(true);
    console.log('[E2E] Station button enabled — pressing 1 to upgrade');

    // 6. Press 1 to upgrade station
    await pressKey(frame, '1');
    await frame.page().waitForTimeout(1_000);

    // Station is a skinnable type — skin picker may appear.
    // Auto-confirm the first skin option via __confirmSkinPicker.
    state = await getTestState(frame);
    if (state!.skinPickerVisible) {
      console.log('[E2E] Skin picker appeared — auto-confirming first option');
      await frame.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).__confirmSkinPicker();
      });
      await frame.page().waitForTimeout(500);
    }

    // 7. Wait for server economy poll to reflect the change
    console.log('[E2E] Waiting for economy refresh...');
    await waitForEconomyRefresh(frame, 8_000);

    // 8. Verify station is now UPGRADING or leveled up
    state = await getTestState(frame);
    const stationAfter = state!.buildings?.station;
    const levelAfter = stationAfter?.level ?? 0;
    const statusAfter = stationAfter?.status ?? 'NONE';
    console.log('[E2E] Station after: level', levelAfter, 'status', statusAfter);
    console.log('[E2E] Resources after:', JSON.stringify(state!.store));

    const upgraded = statusAfter === 'UPGRADING' || levelAfter > levelBefore;
    expect(upgraded).toBe(true);
    console.log('[E2E] ✓ Station upgrade confirmed!');
  });
});
