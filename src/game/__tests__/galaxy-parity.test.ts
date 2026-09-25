/**
 * Client/server galaxy parity.
 *
 * The server derives star positions from `generateStarPositions`, while the
 * client generates the galaxy it actually renders with `generateGalaxy`. Both
 * walk the same seeded RNG, so any difference in the number or order of draws
 * silently desynchronizes them — which is exactly what happened: the shared
 * generator omitted the per-star bodyCount draw, and every star except index 0
 * ended up in a different place on the server than the player saw.
 *
 * These tests compare the two implementations directly so the drift cannot
 * return unnoticed.
 */
import { describe, expect, it } from 'vitest';
import { generateStarPositions } from '../../shared/galaxy-positions';
import { generateGalaxy } from '../galaxy';

const SEEDS = ['post-1', 'post-2', 't3_abc123', ''];

describe('galaxy generation parity', () => {
  it.each(SEEDS)('produces identical star positions for seed %j', (seed) => {
    const client = generateGalaxy(seed);
    const server = generateStarPositions(seed);

    expect(server).toHaveLength(client.length);
    for (let i = 0; i < client.length; i++) {
      expect(server[i]!.index).toBe(client[i]!.index);
      expect(server[i]!.x).toBeCloseTo(client[i]!.pos.x, 10);
      expect(server[i]!.y).toBeCloseTo(client[i]!.pos.y, 10);
    }
  });

  it.each(SEEDS)('produces identical body counts for seed %j', (seed) => {
    const client = generateGalaxy(seed);
    const server = generateStarPositions(seed);
    for (let i = 0; i < client.length; i++) {
      expect(server[i]!.bodyCount).toBe(client[i]!.bodyCount);
    }
  });

  it('would catch a desynchronized RNG stream, not just a shifted one', () => {
    // Guards the assertion itself: if positions were compared loosely, a galaxy
    // offset by one star would still pass. Star 1 must differ from star 0.
    const server = generateStarPositions('post-1');
    expect(server[1]!.x).not.toBeCloseTo(server[0]!.x, 6);
  });

  it('keeps body counts inside the generator range', () => {
    for (const star of generateStarPositions('post-1')) {
      expect(star.bodyCount).toBeGreaterThanOrEqual(3);
      expect(star.bodyCount).toBeLessThanOrEqual(8);
    }
  });
});
