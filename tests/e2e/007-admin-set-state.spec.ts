/**
 * TEST-007: Validate admin set-state endpoint.
 *
 * Resets game first (ensures player is docked at planet tier),
 * then sets mid-game state and verifies via console log capture.
 *
 * Usage: npx playwright test tests/e2e/007-admin-set-state.spec.ts --headed
 */

import { test, expect } from '@playwright/test';
import { PRESET_MID_GAME } from './admin-helper';

const POST_URL = 'https://www.reddit.com/r/valcordia_space_dev/comments/1uvhdm8/spacehunt/';

async function findGameFrame(page: import('@playwright/test').Page) {
  for (let i = 0; i < 60; i++) {
    for (const frame of page.frames()) {
      if (frame.url().includes('game.html') || frame.url().includes('inline.html') || frame.url().includes('play.html')) {
        return frame;
      }
    }
    await page.waitForTimeout(500);
  }
  throw new Error('Game frame not found');
}

async function waitForGameAndEconomy(frame: import('@playwright/test').Frame, page: import('@playwright/test').Page) {
  // Click Play Here if present
  try {
    const playBtn = frame.locator('#play-here');
    if (await playBtn.isVisible({ timeout: 5_000 })) await playBtn.click();
  } catch { /* no overlay */ }

  // Wait until __testState has economy data (store not null)
  for (let i = 0; i < 30; i++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = await frame.evaluate(() => (globalThis as any).__testState?.());
      if (s?.store) return s;
    } catch { /* not ready */ }
    await page.waitForTimeout(2_000);
  }
  return null;
}

test('admin set-state: reset then set mid-game', async ({ page }) => {
  test.setTimeout(120_000);

  // Capture console logs
  const econLogs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[ECON]')) econLogs.push(text);
  });

  // ── Step 1: Reset game state ──
  console.log('[ADMIN] Step 1: Resetting game...');
  await page.goto(POST_URL, { waitUntil: 'domcontentloaded' });
  let frame = await findGameFrame(page);

  // Click Play Here to enter game
  try {
    const playBtn = frame.locator('#play-here');
    if (await playBtn.isVisible({ timeout: 8_000 })) await playBtn.click();
  } catch { /* no overlay */ }
  await page.waitForTimeout(3_000);

  // Call reset
  const resetResult = await frame.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redditUser = (globalThis as any).__REDDIT_USERNAME__ || 'WeirdAd4511';
    let postId = '';
    try {
      const frameName = window.name || '';
      const parsed = JSON.parse(frameName);
      if (parsed?.signedRequestContext) {
        const jwt = parsed.signedRequestContext;
        const payload = JSON.parse(atob(jwt.split('.')[1]));
        postId = payload?.devvit?.post?.id ?? '';
      }
    } catch { /* ignore */ }
    if (!postId) return { ok: false, error: 'no postId' };
    try {
      const res = await fetch('/api/admin/reset-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, adminUser: redditUser }),
      });
      return await res.json();
    } catch (e) { return { ok: false, error: String(e) }; }
  });
  console.log('[ADMIN] Reset result:', JSON.stringify(resetResult));

  // ── Step 2: Reload to get fresh state (docked at home star) ──
  console.log('[ADMIN] Step 2: Reloading...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3_000);
  frame = await findGameFrame(page);

  // Wait for game + economy (use console logs as proof)
  console.log('[ADMIN] Waiting for economy after reload...');
  econLogs.length = 0; // clear old logs
  for (let i = 0; i < 30; i++) {
    if (econLogs.some(l => l.includes('station:L1'))) break;
    await page.waitForTimeout(1_000);
  }
  const resetConfirmed = econLogs.some(l => l.includes('station:L1'));
  console.log('[ADMIN] Reset confirmed via logs:', resetConfirmed);

  if (!resetConfirmed) {
    console.log('[ADMIN] ⚠ Economy never showed L1 state — logs:', econLogs.join('\n'));
    expect(resetConfirmed).toBe(true);
    return;
  }

  // ── Step 3: Set mid-game state ──
  console.log('[ADMIN] Step 3: Setting mid-game state...');
  // Re-find frame after reload
  frame = await findGameFrame(page);
  const setState = await frame.evaluate(async (opts) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redditUser = (globalThis as any).__REDDIT_USERNAME__ || 'WeirdAd4511';
    const starIndex = 71; // known home star
    try {
      const res = await fetch('/api/admin/set-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: redditUser, starIndex, ...opts }),
      });
      return await res.json();
    } catch (e) { return { ok: false, error: String(e) }; }
  }, PRESET_MID_GAME);
  console.log('[ADMIN] Set-state result:', JSON.stringify(setState));
  expect((setState as { ok: boolean }).ok).toBe(true);

  // ── Step 4: Wait for economy poll to show updated data in console logs ──
  console.log('[ADMIN] Step 4: Waiting for economy refresh...');
  const preCount = econLogs.length;
  let verified = false;
  for (let i = 0; i < 15; i++) {
    const newLogs = econLogs.slice(preCount);
    if (newLogs.some(l => l.includes('station:L4'))) {
      verified = true;
      break;
    }
    await page.waitForTimeout(2_000);
  }

  if (verified) {
    console.log('[ADMIN] ✓ Economy updated — station:L4 confirmed in console logs');
  } else {
    console.log('[ADMIN] ✗ Never saw station:L4 — recent logs:', econLogs.slice(-5).join('\n'));
  }
  expect(verified).toBe(true);
  console.log('[ADMIN] ✓ Admin set-state verified!');
});
