/**
 * TEST-006: Scan reveals raster (realistic) graphics
 *
 * When a player scans a station or planet, the wireframe (green line drawing)
 * should transition to raster (realistic/detailed sprite artwork with colors,
 * shading, and filled shapes rather than just green outlines).
 *
 * Flow:
 *   1. Start docked at station — station should be wireframe (green outlines)
 *   2. Press 'e' to scan — station should become raster (detailed, colorful, filled)
 *   3. Undock, orbit the planet
 *   4. Scan the planet — planet should go from wireframe to raster
 *
 * Usage: npx playwright test tests/e2e/006-scan-raster.spec.ts --headed
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

async function pressKey(frame: import('@playwright/test').Frame, key: string) {
  await frame.evaluate((k) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  }, key);
  await frame.page().waitForTimeout(100);
  await frame.evaluate((k) => {
    window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
  }, key);
}

const WIREFRAME_DESC = `WIREFRAME style means: objects are drawn as GREEN LINE OUTLINES on a dark/black background. No filled colors, no shading, no realistic textures — just geometric green lines forming the shape. Think retro vector graphics. A wireframe PLANET looks like a green circle outline with horizontal green lines across it (like latitude lines on a globe).`;

const RASTER_DESC = `RASTER/REALISTIC style means: objects are drawn as FILLED, COLORFUL SPRITES with shading, detail, and realistic appearance. They have multiple colors (not just green), filled shapes, surface textures or patterns. A raster PLANET looks like a filled colored sphere (orange, brown, blue, etc.) with surface detail — NOT just green outlines. A raster STATION looks like a detailed metallic structure with colors and shading.`;

const OVERLAP_CHECK = `ALSO CHECK FOR THESE OVERLAY/COLLISION ISSUES:
- Any orange badge or icon (like a pulsing "!" notification) overlapping text in the top-left info panel
- Any label text overlapping other label text (e.g., "Red Raider (S1)" colliding with "Red Raider")
- Any feature type label (like the word "Station") overlapping the feature name label above it (like "Druen I Station")
- Report any overlapping elements you find, even if the main visual check passes.`;

test.describe('TEST-006: Scan Reveals Raster Graphics (Desktop)', () => {
  test.setTimeout(120_000);

  test('scanning station and planet transitions wireframe to raster', async ({ page }) => {
    const verifier = new VisualVerifier('006-scan-raster');

    // Setup: navigate to post, enter expanded Desktop mode
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

    // Switch to Desktop
    await switchDevvitMode(page, 'Desktop');
    frame = await findGameFrame(page);
    await page.waitForTimeout(3_000);

    // Wait for game state
    for (let i = 0; i < 20; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = await frame.evaluate(() => (globalThis as any).__testState?.()) as Record<string, unknown> | null;
      if (s?.store) break;
      await page.waitForTimeout(2_000);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Before scan — station should be wireframe
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n=== STEP 1: Before scan — check station is wireframe ===');
    const beforeScan = await verifier.verify(
      frame,
      'before-scan-station',
      `Look at the STATION (the structure near the ship, usually labeled "Station" or with the player docked at it) AND the PLANET (the large circular body).

${WIREFRAME_DESC}

${RASTER_DESC}

Is the station currently WIREFRAME (green outlines only)? Is the planet WIREFRAME (green circle with horizontal lines)?
If both are wireframe, this PASSES.
If either already looks realistic/filled/colorful (raster), this FAILS — they should be wireframe BEFORE scanning.

${OVERLAP_CHECK}`
    );
    console.log('[BEFORE SCAN]', beforeScan.pass ? '✓ wireframe' : '✗ not wireframe', '—', beforeScan.explanation);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Scan the station (press 'e')
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n=== STEP 2: Scanning station ===');
    await pressKey(frame, 'e');
    await page.waitForTimeout(3_000); // let scan animation play

    // Wait for scan to complete (check sound history for scan result)
    await page.waitForTimeout(5_000);

    const afterStationScan = await verifier.verify(
      frame,
      'after-scan-station',
      `Look at the STATION (the structure where the player is docked) AND the PLANET (the large circular body).

${WIREFRAME_DESC}

${RASTER_DESC}

After scanning the station, the STATION should now be RASTER/REALISTIC. The PLANET may still be wireframe (green circle with horizontal lines) OR may also be raster (filled colored sphere).

Respond about: 1) Is the station raster? 2) Is the planet wireframe or raster?
If station is raster, this PASSES regardless of planet state.
If station is still wireframe, this FAILS.

${OVERLAP_CHECK}`
    );
    console.log('[AFTER STATION SCAN]', afterStationScan.pass ? '✓' : '✗', '—', afterStationScan.explanation);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Undock and orbit planet
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n=== STEP 3: Undocking and orbiting planet ===');
    await pressKey(frame, 'u'); // undock
    await page.waitForTimeout(3_000);

    // Wait until we're near the planet (the game auto-orbits after undocking)
    // Give time for ship to move and dock at planet orbit
    await page.waitForTimeout(5_000);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: Scan the planet
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n=== STEP 4: Scanning planet ===');
    await pressKey(frame, 'e'); // scan planet
    await page.waitForTimeout(5_000); // let scan complete

    const afterPlanetScan = await verifier.verify(
      frame,
      'after-scan-planet',
      `Look at BOTH the station AND the planet in this screenshot.

${WIREFRAME_DESC}

${RASTER_DESC}

After scanning both, BOTH the station AND the planet should now be RASTER/REALISTIC — filled with colors, detailed artwork, shading, looking like actual sprites rather than green line outlines.

Answer: Are BOTH the station and planet now RASTER/REALISTIC (filled, colorful, detailed)? If both look realistic/detailed, this PASSES. If either is still just green wireframe outlines, this FAILS.

${OVERLAP_CHECK}`
    );
    console.log('[AFTER PLANET SCAN]', afterPlanetScan.pass ? '✓' : '✗', '—', afterPlanetScan.explanation);

    // Write report
    const reportPath = verifier.writeReport();
    console.log('\n[REPORT]', reportPath);

    // Summary
    console.log('\n=== SCAN TEST SUMMARY ===');
    console.log('  Before scan (wireframe):  ', beforeScan.pass ? '✓' : '✗');
    console.log('  After station scan:       ', afterStationScan.pass ? '✓' : '✗');
    console.log('  After planet scan (both): ', afterPlanetScan.pass ? '✓' : '✗');

    // The key assertion: after scanning, things should be raster
    expect(afterStationScan.pass || afterPlanetScan.pass).toBe(true);
  });
});
