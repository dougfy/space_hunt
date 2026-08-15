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
  const selectors = [
    'text=Mobile >> xpath=..',
    'text=Desktop >> xpath=..',
    'text=Fullscreen >> xpath=..',
  ];
  for (const selector of selectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 2_000 })) {
        await el.click();
        await page.waitForTimeout(500);
        const option = page.locator(`text=${mode}`).first();
        if (await option.isVisible({ timeout: 2_000 })) {
          await option.click();
          await page.waitForTimeout(2_000);
          return true;
        }
      }
    } catch { /* try next */ }
  }
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
    await switchDevvitMode(page, 'Desktop');
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
