import { describe, expect, it } from 'vitest';
import {
  BASIC_PROBE_ID,
  ENHANCED_PROBE_ID,
  SENSING_RANGE,
  distanceToTerritory,
  probeTier,
  resolveSensing,
  sensingDetail,
  sensingRadius,
} from '../sensing';
import { generateStarPositions } from '../galaxy-positions';
import type { StarPosition } from '../galaxy-positions';

/**
 * Stars on a line, positioned relative to the tier radii:
 *   1 at 20 — on the basic boundary, so both probe tiers resolve it
 *   2 at 28 — between basic and enhanced, the tier-discriminating case
 *   3 at 90 — beyond every tier
 */
const LINE: StarPosition[] = [
  { index: 0, x: 0, y: 0, bodyCount: 4 },
  { index: 1, x: 20, y: 0, bodyCount: 4 },
  { index: 2, x: 28, y: 0, bodyCount: 4 },
  { index: 3, x: 90, y: 0, bodyCount: 4 },
];

describe('probe tier', () => {
  it('reports unaided with no probes', () => {
    expect(probeTier([{ typeId: 1, count: 5 }])).toBe('unaided');
  });

  it('reports unaided when a probe entry exists but the count is zero', () => {
    expect(probeTier([{ typeId: BASIC_PROBE_ID, count: 0 }])).toBe('unaided');
  });

  it('reports basic with a Basic Probe', () => {
    expect(probeTier([{ typeId: BASIC_PROBE_ID, count: 1 }])).toBe('basic');
  });

  it('prefers enhanced regardless of ordering or quantity', () => {
    expect(probeTier([{ typeId: ENHANCED_PROBE_ID, count: 1 }, { typeId: BASIC_PROBE_ID, count: 9 }])).toBe('enhanced');
    expect(probeTier([{ typeId: BASIC_PROBE_ID, count: 9 }, { typeId: ENHANCED_PROBE_ID, count: 1 }])).toBe('enhanced');
  });

  it('handles an empty fleet', () => {
    expect(probeTier([])).toBe('unaided');
  });
});

describe('distance to territory', () => {
  it('measures from the nearest owned star, not the first', () => {
    expect(distanceToTerritory(LINE, [3, 1], 0)).toBe(20);
  });

  it('is zero for a star the player already owns', () => {
    expect(distanceToTerritory(LINE, [2], 2)).toBe(0);
  });

  it('returns null when the player owns nothing', () => {
    expect(distanceToTerritory(LINE, [], 1)).toBeNull();
  });

  it('returns null for an unknown target star', () => {
    expect(distanceToTerritory(LINE, [0], 99)).toBeNull();
  });
});

describe('sensing detail', () => {
  it('caps players without probes at star level, however close they are', () => {
    expect(sensingDetail('unaided', 0)).toBe('star');
    expect(sensingDetail('unaided', 1)).toBe('star');
  });

  it('gives a basic probe full detail nearby and star level further out', () => {
    expect(sensingDetail('basic', SENSING_RANGE.basic - 1)).toBe('full');
    expect(sensingDetail('basic', SENSING_RANGE.basic + 1)).toBe('star');
  });

  it('lets an enhanced probe resolve targets a basic probe cannot', () => {
    const between = (SENSING_RANGE.basic + SENSING_RANGE.enhanced) / 2;
    expect(sensingDetail('basic', between)).toBe('star');
    expect(sensingDetail('enhanced', between)).toBe('full');
  });

  it('includes the boundary itself', () => {
    expect(sensingDetail('basic', SENSING_RANGE.basic)).toBe('full');
  });

  it('never blacks a target out entirely', () => {
    for (const tier of ['unaided', 'basic', 'enhanced'] as const) {
      expect(sensingDetail(tier, 9999)).toBe('star');
      expect(sensingDetail(tier, null)).toBe('star');
    }
  });

  it('extends range with a bonus, for the planned radar building', () => {
    const beyond = SENSING_RANGE.basic + 10;
    expect(sensingDetail('basic', beyond)).toBe('star');
    expect(sensingDetail('basic', beyond, 20)).toBe('full');
    expect(sensingRadius('basic', 20)).toBe(SENSING_RANGE.basic + 20);
  });

  it('ignores a negative bonus rather than shrinking range', () => {
    expect(sensingRadius('basic', -50)).toBe(SENSING_RANGE.basic);
  });
});

describe('resolveSensing', () => {
  it('walks the three tiers for the same target', () => {
    const target = 2; // 28 units from star 0: outside basic range, inside enhanced
    const owned = [0];
    expect(resolveSensing([], LINE, owned, target).detail).toBe('star');
    expect(resolveSensing([{ typeId: BASIC_PROBE_ID, count: 1 }], LINE, owned, target).detail).toBe('star');
    expect(resolveSensing([{ typeId: ENHANCED_PROBE_ID, count: 1 }], LINE, owned, target).detail).toBe('full');
  });

  it('reports the tier and distance it used', () => {
    const r = resolveSensing([{ typeId: BASIC_PROBE_ID, count: 2 }], LINE, [0], 1);
    expect(r).toMatchObject({ tier: 'basic', distance: 20, detail: 'full' });
  });
});

describe('against real galaxy geometry', () => {
  const positions = generateStarPositions('post-1');

  it('produces a usable spread of resolutions across the real galaxy', () => {
    const owned = [positions[0]!.index];
    const counts = { star: 0, full: 0 };
    for (const p of positions) {
      counts[resolveSensing([{ typeId: ENHANCED_PROBE_ID, count: 1 }], positions, owned, p.index).detail]++;
    }
    // An enhanced probe should reveal a meaningful slice of the galaxy from a
    // single owned star, but nowhere near all of it.
    expect(counts.full).toBeGreaterThan(1);
    expect(counts.star).toBeGreaterThan(1);
  });

  it('never resolves more with a basic probe than an enhanced one', () => {
    const owned = [positions[0]!.index];
    for (const p of positions) {
      const basic = resolveSensing([{ typeId: BASIC_PROBE_ID, count: 1 }], positions, owned, p.index).detail;
      const enhanced = resolveSensing([{ typeId: ENHANCED_PROBE_ID, count: 1 }], positions, owned, p.index).detail;
      if (basic === 'full') expect(enhanced).toBe('full');
    }
  });
});
