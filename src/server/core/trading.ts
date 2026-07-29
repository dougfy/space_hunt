// ── Trading Station Server Logic ─────────────────────────────────────────────
// Manages trade station state: stock management, restocking, and trade execution.

import type { ResourceStore, TradeStationState, TradeStationInfoResponse, TradeResponse } from '../../shared/api';
import type { ResourceType } from '../../shared/trading';
import {
  TRADE_STATION_CAP,
  TRADE_STATION_EQUILIBRIUM,
  TRADE_STATION_RESTOCK_RATE,
  TRADE_MAX_PER_TX,
  getExchangeRate,
  RESOURCE_TYPES,
} from '../../shared/trading';
import type { RedisGameStore } from './game-service';

function tradeStationKey(postId: string, starIndex: number): string {
  return `tradeStation:${postId}:s:${starIndex}`;
}

function defaultState(now: number): TradeStationState {
  return {
    stock: {
      ore: TRADE_STATION_EQUILIBRIUM,
      food: TRADE_STATION_EQUILIBRIUM,
      energy: TRADE_STATION_EQUILIBRIUM,
    },
    lastTickMs: now,
  };
}

/** Lazy-tick: restock toward equilibrium. */
function tickStation(state: TradeStationState, now: number): TradeStationState {
  if (now <= state.lastTickMs) return state;
  const elapsedMin = (now - state.lastTickMs) / 60_000;
  const restock = TRADE_STATION_RESTOCK_RATE * elapsedMin;

  const stock = { ...state.stock };
  for (const res of RESOURCE_TYPES) {
    const current = stock[res];
    if (current < TRADE_STATION_EQUILIBRIUM) {
      stock[res] = Math.min(TRADE_STATION_EQUILIBRIUM, current + restock);
    } else if (current > TRADE_STATION_EQUILIBRIUM) {
      // Slowly decay excess back toward equilibrium
      stock[res] = Math.max(TRADE_STATION_EQUILIBRIUM, current - restock * 0.5);
    }
    // Clamp
    stock[res] = Math.max(0, Math.min(TRADE_STATION_CAP, stock[res]));
  }

  return { stock, lastTickMs: now };
}

/** Load trade station state from Redis (creates default if not exists). */
export async function getTradeStation(
  store: RedisGameStore,
  postId: string,
  starIndex: number,
  now = Date.now(),
): Promise<TradeStationState> {
  const key = tradeStationKey(postId, starIndex);
  const raw = await store.hGet(key, 'state');
  let state: TradeStationState;
  if (raw) {
    try {
      state = JSON.parse(raw) as TradeStationState;
    } catch {
      state = defaultState(now);
    }
  } else {
    state = defaultState(now);
  }
  // Tick and persist
  const ticked = tickStation(state, now);
  if (ticked.lastTickMs !== state.lastTickMs) {
    await store.hSet(key, { state: JSON.stringify(ticked) });
  }
  return ticked;
}

/** Get trade station info response (for the client). */
export async function getTradeStationInfo(
  store: RedisGameStore,
  postId: string,
  starIndex: number,
  now = Date.now(),
): Promise<TradeStationInfoResponse> {
  const state = await getTradeStation(store, postId, starIndex, now);
  return {
    starIndex,
    stock: state.stock,
    rates: {
      ore_food: getExchangeRate(state.stock, 'ore', 'food'),
      ore_energy: getExchangeRate(state.stock, 'ore', 'energy'),
      food_ore: getExchangeRate(state.stock, 'food', 'ore'),
      food_energy: getExchangeRate(state.stock, 'food', 'energy'),
      energy_ore: getExchangeRate(state.stock, 'energy', 'ore'),
      energy_food: getExchangeRate(state.stock, 'energy', 'food'),
    },
  };
}

/** Execute a trade between a player and a trading station. */
export async function executeTrade(
  store: RedisGameStore,
  postId: string,
  username: string,
  starIndex: number,
  giveType: ResourceType,
  receiveType: ResourceType,
  giveAmount: number,
  now = Date.now(),
): Promise<TradeResponse> {
  if (giveType === receiveType) throw new Error('Cannot trade same resource');
  if (giveAmount < 1) throw new Error('Amount must be >= 1');
  if (giveAmount > TRADE_MAX_PER_TX) throw new Error(`Max ${TRADE_MAX_PER_TX} per trade`);

  // Load station state
  const stationState = await getTradeStation(store, postId, starIndex, now);

  // Calculate what player receives
  const rate = getExchangeRate(stationState.stock, giveType, receiveType);
  const receiveAmount = Math.floor(giveAmount / rate);
  if (receiveAmount < 1) throw new Error('Trade too small — would receive nothing');

  // Check station has enough to give
  if (stationState.stock[receiveType] < receiveAmount) {
    throw new Error('Station has insufficient stock of requested resource');
  }

  // Load player's economy — find which star they're trading from (home star or any owned star near this trade station)
  // For simplicity, deduct from the player's home star economy
  const profileKey = `profile:${username}`;
  const economyRaw = await store.hGet(profileKey, 'economy');
  if (!economyRaw) throw new Error('No economy data');

  const economy = JSON.parse(economyRaw) as { stars: Record<string, { store: ResourceStore; rates: { ore: number; food: number; energy: number }; cap: number; buildings: unknown; lastTickMs: number }> };

  // Find a star the player owns that has enough of the give resource
  // We'll use the star with the most of the give resource
  let bestStarKey: string | null = null;
  let bestAmount = 0;
  for (const [key, starState] of Object.entries(economy.stars)) {
    const available = starState.store[giveType] ?? 0;
    if (available >= giveAmount && available > bestAmount) {
      bestStarKey = key;
      bestAmount = available;
    }
  }

  if (!bestStarKey) throw new Error('Insufficient resources at any owned star');

  const playerStar = economy.stars[bestStarKey]!;

  // Execute: deduct from player, give to station
  playerStar.store[giveType] -= giveAmount;
  // Add received to player
  playerStar.store[receiveType] = Math.min(
    playerStar.cap,
    playerStar.store[receiveType] + receiveAmount,
  );

  // Update station stock
  stationState.stock[giveType] = Math.min(TRADE_STATION_CAP, stationState.stock[giveType] + giveAmount);
  stationState.stock[receiveType] -= receiveAmount;
  stationState.lastTickMs = now;

  // Persist both
  const stationKey = tradeStationKey(postId, starIndex);
  await store.hSet(stationKey, { state: JSON.stringify(stationState) });
  await store.hSet(profileKey, { economy: JSON.stringify(economy) });

  return {
    ok: true,
    gave: giveAmount,
    received: receiveAmount,
    giveType,
    receiveType,
    playerStore: playerStar.store,
    stationStock: stationState.stock,
  };
}
