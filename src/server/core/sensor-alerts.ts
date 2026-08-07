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

const ALERTS_KEY = (username: string) => `sensor_alerts:${username}`;
const MAX_ALERTS = 10; // cap to avoid unbounded growth

/** Push a sensor alert for a player. */
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
