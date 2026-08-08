/**
 * Automated Player (NPC Bot) — Phase 1+2: FSM with DORMANT/ECONOMY/SHIPYARD/EXPLORE
 *
 * Runs on a Devvit scheduler cron (every 3 min). The bot uses the same
 * game-service functions as real players — no cheat paths.
 *
 * FSM flow: DORMANT → ECONOMY (build buildings) → SHIPYARD (build probes/ships)
 *         → EXPLORE (send probes to discover stars) → loops back to SHIPYARD
 *
 * Debug logging: All actions prefixed with [AUTOBOT] for easy grep in server logs.
 */

import { redis } from '@devvit/web/server';
import type { BuildType, ShipTypeId } from '../../shared/api';
import { generateStarPositions } from '../../shared/galaxy-positions';
import {
  buyBuilding,
  buyShip,
  claimHomeStar,
  colonizeStar,
  getClaimedStars,
  loadAllFleet,
  loadStarEconomy,
  storePose,
  transferShips,
  type RedisGameStore,
} from './game-service';
import { canBuildShip } from '../../shared/ships';
import { pushSensorAlert } from './sensor-alerts';

// ── Types ────────────────────────────────────────────────────────────────────

export type AutoBotFSM = 'dormant' | 'economy' | 'shipyard' | 'explore' | 'roam' | 'colonize' | 'chatter';

export interface AutoBotState {
  fsm: AutoBotFSM;
  name: string;
  homeStarIndex: number;          // -1 = not yet claimed
  currentStarIndex: number;
  currentBodyIndex: number;       // -1 = system view
  roamTicksRemaining: number;
  lastTickMs: number;
  buildQueue: BuildType[];        // ordered priority — next = [0]
  discoveredStars: number[];
  colonizedStars: number[];
  colonizeTarget: number;         // star index being colonized (-1 = none)
  colonizePhase: 'build' | 'transit' | 'claim'; // sub-phase within COLONIZE
  lastColonizeTickMs: number;     // rate-limit: last successful colonization
  chatCount: number;
  lastChatMs: number;
  tickCount: number;              // total ticks executed (debug)
}

// ── Constants ────────────────────────────────────────────────────────────────

const BOT_NAME = 'VALCORDIA_PROBE';
const BOT_STATE_KEY = `autobot:${BOT_NAME}`;
const ACTIVE_POST_KEY = 'app:active_post_id';
const PLAYER_ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 min

/** Build order for economy phase — follows optimal progression. */
const DEFAULT_BUILD_QUEUE: BuildType[] = [
  'station',  // → lv2 (unlocks dock + warehouse)
  'mine',     // → lv1
  'solar',    // → lv1
  'hab',      // → lv1
  'warehouse',// → lv1
  'dock',     // → lv1 (unlocks ships — transition to SHIPYARD)
  'mine',     // → lv2
  'solar',    // → lv2
  'dock',     // → lv2
  'station',  // → lv3 (unlocks cannon)
  'dock',     // → lv3
  'shield',   // → lv1
  'cannon',   // → lv1
];

// ── State Management ─────────────────────────────────────────────────────────

function defaultState(): AutoBotState {
  return {
    fsm: 'dormant',
    name: BOT_NAME,
    homeStarIndex: -1,
    currentStarIndex: -1,
    currentBodyIndex: -1,
    roamTicksRemaining: 0,
    lastTickMs: 0,
    buildQueue: [...DEFAULT_BUILD_QUEUE],
    discoveredStars: [],
    colonizedStars: [],
    colonizeTarget: -1,
    colonizePhase: 'build',
    lastColonizeTickMs: 0,
    chatCount: 0,
    lastChatMs: 0,
    tickCount: 0,
  };
}

async function loadState(): Promise<AutoBotState> {
  const raw = await redis.get(BOT_STATE_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw) as AutoBotState;
    // Ensure all fields exist (migration safety)
    return { ...defaultState(), ...parsed };
  } catch {
    console.warn('[AUTOBOT] Failed to parse state, resetting to default');
    return defaultState();
  }
}

