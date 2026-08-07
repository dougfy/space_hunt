import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type { ComsMessage, ComsResponse, ComsReplyRequest, ComsUnreadResponse, DirectMessage, DMListResponse, DMSendRequest, DMUnreadResponse, DMReportRequest, PublicComment, PublicCommentsResponse, PublicCommentPostRequest } from '../../shared/api';

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

// ── Direct Messages ───────────────────────────────────────────────────────────

/** Build a deterministic DM channel key from two usernames. */
function dmChannelKey(postId: string, userA: string, userB: string): string {
  const sorted = [userA.toLowerCase(), userB.toLowerCase()].sort();
  return `dm:${postId}:${sorted[0]}:${sorted[1]}`;
}

/** Send a direct message to another player. */
coms.post('/dm/send', async (c) => {
  const { postId } = context;
  if (!postId) return c.json({ error: 'no postId' }, 400);

  const body = await c.req.json<DMSendRequest>();
  if (!body.from || !body.to || !body.text?.trim()) {
    return c.json({ error: 'from, to, and text required' }, 400);
  }
  if (body.from.toLowerCase() === body.to.toLowerCase()) {
    return c.json({ error: 'cannot message yourself' }, 400);
  }

  const text = body.text.trim().slice(0, 500);
  const now = Date.now();
  const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
  const msg: DirectMessage = {
    id,
    from: body.from,
    to: body.to,
    body: text,
    createdAt: now,
  };

  const channelKey = dmChannelKey(postId, body.from, body.to);
  await redis.zAdd(channelKey, { member: JSON.stringify(msg), score: now });

  // Mark unread for recipient
  const unreadKey = `dm:unread:${postId}:${body.to.toLowerCase()}`;
  await redis.zAdd(unreadKey, { member: body.from.toLowerCase(), score: now });

  // Auto-reply from fake "Enemy" player (echo for testing)
  if (body.to.toLowerCase() === 'enemy') {
    try {
      const replyNow = Date.now();
      const replyId = `${replyNow}-${Math.random().toString(36).slice(2, 8)}`;
      const replyMsg: DirectMessage = {
        id: replyId,
        from: 'Enemy',
        to: body.from,
        body: `Copy that: "${text}"`,
        createdAt: replyNow,
      };
      await redis.zAdd(channelKey, { member: JSON.stringify(replyMsg), score: replyNow });
      // Mark unread for sender
      const senderUnreadKey = `dm:unread:${postId}:${body.from.toLowerCase()}`;
      await redis.zAdd(senderUnreadKey, { member: 'enemy', score: replyNow });
    } catch (_e) { /* ignore echo failure */ }
  }

  // Auto-reply from VALCORDIA_PROBE bot
  if (body.to.toLowerCase() === 'valcordia_probe') {
    try {
      const probeReplies = [
        '⚡ PROBE ONLINE. Scanning sector... all systems nominal.',
        '📡 Signal received. Automated survey in progress.',
        '🛰️ VALCORDIA_PROBE acknowledges. Resource scan active.',
        '⚙️ Probe operational. No threats detected in vicinity.',
        '📊 Telemetry link established. Mining yield: optimal.',
        '🔋 Power cells at 94%. Continuing autonomous patrol.',
        '🌌 Sector mapped. Forwarding coordinates to fleet command.',
        '⚠️ Automated unit — unable to process complex requests.',
      ];
      const replyNow = Date.now();
      const replyId = `${replyNow}-${Math.random().toString(36).slice(2, 8)}`;
      const replyText = probeReplies[Math.floor(Math.random() * probeReplies.length)]!;
      const replyMsg: DirectMessage = {
        id: replyId,
        from: 'VALCORDIA_PROBE',
        to: body.from,
        body: replyText,
        createdAt: replyNow,
      };
      await redis.zAdd(channelKey, { member: JSON.stringify(replyMsg), score: replyNow });
      const senderUnreadKey = `dm:unread:${postId}:${body.from.toLowerCase()}`;
      await redis.zAdd(senderUnreadKey, { member: 'valcordia_probe', score: replyNow });
    } catch (_e) { /* ignore bot reply failure */ }
  }

  return c.json({ ok: true, id });
});

/** Get DM conversation with a specific player. */
coms.get('/dm/messages', async (c) => {
  const { postId } = context;
  const user = c.req.query('username');
  const peer = c.req.query('peer');
  if (!postId || !user || !peer) return c.json<DMListResponse>({ messages: [] });

  const channelKey = dmChannelKey(postId, user, peer);
  try {
    const raw = await redis.zRange(channelKey, 0, -1);
    const messages: DirectMessage[] = raw.map(entry => {
      try { return JSON.parse(entry.member) as DirectMessage; }
      catch { return null; }
    }).filter((m): m is DirectMessage => m !== null);
    // Keep only last 50 messages
    return c.json<DMListResponse>({ messages: messages.slice(-50) });
  } catch (e) {
    console.error('[DM] Failed to load messages:', e);
    return c.json<DMListResponse>({ messages: [] });
  }
});

