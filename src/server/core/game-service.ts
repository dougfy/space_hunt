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
  FleetTransferRequest,
  FleetTransferResponse,
  ResourceStore,
  ShipBuildingState,
  ShipTransit,
  ShipTypeId,
  StarEconomyResponse,
  StarEconomyState,
  StarShipsState,
  StarShipsResponse,
  PlayerProfileResponse,
  PoseUpdateRequest,
  PostShotsRequest,
  RemoteShotItem,
  RoomPoseItem,
  RoomPosesResponse,
  SaveProfileRequest,
  ShotItem,
  ShotsResponse,
  UpgradeShipRequest,
  UpgradeShipResponse,
} from '../../shared/api';
import { normalizeSharedShipShape } from '../../shared/api';
import {
  BUILDING_CATALOG,
  computeResourceCapFromBuildings,
  computeResourceRatesFromBuildings,
  getBuildingCost,
  getBuildingDurationSeconds,
  getBuildingTargetLevel,
  isBuildUnlocked,
  normalizeStarBuildings,
  reconcileStarBuildings,
} from '../../shared/buildings';
import { SHIP_CATALOG, canBuildShip, getUpgradeTarget, canUpgradeShip } from '../../shared/ships';

const ECONOMY_FIELD = 'economy';
const DEFAULT_STORE: ResourceStore = { ore: 640, food: 640, energy: 640 };

type StoredEconomyProfile = {
  stars: Record<string, StarEconomyState>;
};

function starKey(starIndex: number): string {
  return `s:${starIndex}`;
}

function clampStore(store: ResourceStore, cap: number): ResourceStore {
  const safeCap = Math.max(1, Math.floor(cap));
  return {
    ore: Math.max(0, Math.min(safeCap, store.ore)),
    food: Math.max(0, Math.min(safeCap, store.food)),
    energy: Math.max(0, Math.min(safeCap, store.energy)),
  };
}

function normalizeStore(store: ResourceStore): ResourceStore {
  return {
    ore: Number.isFinite(store.ore) ? store.ore : 0,
    food: Number.isFinite(store.food) ? store.food : 0,
    energy: Number.isFinite(store.energy) ? store.energy : 0,
  };
}

function normalizeStarState(star: Partial<StarEconomyState>, now: number): StarEconomyState {
  const buildings = normalizeStarBuildings(star.buildings as Partial<Record<BuildType, Partial<StarEconomyState['buildings'][BuildType]>>>);
  const cap = computeResourceCapFromBuildings(buildings);
  const rawStore = normalizeStore({
    ore: star.store?.ore ?? DEFAULT_STORE.ore,
    food: star.store?.food ?? DEFAULT_STORE.food,
    energy: star.store?.energy ?? DEFAULT_STORE.energy,
  });
  return {
    store: clampStore(rawStore, cap),
    rates: computeResourceRatesFromBuildings(buildings),
    cap,
    buildings,
    lastTickMs: Number.isFinite(star.lastTickMs) ? (star.lastTickMs as number) : now,
  };
}

