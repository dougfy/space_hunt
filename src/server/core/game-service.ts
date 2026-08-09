import type {
  BuildBuildingResponse,
  BuildBuildingRequest,
  BuyShipRequest,
  BuyShipResponse,
  ClaimPodRequest,
  ClaimPodResponse,
  ClaimedPodsResponse,
  BuildType,
  FleetAllResponse,
  FleetTransferResponse,
  FreighterRoute,
  FreighterRouteResponse,
  RaidRoute,
  RaidRouteResponse,
  ResourceStore,
  ShipBuildingState,
  ShipTransit,
  ShipTypeId,
  StarEconomyResponse,
  StarEconomyState,
  StarShipsState,
  StarShipsResponse,
  PlayerProfileResponse,
  PlayerStatsData,
  AdminPlayerSummary,
  AdminPlayerStatsResponse,
  PoseUpdateRequest,
  PostShotsRequest,
  RemoteShotItem,
  RoomPoseItem,
  RoomPosesResponse,
  SaveProfileRequest,
  ShotItem,
  ShotsResponse,
  ToggleShieldResponse,
  UpgradeShipRequest,
  UpgradeShipResponse,
} from '../../shared/api';
import { normalizeSharedShipShape } from '../../shared/api';
import {
  BUILDING_CATALOG,
  computeDefenseScore,
  computeResourceCapFromBuildings,
  computeResourceRatesFromBuildings,
  getBuildingCost,
  getBuildingDurationSeconds,
  getBuildingTargetLevel,
  getStarRichness,
  isBuildUnlocked,
  normalizeStarBuildings,
  reconcileStarBuildings,
} from '../../shared/buildings';
import { SHIP_CATALOG, canBuildShip, getUpgradeTarget, canUpgradeShip } from '../../shared/ships';
import { getStarName } from '../../shared/star-names';
import { isTradingStation } from '../../shared/trading';
import { pushSensorAlert } from './sensor-alerts';
import { filterActiveBuffs, hasActiveBuff, RESONANCE_MULTIPLIER, HYPERDRIVE_MULTIPLIER, CHRONO_MULTIPLIER } from '../../shared/buffs';
import type { ActiveBuff } from '../../shared/buffs';

const ECONOMY_FIELD = 'economy';
const DEFAULT_STORE: ResourceStore = { ore: 640, food: 640, energy: 640, fuel: 0 };

type StoredEconomyProfile = {
  stars: Record<string, StarEconomyState>;
  homeStar?: number;
};

function starKey(starIndex: number): string {
  return `s:${starIndex}`;
}

/** Compute resource richness for a star, boosted if it's the player's home star */
function starRichness(starIndex: number, economy: StoredEconomyProfile): ResourceStore {
  const isHome = economy.homeStar === starIndex;
  return getStarRichness(starIndex, isHome);
}

function clampStore(store: ResourceStore, cap: number): ResourceStore {
  const safeCap = Math.max(1, Math.floor(cap));
  return {
    ore: Math.max(0, Math.min(safeCap, store.ore)),
    food: Math.max(0, Math.min(safeCap, store.food)),
    energy: Math.max(0, Math.min(safeCap, store.energy)),
    fuel: Math.max(0, Math.min(safeCap, store.fuel)),
  };
}

function normalizeStore(store: ResourceStore): ResourceStore {
  return {
    ore: Number.isFinite(store.ore) ? store.ore : 0,
    food: Number.isFinite(store.food) ? store.food : 0,
    energy: Number.isFinite(store.energy) ? store.energy : 0,
    fuel: Number.isFinite(store.fuel) ? store.fuel : 0,
  };
}

function normalizeStarState(star: Partial<StarEconomyState>, now: number, richness?: ResourceStore): StarEconomyState {
  const buildings = normalizeStarBuildings(star.buildings as Partial<Record<BuildType, Partial<StarEconomyState['buildings'][BuildType]>>>);
  const cap = computeResourceCapFromBuildings(buildings);
  const shieldRaised = star.shieldRaised ?? false;
  const rawStore = normalizeStore({
    ore: star.store?.ore ?? DEFAULT_STORE.ore,
    food: star.store?.food ?? DEFAULT_STORE.food,
    energy: star.store?.energy ?? DEFAULT_STORE.energy,
    fuel: star.store?.fuel ?? DEFAULT_STORE.fuel,
  });
  return {
    store: clampStore(rawStore, cap),
    rates: computeResourceRatesFromBuildings(buildings, shieldRaised, richness),
    cap,
    buildings,
    shieldRaised,
    lastTickMs: Number.isFinite(star.lastTickMs) ? (star.lastTickMs as number) : now,
  };
}

function tickStarEconomy(star: StarEconomyState, now: number, rateMultiplier = 1): StarEconomyState {
  if (now <= star.lastTickMs) return star;
  const elapsedMin = (now - star.lastTickMs) / 60_000;
  const m = rateMultiplier;
  const next = {
    ...star,
    store: clampStore({
      ore: star.store.ore + star.rates.ore * elapsedMin * m,
      food: star.store.food + star.rates.food * elapsedMin * m,
      energy: star.store.energy + star.rates.energy * elapsedMin * m,
      fuel: (star.store.fuel ?? 0) + (star.rates.fuel ?? 0) * elapsedMin * m,
    }, star.cap),
    lastTickMs: now,
  };
  return next;
}

function parseEconomy(raw: string | undefined): StoredEconomyProfile {
  if (!raw) return { stars: {} };
  try {
    const parsed = JSON.parse(raw) as StoredEconomyProfile;
    if (!parsed || typeof parsed !== 'object' || !parsed.stars || typeof parsed.stars !== 'object') {
      return { stars: {} };
    }
    return parsed;
  } catch {
    return { stars: {} };
  }
}

function hasEnoughResources(store: ResourceStore, cost: ResourceStore): boolean {
  return store.ore >= cost.ore && store.food >= cost.food && store.energy >= cost.energy && store.fuel >= (cost.fuel ?? 0);
}

function subtractResources(store: ResourceStore, cost: ResourceStore): ResourceStore {
  return {
    ore: store.ore - cost.ore,
    food: store.food - cost.food,
    energy: store.energy - cost.energy,
    fuel: store.fuel - (cost.fuel ?? 0),
  };
}

async function loadEconomyProfile(store: RedisGameStore, username: string): Promise<StoredEconomyProfile> {
  const profileKey = `profile:${username}`;
  const economyRaw = await store.hGet(profileKey, ECONOMY_FIELD);
  return parseEconomy(economyRaw);
}

async function saveEconomyProfile(store: RedisGameStore, username: string, economy: StoredEconomyProfile): Promise<void> {
  await store.hSet(`profile:${username}`, { [ECONOMY_FIELD]: JSON.stringify(economy) });
}

export type RedisGameStore = {
  hSet(key: string, values: Record<string, string>): Promise<unknown>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hGet(key: string, field: string): Promise<string | undefined>;
  hDel(key: string, fields: string[]): Promise<unknown>;
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<unknown>;
};

type StoredPose = PoseUpdateRequest & { ts: number };
type StoredShots = { shots: ShotItem[]; ts: number };

export const POSE_STALE_MS = 8000;
export const SHOT_TTL_MS = 3000;

export async function storePose(
  store: RedisGameStore,
  postId: string,
  body: PoseUpdateRequest,
  now = Date.now(),
): Promise<void> {
  const sid = body.sessionId || body.username;
  const hashKey = `poses:${postId}`;
  const value = JSON.stringify({
    x: body.x,
    y: body.y,
    angle: body.angle,
    shape: normalizeSharedShipShape(body.shape),
    username: body.username,
    ts: now,
    tier: body.tier ?? 0,
    starIndex: body.starIndex ?? -1,
    bodyIndex: body.bodyIndex ?? -1,
  } satisfies StoredPose);
  await store.hSet(hashKey, { [sid]: value });
}

