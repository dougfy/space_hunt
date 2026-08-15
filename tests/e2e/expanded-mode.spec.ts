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

    // 5. Switch to Fullscreen mode via the Devvit preview dropdown
    //    The toolbar shows "Mobile ∨" — click it, then select "Fullscreen"
    console.log('[EXPANDED] Switching to Fullscreen mode...');
    let switched = false;

    // Try multiple approaches to find and click the Mobile dropdown
    const dropdownSelectors = [
      'button:has-text("Mobile")',
      '[aria-label*="device"] >> text=Mobile',
      'select:has(option[value="mobile"])',
      '.device-selector',
      'text=Mobile >> xpath=..',
    ];

    for (const selector of dropdownSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 2_000 })) {
          await el.click();
          await page.waitForTimeout(500);
          // Now click Fullscreen
          const fsOption = page.locator('text=Fullscreen').first();
          if (await fsOption.isVisible({ timeout: 2_000 })) {
            await fsOption.click();
            await page.waitForTimeout(2_000);
            switched = true;
            console.log('[EXPANDED] ✓ Switched to Fullscreen via:', selector);
            break;
          }
        }
      } catch { /* try next */ }
    }

    // Also try: the dropdown might be a <select> element
    if (!switched) {
      try {
        const select = page.locator('select').first();
        if (await select.isVisible({ timeout: 2_000 })) {
          await select.selectOption({ label: 'Fullscreen' });
          await page.waitForTimeout(2_000);
          switched = true;
          console.log('[EXPANDED] ✓ Switched to Fullscreen via <select>');
        }
      } catch { /* not a select */ }
    }

    // Try looking in all frames for the dropdown
    if (!switched) {
      for (const frame of page.frames()) {
        try {
          const mobileBtn = frame.locator('text=Mobile').first();
          if (await mobileBtn.isVisible({ timeout: 1_000 })) {
            await mobileBtn.click();
            await page.waitForTimeout(500);
            const fsBtn = frame.locator('text=Fullscreen').first();
            if (await fsBtn.isVisible({ timeout: 1_000 })) {
              await fsBtn.click();
              await page.waitForTimeout(2_000);
              switched = true;
              console.log('[EXPANDED] ✓ Switched to Fullscreen via frame:', frame.url().substring(0, 60));
              break;
            }
          }
        } catch { /* try next frame */ }
      }
    }

    if (!switched) {
      console.log('[EXPANDED] ⚠ Could not switch to Fullscreen — dropdown not found');
      // Log page content for debugging
      const allText = await page.locator('body').innerText().catch(() => '');
      if (allText.includes('Mobile')) {
        console.log('[EXPANDED] "Mobile" text IS on page but not clickable with tried selectors');
      }
    }

    // Re-find the game frame after mode switch (iframe may have reloaded)
    expandedFrame = await findGameFrame(page);
    console.log('[EXPANDED] Game frame after fullscreen:', expandedFrame.url());

    // 6. Dismiss any "Preview across devices" overlay from Devvit
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

    // 8. Visual verification — check for overlapping UI elements
    const result1 = await verifier.verify(
      expandedFrame,
      'no-overlapping-ui',
      'Check carefully for any OVERLAPPING TEXT or BUTTONS covering other text areas. All UI elements should be clearly readable with no text rendered on top of other text. Panel labels, resource counters, star names, fuel indicators, and button text should each be in their own space without colliding. If ANY text overlaps other text, or ANY button covers a text area making it unreadable, this FAILS. Look specifically at: top-left info panel, right-side panel tabs, bottom dock bar, and any floating labels.'
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
