import { Hono } from 'hono';
import { telemetry } from '@devvit/analytics/server/reddit';

const api = new Hono();

// ── Devvit Journeys telemetry routes ────────────────────────────────────────
// These forward client-side journey events to the Devvit telemetry plugin.
// Client calls these via `@devvit/analytics/client/reddit` (basePath: /api/telemetry).

api.post('/journey/start', async (c) => {
  try {
    const response = await telemetry.startJourney();
    console.log('[TELEMETRY] journey started:', response.journeyId, 'receipt:', (response as Record<string, unknown>).receipt ?? 'none');
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
    const response = await telemetry.journeyProgress({
      journeyId: body.journeyId,
      progress: body.progress,
      ...(body.action ? { action: body.action } : {}),
      ...(body.actionDetails ? { actionDetails: body.actionDetails } : {}),
    });
    console.log('[TELEMETRY] progress:', body.progress, body.action ?? '', 'receipt:', (response as Record<string, unknown>).receipt ?? 'none');
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
    const response = await telemetry.journeyInteraction({
      journeyId: body.journeyId ?? '',
      action: body.action,
      actionDetails: body.actionDetails ?? '',
    });
    console.log('[TELEMETRY] interaction:', body.action, 'receipt:', (response as Record<string, unknown>).receipt ?? 'none');
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
    const response = await telemetry.endJourney({
      journeyId: body.journeyId,
      complete: body.complete ?? false,
      ...(body.game ? { game: { win: body.game.win ?? false, score: body.game.score ?? 0 } } : {}),
    });
    console.log('[TELEMETRY] journey ended, complete:', body.complete, 'receipt:', (response as Record<string, unknown>).receipt ?? 'none');
    return c.json(response);
  } catch (e) {
    console.error('[TELEMETRY] end error:', e);
    return c.json({ error: 'Failed to end journey' }, 500);
  }
});

api.post('/journey/app-ready', async (c) => {
  try {
    const response = await telemetry.appReady();
    console.log('[TELEMETRY] app ready, receipt:', (response as Record<string, unknown>).receipt ?? 'none');
    return c.json(response);
  } catch (e) {
    console.error('[TELEMETRY] app-ready error:', e);
    return c.json({ error: 'Failed to record app ready' }, 500);
  }
});

export default api;
