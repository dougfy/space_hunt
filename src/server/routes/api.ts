import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import { onColonize, onShipBuy, onShipUpgrade, onDockUpgrade, onFirstTransfer } from '../core/achievements';
import { setActivePostId } from './scheduler';
import type {
  BuildBuildingRequest,
  BuildBuildingResponse,
  BuyShipRequest,
  BuyShipResponse,
  ClaimPodRequest,
  ClaimPodResponse,
  ClaimedPodsResponse,
  ColonizeRequest,
  ColonizeResponse,
  DecrementResponse,
  FleetAllResponse,
  FleetTransferRequest,
  FleetTransferResponse,
  FreighterRouteRequest,
  FreighterRouteCancelRequest,
  FreighterRouteResponse,
  RaidRouteRequest,
  RaidRouteResponse,
  IncrementResponse,
  InitResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  OkResponse,
  PlayerProfileResponse,
  PoseUpdateRequest,
  PostShotsRequest,
  RoomPosesResponse,
  SaveProfileRequest,
  StatsHeartbeatRequest,
  AdminPlayerStatsResponse,
  StarEconomyResponse,
  StarShipsResponse,
  ShotsResponse,
  TradeRequest,
  TradeStationInfoResponse,
  ToggleShieldRequest,
  ToggleShieldResponse,
  UpgradeShipRequest,
  UpgradeShipResponse,
} from '../../shared/api';
import {
  buyBuilding,
  buyShip,
  claimHomeStar,
  claimPod,
  colonizeStar,
  completeAllBuilds,
  getClaimedPods,
  getClaimedStars,
  getAdminPlayerStats,
  loadAllFleet,
  loadStarEconomy,
  loadStarShips,
  listActiveShots,
  listRoomPoses,
  loadProfile,
  saveProfile,
  transferShips,
  assignFreighterRoute,
  cancelFreighterRoute,
  updatePlayerStats,
  upgradeBuilding,
  upgradeShip,
  toggleShield,
  assignRaidRoute,
  storePose,
  storeShots,
} from '../core/game-service';
import { getTradeStationInfo, executeTrade } from '../core/trading';
import { isTradingStation } from '../../shared/trading';
import type { ResourceType } from '../../shared/trading';
import { SHIP_CATALOG } from '../../shared/ships';
import { rollDiscovery } from '../../shared/exploration';
import { popSensorAlerts } from '../core/sensor-alerts';
import type { ExploreRequest, ExploreResponse } from '../../shared/exploration';
import { requireDev } from '../core/admin-auth';

type ErrorResponse = {
  status: 'error';
  message: string;
};

export const api = new Hono();

api.get('/init', async (c) => {
  const { postId } = context;

  if (!postId) {
    console.error('API Init Error: postId not found in devvit context');
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required but missing from context',
      },
      400
    );
  }

  try {
    // Lazily store the postId so scheduler jobs can find it
    void setActivePostId(postId);

    const [count, username] = await Promise.all([
      redis.get('count'),
      reddit.getCurrentUsername(),
    ]);

    return c.json<InitResponse>({
      type: 'init',
      postId: postId,
      count: count ? parseInt(count) : 0,
      username: username ?? 'anonymous',
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    let errorMessage = 'Unknown error during initialization';
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    return c.json<ErrorResponse>(
      { status: 'error', message: errorMessage },
      400
    );
  }
});

api.post('/increment', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', 1);
  return c.json<IncrementResponse>({
    count,
    postId,
    type: 'increment',
  });
});

api.post('/decrement', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', -1);
  return c.json<DecrementResponse>({
    count,
    postId,
    type: 'decrement',
  });
});

// ── Space Hunt Game Routes ──────────────────────────────────────────────────

/** Store a player's pose in a hash (one hash per post = room). */
api.post('/pose', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);

  const body = await c.req.json<PoseUpdateRequest>();
  await storePose(redis, postId, body);

  return c.json<OkResponse>({ ok: true });
});

/** Get all poses for a room (post), excluding the requesting player. Filters by tier+location. */
api.get('/room-poses', async (c) => {
  const postId = c.req.query('postId');
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);

  const response = await listRoomPoses(redis, {
    postId,
    exclude: c.req.query('exclude') ?? '',
    tier: parseInt(c.req.query('tier') ?? '-1', 10),
    starIndex: parseInt(c.req.query('starIndex') ?? '-1', 10),
    bodyIndex: parseInt(c.req.query('bodyIndex') ?? '-1', 10),
  });

  return c.json<RoomPosesResponse>(response);
});