async function saveState(state: AutoBotState): Promise<void> {
  await redis.set(BOT_STATE_KEY, JSON.stringify(state));
}

// ── Activity Check ───────────────────────────────────────────────────────────

/**
 * Check if any real player has been active recently.
 * Scans all claimed stars and checks lastSeen on profiles.
 */
async function anyPlayerOnline(store: RedisGameStore, postId: string): Promise<{ online: boolean; playerCount: number; newestSeen: number }> {
  const now = Date.now();
  const allClaims = await store.hGetAll(`stars:${postId}`);
  let newestSeen = 0;
  let playerCount = 0;

  for (const [, claimValue] of Object.entries(allClaims)) {
    const username = claimValue.split(':')[0];
    // Skip the bot itself
    if (username === BOT_NAME) continue;
    playerCount++;

    const statsRaw = await store.hGet(`profile:${username}`, 'stats');
    if (!statsRaw) continue;
    try {
      const stats = JSON.parse(statsRaw) as { lastSeen?: number };
      if (stats.lastSeen && stats.lastSeen > newestSeen) {
        newestSeen = stats.lastSeen;
      }
    } catch { /* skip bad data */ }
  }

  const online = newestSeen > now - PLAYER_ONLINE_THRESHOLD_MS;
  return { online, playerCount, newestSeen };
}

// ── FSM: Economy State ───────────────────────────────────────────────────────

/**
 * Attempt to build the next item in the queue.
 * Returns a description of what happened.
 */
async function tickEconomy(store: RedisGameStore, state: AutoBotState): Promise<string> {
  if (state.homeStarIndex < 0) {
    return 'no home star — cannot build';
  }

  if (state.buildQueue.length === 0) {
    // Economy phase complete — transition to shipyard
    state.fsm = 'shipyard';
    return 'build queue empty → transitioning to SHIPYARD';
  }

  const nextBuild = state.buildQueue[0]!;

  // First, load the current economy so production is ticked
  const econ = await loadStarEconomy(store, state.name, state.homeStarIndex);

  console.log(`[AUTOBOT] economy check: star=${state.homeStarIndex} resources={ore:${Math.floor(econ.store.ore)}, food:${Math.floor(econ.store.food)}, energy:${Math.floor(econ.store.energy)}} rates={ore:${econ.rates.ore}, food:${econ.rates.food}, energy:${econ.rates.energy}} nextBuild=${nextBuild}`);

  // Check if ANY building is currently upgrading (only one at a time allowed)
  for (const [bType, bState] of Object.entries(econ.buildings)) {
    if (bState && bState.status === 'UPGRADING') {
      const remaining = bState.completeAt ? Math.max(0, Math.floor((bState.completeAt - Date.now()) / 1000)) : '?';
      return `waiting for ${bType} upgrade to complete (${remaining}s remaining)`;
    }
  }

  // Attempt the build
  try {
    const result = await buyBuilding(store, {
      username: state.name,
      starIndex: state.homeStarIndex,
      buildType: nextBuild,
    });

    // Success — remove from queue
    state.buildQueue.shift();
    const newLevel = result.buildings[nextBuild]?.level ?? '?';
    return `started building ${nextBuild} → level ${newLevel} (${state.buildQueue.length} remaining in queue)`;
  } catch (err) {
    // Not enough resources or prereqs not met — wait
    const msg = err instanceof Error ? err.message : String(err);
    return `cannot build ${nextBuild} yet: ${msg}`;
  }
}

// ── FSM: Shipyard State ──────────────────────────────────────────────────────

/** Ship build priority for the bot. Builds probes first (for EXPLORE), then combat ships, then colony ships. */
const SHIP_BUILD_PRIORITY: ShipTypeId[] = [
  11, // Basic Probe (cheap, enables exploration)
  11, // second probe
  1,  // Scout (combat)
  11, // another probe
  3,  // Destroyer (dock lv2 combat)
  11, // probe
  8,  // Colony Ship (dock lv3, enables colonization)
  4,  // Frigate (dock tier 2)
];

