import { describe, expect, it } from 'vitest';
import { getFleetShapeFromAllFleets, shouldApplyFleetShape } from '../ships';

describe('fleet-wide ship shape', () => {
  it('reflects a destroyer that flew away from the home star', () => {
    const homeFleet = [{ typeId: 12, count: 3 }]; // enhanced probes left at home
    const awayFleet = [{ typeId: 3, count: 1 }];  // destroyer parked at another star

    expect(getFleetShapeFromAllFleets([homeFleet, awayFleet])).toBe('destroyer');
  });

  it('picks the highest upgrade-path ship across all fleets', () => {
    const fleets = [
      [{ typeId: 1, count: 2 }],
      [{ typeId: 3, count: 1 }],
      [{ typeId: 5, count: 1 }], // battleship wins
      [{ typeId: 4, count: 4 }],
    ];

    expect(getFleetShapeFromAllFleets(fleets)).toBe('battleship');
  });

  it('falls back to scout when only non-combat ships remain', () => {
    expect(getFleetShapeFromAllFleets([[{ typeId: 12, count: 3 }], [{ typeId: 11, count: 1 }]])).toBe('scout');
  });
});

describe('fleet ship shape updates', () => {
  it('accepts the first home-fleet payload even when the initial shape is scout', () => {
    const bootstrap = shouldApplyFleetShape(-1, 1, 'scout', 'scout');
    expect(bootstrap.accepted).toBe(true);
    expect(bootstrap.shape).toBe('scout');
  });

  it('accepts a newer same-shape update so the latest battleship state is not stuck at version 1', () => {
    const current = shouldApplyFleetShape(1, 7, 'battleship', 'battleship');
    expect(current.accepted).toBe(true);
    expect(current.shape).toBe('battleship');
  });

  it('ignores stale home-fleet shape updates after a newer shape has been accepted', () => {
    const current = { version: 2, shape: 'frigate' as const };

    const stale = shouldApplyFleetShape(current.version, 1, current.shape, 'scout');
    expect(stale.accepted).toBe(false);
    expect(stale.shape).toBe(current.shape);

    const fresh = shouldApplyFleetShape(current.version, 3, current.shape, 'destroyer');
    expect(fresh.accepted).toBe(true);
    expect(fresh.shape).toBe('destroyer');
  });

  it('ignores same-version conflicting shape updates so a stale scout payload cannot overwrite a battleship', () => {
    const current = { version: 7, shape: 'battleship' as const };

    const conflict = shouldApplyFleetShape(current.version, 7, current.shape, 'scout');
    expect(conflict.accepted).toBe(false);
    expect(conflict.shape).toBe(current.shape);
  });
});