export async function listRoomPoses(
  store: RedisGameStore,
  params: {
    postId: string;
    exclude?: string;
    tier?: number;
    starIndex?: number;
    bodyIndex?: number;
  },
  now = Date.now(),
): Promise<RoomPosesResponse> {
  const hashKey = `poses:${params.postId}`;
  const all = await store.hGetAll(hashKey);
  const items: RoomPoseItem[] = [];
  const staleKeys: string[] = [];
  const exclude = params.exclude ?? '';
  const tierFilter = params.tier ?? -1;
  const starFilter = params.starIndex ?? -1;
  const bodyFilter = params.bodyIndex ?? -1;

  for (const [sid, raw] of Object.entries(all)) {
    if (sid === exclude) continue;
    const data = JSON.parse(raw) as StoredPose;
    if (now - data.ts > POSE_STALE_MS) {
      staleKeys.push(sid);
      continue;
    }
    if (tierFilter >= 0) {
      if ((data.tier ?? 0) !== tierFilter) continue;
      if (tierFilter >= 1 && (data.starIndex ?? -1) !== starFilter) continue;
      if (tierFilter >= 2 && (data.bodyIndex ?? -1) !== bodyFilter) continue;
    }
    items.push({
      username: data.username || sid,
      x: data.x,
      y: data.y,
      angle: data.angle,
      shape: normalizeSharedShipShape(data.shape),
    });

    // Bot poses: compute realistic movement from time alone
    if (sid.startsWith('bot:')) {
      const last = items[items.length - 1]!;
      const tier = data.tier ?? 0;
      const t = now / 1000;

      if (tier === 0) {
        // Galaxy: patrol between base position and a nearby offset star
        // 60-second cycle: travel out (0-25s), pause (25-35s), travel back (35-60s)
        const cycleLen = 60;
        const phase = t % cycleLen;
        // Patrol offset — a "destination" ~15 units away in a slowly rotating direction
        const patrolAngle = Math.floor(t / cycleLen) * 1.8;
        const destX = data.x + Math.cos(patrolAngle) * 12;
        const destY = data.y + Math.sin(patrolAngle) * 10;

        let progress: number;
        if (phase < 25) {
          // Traveling to destination
          progress = phase / 25;
          // ease in-out
          progress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        } else if (phase < 35) {
          // Lingering at destination
          progress = 1;
        } else {
          // Traveling back
          progress = 1 - (phase - 35) / 25;
          progress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        }
        last.x = data.x + (destX - data.x) * progress;
        last.y = data.y + (destY - data.y) * progress;
        // Face travel direction
        last.angle = Math.atan2(destY - data.y, destX - data.x) * (180 / Math.PI);
        if (phase >= 35) last.angle += 180; // heading back

      } else {
        // System/Planet: arrive from edge, linger, depart to edge
        // 45-second cycle: arrive (0-12s), linger (12-25s), depart (25-37s), gone (37-45s)
        const cycleLen = 45;
        const phase = t % cycleLen;

        // Determine coordinate space based on tier
        // System tier (1): 40×40, center at 20. Planet tier (3): ~6×6, center at 0.
        const isPlanet = (data.tier ?? 0) === 3;
        const CENTER = isPlanet ? 0 : 20;
        const EDGE = isPlanet ? 2.5 : 18;
        const LINGER_RADIUS = isPlanet ? 0.8 : 3;

        // Entry and exit edges (rotate each cycle)
        const cycleNum = Math.floor(t / cycleLen);
        const entryAngle = cycleNum * 2.3;
        const exitAngle = entryAngle + Math.PI * 0.7;
        const entryX = CENTER + Math.cos(entryAngle) * EDGE;
        const entryY = CENTER + Math.sin(entryAngle) * EDGE;
        const exitX = CENTER + Math.cos(exitAngle) * EDGE;
        const exitY = CENTER + Math.sin(exitAngle) * EDGE;
        // Linger point — near center with slight offset
        const lingerX = CENTER + Math.cos(entryAngle + 0.5) * LINGER_RADIUS;
        const lingerY = CENTER + Math.sin(entryAngle + 0.5) * (LINGER_RADIUS * 0.7);

        if (phase < 12) {
          // Arriving: edge → linger point
          let p = phase / 12;
          p = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          last.x = entryX + (lingerX - entryX) * p;
          last.y = entryY + (lingerY - entryY) * p;
          last.angle = Math.atan2(lingerY - entryY, lingerX - entryX) * (180 / Math.PI);
        } else if (phase < 25) {
          // Lingering: slow drift near center
          const lp = (phase - 12) / 13;
          last.x = lingerX + Math.cos(lp * Math.PI * 2) * (LINGER_RADIUS * 0.5);
          last.y = lingerY + Math.sin(lp * Math.PI * 2) * (LINGER_RADIUS * 0.3);
          last.angle = ((t * 15) % 360);
        } else if (phase < 37) {
          // Departing: linger point → exit edge
          let p = (phase - 25) / 12;
          p = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          last.x = lingerX + (exitX - lingerX) * p;
          last.y = lingerY + (exitY - lingerY) * p;
          last.angle = Math.atan2(exitY - lingerY, exitX - lingerX) * (180 / Math.PI);
        } else {
          // Gone — remove from items
          items.pop();
        }
      }
    }
  }

  if (staleKeys.length > 0) {
    await store.hDel(hashKey, staleKeys);
  }

  return { items };
}

export async function claimPod(
  store: RedisGameStore,
  postId: string,
  body: ClaimPodRequest,
): Promise<ClaimPodResponse> {
  const hashKey = `pods:${postId}`;
  const field = String(body.podId);
  const existing = await store.hGet(hashKey, field);

  if (existing) {
    return { success: true, podId: body.podId, mine: existing === body.username };
  }

  await store.hSet(hashKey, { [field]: body.username });

  // Grant a complete charge for yellow pods
  if (body.isYellow) {
    const chargeKey = `complete_charges:${body.username.toLowerCase()}`;
    const current = parseInt(await store.get(chargeKey) ?? '0', 10);
    await store.set(chargeKey, String(current + 1));
  }

  return { success: true, podId: body.podId, mine: true };
}

export async function getClaimedPods(
  store: RedisGameStore,
  postId: string,
): Promise<ClaimedPodsResponse> {
  const all = await store.hGetAll(`pods:${postId}`);
  return { podIds: Object.keys(all).map((key) => parseInt(key, 10)) };
}

export async function storeShots(
  store: RedisGameStore,
  postId: string,
  body: PostShotsRequest,
  now = Date.now(),
): Promise<void> {
  const hashKey = `shots:${postId}`;
  const value = JSON.stringify({ shots: body.shots, ts: now } satisfies StoredShots);
  await store.hSet(hashKey, { [body.sessionId]: value });
}

export async function listActiveShots(
  store: RedisGameStore,
  params: { postId: string; exclude?: string },
  now = Date.now(),
): Promise<ShotsResponse> {
  const hashKey = `shots:${params.postId}`;
  const all = await store.hGetAll(hashKey);
  const shots: RemoteShotItem[] = [];
  const staleKeys: string[] = [];
  const exclude = params.exclude ?? '';

  for (const [sid, raw] of Object.entries(all)) {
    if (sid === exclude) continue;
    const data = JSON.parse(raw) as StoredShots;
    if (now - data.ts > SHOT_TTL_MS) {
      staleKeys.push(sid);
      continue;
    }
    for (const shot of data.shots) {
      shots.push({ ...shot, shooterId: sid, spawnTime: data.ts / 1000 });
    }
  }

  if (staleKeys.length > 0) {
    await store.hDel(hashKey, staleKeys);
  }

  return { shots };
}

export async function loadProfile(
  store: RedisGameStore,
  username: string,
): Promise<PlayerProfileResponse> {
  const raw = await store.hGetAll(`profile:${username}`);
  const result: PlayerProfileResponse = {
    name: raw.name || '',
  };
  if (raw.lastPosition) {
    try {
      result.lastPosition = JSON.parse(raw.lastPosition);
    } catch { /* ignore bad data */ }
  }
  if (raw.discoveredStars) {
    try {
      result.discoveredStars = JSON.parse(raw.discoveredStars);
    } catch { /* ignore bad data */ }
  }
  if (raw.enhancedProbeStars) {
    try {
      result.enhancedProbeStars = JSON.parse(raw.enhancedProbeStars);
    } catch { /* ignore bad data */ }
  }
  if (raw.journeyDone === '1') {
    result.journeyDone = true;
  }
  return result;
}

export async function loadStarEconomy(
  store: RedisGameStore,
  username: string,
  starIndex: number,
  now = Date.now(),
): Promise<StarEconomyResponse> {
  const economy = await loadEconomyProfile(store, username);
  const key = starKey(starIndex);
  const hadExistingData = key in economy.stars;
  const rich = starRichness(starIndex, economy);
  const base = normalizeStarState(economy.stars[key] ?? {}, now, rich);
  const reconciledBuildings = reconcileStarBuildings(base.buildings, now);
  const reconciledBase: StarEconomyState = {
    ...base,
    buildings: reconciledBuildings,
    rates: computeResourceRatesFromBuildings(reconciledBuildings, base.shieldRaised, rich),
    cap: computeResourceCapFromBuildings(reconciledBuildings),
  };

  // Check for resonance buff (production multiplier)
  const buffsRaw = await store.get(`buffs:${username.toLowerCase()}`);
  const buffs: ActiveBuff[] = buffsRaw ? JSON.parse(buffsRaw) : [];
  const activeBuffs = filterActiveBuffs(buffs, now);
  const rateMult = hasActiveBuff(activeBuffs, 'resonance', now) ? RESONANCE_MULTIPLIER : 1;

  const ticked = tickStarEconomy(reconciledBase, now, rateMult);
  // Only persist economy data if the player already had data at this star (owns it).
  // Prevents phantom economy entries when visiting foreign stars.
  if (hadExistingData) {
    economy.stars[key] = ticked;
    await saveEconomyProfile(store, username, economy);
  }

  // Load complete charges
  const chargeKey = `complete_charges:${username.toLowerCase()}`;
  const charges = parseInt(await store.get(chargeKey) ?? '0', 10);

  return {
    starKey: key,
    starIndex,
    store: ticked.store,
    rates: ticked.rates,
    cap: ticked.cap,
    buildings: ticked.buildings,
    shieldRaised: ticked.shieldRaised,
    defenseScore: computeDefenseScore(ticked.buildings, ticked.shieldRaised),
    lastTickMs: ticked.lastTickMs,
    completeCharges: charges,
    richness: rich,
    ...(activeBuffs.length > 0 ? { buffs: activeBuffs } : {}),
  };
}

/** Debit fuel from a star's economy when a ship refuels at dock. */
export async function refuelShip(
  store: RedisGameStore,
  username: string,
  starIndex: number,
  amount: number,
  now = Date.now(),
): Promise<{ ok: boolean; debited: number }> {
  const economy = await loadEconomyProfile(store, username);
  const key = starKey(starIndex);
  const rich = starRichness(starIndex, economy);
  const base = normalizeStarState(economy.stars[key] ?? {}, now, rich);
  const reconciledBuildings = reconcileStarBuildings(base.buildings, now);
  const ticked = tickStarEconomy({
    ...base,
    buildings: reconciledBuildings,
    rates: computeResourceRatesFromBuildings(reconciledBuildings, base.shieldRaised, rich),
    cap: computeResourceCapFromBuildings(reconciledBuildings),
  }, now);

  const available = ticked.store.fuel;
  const debited = Math.min(amount, available);
  ticked.store.fuel = available - debited;
  economy.stars[key] = ticked;
  await saveEconomyProfile(store, username, economy);
  return { ok: true, debited };
}

export async function toggleShield(
  store: RedisGameStore,
  username: string,
  starIndex: number,
  now = Date.now(),
): Promise<ToggleShieldResponse> {
  const economy = await loadEconomyProfile(store, username);
  const key = starKey(starIndex);
  const rich = starRichness(starIndex, economy);
  const base = normalizeStarState(economy.stars[key] ?? {}, now, rich);
  const reconciledBuildings = reconcileStarBuildings(base.buildings, now);

  if (reconciledBuildings.shield.level < 1) {
    throw new Error('No shield generator built');
  }

  const newShieldRaised = !base.shieldRaised;
  const rates = computeResourceRatesFromBuildings(reconciledBuildings, newShieldRaised, rich);
  const updated: StarEconomyState = {
    ...base,
    buildings: reconciledBuildings,
    shieldRaised: newShieldRaised,
    rates,
    cap: computeResourceCapFromBuildings(reconciledBuildings),
  };
  const ticked = tickStarEconomy(updated, now);
  economy.stars[key] = ticked;
  await saveEconomyProfile(store, username, economy);

  return {
    ok: true,
    shieldRaised: newShieldRaised,
    rates: ticked.rates,
    defenseScore: computeDefenseScore(ticked.buildings, newShieldRaised),
  };
}