/** Colony Ship type ID */
const COLONY_SHIP_TYPE_ID: ShipTypeId = 8 as ShipTypeId;

/**
 * Build ships in priority order. Once we have probes, transition to EXPLORE.
 */
async function tickShipyard(store: RedisGameStore, state: AutoBotState): Promise<string> {
  if (state.homeStarIndex < 0) return 'no home star';

  // Load fleet to reconcile any completed builds/transits
  const fleet = await loadAllFleet(store, state.name);
  const homeKey = `s:${state.homeStarIndex}`;
  const homeFleet = fleet.stars[homeKey];

  // Count probes at home star
  const probesAtHome = homeFleet?.ships?.find(s => s.typeId === 11)?.count ?? 0;

  // If we have probes, transition to EXPLORE to use them
  if (probesAtHome > 0) {
    state.fsm = 'explore';
    return `have ${probesAtHome} probe(s) at home → transitioning to EXPLORE`;
  }

  // Check if already building a ship
  if (homeFleet?.building) {
    const remaining = homeFleet.building.completeAt
      ? Math.max(0, Math.floor((homeFleet.building.completeAt - Date.now()) / 1000))
      : '?';
    return `waiting for ship build to complete (${remaining}s remaining)`;
  }

  // Load economy to check dock level
  const econ = await loadStarEconomy(store, state.name, state.homeStarIndex);
  const dockLevel = econ.buildings.dock?.level ?? 0;

  if (dockLevel < 1) {
    // No dock yet — fall back to economy if there's anything to build
    if (state.buildQueue.length > 0) {
      state.fsm = 'economy';
      return 'no dock yet → back to ECONOMY';
    }
    return 'no dock and no build queue — stuck';
  }

  // Pick the next affordable, buildable ship from priority
  for (const shipTypeId of SHIP_BUILD_PRIORITY) {
    if (!canBuildShip(shipTypeId, dockLevel)) continue;

    try {
      await buyShip(store, {
        username: state.name,
        starIndex: state.homeStarIndex,
        shipTypeId,
        quantity: 1,
      });
      const nameMap: Record<number, string> = { 11: 'Basic Probe', 1: 'Scout', 3: 'Destroyer', 4: 'Frigate' };
      const entry = nameMap[shipTypeId] ?? `ship#${shipTypeId}`;
      return `started building ${entry} (dock lv${dockLevel})`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // If insufficient resources, try next ship in priority
      if (msg.includes('Insufficient')) continue;
      // Other errors (dock too low) — skip this type
      if (msg.includes('Dock level too low')) continue;
      return `shipyard error: ${msg}`;
    }
  }

  // No ship could be built — not enough resources. Interleave with economy.
  if (state.buildQueue.length > 0) {
    state.fsm = 'economy';
    return 'insufficient resources for all ships → back to ECONOMY';
  }
  return 'waiting for resources to build ships';
}

// ── FSM: Explore State ───────────────────────────────────────────────────────

/** Max number of stars the bot will try to discover. */
const MAX_DISCOVERED = 20;
/** Total stars in the galaxy. */
const GALAXY_STAR_COUNT = 100;

/**
 * Send a probe to discover a new star, or transition back to shipyard if out of probes.
 */
