/**
 * Sensor Alerts — fire-and-forget audio triggers for ship presence detection.
 * Stored per-user in Redis as a JSON array. Client polls + clears.
 */

import type { RedisGameStore } from './game-service';

export type SensorAlertType = 'raider' | 'unidentified';

export interface SensorAlert {
  type: SensorAlertType;
  starIndex: number;
  from: string;   // callsign of arriving ship/bot
  ts: number;
}

// Usernames are normalized here because producers and consumers disagree on
// casing: raids resolve the owner from star claims, the autobot uses its own
// callsign, and the client sends whatever Reddit handed it. An unnormalized key
// silently drops the alert on the floor.
const ALERTS_KEY = (username: string) => `sensor_alerts:${username.toLowerCase()}`;
const HISTORY_KEY = (username: string) => `sensor_history:${username.toLowerCase()}`;
const MAX_ALERTS = 10; // cap to avoid unbounded growth
const MAX_HISTORY = 50;
const HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Push a sensor alert for a player.
 *
 * Writes to two places on purpose. The pending queue drives the client's audio
 * cue and is drained (and cleared) by /api/sensors on the next poll. That makes
 * it useless as history, so the same alert is also appended to a durable log
 * that nothing clears — that log is what the returning-player report reads.
 */
export async function pushSensorAlert(
  store: RedisGameStore,
  ownerUsername: string,
  alert: SensorAlert,
): Promise<void> {
  const key = ALERTS_KEY(ownerUsername);
  const raw = await store.get(key);
  let alerts: SensorAlert[] = [];
  if (raw) {
    try { alerts = JSON.parse(raw); } catch { /* reset */ }
  }
  alerts.push(alert);
  // Keep only the newest MAX_ALERTS
  if (alerts.length > MAX_ALERTS) {
    alerts = alerts.slice(-MAX_ALERTS);
  }
  await store.set(key, JSON.stringify(alerts));

  const historyKey = HISTORY_KEY(ownerUsername);
  const historyRaw = await store.get(historyKey);
  let history: SensorAlert[] = [];
  if (historyRaw) {
    try { history = JSON.parse(historyRaw); } catch { /* reset */ }
  }
  history.push(alert);
  const cutoff = alert.ts - HISTORY_TTL_MS;
  history = history.filter((a) => a.ts >= cutoff).slice(-MAX_HISTORY);
  await store.set(historyKey, JSON.stringify(history));
}

/**
 * Durable alerts recorded in [since, until]. Unlike popSensorAlerts this does
 * not clear anything, so it is safe to call alongside the client's audio poll.
 */
export async function getSensorAlertsSince(
  store: RedisGameStore,
  username: string,
  since: number,
  until: number = Date.now(),
): Promise<SensorAlert[]> {
  const raw = await store.get(HISTORY_KEY(username));
  if (!raw) return [];
  try {
    const history = JSON.parse(raw) as SensorAlert[];
    return history.filter((a) => a.ts >= since && a.ts <= until);
  } catch {
    return [];
  }
}

/** Pop all pending sensor alerts for a player (returns and clears). */
export async function popSensorAlerts(
  store: RedisGameStore,
  username: string,
): Promise<SensorAlert[]> {
  const key = ALERTS_KEY(username);
  const raw = await store.get(key);
  if (!raw) return [];
  // Clear immediately
  await store.set(key, '[]');
  try {
    return JSON.parse(raw) as SensorAlert[];
  } catch {
    return [];
  }
}