export async function startBuildingUpgrade(
  store: RedisGameStore,
  body: BuildBuildingRequest,
  now = Date.now(),
): Promise<BuildBuildingResponse> {
  const economy = await loadEconomyProfile(store, body.username);
  const key = starKey(body.starIndex);
  const rich = starRichness(body.starIndex, economy);
  const base = normalizeStarState(economy.stars[key] ?? {}, now, rich);
  const reconciledBuildings = reconcileStarBuildings(base.buildings, now);
  const current: StarEconomyState = tickStarEconomy({
    ...base,
    buildings: reconciledBuildings,
    rates: computeResourceRatesFromBuildings(reconciledBuildings, false, rich),
    cap: computeResourceCapFromBuildings(reconciledBuildings),
  }, now);

  const building = current.buildings[body.buildType];
  const catalog = BUILDING_CATALOG[body.buildType];
  if (!catalog) {
    throw new Error(`Unknown build type: ${body.buildType}`);
  }
  if (building.status === 'UPGRADING') {
    throw new Error(`${body.buildType} is already upgrading`);
  }
  if (Object.values(current.buildings).some((candidate) => candidate.status === 'UPGRADING')) {
    throw new Error('Another building is already upgrading');
  }
  if (!isBuildUnlocked(current.buildings, body.buildType)) {
    throw new Error(`${body.buildType} is locked`);
  }
  if (building.level >= catalog.maxLevel) {
    throw new Error(`${body.buildType} is already at max level`);
  }

  const targetLevel = getBuildingTargetLevel(current.buildings, body.buildType);
  const cost = getBuildingCost(body.buildType, targetLevel);
  if (!hasEnoughResources(current.store, cost)) {
    throw new Error('Insufficient resources');
  }

  const nextBuildings = normalizeStarBuildings(current.buildings);

  // Check for chrono buff (reduces build time)
  const buffsRaw = await store.get(`buffs:${body.username.toLowerCase()}`);
  const playerBuffs: ActiveBuff[] = buffsRaw ? JSON.parse(buffsRaw) : [];
  const chronoActive = hasActiveBuff(playerBuffs, 'chrono', now);
  const buildMult = chronoActive ? CHRONO_MULTIPLIER : 1;

  nextBuildings[body.buildType] = {
    level: building.level,
    status: 'UPGRADING',
    completeAt: now + getBuildingDurationSeconds(body.buildType, targetLevel) * 1000 * buildMult,
  };
  const nextCap = computeResourceCapFromBuildings(nextBuildings);
  const nextState: StarEconomyState = {
    store: clampStore(subtractResources(current.store, cost), nextCap),
    rates: computeResourceRatesFromBuildings(nextBuildings, current.shieldRaised, rich),
    cap: nextCap,
    buildings: nextBuildings,
    shieldRaised: current.shieldRaised ?? false,
    lastTickMs: now,
  };

  economy.stars[key] = nextState;
  await saveEconomyProfile(store, body.username, economy);

  return {
    ok: true,
    starKey: key,
    starIndex: body.starIndex,
    store: nextState.store,
    rates: nextState.rates,
    cap: nextState.cap,
    buildings: nextState.buildings,
    shieldRaised: nextState.shieldRaised,
    defenseScore: computeDefenseScore(nextState.buildings, nextState.shieldRaised),
    lastTickMs: nextState.lastTickMs,
  };
}

export async function buyBuilding(
  store: RedisGameStore,
  body: BuildBuildingRequest,
  now = Date.now(),
): Promise<BuildBuildingResponse> {
  return startBuildingUpgrade(store, body, now);
}

export async function upgradeBuilding(
  store: RedisGameStore,
  body: BuildBuildingRequest,
  now = Date.now(),
): Promise<BuildBuildingResponse> {
  return startBuildingUpgrade(store, body, now);
}

export async function saveProfile(
  store: RedisGameStore,
  body: SaveProfileRequest,
): Promise<void> {
  const fields: Record<string, string> = {};
  if (body.name !== undefined) fields.name = body.name;
  if (body.lastPosition !== undefined) fields.lastPosition = JSON.stringify(body.lastPosition);
  if (body.discoveredStars !== undefined) fields.discoveredStars = JSON.stringify(body.discoveredStars);
  if (body.enhancedProbeStars !== undefined) fields.enhancedProbeStars = JSON.stringify(body.enhancedProbeStars);
  if (body.journeyDone !== undefined) fields.journeyDone = body.journeyDone ? '1' : '0';
  if (Object.keys(fields).length > 0) {
    await store.hSet(`profile:${body.username}`, fields);
  }
}

// ── Ship Building ─────────────────────────────────────────────────────────────

const SHIPS_FIELD = 'ships';

type StoredShipsProfile = {
  stars: Record<string, {
    ships: StarShipsState;
    building: ShipBuildingState | null;
  }>;
  transits?: ShipTransit[];
  freighterRoutes?: FreighterRoute[];
  raidRoutes?: RaidRoute[];
};

/** Base transit time in seconds; divided by ship speed. */
const BASE_TRANSIT_SECONDS = 300; // speed-7 ≈ 43s, speed-3 ≈ 100s

function parseShipsProfile(raw: string | undefined): StoredShipsProfile {
  if (!raw) return { stars: {} };
  try {
    const parsed = JSON.parse(raw) as StoredShipsProfile;
    if (!parsed || typeof parsed !== 'object' || !parsed.stars) return { stars: {} };
    return parsed;
  } catch {
    return { stars: {} };
  }
}

/** Normalise a star-level entry so legacy / malformed data always has ships[] and building. */
function normalizeStarShipData(
  entry: unknown,
): { ships: StarShipsState; building: ShipBuildingState | null } {
  if (!entry || typeof entry !== 'object') return { ships: [], building: null };
  const e = entry as Record<string, unknown>;
  return {
    ships: Array.isArray(e.ships) ? (e.ships as StarShipsState) : [],
    building: e.building && typeof e.building === 'object' ? (e.building as ShipBuildingState) : null,
  };
}

/** Reconcile any completed ship builds into the fleet. */
function reconcileShipBuilding(
  starData: { ships: StarShipsState; building: ShipBuildingState | null },
  now: number,
): void {
  if (starData.building && starData.building.completeAt <= now) {
    const typeId = starData.building.typeId;
    const existing = starData.ships.find((s) => s.typeId === typeId);
    if (existing) {
      existing.count += 1;
    } else {
      starData.ships.push({ typeId, count: 1 });
    }
    starData.building = null;
  }
}

export async function loadStarShips(
  store: RedisGameStore,
  username: string,
  starIndex: number,
  now = Date.now(),
): Promise<StarShipsResponse> {
  const raw = await store.hGet(`profile:${username}`, SHIPS_FIELD);
  const profile = parseShipsProfile(raw);
  const key = starKey(starIndex);
  const starData = normalizeStarShipData(profile.stars[key]);
  const hadBuilding = !!starData.building;
  reconcileShipBuilding(starData, now);

  // Seed a Scout in-memory ONLY at the player's home star (not at colony destinations etc.)
  const economy = await loadEconomyProfile(store, username);
  if (economy.homeStar === starIndex) {
    const UPGRADE_PATH_IDS = [1, 3, 4, 5, 6, 7];
    const hasUpgradeShip = starData.ships.some(s => s.count > 0 && UPGRADE_PATH_IDS.includes(s.typeId));
    const buildingUpgradeShip = starData.building != null && UPGRADE_PATH_IDS.includes(starData.building.typeId);
    if (!hasUpgradeShip && !buildingUpgradeShip) {
      starData.ships.push({ typeId: 1, count: 1 });
    }
  }
  // Only save if a building completed (minimal, targeted write)
  if (hadBuilding && !starData.building) {
    profile.stars[key] = starData;
    await store.hSet(`profile:${username}`, { [SHIPS_FIELD]: JSON.stringify(profile) });
  }
  return { starIndex, ships: starData.ships, building: starData.building };
}

export async function buyShip(
  store: RedisGameStore,
  body: BuyShipRequest,
  now = Date.now(),
): Promise<BuyShipResponse> {
  const { username, starIndex, shipTypeId } = body;
  const useBlueprint = !!(body as { useBlueprint?: boolean }).useBlueprint;

  const catalog = SHIP_CATALOG[shipTypeId];
  if (!catalog) throw new Error(`Unknown ship type: ${shipTypeId}`);

  // If using blueprint, verify and deduct a charge
  if (useBlueprint) {
    const chargeKey = `complete_charges:${username.toLowerCase()}`;
    const charges = parseInt(await store.get(chargeKey) ?? '0', 10);
    if (charges < 1) throw new Error('No blueprint charges available');
    await store.set(chargeKey, String(charges - 1));
  }

  // Load economy and check dock level
  const economy = await loadEconomyProfile(store, username);
  const key = starKey(starIndex);
  const rich = starRichness(starIndex, economy);
  const base = normalizeStarState(economy.stars[key] ?? {}, now, rich);
  const reconciledBuildings = reconcileStarBuildings(base.buildings, now);
  const current: StarEconomyState = tickStarEconomy({
    ...base,
    buildings: reconciledBuildings,
    rates: computeResourceRatesFromBuildings(reconciledBuildings, false, rich),
    cap: computeResourceCapFromBuildings(reconciledBuildings),
  }, now);

  if (!useBlueprint) {
    const dockLevel = current.buildings.dock.level;
    if (dockLevel < 1) throw new Error('No dock built at this star');
    if (!canBuildShip(shipTypeId, dockLevel)) throw new Error('Dock level too low for this ship type');
  }

  // Check if already building
  const shipsRaw = await store.hGet(`profile:${username}`, SHIPS_FIELD);
  const shipsProfile = parseShipsProfile(shipsRaw);
  const starData = normalizeStarShipData(shipsProfile.stars[key]);
  reconcileShipBuilding(starData, now);

  if (starData.building) throw new Error('Already building a ship at this star');

  if (!useBlueprint) {
    // Check resource cost (single unit)
    if (!hasEnoughResources(current.store, catalog.cost)) throw new Error('Insufficient resources');
    // Deduct resources
    current.store = subtractResources(current.store, catalog.cost);
  }

  current.lastTickMs = now;
  economy.stars[key] = current;
  await saveEconomyProfile(store, username, economy);

  // Start building (instant if blueprint, chrono buff halves time)
  let buildDurationMs = catalog.buildSeconds * 1000;
  if (!useBlueprint) {
    const buffsRaw = await store.get(`buffs:${username.toLowerCase()}`);
    const playerBuffs: ActiveBuff[] = buffsRaw ? JSON.parse(buffsRaw) : [];
    if (hasActiveBuff(playerBuffs, 'chrono', now)) {
      buildDurationMs = Math.round(buildDurationMs * CHRONO_MULTIPLIER);
    }
  }
  const completeAt = useBlueprint ? now : now + buildDurationMs;
  starData.building = { typeId: shipTypeId, completeAt };
  shipsProfile.stars[key] = starData;
  await store.hSet(`profile:${username}`, { [SHIPS_FIELD]: JSON.stringify(shipsProfile) });

  return { ok: true, ships: starData.ships, building: starData.building, store: current.store };
}

