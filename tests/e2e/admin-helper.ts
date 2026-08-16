/**
 * Admin helper: set game state for testing.
 *
 * Call from within the game iframe to set buildings, resources, ships, etc.
 * Requires the player to be an admin (requireDev middleware).
 *
 * Usage in tests:
 *   import { setGameState } from './admin-helper';
 *   await setGameState(frame, {
 *     buildings: { station: 4, dock: 3, mine: 2, solar: 2, hab: 2, warehouse: 1 },
 *     resources: { ore: 2000, food: 2000, energy: 2000, fuel: 500 },
 *     ships: [{ typeId: 3, count: 1 }],
 *     completeCharges: 5,
 *   });
 */

import type { Frame } from '@playwright/test';

export interface SetStateOptions {
  buildings?: Partial<Record<string, number>>;
  resources?: Partial<{ ore: number; food: number; energy: number; fuel: number }>;
  ships?: Array<{ typeId: number; count: number }>;
  completeCharges?: number;
  discoveredStars?: number[];
}

/**
 * Set game state via admin endpoint from within the game iframe.
 * The iframe's fetch is authenticated by the Devvit session.
 */
export async function setGameState(
  frame: Frame,
  options: SetStateOptions,
): Promise<{ ok: boolean; error?: string }> {
  return frame.evaluate(async (opts) => {
    // Get username and starIndex from __testState
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = (globalThis as any).__testState?.();
    // playerName is the display name — we need the Reddit username for the server
    // The Reddit username is available from the Devvit context (stored at module init)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redditUsername = (globalThis as any).__REDDIT_USERNAME__ || state?.playerName;
    // Prefer starIndex from economy snapshot (accurate), fall back to homeStar
    const starIndex = state?.starIndex ?? state?.homeStar;

    if (!redditUsername || starIndex == null) {
      return { ok: false, error: `Cannot get username/starIndex (user=${redditUsername}, star=${starIndex}). Wait for economy data to load first.` };
    }

    try {
      const res = await fetch('/api/admin/set-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: redditUsername,
          starIndex,
          ...opts,
        }),
      });
      if (res.ok) {
        return await res.json() as { ok: boolean };
      } else {
        const err = await res.json().catch(() => ({ message: 'unknown error' }));
        return { ok: false, error: (err as { message?: string }).message ?? 'request failed' };
      }
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }, options);
}

/**
 * Preset: mid-game state with dock L3, all production buildings L2, resources stocked.
 * Ready for ship building and fleet operations.
 */
export const PRESET_MID_GAME: SetStateOptions = {
  buildings: { station: 4, dock: 3, mine: 3, solar: 3, hab: 3, warehouse: 2, shield: 1 },
  resources: { ore: 2000, food: 2000, energy: 2000, fuel: 500 },
  ships: [{ typeId: 3, count: 1 }], // 1 Destroyer
  completeCharges: 3,
};

/**
 * Preset: early-game state with station L2, basic production.
 */
export const PRESET_EARLY_GAME: SetStateOptions = {
  buildings: { station: 2, mine: 1, solar: 1, hab: 1 },
  resources: { ore: 800, food: 800, energy: 800, fuel: 100 },
};

/**
 * Preset: late-game state with max buildings and fleet.
 */
export const PRESET_LATE_GAME: SetStateOptions = {
  buildings: { station: 8, dock: 5, mine: 6, solar: 6, hab: 6, warehouse: 4, shield: 4, cannon: 4, refinery: 3 },
  resources: { ore: 5000, food: 5000, energy: 5000, fuel: 2000 },
  ships: [
    { typeId: 7, count: 1 },  // Dreadnought
    { typeId: 6, count: 1 },  // Command Cruiser
    { typeId: 2, count: 2 },  // Freighters
    { typeId: 8, count: 1 },  // Colony Ship
  ],
  completeCharges: 10,
};
