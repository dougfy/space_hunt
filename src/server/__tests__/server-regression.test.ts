/**
 * Server Regression Tests S-01 through S-08
 *
 * Tests building buy/upgrade/reject/complete, ship buy/upgrade,
 * blueprint instant build, and complete-all-builds.
 *
 * Uses the same fake Redis store pattern as existing game-service.test.ts.
 */

import { describe, expect, it } from 'vitest';
import {
  loadStarEconomy,
  startBuildingUpgrade,
  buyShip,
  upgradeShip,
} from '../core/game-service';
import type { RedisGameStore } from '../core/game-service';

function createFakeStore(seed?: Record<string, Record<string, string>>): RedisGameStore & { data: Record<string, Record<string, string>>; kv: Record<string, string> } {
  const data: Record<string, Record<string, string>> = seed ? structuredClone(seed) : {};
  const kv: Record<string, string> = {};

  return {
    data,
    kv,
    async hSet(key, values) {
      data[key] = { ...(data[key] ?? {}), ...values };
    },
    async hGetAll(key) {
      return { ...(data[key] ?? {}) };
    },
    async hGet(key, field) {
      return data[key]?.[field];
    },
    async hDel(key, fields) {
      const bucket = data[key];
      if (!bucket) return;
      for (const field of fields) {
        delete bucket[field];
      }
    },
    async get(key) {
      return kv[key];
    },
    async set(key, value) {
      kv[key] = value;
    },
    async del(key) {
      delete kv[key];
    },
    async zRange() {
      return [];
    },
  };
}

/** Create a store with a player at a specific game state */
function createPlayerStore(buildings: Record<string, { level: number; status: string; completeAt: number | null }>, resources = { ore: 1000, food: 1000, energy: 1000 }) {
  return createFakeStore({
    'profile:testuser': {
      economy: JSON.stringify({
        homeStar: 1,
        stars: {
          's:1': {
            store: { ...resources, fuel: 0 },
            rates: { ore: 10, food: 10, energy: 10, fuel: 0 },
            cap: 2000,
            buildings: {
              station: buildings.station ?? { level: 1, status: 'ACTIVE', completeAt: null },
              mine: buildings.mine ?? { level: 0, status: 'READY', completeAt: null },
              solar: buildings.solar ?? { level: 0, status: 'READY', completeAt: null },
              hab: buildings.hab ?? { level: 0, status: 'READY', completeAt: null },
              warehouse: buildings.warehouse ?? { level: 0, status: 'LOCKED', completeAt: null },
              dock: buildings.dock ?? { level: 0, status: 'LOCKED', completeAt: null },
              shield: buildings.shield ?? { level: 0, status: 'LOCKED', completeAt: null },
              cannon: buildings.cannon ?? { level: 0, status: 'LOCKED', completeAt: null },
              refinery: buildings.refinery ?? { level: 0, status: 'LOCKED', completeAt: null },
            },
            lastTickMs: 100_000,
          },
        },
      }),
    },
  });
}

describe('S-01: Build station L1→L2', () => {
  it('succeeds with sufficient resources', async () => {
    const store = createPlayerStore({
      station: { level: 1, status: 'ACTIVE', completeAt: null },
    });
    const now = 200_000;

    const result = await startBuildingUpgrade(store, {
      username: 'testuser',
      starIndex: 1,
      buildType: 'station',
    }, now);

    expect(result.buildings.station.status).toBe('UPGRADING');
    expect(result.buildings.station.completeAt).toBeGreaterThan(now);
    // Resources should be deducted (station L2 costs 420/420/420)
    expect(result.store.ore).toBeLessThan(1000);
  });
});

describe('S-02: Build rejected — insufficient resources', () => {
  it('throws when player cannot afford', async () => {
    const store = createPlayerStore(
      { station: { level: 1, status: 'ACTIVE', completeAt: null } },
      { ore: 100, food: 100, energy: 100 }, // too low
    );

    await expect(
      startBuildingUpgrade(store, { username: 'testuser', starIndex: 1, buildType: 'station' }, 200_000)
    ).rejects.toThrow(/[Ii]nsufficient/);
  });
});

describe('S-03: Build rejected — already upgrading', () => {
  it('throws when another building is already upgrading', async () => {
    const store = createPlayerStore({
      station: { level: 1, status: 'ACTIVE', completeAt: null },
      mine: { level: 0, status: 'UPGRADING', completeAt: 300_000 }, // already building
    });

    await expect(
      startBuildingUpgrade(store, { username: 'testuser', starIndex: 1, buildType: 'station' }, 200_000)
    ).rejects.toThrow(/already/i);
  });
});