export async function upgradeShip(
  store: RedisGameStore,
  body: UpgradeShipRequest,
  now = Date.now(),
): Promise<UpgradeShipResponse> {
  const { username, starIndex, fromTypeId } = body;
  const useBlueprint = !!(body as { useBlueprint?: boolean }).useBlueprint;

  // Validate upgrade path
  const targetId = getUpgradeTarget(fromTypeId);
  if (!targetId) throw new Error(`No upgrade available for ship type ${fromTypeId}`);

  const targetCatalog = SHIP_CATALOG[targetId];
  if (!targetCatalog) throw new Error(`Unknown target ship type: ${targetId}`);

  // If using blueprint, verify and deduct a charge
  if (useBlueprint) {
    const chargeKey = `complete_charges:${username.toLowerCase()}`;
    const charges = parseInt(await store.get(chargeKey) ?? '0', 10);
    if (charges < 1) throw new Error('No blueprint charges available');
    await store.set(chargeKey, String(charges - 1));
  }

  // Load economy and check dock level
  const economy = await loadEconomyProfile(store, username);
  const key = starKey(starIndex);
  const rich = starRichness(starIndex, economy);
  const base = normalizeStarState(economy.stars[key] ?? {}, now, rich);
  const reconciledBuildings = reconcileStarBuildings(base.buildings, now);
  const current: StarEconomyState = tickStarEconomy({
    ...base,
    buildings: reconciledBuildings,
    rates: computeResourceRatesFromBuildings(reconciledBuildings, false, rich),
    cap: computeResourceCapFromBuildings(reconciledBuildings),
  }, now);

  if (!useBlueprint) {
    const dockLevel = current.buildings.dock.level;
    if (dockLevel < 1) throw new Error('No dock built at this star');
    if (!canUpgradeShip(fromTypeId, dockLevel)) throw new Error('Dock level too low for this upgrade');
  }

  // Load ships and check ownership
  const shipsRaw = await store.hGet(`profile:${username}`, SHIPS_FIELD);
  const shipsProfile = parseShipsProfile(shipsRaw);
  const starData = normalizeStarShipData(shipsProfile.stars[key]);
  reconcileShipBuilding(starData, now);

  if (starData.building) throw new Error('Already building a ship at this star');

  // Check player owns at least one of the source ship
  const sourceSlot = starData.ships.find((s) => s.typeId === fromTypeId);
  if (!sourceSlot || sourceSlot.count < 1) throw new Error('You do not own this ship type at this star');

  if (!useBlueprint) {
    // Check resource cost
    if (!hasEnoughResources(current.store, targetCatalog.cost)) throw new Error('Insufficient resources');
    // Deduct resources
    current.store = subtractResources(current.store, targetCatalog.cost);
  }

  current.lastTickMs = now;
  economy.stars[key] = current;
  await saveEconomyProfile(store, username, economy);

  // Remove one of the source ship
  sourceSlot.count -= 1;
  starData.ships = starData.ships.filter((s) => s.count > 0);

  // Start building the upgraded ship (instant if blueprint)
  const completeAt = useBlueprint ? now : now + targetCatalog.buildSeconds * 1000;
  starData.building = { typeId: targetId, completeAt };
  shipsProfile.stars[key] = starData;
  await store.hSet(`profile:${username}`, { [SHIPS_FIELD]: JSON.stringify(shipsProfile) });

  return { ok: true, ships: starData.ships, building: starData.building, store: current.store };
}

// ── Fleet Management ──────────────────────────────────────────────────────────

/** Load all ships across all stars for a player. */
export async function loadAllFleet(
  store: RedisGameStore,
  username: string,
  now = Date.now(),
): Promise<FleetAllResponse> {
  const raw = await store.hGet(`profile:${username}`, SHIPS_FIELD);
  const profile = parseShipsProfile(raw);
  let dirty = false;

  // Track stars newly discovered by probe arrival
  const PROBE_TYPE_IDS = [11, 12]; // Basic Probe, Enhanced Probe
  const ENHANCED_PROBE_ID = 12;
  const newlyDiscovered: number[] = [];
  const newlyEnhanced: number[] = [];

  // ── Reconcile completed transits ──
  const pendingTransits: ShipTransit[] = [];
  if (profile.transits && profile.transits.length > 0) {
    for (const t of profile.transits) {
      if (t.arrivalAt <= now) {
        // Transit complete — deliver ships to destination
        const toKey = starKey(t.toStarIndex);
        const toData = normalizeStarShipData(profile.stars[toKey]);
        // If a probe arrived, mark the star as discovered but consume the probe
        if (PROBE_TYPE_IDS.includes(t.shipTypeId)) {
          newlyDiscovered.push(t.toStarIndex);
          if (t.shipTypeId === ENHANCED_PROBE_ID) {
            newlyEnhanced.push(t.toStarIndex);
          }
        } else {
          // Non-probe ships: add to destination fleet
          const destSlot = toData.ships.find((s) => s.typeId === t.shipTypeId);
          if (destSlot) {
            destSlot.count += t.count;
          } else {
            toData.ships.push({ typeId: t.shipTypeId, count: t.count });
          }
        }
        profile.stars[toKey] = toData;
        dirty = true;
      } else {
        pendingTransits.push(t);
      }
    }
    if (dirty) {
      profile.transits = pendingTransits;
    }
  }

  const result: FleetAllResponse['stars'] = {};
  for (const [key, entry] of Object.entries(profile.stars)) {
    const starData = normalizeStarShipData(entry);
    const hadBuilding = !!starData.building;
    reconcileShipBuilding(starData, now);
    if (hadBuilding && !starData.building) dirty = true;
    if (starData.ships.length > 0 || starData.building) {
      result[key] = { ships: starData.ships, building: starData.building };
    }
  }

  if (dirty) {
    // Persist reconciled builds + transits
    for (const [key, val] of Object.entries(result)) {
      profile.stars[key] = val;
    }
    await store.hSet(`profile:${username}`, { [SHIPS_FIELD]: JSON.stringify(profile) });

    // If probes arrived, update discoveredStars on the profile
    if (newlyDiscovered.length > 0) {
      const profileKey = `profile:${username}`;
      let existing: number[] = [];
      try {
        const dsRaw = await store.hGet(profileKey, 'discoveredStars');
        if (dsRaw) existing = JSON.parse(dsRaw);
      } catch { /* ignore */ }
      const merged = [...new Set([...existing, ...newlyDiscovered])];
      await store.hSet(profileKey, { discoveredStars: JSON.stringify(merged) });
    }
    // If enhanced probes arrived, update enhancedProbeStars on the profile
    if (newlyEnhanced.length > 0) {
      const profileKey = `profile:${username}`;
      let existing: number[] = [];
      try {
        const epRaw = await store.hGet(profileKey, 'enhancedProbeStars');
        if (epRaw) existing = JSON.parse(epRaw);
      } catch { /* ignore */ }
      const merged = [...new Set([...existing, ...newlyEnhanced])];
      await store.hSet(profileKey, { enhancedProbeStars: JSON.stringify(merged) });
    }
  }

  // ── Reconcile freighter routes ──
  const activeRoutes: FreighterRoute[] = [];
  let routesDirty = false;
  if (profile.freighterRoutes && profile.freighterRoutes.length > 0) {
    for (const route of profile.freighterRoutes) {
      if (route.arrivalAt <= now) {
        // A leg completed
        if (route.leg === 'outbound') {
          // Arrived at pickup star — load cargo from target star's economy
          const economy = await loadEconomyProfile(store, username);
          const tKey = starKey(route.targetStarIndex);
          const targetStar = normalizeStarState(economy.stars[tKey] ?? {}, now, starRichness(route.targetStarIndex, economy));
          const ticked = tickStarEconomy(targetStar, now);
          const capacity = SHIP_CATALOG[2].transport; // 500

          const cargo: ResourceStore = {
            ore: Math.min(ticked.store.ore, capacity),
            food: Math.min(ticked.store.food, capacity),
            energy: Math.min(ticked.store.energy, capacity),
            fuel: Math.min(ticked.store.fuel ?? 0, capacity),
          };
          // Deduct from target star
          ticked.store.ore -= cargo.ore;
          ticked.store.food -= cargo.food;
          ticked.store.energy -= cargo.energy;
          ticked.store.fuel = (ticked.store.fuel ?? 0) - cargo.fuel;
          economy.stars[tKey] = ticked;
          await saveEconomyProfile(store, username, economy);

          // Start return leg with cargo
          const speed = SHIP_CATALOG[2].speed;
          const transitMs = Math.round((BASE_TRANSIT_SECONDS / speed) * 1000);
          route.cargo = cargo;
          route.leg = 'return';
          route.departedAt = now;
          route.arrivalAt = now + transitMs;
          activeRoutes.push(route);
          routesDirty = true;
        } else {
          // Return leg complete — deliver cargo to home star's economy
          const economy = await loadEconomyProfile(store, username);
          const hKey = starKey(route.homeStarIndex);
          const homeStar = normalizeStarState(economy.stars[hKey] ?? {}, now, starRichness(route.homeStarIndex, economy));
          const ticked = tickStarEconomy(homeStar, now);
          ticked.store.ore = Math.min(ticked.cap, ticked.store.ore + route.cargo.ore);
          ticked.store.food = Math.min(ticked.cap, ticked.store.food + route.cargo.food);
          ticked.store.energy = Math.min(ticked.cap, ticked.store.energy + route.cargo.energy);
          ticked.store.fuel = Math.min(ticked.cap, (ticked.store.fuel ?? 0) + (route.cargo.fuel ?? 0));
          economy.stars[hKey] = ticked;
          await saveEconomyProfile(store, username, economy);

          // Start next outbound leg (empty cargo)
          const speed = SHIP_CATALOG[2].speed;
          const transitMs = Math.round((BASE_TRANSIT_SECONDS / speed) * 1000);
          route.cargo = { ore: 0, food: 0, energy: 0, fuel: 0 };
          route.leg = 'outbound';
          route.departedAt = now;
          route.arrivalAt = now + transitMs;
          activeRoutes.push(route);
          routesDirty = true;
        }
      } else {
        activeRoutes.push(route);
      }
    }
  }

  if (routesDirty) {
    profile.freighterRoutes = activeRoutes;
    await store.hSet(`profile:${username}`, { [SHIPS_FIELD]: JSON.stringify(profile) });
  }

  // ── Reconcile raid routes ──
  const raidResult = await reconcileRaidRoutes(store, username, profile, now);
  if (raidResult.dirty) {
    profile.raidRoutes = raidResult.activeRoutes;
    await store.hSet(`profile:${username}`, { [SHIPS_FIELD]: JSON.stringify(profile) });
  }
  const activeRaidRoutes = raidResult.activeRoutes;

  // Load discovered stars list to send to client
  let discoveredStars: number[] = [];
  let enhancedProbeStars: number[] = [];
  try {
    const dsRaw = await store.hGet(`profile:${username}`, 'discoveredStars');
    if (dsRaw) discoveredStars = JSON.parse(dsRaw);
    const epRaw = await store.hGet(`profile:${username}`, 'enhancedProbeStars');
    if (epRaw) enhancedProbeStars = JSON.parse(epRaw);
  } catch { /* ignore */ }

  // ── Alliance map sharing: merge discovered stars from all alliance members ──
  try {
    const allianceIdRaw = await store.get(`player_alliance:${username.toLowerCase()}`);
    if (allianceIdRaw) {
      const allianceDataRaw = await store.get(`alliance:${allianceIdRaw}`);
      if (allianceDataRaw) {
        const alliance = JSON.parse(allianceDataRaw) as { members: string[] };
        const allDiscovered = new Set(discoveredStars);
        const allEnhanced = new Set(enhancedProbeStars);
        for (const member of alliance.members) {
          if (member === username) continue;
          const memberDs = await store.hGet(`profile:${member}`, 'discoveredStars');
          if (memberDs) {
            try {
              const stars = JSON.parse(memberDs) as number[];
              for (const s of stars) allDiscovered.add(s);
            } catch { /* ignore */ }
          }
          const memberEp = await store.hGet(`profile:${member}`, 'enhancedProbeStars');
          if (memberEp) {
            try {
              const stars = JSON.parse(memberEp) as number[];
              for (const s of stars) allEnhanced.add(s);
            } catch { /* ignore */ }
          }
        }
        discoveredStars = [...allDiscovered];
        enhancedProbeStars = [...allEnhanced];
      }
    }
  } catch { /* alliance sharing is best-effort */ }

  return { stars: result, transits: pendingTransits, freighterRoutes: activeRoutes, raidRoutes: activeRaidRoutes, discoveredStars, enhancedProbeStars };
}