function tickStarEconomy(star: StarEconomyState, now: number): StarEconomyState {
  if (now <= star.lastTickMs) return star;
  const elapsedMin = (now - star.lastTickMs) / 60_000;
  const next = {
    ...star,
    store: clampStore({
      ore: star.store.ore + star.rates.ore * elapsedMin,
      food: star.store.food + star.rates.food * elapsedMin,
      energy: star.store.energy + star.rates.energy * elapsedMin,
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
  return store.ore >= cost.ore && store.food >= cost.food && store.energy >= cost.energy;
}

function subtractResources(store: ResourceStore, cost: ResourceStore): ResourceStore {
  return {
    ore: store.ore - cost.ore,
    food: store.food - cost.food,
    energy: store.energy - cost.energy,
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
  const base = normalizeStarState(economy.stars[key] ?? {}, now);
  const reconciledBuildings = reconcileStarBuildings(base.buildings, now);
  const reconciledBase: StarEconomyState = {
    ...base,
    buildings: reconciledBuildings,
    rates: computeResourceRatesFromBuildings(reconciledBuildings),
    cap: computeResourceCapFromBuildings(reconciledBuildings),
  };
  const ticked = tickStarEconomy(reconciledBase, now);
  economy.stars[key] = ticked;
  await saveEconomyProfile(store, username, economy);

  return {
    starKey: key,
    starIndex,
    store: ticked.store,
    rates: ticked.rates,
    cap: ticked.cap,
    buildings: ticked.buildings,
    lastTickMs: ticked.lastTickMs,
  };
}

export async function startBuildingUpgrade(
  store: RedisGameStore,
  body: BuildBuildingRequest,
  now = Date.now(),
): Promise<BuildBuildingResponse> {
  const economy = await loadEconomyProfile(store, body.username);
  const key = starKey(body.starIndex);
  const base = normalizeStarState(economy.stars[key] ?? {}, now);
  const reconciledBuildings = reconcileStarBuildings(base.buildings, now);
  const current: StarEconomyState = tickStarEconomy({
    ...base,
    buildings: reconciledBuildings,
    rates: computeResourceRatesFromBuildings(reconciledBuildings),
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
  nextBuildings[body.buildType] = {
    level: building.level,
    status: 'UPGRADING',
    completeAt: now + getBuildingDurationSeconds(body.buildType) * 1000,
  };
  const nextCap = computeResourceCapFromBuildings(nextBuildings);
  const nextState: StarEconomyState = {
    store: clampStore(subtractResources(current.store, cost), nextCap),
    rates: computeResourceRatesFromBuildings(nextBuildings),
    cap: nextCap,
    buildings: nextBuildings,
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

  // Seed starter Scout if fleet is completely empty (first load)
  if (starData.ships.length === 0 && !starData.building) {
    starData.ships.push({ typeId: 1, count: 1 });
    profile.stars[key] = starData;
    await store.hSet(`profile:${username}`, { [SHIPS_FIELD]: JSON.stringify(profile) });
  } else if (hadBuilding && !starData.building) {
    // Building completed — save updated state
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

  const catalog = SHIP_CATALOG[shipTypeId];
  if (!catalog) throw new Error(`Unknown ship type: ${shipTypeId}`);

  // Load economy and check dock level
  const economy = await loadEconomyProfile(store, username);
  const key = starKey(starIndex);
  const base = normalizeStarState(economy.stars[key] ?? {}, now);
  const reconciledBuildings = reconcileStarBuildings(base.buildings, now);
  const current: StarEconomyState = tickStarEconomy({
    ...base,
    buildings: reconciledBuildings,
    rates: computeResourceRatesFromBuildings(reconciledBuildings),
    cap: computeResourceCapFromBuildings(reconciledBuildings),
  }, now);

  const dockLevel = current.buildings.dock.level;
  if (dockLevel < 1) throw new Error('No dock built at this star');
  if (!canBuildShip(shipTypeId, dockLevel)) throw new Error('Dock level too low for this ship type');

  // Check if already building
  const shipsRaw = await store.hGet(`profile:${username}`, SHIPS_FIELD);
  const shipsProfile = parseShipsProfile(shipsRaw);
  const starData = normalizeStarShipData(shipsProfile.stars[key]);
  reconcileShipBuilding(starData, now);

  if (starData.building) throw new Error('Already building a ship at this star');

  // Check resource cost (single unit)
  if (!hasEnoughResources(current.store, catalog.cost)) throw new Error('Insufficient resources');

  // Deduct resources
  current.store = subtractResources(current.store, catalog.cost);
  current.lastTickMs = now;
  economy.stars[key] = current;
  await saveEconomyProfile(store, username, economy);

  // Start building
  starData.building = { typeId: shipTypeId, completeAt: now + catalog.buildSeconds * 1000 };
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

  // Validate upgrade path
  const targetId = getUpgradeTarget(fromTypeId);
  if (!targetId) throw new Error(`No upgrade available for ship type ${fromTypeId}`);

  const targetCatalog = SHIP_CATALOG[targetId];
  if (!targetCatalog) throw new Error(`Unknown target ship type: ${targetId}`);

  // Load economy and check dock level
  const economy = await loadEconomyProfile(store, username);
  const key = starKey(starIndex);
  const base = normalizeStarState(economy.stars[key] ?? {}, now);
  const reconciledBuildings = reconcileStarBuildings(base.buildings, now);
  const current: StarEconomyState = tickStarEconomy({
    ...base,
    buildings: reconciledBuildings,
    rates: computeResourceRatesFromBuildings(reconciledBuildings),
    cap: computeResourceCapFromBuildings(reconciledBuildings),
  }, now);

  const dockLevel = current.buildings.dock.level;
  if (dockLevel < 1) throw new Error('No dock built at this star');
  if (!canUpgradeShip(fromTypeId, dockLevel)) throw new Error('Dock level too low for this upgrade');

  // Load ships and check ownership
  const shipsRaw = await store.hGet(`profile:${username}`, SHIPS_FIELD);
  const shipsProfile = parseShipsProfile(shipsRaw);
  const starData = normalizeStarShipData(shipsProfile.stars[key]);
  reconcileShipBuilding(starData, now);

  if (starData.building) throw new Error('Already building a ship at this star');

  // Check player owns at least one of the source ship
  const sourceSlot = starData.ships.find((s) => s.typeId === fromTypeId);
  if (!sourceSlot || sourceSlot.count < 1) throw new Error('You do not own this ship type at this star');

  // Check resource cost
  if (!hasEnoughResources(current.store, targetCatalog.cost)) throw new Error('Insufficient resources');

  // Deduct resources
  current.store = subtractResources(current.store, targetCatalog.cost);
  current.lastTickMs = now;
  economy.stars[key] = current;
  await saveEconomyProfile(store, username, economy);

  // Remove one of the source ship
  sourceSlot.count -= 1;
  starData.ships = starData.ships.filter((s) => s.count > 0);

  // Start building the upgraded ship
  starData.building = { typeId: targetId, completeAt: now + targetCatalog.buildSeconds * 1000 };
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

  // ── Reconcile completed transits ──
  const pendingTransits: ShipTransit[] = [];
  if (profile.transits && profile.transits.length > 0) {
    for (const t of profile.transits) {
      if (t.arrivalAt <= now) {
        // Transit complete — deliver ships to destination
        const toKey = starKey(t.toStarIndex);
        const toData = normalizeStarShipData(profile.stars[toKey]);
        const destSlot = toData.ships.find((s) => s.typeId === t.shipTypeId);
        if (destSlot) {
          destSlot.count += t.count;
        } else {
          toData.ships.push({ typeId: t.shipTypeId, count: t.count });
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
  }

  return { stars: result, transits: pendingTransits };
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
  const transitMs = Math.round((BASE_TRANSIT_SECONDS / speed) * 1000);

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
  };
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
  const base = normalizeStarState(economy.stars[key] ?? {}, now);
  let changed = false;
  for (const type of Object.keys(base.buildings) as Array<keyof typeof base.buildings>) {
    const b = base.buildings[type];
    if (b.status === 'UPGRADING' && b.completeAt != null && b.completeAt > now) {
      b.completeAt = now;
      changed = true;
    }
  }

  // Fill resources to cap
  base.store = { ore: base.cap, food: base.cap, energy: base.cap };
  changed = true;

  if (changed) {
    const reconciledBuildings = reconcileStarBuildings(base.buildings, now);
    const next: StarEconomyState = tickStarEconomy({
      ...base,
      buildings: reconciledBuildings,
      rates: computeResourceRatesFromBuildings(reconciledBuildings),
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
  claimed: Array<{ starIndex: number; username: string }>;
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

  // Check if user already has a claim
  for (const [key, owner] of Object.entries(allClaims)) {
    if (owner === username) {
      const starIndex = parseInt(key.replace('s:', ''), 10);
      const claimed = Object.entries(allClaims).map(([k, v]) => ({
        starIndex: parseInt(k.replace('s:', ''), 10),
        username: v,
      }));
      return { homeStar: starIndex, claimed };
    }
  }

  // Migration: check if user already has economy data at any star
  const economy = await loadEconomyProfile(store, username);
  const existingStarKeys = Object.keys(economy.stars); // e.g. ["s:47"]
  let migratedStarIndex: number | null = null;
  if (existingStarKeys.length > 0) {
    // Pick the star with the most developed buildings
    let bestLevel = -1;
    for (const sk of existingStarKeys) {
      const idx = parseInt(sk.replace('s:', ''), 10);
      if (Number.isNaN(idx)) continue;
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
  }

  const stars = generateStarPositions(postId);
  const claimedIndices = Object.keys(allClaims).map((k) => parseInt(k.replace('s:', ''), 10));

  let newStarIndex: number;
  if (migratedStarIndex != null) {
    // Existing player — claim their built-up star
    newStarIndex = migratedStarIndex;
    // If another user already claimed this star (shouldn't happen normally), still honor the migration
    // since the economy data proves this player was here first
  } else if (claimedIndices.length === 0) {
    newStarIndex = getDefaultHomeStarIndex(stars);
  } else {
    newStarIndex = pickNextHomeStar(stars, claimedIndices);
  }

  // Persist the claim
  await store.hSet(registryKey, { [`s:${newStarIndex}`]: username });

  // Re-read to get consistent snapshot (in case of concurrent writes)
  const updatedClaims = await store.hGetAll(registryKey);
  const claimed = Object.entries(updatedClaims).map(([k, v]) => ({
    starIndex: parseInt(k.replace('s:', ''), 10),
    username: v,
  }));

  return { homeStar: newStarIndex, claimed };
}

/** Get all claimed stars for a post (no mutation). */
export async function getClaimedStars(
  store: RedisGameStore,
  postId: string,
): Promise<Array<{ starIndex: number; username: string }>> {
  const allClaims = await store.hGetAll(`stars:${postId}`);
  return Object.entries(allClaims).map(([k, v]) => ({
    starIndex: parseInt(k.replace('s:', ''), 10),
    username: v,
  }));
}