import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  BuildBuildingRequest,
  BuildBuildingResponse,
  BuyShipRequest,
  BuyShipResponse,
  ClaimPodRequest,
  ClaimPodResponse,
  ClaimedPodsResponse,
  DecrementResponse,
  FleetAllResponse,
  FleetTransferRequest,
  FleetTransferResponse,
  IncrementResponse,
  InitResponse,
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
  UpgradeShipRequest,
  UpgradeShipResponse,
} from '../../shared/api';
import {
  buyBuilding,
  buyShip,
  claimHomeStar,
  claimPod,
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
  updatePlayerStats,
  upgradeBuilding,
  upgradeShip,
  storePose,
  storeShots,
} from '../core/game-service';

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

  // If postId provided, also resolve home star claim
  if (postId) {
    const claim = await claimHomeStar(redis, postId, user);
    return c.json<PlayerProfileResponse>({ ...response, homeStar: claim.homeStar, claimed: claim.claimed });
  }

  return c.json<PlayerProfileResponse>(response);
});

/** Debug: dump raw profile hash from Redis. */
api.get('/debug/profile-raw', async (c) => {
  const user = c.req.query('username');
  if (!user) return c.json({ error: 'username required' }, 400);
  const raw = await redis.hGetAll(`profile:${user}`);
  return c.json({ raw });
});

/** Get all claimed stars for a post. */
api.get('/stars/claimed', async (c) => {
  const postId = c.req.query('postId');
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);
  const claimed = await getClaimedStars(redis, postId);
  return c.json({ claimed });
});

/** Debug: reset star claims for a post so they re-assign on next load. */
api.post('/stars/reset', async (c) => {
  const body = await c.req.json<{ postId: string }>();
  if (!body.postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);
  const allClaims = await redis.hGetAll(`stars:${body.postId}`);

  // Also clear ships/economy/stats/position for all claimed users
  const users = new Set(Object.values(allClaims));
  for (const user of users) {
    try {
      await redis.hDel(`profile:${user}`, ['economy', 'ships', 'stats', 'discoveredStars', 'lastPosition']);
    } catch { /* ignore */ }
  }

  const keys = Object.keys(allClaims);
  if (keys.length > 0) {
    await redis.hDel(`stars:${body.postId}`, keys);
  }
  return c.json({ ok: true, cleared: keys.length });
});

/** Admin: full reset — clear claims, economy, and ships for all users of a post. */
api.post('/admin/reset-all', async (c) => {
  const body = await c.req.json<{ postId: string; adminUser: string }>();
  if (!body.postId || !body.adminUser) return c.json<ErrorResponse>({ status: 'error', message: 'postId and adminUser required' }, 400);

  // Get all claims to find users
  const registryKey = `stars:${body.postId}`;
  const allClaims = await redis.hGetAll(registryKey);
  const users = new Set(Object.values(allClaims));
  // Also include the admin user themselves (in case they aren't in claims)
  users.add(body.adminUser);

  // Clear each user's game data (economy, ships, stats, discoveredStars, lastPosition)
  let cleared = 0;
  for (const user of users) {
    try {
      await redis.hDel(`profile:${user}`, ['economy', 'ships', 'stats', 'discoveredStars', 'lastPosition']);
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
    return c.json<BuildBuildingResponse>(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start building upgrade';
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
    return c.json<FleetTransferResponse>(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to transfer ships';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

/** Debug: instantly complete all builds at a star. */
api.post('/debug/complete-builds', async (c) => {
  const body = await c.req.json<{ username: string; starIndex: number }>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  if (!Number.isInteger(body.starIndex) || body.starIndex < 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'starIndex must be >= 0' }, 400);
  }
  try {
    const response = await completeAllBuilds(redis, body.username, body.starIndex);
    return c.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to complete builds';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

/** Debug: reset fleet — remove all ships except at home star, clear transits. */
api.post('/debug/reset-fleet', async (c) => {
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

/** Stats heartbeat — client sends playtime + interactions delta periodically. */
api.post('/stats', async (c) => {
  const body = await c.req.json<StatsHeartbeatRequest>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);
  await updatePlayerStats(redis, body.username, body.deltaSeconds ?? 0, body.deltaInteractions ?? 0);
  return c.json<OkResponse>({ ok: true });
});

/** Admin: get all player stats + summaries for the post. */
api.get('/admin/player-stats', async (c) => {
  const postId = c.req.query('postId');
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);
  const response = await getAdminPlayerStats(redis, postId);
  return c.json<AdminPlayerStatsResponse>(response);
});