/** Transfer ships from one star to another (creates in-transit record). */
export async function transferShips(
  store: RedisGameStore,
  username: string,
  fromStarIndex: number,
  toStarIndex: number,
  shipTypeId: ShipTypeId,
  count: number,
  now = Date.now(),
): Promise<FleetTransferResponse> {
  if (count < 1) throw new Error('count must be >= 1');
  if (fromStarIndex === toStarIndex) throw new Error('Cannot transfer to same star');

  // Probes (11=Basic, 12=Enhanced) deduct fuel from the source star's economy store
  // Check fuel BEFORE removing the ship from the source fleet
  const PROBE_FUEL_COST = 500;
  let fuelCost = 0;
  if (shipTypeId === 11 || shipTypeId === 12) {
    const economy = await loadEconomyProfile(store, username);
    const econKey = starKey(fromStarIndex);
    const rich = starRichness(fromStarIndex, economy);
    const base = normalizeStarState(economy.stars[econKey] ?? {}, now, rich);
    const reconciledBuildings = reconcileStarBuildings(base.buildings, now);
    const ticked = tickStarEconomy({
      ...base,
      buildings: reconciledBuildings,
      rates: computeResourceRatesFromBuildings(reconciledBuildings, base.shieldRaised, rich),
      cap: computeResourceCapFromBuildings(reconciledBuildings),
    }, now);
    if (ticked.store.fuel < PROBE_FUEL_COST) {
      throw new Error(`Not enough fuel (need ${PROBE_FUEL_COST}, have ${Math.floor(ticked.store.fuel)})`);
    }
    ticked.store.fuel -= PROBE_FUEL_COST;
    fuelCost = PROBE_FUEL_COST;
    economy.stars[econKey] = ticked;
    await saveEconomyProfile(store, username, economy);
  }

  const raw = await store.hGet(`profile:${username}`, SHIPS_FIELD);
  const profile = parseShipsProfile(raw);

  const fromKey = starKey(fromStarIndex);

  const fromData = normalizeStarShipData(profile.stars[fromKey]);
  reconcileShipBuilding(fromData, now);

  // Check source has enough ships
  const sourceSlot = fromData.ships.find((s) => s.typeId === shipTypeId);
  if (!sourceSlot || sourceSlot.count < count) {
    throw new Error('Not enough ships at source star');
  }

  // Remove from source
  sourceSlot.count -= count;
  fromData.ships = fromData.ships.filter((s) => s.count > 0);

  // Calculate transit duration from ship speed
  const catalogEntry = SHIP_CATALOG[shipTypeId as keyof typeof SHIP_CATALOG];
  const speed = catalogEntry?.speed ?? 5;
  let transitMs = Math.round((BASE_TRANSIT_SECONDS / speed) * 1000);

  // Check for hyperdrive buff (faster transit)
  const buffsRaw = await store.get(`buffs:${username.toLowerCase()}`);
  const playerBuffs: ActiveBuff[] = buffsRaw ? JSON.parse(buffsRaw) : [];
  if (hasActiveBuff(playerBuffs, 'hyperdrive', now)) {
    transitMs = Math.round(transitMs * HYPERDRIVE_MULTIPLIER);
  }

  // Create transit record
  const transit: ShipTransit = {
    shipTypeId,
    count,
    fromStarIndex,
    toStarIndex,
    departedAt: now,
    arrivalAt: now + transitMs,
  };

  // Save
  profile.stars[fromKey] = fromData;
  if (!profile.transits) profile.transits = [];
  profile.transits.push(transit);
  await store.hSet(`profile:${username}`, { [SHIPS_FIELD]: JSON.stringify(profile) });

  return {
    ok: true,
    from: { starIndex: fromStarIndex, ships: fromData.ships },
    transit,
    ...(fuelCost > 0 ? { fuelCost } : {}),
  };
}

// ── Freighter Trade Routes ────────────────────────────────────────────────────

const FREIGHTER_TYPE_ID: ShipTypeId = 2;

/** Assign a freighter to a persistent trade route between two owned stars. */
export async function assignFreighterRoute(
  store: RedisGameStore,
  username: string,
  homeStarIndex: number,
  targetStarIndex: number,
  now = Date.now(),
): Promise<FreighterRouteResponse> {
  if (homeStarIndex === targetStarIndex) throw new Error('Cannot route to same star');

  const raw = await store.hGet(`profile:${username}`, SHIPS_FIELD);
  const profile = parseShipsProfile(raw);

  const homeKey = starKey(homeStarIndex);
  const homeData = normalizeStarShipData(profile.stars[homeKey]);
  reconcileShipBuilding(homeData, now);

  // Check player has a freighter at the home star
  const freighterSlot = homeData.ships.find((s) => s.typeId === FREIGHTER_TYPE_ID);
  if (!freighterSlot || freighterSlot.count < 1) {
    throw new Error('No Freighter at this star');
  }

  // Remove one freighter from the home star fleet
  freighterSlot.count -= 1;
  homeData.ships = homeData.ships.filter((s) => s.count > 0);

  // Calculate outbound transit time
  const speed = SHIP_CATALOG[FREIGHTER_TYPE_ID].speed;
  const transitMs = Math.round((BASE_TRANSIT_SECONDS / speed) * 1000);

  const route: FreighterRoute = {
    id: `fr_${now}_${Math.random().toString(36).slice(2, 8)}`,
    homeStarIndex,
    targetStarIndex,
    cargo: { ore: 0, food: 0, energy: 0, fuel: 0 },
    departedAt: now,
    arrivalAt: now + transitMs,
    leg: 'outbound',
  };

  profile.stars[homeKey] = homeData;
  if (!profile.freighterRoutes) profile.freighterRoutes = [];
  profile.freighterRoutes.push(route);
  await store.hSet(`profile:${username}`, { [SHIPS_FIELD]: JSON.stringify(profile) });

  return { ok: true, route };
}