async function tickExplore(store: RedisGameStore, state: AutoBotState, postId: string): Promise<string> {
  if (state.homeStarIndex < 0) return 'no home star';

  // Reconcile fleet (completes transits, discovers stars via probe arrival)
  const fleet = await loadAllFleet(store, state.name);
  const homeKey = `s:${state.homeStarIndex}`;
  const homeFleet = fleet.stars[homeKey];

  // Update our discovered stars from the profile
  try {
    const dsRaw = await store.hGet(`profile:${state.name}`, 'discoveredStars');
    if (dsRaw) state.discoveredStars = JSON.parse(dsRaw);
  } catch { /* ignore */ }

  const probesAtHome = homeFleet?.ships?.find(s => s.typeId === 11)?.count ?? 0;

  // If no probes, go back to shipyard to build more
  if (probesAtHome === 0) {
    // Check if probes are still in transit
    const probesInTransit = fleet.transits?.filter(t => t.shipTypeId === 11).length ?? 0;
    if (probesInTransit > 0) {
      return `waiting for ${probesInTransit} probe(s) in transit`;
    }
    state.fsm = 'shipyard';
    return 'no probes available → back to SHIPYARD';
  }

  // Already discovered enough?
  if (state.discoveredStars.length >= MAX_DISCOVERED) {
    state.fsm = 'shipyard'; // Move to building combat ships
    return `discovered ${state.discoveredStars.length} stars (max reached) → SHIPYARD`;
  }

  // Pick a target star to probe — avoid already discovered and claimed stars
  const claimed = await getClaimedStars(store, postId);
  const claimedIndices = new Set(claimed.map(c => c.starIndex));
  const discoveredSet = new Set(state.discoveredStars);

  let targetStar = -1;
  // Simple strategy: iterate from home outwards, pick first undiscovered unclaimed star
  for (let offset = 1; offset < GALAXY_STAR_COUNT; offset++) {
    const candidate = (state.homeStarIndex + offset) % GALAXY_STAR_COUNT;
    if (!discoveredSet.has(candidate) && !claimedIndices.has(candidate)) {
      targetStar = candidate;
      break;
    }
  }

  if (targetStar < 0) {
    state.fsm = 'shipyard';
    return 'no undiscovered stars to probe → SHIPYARD';
  }

  // Send 1 probe to the target star
  try {
    await transferShips(store, state.name, state.homeStarIndex, targetStar, 11 as ShipTypeId, 1);
    return `sent probe to star #${targetStar} (discovered: ${state.discoveredStars.length})`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `failed to send probe: ${msg}`;
  }
}

// ── FSM: Roam State ──────────────────────────────────────────────────────────

/** Minimum discovered stars before entering roam. */
const ROAM_THRESHOLD = 4;
/** Ticks to "stay" at a star before moving on. */
const ROAM_LINGER_TICKS = 2;

/**
 * Roam between player-claimed stars. The bot gravitates toward stars
 * where players are, so it's more likely to be seen.
 * Falls back to discovered stars if no other claims exist.
 */
async function tickRoam(store: RedisGameStore, state: AutoBotState, postId: string): Promise<string> {
  // Reconcile fleet so transits complete
  await loadAllFleet(store, state.name);

  // If roam ticks remaining, decrement and stay put
  if (state.roamTicksRemaining > 0) {
    state.roamTicksRemaining--;
    return `lingering at star #${state.currentStarIndex} (${state.roamTicksRemaining} ticks left)`;
  }

  // Prefer claimed stars (where players actually are)
  const claimed = await getClaimedStars(store, postId);
  const playerStars = claimed
    .filter(c => c.username !== state.name)
    .map(c => c.starIndex);

  // Candidates: player stars first, then discovered stars as fallback
  let candidates = playerStars.filter(s => s !== state.currentStarIndex);
  if (candidates.length === 0) {
    candidates = state.discoveredStars.filter(s => s !== state.currentStarIndex);
  }
  if (candidates.length === 0) {
    state.fsm = 'shipyard';
    return 'nowhere to roam → SHIPYARD';
  }

  // Pick pseudo-random star based on tick count
  const idx = state.tickCount % candidates.length;
  const nextStar = candidates[idx]!;
  state.currentStarIndex = nextStar;
  state.roamTicksRemaining = ROAM_LINGER_TICKS;

  // Push sensor alert to star owner
  const starOwner = claimed.find(c => c.starIndex === nextStar);
  if (starOwner && starOwner.username !== state.name) {
    await pushSensorAlert(store, starOwner.username, {
      type: 'unidentified',
      starIndex: nextStar,
      from: state.name,
      ts: Date.now(),
    });
  }

  return `roaming to star #${nextStar} (player-claimed, ${state.roamTicksRemaining} ticks linger)`;
}

