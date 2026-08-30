import { describe, expect, it } from 'vitest';
import {
  claimPod,
  consumeItem,
  ensureAirPurifierQuest,
  getClaimedPods,
  getInventory,
  grantItem,
  repairAirPurifierQuest,
  assignFreighterRoute,
  cancelFreighterRoute,
  loadAllFleet,
  createAirPurifierOrder,
  getAirPurifierOrder,
  payAirPurifierOrder,
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
import { isTradingStation } from '../../shared/trading';

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

describe('game service backend routines', () => {
  it('creates one air-purifier event for a player with two owned stars', async () => {
    const store = createFakeStore({ 'stars:post-1': { 's:4': 'pilot', 's:9': 'pilot' } });
    const startedAt = Date.UTC(2026, 7, 26, 8);
    const first = await ensureAirPurifierQuest(store, 'post-1', 'pilot', startedAt);
    const second = await ensureAirPurifierQuest(store, 'post-1', 'pilot', startedAt + 60_000);

    expect(first?.state).toBe('active');
    expect(first?.starIndex).toBe(9);
    expect(second?.eventId).toBe(first?.eventId);
    expect(second?.capacityPercent).toBe(75);
  });

  it('does not create an air-purifier event before the second owned star', async () => {
    const store = createFakeStore({ 'stars:post-1': { 's:4': 'pilot' } });
    expect(await ensureAirPurifierQuest(store, 'post-1', 'pilot', Date.now())).toBeNull();
  });

  it('repairs the affected starbase with one replacement unit', async () => {
    const store = createFakeStore({ 'stars:post-1': { 's:4': 'pilot', 's:9': 'pilot' } });
    const startedAt = Date.UTC(2026, 7, 26, 8);
    const incident = await ensureAirPurifierQuest(store, 'post-1', 'pilot', startedAt);
    if (!incident) throw new Error('Expected incident');

    await grantItem(store, 'pilot', 'air_purifier_unit');
    const repaired = await repairAirPurifierQuest(store, 'post-1', 'pilot', incident.starIndex, startedAt + 1_000);

    expect(repaired.state).toBe('resolved');
    expect(repaired.repairMethod).toBe('found_unit');
    expect(await getInventory(store, 'pilot')).toEqual({});
    await expect(repairAirPurifierQuest(store, 'post-1', 'pilot', incident.starIndex, startedAt + 2_000)).rejects.toThrow('No active');
  });

  it('carries item cargo through a freighter route and returns it on arrival', async () => {
    const now = 2_000_000;
    const store = createFakeStore({
      'profile:pilot': {
        ships: JSON.stringify({ stars: { 's:1': { ships: [{ typeId: 2, count: 1 }], building: null }, 's:2': { ships: [], building: null } } }),
        inventory: JSON.stringify({ air_purifier_unit: 1 }),
      },
    });

    const assigned = await assignFreighterRoute(store, 'pilot', 1, 2, [{ itemId: 'air_purifier_unit', count: 1 }], now);
    expect(await getInventory(store, 'pilot')).toEqual({});
    expect(assigned.route.items).toEqual([{ itemId: 'air_purifier_unit', count: 1 }]);

    const outboundDone = await loadAllFleet(store, 'pilot', assigned.route.arrivalAt);
    const returnRoute = outboundDone.freighterRoutes[0];
    if (!returnRoute) throw new Error('Expected return route');
    expect(returnRoute.leg).toBe('return');
    expect(returnRoute.items).toEqual([{ itemId: 'air_purifier_unit', count: 1 }]);

    await loadAllFleet(store, 'pilot', returnRoute.arrivalAt);
    expect(await getInventory(store, 'pilot')).toEqual({ air_purifier_unit: 1 });
  });

  it('refunds reserved item cargo when a freighter route is cancelled', async () => {
    const store = createFakeStore({
      'profile:pilot': {
        ships: JSON.stringify({ stars: { 's:1': { ships: [{ typeId: 2, count: 1 }], building: null } } }),
        inventory: JSON.stringify({ air_purifier_unit: 1 }),
      },
    });
    const assigned = await assignFreighterRoute(store, 'pilot', 1, 2, [{ itemId: 'air_purifier_unit', count: 1 }], 3_000_000);
    await cancelFreighterRoute(store, 'pilot', assigned.route.id, 3_000_001);
    expect(await getInventory(store, 'pilot')).toEqual({ air_purifier_unit: 1 });
  });

  it('funds the purifier trade order in stages and grants the replacement unit', async () => {
    const now = 4_000_000;
    const store = createFakeStore({
      'stars:post-1': { 's:1': 'pilot', 's:2': 'pilot' },
      'profile:pilot': {
        economy: JSON.stringify({ homeStar: 1, stars: { 's:1': { store: { ore: 2400, food: 1800, energy: 2200, fuel: 600 }, buildings: { warehouse: { level: 2, status: 'ACTIVE', completeAt: null } } } } }),
      },
    });
    let stationStarIndex = 0;
    while (stationStarIndex < 100 && (stationStarIndex === 1 || stationStarIndex === 2 || !isTradingStation('post-1', stationStarIndex))) stationStarIndex++;
    const order = await createAirPurifierOrder(store, 'post-1', 'pilot', stationStarIndex, now);
    expect(order.status).toBe('open');
    const partial = await payAirPurifierOrder(store, 'post-1', 'pilot', 1, { ore: 1200, food: 900, energy: 1100, fuel: 300 }, now + 1);
    expect(partial.status).toBe('open');
    const complete = await payAirPurifierOrder(store, 'post-1', 'pilot', 1, { ore: 1200, food: 900, energy: 1100, fuel: 300 }, now + 2);
    expect(complete.status).toBe('complete');
    expect(await getInventory(store, 'pilot')).toEqual({ air_purifier_unit: 1 });
    expect((await getAirPurifierOrder(store, 'pilot'))?.status).toBe('complete');
  });

  it('persists and consumes quest items without allowing negative inventory', async () => {
    const store = createFakeStore();

    await grantItem(store, 'pilot', 'luminari_artifact', 2);
    expect(await getInventory(store, 'pilot')).toEqual({ luminari_artifact: 2 });

    await consumeItem(store, 'pilot', 'luminari_artifact');
    expect(await getInventory(store, 'pilot')).toEqual({ luminari_artifact: 1 });
    await expect(consumeItem(store, 'pilot', 'air_purifier_unit')).rejects.toThrow('Not enough air_purifier_unit');
  });

  it('rejects invalid inventory quantities', async () => {
    const store = createFakeStore();
    await expect(grantItem(store, 'pilot', 'luminari_artifact', 0)).rejects.toThrow('positive integer');
    await expect(consumeItem(store, 'pilot', 'luminari_artifact', -1)).rejects.toThrow('positive integer');
  });

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
    expect(econ.store).toEqual({ ore: 640, food: 640, energy: 640, fuel: 0 });
    expect(econ.cap).toBe(1600);
    expect(econ.buildings.station.level).toBe(1);
    expect(econ.buildings.mine.status).toBe('READY');
    expect(store.data['profile:pilot']?.economy).toBeUndefined();
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
    expect(econ.store.energy).toBe(1589);
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

    expect(econ.store).toEqual({ ore: 700, food: 710, energy: 720, fuel: 0 });
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
    expect(econ.rates).toEqual({ ore: 148, food: 34, energy: 102, fuel: 12.5 });
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
    expect(response.buildings.mine.completeAt).toBe(220_000);
    expect(response.store).toEqual({ ore: 380, food: 520, energy: 460, fuel: 0 });
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