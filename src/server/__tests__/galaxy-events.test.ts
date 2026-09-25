import { describe, expect, it } from 'vitest';
import {
  EVENTS_KEY,
  MAX_EVENTS,
  RETENTION_MS,
  pruneGalaxyEvents,
  readGalaxyEvents,
  readGalaxyEventsNear,
  recordGalaxyEvent,
  redactGalaxyEvent,
} from '../core/galaxy-events';
import type { GalaxyEventStore } from '../core/galaxy-events';

/** In-memory sorted set, ordered by score like Redis. */
function createFakeStore(): GalaxyEventStore & { rows: Record<string, Array<{ member: string; score: number }>> } {
  const rows: Record<string, Array<{ member: string; score: number }>> = {};
  const sorted = (key: string) => (rows[key] ??= []).sort((a, b) => a.score - b.score);
  return {
    rows,
    async zAdd(key, ...members) {
      const bucket = rows[key] ??= [];
      bucket.push(...members);
      sorted(key);
      return members.length;
    },
    async zRange(key, min, max) {
      return sorted(key).filter((r) => r.score >= Number(min) && r.score <= Number(max));
    },
    async zRemRangeByScore(key, min, max) {
      const bucket = sorted(key);
      const before = bucket.length;
      rows[key] = bucket.filter((r) => r.score < min || r.score > max);
      return before - rows[key].length;
    },
    async zRemRangeByRank(key, start, stop) {
      const bucket = sorted(key);
      const removed = bucket.slice(start, stop + 1);
      rows[key] = bucket.filter((r) => !removed.includes(r));
      return removed.length;
    },
    async zCard(key) {
      return (rows[key] ??= []).length;
    },
  };
}

const POST = 'post-1';