// ── FSM: Colonize State ──────────────────────────────────────────────────────

/** Minimum ticks between colonizations (rate-limit: ~15 min at 3-min cron). */
const COLONIZE_COOLDOWN_TICKS = 5;
/** Max colonies the bot will claim. */
const MAX_COLONIES = 3;

/**
 * Colonize an unclaimed discovered star.
 * Sub-phases: build → transit → claim
 *   build:   Build a Colony Ship at home if none available
 *   transit: Transfer Colony Ship to target star, wait for arrival
 *   claim:   Call colonizeStar() to claim it
 */
async function tickColonize(store: RedisGameStore, state: AutoBotState, postId: string): Promise<string> {
  if (state.homeStarIndex < 0) return 'no home star';

  // Max colonies check
  if (state.colonizedStars.length >= MAX_COLONIES) {
    state.fsm = 'roam';
    return `max colonies (${MAX_COLONIES}) reached → ROAM`;
  }

  // Reconcile fleet (completes transits)
  const fleet = await loadAllFleet(store, state.name);
  const homeKey = `s:${state.homeStarIndex}`;
  const homeFleet = fleet.stars[homeKey];

  // Pick a target star if we don't have one
  if (state.colonizeTarget < 0) {
    const claimed = await getClaimedStars(store, postId);
    const claimedSet = new Set(claimed.map(c => c.starIndex));
    const colonizedSet = new Set(state.colonizedStars);

    // Pick first discovered, unclaimed, uncolonized star
    let target = -1;
    for (const si of state.discoveredStars) {
      if (si === state.homeStarIndex) continue;
      if (claimedSet.has(si)) continue;
      if (colonizedSet.has(si)) continue;
      target = si;
      break;
    }

    if (target < 0) {
      state.fsm = 'roam';
      return 'no unclaimed discovered stars to colonize → ROAM';
    }

    state.colonizeTarget = target;
    state.colonizePhase = 'build';
    console.log(`[AUTOBOT] colonize target selected: star #${target}`);
  }

  const targetStar = state.colonizeTarget;

  // ── SUB-PHASE: BUILD ──
  if (state.colonizePhase === 'build') {
    // Check if we already have a colony ship at home
    const colonyAtHome = homeFleet?.ships?.find(s => s.typeId === COLONY_SHIP_TYPE_ID)?.count ?? 0;

    if (colonyAtHome > 0) {
      // Have colony ship → advance to transit
      state.colonizePhase = 'transit';
      return `colony ship ready at home → TRANSIT to star #${targetStar}`;
    }

    // Check if one is being built
    if (homeFleet?.building && homeFleet.building.typeId === COLONY_SHIP_TYPE_ID) {
      const remaining = homeFleet.building.completeAt
        ? Math.max(0, Math.floor((homeFleet.building.completeAt - Date.now()) / 1000))
        : '?';
      return `building Colony Ship (${remaining}s remaining)`;
    }

    // Check if another ship is being built — wait for it
    if (homeFleet?.building) {
      const remaining = homeFleet.building.completeAt
        ? Math.max(0, Math.floor((homeFleet.building.completeAt - Date.now()) / 1000))
        : '?';
      return `waiting for current ship build (${remaining}s remaining)`;
    }

    // Try to build a colony ship
    const econ = await loadStarEconomy(store, state.name, state.homeStarIndex);
    const dockLevel = econ.buildings.dock?.level ?? 0;

    if (!canBuildShip(COLONY_SHIP_TYPE_ID, dockLevel)) {
      // Dock too low — need to go back to economy to upgrade
      state.fsm = 'economy';
      state.colonizeTarget = -1;
      return `dock lv${dockLevel} too low for Colony Ship (needs lv3) → ECONOMY`;
    }

    try {
      await buyShip(store, {
        username: state.name,
        starIndex: state.homeStarIndex,
        shipTypeId: COLONY_SHIP_TYPE_ID,
        quantity: 1,
      });
      return `started building Colony Ship for star #${targetStar}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Insufficient')) {
        return `waiting for resources to build Colony Ship: ${msg}`;
      }
      return `colony ship build error: ${msg}`;
    }
  }

  // ── SUB-PHASE: TRANSIT ──
  if (state.colonizePhase === 'transit') {
    // Check if colony ship is already at target
    const targetKey = `s:${targetStar}`;
    const targetFleet = fleet.stars[targetKey];
    const colonyAtTarget = targetFleet?.ships?.find(s => s.typeId === COLONY_SHIP_TYPE_ID)?.count ?? 0;

    if (colonyAtTarget > 0) {
      // Arrived! → advance to claim
      state.colonizePhase = 'claim';
      return `Colony Ship arrived at star #${targetStar} → CLAIM`;
    }

    // Check if in transit
    const inTransit = fleet.transits?.find(
      t => t.shipTypeId === COLONY_SHIP_TYPE_ID && t.toStarIndex === targetStar
    );
    if (inTransit) {
      const remaining = Math.max(0, Math.floor((inTransit.arrivalAt - Date.now()) / 1000));
      return `Colony Ship in transit to star #${targetStar} (${remaining}s remaining)`;
    }

    // Not in transit and not at target — need to send it
    const colonyAtHome = homeFleet?.ships?.find(s => s.typeId === COLONY_SHIP_TYPE_ID)?.count ?? 0;
    if (colonyAtHome > 0) {
      try {
        await transferShips(store, state.name, state.homeStarIndex, targetStar, COLONY_SHIP_TYPE_ID, 1);
        return `sent Colony Ship from home to star #${targetStar}`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `transfer failed: ${msg}`;
      }
    }

    // Colony ship disappeared — go back to build
    state.colonizePhase = 'build';
    return 'Colony Ship lost → back to BUILD';
  }

  // ── SUB-PHASE: CLAIM ──
  if (state.colonizePhase === 'claim') {
    try {
      const result = await colonizeStar(store, postId, state.name, targetStar);
      state.colonizedStars.push(targetStar);
      state.lastColonizeTickMs = state.tickCount; // record tick for rate-limit
      state.colonizeTarget = -1;
      state.colonizePhase = 'build';

      // After colonizing, roam for a while before next colony
      state.fsm = 'roam';
      state.currentStarIndex = targetStar;
      state.roamTicksRemaining = COLONIZE_COOLDOWN_TICKS;

      console.log(`[AUTOBOT] COLONIZED star #${targetStar} (${result.starName})! total=${state.colonizedStars.length}`);
      return `colonized star #${targetStar} (${result.starName})! colonies=${state.colonizedStars.length} → ROAM`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already claimed') || msg.includes('already own')) {
        // Star was taken by someone else — pick a new target
        state.colonizeTarget = -1;
        state.colonizePhase = 'build';
        return `star #${targetStar} was claimed by another player → picking new target`;
      }
      return `colonize failed: ${msg}`;
    }
  }

  return `unknown colonize phase: ${state.colonizePhase}`;
}

