import { describe, expect, it } from 'vitest';
import {
  getSensorAlertsSince,
  popSensorAlerts,
  pushSensorAlert,
} from '../core/sensor-alerts';
import type { SensorAlert } from '../core/sensor-alerts';
import type { RedisGameStore } from '../core/game-service';

function createFakeStore(): RedisGameStore & { kv: Record<string, string> } {
  const kv: Record<string, string> = {};
  return {
    kv,
    async hSet() { /* unused */ },
    async hGetAll() { return {}; },
    async hGet() { return undefined; },
    async hDel() { /* unused */ },
    async get(key) { return kv[key]; },
    async set(key, value) { kv[key] = value; },
    async del(key) { delete kv[key]; },
    async zRange() { return []; },
  };
}

const alert = (over: Partial<SensorAlert> = {}): SensorAlert => ({
  type: 'raider',
  starIndex: 7,
  from: 'raider_one',
  ts: 1_000_000,
  ...over,
});

describe('sensor alerts', () => {
  it('records an alert in the durable log as well as the pending queue', async () => {
    const store = createFakeStore();
    await pushSensorAlert(store, 'Pilot', alert());

    expect(await popSensorAlerts(store, 'Pilot')).toHaveLength(1);
    expect(await getSensorAlertsSince(store, 'Pilot', 0)).toHaveLength(1);
  });

  it('keeps history after the client drains the queue for audio', async () => {
    const store = createFakeStore();
    await pushSensorAlert(store, 'Pilot', alert());

    // The audio poll clears the pending queue...
    await popSensorAlerts(store, 'Pilot');
    expect(await popSensorAlerts(store, 'Pilot')).toHaveLength(0);

    // ...but the returning-player report still sees the event.
    expect(await getSensorAlertsSince(store, 'Pilot', 0)).toHaveLength(1);
  });

  it('matches producers and consumers that disagree on username casing', async () => {
    const store = createFakeStore();
    // Raids resolve the owner from star claims, which preserve display casing.
    await pushSensorAlert(store, 'StarLord', alert());
    // The client polls with whatever casing it holds.
    expect(await popSensorAlerts(store, 'starlord')).toHaveLength(1);
    expect(await getSensorAlertsSince(store, 'STARLORD', 0)).toHaveLength(1);
  });

  it('returns only alerts inside the away window', async () => {
    const store = createFakeStore();
    await pushSensorAlert(store, 'Pilot', alert({ ts: 500, from: 'before' }));
    await pushSensorAlert(store, 'Pilot', alert({ ts: 1_500, from: 'during' }));
    await pushSensorAlert(store, 'Pilot', alert({ ts: 5_000, from: 'after' }));

    const window = await getSensorAlertsSince(store, 'Pilot', 1_000, 2_000);
    expect(window.map((a) => a.from)).toEqual(['during']);
  });

  it('separates raider and unidentified contacts', async () => {
    const store = createFakeStore();
    await pushSensorAlert(store, 'Pilot', alert({ type: 'raider', from: 'r1' }));
    await pushSensorAlert(store, 'Pilot', alert({ type: 'unidentified', from: 'u1' }));

    const all = await getSensorAlertsSince(store, 'Pilot', 0);
    expect(all.filter((a) => a.type === 'raider')).toHaveLength(1);
    expect(all.filter((a) => a.type === 'unidentified')).toHaveLength(1);
  });

  it('prunes history older than the retention window and caps its size', async () => {
    const store = createFakeStore();
    const day = 24 * 60 * 60 * 1000;
    const now = 100 * day;
    await pushSensorAlert(store, 'Pilot', alert({ ts: now - 30 * day, from: 'ancient' }));
    await pushSensorAlert(store, 'Pilot', alert({ ts: now, from: 'recent' }));

    const all = await getSensorAlertsSince(store, 'Pilot', 0, now + 1);
    expect(all.map((a) => a.from)).toEqual(['recent']);

    for (let i = 0; i < 60; i++) {
      await pushSensorAlert(store, 'Pilot', alert({ ts: now + i, from: `ship${i}` }));
    }
    expect((await getSensorAlertsSince(store, 'Pilot', 0, now + 1000)).length).toBeLessThanOrEqual(50);
  });

  it('returns nothing for a player who has no recorded alerts', async () => {
    const store = createFakeStore();
    expect(await getSensorAlertsSince(store, 'Nobody', 0)).toEqual([]);
  });
});