/** Claim a pod. First player to claim wins; others get mine=false. */
api.post('/claim-pod', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);

  const body = await c.req.json<ClaimPodRequest>();
  const response = await claimPod(redis, postId, body);
  return c.json<ClaimPodResponse>(response);
});

/** Get all claimed pod IDs for late-joining players */
api.get('/claimed-pods', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);

  const response = await getClaimedPods(redis, postId);
  return c.json<ClaimedPodsResponse>(response);
});

// ── Shooting Routes ──────────────────────────────────────────────────────────

/** Post a burst of shots. */
api.post('/shots', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);

  const body = await c.req.json<PostShotsRequest>();
  await storeShots(redis, postId, body);

  return c.json<OkResponse>({ ok: true });
});

/** Get all active shots for a room, excluding the requesting player's. */
api.get('/shots', async (c) => {
  const postId = c.req.query('postId');
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);

  const response = await listActiveShots(redis, {
    postId,
    exclude: c.req.query('exclude') ?? '',
  });

  return c.json<ShotsResponse>(response);
});

// ── User Profile Routes ──────────────────────────────────────────────────────

/** Get a user's profile (ship name + shape). */
api.get('/profile', async (c) => {
  const user = c.req.query('username');
  const postId = c.req.query('postId');
  if (!user) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);

  const response = await loadProfile(redis, user);
  console.log('[SERVER-LOAD] profile for', user, ':', JSON.stringify({ lastPosition: response.lastPosition, discoveredStars: response.discoveredStars }));

  // Check dev mode flag
  const devModeFlag = await redis.get('app:dev_mode').catch(() => null);
  const devMode = devModeFlag === '1';

  // If postId provided, also resolve home star claim
  if (postId) {
    const claim = await claimHomeStar(redis, postId, user);
    return c.json<PlayerProfileResponse>({ ...response, homeStar: claim.homeStar, claimed: claim.claimed, devMode });
  }

  return c.json<PlayerProfileResponse>({ ...response, devMode });
});

/** Debug: dump raw profile hash from Redis. */
api.get('/debug/profile-raw', requireDev, async (c) => {
  const user = c.req.query('username');
  if (!user) return c.json({ error: 'username required' }, 400);
  const raw = await redis.hGetAll(`profile:${user}`);
  return c.json({ raw });
});

/** Admin: toggle dev mode (controls visibility of debug UI for all users). */
api.post('/admin/dev-mode', requireDev, async (c) => {
  const body = await c.req.json<{ enabled: boolean }>();
  if (body.enabled) {
    await redis.set('app:dev_mode', '1');
  } else {
    await redis.del('app:dev_mode');
  }
  return c.json({ ok: true, devMode: body.enabled });
});

/** Get all claimed stars for a post. */
api.get('/stars/claimed', async (c) => {
  const postId = c.req.query('postId');
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);
  const claimed = await getClaimedStars(redis, postId);
  return c.json({ claimed });
});

/** Debug: reset star claims for a post so they re-assign on next load. */
api.post('/stars/reset', requireDev, async (c) => {
  const body = await c.req.json<{ postId: string }>();
  if (!body.postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);
  const allClaims = await redis.hGetAll(`stars:${body.postId}`);

  // Also clear ships/economy/stats/position for all claimed users
  const users = new Set(Object.values(allClaims));
  for (const user of users) {
    try {
      await redis.hDel(`profile:${user}`, ['economy', 'ships', 'stats', 'discoveredStars', 'lastPosition', 'journeyDone']);
    } catch { /* ignore */ }
  }

  const keys = Object.keys(allClaims);
  if (keys.length > 0) {
    await redis.hDel(`stars:${body.postId}`, keys);
  }
  return c.json({ ok: true, cleared: keys.length });
});