// ── Ghost Pose Injection ─────────────────────────────────────────────────────

/** Cron interval — poses must survive this long between ticks. */
const CRON_INTERVAL_MS = 3 * 60 * 1000 + 30_000; // 3.5 min buffer

/**
 * Inject the bot's pose so other players see it at its current star.
 * Uses real star coordinates and future-pads the timestamp so the pose
 * survives between 3-min cron ticks (stale threshold is 8 s).
 */
export async function injectGhostPose(
  store: RedisGameStore,
  state: AutoBotState,
  postId: string,
  overrideStar?: number,
  overrideTier?: number,
  overrideBody?: number,
): Promise<void> {
  const t = state.tickCount * 0.7;
  const angle = ((t * 30) % 360);
  const futureTs = Date.now() + CRON_INTERVAL_MS;
  const starIdx = overrideStar ?? state.currentStarIndex;
  const tier = overrideTier ?? undefined;
  const bodyIdx = overrideBody ?? -1;

  // Look up star world coordinates
  const stars = generateStarPositions(postId);
  const star = starIdx >= 0 && starIdx < stars.length ? stars[starIdx] : undefined;

  // Galaxy-tier pose (tier 0) — orbit near the bot's current star
  const gx = star ? star.x + Math.cos(t) * 3 : 50 + Math.cos(t) * 5;
  const gy = star ? star.y + Math.sin(t) * 2 : 50 + Math.sin(t) * 3;
  if (tier === undefined || tier === 0) {
    await storePose(store, postId, {
      x: gx,
      y: gy,
      angle,
      username: state.name,
      sessionId: `bot:${state.name}:galaxy`,
      shape: 'scout',
      tier: 0,
      starIndex: -1,
      bodyIndex: -1,
    }, futureTs);
  }

  // Star-tier pose (tier 1) — visible inside the star system
  // System space is 40×40 centered at (20, 20)
  if (starIdx >= 0 && (tier === undefined || tier === 1)) {
    const sx = 20 + Math.cos(t + 1) * 8;
    const sy = 20 + Math.sin(t + 1) * 6;
    await storePose(store, postId, {
      x: sx,
      y: sy,
      angle,
      username: state.name,
      sessionId: `bot:${state.name}:star`,
      shape: 'scout',
      tier: 1,
      starIndex: starIdx,
      bodyIndex: -1,
    }, futureTs);
  }

  // Planet-tier pose (tier 3) — visible at a specific body
  // Planet space is ~6×6 centered at (0, 0)
  if (starIdx >= 0 && bodyIdx >= 0 && (tier === undefined || tier === 3)) {
    const px = Math.cos(t + 2) * 2;
    const py = Math.sin(t + 2) * 1.5;
    await storePose(store, postId, {
      x: px,
      y: py,
      angle,
      username: state.name,
      sessionId: `bot:${state.name}:planet`,
      shape: 'scout',
      tier: 3,
      starIndex: starIdx,
      bodyIndex: bodyIdx,
    }, futureTs);
  }
}