/** Cancel a freighter trade route — return the freighter to the home star. */
export async function cancelFreighterRoute(
  store: RedisGameStore,
  username: string,
  routeId: string,
  now = Date.now(),
): Promise<{ ok: true }> {
  const raw = await store.hGet(`profile:${username}`, SHIPS_FIELD);
  const profile = parseShipsProfile(raw);

  if (!profile.freighterRoutes) throw new Error('No freighter routes');
  const idx = profile.freighterRoutes.findIndex((r) => r.id === routeId);
  if (idx < 0) throw new Error('Route not found');

  const route = profile.freighterRoutes[idx]!;
  profile.freighterRoutes.splice(idx, 1);

  // Return freighter to home star
  const homeKey = starKey(route.homeStarIndex);
  const homeData = normalizeStarShipData(profile.stars[homeKey]);
  const slot = homeData.ships.find((s) => s.typeId === FREIGHTER_TYPE_ID);
  if (slot) {
    slot.count += 1;
  } else {
    homeData.ships.push({ typeId: FREIGHTER_TYPE_ID, count: 1 });
  }

  // If the freighter was returning with cargo, deliver it to home star
  if (route.leg === 'return' && (route.cargo.ore > 0 || route.cargo.food > 0 || route.cargo.energy > 0 || (route.cargo.fuel ?? 0) > 0)) {
    const economy = await loadEconomyProfile(store, username);
    const hKey = starKey(route.homeStarIndex);
    const homeStar = normalizeStarState(economy.stars[hKey] ?? {}, now, starRichness(route.homeStarIndex, economy));
    const ticked = tickStarEconomy(homeStar, now);
    ticked.store.ore = Math.min(ticked.cap, ticked.store.ore + route.cargo.ore);
    ticked.store.food = Math.min(ticked.cap, ticked.store.food + route.cargo.food);
    ticked.store.energy = Math.min(ticked.cap, ticked.store.energy + route.cargo.energy);
    ticked.store.fuel = Math.min(ticked.cap, (ticked.store.fuel ?? 0) + (route.cargo.fuel ?? 0));
    economy.stars[hKey] = ticked;
    await saveEconomyProfile(store, username, economy);
  }

  profile.stars[homeKey] = homeData;
  await store.hSet(`profile:${username}`, { [SHIPS_FIELD]: JSON.stringify(profile) });

  return { ok: true };
}

// ── Raid Routes ─────────────────────────────────────────────────────────────

const RAIDER_TYPE_ID: ShipTypeId = 15 as ShipTypeId;
const RAIDER_BASE_POWER = 40; // per raider (matches offense stat)

/** Dispatch a Raider to an enemy star. One-shot: outbound → raid → return or destroyed. */
export async function assignRaidRoute(
  store: RedisGameStore,
  username: string,
  homeStarIndex: number,
  targetStarIndex: number,
  now = Date.now(),
): Promise<RaidRouteResponse> {
  if (homeStarIndex === targetStarIndex) throw new Error('Cannot raid own star');

  const raw = await store.hGet(`profile:${username}`, SHIPS_FIELD);
  const profile = parseShipsProfile(raw);

  const homeKey = starKey(homeStarIndex);
  const homeData = normalizeStarShipData(profile.stars[homeKey]);
  reconcileShipBuilding(homeData, now);

  // Check player has a Raider at the home star
  const raiderSlot = homeData.ships.find((s) => s.typeId === RAIDER_TYPE_ID);
  if (!raiderSlot || raiderSlot.count < 1) {
    throw new Error('No Raider at this star');
  }

  // Remove one Raider from the home star fleet
  raiderSlot.count -= 1;
  homeData.ships = homeData.ships.filter((s) => s.count > 0);

  // Calculate outbound transit time
  const speed = SHIP_CATALOG[RAIDER_TYPE_ID].speed;
  const transitMs = Math.round((BASE_TRANSIT_SECONDS / speed) * 1000);

  // Compute success chance at dispatch time so client can display risk
  const targetDefense = await getStarDefenseScore(store, targetStarIndex);
  const successChance = targetDefense > 0
    ? RAIDER_BASE_POWER / (RAIDER_BASE_POWER + targetDefense)
    : 1.0;

  const route: RaidRoute = {
    id: `rd_${now}_${Math.random().toString(36).slice(2, 8)}`,
    homeStarIndex,
    targetStarIndex,
    cargo: { ore: 0, food: 0, energy: 0, fuel: 0 },
    departedAt: now,
    arrivalAt: now + transitMs,
    leg: 'outbound',
    status: 'in-transit',
    successChance,
  };

  profile.stars[homeKey] = homeData;
  if (!profile.raidRoutes) profile.raidRoutes = [];
  profile.raidRoutes.push(route);
  await store.hSet(`profile:${username}`, { [SHIPS_FIELD]: JSON.stringify(profile) });

  return { ok: true, route };
}

/**
 * Reconcile raid routes that have arrived. Called from loadAllFleet.
 * - Outbound arrival: resolve combat vs target star defense score.
 *   Success → steal resources, start return leg.
 *   Failure → raider destroyed, route removed.
 * - Return arrival: deliver cargo to home star, return raider to fleet.
 */
async function reconcileRaidRoutes(
  store: RedisGameStore,
  username: string,
  profile: { raidRoutes?: RaidRoute[]; stars: Record<string, unknown> },
  now: number,
): Promise<{ activeRoutes: RaidRoute[]; dirty: boolean }> {
  const activeRoutes: RaidRoute[] = [];
  let dirty = false;

  if (!profile.raidRoutes || profile.raidRoutes.length === 0) {
    return { activeRoutes: [], dirty: false };
  }

  for (const route of profile.raidRoutes) {
    if (route.arrivalAt > now) {
      activeRoutes.push(route);
      continue;
    }

    dirty = true;

    if (route.leg === 'outbound') {
      // Push sensor alert to the target star owner
      const targetOwner = await findStarOwner(store, route.targetStarIndex);
      if (targetOwner && targetOwner !== username) {
        await pushSensorAlert(store, targetOwner, {
          type: 'raider',
          starIndex: route.targetStarIndex,
          from: username,
          ts: now,
        });
      }

      // Resolve raid at target star
      const targetDefense = await getStarDefenseScore(store, route.targetStarIndex);

      // Combat resolution: raider power vs defense
      const raiderPower = RAIDER_BASE_POWER;
      const successChance = targetDefense > 0
        ? raiderPower / (raiderPower + targetDefense)
        : 1.0; // No defenses = guaranteed success

      // Deterministic roll based on route id
      const roll = (parseInt(route.id.slice(-6), 36) % 100) / 100;
      const success = roll < successChance;

      if (success) {
        // Steal resources from target star's owner
        const stolen = await stealFromStar(store, route.targetStarIndex, SHIP_CATALOG[RAIDER_TYPE_ID].transport, now);

        // Start return leg with stolen cargo
        const speed = SHIP_CATALOG[RAIDER_TYPE_ID].speed;
        const transitMs = Math.round((BASE_TRANSIT_SECONDS / speed) * 1000);
        route.cargo = stolen;
        route.leg = 'return';
        route.departedAt = now;
        route.arrivalAt = now + transitMs;
        route.status = 'success';
        activeRoutes.push(route);
      } else {
        // Raider destroyed — route removed
        route.status = 'destroyed';
      }
    } else {
      // Return leg complete — deliver cargo to home star + return raider to fleet
      const economy = await loadEconomyProfile(store, username);
      const hKey = starKey(route.homeStarIndex);
      const homeStar = normalizeStarState(economy.stars[hKey] ?? {}, now, starRichness(route.homeStarIndex, economy));
      const ticked = tickStarEconomy(homeStar, now);
      ticked.store.ore = Math.min(ticked.cap, ticked.store.ore + route.cargo.ore);
      ticked.store.food = Math.min(ticked.cap, ticked.store.food + route.cargo.food);
      ticked.store.energy = Math.min(ticked.cap, ticked.store.energy + route.cargo.energy);
      ticked.store.fuel = Math.min(ticked.cap, (ticked.store.fuel ?? 0) + (route.cargo.fuel ?? 0));
      economy.stars[hKey] = ticked;
      await saveEconomyProfile(store, username, economy);

      // Return raider to home star fleet
      const homeKey = starKey(route.homeStarIndex);
      const homeData = normalizeStarShipData(profile.stars[homeKey]);
      const slot = homeData.ships.find((s) => s.typeId === RAIDER_TYPE_ID);
      if (slot) {
        slot.count += 1;
      } else {
        homeData.ships.push({ typeId: RAIDER_TYPE_ID, count: 1 });
      }
      profile.stars[homeKey] = homeData;
    }
  }

  return { activeRoutes, dirty };
}

/** Get the defense score of whatever player owns a star. Returns 0 if unowned/no defenses. */
async function getStarDefenseScore(store: RedisGameStore, starIndex: number): Promise<number> {
  const claimsRaw = await store.hGetAll('star_claims');
  let owner: string | null = null;
  for (const [, val] of Object.entries(claimsRaw)) {
    try {
      const claims = JSON.parse(val) as Array<{ starIndex: number; username: string }>;
      const match = claims.find((c) => c.starIndex === starIndex);
      if (match) { owner = match.username; break; }
    } catch {
      try {
        const claim = JSON.parse(val) as { starIndex: number; username: string };
        if (claim.starIndex === starIndex) { owner = claim.username; break; }
      } catch { /* skip */ }
    }
  }
  if (!owner) return 0;

  const economy = await loadEconomyProfile(store, owner);
  const sKey = starKey(starIndex);
  const starState = economy.stars[sKey];
  if (!starState) return 0;

  const normalized = normalizeStarState(starState, Date.now(), starRichness(starIndex, economy));
  return computeDefenseScore(normalized.buildings, normalized.shieldRaised).total;
}

/** Find the owner username of a star (null if unclaimed). */
async function findStarOwner(store: RedisGameStore, starIndex: number): Promise<string | null> {
  const claimsRaw = await store.hGetAll('star_claims');
  for (const [, val] of Object.entries(claimsRaw)) {
    try {
      const claims = JSON.parse(val) as Array<{ starIndex: number; username: string }>;
      const match = claims.find((c) => c.starIndex === starIndex);
      if (match) return match.username;
    } catch {
      try {
        const claim = JSON.parse(val) as { starIndex: number; username: string };
        if (claim.starIndex === starIndex) return claim.username;
      } catch { /* skip */ }
    }
  }
  return null;
}