/** Admin: full reset — clear claims, economy, and ships for all users of a post. */
api.post('/admin/reset-all', requireDev, async (c) => {
  const body = await c.req.json<{ postId: string; adminUser: string }>();
  if (!body.postId || !body.adminUser) return c.json<ErrorResponse>({ status: 'error', message: 'postId and adminUser required' }, 400);

  // Get all claims to find users
  const registryKey = `stars:${body.postId}`;
  const allClaims = await redis.hGetAll(registryKey);
  const users = new Set(Object.values(allClaims));
  // Also include the admin user themselves (in case they aren't in claims)
  users.add(body.adminUser);

  // Clear each user's game data (economy, ships, stats, discoveredStars, lastPosition, achievements)
  let cleared = 0;
  for (const user of users) {
    try {
      await redis.hDel(`profile:${user}`, ['economy', 'ships', 'stats', 'discoveredStars', 'lastPosition', 'journeyDone']);
      // Clear achievements so they can fire again
      const achKeys = Object.keys(await redis.hGetAll(`achievements:${user}`));
      if (achKeys.length > 0) await redis.hDel(`achievements:${user}`, achKeys);
      cleared++;
    } catch { /* ignore */ }
  }

  // Clear star claims
  const keys = Object.keys(allClaims);
  if (keys.length > 0) {
    await redis.hDel(registryKey, keys);
  }

  // Clear poses and shots
  try {
    const poseKeys = Object.keys(await redis.hGetAll(`poses:${body.postId}`));
    if (poseKeys.length > 0) await redis.hDel(`poses:${body.postId}`, poseKeys);
  } catch { /* ignore */ }

  // Clear alliance data for each user
  const allianceIds = new Set<string>();
  for (const user of users) {
    try {
      const allianceId = await redis.get(`player_alliance:${user.toLowerCase()}`);
      if (allianceId) {
        allianceIds.add(allianceId);
        await redis.del(`player_alliance:${user.toLowerCase()}`);
      }
      await redis.del(`alliance_invites:${user.toLowerCase()}`);
    } catch { /* ignore */ }
  }
  // Clear alliance records and chat
  for (const aid of allianceIds) {
    try {
      await redis.del(`alliance:${aid}`);
      await redis.del(`alliance_chat:${aid}`);
    } catch { /* ignore */ }
  }

  return c.json({ ok: true, usersCleared: cleared, claimsCleared: keys.length });
});

/** Save a user's profile (ship name + shape). */
api.post('/profile', async (c) => {
  const body = await c.req.json<SaveProfileRequest>();
  console.log('[SERVER-SAVE] profile request:', JSON.stringify(body));
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);

  await saveProfile(redis, body);
  console.log('[SERVER-SAVE] profile saved for', body.username);
  return c.json<OkResponse>({ ok: true });
});

/** Get per-star economy snapshot for a user, with elapsed production applied server-side. */
api.get('/economy', async (c) => {
  const username = c.req.query('username');
  const starIndexRaw = c.req.query('starIndex');
  if (!username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!starIndexRaw) return c.json<ErrorResponse>({ status: 'error', message: 'starIndex required' }, 400);

  const starIndex = parseInt(starIndexRaw, 10);
  if (Number.isNaN(starIndex) || starIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'starIndex must be >= 0' }, 400);
  }

  const response = await loadStarEconomy(redis, username, starIndex);
  return c.json<StarEconomyResponse>(response);
});

/** Get buildings for a star. Alias of economy snapshot for now. */
api.get('/buildings', async (c) => {
  const username = c.req.query('username');
  const starIndexRaw = c.req.query('starIndex');
  if (!username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!starIndexRaw) return c.json<ErrorResponse>({ status: 'error', message: 'starIndex required' }, 400);

  const starIndex = parseInt(starIndexRaw, 10);
  if (Number.isNaN(starIndex) || starIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'starIndex must be >= 0' }, 400);
  }

  const response = await loadStarEconomy(redis, username, starIndex);
  return c.json<StarEconomyResponse>(response);
});

