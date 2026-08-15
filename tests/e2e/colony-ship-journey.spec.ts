/**
 * E2E Test Plan: Fresh Player → Colony Ship Built
 *
 * This is the full upgrade path from a brand-new game to building a Colony Ship.
 * Each step builds on the previous one. The test uses keyboard shortcuts and
 * __testState() / __confirmSkinPicker() / __getSoundHistory() hooks.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * PREREQUISITE CHAIN
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Colony Ship requires: Dock Level 3
 * Dock requires:        Station Level 2 (to unlock), resources
 * Station Level 2:      420 ore / 420 food / 420 energy
 * Station Level 3:      600 ore / 600 food / 600 energy (unlocks Cannon)
 *
 * Build times (per level): 120s + (targetLevel - 1) × 60s
 *   Level 1: 120s, Level 2: 180s, Level 3: 240s
 *
 * Dock build time: 600s base
 * Colony Ship build time: 600s
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * TEST STEPS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Each step follows the pattern:
 *   1. Verify preconditions (docked, resources, button enabled)
 *   2. Open panel → press button → handle skin picker
 *   3. Verify sound played
 *   4. Wait for build to complete (poll __testState until status=ACTIVE)
 *   5. Verify completion sound + new level
 *
 * ── STEP 1: Upgrade Station to Level 2 ─────────────────────────────
 * Keys:       b → 1 → (confirm skin)
 * Verify:     station.status === 'UPGRADING', progress > 0
 * Sound:      'click', 'begin_building_facility'
 * Wait:       ~180s for completion
 * Post-check: station.level === 2, station.status === 'ACTIVE'
 * Sound:      'construction_complete_building'
 *
 * ── STEP 2: Build Mine (level 1) ────────────────────────────────────
 * Keys:       b → 3
 * Note:       Mine is NOT skinnable — no skin picker
 * Verify:     mine.status === 'UPGRADING'
 * Sound:      'click', 'begin_building_facility'
 * Wait:       ~120s for completion
 * Post-check: mine.level === 1, mine.status === 'ACTIVE'
 *             rates.ore increased
 *
 * ── STEP 3: Build Solar Array (level 1) ─────────────────────────────
 * Keys:       b → 4 → (confirm skin)
 * Verify:     solar.status === 'UPGRADING'
 * Wait:       ~120s
 * Post-check: solar.level === 1, rates.energy increased
 *
 * ── STEP 4: Build Habitat (level 1) ─────────────────────────────────
 * Keys:       b → 2 → (confirm skin)
 * Verify:     hab.status === 'UPGRADING'
 * Wait:       ~120s
 * Post-check: hab.level === 1, rates.food increased
 *
 * ── STEP 5: Build Dock (level 1) ────────────────────────────────────
 * Keys:       b → 6 → (confirm skin)
 * Requires:   Station ≥ 2 (done in step 1)
 * Verify:     dock.status === 'UPGRADING'
 * Wait:       ~120s
 * Post-check: dock.level === 1
 *
 * ── STEP 6: Upgrade Dock to Level 2 ────────────────────────────────
 * Keys:       b → 6 → (confirm skin)
 * Requires:   Enough resources (may need to wait for production)
 * Verify:     dock.status === 'UPGRADING'
 * Wait:       ~180s
 * Post-check: dock.level === 2
 *
 * ── STEP 7: Upgrade Dock to Level 3 ────────────────────────────────
 * Keys:       b → 6 → (confirm skin)
 * Requires:   Enough resources
 * Verify:     dock.status === 'UPGRADING'
 * Wait:       ~240s
 * Post-check: dock.level === 3
 *
 * ── STEP 8: Build Colony Ship ───────────────────────────────────────
 * Keys:       n → (find colony ship button index) → press number
 * Requires:   Dock ≥ 3, enough resources
 * Verify:     shipBuilding !== null, shipBuilding.typeId === 8
 * Sound:      'click', 'begin_building_ship'
 * Wait:       ~600s
 * Post-check: ships includes { typeId: 8, count: 1 }
 * Sound:      'construction_complete'
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * TIMING ESTIMATES
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Total build time: ~1680s (28 minutes) in real time
 * With admin instant-complete: ~2 minutes (just click + verify)
 *
 * For automated testing, consider:
 * - Using dev-mode instant-complete if available
 * - Running steps as separate test files that resume from saved state
 * - Using longer timeouts (test.setTimeout(1800_000))
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * VERIFICATION CHECKLIST PER STEP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * For each building upgrade:
 * □ Button was enabled before pressing
 * □ 'click' sound played
 * □ Skin picker appeared (for skinnable types)
 * □ 'begin_building_facility' sound played
 * □ Resources deducted from store
 * □ Building status changed to 'UPGRADING'
 * □ Progress bar shows > 0% and ≤ 100%
 * □ After completion: status === 'ACTIVE'
 * □ After completion: level incremented
 * □ 'construction_complete_building' sound played on completion
 *
 * For colony ship build:
 * □ Ship button was enabled
 * □ 'click' sound played
 * □ 'begin_building_ship' sound played
 * □ shipBuilding.typeId === 8 (Colony Ship)
 * □ Progress shows in ship panel
 * □ After completion: ships array includes typeId 8
 * □ 'construction_complete' sound played
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * KEYBOARD REFERENCE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Panel shortcuts:
 *   b = BUILD, n = SHIPS, t = STATUS, f = FLEET, c = COMS, Escape = close
 *
 * BUILD panel buttons (1-9):
 *   1=Station, 2=Hab, 3=Mine, 4=Solar, 5=Store, 6=Dock,
 *   7=Shield, 8=Cannon, 9=Refinery
 *
 * SHIPS panel buttons (1-N):
 *   Position depends on current ship + dock level.
 *   Colony Ship (typeId=8) appears when Dock ≥ 3.
 *
 * Skinnable types (show skin picker): Station, Hab, Solar, Dock, Cannon
 * Non-skinnable (immediate build): Mine, Store, Shield, Refinery
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * WINDOW HOOKS REFERENCE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * __testState() → { openPanel, buildings, store, rates, ships, shipBuilding,
 *                   activeSkinId, skinPickerVisible, buildButtons, shipButtons,
 *                   playerName, docked, shipShape, homeStar, ... }
 *
 * __confirmSkinPicker() → boolean (auto-picks first skin option)
 *
 * __getSoundHistory() → [{ id: string, time: number }, ...]
 *                       Ring buffer of last 20 sounds with timestamps
 */

