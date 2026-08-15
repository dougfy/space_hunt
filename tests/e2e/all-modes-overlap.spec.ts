/**
 * E2E: Test each display mode for overlapping UI elements.
 *
 * Each mode gets a fresh page load to avoid state contamination.
 * - Inline: splash/attract mode before clicking anything
 * - Mobile: expanded mode in Devvit mobile preview
 * - Desktop: expanded mode in Devvit desktop preview
 * - Fullscreen: expanded mode in Devvit fullscreen preview
 *
 * Usage: npx playwright test tests/e2e/all-modes-overlap.spec.ts --headed
 */

import { test, expect } from '@playwright/test';
import { VisualVerifier } from './visual-verify';

const POST_URL = 'https://www.reddit.com/r/valcordia_space_dev/comments/1uvhdm8/spacehunt/';

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

const OVERLAP_PROMPT = 'Check carefully for any OVERLAPPING TEXT or BUTTONS covering other text areas. All UI elements should be clearly readable with no text rendered on top of other text. Panel labels, resource counters, star names, fuel indicators, and button text should each be in their own space without colliding. If ANY text overlaps other text, or ANY button covers a text area making it unreadable, this FAILS. Look specifically at: top-left info panel, right-side panel tabs, bottom dock bar, floating labels near ships/stations, and player names.';

async function switchDevvitMode(page: import('@playwright/test').Page, mode: 'Mobile' | 'Desktop' | 'Fullscreen'): Promise<boolean> {
  // The Devvit toolbar has a dropdown showing current mode (e.g. "Mobile ∨")
  // Click it to open, then click the desired option from the list
  const modeLabels = ['Mobile', 'Desktop', 'Fullscreen'];

  // Find and click whichever mode label is currently shown (to open dropdown)
  for (const label of modeLabels) {
    try {
      const trigger = page.locator(`text=${label}`).first();
      if (await trigger.isVisible({ timeout: 2_000 })) {
        await trigger.click();
        await page.waitForTimeout(500);

        // Now the dropdown should be open — find and click the target mode
        // The options appear as a list; the target might be the 2nd or 3rd item
        const options = page.locator(`text=${mode}`);
        const count = await options.count();
        // Click the last match (the dropdown option, not the trigger itself)
        if (count > 0) {
          const target = count > 1 ? options.nth(count - 1) : options.first();
          if (await target.isVisible({ timeout: 2_000 })) {
            await target.click();
            await page.waitForTimeout(3_000);
            console.log(`[MODE] Switched to ${mode} (found ${count} "${mode}" elements, clicked last)`);
            return true;
          }
        }
        break; // opened dropdown but couldn't find option
      }
    } catch { /* try next label */ }
  }
  console.log(`[MODE] ⚠ Could not switch to ${mode}`);
  return false;
}

async function enterExpandedMode(page: import('@playwright/test').Page): Promise<import('@playwright/test').Frame> {
  await page.goto(POST_URL, { waitUntil: 'domcontentloaded' });
  let frame = await findGameFrame(page);

  // Click "Join Full Size" to enter expanded mode
  const fullBtn = frame.locator('#play-full');
  if (await fullBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await fullBtn.click();
    await page.waitForTimeout(3_000);
  }

  // Dismiss "Preview across devices" / "Got it" dialog if present
  try {
    const gotIt = page.locator('button:has-text("Got it")').first();
    if (await gotIt.isVisible({ timeout: 3_000 })) {
      await gotIt.click();
      await page.waitForTimeout(1_000);
    }
  } catch { /* no dialog */ }

  // Re-find frame (should be play.html now)
  frame = await findGameFrame(page);
  return frame;
}

// ─── Individual mode tests (each gets a fresh page) ─────────────────────────

test.describe('Overlap Check — All Modes', () => {

  test('inline mode — no overlap', async ({ page }) => {
    test.setTimeout(60_000);
    const verifier = new VisualVerifier('overlap-inline');

    await page.goto(POST_URL, { waitUntil: 'domcontentloaded' });
    const frame = await findGameFrame(page);

    // Don't click anything — this IS inline/splash mode
    await page.waitForTimeout(5_000); // let it render

    const result = await verifier.verify(
      frame,
      'inline-overlap',
      `INLINE MODE (splash/attract screen with "Play Here" and "Join Full Size" buttons visible). ${OVERLAP_PROMPT}`
    );
    verifier.writeReport();
    console.log('[INLINE]', result.pass ? '✓' : '✗', result.explanation);
    expect(result.pass).toBe(true);
  });

  test('mobile mode — no overlap', async ({ page }) => {
    test.setTimeout(60_000);
    const verifier = new VisualVerifier('overlap-mobile');

    const frame = await enterExpandedMode(page);
    await switchDevvitMode(page, 'Mobile');
    const mobileFrame = await findGameFrame(page);
    await page.waitForTimeout(3_000);

    const result = await verifier.verify(
      mobileFrame,
      'mobile-overlap',
      `MOBILE MODE (narrow portrait layout, ~375px wide, game fully loaded and playing). ${OVERLAP_PROMPT}`
    );
    verifier.writeReport();
    console.log('[MOBILE]', result.pass ? '✓' : '✗', result.explanation);
    expect(result.pass).toBe(true);
  });

  test('desktop mode — no overlap', async ({ page }) => {
    test.setTimeout(60_000);
    const verifier = new VisualVerifier('overlap-desktop');

    const frame = await enterExpandedMode(page);
    const switched = await switchDevvitMode(page, 'Desktop');
    console.log('[DESKTOP] Mode switch result:', switched);
    const desktopFrame = await findGameFrame(page);
    await page.waitForTimeout(3_000);

    const result = await verifier.verify(
      desktopFrame,
      'desktop-overlap',
      `DESKTOP MODE (medium width, game fully loaded and playing). ${OVERLAP_PROMPT}`
    );
    verifier.writeReport();
    console.log('[DESKTOP]', result.pass ? '✓' : '✗', result.explanation);
    expect(result.pass).toBe(true);
  });

  test('fullscreen mode — no overlap', async ({ page }) => {
    test.setTimeout(60_000);
    const verifier = new VisualVerifier('overlap-fullscreen');

    const frame = await enterExpandedMode(page);
    await switchDevvitMode(page, 'Fullscreen');
    const fsFrame = await findGameFrame(page);
    await page.waitForTimeout(3_000);

    const result = await verifier.verify(
      fsFrame,
      'fullscreen-overlap',
      `FULLSCREEN MODE (wide landscape, full browser width, game fully loaded and playing). ${OVERLAP_PROMPT}`
    );
    verifier.writeReport();
    console.log('[FULLSCREEN]', result.pass ? '✓' : '✗', result.explanation);
    expect(result.pass).toBe(true);
  });
});
