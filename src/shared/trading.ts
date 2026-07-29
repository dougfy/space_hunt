// ── Trading Station Utilities ────────────────────────────────────────────────
// Deterministic selection + exchange rate math shared between client and server.

import type { ResourceStore } from './api';

/** Fraction of stars that are trading stations (~5%). */
const TRADE_STATION_MOD = 20;

/** Max stock per resource at a trading station. */
export const TRADE_STATION_CAP = 2000;

/** Starting/equilibrium stock per resource. */
export const TRADE_STATION_EQUILIBRIUM = 1000;

/** Restock rate: units per minute toward equilibrium. */
export const TRADE_STATION_RESTOCK_RATE = 10;

/** Max units a player can trade in a single transaction. */
export const TRADE_MAX_PER_TX = 200;

/** Min exchange rate (selling resource the station has plenty of). */
const RATE_MIN = 0.5;

/** Max exchange rate (buying resource the station has little of). */
const RATE_MAX = 2.0;

/**
 * Deterministic check: is this star a trading station?
 * Uses a simple hash of postId + starIndex. ~5% of stars qualify.
 * Must produce same result on client and server.
 */
export function isTradingStation(postId: string, starIndex: number): boolean {
  let hash = 0;
  for (let i = 0; i < postId.length; i++) {
    hash = (hash * 31 + postId.charCodeAt(i)) | 0;
  }
  hash = ((hash ^ (starIndex * 7919)) >>> 0) % TRADE_STATION_MOD;
  return hash === 0;
}

export type ResourceType = 'ore' | 'food' | 'energy';

export const RESOURCE_TYPES: ResourceType[] = ['ore', 'food', 'energy'];

/**
 * Calculate exchange rate for trading `giveType` to receive `receiveType`.
 * Returns how many units of giveType you need to pay per 1 unit of receiveType.
 *
 * When the station has lots of giveType and little receiveType, rate is high (expensive).
 * When the station has little giveType and lots of receiveType, rate is low (cheap).
 */
export function getExchangeRate(
  stationStock: ResourceStore,
  giveType: ResourceType,
  receiveType: ResourceType,
): number {
  const stationHasGive = Math.max(1, stationStock[giveType]);
  const stationHasReceive = Math.max(1, stationStock[receiveType]);
  // Station wants what it has less of, so receiving giveType is favorable when it's low
  const rawRate = stationHasReceive / stationHasGive;
  // Invert: higher stock of what you're buying = cheaper for you
  // rate > 1 means you pay more per unit received
  return Math.max(RATE_MIN, Math.min(RATE_MAX, rawRate));
}

/**
 * Preview a trade: how much receiveType you get for `giveAmount` of giveType.
 */
export function previewTrade(
  stationStock: ResourceStore,
  giveType: ResourceType,
  receiveType: ResourceType,
  giveAmount: number,
): number {
  if (giveType === receiveType) return 0;
  const rate = getExchangeRate(stationStock, giveType, receiveType);
  return Math.floor(giveAmount / rate);
}
