/**
 * Sensing resolution — how much of a galaxy event a given player can make out.
 *
 * Targets are global: every player can see that *something* is happening and
 * race for it. What probes buy is resolution, not exclusivity.
 *
 *   no probes        → the star only ("something at Alnilam")
 *   Basic Probe      → full detail, but only close to your territory
 *   Enhanced Probe   → full detail, at a longer range
 *
 * Range is measured from the player's nearest owned star, so sensing radiates
 * from territory rather than from the ship. A radar building slots into this by
 * raising the radius for the star it sits on — see `sensingRadius`.
 *
 * Pure geometry and rules, no I/O, so both server and client can apply it.
 */

import type { StarPosition } from './galaxy-positions';

export const BASIC_PROBE_ID = 11;
export const ENHANCED_PROBE_ID = 12;

export type SensingTier = 'unaided' | 'basic' | 'enhanced';

/** How much of a target is legible. */
export type SensingDetail = 'star' | 'full';

/**
 * Radius in galaxy units, measured from the nearest owned star.
 *
 * Calibrated against real generated galaxies rather than picked by feel —
 * share of the 100 stars resolved at 'full', averaged over three seeds:
 *
 *   tier      1 owned star    3 owned stars
 *   basic         14%             33%
 *   enhanced      44%             67%
 *
 * Both axes matter: upgrading the probe roughly triples the area, and holding
 * more territory widens it again, so sensing reinforces expansion instead of
 * replacing it. Deliberately short of total coverage — an earlier radius of 60
 * resolved 92% of the galaxy from a single star, which erased the tier gap and
 * the incentive to expand.
 *
 * `unaided` has no radius: those players are capped at star-level detail
 * everywhere, never blacked out entirely.
 */
export const SENSING_RANGE: Record<SensingTier, number> = {
  unaided: 0,
  basic: 20,
  enhanced: 35,
};

/** Best tier a fleet affords. Enhanced outranks Basic; quantity is irrelevant. */
export function probeTier(ships: Iterable<{ typeId: number; count: number }>): SensingTier {
  let basic = false;
  for (const ship of ships) {
    if (ship.count <= 0) continue;
    if (ship.typeId === ENHANCED_PROBE_ID) return 'enhanced';
    if (ship.typeId === BASIC_PROBE_ID) basic = true;
  }
  return basic ? 'basic' : 'unaided';
}

/**
 * Effective radius for a tier. `bonus` is additive headroom for future
 * infrastructure (the radar building) so callers extend range without
 * re-deriving the tier table.
 */
export function sensingRadius(tier: SensingTier, bonus = 0): number {
  return SENSING_RANGE[tier] + Math.max(0, bonus);
}

/**
 * Distance from the closest star the player owns to `targetStarIndex`.
 * Returns null when the player owns nothing or positions are missing, which
 * callers treat as out of range.
 */
export function distanceToTerritory(
  positions: ReadonlyArray<StarPosition>,
  ownedStarIndices: Iterable<number>,
  targetStarIndex: number,
): number | null {
  const byIndex = new Map(positions.map((p) => [p.index, p]));
  const target = byIndex.get(targetStarIndex);
  if (!target) return null;
  let best: number | null = null;
  for (const owned of ownedStarIndices) {
    const from = byIndex.get(owned);
    if (!from) continue;
    const d = Math.hypot(from.x - target.x, from.y - target.y);
    if (best === null || d < best) best = d;
  }
  return best;
}

/**
 * Resolution for one target. Star-level is the floor, never "nothing", so the
 * race stays open to players who have not built probes yet.
 */
export function sensingDetail(tier: SensingTier, distance: number | null, bonus = 0): SensingDetail {
  if (tier === 'unaided') return 'star';
  if (distance === null) return 'star';
  return distance <= sensingRadius(tier, bonus) ? 'full' : 'star';
}

/** Convenience: tier + distance in one step. */
export function resolveSensing(
  ships: Iterable<{ typeId: number; count: number }>,
  positions: ReadonlyArray<StarPosition>,
  ownedStarIndices: Iterable<number>,
  targetStarIndex: number,
  bonus = 0,
): { tier: SensingTier; distance: number | null; detail: SensingDetail } {
  const tier = probeTier(ships);
  const distance = distanceToTerritory(positions, ownedStarIndices, targetStarIndex);
  return { tier, distance, detail: sensingDetail(tier, distance, bonus) };
}