describe('S-04: Build completes via reconciliation', () => {
  it('shows ACTIVE and incremented level after completeAt passes', async () => {
    const completeAt = 150_000;
    const store = createPlayerStore({
      station: { level: 1, status: 'UPGRADING', completeAt },
    });

    // Load economy AFTER completeAt — should reconcile
    const econ = await loadStarEconomy(store, 'testuser', 1, 200_000);

    expect(econ.buildings.station.status).toBe('ACTIVE');
    expect(econ.buildings.station.level).toBe(2);
    expect(econ.buildings.station.completeAt).toBeNull();
  });
});

describe('S-05: Ship buy', () => {
  it('starts building a ship with sufficient dock level', async () => {
    const store = createPlayerStore({
      station: { level: 3, status: 'ACTIVE', completeAt: null },
      dock: { level: 2, status: 'ACTIVE', completeAt: null },
    });
    const now = 200_000;

    const result = await buyShip(store, {
      username: 'testuser',
      starIndex: 1,
      shipTypeId: 3, // Destroyer (dock tier 1, dock level 2)
      quantity: 1,
    }, now);

    expect(result.building).not.toBeNull();
    expect(result.building!.typeId).toBe(3);
    expect(result.building!.completeAt).toBeGreaterThan(now);
  });
});

describe('S-06: Ship upgrade', () => {
  it('upgrades scout to destroyer, consuming the scout', async () => {
    const store = createPlayerStore({
      station: { level: 3, status: 'ACTIVE', completeAt: null },
      dock: { level: 2, status: 'ACTIVE', completeAt: null },
    });
    // Give the player a scout first
    const shipsData = { stars: { 's:1': { ships: [{ typeId: 1, count: 1 }], building: null } } };
    await store.hSet('profile:testuser', { ships: JSON.stringify(shipsData) });
    const now = 200_000;

    const result = await upgradeShip(store, {
      username: 'testuser',
      starIndex: 1,
      fromTypeId: 1, // Scout → Destroyer
    }, now);

    expect(result.building).not.toBeNull();
    expect(result.building!.typeId).toBe(3); // Destroyer
    // Scout should be consumed
    const scout = result.ships.find(s => s.typeId === 1);
    expect(scout?.count ?? 0).toBe(0);
  });
});

describe('S-07: Blueprint instant build', () => {
  it('sets completeAt to now and decrements charge', async () => {
    const store = createPlayerStore({
      station: { level: 3, status: 'ACTIVE', completeAt: null },
      dock: { level: 2, status: 'ACTIVE', completeAt: null },
    });
    // Give 3 blueprint charges
    store.kv['complete_charges:testuser'] = '3';
    const now = 200_000;

    const result = await buyShip(store, {
      username: 'testuser',
      starIndex: 1,
      shipTypeId: 3,
      quantity: 1,
      useBlueprint: true,
    }, now);

    // Should complete instantly
    expect(result.building?.completeAt).toBe(now);
    // Charge decremented
    expect(store.kv['complete_charges:testuser']).toBe('2');
  });
});

describe('S-08: Complete all builds instantly', () => {
  it('completes an upgrading building immediately', async () => {
    const store = createPlayerStore({
      station: { level: 1, status: 'UPGRADING', completeAt: 999_999_999 }, // far future
    });
    store.kv['complete_charges:testuser'] = '2';

    // Simulate what the complete-builds endpoint does:
    // Load economy, set all UPGRADING completeAt to now, save
    const econ = await loadStarEconomy(store, 'testuser', 1, 200_000);

    // Building should still be UPGRADING (hasn't hit completeAt yet)
    expect(econ.buildings.station.status).toBe('UPGRADING');

    // Now load again but past the completeAt — simulates instant complete
    // (the actual endpoint sets completeAt = now then re-loads)
    const rawEcon = JSON.parse(store.data['profile:testuser']!.economy!);
    rawEcon.stars['s:1'].buildings.station.completeAt = 200_000; // set to now
    store.data['profile:testuser']!.economy = JSON.stringify(rawEcon);

    const after = await loadStarEconomy(store, 'testuser', 1, 200_001);
    expect(after.buildings.station.status).toBe('ACTIVE');
    expect(after.buildings.station.level).toBe(2);
  });
});
