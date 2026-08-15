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

  test('all panels are clearly readable', async ({ page }) => {
    const verifier = new VisualVerifier('005-panels');
    const frame = await setupDesktopMode(page);

    // Wait for economy data to confirm game is fully loaded
    for (let i = 0; i < 20; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = await frame.evaluate(() => (globalThis as any).__testState?.()) as Record<string, unknown> | null;
      if (s?.store) break;
      await page.waitForTimeout(2_000);
    }

    const panels = [
      { key: 't', name: 'STATUS', index: 0 },
      { key: 'b', name: 'BUILD', index: 1 },
      { key: 'n', name: 'SHIPS', index: 2 },
      { key: 'c', name: 'COMS', index: 4 },
      { key: null, name: 'SETTINGS', index: -2 }, // opened via DOM button click
    ];

    const results: Array<{ name: string; pass: boolean; explanation: string }> = [];

    for (const panel of panels) {
      // Open panel
      if (panel.key) {
        await pressKey(frame, panel.key);
      } else if (panel.name === 'SETTINGS') {
        // Settings is a DOM panel — click the gear button
        const settingsBtn = frame.locator('#settings-btn');
        if (await settingsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await settingsBtn.click();
        } else {
          console.log(`[${panel.name}] ⚠ Settings button not found`);
          results.push({ name: panel.name, pass: false, explanation: 'Settings button #settings-btn not found in DOM' });
          continue;
        }
      }
      await page.waitForTimeout(1_500);

      // Verify it opened
      if (panel.name === 'SETTINGS') {
        // Settings is a DOM element — check visibility
        const visible = await frame.locator('#settings-panel').evaluate(el => el.classList.contains('visible')).catch(() => false);
        if (!visible) {
          console.log(`[${panel.name}] ⚠ Panel did not open`);
          results.push({ name: panel.name, pass: false, explanation: 'Settings panel not visible after clicking gear button' });
          continue;
        }
        console.log(`[${panel.name}] Settings panel visible`);
      } else {
        // Canvas panels — check via __testState
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = await frame.evaluate(() => (globalThis as any).__testState?.()) as Record<string, unknown> | null;
        const openPanel = state?.openPanel;
        console.log(`[${panel.name}] openPanel: ${openPanel} (expected: ${panel.index})`);

        if (openPanel !== panel.index) {
          console.log(`[${panel.name}] ⚠ Panel did not open — skipping visual check`);
          results.push({ name: panel.name, pass: false, explanation: `Panel did not open (openPanel=${openPanel})` });
          await pressKey(frame, 'Escape');
          await page.waitForTimeout(500);
          continue;
        }
      }

      // Visual verify
      const result = await verifier.verify(frame, `${panel.name.toLowerCase()}-panel`, PANEL_PROMPT(panel.name));
      console.log(`[${panel.name}]`, result.pass ? '✓' : '✗', result.explanation);
      results.push({ name: panel.name, pass: result.pass, explanation: result.explanation });

      // Close panel before opening next
      if (panel.name === 'SETTINGS') {
        await frame.locator('#settings-btn').click();
      } else {
        await pressKey(frame, 'Escape');
      }
      await page.waitForTimeout(500);
    }

    // Write report
    verifier.writeReport();

    // Summary
    console.log('\n=== PANEL RESULTS ===');
    for (const r of results) {
      console.log(`  ${r.name}: ${r.pass ? '✓' : '✗'} ${r.explanation}`);
    }

    const allPassed = results.every(r => r.pass);
    expect(allPassed).toBe(true);
  });
});
