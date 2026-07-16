import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  DecrementResponse,
  IncrementResponse,
  InitResponse,
} from '../../shared/api';

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

const POSE_STALE_MS = 8000; // 8s staleness window

/** Store a player's pose in a hash (one hash per post = room). */
api.post('/pose', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);

  const body = await c.req.json<{ x: number; y: number; angle: number; username: string; sessionId?: string; shape?: string; tier?: number; starIndex?: number; bodyIndex?: number }>();
  const sid = body.sessionId || body.username;
  const hashKey = `poses:${postId}`;
  const value = JSON.stringify({
    x: body.x, y: body.y, angle: body.angle, shape: body.shape || 'arrow',
    username: body.username, ts: Date.now(),
    tier: body.tier ?? 0, starIndex: body.starIndex ?? -1, bodyIndex: body.bodyIndex ?? -1,
  });
  await redis.hSet(hashKey, { [sid]: value });

  return c.json({ ok: true });
});

/** Get all poses for a room (post), excluding the requesting player. Filters by tier+location. */
api.get('/room-poses', async (c) => {
  const postId = c.req.query('postId');
  const exclude = c.req.query('exclude') ?? '';
  const tierFilter = parseInt(c.req.query('tier') ?? '-1', 10);
  const starFilter = parseInt(c.req.query('starIndex') ?? '-1', 10);
  const bodyFilter = parseInt(c.req.query('bodyIndex') ?? '-1', 10);
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);

  const hashKey = `poses:${postId}`;
  const all = await redis.hGetAll(hashKey);

  const items: Array<{ username: string; x: number; y: number; angle: number; shape: string }> = [];
  const now = Date.now();
  const staleKeys: string[] = [];

  for (const [sid, raw] of Object.entries(all)) {
    if (sid === exclude) continue;
    const data = JSON.parse(raw) as { x: number; y: number; angle: number; shape?: string; username?: string; ts: number; tier?: number; starIndex?: number; bodyIndex?: number };
    if (now - data.ts > POSE_STALE_MS) {
      staleKeys.push(sid);
      continue;
    }
    // Filter: only show players in the same tier+location
    if (tierFilter >= 0) {
      if ((data.tier ?? 0) !== tierFilter) continue;
      if (tierFilter >= 1 && (data.starIndex ?? -1) !== starFilter) continue;
      if (tierFilter >= 2 && (data.bodyIndex ?? -1) !== bodyFilter) continue;
    }
    items.push({ username: data.username || sid, x: data.x, y: data.y, angle: data.angle, shape: data.shape || 'arrow' });
  }

  // Clean up stale entries in the background
  if (staleKeys.length > 0) {
    redis.hDel(hashKey, staleKeys).catch(() => {});
  }

  return c.json({ items });
});

/** Claim a pod. First player to claim wins; others get mine=false. */
api.post('/claim-pod', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);

  const body = await c.req.json<{ podId: number; username: string }>();
  const hashKey = `pods:${postId}`;
  const field = String(body.podId);
  const existing = await redis.hGet(hashKey, field);

  if (existing) {
    // Already claimed
    return c.json({ success: true, podId: body.podId, mine: existing === body.username });
  }

  await redis.hSet(hashKey, { [field]: body.username });
  return c.json({ success: true, podId: body.podId, mine: true });
});

/** Get all claimed pod IDs for late-joining players */
api.get('/claimed-pods', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);

  const hashKey = `pods:${postId}`;
  const all = await redis.hGetAll(hashKey);
  const podIds = Object.keys(all).map(k => parseInt(k, 10));
  return c.json({ podIds });
});

// ── Shooting Routes ──────────────────────────────────────────────────────────

const SHOT_TTL_MS = 3000; // Shots expire from Redis after 3s

/** Post a burst of shots. */
api.post('/shots', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);

  const body = await c.req.json<{ sessionId: string; shots: Array<{ id: string; origin: { x: number; y: number }; angle: number; speed: number; spawnTime: number }> }>();
  const hashKey = `shots:${postId}`;
  const value = JSON.stringify({ shots: body.shots, ts: Date.now() });
  await redis.hSet(hashKey, { [body.sessionId]: value });

  return c.json({ ok: true });
});

/** Get all active shots for a room, excluding the requesting player's. */
api.get('/shots', async (c) => {
  const postId = c.req.query('postId');
  const exclude = c.req.query('exclude') ?? '';
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId required' }, 400);

  const hashKey = `shots:${postId}`;
  const all = await redis.hGetAll(hashKey);

  const shots: Array<{ id: string; shooterId: string; origin: { x: number; y: number }; angle: number; speed: number; spawnTime: number }> = [];
  const now = Date.now();
  const staleKeys: string[] = [];

  for (const [sid, raw] of Object.entries(all)) {
    if (sid === exclude) continue;
    const data = JSON.parse(raw) as { shots: Array<{ id: string; origin: { x: number; y: number }; angle: number; speed: number; spawnTime: number }>; ts: number };
    if (now - data.ts > SHOT_TTL_MS) {
      staleKeys.push(sid);
      continue;
    }
    for (const s of data.shots) {
      shots.push({ ...s, shooterId: sid, spawnTime: data.ts / 1000 });
    }
  }

  if (staleKeys.length > 0) {
    redis.hDel(hashKey, staleKeys).catch(() => {});
  }

  return c.json({ shots });
});

// ── User Profile Routes ──────────────────────────────────────────────────────

/** Get a user's profile (ship name + shape). */
api.get('/profile', async (c) => {
  const user = c.req.query('username');
  if (!user) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);

  const raw = await redis.hGetAll(`profile:${user}`);
  return c.json({ name: raw.name || '', shape: raw.shape || 'arrow' });
});

/** Save a user's profile (ship name + shape). */
api.post('/profile', async (c) => {
  const body = await c.req.json<{ username: string; name?: string; shape?: string }>();
  if (!body.username) return c.json<ErrorResponse>({ status: 'error', message: 'username required' }, 400);

  const fields: Record<string, string> = {};
  if (body.name !== undefined) fields.name = body.name;
  if (body.shape !== undefined) fields.shape = body.shape;
  if (Object.keys(fields).length > 0) {
    await redis.hSet(`profile:${body.username}`, fields);
  }
  return c.json({ ok: true });
});
