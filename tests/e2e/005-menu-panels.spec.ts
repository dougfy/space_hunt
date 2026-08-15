/**
 * TEST-005: Menu Panel Readability
 *
 * Opens each menu panel in Desktop mode and verifies it's clearly
 * readable with no overlapping elements. Panels are modal overlays
 * that cover the game canvas — they should be fully legible.
 *
 * Panels tested: STATUS, BUILD, SHIPS, FLEET, COMS
 *
 * Usage: npx playwright test tests/e2e/005-menu-panels.spec.ts --headed
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

async function switchDevvitMode(page: import('@playwright/test').Page, mode: 'Mobile' | 'Desktop' | 'Fullscreen'): Promise<boolean> {
  const modeLabels = ['Mobile', 'Desktop', 'Fullscreen'];
  for (const label of modeLabels) {
    try {
      const trigger = page.locator(`text=${label}`).first();
      if (await trigger.isVisible({ timeout: 2_000 })) {
        await trigger.click();
        await page.waitForTimeout(500);
        const options = page.locator(`text=${mode}`);
        const count = await options.count();
        if (count > 0) {
          const target = count > 1 ? options.nth(count - 1) : options.first();
          if (await target.isVisible({ timeout: 2_000 })) {
            await target.click();
            await page.waitForTimeout(3_000);
            return true;
          }
        }
        break;
      }
    } catch { /* try next */ }
  }
  return false;
}

async function setupDesktopMode(page: import('@playwright/test').Page): Promise<import('@playwright/test').Frame> {
  await page.goto(POST_URL, { waitUntil: 'domcontentloaded' });
  let frame = await findGameFrame(page);

  // Enter expanded mode
  const fullBtn = frame.locator('#play-full');
  if (await fullBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await fullBtn.click();
    await page.waitForTimeout(3_000);
  }

  // Dismiss "Got it" dialog
  try {
    const gotIt = page.locator('button:has-text("Got it")').first();
    if (await gotIt.isVisible({ timeout: 3_000 })) {
      await gotIt.click();
      await page.waitForTimeout(1_000);
    }
  } catch { /* no dialog */ }

  // Switch to Desktop mode
  await switchDevvitMode(page, 'Desktop');

  // Re-find frame and wait for game
  frame = await findGameFrame(page);
  await page.waitForTimeout(3_000);

  // Wait for __testState
  for (let i = 0; i < 20; i++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = await frame.evaluate(() => (globalThis as any).__testState?.());
      if (s) break;
    } catch { /* not ready */ }
    await page.waitForTimeout(1_500);
  }

  return frame;
}

async function pressKey(frame: import('@playwright/test').Frame, key: string) {
  // The game listens for keydown on window — dispatch directly into the frame
  await frame.evaluate((k) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  }, key);
  await frame.page().waitForTimeout(100);
  // Also dispatch keyup to clean up
  await frame.evaluate((k) => {
    window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
  }, key);
}

const PANEL_PROMPT = (panelName: string) =>
  `This is the ${panelName} PANEL/MENU in a space strategy game. It should be a slide-out or overlay panel covering part of the game canvas. Check that:
1. The panel content is CLEARLY READABLE — all text labels, values, and buttons are legible
2. No text overlaps other text within the panel
3. Panel headers, rows, and buttons are properly spaced and aligned
4. The panel background provides sufficient contrast for readability
5. If there are buttons or interactive elements, they are distinct and not overlapping
If the panel is clearly displayed and all content is readable without overlap, this PASSES. If any text is cut off, overlapping, or unreadable, this FAILS.`;

test.describe('TEST-005: Menu Panel Readability (Desktop)', () => {
  test.setTimeout(120_000);

  test('STATUS panel is clearly readable', async ({ page }) => {
    const verifier = new VisualVerifier('005-panels-status');
    const frame = await setupDesktopMode(page);

    await pressKey(frame, 't'); // Open STATUS panel
    await page.waitForTimeout(1_500);

    // Verify panel opened
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = await frame.evaluate(() => (globalThis as any).__testState?.()) as Record<string, unknown> | null;
    console.log('[STATUS] openPanel:', state?.openPanel);

    const result = await verifier.verify(frame, 'status-panel', PANEL_PROMPT('STATUS'));
    verifier.writeReport();
    console.log('[STATUS]', result.pass ? '✓' : '✗', result.explanation);
    expect(result.pass).toBe(true);
  });

  test('BUILD panel is clearly readable', async ({ page }) => {
    const verifier = new VisualVerifier('005-panels-build');
    const frame = await setupDesktopMode(page);

    await pressKey(frame, 'b'); // Open BUILD panel
    await page.waitForTimeout(1_500);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = await frame.evaluate(() => (globalThis as any).__testState?.()) as Record<string, unknown> | null;
    console.log('[BUILD] openPanel:', state?.openPanel);

    const result = await verifier.verify(frame, 'build-panel', PANEL_PROMPT('BUILD'));
    verifier.writeReport();
    console.log('[BUILD]', result.pass ? '✓' : '✗', result.explanation);
    expect(result.pass).toBe(true);
  });

  test('SHIPS panel is clearly readable', async ({ page }) => {
    const verifier = new VisualVerifier('005-panels-ships');
    const frame = await setupDesktopMode(page);

    await pressKey(frame, 'n'); // Open SHIPS panel
    await page.waitForTimeout(1_500);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = await frame.evaluate(() => (globalThis as any).__testState?.()) as Record<string, unknown> | null;
    console.log('[SHIPS] openPanel:', state?.openPanel);

    const result = await verifier.verify(frame, 'ships-panel', PANEL_PROMPT('SHIPS'));
    verifier.writeReport();
    console.log('[SHIPS]', result.pass ? '✓' : '✗', result.explanation);
    expect(result.pass).toBe(true);
  });

  test('FLEET panel is clearly readable', async ({ page }) => {
    const verifier = new VisualVerifier('005-panels-fleet');
    const frame = await setupDesktopMode(page);

    await pressKey(frame, 'f'); // Open FLEET panel
    await page.waitForTimeout(1_500);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = await frame.evaluate(() => (globalThis as any).__testState?.()) as Record<string, unknown> | null;
    console.log('[FLEET] openPanel:', state?.openPanel);

    const result = await verifier.verify(frame, 'fleet-panel', PANEL_PROMPT('FLEET'));
    verifier.writeReport();
    console.log('[FLEET]', result.pass ? '✓' : '✗', result.explanation);
    expect(result.pass).toBe(true);
  });

  test('COMS panel is clearly readable', async ({ page }) => {
    const verifier = new VisualVerifier('005-panels-coms');
    const frame = await setupDesktopMode(page);

    await pressKey(frame, 'c'); // Open COMS panel
    await page.waitForTimeout(1_500);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = await frame.evaluate(() => (globalThis as any).__testState?.()) as Record<string, unknown> | null;
    console.log('[COMS] openPanel:', state?.openPanel);

    const result = await verifier.verify(frame, 'coms-panel', PANEL_PROMPT('COMS'));
    verifier.writeReport();
    console.log('[COMS]', result.pass ? '✓' : '✗', result.explanation);
    expect(result.pass).toBe(true);
  });
});