describe('galaxy event log', () => {
  it('records an event other players can read back', async () => {
    const store = createFakeStore();
    await recordGalaxyEvent(store, POST, { type: 'colonize', starIndex: 12, user: 'pilot', detail: 'Alnilam', ts: 500 });

    const events = await readGalaxyEvents(store, POST, 0, 1_000);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'colonize', starIndex: 12, user: 'pilot', detail: 'Alnilam' });
  });

  it('is global — one player reads another player s events', async () => {
    const store = createFakeStore();
    await recordGalaxyEvent(store, POST, { type: 'raid', starIndex: 3, user: 'raider', ts: 10 });
    // No username filter: the log is shared, so everyone races for the same lead.
    expect(await readGalaxyEvents(store, POST, 0, 100)).toHaveLength(1);
  });

  it('keeps posts isolated from each other', async () => {
    const store = createFakeStore();
    await recordGalaxyEvent(store, POST, { type: 'build', starIndex: 1, user: 'a', ts: 10 });
    expect(await readGalaxyEvents(store, 'other-post', 0, 100)).toEqual([]);
  });

  it('returns only events inside the requested window', async () => {
    const store = createFakeStore();
    await recordGalaxyEvent(store, POST, { type: 'build', starIndex: 1, user: 'a', ts: 100 });
    await recordGalaxyEvent(store, POST, { type: 'build', starIndex: 2, user: 'b', ts: 500 });
    await recordGalaxyEvent(store, POST, { type: 'build', starIndex: 3, user: 'c', ts: 900 });

    const window = await readGalaxyEvents(store, POST, 200, 600);
    expect(window.map((e) => e.starIndex)).toEqual([2]);
  });

  it('drops entries older than the retention window', async () => {
    const store = createFakeStore();
    const now = 10 * RETENTION_MS;
    await recordGalaxyEvent(store, POST, { type: 'build', starIndex: 1, user: 'old', ts: now - RETENTION_MS - 1 });
    await recordGalaxyEvent(store, POST, { type: 'build', starIndex: 2, user: 'new', ts: now });

    await pruneGalaxyEvents(store, POST, now);

    const all = await readGalaxyEvents(store, POST, 0, now + 1);
    expect(all.map((e) => e.user)).toEqual(['new']);
  });

  it('caps total size, discarding the oldest first', async () => {
    const store = createFakeStore();
    const base = 1_000_000;
    for (let i = 0; i < MAX_EVENTS + 25; i++) {
      await recordGalaxyEvent(store, POST, { type: 'build', starIndex: i, user: `u${i}`, ts: base + i });
    }
    await pruneGalaxyEvents(store, POST, base + MAX_EVENTS + 25);

    const all = await readGalaxyEvents(store, POST, 0, base + MAX_EVENTS + 100);
    expect(all.length).toBeLessThanOrEqual(MAX_EVENTS);
    // Oldest went first, so the newest entry must have survived.
    expect(all.at(-1)?.user).toBe(`u${MAX_EVENTS + 24}`);
    expect(all.some((e) => e.user === 'u0')).toBe(false);
  });

  it('filters by range for distance-limited sensing', async () => {
    const store = createFakeStore();
    const positions = [
      { index: 0, x: 0, y: 0, bodyCount: 4 },
      { index: 1, x: 3, y: 4, bodyCount: 4 },   // distance 5 from origin
      { index: 2, x: 30, y: 40, bodyCount: 4 }, // distance 50 from origin
    ];
    await recordGalaxyEvent(store, POST, { type: 'raid', starIndex: 1, user: 'near', ts: 10 });
    await recordGalaxyEvent(store, POST, { type: 'raid', starIndex: 2, user: 'far', ts: 20 });

    const inRange = await readGalaxyEventsNear(store, POST, positions, 0, 10, 0, 100);
    expect(inRange.map((e) => e.user)).toEqual(['near']);

    const wide = await readGalaxyEventsNear(store, POST, positions, 0, 100, 0, 100);
    expect(wide.map((e) => e.user)).toEqual(['near', 'far']);
  });

  it('withholds body and nature below full sensing, but never the star', () => {
    const event = { type: 'anomaly' as const, starIndex: 12, bodyIndex: 3, user: 'pilot', ts: 1, detail: 'artifact' };

    const full = redactGalaxyEvent(event, 'full');
    expect(full).toMatchObject({ starIndex: 12, bodyIndex: 3, detail: 'artifact' });

    const coarse = redactGalaxyEvent(event, 'star');
    expect(coarse.starIndex).toBe(12);      // still enough to go looking
    expect(coarse.bodyIndex).toBeUndefined();
    expect(coarse.detail).toBeUndefined();
    expect(coarse.type).toBe('anomaly');
  });

  it('does not mutate the stored event when redacting', () => {
    const event = { type: 'anomaly' as const, starIndex: 1, bodyIndex: 2, user: 'p', ts: 1, detail: 'artifact' };
    redactGalaxyEvent(event, 'star');
    expect(event.bodyIndex).toBe(2);
    expect(event.detail).toBe('artifact');
  });

  it('skips malformed rows instead of throwing', async () => {
    const store = createFakeStore();
    await store.zAdd(EVENTS_KEY(POST), { member: 'not json', score: 5 });
    await store.zAdd(EVENTS_KEY(POST), { member: JSON.stringify({ type: 'build' }), score: 6 });
    await recordGalaxyEvent(store, POST, { type: 'build', starIndex: 1, user: 'ok', ts: 7 });

    const all = await readGalaxyEvents(store, POST, 0, 100);
    expect(all.map((e) => e.user)).toEqual(['ok']);
  });

  it('never throws out of a gameplay path when the store fails', async () => {
    const broken: GalaxyEventStore = {
      async zAdd() { throw new Error('redis down'); },
      async zRange() { throw new Error('redis down'); },
      async zRemRangeByScore() { throw new Error('redis down'); },
      async zRemRangeByRank() { throw new Error('redis down'); },
      async zCard() { throw new Error('redis down'); },
    };
    await expect(recordGalaxyEvent(broken, POST, { type: 'build', starIndex: 1, user: 'a' })).resolves.toBeUndefined();
    await expect(readGalaxyEvents(broken, POST, 0)).resolves.toEqual([]);
  });
});
