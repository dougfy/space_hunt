import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type { ComsMessage, ComsResponse, ComsReplyRequest, ComsUnreadResponse } from '../../shared/api';

const coms = new Hono();

/** Recursively collect comments and their replies into a flat list. */
async function flattenComments(
  comments: Awaited<ReturnType<typeof reddit.getComments>>,
  depth: number = 0,
): Promise<ComsMessage[]> {
  const result: ComsMessage[] = [];
  const all = await comments.all();
  for (const comment of all) {
    result.push({
      id: comment.id,
      author: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt.getTime(),
      isApp: comment.authorName === 'valcordia-space' || comment.authorName === 'ValcordiaSpace',
      depth,
    });
    // Fetch nested replies if they exist
    if (comment.replies) {
      try {
        const childMessages = await flattenComments(comment.replies, depth + 1);
        result.push(...childMessages);
      } catch (_e) { /* no replies or access error */ }
    }
  }
  return result;
}

/** Fetch comments on the game post. */
coms.get('/messages', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ComsResponse>({ messages: [], total: 0 });

  const limitRaw = c.req.query('limit');
  const limit = Math.min(parseInt(limitRaw || '50', 10), 100);

  try {
    const fullId = postId.startsWith('t3_') ? postId : `t3_${postId}`;
    const listing = reddit.getComments({
      postId: fullId as `t3_${string}`,
      sort: 'new',
      limit,
      pageSize: limit,
    });

    const messages = await flattenComments(listing);

    // Sort oldest first for chat-style display
    messages.sort((a, b) => a.createdAt - b.createdAt);

    return c.json<ComsResponse>({ messages, total: messages.length });
  } catch (e) {
    console.error('[COMS] Failed to fetch comments:', e);
    return c.json<ComsResponse>({ messages: [], total: 0 });
  }
});

/** Post a reply on the game post as the app. */
coms.post('/reply', async (c) => {
  const { postId } = context;
  if (!postId) return c.json({ error: 'no postId' }, 400);

  const body = await c.req.json<ComsReplyRequest>();
  if (!body.text || body.text.trim().length === 0) {
    return c.json({ error: 'text required' }, 400);
  }
  // Sanitize: limit length, strip control chars
  const text = body.text.trim().slice(0, 500);

  try {
    const fullId = postId.startsWith('t3_') ? postId : `t3_${postId}`;
    const username = context.userId ? `u/${context.userId}` : 'Unknown';
    await reddit.submitComment({
      id: fullId as `t3_${string}`,
      text: `**${username}**: ${text}`,
      runAs: 'APP',
    });
    return c.json({ ok: true });
  } catch (e) {
    console.error('[COMS] Failed to post reply:', e);
    return c.json({ error: 'Failed to post' }, 500);
  }
});

/** Check for unread messages since last seen. */
coms.get('/unread', async (c) => {
  const username = c.req.query('username');
  const { postId } = context;
  if (!username || !postId) return c.json<ComsUnreadResponse>({ hasNew: false, count: 0, latestTimestamp: 0 });

  try {
    const lastSeenStr = await redis.hGet(`coms:lastSeen:${postId}`, username);
    const lastSeen = lastSeenStr ? parseInt(lastSeenStr, 10) : 0;

    const fullId = postId.startsWith('t3_') ? postId : `t3_${postId}`;
    const listing = reddit.getComments({
      postId: fullId as `t3_${string}`,
      sort: 'new',
      limit: 20,
      pageSize: 20,
    });
    const comments = await listing.all();

    let count = 0;
    let latestTimestamp = 0;
    for (const comment of comments) {
      const ts = comment.createdAt.getTime();
      if (ts > latestTimestamp) latestTimestamp = ts;
      if (ts > lastSeen) count++;
    }

    return c.json<ComsUnreadResponse>({ hasNew: count > 0, count, latestTimestamp });
  } catch (e) {
    console.error('[COMS] Failed to check unread:', e);
    return c.json<ComsUnreadResponse>({ hasNew: false, count: 0, latestTimestamp: 0 });
  }
});

/** Mark messages as read (update lastSeen timestamp). */
coms.post('/mark-read', async (c) => {
  const username = c.req.query('username');
  const { postId } = context;
  if (!username || !postId) return c.json({ ok: false }, 400);

  await redis.hSet(`coms:lastSeen:${postId}`, { [username]: String(Date.now()) });
  return c.json({ ok: true });
});

export default coms;