/** Start a building purchase/upgrade for the given star. */
api.post('/buildings/buy', async (c) => {
  const body = await c.req.json<BuildBuildingRequest>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!Number.isInteger(body.starIndex) || body.starIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'starIndex must be >= 0' }, 400);
  }

  try {
    const response = await buyBuilding(redis, body);
    return c.json<BuildBuildingResponse>(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start building purchase';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

/** Upgrade an existing building for the given star. */
api.post('/buildings/upgrade', async (c) => {
  const body = await c.req.json<BuildBuildingRequest>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!Number.isInteger(body.starIndex) || body.starIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'starIndex must be >= 0' }, 400);
  }

  try {
    const response = await upgradeBuilding(redis, body);
    // Fire-and-forget: dock tier achievements (target level = current + 1 since it's now UPGRADING)
    if (body.buildType === 'dock') {
      const { postId } = context;
      if (postId) {
        const targetLevel = response.buildings.dock.level + 1;
        onDockUpgrade(redis, postId, body.username, targetLevel).catch(() => {});
      }
    }
    return c.json<BuildBuildingResponse>(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start building upgrade';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

/** Toggle shield raised/lowered on a star. */
api.post('/buildings/toggle-shield', async (c) => {
  const body = await c.req.json<ToggleShieldRequest>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!Number.isInteger(body.starIndex) || body.starIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'starIndex must be >= 0' }, 400);
  }

  try {
    const response = await toggleShield(redis, body.username, body.starIndex);
    return c.json<ToggleShieldResponse>(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to toggle shield';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

// ── Ship Routes ──────────────────────────────────────────────────────────────

/** Get ships stationed at a star. */
api.get('/ships', async (c) => {
  const username = c.req.query('username');
  const starIndexRaw = c.req.query('starIndex');
  if (!username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!starIndexRaw) return c.json<ErrorResponse>({ status: 'error', message: 'starIndex required' }, 400);

  const starIndex = parseInt(starIndexRaw, 10);
  if (Number.isNaN(starIndex) || starIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'starIndex must be >= 0' }, 400);
  }

  const response = await loadStarShips(redis, username, starIndex);
  return c.json<StarShipsResponse>(response);
});

/** Buy ships at a star (requires dock). */
api.post('/ships/buy', async (c) => {
  const body = await c.req.json<BuyShipRequest>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!Number.isInteger(body.starIndex) || body.starIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'starIndex must be >= 0' }, 400);
  }
  if (!Number.isInteger(body.quantity) || body.quantity < 1) {
    return c.json<ErrorResponse>({ status: 'error', message: 'quantity must be >= 1' }, 400);
  }

  try {
    const response = await buyShip(redis, body);
    // Fire-and-forget: first ship achievement
    const { postId } = context;
    console.log(`[ACHIEVEMENTS-DEBUG] /ships/buy postId=${postId} username=${body.username}`);
    if (postId) {
      onShipBuy(redis, postId, body.username, 1).catch((e) => console.error('[ACHIEVEMENTS] onShipBuy error:', e));
    } else {
      console.warn('[ACHIEVEMENTS] no postId in context — cannot post achievement');
    }
    return c.json<BuyShipResponse>(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to buy ship';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

/** Upgrade a ship in-place (requires dock, must own the ship). */
api.post('/ships/upgrade', async (c) => {
  const body = await c.req.json<UpgradeShipRequest>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!Number.isInteger(body.starIndex) || body.starIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'starIndex must be >= 0' }, 400);
  }
  if (!body.fromTypeId) return c.json<ErrorResponse>({ status: 'error', message: 'fromTypeId required' }, 400);

  try {
    const response = await upgradeShip(redis, body);
    // Fire-and-forget: ship upgrade achievements
    const { postId } = context;
    if (postId && response.building) {
      onShipUpgrade(redis, postId, body.username, response.building.typeId).catch(() => {});
    }
    return c.json<UpgradeShipResponse>(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to upgrade ship';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

// ── Fleet Management ─────────────────────────────────────────────────────────

/** Get all ships across all stars for a player. */
api.get('/fleet/all', async (c) => {
  const username = c.req.query('username');
  if (!username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);

  const response = await loadAllFleet(redis, username);
  return c.json<FleetAllResponse>(response);
});

/** Transfer ships between stars. */
api.post('/fleet/transfer', async (c) => {
  const body = await c.req.json<FleetTransferRequest>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!Number.isInteger(body.fromStarIndex) || body.fromStarIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'fromStarIndex must be >= 0' }, 400);
  }
  if (!Number.isInteger(body.toStarIndex) || body.toStarIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'toStarIndex must be >= 0' }, 400);
  }
  if (!Number.isInteger(body.count) || body.count < 1) {
    return c.json<ErrorResponse>({ status: 'error', message: 'count must be >= 1' }, 400);
  }

  try {
    const response = await transferShips(
      redis, body.username, body.fromStarIndex, body.toStarIndex, body.shipTypeId, body.count,
    );
    // Fire-and-forget: first transfer achievement
    const { postId } = context;
    if (postId) {
      onFirstTransfer(redis, postId, body.username).catch(() => {});
    }
    return c.json<FleetTransferResponse>(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to transfer ships';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

/** Assign a freighter to a persistent trade route. */
api.post('/fleet/freighter-route', async (c) => {
  const body = await c.req.json<FreighterRouteRequest>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!Number.isInteger(body.homeStarIndex) || body.homeStarIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'homeStarIndex must be >= 0' }, 400);
  }
  if (!Number.isInteger(body.targetStarIndex) || body.targetStarIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'targetStarIndex must be >= 0' }, 400);
  }
  try {
    const response = await assignFreighterRoute(redis, body.username, body.homeStarIndex, body.targetStarIndex);
    return c.json<FreighterRouteResponse>(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to assign freighter route';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

/** Cancel a freighter trade route. */
api.delete('/fleet/freighter-route', async (c) => {
  const body = await c.req.json<FreighterRouteCancelRequest>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!body.routeId) return c.json<ErrorResponse>({ status: 'error', message: 'routeId required' }, 400);
  try {
    const response = await cancelFreighterRoute(redis, body.username, body.routeId);
    return c.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to cancel route';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

/** Dispatch a Raider to raid an enemy star. */
api.post('/fleet/raid-route', async (c) => {
  const body = await c.req.json<RaidRouteRequest>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!Number.isInteger(body.homeStarIndex) || body.homeStarIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'homeStarIndex must be >= 0' }, 400);
  }
  if (!Number.isInteger(body.targetStarIndex) || body.targetStarIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'targetStarIndex must be >= 0' }, 400);
  }
  try {
    const response = await assignRaidRoute(redis, body.username, body.homeStarIndex, body.targetStarIndex);
    return c.json<RaidRouteResponse>(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start raid';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

/** Colonize an unclaimed star — consumes Colony Ship, claims star, seeds economy. */
api.post('/colonize', async (c) => {
  const body = await c.req.json<ColonizeRequest>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!body.postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);
  if (!Number.isInteger(body.starIndex) || body.starIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'starIndex must be >= 0' }, 400);
  }
  try {
    const response = await colonizeStar(redis, body.postId, body.username, body.starIndex);
    // Fire-and-forget: count stars owned and trigger achievements
    getClaimedStars(redis, body.postId).then((claims) => {
      const userStars = claims.filter((c) => c.username === body.username).length;
      onColonize(redis, body.postId, body.username, response.starName ?? '', userStars).catch(() => {});
    }).catch(() => {});
    return c.json<ColonizeResponse>(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to colonize';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

/** Public: instantly complete all builds at a star (costs 1 complete charge). */
api.post('/complete-builds', async (c) => {
  const body = await c.req.json<{ username: string; starIndex: number }>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!Number.isInteger(body.starIndex) || body.starIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'starIndex must be >= 0' }, 400);
  }
  try {
    const chargeKey = `complete_charges:${body.username.toLowerCase()}`;
    const charges = parseInt(await redis.get(chargeKey) ?? '0', 10);
    if (charges < 1) return c.json<ErrorResponse>({ status: 'error', message: 'No complete charges available' }, 400);
    // Deduct charge
    await redis.set(chargeKey, String(charges - 1));
    const response = await completeAllBuilds(redis, body.username, body.starIndex);
    return c.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to complete builds';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

/** Debug: instantly complete all builds at a star. */
api.post('/debug/complete-builds', requireDev, async (c) => {
  const body = await c.req.json<{ username: string; starIndex: number }>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!Number.isInteger(body.starIndex) || body.starIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'starIndex must be >= 0' }, 400);
  }
  try {
    // Dev-only endpoint — no charge check needed (requireDev already verified)
    const response = await completeAllBuilds(redis, body.username, body.starIndex);
    return c.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to complete builds';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

/** Debug: spawn an "Enemy" user with a claimed star and a Destroyer. */
api.post('/debug/spawn-enemy', requireDev, async (c) => {
  const body = await c.req.json<{ postId: string }>();
  if (!body.postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);
  try {
    const enemyName = 'Enemy';
    // Claim a star for the enemy (pickNextHomeStar gives a nearby star)
    const claim = await claimHomeStar(redis, body.postId, enemyName);
    const starKey = `s:${claim.homeStar}`;
    // Give them a Destroyer (typeId 3)
    const shipsProfile = { stars: { [starKey]: { ships: [{ typeId: 3, count: 1 }], building: null } }, transits: [] };
    await redis.hSet(`profile:${enemyName}`, { ships: JSON.stringify(shipsProfile) });
    return c.json({ ok: true, enemy: enemyName, starIndex: claim.homeStar });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to spawn enemy';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

/** Debug: reset fleet — remove all ships except at home star, clear transits. */
api.post('/debug/reset-fleet', requireDev, async (c) => {
  const body = await c.req.json<{ username: string; homeStarIndex: number }>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!Number.isInteger(body.homeStarIndex) || body.homeStarIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'homeStarIndex must be >= 0' }, 400);
  }
  try {
    const raw = await redis.hGet(`profile:${body.username}`, 'ships');
    const profile = raw ? JSON.parse(raw) : { stars: {} };
    const homeKey = `s:${body.homeStarIndex}`;
    const homeData = profile.stars?.[homeKey];
    // Keep only home star ships, clear everything else
    profile.stars = homeData ? { [homeKey]: homeData } : {};
    profile.transits = [];
    await redis.hSet(`profile:${body.username}`, { ships: JSON.stringify(profile) });
    return c.json({ ok: true, kept: homeKey, ships: homeData?.ships ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reset fleet';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

/** Fleet summaries for all foreign (non-player) claimed stars. */
api.get('/fleet/foreign', async (c) => {
  const postId = c.req.query('postId');
  const excludeUser = c.req.query('username');
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);
  try {
    const claims = await getClaimedStars(redis, postId);
    const result: Record<string, { owner: string; ships: Array<{ typeId: number; count: number }> }> = {};
    for (const claim of claims) {
      if (claim.username === excludeUser) continue;
      const raw = await redis.hGet(`profile:${claim.username}`, 'ships');
      if (!raw) continue;
      const profile = JSON.parse(raw) as { stars?: Record<string, { ships?: Array<{ typeId: number; count: number }> }> };
      // Aggregate all ships this player has at their claimed star
      const starKey = `s:${claim.starIndex}`;
      const starShips = profile.stars?.[starKey]?.ships ?? [];
      if (starShips.length > 0) {
        result[starKey] = { owner: claim.username, ships: starShips };
      }
    }
    return c.json({ stars: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load foreign fleet';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

/** Stats heartbeat — client sends playtime + interactions delta periodically. */
api.post('/stats', async (c) => {
  const body = await c.req.json<StatsHeartbeatRequest>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  await updatePlayerStats(redis, body.username, body.deltaSeconds ?? 0, body.deltaInteractions ?? 0);
  return c.json<OkResponse>({ ok: true });
});

/** Admin: get all player stats + summaries for the post. */
api.get('/admin/player-stats', requireDev, async (c) => {
  const postId = c.req.query('postId');
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);
  const response = await getAdminPlayerStats(redis, postId);
  return c.json<AdminPlayerStatsResponse>(response);
});

/** Admin: get currently active players (seen in last 5 min). */
api.get('/admin/active-players', requireDev, async (c) => {
  const postId = c.req.query('postId');
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);
  const response = await getAdminPlayerStats(redis, postId);
  const now = Date.now();
  const THRESHOLD = 5 * 60 * 1000; // 5 min
  const active = response.players
    .filter(p => p.lastSeen > 0 && (now - p.lastSeen) < THRESHOLD)
    .map(p => ({
      username: p.username,
      starName: p.starName,
      ago: Math.floor((now - p.lastSeen) / 1000),
      totalShips: p.totalShips,
      totalBuildingLevels: p.totalBuildingLevels,
    }));
  return c.json({ active, total: response.players.length });
});

// ── Leaderboard (public) ────────────────────────────────────────────────────

import { isAutoBot } from '../core/autobot';

api.get('/leaderboard', async (c) => {
  const postId = context.postId;
  if (!postId) return c.json<LeaderboardResponse>({ players: [] });

  const adminStats = await getAdminPlayerStats(redis, postId);
  const claims = await getClaimedStars(redis, postId);

  // Count stars per player
  const starCounts = new Map<string, number>();
  for (const claim of claims) {
    starCounts.set(claim.username, (starCounts.get(claim.username) ?? 0) + 1);
  }

  // Deduplicate adminStats by username (it has one entry per star claim)
  const seen = new Map<string, typeof adminStats.players[number]>();
  for (const p of adminStats.players) {
    // Exclude automated bots from leaderboard
    if (isAutoBot(p.username)) continue;
    if (!seen.has(p.username)) {
      seen.set(p.username, p);
    }
  }

  const entries: LeaderboardEntry[] = [...seen.values()].map(p => {
    const starCount = starCounts.get(p.username) ?? 0;
    const power = starCount * 100 + p.totalShips * 10 + p.totalBuildingLevels * 25 + Math.floor(p.playtimeSeconds / 720);
    return {
      rank: 0,
      username: p.username,
      starCount,
      totalShips: p.totalShips,
      totalBuildingLevels: p.totalBuildingLevels,
      playtimeSeconds: p.playtimeSeconds,
      power,
    };
  });

  entries.sort((a, b) => b.power - a.power);
  entries.forEach((e, i) => { e.rank = i + 1; });

  return c.json<LeaderboardResponse>({ players: entries });
});

// ── Trading Stations ────────────────────────────────────────────────────────

/** Get trade station info (stock & rates) for a given star. */
api.get('/trade-station', async (c) => {
  const postId = c.req.query('postId');
  const starIndexStr = c.req.query('starIndex');
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);
  if (!starIndexStr) return c.json<ErrorResponse>({ status: 'error', message: 'starIndex required' }, 400);
  const starIndex = parseInt(starIndexStr, 10);
  if (isNaN(starIndex) || starIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'invalid starIndex' }, 400);
  }
  if (!isTradingStation(postId, starIndex)) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Not a trading station' }, 400);
  }
  const info = await getTradeStationInfo(redis, postId, starIndex);
  return c.json<TradeStationInfoResponse>(info);
});

/** Execute a trade at a trading station. */
api.post('/trade-station/trade', async (c) => {
  const body = await c.req.json<TradeRequest>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!body.starIndex && body.starIndex !== 0) return c.json<ErrorResponse>({ status: 'error', message: 'starIndex required' }, 400);
  if (!body.giveType || !body.receiveType) return c.json<ErrorResponse>({ status: 'error', message: 'giveType and receiveType required' }, 400);
  if (!body.giveAmount || body.giveAmount < 1) return c.json<ErrorResponse>({ status: 'error', message: 'giveAmount must be >= 1' }, 400);

  const postId = context.postId;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'no postId in context' }, 500);

  if (!isTradingStation(postId, body.starIndex)) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Not a trading station' }, 400);
  }

  try {
    const result = await executeTrade(
      redis,
      postId,
      body.username,
      body.starIndex,
      body.giveType as ResourceType,
      body.receiveType as ResourceType,
      body.giveAmount,
    );
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Trade failed';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

// ── Fleet Share (post to comments) ──────────────────────────────────────────

const SHARE_COOLDOWN_SECONDS = 300; // 5 min

api.post('/share/fleet', async (c) => {
  const body = await c.req.json<{ username: string }>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);

  const postId = context.postId;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'no postId in context' }, 500);

  // Rate limit: 1 fleet share per 5 minutes per user
  const cooldownKey = `share:fleet:${body.username}`;
  const lastShare = await redis.get(cooldownKey);
  if (lastShare) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Share on cooldown' }, 429);
  }

  try {
    // Gather fleet data
    const fleetData = await loadAllFleet(redis, body.username);
    const claims = await getClaimedStars(redis, postId);
    const userStars = claims.filter(cl => cl.username === body.username);

    // Build fleet summary
    const shipTotals = new Map<number, number>();
    for (const starData of Object.values(fleetData.stars)) {
      for (const s of starData.ships) {
        shipTotals.set(s.typeId, (shipTotals.get(s.typeId) ?? 0) + s.count);
      }
    }

    if (shipTotals.size === 0) {
      return c.json<ErrorResponse>({ status: 'error', message: 'No ships to share' }, 400);
    }

    const shipLines: string[] = [];
    let totalSP = 0;
    for (const [typeId, count] of shipTotals.entries()) {
      const entry = SHIP_CATALOG[typeId as keyof typeof SHIP_CATALOG];
      if (!entry) continue;
      totalSP += entry.shipPoints * count;
      shipLines.push(`${entry.name} x${count}`);
    }

    const text = `🚀 **u/${body.username}**'s fleet: ${shipLines.join(', ')} — **${totalSP} SP** across ${userStars.length} system${userStars.length !== 1 ? 's' : ''}`;

    const fullId = postId.startsWith('t3_') ? postId : `t3_${postId}`;
    await reddit.submitComment({
      id: fullId as `t3_${string}`,
      text,
      runAs: 'APP',
    });

    // Set cooldown
    await redis.set(cooldownKey, '1', { expiration: new Date(Date.now() + SHARE_COOLDOWN_SECONDS * 1000) });

    return c.json({ status: 'ok' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Share failed';
    console.error('[SHARE] fleet share error:', error);
    return c.json<ErrorResponse>({ status: 'error', message }, 500);
  }
});

// ── Planet Exploration ─────────────────────────────────────────────────────────

/** Explore a planet for the first time. One shot per planet per player (global seed). */
api.post('/explore', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'No postId' }, 400);

  try {
    const body = await c.req.json<ExploreRequest & { username: string; starIndex: number }>();
    const { username, starIndex, bodyIndex } = body;
    if (!username || starIndex == null || bodyIndex == null) {
      return c.json<ErrorResponse>({ status: 'error', message: 'Missing fields' }, 400);
    }

    // Check if already explored (one-shot per planet per player)
    const exploreKey = `explored:${username}:${starIndex}:${bodyIndex}`;
    const alreadyExplored = await redis.get(exploreKey);
    if (alreadyExplored) {
      const cached = JSON.parse(alreadyExplored) as ExploreResponse;
      return c.json<ExploreResponse>({ ...cached, explored: false });
    }

    // Compute galaxy seed from postId (same as client)
    let galaxySeed = 23;
    const seedStr = postId + ':galaxy';
    for (let i = 0; i < seedStr.length; i++) {
      galaxySeed = (galaxySeed * 31 + seedStr.charCodeAt(i)) | 0;
    }

    // Roll discovery (deterministic per planet)
    const result = rollDiscovery(galaxySeed, starIndex, bodyIndex);

    // Grant resources to the star the player is exploring
    if (result.kind === 'ore' || result.kind === 'food' || result.kind === 'energy') {
      const profileKey = `profile:${username}`;
      const economyRaw = await redis.hGet(profileKey, 'economy');
      const economy = economyRaw ? JSON.parse(economyRaw) as { stars: Record<string, { store?: { ore: number; food: number; energy: number } }> } : { stars: {} };
      const sKey = `s:${starIndex}`;
      const star = economy.stars[sKey];
      if (star?.store) {
        star.store[result.kind] = (star.store[result.kind] ?? 0) + result.amount;
        await redis.hSet(profileKey, { economy: JSON.stringify(economy) });
      }
    }

    // Grant a complete-charge for blueprint finds
    if (result.kind === 'blueprint') {
      const chargeKey = `complete_charges:${username.toLowerCase()}`;
      await redis.incrBy(chargeKey, 1);
      console.log(`[EXPLORE] user=${username} found blueprint — granted 1 complete charge`);
    }

    // Mark explored (persist forever)
    const response: ExploreResponse = { explored: true, result };
    await redis.set(exploreKey, JSON.stringify(response));

    return c.json<ExploreResponse>(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Exploration failed';
    console.error('[EXPLORE] error:', error);
    return c.json<ErrorResponse>({ status: 'error', message }, 500);
  }
});

// ── Sensor Alerts ─────────────────────────────────────────────────────────────

api.get('/sensors', async (c) => {
  const username = c.req.query('username');
  if (!username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  const alerts = await popSensorAlerts(redis, username);
  return c.json({ alerts });
});