/** Check which players have sent unread DMs. */
coms.get('/dm/unread', async (c) => {
  const { postId } = context;
  const user = c.req.query('username');
  if (!postId || !user) return c.json<DMUnreadResponse>({ unreadFrom: [] });

  try {
    const unreadKey = `dm:unread:${postId}:${user.toLowerCase()}`;
    const raw = await redis.zRange(unreadKey, 0, -1);
    const unreadFrom = raw.map(entry => entry.member);
    return c.json<DMUnreadResponse>({ unreadFrom });
  } catch (e) {
    console.error('[DM] Failed to check unread:', e);
    return c.json<DMUnreadResponse>({ unreadFrom: [] });
  }
});

/** Mark DMs from a specific player as read. */
coms.post('/dm/mark-read', async (c) => {
  const { postId } = context;
  const user = c.req.query('username');
  const peer = c.req.query('peer');
  if (!postId || !user || !peer) return c.json({ ok: false }, 400);

  try {
    const unreadKey = `dm:unread:${postId}:${user.toLowerCase()}`;
    await redis.zRem(unreadKey, [peer.toLowerCase()]);
  } catch (e) {
    console.error('[DM] Failed to mark read:', e);
  }
  return c.json({ ok: true });
});

/** Report a DM message — stores in Redis and sends to subreddit modmail. */
coms.post('/dm/report', async (c) => {
  const { postId, subredditName } = context;
  if (!postId) return c.json({ error: 'no postId' }, 400);

  const body = await c.req.json<DMReportRequest>();
  if (!body.reporterUsername || !body.reportedUsername || !body.messageBody) {
    return c.json({ error: 'reporterUsername, reportedUsername, and messageBody required' }, 400);
  }

  // Prevent duplicate reports for the same message by this reporter
  const reportKey = `reports:${postId}`;
  const dedupMember = `${body.reporterUsername.toLowerCase()}:${body.messageId}`;
  const existing = await redis.zScore(reportKey, dedupMember).catch(() => undefined);
  if (existing !== undefined) {
    return c.json({ ok: true, message: 'Already reported' });
  }

  // Store report in Redis sorted set (score = timestamp)
  const now = Date.now();
  const reportData = JSON.stringify({
    messageId: body.messageId,
    reporter: body.reporterUsername,
    reported: body.reportedUsername,
    messageBody: body.messageBody.slice(0, 500),
    createdAt: now,
  });
  await redis.zAdd(reportKey, { member: dedupMember, score: now });
  await redis.zAdd(`${reportKey}:details`, { member: reportData, score: now });

  // Send to subreddit modmail (internal mod discussion — no "to" user)
  const subName = subredditName ?? 'valcordia_space_dev';
  try {
    const truncatedBody = body.messageBody.length > 200
      ? body.messageBody.slice(0, 200) + '...'
      : body.messageBody;
    await reddit.modMail.createConversation({
      subredditName: subName,
      subject: `[In-Game DM Report] ${body.reportedUsername}`,
      body: [
        `**Reported user:** u/${body.reportedUsername}`,
        `**Reported by:** u/${body.reporterUsername}`,
        `**Message ID:** ${body.messageId}`,
        `**Post ID:** ${postId}`,
        '',
        `**Message content:**`,
        `> ${truncatedBody}`,
        '',
        '*This report was submitted from the in-game DM system.*',
      ].join('\n'),
      to: body.reportedUsername,
      isAuthorHidden: true,
    });
    console.log(`[REPORT] Modmail sent for report by ${body.reporterUsername} against ${body.reportedUsername}`);
  } catch (e) {
    // Log but don't fail — the Redis record is the primary store
    console.error('[REPORT] Failed to send modmail:', e);
  }

  return c.json({ ok: true, message: 'Report submitted' });
});

// ── Public Comments (Reddit Thread) ──────────────────────────────────────────

/** Recursively build a tree of PublicComment from Reddit comment listing. */
async function buildCommentTree(
  comments: Awaited<ReturnType<typeof reddit.getComments>>,
  maxDepth: number = 2,
  currentDepth: number = 0,
): Promise<PublicComment[]> {
  const result: PublicComment[] = [];
  const all = await comments.all();
  for (const comment of all) {
    const pc: PublicComment = {
      id: comment.id,
      author: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt.getTime(),
      replies: [],
    };
    if (currentDepth < maxDepth && comment.replies) {
      try {
        pc.replies = await buildCommentTree(comment.replies, maxDepth, currentDepth + 1);
      } catch (_e) { /* no replies */ }
    }
    result.push(pc);
  }
  return result;
}