// ── Main Tick ────────────────────────────────────────────────────────────────

export async function tickAutoBot(): Promise<{ action: string; state: AutoBotState; debug: Record<string, unknown> }> {
  const store: RedisGameStore = {
    hSet: (key, values) => redis.hSet(key, values),
    hGetAll: (key) => redis.hGetAll(key),
    hGet: (key, field) => redis.hGet(key, field),
    hDel: (key, fields) => redis.hDel(key, fields),
    get: (key) => redis.get(key),
    set: (key, value) => redis.set(key, value),
  };

  const state = await loadState();
  state.tickCount++;
  const now = Date.now();
  const elapsed = state.lastTickMs > 0 ? now - state.lastTickMs : 0;
  state.lastTickMs = now;
  const debug: Record<string, unknown> = { now, elapsed };

  console.log(`[AUTOBOT] ─── TICK #${state.tickCount} ───`);
  console.log(`[AUTOBOT] state: fsm=${state.fsm} home=${state.homeStarIndex} elapsed=${Math.floor(elapsed / 1000)}s buildQueue=${state.buildQueue.length} items`);

  // Get active post
  const postId = await redis.get(ACTIVE_POST_KEY);
  if (!postId) {
    console.log('[AUTOBOT] no active postId — skipping tick');
    debug.reason = 'no_post_id';
    await saveState(state);
    return { action: 'no_post_id', state, debug };
  }
  debug.postId = postId;

  // Activity gate
  const activity = await anyPlayerOnline(store, postId);
  debug.activity = activity;
  console.log(`[AUTOBOT] activity: online=${activity.online} playerCount=${activity.playerCount} newestSeen=${activity.newestSeen > 0 ? Math.floor((now - activity.newestSeen) / 1000) + 's ago' : 'never'}`);

  if (!activity.online) {
    if (state.fsm !== 'dormant') {
      console.log('[AUTOBOT] no players online → entering DORMANT');
      state.fsm = 'dormant';
    }
    debug.reason = `dormant: playerCount=${activity.playerCount} newestSeen=${activity.newestSeen > 0 ? Math.floor((now - activity.newestSeen) / 1000) + 's ago' : 'never'}`;
    await saveState(state);
    return { action: 'dormant_no_players', state, debug };
  }

  // Wake from dormant
  if (state.fsm === 'dormant') {
    console.log('[AUTOBOT] player detected → waking up');
    state.fsm = state.homeStarIndex >= 0 ? 'economy' : 'dormant';
  }

  // Claim home star if needed
  if (state.homeStarIndex < 0) {
    console.log('[AUTOBOT] claiming home star...');
    try {
      const claim = await claimHomeStar(store, postId, state.name);
      state.homeStarIndex = claim.homeStar;
      state.currentStarIndex = claim.homeStar;
      state.fsm = 'economy';
      console.log(`[AUTOBOT] claimed home star: index=${claim.homeStar}`);
      await saveState(state);
      return { action: `claimed_home_star_${claim.homeStar}`, state, debug };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[AUTOBOT] failed to claim home star: ${msg}`);
      await saveState(state);
      return { action: `claim_failed: ${msg}`, state, debug };
    }
  }

  // Execute FSM step
  let action: string;
  switch (state.fsm) {
    case 'economy':
      action = await tickEconomy(store, state);
      break;

    case 'shipyard':
      action = await tickShipyard(store, state);
      break;

    case 'explore':
      action = await tickExplore(store, state, postId);
      break;

    case 'roam':
      action = await tickRoam(store, state, postId);
      break;

    case 'colonize':
      action = await tickColonize(store, state, postId);
      break;

    case 'chatter':
      action = `${state.fsm} phase not yet implemented`;
      break;

    default:
      action = `unknown state: ${state.fsm}`;
  }

  // Transition: after enough discoveries, interleave roam and colonize
  if (state.fsm === 'shipyard' && state.discoveredStars.length >= ROAM_THRESHOLD && state.tickCount % 5 === 0) {
    // Colonize if: dock lv3+, under colony cap, cooldown elapsed
    const readyToColonize = state.colonizedStars.length < MAX_COLONIES
      && (state.tickCount - (state.lastColonizeTickMs || 0)) >= COLONIZE_COOLDOWN_TICKS;
    if (readyToColonize && state.tickCount % 10 === 0) {
      state.fsm = 'colonize';
      state.currentStarIndex = state.homeStarIndex;
    } else {
      state.fsm = 'roam';
      state.currentStarIndex = state.homeStarIndex;
    }
  }

  // Ghost pose injection — make bot visible to other players
  try {
    await injectGhostPose(store, state, postId);
  } catch (err) {
    console.warn('[AUTOBOT] pose injection failed:', err instanceof Error ? err.message : err);
  }

  console.log(`[AUTOBOT] action: ${action}`);
  console.log(`[AUTOBOT] ─── END TICK #${state.tickCount} ───`);

  await saveState(state);
  return { action, state, debug };
}

// ── Admin Helpers ────────────────────────────────────────────────────────────

/** Reset bot state (for testing). */
export async function resetAutoBot(): Promise<void> {
  await redis.set(BOT_STATE_KEY, JSON.stringify(defaultState()));
  console.log('[AUTOBOT] state reset to default');
}

/** Get current bot state (for debug panel). */
export async function getAutoBotState(): Promise<AutoBotState> {
  return loadState();
}

/** Check if a username is the autobot. */
export function isAutoBot(username: string): boolean {
  return username === BOT_NAME;
}

/** The bot's username constant. */
export const AUTO_BOT_NAME = BOT_NAME;
