import { Hono } from 'hono';
import { redis, reddit } from '@devvit/web/server';
import { getAdminPlayerStats, getClaimedStars } from '../core/game-service';
import { tickAutoBot, isAutoBot } from '../core/autobot';

export const schedulerRoutes = new Hono();

const ACTIVE_POST_KEY = 'app:active_post_id';

/** Store the active post ID so the scheduler can find it without post context. */
export async function setActivePostId(postId: string): Promise<void> {
  await redis.set(ACTIVE_POST_KEY, postId);
}

/** Retrieve the stored active post ID. */
async function getActivePostId(): Promise<string | undefined> {
  return (await redis.get(ACTIVE_POST_KEY)) ?? undefined;
}

// ── Weekly Leaderboard ──────────────────────────────────────────────────────

schedulerRoutes.post('/weekly-leaderboard', async (c) => {
  console.log('[SCHEDULER] weekly-leaderboard triggered');

  const postId = await getActivePostId();
  if (!postId) {
    console.error('[SCHEDULER] No active postId stored — cannot post leaderboard');
    return c.json({ status: 'error', message: 'no active postId' }, 500);
  }

  try {
    const adminStats = await getAdminPlayerStats(redis, postId);
    const claims = await getClaimedStars(redis, postId);

    // Count stars per player
    const starCounts = new Map<string, number>();
    for (const claim of claims) {
      starCounts.set(claim.username, (starCounts.get(claim.username) ?? 0) + 1);
    }

    // Deduplicate by username
    const seen = new Map<string, typeof adminStats.players[number]>();
    for (const p of adminStats.players) {
      if (isAutoBot(p.username)) continue; // exclude NPC bots
      if (!seen.has(p.username)) {
        seen.set(p.username, p);
      }
    }

    // Compute power scores and sort
    const entries = [...seen.values()].map(p => {
      const starCount = starCounts.get(p.username) ?? 0;
      const power = starCount * 100 + p.totalShips * 10 + p.totalBuildingLevels * 25 + Math.floor(p.playtimeSeconds / 720);
      return { username: p.username, starCount, totalShips: p.totalShips, power };
    });

    entries.sort((a, b) => b.power - a.power);

    if (entries.length === 0) {
      console.log('[SCHEDULER] No players to post leaderboard for');
      return c.json({ status: 'ok', message: 'no players' });
    }

    // Format the leaderboard comment
    const top = entries.slice(0, 10);
    const lines = [
      '## 🏆 Weekly Leaderboard',
      '',
      '| Rank | Commander | Stars | Ships | Power |',
      '|---:|:---|---:|---:|---:|',
    ];
    for (let i = 0; i < top.length; i++) {
      const e = top[i]!;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
      lines.push(`| ${medal} | u/${e.username} | ${e.starCount} | ${e.totalShips} | ${e.power} |`);
    }
    lines.push('', `*${entries.length} commanders active this week.*`);

    const text = lines.join('\n');

    const fullId = postId.startsWith('t3_') ? postId : `t3_${postId}`;
    await reddit.submitComment({
      id: fullId as `t3_${string}`,
      text,
      runAs: 'APP',
    });

    console.log(`[SCHEDULER] Weekly leaderboard posted (${top.length} entries)`);
    return c.json({ status: 'ok', message: `posted ${top.length} entries` });
  } catch (e) {
    console.error('[SCHEDULER] Failed to post weekly leaderboard:', e);
    return c.json({ status: 'error', message: String(e) }, 500);
  }
});

// ── Autobot Tick ────────────────────────────────────────────────────────────

schedulerRoutes.post('/autobot-tick', async (c) => {
  console.log('[SCHEDULER] autobot-tick triggered');

  try {
    const result = await tickAutoBot();
    console.log(`[SCHEDULER] autobot-tick complete: action=${result.action} fsm=${result.state.fsm}`);
    return c.json({ status: 'ok', action: result.action, fsm: result.state.fsm, tick: result.state.tickCount });
  } catch (e) {
    console.error('[SCHEDULER] autobot-tick failed:', e);
    return c.json({ status: 'error', message: String(e) }, 500);
  }
});
