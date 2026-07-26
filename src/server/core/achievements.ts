// ── Achievement System ────────────────────────────────────────────────────────
// Posts comments on the game thread when players hit milestones.
// Each achievement is tracked in Redis so it fires only once per player.

import { reddit } from '@devvit/web/server';
import { SHIP_CATALOG } from '../../shared/ships';
import type { ShipTypeId } from '../../shared/api';

export type RedisGameStore = {
  hSet(key: string, values: Record<string, string>): Promise<unknown>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hGet(key: string, field: string): Promise<string | undefined>;
  hDel?(key: string, fields: string[]): Promise<unknown>;
};

// ── Achievement Definitions ──────────────────────────────────────────────────

type AchievementId =
  | 'first_colony'
  | 'colony_3'
  | 'colony_5'
  | 'colony_10'
  | 'first_ship'
  | 'upgrade_frigate'
  | 'upgrade_battleship'
  | 'upgrade_dreadnought'
  | 'dock_tier_2'
  | 'dock_tier_3'
  | 'first_transfer';

const ACHIEVEMENT_MESSAGES: Record<AchievementId, string> = {
  first_colony:        '🌟 **{user}** has colonized their first star system — **{detail}**!',
  colony_3:            '🌌 **{user}** now controls 3 star systems!',
  colony_5:            '🏴 **{user}** has expanded to 5 star systems!',
  colony_10:           '👑 **{user}** commands a 10-star empire!',
  first_ship:          '🚀 **{user}** has built their first ship!',
  upgrade_frigate:     '⚔️ **{user}** upgraded their fleet — a **Frigate** is under construction!',
  upgrade_battleship:  '💥 **{user}** is building a **Battleship**!',
  upgrade_dreadnought: '☠️ **{user}** has begun construction of a **Dreadnought**!',
  dock_tier_2:         '🔧 **{user}** upgraded their dock to **Tier 2** — advanced ships unlocked!',
  dock_tier_3:         '🏗️ **{user}** reached **Tier 3 Dock** — capital ships unlocked!',
  first_transfer:      '🛸 **{user}** sent ships to another star system for the first time!',
};

// ── Redis Keys ───────────────────────────────────────────────────────────────

function achievementsKey(username: string): string {
  return `achievements:${username}`;
}

function scoreKey(username: string): string {
  return `score:${username}`;
}

// ── Core Functions ───────────────────────────────────────────────────────────

async function hasAchievement(store: RedisGameStore, username: string, id: AchievementId): Promise<boolean> {
  const val = await store.hGet(achievementsKey(username), id);
  return val != null;
}

async function grantAchievement(store: RedisGameStore, username: string, id: AchievementId): Promise<void> {
  await store.hSet(achievementsKey(username), { [id]: String(Date.now()) });
}

function formatMessage(id: AchievementId, username: string, detail?: string): string {
  let msg = ACHIEVEMENT_MESSAGES[id];
  msg = msg.replace('{user}', `u/${username}`);
  if (detail) msg = msg.replace('{detail}', detail);
  return msg;
}

async function postAchievement(
  store: RedisGameStore,
  postId: string,
  username: string,
  id: AchievementId,
  detail?: string,
): Promise<void> {
  if (await hasAchievement(store, username, id)) return;
  await grantAchievement(store, username, id);

  const text = formatMessage(id, username, detail);
  try {
    await reddit.submitComment({
      id: `t3_${postId}` as `t3_${string}`,
      text,
      runAs: 'APP',
    });
  } catch (e) {
    console.error(`[ACHIEVEMENTS] Failed to post comment for ${id}:`, e);
  }
}

// ── Score Computation ────────────────────────────────────────────────────────

export interface ScoreInput {
  totalShips: number;
  totalBuildingLevels: number;
  starsColonized: number;
}

export function computeScore(input: ScoreInput): number {
  return (input.starsColonized * 100) + (input.totalShips * 10) + (input.totalBuildingLevels * 5);
}

export async function updateScore(store: RedisGameStore, username: string, input: ScoreInput): Promise<number> {
  const score = computeScore(input);
  await store.hSet(scoreKey(username), {
    score: String(score),
    ships: String(input.totalShips),
    buildings: String(input.totalBuildingLevels),
    stars: String(input.starsColonized),
    updatedAt: String(Date.now()),
  });
  return score;
}

// ── Public Achievement Triggers ──────────────────────────────────────────────

/** Called after a star is successfully colonized. */
export async function onColonize(
  store: RedisGameStore,
  postId: string,
  username: string,
  starName: string,
  totalStars: number,
): Promise<void> {
  if (totalStars === 1) await postAchievement(store, postId, username, 'first_colony', starName);
  if (totalStars === 3) await postAchievement(store, postId, username, 'colony_3');
  if (totalStars === 5) await postAchievement(store, postId, username, 'colony_5');
  if (totalStars === 10) await postAchievement(store, postId, username, 'colony_10');
}

/** Called after a ship is successfully purchased (build started). */
export async function onShipBuy(
  store: RedisGameStore,
  postId: string,
  username: string,
  totalShipsEver: number,
): Promise<void> {
  if (totalShipsEver === 1) await postAchievement(store, postId, username, 'first_ship');
}

/** Called after a ship upgrade is started. */
export async function onShipUpgrade(
  store: RedisGameStore,
  postId: string,
  username: string,
  targetTypeId: ShipTypeId,
): Promise<void> {
  const catalog = SHIP_CATALOG[targetTypeId];
  if (!catalog) return;
  if (targetTypeId === 4) await postAchievement(store, postId, username, 'upgrade_frigate');
  if (targetTypeId === 5) await postAchievement(store, postId, username, 'upgrade_battleship');
  if (targetTypeId === 7) await postAchievement(store, postId, username, 'upgrade_dreadnought');
}

/** Called after a dock building completes its upgrade. */
export async function onDockUpgrade(
  store: RedisGameStore,
  postId: string,
  username: string,
  newDockLevel: number,
): Promise<void> {
  // Dock level 3 = Tier 2, level 5 = Tier 3
  if (newDockLevel === 3) await postAchievement(store, postId, username, 'dock_tier_2');
  if (newDockLevel === 5) await postAchievement(store, postId, username, 'dock_tier_3');
}

/** Called after ships are transferred to another star. */
export async function onFirstTransfer(
  store: RedisGameStore,
  postId: string,
  username: string,
): Promise<void> {
  await postAchievement(store, postId, username, 'first_transfer');
}
