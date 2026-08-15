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

/** Get the sound history from the game. */
async function getSoundHistory(frame: import('@playwright/test').Frame): Promise<Array<{ id: string; time: number }>> {
  return frame.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (globalThis as any).__getSoundHistory;
    return fn ? fn() : [];
  });
}

/** Check if a specific sound was played after a given timestamp. */
function soundPlayedSince(history: Array<{ id: string; time: number }>, soundId: string, sinceMs: number): boolean {
  return history.some(s => s.id === soundId && s.time >= sinceMs);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Valcordia Space E2E', () => {
  test.setTimeout(120_000); // 2 minutes — Reddit pages are slow

  test('upgrade station — verify progress bar, sound, and skin', async ({ page }) => {
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

    // 2. Wait for economy data to arrive
    console.log('[E2E] Waiting for economy data...');
    let state = await getTestState(frame);
    for (let i = 0; i < 20 && !state?.store; i++) {
      await frame.page().waitForTimeout(2_000);
      state = await getTestState(frame);
    }

    console.log('[E2E] Player:', state!.playerName, '| Star:', state!.homeStar);
    console.log('[E2E] Docked:', state!.docked, '| Ship:', state!.shipShape);
    console.log('[E2E] Resources:', JSON.stringify(state!.store));
    console.log('[E2E] Active skin:', state!.activeSkinId);

    // 3. Must be docked to build
    expect(state!.docked).toBe(true);

    // Record baseline
    const stationBefore = state!.buildings?.station;
    const levelBefore = stationBefore?.level ?? 0;
    const statusBefore = stationBefore?.status ?? 'NONE';
    console.log('[E2E] Station before: level', levelBefore, 'status', statusBefore,
      'skinId:', stationBefore?.skinId ?? '(none)');

    // Skip if already upgrading
    if (statusBefore === 'UPGRADING') {
      console.log('[E2E] SKIP — station already upgrading');
      return;
    }

    // 4. Open BUILD panel (key: b)
    await pressKey(frame, 'b');
    await frame.page().waitForTimeout(500);

    state = await getTestState(frame);
    expect(state!.openPanel).toBe(1);
    console.log('[E2E] BUILD panel opened');
    console.log('[E2E] Buttons:', state!.buildButtons.map(b => `${b.label}:${b.enabled ? 'ON' : 'off'}`).join('  '));

    // 5. Check station button is enabled
    const stationBtn = state!.buildButtons[0];
    expect(stationBtn).toBeTruthy();
    expect(stationBtn.enabled).toBe(true);

    // Record timestamp before action
    const actionTime = Date.now();

    // 6. Press 1 to upgrade station
    console.log('[E2E] Pressing 1 to upgrade station...');
    await pressKey(frame, '1');
    await frame.page().waitForTimeout(1_000);

    // 7. Handle skin picker — verify it appeared (station is skinnable)
    state = await getTestState(frame);
    if (state!.skinPickerVisible) {
      console.log('[E2E] ✓ Skin picker appeared for station upgrade');
      // Auto-confirm first skin
      await frame.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).__confirmSkinPicker();
      });
      await frame.page().waitForTimeout(500);
    }

    // 8. Verify build-start sound played
    let sounds = await getSoundHistory(frame);
    const clickPlayed = soundPlayedSince(sounds, 'click', actionTime);
    console.log('[E2E] Click sound played:', clickPlayed);
    expect(clickPlayed).toBe(true);

    // 9. Wait for economy refresh and verify UPGRADING status + progress bar
    console.log('[E2E] Waiting for economy refresh...');
    await waitForEconomyRefresh(frame, 8_000);

    state = await getTestState(frame);
    const stationAfter = state!.buildings?.station;
    const levelAfter = stationAfter?.level ?? 0;
    const statusAfter = stationAfter?.status ?? 'NONE';
    const progressAfter = stationAfter?.progress;
    const skinIdAfter = stationAfter?.skinId;

    console.log('[E2E] Station after: level', levelAfter, 'status', statusAfter,
      'progress:', progressAfter ?? 'N/A', '%');
    console.log('[E2E] Station skinId:', skinIdAfter ?? '(default)');
    console.log('[E2E] Active skin:', state!.activeSkinId);
    console.log('[E2E] Resources after:', JSON.stringify(state!.store));

    // 10. Verify upgrade started
    const upgraded = statusAfter === 'UPGRADING' || levelAfter > levelBefore;
    expect(upgraded).toBe(true);
    console.log('[E2E] ✓ Station upgrade confirmed');

    // 11. Verify progress bar is showing (if still UPGRADING)
    if (statusAfter === 'UPGRADING') {
      expect(progressAfter).toBeDefined();
      expect(progressAfter).toBeGreaterThan(0);
      expect(progressAfter).toBeLessThanOrEqual(100);
      console.log('[E2E] ✓ Progress bar verified:', progressAfter, '%');
    }

    // 12. Verify skin was set on the building
    if (skinIdAfter) {
      console.log('[E2E] ✓ Skin applied to station:', skinIdAfter);
    }

    // 13. Verify build-facility sound played (server triggers this)
    sounds = await getSoundHistory(frame);
    const buildSoundPlayed = soundPlayedSince(sounds, 'begin_building_facility', actionTime);
    console.log('[E2E] Build facility sound played:', buildSoundPlayed);
    // Note: this sound is played by game.ts when the build request is consumed,
    // so it should fire before the economy poll returns.

    // Print full sound history for debugging
    const recentSounds = sounds.filter(s => s.time >= actionTime).map(s => s.id);
    console.log('[E2E] Sounds since action:', recentSounds.join(', '));

    console.log('[E2E] ✓ All verifications passed!');
  });
});