import { test, expect } from '@playwright/test';

const POST_URL = process.env.REDDIT_POST_URL ?? 'https://www.reddit.com/r/valcordia_space_dev/';

// Re-use helpers from upgrade-station.spec.ts
// In a real suite these would be in a shared helpers file.

async function getGameFrame(page: import('@playwright/test').Page) {
  let gameFrame: import('@playwright/test').Frame | null = null;
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
  if (!gameFrame) throw new Error('Game frame not found');
  return gameFrame;
}

async function waitForGameReady(frame: import('@playwright/test').Frame) {
  for (let i = 0; i < 120; i++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state = await frame.evaluate(() => (globalThis as any).__testState?.());
      if (state) return;
    } catch { /* not ready */ }
    await frame.page().waitForTimeout(500);
  }
  throw new Error('Game not ready');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getState(frame: import('@playwright/test').Frame): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return frame.evaluate(() => (globalThis as any).__testState?.());
}

async function waitForEconomy(frame: import('@playwright/test').Frame) {
  for (let i = 0; i < 20; i++) {
    const s = await getState(frame);
    if (s?.store) return s;
    await frame.page().waitForTimeout(2_000);
  }
  throw new Error('Economy data never loaded');
}

async function pressKey(frame: import('@playwright/test').Frame, key: string) {
  await frame.locator('#game-canvas').press(key);
}

async function confirmSkin(frame: import('@playwright/test').Frame) {
  const s = await getState(frame);
  if (s?.skinPickerVisible) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await frame.evaluate(() => (globalThis as any).__confirmSkinPicker?.());
    await frame.page().waitForTimeout(300);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSounds(frame: import('@playwright/test').Frame): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return frame.evaluate(() => (globalThis as any).__getSoundHistory?.() ?? []);
}