/** Steal resources from whoever owns a star (deducted from their economy). */
async function stealFromStar(
  store: RedisGameStore,
  starIndex: number,
  capacity: number,
  now: number,
): Promise<ResourceStore> {
  const claimsRaw = await store.hGetAll('star_claims');
  let owner: string | null = null;
  for (const [, val] of Object.entries(claimsRaw)) {
    try {
      const claims = JSON.parse(val) as Array<{ starIndex: number; username: string }>;
      const match = claims.find((c) => c.starIndex === starIndex);
      if (match) { owner = match.username; break; }
    } catch {
      try {
        const claim = JSON.parse(val) as { starIndex: number; username: string };
        if (claim.starIndex === starIndex) { owner = claim.username; break; }
      } catch { /* skip */ }
    }
  }
  if (!owner) return { ore: 0, food: 0, energy: 0, fuel: 0 };

  const economy = await loadEconomyProfile(store, owner);
  const sKey = starKey(starIndex);
  const starState = normalizeStarState(economy.stars[sKey] ?? {}, now, starRichness(starIndex, economy));
  const ticked = tickStarEconomy(starState, now);

  // Steal up to capacity split evenly across resources
  const perResource = Math.floor(capacity / 3);
  const cargo: ResourceStore = {
    ore: Math.min(ticked.store.ore, perResource),
    food: Math.min(ticked.store.food, perResource),
    energy: Math.min(ticked.store.energy, perResource),
    fuel: Math.min(ticked.store.fuel ?? 0, perResource),
  };
  ticked.store.ore -= cargo.ore;
  ticked.store.food -= cargo.food;
  ticked.store.energy -= cargo.energy;
  ticked.store.fuel = (ticked.store.fuel ?? 0) - cargo.fuel;
  economy.stars[sKey] = ticked;
  await saveEconomyProfile(store, owner, economy);

  return cargo;
}

/**
 * Debug: instantly complete all in-progress builds (buildings + ships) at a star.
 */
export async function completeAllBuilds(
  store: RedisGameStore,
  username: string,
  starIndex: number,
  now = Date.now(),
): Promise<{ ok: true }> {
  const key = starKey(starIndex);

  // Complete building upgrades
  const economy = await loadEconomyProfile(store, username);
  const rich = starRichness(starIndex, economy);
  const base = normalizeStarState(economy.stars[key] ?? {}, now, rich);
  for (const type of Object.keys(base.buildings) as Array<keyof typeof base.buildings>) {
    const b = base.buildings[type];
    if (b.status === 'UPGRADING' && b.completeAt != null && b.completeAt > now) {
      b.completeAt = now;
    }
  }

  // Fill resources to cap
  base.store = { ore: base.cap, food: base.cap, energy: base.cap, fuel: base.cap };

  {
    const reconciledBuildings = reconcileStarBuildings(base.buildings, now);
    const next: StarEconomyState = tickStarEconomy({
      ...base,
      buildings: reconciledBuildings,
      rates: computeResourceRatesFromBuildings(reconciledBuildings, false, rich),
      cap: computeResourceCapFromBuildings(reconciledBuildings),
    }, now);
    economy.stars[key] = next;
    await saveEconomyProfile(store, username, economy);
  }

  // Complete ship builds
  const shipsRaw = await store.hGet(`profile:${username}`, SHIPS_FIELD);
  const shipsProfile = parseShipsProfile(shipsRaw);
  const starData = normalizeStarShipData(shipsProfile.stars[key]);
  if (starData.building && starData.building.completeAt > now) {
    starData.building.completeAt = now;
    reconcileShipBuilding(starData, now);
    shipsProfile.stars[key] = starData;
    await store.hSet(`profile:${username}`, { [SHIPS_FIELD]: JSON.stringify(shipsProfile) });
  }

  return { ok: true };
}

// ── Star Claim Registry ─────────────────────────────────────────────────────

import { generateStarPositions, getDefaultHomeStarIndex, pickNextHomeStar } from '../../shared/galaxy-positions';

export type StarClaimResponse = {
  homeStar: number;
  claimed: Array<{ starIndex: number; username: string; bodyIndex?: number }>;
};

/**
 * Claim or retrieve a user's home star for a post.
 * First user gets center star; subsequent users spiral outward.
 * Migrates existing players: if they have economy data at a star, claim that star.
 */
export async function claimHomeStar(
  store: RedisGameStore,
  postId: string,
  username: string,
): Promise<StarClaimResponse> {
  const registryKey = `stars:${postId}`;
  const allClaims = await store.hGetAll(registryKey);

  console.log(`[CLAIM] claimHomeStar user=${username} postId=${postId} registryKey=${registryKey} existingClaims=${JSON.stringify(allClaims)}`);

  // Check if user already has a claim
  for (const [key, owner] of Object.entries(allClaims)) {
    if (owner.split(':')[0] === username) {
      const starIndex = parseInt(key.replace('s:', ''), 10);
      const claimed = Object.entries(allClaims).map(([k, v]) => {
        const parts = v.split(':');
        const bi = parts.length > 1 ? parseInt(parts[1]!, 10) : undefined;
        return {
          starIndex: parseInt(k.replace('s:', ''), 10),
          username: parts[0]!,
          ...(bi != null && !isNaN(bi) ? { bodyIndex: bi } : {}),
        };
      });
      console.log(`[CLAIM] user=${username} already has claim at star ${starIndex}`);
      return { homeStar: starIndex, claimed };
    }
  }

  // Migration: check if user already has economy data at any star
  const economy = await loadEconomyProfile(store, username);
  const existingStarKeys = Object.keys(economy.stars); // e.g. ["s:47"]
  let migratedStarIndex: number | null = null;
  if (existingStarKeys.length > 0) {
    // Pick the star with the most developed buildings that isn't already claimed by someone else
    let bestLevel = -1;
    for (const sk of existingStarKeys) {
      const idx = parseInt(sk.replace('s:', ''), 10);
      if (Number.isNaN(idx)) continue;
      // Skip if already claimed by another player
      const claimOwner = allClaims[`s:${idx}`]?.split(':')[0];
      if (claimOwner && claimOwner !== username) continue;
      const starData = economy.stars[sk];
      if (!starData?.buildings) continue;
      const totalLevel = Object.values(starData.buildings).reduce(
        (sum, b) => sum + ((b as { level?: number }).level ?? 0), 0,
      );
      if (totalLevel > bestLevel) {
        bestLevel = totalLevel;
        migratedStarIndex = idx;
      }
    }
    console.log(`[CLAIM] user=${username} migration: existingStarKeys=${existingStarKeys.join(',')} migratedStarIndex=${migratedStarIndex}`);
  }

  const stars = generateStarPositions(postId);
  const claimedIndices = Object.keys(allClaims).map((k) => parseInt(k.replace('s:', ''), 10));

  let newStarIndex: number;
  let pickMethod: string;
  if (migratedStarIndex != null) {
    newStarIndex = migratedStarIndex;
    pickMethod = 'migration';
  } else if (claimedIndices.length === 0) {
    newStarIndex = getDefaultHomeStarIndex(stars);
    pickMethod = 'default (no claims seen)';
  } else {
    newStarIndex = pickNextHomeStar(stars, claimedIndices);
    pickMethod = `pickNext (excluded=${claimedIndices.join(',')})`;
  }

  console.log(`[CLAIM] user=${username} picked star ${newStarIndex} via ${pickMethod}`);

  // Double-check the chosen star isn't already claimed (hGetAll can return stale data)
  const existingOwner = await store.hGet(registryKey, `s:${newStarIndex}`);
  const existingUsername = existingOwner?.split(':')[0];
  if (existingOwner && existingUsername !== username) {
    console.log(`[CLAIM] user=${username} CONFLICT: star ${newStarIndex} already owned by ${existingUsername}, re-picking`);
    // Star is taken — rebuild claimed list from individual checks and pick again
    const freshClaims = await store.hGetAll(registryKey);
    const freshClaimed = Object.keys(freshClaims).map((k) => parseInt(k.replace('s:', ''), 10));
    if (!freshClaimed.includes(newStarIndex)) freshClaimed.push(newStarIndex);
    newStarIndex = pickNextHomeStar(stars, freshClaimed);
    console.log(`[CLAIM] user=${username} re-picked star ${newStarIndex} (freshClaimed=${freshClaimed.join(',')})`);
  }

  // Persist the claim
  await store.hSet(registryKey, { [`s:${newStarIndex}`]: username });

  // Verify we won (race-condition guard): re-read and check owner
  const verifyOwner = await store.hGet(registryKey, `s:${newStarIndex}`);
  const verifyUsername = verifyOwner?.split(':')[0];
  if (verifyOwner && verifyUsername !== username) {
    console.log(`[CLAIM] user=${username} RACE: star ${newStarIndex} taken by ${verifyUsername} after write, retrying`);
    const retryAllClaims = await store.hGetAll(registryKey);
    const retryClaimed = Object.keys(retryAllClaims).map((k) => parseInt(k.replace('s:', ''), 10));
    newStarIndex = pickNextHomeStar(stars, retryClaimed);
    await store.hSet(registryKey, { [`s:${newStarIndex}`]: username });
    console.log(`[CLAIM] user=${username} final star ${newStarIndex}`);
  }

  // Re-read to get consistent snapshot (in case of concurrent writes)
  const updatedClaims = await store.hGetAll(registryKey);

  // Deduplicate: if this user ended up with multiple claims (race from two browsers),
  // keep only the one we just wrote and remove the others.
  const userEntries = Object.entries(updatedClaims).filter(([, v]) => v.split(':')[0] === username);
  if (userEntries.length > 1) {
    console.log(`[CLAIM] user=${username} has ${userEntries.length} claims — deduplicating, keeping s:${newStarIndex}`);
    const toRemove = userEntries
      .filter(([k]) => k !== `s:${newStarIndex}`)
      .map(([k]) => k);
    if (toRemove.length > 0) {
      await store.hDel(registryKey, toRemove);
    }
  }

  // Re-read after dedup
  const finalClaims = await store.hGetAll(registryKey);
  const claimed = Object.entries(finalClaims).map(([k, v]) => {
    const parts = v.split(':');
    const bi = parts.length > 1 ? parseInt(parts[1]!, 10) : undefined;
    return {
      starIndex: parseInt(k.replace('s:', ''), 10),
      username: parts[0]!,
      ...(bi != null && !isNaN(bi) ? { bodyIndex: bi } : {}),
    };
  });

  console.log(`[CLAIM] user=${username} DONE: homeStar=${newStarIndex} totalClaims=${claimed.length} allClaimed=${JSON.stringify(claimed)}`);

  // Persist homeStar on economy profile so richness boost applies
  const econForHome = await loadEconomyProfile(store, username);
  if (econForHome.homeStar !== newStarIndex) {
    econForHome.homeStar = newStarIndex;
    await saveEconomyProfile(store, username, econForHome);
  }

  // Seed a Scout at the home star so the player always has a primary ship
  const shipsRaw = await store.hGet(`profile:${username}`, SHIPS_FIELD);
  const shipsProfile = parseShipsProfile(shipsRaw);
  const homeKey = starKey(newStarIndex);
  const homeShips = normalizeStarShipData(shipsProfile.stars[homeKey]);
  const UPGRADE_PATH_IDS = [1, 3, 4, 5, 6, 7];
  const hasUpgrade = homeShips.ships.some(s => s.count > 0 && UPGRADE_PATH_IDS.includes(s.typeId));
  if (!hasUpgrade) {
    homeShips.ships.push({ typeId: 1, count: 1 });
    shipsProfile.stars[homeKey] = homeShips;
    await store.hSet(`profile:${username}`, { [SHIPS_FIELD]: JSON.stringify(shipsProfile) });
  }

  return { homeStar: newStarIndex, claimed };
}

