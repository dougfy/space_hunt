import { Hono } from 'hono';
import { telemetry } from '@devvit/analytics/server/reddit';
import { redis, reddit } from '@devvit/web/server';
import { requireDev } from '../core/admin-auth';

const api = new Hono();

async function getUser(): Promise<string> {
  try { return (await reddit.getCurrentUsername()) ?? '?'; } catch { return '?'; }
}

// ── Devvit Journeys telemetry routes ────────────────────────────────────────
// These forward client-side journey events to the Devvit telemetry plugin.
// Client calls these via `@devvit/analytics/client/reddit` (basePath: /api/telemetry).

api.post('/journey/start', async (c) => {
  try {
    const user = await getUser();
    const response = await telemetry.startJourney();
    console.log('[TELEMETRY]', user, 'journey_started', response.journeyId);
    return c.json(response);
  } catch (e) {
    console.error('[TELEMETRY] start error:', e);
    return c.json({ error: 'Failed to start journey' }, 500);
  }
});

api.post('/journey/progress', async (c) => {
  try {
    const body = await c.req.json<{ journeyId: string; progress: number; action?: string; actionDetails?: string }>();
    if (!body.journeyId || typeof body.progress !== 'number') {
      return c.json({ error: 'journeyId and progress required' }, 400);
    }
    const user = await getUser();
    const response = await telemetry.journeyProgress({
      journeyId: body.journeyId,
      progress: body.progress,
      ...(body.action ? { action: body.action } : {}),
      ...(body.actionDetails ? { actionDetails: body.actionDetails } : {}),
    });
    console.log('[TELEMETRY]', user, 'progress', body.progress, body.action ?? '');
    return c.json(response);
  } catch (e) {
    console.error('[TELEMETRY] progress error:', e);
    return c.json({ error: 'Failed to record progress' }, 500);
  }
});

api.post('/journey/interaction', async (c) => {
  try {
    const body = await c.req.json<{ journeyId?: string; action: string; actionDetails?: string }>();
    if (!body.action) {
      return c.json({ error: 'action required' }, 400);
    }
    const user = await getUser();
    const response = await telemetry.journeyInteraction({
      journeyId: body.journeyId ?? '',
      action: body.action,
      actionDetails: body.actionDetails ?? '',
    });
    console.log('[TELEMETRY]', user, 'interaction', body.action);
    return c.json(response);
  } catch (e) {
    console.error('[TELEMETRY] interaction error:', e);
    return c.json({ error: 'Failed to record interaction' }, 500);
  }
});

api.post('/journey/end', async (c) => {
  try {
    const body = await c.req.json<{ journeyId: string; complete?: boolean; game?: { win?: boolean; score?: number } }>();
    if (!body.journeyId) {
      return c.json({ error: 'journeyId required' }, 400);
    }
    const user = await getUser();
    const response = await telemetry.endJourney({
      journeyId: body.journeyId,
      complete: body.complete ?? false,
      ...(body.game ? { game: { win: body.game.win ?? false, score: body.game.score ?? 0 } } : {}),
    });
    console.log('[TELEMETRY]', user, 'journey_ended', body.complete ? 'complete' : 'incomplete');
    return c.json(response);
  } catch (e) {
    console.error('[TELEMETRY] end error:', e);
    return c.json({ error: 'Failed to end journey' }, 500);
  }
});

api.post('/journey/app-ready', async (c) => {
  try {
    const user = await getUser();
    const response = await telemetry.appReady();
    console.log('[TELEMETRY]', user, 'app_ready');
    return c.json(response);
  } catch (e) {
    console.error('[TELEMETRY] app-ready error:', e);
    return c.json({ error: 'Failed to record app ready' }, 500);
  }
});

// ── Client error capture ────────────────────────────────────────────────────
const ERROR_LOG_KEY = 'errors:client';
const ERROR_LOG_CAP = 200;

api.post('/error', async (c) => {
  try {
    const body = await c.req.json<{ username?: string; postId?: string; version?: string; errors: Array<{ message: string; stack?: string; source?: string; tier?: string }> }>();
    const now = Date.now();
    for (const err of (body.errors ?? []).slice(0, 20)) {
      const entry = JSON.stringify({ ts: now, user: body.username, postId: body.postId, version: body.version, message: err.message?.slice(0, 500), stack: err.stack?.slice(0, 500), source: err.source, tier: err.tier });
      await redis.zAdd(ERROR_LOG_KEY, { member: entry, score: now });
    }
    const count = await redis.zCard(ERROR_LOG_KEY);
    if (count > ERROR_LOG_CAP) await redis.zRemRangeByRank(ERROR_LOG_KEY, 0, count - ERROR_LOG_CAP - 1);
    return c.json({ ok: true });
  } catch (e) {
    console.error('[TELEMETRY] error capture failed:', e);
    return c.json({ ok: false }, 500);
  }
});

api.get('/errors', requireDev, async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 500);
  const raw = await redis.zRange(ERROR_LOG_KEY, 0, -1).catch(() => [] as Array<string | { member: string; score: number }>);
  const entries = raw
    .map((entry) => { try { return JSON.parse(typeof entry === 'string' ? entry : entry?.member ?? ''); } catch { return null; } })
    .filter(Boolean)
    .slice(-limit)
    .reverse();
  return c.json({ count: entries.length, entries });
});

api.delete('/errors', requireDev, async (c) => {
  await redis.del(ERROR_LOG_KEY);
  return c.json({ ok: true, cleared: true });
});

export default api;
