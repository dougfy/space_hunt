/**
 * Quick test to validate the OpenAI vision integration works.
 * Takes a screenshot of the game and asks GPT-4o to describe what it sees.
 *
 * Usage: npx playwright test tests/e2e/test-vision.spec.ts --headed
 */

import { test, expect } from '@playwright/test';
import { VisualVerifier } from './visual-verify';

const POST_URL = process.env.REDDIT_POST_URL ?? 'https://www.reddit.com/r/valcordia_space_dev/';

test('validate OpenAI vision on game screenshot', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto(POST_URL, { waitUntil: 'domcontentloaded' });

  // Find game frame
  let gameFrame: import('@playwright/test').Frame | null = null;
  for (let i = 0; i < 30; i++) {
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
  expect(gameFrame).not.toBeNull();

  // Click Play Here if visible
  try {
    const playBtn = gameFrame!.locator('#play-here');
    if (await playBtn.isVisible({ timeout: 5_000 })) {
      await playBtn.click();
      await page.waitForTimeout(3_000);
    }
  } catch { /* no overlay */ }

  // Wait a moment for the game to render
  await page.waitForTimeout(3_000);

  // Create verifier and run a simple check
  const verifier = new VisualVerifier('vision-validation');

  // Test 1: Basic game rendering check
  const result1 = await verifier.verify(
    gameFrame!,
    'game-canvas-visible',
    'A space game is visible with stars, asteroids, or a ship on a dark background. The game canvas should be rendering something (not blank/white).'
  );
  console.log('[TEST] Vision result:', result1.pass, '—', result1.explanation);

  // Test 2: Check for UI elements
  const result2 = await verifier.verify(
    gameFrame!,
    'ui-elements-present',
    'Game UI elements are visible — this could include text labels like FUEL, resource counters, menu buttons, or a station/dock panel. Look for monospace text in green, orange, or white on a dark background.'
  );
  console.log('[TEST] Vision result:', result2.pass, '—', result2.explanation);

  // Write report
  const reportPath = verifier.writeReport();
  console.log('[TEST] Report at:', reportPath);

  // At least the first check should pass (game is rendering)
  expect(result1.pass).toBe(true);
});