/** Fetch public comments on the game post (tree structure). */
coms.get('/public/messages', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<PublicCommentsResponse>({ comments: [] });

  try {
    const fullId = postId.startsWith('t3_') ? postId : `t3_${postId}`;
    const listing = reddit.getComments({
      postId: fullId as `t3_${string}`,
      sort: 'new',
      limit: 30,
      pageSize: 30,
    });
    const tree = await buildCommentTree(listing);
    // Flatten tree so replies appear as top-level messages (chat-style)
    function flattenTree(nodes: PublicComment[]): PublicComment[] {
      const flat: PublicComment[] = [];
      for (const node of nodes) {
        flat.push({ ...node, replies: [] });
        if (node.replies.length > 0) {
          flat.push(...flattenTree(node.replies));
        }
      }
      return flat;
    }
    const comments = flattenTree(tree);

    // Post any queued Enemy echoes to Reddit (only if enough time has passed to avoid rate limit)
    try {
      const key = `pending_echoes:${postId}`;
      const queueData = await redis.get(key);
      if (queueData) {
        const queue: { text: string; postAt: number }[] = JSON.parse(queueData);
        const now = Date.now();
        const ready = queue.filter(item => now >= item.postAt);
        const remaining = queue.filter(item => now < item.postAt);
        if (ready.length > 0) {
          // Post one echo per poll to stay under rate limit
          const echo = ready.shift()!;
          const stillRemaining = [...ready, ...remaining];
          if (stillRemaining.length > 0) {
            await redis.set(key, JSON.stringify(stillRemaining));
          } else {
            await redis.del(key);
          }
          // Post to Reddit as a real comment
          const echoTarget = (fullId) as `t3_${string}`;
          await reddit.submitComment({ id: echoTarget, text: echo.text });
          console.log('[COMS/PUBLIC] Enemy echo posted to Reddit:', echo.text);
          // Inject into current response so it shows immediately
          comments.push({
            id: `echo_${now}`,
            author: 'valcordia-space',
            body: echo.text,
            createdAt: now,
            replies: [],
          });
        }
      }
    } catch (echoErr) {
      console.error('[COMS/PUBLIC] Failed to post queued echo:', echoErr);
    }

    // Sort oldest first (chat style)
    comments.sort((a, b) => a.createdAt - b.createdAt);
    return c.json<PublicCommentsResponse>({ comments });
  } catch (e) {
    console.error('[COMS/PUBLIC] Failed to fetch:', e);
    return c.json<PublicCommentsResponse>({ comments: [] });
  }
});

/** Post a public comment (or reply) on the game thread as the user. */
coms.post('/public/post', async (c) => {
  const { postId } = context;
  if (!postId) return c.json({ error: 'no postId' }, 400);

  const body = await c.req.json<PublicCommentPostRequest>();
  if (!body.text || body.text.trim().length === 0) {
    return c.json({ error: 'text required' }, 400);
  }
  const rawText = body.text.trim().slice(0, 1000);
  const poster = body.username || 'Unknown';
  console.log(`[COMS/PUBLIC] Post from ${poster}: "${rawText}" (parentId=${body.parentId ?? 'none'})`);
  // Prefix with username so it's clear who posted (app posts on behalf of user)
  const text = `**${poster}**: ${rawText}`;

  try {
    // Determine target: reply to a comment or top-level post
    const targetId = body.parentId
      ? (body.parentId.startsWith('t1_') ? body.parentId : `t1_${body.parentId}`) as `t1_${string}`
      : (postId.startsWith('t3_') ? postId : `t3_${postId}`) as `t3_${string}`;

    await reddit.submitComment({
      id: targetId,
      text,
    });
    console.log(`[COMS/PUBLIC] User comment posted OK. rawText="${rawText}"`);

    // Auto-reply from fake "Enemy" player if message mentions u/Enemy
    // Queue it in Redis with timestamp; it will be posted to Reddit on a later poll (avoids 5s rate limit)
    if (rawText.toLowerCase().includes('u/enemy')) {
      const userMsg = rawText.replace(/u\/enemy\s*/i, '').trim();
      const echoText = `**Enemy**: Copy that: "${userMsg}"`;
      console.log('[COMS/PUBLIC] Enemy echo queued for later poll');
      try {
        const key = `pending_echoes:${postId}`;
        const existing = await redis.get(key);
        const queue: { text: string; postAt: number }[] = existing ? JSON.parse(existing) : [];
        queue.push({ text: echoText, postAt: Date.now() + 8000 }); // post after 8s
        await redis.set(key, JSON.stringify(queue));
        await redis.expire(key, 300);
      } catch (redisErr) {
        console.error('[COMS/PUBLIC] Failed to queue echo:', redisErr);
      }
    }

    return c.json({ ok: true });
  } catch (e) {
    console.error('[COMS/PUBLIC] Failed to post:', e);
    return c.json({ error: 'Failed to post comment' }, 500);
  }
});

export default coms;
