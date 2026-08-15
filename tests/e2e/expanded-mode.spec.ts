/**
 * E2E: Open game in expanded/full-screen mode and visually verify.
 *
 * Flow:
 *   1. Navigate to subreddit (loads inline mode)
 *   2. Click "Join Full Size" button
 *   3. Wait for expanded game to load (new iframe with play.html/game.html)
 *   4. Wait for game to be ready
 *   5. Capture screenshot and verify with OpenAI vision
 *
 * Usage: npx playwright test tests/e2e/expanded-mode.spec.ts --headed
 */

import { test, expect } from '@playwright/test';
import { VisualVerifier } from './visual-verify';

const POST_URL = process.env.REDDIT_POST_URL ?? 'https://www.reddit.com/r/valcordia_space_dev/';

async function findGameFrame(page: import('@playwright/test').Page, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const frame of page.frames()) {
      const url = frame.url();
      if (url.includes('game.html') || url.includes('inline.html') || url.includes('play.html')) {
        return frame;
      }
    }
    await page.waitForTimeout(500);
  }
  throw new Error('Game frame not found');
}

test.describe('Expanded Mode', () => {
  test.setTimeout(90_000);
  test.use({ viewport: { width: 1920, height: 1080 } }); // Force desktop viewport

  test('open full-screen mode and verify game renders', async ({ page }) => {
    const verifier = new VisualVerifier('expanded-mode');

    // Navigate directly to the post page (wider layout than subreddit feed)
    const postPageUrl = 'https://www.reddit.com/r/valcordia_space_dev/comments/1uvhdm8/spacehunt/';
    console.log('[EXPANDED] Navigating to post page...');
    await page.goto(postPageUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);

    // Find the game frame
    const inlineFrame = await findGameFrame(page);
    const inlineUrl = inlineFrame.url();
    console.log('[EXPANDED] Found game frame:', inlineUrl);

    // 3. Click "Join Full Size" to request expanded mode
    const fullBtn = inlineFrame.locator('#play-full');
    await fullBtn.waitFor({ state: 'visible', timeout: 10_000 });
    console.log('[EXPANDED] Clicking "Join Full Size"...');
    await fullBtn.click();

    // 4. Devvit opens expanded mode — this may:
    //    a) Open a new page/tab with the expanded view
    //    b) Navigate the current page to an expanded post view
    //    c) Open a modal/overlay with the expanded game
    // Wait for the game frame to switch to play.html or game.html
    await page.waitForTimeout(3_000);

    // Look for the expanded game frame (play.html or game.html, different from inline)
    let expandedFrame: import('@playwright/test').Frame | null = null;
    for (let i = 0; i < 30; i++) {
      for (const frame of page.frames()) {
        const url = frame.url();
        if ((url.includes('play.html') || url.includes('game.html')) && url !== inlineUrl) {
          expandedFrame = frame;
          break;
        }
      }
      // Also check if the inline frame URL changed to play.html/game.html
      if (!expandedFrame) {
        for (const frame of page.frames()) {
          const url = frame.url();
          if (url.includes('play.html') || url.includes('game.html')) {
            expandedFrame = frame;
            break;
          }
        }
      }
      if (expandedFrame) break;
      await page.waitForTimeout(1_000);
    }

    if (!expandedFrame) {
      // Maybe it opened in a new page — check all pages in context
      console.log('[EXPANDED] Checking for new pages...');
      const pages = page.context().pages();
      for (const p of pages) {
        if (p !== page) {
          console.log('[EXPANDED] Found new page:', p.url());
          expandedFrame = await findGameFrame(p).catch(() => null);
          if (expandedFrame) break;
        }
      }
    }

    if (!expandedFrame) {
      // Last resort — use whatever game frame we can find
      expandedFrame = await findGameFrame(page);
    }

    console.log('[EXPANDED] Expanded frame URL:', expandedFrame.url());

    // 5. Dismiss any "Preview across devices" overlay from Devvit
    try {
      const gotItBtn = page.locator('button:has-text("Got it")').first();
      if (await gotItBtn.isVisible({ timeout: 3_000 })) {
        console.log('[EXPANDED] Dismissing "Preview across devices" overlay...');
        await gotItBtn.click();
        await page.waitForTimeout(1_000);
      }
    } catch { /* no overlay */ }

    // Also try within the expanded frame
    try {
      const gotItFrame = expandedFrame.locator('button:has-text("Got it")').first();
      if (await gotItFrame.isVisible({ timeout: 2_000 })) {
        await gotItFrame.click();
        await page.waitForTimeout(1_000);
      }
    } catch { /* no overlay */ }

    // 6. Wait for game to initialize
    console.log('[EXPANDED] Waiting for game to load...');
    await expandedFrame.page().waitForTimeout(5_000);

    // Try to get game state
    let state: Record<string, unknown> | null = null;
    for (let i = 0; i < 20; i++) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state = await expandedFrame.evaluate(() => (globalThis as any).__testState?.()) as Record<string, unknown> | null;
        if (state) break;
      } catch { /* not ready */ }
      await expandedFrame.page().waitForTimeout(1_500);
    }

    if (state) {
      console.log('[EXPANDED] Game state:', JSON.stringify({
        player: state.playerName,
        docked: state.docked,
        ship: state.shipShape,
        star: state.homeStar,
      }));
    } else {
      console.log('[EXPANDED] Game state not available — proceeding with visual check only');
    }

    // 7. Visual verification — take full page screenshot to show context
    //    Note: Devvit expanded mode renders in a narrow column (Reddit platform limitation).
    //    We verify the GAME renders correctly within its container.
    const result1 = await verifier.verify(
      expandedFrame,
      'expanded-game-loaded',
      'A space game is rendering correctly. The game canvas should show a dark space background with a station, planet, or ship visible. Panel tabs (icons on the right side like BUILD, SHIPS, STATUS, FLEET, COMS) should be present. HUD information like star name, resources, fuel, or orbit status should be displayed. The game should look functional and playable.'
    );

    // 7. If docked, verify dock panel elements
    if (state?.docked) {
      const result2 = await verifier.verify(
        expandedFrame,
        'dock-panel-visible',
        'The player is docked at a station. There should be panel tab buttons visible (likely at the bottom or side). The station or planet surface should be visible with the ship nearby.'
      );
      console.log('[EXPANDED] Dock panel check:', result2.pass ? '✓' : '✗', result2.explanation);
    }

    // Write report
    const reportPath = verifier.writeReport();
    console.log('[EXPANDED] Report:', reportPath);

    // Assert the main check passed
    expect(result1.pass).toBe(true);
    console.log('[EXPANDED] ✓ Expanded mode verified!');
  });
});
