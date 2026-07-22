import { describe, expect, it } from 'vitest';
import {
  claimPod,
  getClaimedPods,
  listActiveShots,
  listRoomPoses,
  loadStarEconomy,
  loadProfile,
  saveProfile,
  startBuildingUpgrade,
  storePose,
  storeShots,
} from '../core/game-service';
import type { RedisGameStore } from '../core/game-service';

function createFakeStore(seed?: Record<string, Record<string, string>>): RedisGameStore & { data: Record<string, Record<string, string>> } {
  const data: Record<string, Record<string, string>> = seed ? structuredClone(seed) : {};

  return {
    data,
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
  };
}

describe('game service backend routines', () => {
  it('stores and filters room poses by location while removing stale entries', async () => {
    const store = createFakeStore();
    const now = 1_000_000;

    await storePose(store, 'post-1', {
      x: 1,
      y: 2,
      angle: 0.5,
      username: 'alpha',
      sessionId: 'alpha:1',
      shape: 'destroyer',
      tier: 2,
      starIndex: 3,
      bodyIndex: 4,
    }, now);

    await storePose(store, 'post-1', {
      x: 5,
      y: 6,
      angle: 0.75,
      username: 'beta',
      sessionId: 'beta:1',
      shape: 'frigate',
      tier: 1,
      starIndex: 3,
      bodyIndex: -1,
    }, now);

    const poseBucket = store.data['poses:post-1'];
    if (!poseBucket) throw new Error('Expected pose bucket');
    poseBucket['stale:1'] = JSON.stringify({
      x: 9,
      y: 9,
      angle: 1,
      username: 'stale',
      shape: 'battleship',
      tier: 2,
      starIndex: 3,
      bodyIndex: 4,
      ts: now - 9_000,
    });

    const response = await listRoomPoses(store, {
      postId: 'post-1',
      tier: 2,
      starIndex: 3,
      bodyIndex: 4,
    }, now);

    expect(response.items).toEqual([
      { username: 'alpha', x: 1, y: 2, angle: 0.5, shape: 'destroyer' },
    ]);
    expect(poseBucket['stale:1']).toBeUndefined();
  });

  it('awards the first pod claimer and records claimed pod ids', async () => {
    const store = createFakeStore();

    const first = await claimPod(store, 'post-2', { podId: 7, username: 'alpha' });
    const second = await claimPod(store, 'post-2', { podId: 7, username: 'beta' });
    const claimed = await getClaimedPods(store, 'post-2');

    expect(first).toEqual({ success: true, podId: 7, mine: true });
    expect(second).toEqual({ success: true, podId: 7, mine: false });
    expect(claimed).toEqual({ podIds: [7] });
  });

  it('returns only active remote shots and removes expired batches', async () => {
    const store = createFakeStore();
    const now = 2_000_000;

    await storeShots(store, 'post-3', {
      sessionId: 'alpha:1',
      shots: [{ id: 's1', origin: { x: 0, y: 0 }, angle: 0, speed: 10, spawnTime: 10 }],
    }, now);

    const shotsBucket = store.data['shots:post-3'];
    if (!shotsBucket) throw new Error('Expected shots bucket');
    shotsBucket['stale:1'] = JSON.stringify({
      shots: [{ id: 's2', origin: { x: 1, y: 1 }, angle: 1, speed: 5, spawnTime: 5 }],
      ts: now - 4_000,
    });

    const response = await listActiveShots(store, { postId: 'post-3', exclude: 'self:1' }, now);

    expect(response.shots).toEqual([
      { id: 's1', shooterId: 'alpha:1', origin: { x: 0, y: 0 }, angle: 0, speed: 10, spawnTime: now / 1000 },
    ]);
    expect(shotsBucket['stale:1']).toBeUndefined();
  });

  it('loads normalized profiles and saves only provided fields', async () => {
    const store = createFakeStore({
      'profile:pilot': { name: 'Pilot', shape: 'bogus' },
    });

    const profile = await loadProfile(store, 'pilot');
    await saveProfile(store, { username: 'pilot', name: 'Ace' });

    expect(profile).toEqual({ name: 'Pilot' });
    expect(store.data['profile:pilot']).toEqual({ name: 'Ace', shape: 'bogus' });
  });

  it('initializes and persists star economy when missing', async () => {
    const store = createFakeStore();
    const now = 1_500_000;

    const econ = await loadStarEconomy(store, 'pilot', 2, now);

    expect(econ.starIndex).toBe(2);
    expect(econ.store).toEqual({ ore: 640, food: 640, energy: 640 });
    expect(econ.cap).toBe(1600);
    expect(econ.buildings.station.level).toBe(1);
    expect(econ.buildings.mine.status).toBe('READY');
    expect(store.data['profile:pilot']?.economy).toBeDefined();
  });

  it('applies elapsed-time production and clamps to cap', async () => {
    const store = createFakeStore({
      'profile:pilot': {
        economy: JSON.stringify({
          stars: {
            's:1': {
              store: { ore: 1590, food: 1595, energy: 1500 },
              rates: { ore: 120, food: 90, energy: 300 },
              cap: 1600,
              buildings: {
                station: { level: 2, status: 'ACTIVE', completeAt: null },
                mine: { level: 0, status: 'READY', completeAt: null },
                solar: { level: 2, status: 'ACTIVE', completeAt: null },
                hab: { level: 0, status: 'READY', completeAt: null },
                warehouse: { level: 0, status: 'LOCKED', completeAt: null },
              },
              lastTickMs: 10_000,
            },
          },
        }),
      },
    });

    const econ = await loadStarEconomy(store, 'pilot', 1, 70_000);

    expect(econ.store.ore).toBe(1600);
    expect(econ.store.food).toBe(1600);
    expect(econ.store.energy).toBe(1600);
    expect(econ.lastTickMs).toBe(70_000);
  });

  it('does not tick backward in time', async () => {
    const store = createFakeStore({
      'profile:pilot': {
        economy: JSON.stringify({
          stars: {
            's:4': {
              store: { ore: 700, food: 710, energy: 720 },
              rates: { ore: 10, food: 20, energy: 30 },
              cap: 1600,
              lastTickMs: 50_000,
            },
          },
        }),
      },
    });

    const econ = await loadStarEconomy(store, 'pilot', 4, 40_000);

    expect(econ.store).toEqual({ ore: 700, food: 710, energy: 720 });
    expect(econ.lastTickMs).toBe(50_000);
  });

  it('reconciles completed building upgrades and derived cap/rates on load', async () => {
    const store = createFakeStore({
      'profile:pilot': {
        economy: JSON.stringify({
          stars: {
            's:5': {
              store: { ore: 800, food: 800, energy: 800 },
              rates: { ore: 0, food: 0, energy: 0 },
              cap: 1600,
              buildings: {
                station: { level: 2, status: 'ACTIVE', completeAt: null },
                mine: { level: 1, status: 'UPGRADING', completeAt: 60_000 },
                solar: { level: 0, status: 'READY', completeAt: null },
                hab: { level: 0, status: 'READY', completeAt: null },
                warehouse: { level: 0, status: 'UPGRADING', completeAt: 60_000 },
              },
              lastTickMs: 60_000,
            },
          },
        }),
      },
    });

    const econ = await loadStarEconomy(store, 'pilot', 5, 61_000);

    expect(econ.buildings.mine.level).toBe(2);
    expect(econ.buildings.mine.status).toBe('ACTIVE');
    expect(econ.buildings.warehouse.level).toBe(1);
    expect(econ.cap).toBe(2000);
    expect(econ.rates).toEqual({ ore: 147, food: 84, energy: 84 });
  });

  it('starts a building upgrade by deducting resources and setting completion state', async () => {
    const store = createFakeStore();

    const response = await startBuildingUpgrade(store, {
      username: 'pilot',
      starIndex: 0,
      buildType: 'mine',
    }, 100_000);

    expect(response.ok).toBe(true);
    expect(response.buildings.mine.status).toBe('UPGRADING');
    expect(response.buildings.mine.completeAt).toBe(400_000);
    expect(response.store).toEqual({ ore: 380, food: 520, energy: 460 });
  });

  it('rejects locked or unaffordable building upgrades', async () => {
    const store = createFakeStore({
      'profile:pilot': {
        economy: JSON.stringify({
          stars: {
            's:0': {
              store: { ore: 100, food: 100, energy: 100 },
              rates: { ore: 84, food: 84, energy: 84 },
              cap: 1600,
              buildings: {
                station: { level: 1, status: 'ACTIVE', completeAt: null },
                mine: { level: 0, status: 'READY', completeAt: null },
                solar: { level: 0, status: 'READY', completeAt: null },
                hab: { level: 0, status: 'READY', completeAt: null },
                warehouse: { level: 0, status: 'LOCKED', completeAt: null },
              },
              lastTickMs: 100_000,
            },
          },
        }),
      },
    });

    await expect(startBuildingUpgrade(store, {
      username: 'pilot',
      starIndex: 0,
      buildType: 'warehouse',
    }, 100_000)).rejects.toThrow('warehouse is locked');

    await expect(startBuildingUpgrade(store, {
      username: 'pilot',
      starIndex: 0,
      buildType: 'mine',
    }, 100_000)).rejects.toThrow('Insufficient resources');
  });

  it('rejects upgrades while another building is already upgrading', async () => {
    const store = createFakeStore({
      'profile:pilot': {
        economy: JSON.stringify({
          stars: {
            's:0': {
              store: { ore: 1000, food: 1000, energy: 1000 },
              rates: { ore: 84, food: 84, energy: 84 },
              cap: 1600,
              buildings: {
                station: { level: 1, status: 'ACTIVE', completeAt: null },
                mine: { level: 0, status: 'UPGRADING', completeAt: 200_000 },
                solar: { level: 0, status: 'READY', completeAt: null },
                hab: { level: 0, status: 'READY', completeAt: null },
                warehouse: { level: 0, status: 'LOCKED', completeAt: null },
              },
              lastTickMs: 100_000,
            },
          },
        }),
      },
    });

    await expect(startBuildingUpgrade(store, {
      username: 'pilot',
      starIndex: 0,
      buildType: 'solar',
    }, 100_000)).rejects.toThrow('Another building is already upgrading');
  });
});