/** Get all claimed stars for a post (no mutation). */
export async function getClaimedStars(
  store: RedisGameStore,
  postId: string,
): Promise<Array<{ starIndex: number; username: string; bodyIndex?: number }>> {
  const allClaims = await store.hGetAll(`stars:${postId}`);
  return Object.entries(allClaims).map(([k, v]) => {
    // Claim value format: "username" or "username:bodyIndex"
    const parts = v.split(':');
    const username = parts[0]!;
    const bodyIndex = parts.length > 1 ? parseInt(parts[1]!, 10) : undefined;
    return {
      starIndex: parseInt(k.replace('s:', ''), 10),
      username,
      ...(bodyIndex != null && !isNaN(bodyIndex) ? { bodyIndex } : {}),
    };
  });
}

// ── Colonization ────────────────────────────────────────────────────────────

import type { ColonizeResponse } from '../../shared/api';

const COLONY_SHIP_TYPE_ID = 8;

/**
 * Colonize an unclaimed star. Consumes one Colony Ship at that star,
 * claims the star for the player, and seeds initial economy (Station lv1).
 * First-write-wins for race conditions.
 */
export async function colonizeStar(
  store: RedisGameStore,
  postId: string,
  username: string,
  starIndex: number,
  now = Date.now(),
  bodyIndex = 0,
): Promise<ColonizeResponse> {
  const registryKey = `stars:${postId}`;

  // Trading stations cannot be colonized
  if (isTradingStation(postId, starIndex)) {
    throw new Error('Trading stations cannot be colonized');
  }

  // Check if star is already claimed
  const existingOwner = await store.hGet(registryKey, `s:${starIndex}`);
  if (existingOwner) {
    const existingName = existingOwner.split(':')[0];
    if (existingName === username) {
      throw new Error('You already own this star');
    }
    throw new Error('This star is already claimed by another player');
  }

  // Check player has a Colony Ship at this star
  const shipsRaw = await store.hGet(`profile:${username}`, 'ships');
  if (!shipsRaw) throw new Error('No fleet data');
  const shipsProfile = JSON.parse(shipsRaw) as {
    stars: Record<string, { ships: Array<{ typeId: number; count: number }>; building: { typeId: number; completeAt: number } | null }>;
    transits: ShipTransit[];
  };

  const sKey = `s:${starIndex}`;
  const starFleet = shipsProfile.stars[sKey];
  if (!starFleet) throw new Error('No ships at this star');

  const colonySlot = starFleet.ships.find(s => s.typeId === COLONY_SHIP_TYPE_ID);
  if (!colonySlot || colonySlot.count < 1) throw new Error('No Colony Ship at this star');

  // Consume one Colony Ship
  colonySlot.count -= 1;
  if (colonySlot.count <= 0) {
    starFleet.ships = starFleet.ships.filter(s => s.typeId !== COLONY_SHIP_TYPE_ID || s.count > 0);
  }

  // Claim the star (first-write-wins)
  const claimValue = bodyIndex > 0 ? `${username}:${bodyIndex}` : username;
  await store.hSet(registryKey, { [sKey]: claimValue });

  // Verify we won the race
  const actualOwner = await store.hGet(registryKey, `s:${starIndex}`);
  const actualUsername = actualOwner?.split(':')[0];
  if (actualUsername !== username) {
    throw new Error('Another player colonized this star first');
  }

  // Save updated ships
  await store.hSet(`profile:${username}`, { ships: JSON.stringify(shipsProfile) });

  // Seed initial economy at new colony: Station lv1, starting resources
  const economy = await loadEconomyProfile(store, username);
  economy.stars[sKey] = {
    store: { ore: 640, food: 640, energy: 640, fuel: 0 },
    rates: { ore: 0, food: 0, energy: 0, fuel: 0 },
    cap: 1000,
    buildings: {
      station: { level: 1, status: 'ACTIVE', completeAt: null },
      mine: { level: 0, status: 'READY', completeAt: null },
      solar: { level: 0, status: 'READY', completeAt: null },
      hab: { level: 0, status: 'LOCKED', completeAt: null },
      warehouse: { level: 0, status: 'LOCKED', completeAt: null },
      dock: { level: 1, status: 'ACTIVE', completeAt: null },
      shield: { level: 0, status: 'LOCKED', completeAt: null },
      cannon: { level: 0, status: 'LOCKED', completeAt: null },
      refinery: { level: 0, status: 'LOCKED', completeAt: null },
    },
    shieldRaised: false,
    lastTickMs: now,
  };
  await saveEconomyProfile(store, username, economy);

  // Get star name for response
  const stars = generateStarPositions(postId);
  const starName = getStarName(stars[starIndex]?.index ?? starIndex);

  return { ok: true, starIndex, starName };
}

// ── Player Stats (playtime + interactions) ──────────────────────────────────

const STATS_FIELD = 'stats';

function parseStats(raw: string | undefined): PlayerStatsData {
  if (!raw) return { playtimeSeconds: 0, interactions: 0, lastSeen: 0 };
  try {
    const parsed = JSON.parse(raw);
    return {
      playtimeSeconds: Number(parsed.playtimeSeconds) || 0,
      interactions: Number(parsed.interactions) || 0,
      lastSeen: Number(parsed.lastSeen) || 0,
    };
  } catch {
    return { playtimeSeconds: 0, interactions: 0, lastSeen: 0 };
  }
}

export async function updatePlayerStats(
  store: RedisGameStore,
  username: string,
  deltaSeconds: number,
  deltaInteractions: number,
  now = Date.now(),
): Promise<void> {
  const raw = await store.hGet(`profile:${username}`, STATS_FIELD);
  const stats = parseStats(raw);
  stats.playtimeSeconds += Math.max(0, Math.min(deltaSeconds, 120)); // cap at 2min per heartbeat
  stats.interactions += Math.max(0, Math.min(deltaInteractions, 10000)); // sanity cap
  stats.lastSeen = now;
  await store.hSet(`profile:${username}`, { [STATS_FIELD]: JSON.stringify(stats) });
}

export async function getAdminPlayerStats(
  store: RedisGameStore,
  postId: string,
): Promise<AdminPlayerStatsResponse> {
  const claims = await getClaimedStars(store, postId);
  const players: AdminPlayerSummary[] = [];

  for (const claim of claims) {
    const profileRaw = await store.hGetAll(`profile:${claim.username}`);
    const stats = parseStats(profileRaw[STATS_FIELD]);

    // Economy: sum building levels across all stars (reconcile to count completed upgrades)
    const economy = parseEconomy(profileRaw[ECONOMY_FIELD]);
    let totalBuildingLevels = 0;
    const now = Date.now();
    for (const starData of Object.values(economy.stars)) {
      if (starData?.buildings) {
        const reconciled = reconcileStarBuildings(starData.buildings, now);
        for (const b of Object.values(reconciled)) {
          totalBuildingLevels += (b as { level?: number }).level ?? 0;
        }
      }
    }

    // Ships: count across all stars
    let totalShips = 0;
    const shipCounts: Record<number, number> = {};
    try {
      const shipsRaw = profileRaw.ships;
      if (shipsRaw) {
        const shipsProfile = JSON.parse(shipsRaw) as StoredShipsProfile;
        for (const starData of Object.values(shipsProfile.stars ?? {})) {
          for (const s of starData.ships ?? []) {
            totalShips += s.count;
            shipCounts[s.typeId] = (shipCounts[s.typeId] ?? 0) + s.count;
          }
        }
      }
    } catch { /* ignore bad data */ }

    const shipBreakdown = Object.entries(shipCounts)
      .map(([tid, count]) => ({
        name: SHIP_CATALOG[Number(tid) as ShipTypeId]?.name ?? `Type ${tid}`,
        count,
      }))
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count);

    players.push({
      username: claim.username,
      starIndex: claim.starIndex,
      starName: getStarName(claim.starIndex),
      playtimeSeconds: stats.playtimeSeconds,
      interactions: stats.interactions,
      lastSeen: stats.lastSeen,
      totalBuildingLevels,
      totalShips,
      shipBreakdown,
    });
  }

  // Sort by playtime descending
  players.sort((a, b) => b.playtimeSeconds - a.playtimeSeconds);
  return { players };
}