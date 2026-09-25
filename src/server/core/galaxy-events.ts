/**
 * Galaxy Event Log — the shared, global record of what is happening in the galaxy.
 *
 * One log per post, readable by every player. Daily probe reports draw from it,
 * and the planned radar building will too. Because a radar senses out to a
 * distance, every event carries the `starIndex` it happened at, so reads can be
 * filtered by range against the shared star positions.
 *
 * This is deliberately separate from `audit:${postId}`. That log is an
 * operational record — it carries debug entries and logins, and its shape varies
 * per event. This one is player-facing: uniform, spatially located, and bounded.
 *
 * Bounded two ways so it cannot grow without limit: entries older than
 * RETENTION_MS are dropped, and the log is capped at MAX_EVENTS with the oldest
 * discarded first. Pruning is sampled rather than run on every write, since the
 * log is append-heavy and a few entries over the cap is harmless.
 */

import type { SensingDetail } from '../../shared/sensing';

/** Gameplay events worth surfacing to other players. */
export type GalaxyEventType =
  | 'colonize'    // a star was claimed
  | 'build'       // a building was started/upgraded
  | 'ship_buy'    // a ship was purchased
  | 'raid'        // a raid was launched at a star
  | 'explore'     // a planet was scanned
  | 'anomaly';    // an anomaly/artifact was uncovered

export interface GalaxyEvent {
  type: GalaxyEventType;
  /** Where it happened. Required — range queries depend on it. */
  starIndex: number;
  /** Which body, when the event has one. Withheld below 'full' sensing. */
  bodyIndex?: number;
  /** Actor's username, as supplied by the caller. */
  user: string;
  ts: number;
  /** Short human-readable qualifier, e.g. a building label or discovery kind. */
  detail?: string;
}

/** Minimal Redis surface this module needs; keeps it testable with a fake. */
export type GalaxyEventStore = {
  zAdd(key: string, ...members: Array<{ member: string; score: number }>): Promise<number>;
  zRange(
    key: string,
    min: number | string,
    max: number | string,
    options?: { by: 'score' },
  ): Promise<Array<{ member: string; score: number }>>;
  zRemRangeByScore(key: string, min: number, max: number): Promise<number>;
  zRemRangeByRank(key: string, start: number, stop: number): Promise<number>;
  zCard(key: string): Promise<number>;
};

export const EVENTS_KEY = (postId: string) => `galaxy_events:${postId}`;
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_EVENTS = 2000;
/** Prune on roughly 1 in N writes. */
const PRUNE_SAMPLE = 20;

function parseEvent(member: string): GalaxyEvent | null {
  try {
    const parsed = JSON.parse(member) as Partial<GalaxyEvent>;
    if (typeof parsed.starIndex !== 'number' || typeof parsed.ts !== 'number' || !parsed.type) {
      return null;
    }
    return parsed as GalaxyEvent;
  } catch {
    return null;
  }
}

/**
 * Drop aged-out entries, then trim back to MAX_EVENTS oldest-first.
 * Exported so a scheduled job can force a sweep independently of writes.
 */
export async function pruneGalaxyEvents(
  store: GalaxyEventStore,
  postId: string,
  now: number = Date.now(),
): Promise<void> {
  const key = EVENTS_KEY(postId);
  await store.zRemRangeByScore(key, 0, now - RETENTION_MS);
  const size = await store.zCard(key);
  if (size > MAX_EVENTS) {
    // zRemRangeByRank is ascending by score, so rank 0 is the oldest entry.
    await store.zRemRangeByRank(key, 0, size - MAX_EVENTS - 1);
  }
}

/**
 * Append an event to the shared log. Fire-and-forget: a logging failure must
 * never fail the gameplay action that produced it.
 */
export async function recordGalaxyEvent(
  store: GalaxyEventStore,
  postId: string,
  event: Omit<GalaxyEvent, 'ts'> & { ts?: number },
): Promise<void> {
  const ts = event.ts ?? Date.now();
  const entry: GalaxyEvent = { ...event, ts };
  try {
    await store.zAdd(EVENTS_KEY(postId), { member: JSON.stringify(entry), score: ts });
    if (Math.random() < 1 / PRUNE_SAMPLE) {
      await pruneGalaxyEvents(store, postId, ts);
    }
  } catch { /* logging must not break gameplay */ }
}

/** Events recorded in [since, until]. */
export async function readGalaxyEvents(
  store: GalaxyEventStore,
  postId: string,
  since: number,
  until: number = Date.now(),
): Promise<GalaxyEvent[]> {
  try {
    const rows = await store.zRange(EVENTS_KEY(postId), since, until, { by: 'score' });
    return rows
      .map((row) => parseEvent(row.member))
      .filter((e): e is GalaxyEvent => e !== null);
  } catch {
    return [];
  }
}

/**
 * Redact an event down to what a player can actually resolve.
 *
 * At 'full' the body and the nature of the find are named. At 'star' only the
 * system is — enough to know a target exists and to go looking, which is the
 * point: the lead stays global and contestable, and probes buy precision
 * rather than exclusivity.
 */
export function redactGalaxyEvent(event: GalaxyEvent, detail: SensingDetail): GalaxyEvent {
  if (detail === 'full') return { ...event };
  const { bodyIndex: _bodyIndex, detail: _detail, ...rest } = event;
  return rest;
}

/**
 * Events within `radius` of a star, for range-limited sensing (the radar
 * building). `positions` comes from generateStarPositions(postId), so callers
 * decide the galaxy seed rather than this module reaching for it.
 */
export async function readGalaxyEventsNear(
  store: GalaxyEventStore,
  postId: string,
  positions: Array<{ index: number; x: number; y: number }>,
  originStarIndex: number,
  radius: number,
  since: number,
  until: number = Date.now(),
): Promise<GalaxyEvent[]> {
  const byIndex = new Map(positions.map((p) => [p.index, p]));
  const origin = byIndex.get(originStarIndex);
  if (!origin) return [];
  const events = await readGalaxyEvents(store, postId, since, until);
  return events.filter((e) => {
    const at = byIndex.get(e.starIndex);
    if (!at) return false;
    return Math.hypot(at.x - origin.x, at.y - origin.y) <= radius;
  });
}