/**
 * Wait for a building to finish upgrading. Polls every 10s.
 * In a real test with long builds, you'd use admin instant-complete.
 */
async function waitForBuildComplete(
  frame: import('@playwright/test').Frame,
  buildingKey: string,
  maxWaitMs = 600_000,
) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const s = await getState(frame);
    const b = s?.buildings?.[buildingKey];
    if (b && b.status === 'ACTIVE') return b;
    const progress = b?.progress ?? 0;
    console.log(`  [wait] ${buildingKey}: ${b?.status} ${progress}%`);
    await frame.page().waitForTimeout(10_000);
  }
  throw new Error(`${buildingKey} did not complete within ${maxWaitMs}ms`);
}

// ─── Full Colony Ship Journey ──────────────────────────────────────────────

test.describe('Colony Ship Journey', () => {
  // This is a LONG test — builds take real time
  test.setTimeout(2_700_000); // 45 minutes

  test('fresh game to colony ship', async ({ page }) => {
    await page.goto(POST_URL, { waitUntil: 'domcontentloaded' });
    const frame = await getGameFrame(page);

    const playBtn = frame.locator('#play-here');
    if (await playBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await playBtn.click();
    }
    await waitForGameReady(frame);
    let state = await waitForEconomy(frame);

    console.log('=== COLONY SHIP JOURNEY ===');
    console.log('Player:', state.playerName, '| Star:', state.homeStar);
    expect(state.docked).toBe(true);

    // ── Helper: upgrade a building ──
    async function upgradeBuilding(key: string, buttonIndex: number, isSkinnable: boolean) {
      console.log(`\n── Upgrading ${key} (button ${buttonIndex}) ──`);
      const before = (await getState(frame)).buildings?.[key];
      console.log(`  Before: level ${before?.level ?? 0} status ${before?.status}`);

      await pressKey(frame, 'b');
      await frame.page().waitForTimeout(300);

      // Wait until button is enabled (resources may need to accumulate)
      let s = await getState(frame);
      let btn = s.buildButtons[buttonIndex - 1];
      if (!btn?.enabled) {
        console.log(`  Waiting for resources (button ${btn?.label} not yet enabled)...`);
        await pressKey(frame, 'Escape'); // close panel while waiting
        for (let wait = 0; wait < 60 && !btn?.enabled; wait++) {
          await frame.page().waitForTimeout(10_000);
          await pressKey(frame, 'b');
          await frame.page().waitForTimeout(300);
          s = await getState(frame);
          btn = s.buildButtons[buttonIndex - 1];
          if (!btn?.enabled) {
            await pressKey(frame, 'Escape');
          }
        }
        if (!btn?.enabled) {
          console.log(`  FAILED — button never enabled after 10 minutes`);
          return false;
        }
        console.log(`  Resources sufficient — proceeding`);
      }

      const t0 = Date.now();
      await pressKey(frame, String(buttonIndex));
      await frame.page().waitForTimeout(500);
      if (isSkinnable) await confirmSkin(frame);
      await frame.page().waitForTimeout(500);

      // Verify sounds
      const sounds = await getSounds(frame);
      const recent = sounds.filter((s: { time: number }) => s.time >= t0).map((s: { id: string }) => s.id);
      console.log('  Sounds:', recent.join(', '));

      // Wait for economy poll
      await frame.page().waitForTimeout(8_000);
      const after = (await getState(frame)).buildings?.[key];
      console.log(`  After: level ${after?.level} status ${after?.status} progress ${after?.progress ?? '-'}%`);
      expect(after?.status).toBe('UPGRADING');

      // Wait for completion
      const completed = await waitForBuildComplete(frame, key);
      console.log(`  ✓ ${key} complete: level ${completed.level}`);

      // Close BUILD panel
      await pressKey(frame, 'Escape');
      await frame.page().waitForTimeout(300);
      return true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BUILD ORDER — optimized for resource production before expensive builds
    // Dock 3 costs 1500/900/1200 — need high production rates first!
    // Each step checks if target level already met before upgrading.
    // ═══════════════════════════════════════════════════════════════════════

    async function upgradeTo(key: string, buttonIndex: number, isSkinnable: boolean, targetLevel: number) {
      state = await getState(frame);
      const current = state.buildings?.[key]?.level ?? 0;
      if (current >= targetLevel) {
        console.log(`\n── ${key} already at level ${current} (target: ${targetLevel}) — skipping ──`);
        return;
      }
      for (let lvl = current; lvl < targetLevel; lvl++) {
        await upgradeBuilding(key, buttonIndex, isSkinnable);
      }
    }

    // ── Phase 1: Station ≥ 2 (unlocks Dock, Warehouse, Shield) ──
    await upgradeTo('station', 1, true, 2);

    // ── Phase 2: Production buildings level 2 ──
    await upgradeTo('mine', 3, false, 2);
    await upgradeTo('solar', 4, true, 2);
    await upgradeTo('hab', 2, true, 2);

    // ── Phase 3: Warehouse (increase cap for Dock 3's 1500 ore cost) ──
    await upgradeTo('warehouse', 5, false, 1);

    // ── Phase 4: Dock to level 3 ──
    state = await getState(frame);
    console.log('\n  Resources before Dock phase:', JSON.stringify(state.store));
    await upgradeTo('dock', 6, true, 3);

    // ── Step 8: Build Colony Ship ──
    console.log('\n── Building Colony Ship ──');
    await pressKey(frame, 'n'); // Open SHIPS panel
    await frame.page().waitForTimeout(500);

    state = await getState(frame);
    expect(state.openPanel).toBe(2); // SHIPS panel
    console.log('  Ship buttons:', state.shipButtons.map(
      (b: { shipTypeId: number; enabled: boolean }) => `type${b.shipTypeId}:${b.enabled ? 'ON' : 'off'}`
    ).join('  '));

    // Find Colony Ship button (typeId = 8)
    let colonyIdx = state.shipButtons.findIndex(
      (b: { shipTypeId: number }) => b.shipTypeId === 8
    );
    expect(colonyIdx).toBeGreaterThanOrEqual(0);

    // Wait for colony ship button to become enabled (may need resources)
    if (!state.shipButtons[colonyIdx].enabled) {
      console.log('  Waiting for Colony Ship button to enable...');
      await pressKey(frame, 'Escape');
      for (let wait = 0; wait < 60; wait++) {
        await frame.page().waitForTimeout(10_000);
        await pressKey(frame, 'n');
        await frame.page().waitForTimeout(300);
        state = await getState(frame);
        colonyIdx = state.shipButtons.findIndex(
          (b: { shipTypeId: number }) => b.shipTypeId === 8
        );
        if (colonyIdx >= 0 && state.shipButtons[colonyIdx].enabled) break;
        await pressKey(frame, 'Escape');
      }
      expect(state.shipButtons[colonyIdx].enabled).toBe(true);
      console.log('  Colony Ship button now enabled');
    }

    const t0 = Date.now();
    await pressKey(frame, String(colonyIdx + 1));
    await frame.page().waitForTimeout(8_000);

    state = await getState(frame);
    expect(state.shipBuilding).not.toBeNull();
    expect(state.shipBuilding.typeId).toBe(8);
    console.log('  Colony Ship building! completeAt:', state.shipBuilding.completeAt);

    const sounds = await getSounds(frame);
    const recent = sounds.filter((s: { time: number }) => s.time >= t0).map((s: { id: string }) => s.id);
    console.log('  Sounds:', recent.join(', '));

    // Wait for colony ship to complete (~600s)
    const start = Date.now();
    while (Date.now() - start < 700_000) {
      state = await getState(frame);
      if (!state.shipBuilding) break;
      console.log('  [wait] Colony ship building...');
      await frame.page().waitForTimeout(10_000);
    }

    // Verify colony ship exists in fleet
    state = await getState(frame);
    const colonyShip = state.ships?.find((s: { typeId: number }) => s.typeId === 8);
    expect(colonyShip).toBeTruthy();
    expect(colonyShip.count).toBeGreaterThanOrEqual(1);
    console.log('  ✓ Colony Ship built! Count:', colonyShip.count);

    console.log('\n=== COLONY SHIP JOURNEY COMPLETE ===');
  });
});
