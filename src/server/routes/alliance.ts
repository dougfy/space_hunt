import { Hono } from 'hono';
import { context, redis } from '@devvit/web/server';
import type {
  Alliance,
  AllianceInfoResponse,
  AllianceInvitesResponse,
  AllianceChatResponse,
  AllianceChatMessage,
  AllianceCreateRequest,
  AllianceInviteRequest,
  AllianceRespondRequest,
  AllianceLeaveRequest,
  AllianceKickRequest,
  AllianceChatSendRequest,
  AllianceInvite,
  DirectMessage,
  AllianceItemOffer,
  AllianceItemOfferCreateRequest,
  AllianceItemOfferResponse,
} from '../../shared/api';
import { ITEM_CATALOG } from '../../shared/items';
import { grantItem, consumeItem } from '../core/game-service';

const alliance = new Hono();

// ── Redis Key Helpers ─────────────────────────────────────────────────────────

/** Alliance record: JSON blob with id, name, manager, members, createdAt */
function allianceKey(allianceId: string): string {
  return `alliance:${allianceId}`;
}

/** Player → alliance mapping: stores allianceId string */
function playerAllianceKey(username: string): string {
  return `player_alliance:${username.toLowerCase()}`;
}

/** Pending invites for a player: JSON array of AllianceInvite */
function invitesKey(username: string): string {
  return `alliance_invites:${username.toLowerCase()}`;
}

/** Alliance chat: sorted set of JSON messages scored by timestamp */
function chatKey(allianceId: string): string {
  return `alliance_chat:${allianceId}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getAlliance(allianceId: string): Promise<Alliance | null> {
  const data = await redis.get(allianceKey(allianceId));
  if (!data) return null;
  return JSON.parse(data) as Alliance;
}

async function saveAlliance(a: Alliance): Promise<void> {
  await redis.set(allianceKey(a.id), JSON.stringify(a));
}

async function deleteAlliance(allianceId: string): Promise<void> {
  await redis.del(allianceKey(allianceId));
  await redis.del(chatKey(allianceId));
}

async function getPlayerAllianceId(username: string): Promise<string | null> {
  return (await redis.get(playerAllianceKey(username))) ?? null;
}

async function setPlayerAlliance(username: string, allianceId: string): Promise<void> {
  await redis.set(playerAllianceKey(username), allianceId);
}

async function clearPlayerAlliance(username: string): Promise<void> {
  await redis.del(playerAllianceKey(username));
}

async function getInvites(username: string): Promise<AllianceInvite[]> {
  const data = await redis.get(invitesKey(username));
  if (!data) return [];
  const invites = JSON.parse(data) as AllianceInvite[];
  // Filter out expired invites (24h)
  const now = Date.now();
  return invites.filter(inv => now - inv.createdAt < 86400000);
}

async function saveInvites(username: string, invites: AllianceInvite[]): Promise<void> {
  if (invites.length === 0) {
    await redis.del(invitesKey(username));
  } else {
    await redis.set(invitesKey(username), JSON.stringify(invites));
    await redis.expire(invitesKey(username), 86400);
  }
}

function itemOfferKey(offerId: string): string {
  return `alliance_item_offer:${offerId}`;
}

async function getItemOffer(offerId: string): Promise<AllianceItemOffer | null> {
  const raw = await redis.get(itemOfferKey(offerId));
  if (!raw) return null;
  try { return JSON.parse(raw) as AllianceItemOffer; } catch { return null; }
}

async function saveItemOffer(offer: AllianceItemOffer): Promise<void> {
  await redis.set(itemOfferKey(offer.offerId), JSON.stringify(offer));
}

async function areAllianceMembers(first: string, second: string): Promise<boolean> {
  const firstAlliance = await getPlayerAllianceId(first);
  const secondAlliance = await getPlayerAllianceId(second);
  return firstAlliance != null && firstAlliance === secondAlliance;
}

async function listItemOffers(username: string): Promise<AllianceItemOffer[]> {
  const offers: AllianceItemOffer[] = [];
  const now = Date.now();
  const rawKeys = await redis.get(`alliance_item_offers:${username.toLowerCase()}`);
  if (!rawKeys) return offers;
  let ids: string[];
  try { ids = JSON.parse(rawKeys) as string[]; } catch { return offers; }
  for (const id of ids) {
    const offer = await getItemOffer(id);
    if (!offer) continue;
    if (offer.status === 'offered' && offer.expiresAt <= now) {
      await grantItem(redis, offer.fromUser, offer.itemId, offer.count);
      offer.status = 'expired';
      await saveItemOffer(offer);
    }
    if (offer.status === 'offered' && offer.toUser.toLowerCase() === username.toLowerCase()) offers.push(offer);
  }
  return offers;
}

async function indexItemOffer(username: string, offerId: string): Promise<void> {
  const key = `alliance_item_offers:${username.toLowerCase()}`;
  const raw = await redis.get(key);
  let ids: string[] = [];
  if (raw) { try { ids = JSON.parse(raw) as string[]; } catch { ids = []; } }
  if (!ids.includes(offerId)) await redis.set(key, JSON.stringify([...ids, offerId]));
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** Get current user's alliance info. */
alliance.get('/info', async (c) => {
  const username = c.req.query('username');
  if (!username) return c.json<AllianceInfoResponse>({ alliance: null });

  const allianceId = await getPlayerAllianceId(username);
  if (!allianceId) return c.json<AllianceInfoResponse>({ alliance: null });

  const a = await getAlliance(allianceId);
  if (!a) {
    // Stale mapping — clean up
    await clearPlayerAlliance(username);
    return c.json<AllianceInfoResponse>({ alliance: null });
  }

  return c.json<AllianceInfoResponse>({ alliance: a });
});

/** List pending item offers for the current player. */
alliance.get('/item-offers', async (c) => {
  const username = c.req.query('username');
  if (!username) return c.json<AllianceItemOfferResponse>({ offers: [] });
  return c.json<AllianceItemOfferResponse>({ offers: await listItemOffers(username) });
});

/** Offer an existing inventory item to an alliance member. */
alliance.post('/item-offers', async (c) => {
  const body = await c.req.json<AllianceItemOfferCreateRequest>();
  if (!body.username || !body.target || !ITEM_CATALOG[body.itemId]) return c.json({ error: 'username, target, and valid itemId required' }, 400);
  if (!Number.isInteger(body.count) || body.count < 1) return c.json({ error: 'count must be a positive integer' }, 400);
  if (body.username.toLowerCase() === body.target.toLowerCase()) return c.json({ error: 'Cannot offer an item to yourself' }, 400);
  if (!await areAllianceMembers(body.username, body.target)) return c.json({ error: 'Both players must be in the same alliance' }, 400);
  try {
    await consumeItem(redis, body.username, body.itemId, body.count);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Unable to reserve item' }, 400);
  }
  const now = Date.now();
  const offer: AllianceItemOffer = {
    offerId: `offer_${now}_${Math.random().toString(36).slice(2, 8)}`,
    fromUser: body.username,
    toUser: body.target,
    itemId: body.itemId,
    count: body.count,
    createdAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000,
    status: 'offered',
  };
  await saveItemOffer(offer);
  await indexItemOffer(body.target, offer.offerId);
  return c.json({ ok: true, offer });
});

/** Accept or decline an item offer. */
alliance.post('/item-offers/respond', async (c) => {
  const body = await c.req.json<{ username: string; offerId: string; accept: boolean }>();
  const offer = await getItemOffer(body.offerId);
  if (!offer || offer.status !== 'offered') return c.json({ error: 'Offer is no longer available' }, 400);
  if (offer.toUser.toLowerCase() !== body.username?.toLowerCase()) return c.json({ error: 'Only the recipient can respond' }, 403);
  if (offer.expiresAt <= Date.now()) {
    offer.status = 'expired';
    await grantItem(redis, offer.fromUser, offer.itemId, offer.count);
    await saveItemOffer(offer);
    return c.json({ error: 'Offer expired' }, 400);
  }
  if (body.accept) {
    if (!await areAllianceMembers(offer.fromUser, offer.toUser)) {
      await grantItem(redis, offer.fromUser, offer.itemId, offer.count);
      offer.status = 'expired';
      await saveItemOffer(offer);
      return c.json({ error: 'Players are no longer in the same alliance' }, 400);
    }
    await grantItem(redis, offer.toUser, offer.itemId, offer.count);
    offer.status = 'accepted';
  } else {
    await grantItem(redis, offer.fromUser, offer.itemId, offer.count);
    offer.status = 'declined';
  }
  await saveItemOffer(offer);
  return c.json({ ok: true, offer });
});

/** Create a new alliance. */
alliance.post('/create', async (c) => {
  const body = await c.req.json<AllianceCreateRequest>();
  if (!body.username || !body.name?.trim()) {
    return c.json({ error: 'username and name required' }, 400);
  }

  const name = body.name.trim().slice(0, 20);
  if (!/^[a-zA-Z0-9 ]+$/.test(name)) {
    return c.json({ error: 'Alliance name must be alphanumeric (spaces allowed)' }, 400);
  }

  // Check if player already in an alliance
  const existing = await getPlayerAllianceId(body.username);
  if (existing) {
    return c.json({ error: 'You are already in an alliance. Leave first.' }, 400);
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const a: Alliance = {
    id,
    name,
    manager: body.username,
    members: [body.username],
    createdAt: Date.now(),
  };

  await saveAlliance(a);
  await setPlayerAlliance(body.username, id);
  console.log(`[ALLIANCE] Created "${name}" by ${body.username} (id=${id})`);

  return c.json({ ok: true, alliance: a });
});

/** Invite a player to the alliance. Manager only. */
alliance.post('/invite', async (c) => {
  const body = await c.req.json<AllianceInviteRequest>();
  if (!body.username || !body.target) {
    return c.json({ error: 'username and target required' }, 400);
  }

  // Get sender's alliance
  const allianceId = await getPlayerAllianceId(body.username);
  if (!allianceId) return c.json({ error: 'You are not in an alliance' }, 400);

  const a = await getAlliance(allianceId);
  if (!a) return c.json({ error: 'Alliance not found' }, 400);

  // Only manager can invite
  if (a.manager !== body.username) {
    return c.json({ error: 'Only the alliance manager can invite players' }, 400);
  }

  // Check member limit
  if (a.members.length >= 10) {
    return c.json({ error: 'Alliance is full (max 10 members)' }, 400);
  }

  // Check if target is already in an alliance
  const targetAlliance = await getPlayerAllianceId(body.target);
  if (targetAlliance) {
    return c.json({ error: `${body.target} is already in an alliance` }, 400);
  }

  // Check if already invited
  const invites = await getInvites(body.target);
  if (invites.some(inv => inv.allianceId === allianceId)) {
    return c.json({ error: `${body.target} already has a pending invite` }, 400);
  }

  // Add invite
  invites.push({
    allianceId,
    allianceName: a.name,
    invitedBy: body.username,
    createdAt: Date.now(),
  });
  await saveInvites(body.target, invites);
  console.log(`[ALLIANCE] ${body.username} invited ${body.target} to "${a.name}"`);

  // Send a DM to the target explaining the invite
  try {
    const postId = context.postId;
    if (postId) {
      const now = Date.now();
      const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
      const msg: DirectMessage = {
        id,
        from: body.username,
        to: body.target,
        body: `[ALLIANCE] You've been invited to join "${a.name}"! Open COMS > ALLIANCE to accept or decline.`,
        createdAt: now,
      };
      const sorted = [body.username.toLowerCase(), body.target.toLowerCase()].sort();
      const channelKey = `dm:${postId}:${sorted[0]}:${sorted[1]}`;
      await redis.zAdd(channelKey, { member: JSON.stringify(msg), score: now });
      // Mark unread for recipient
      const unreadKey = `dm:unread:${postId}:${body.target.toLowerCase()}`;
      await redis.zAdd(unreadKey, { member: body.username.toLowerCase(), score: now });
    }
  } catch (e) {
    console.warn('[ALLIANCE] Failed to send invite DM:', e);
  }

  return c.json({ ok: true });
});

/** Get pending invites for a user. */
alliance.get('/invites', async (c) => {
  const username = c.req.query('username');
  if (!username) return c.json<AllianceInvitesResponse>({ invites: [] });

  const invites = await getInvites(username);
  return c.json<AllianceInvitesResponse>({ invites });
});

/** Accept or reject an invite. */
alliance.post('/respond', async (c) => {
  const body = await c.req.json<AllianceRespondRequest>();
  if (!body.username || !body.allianceId) {
    return c.json({ error: 'username and allianceId required' }, 400);
  }

  // Remove invite regardless of accept/reject
  const invites = await getInvites(body.username);
  const remaining = invites.filter(inv => inv.allianceId !== body.allianceId);
  await saveInvites(body.username, remaining);

  if (!body.accept) {
    console.log(`[ALLIANCE] ${body.username} rejected invite to ${body.allianceId}`);
    return c.json({ ok: true, action: 'rejected' });
  }

  // Accept — check constraints
  const existing = await getPlayerAllianceId(body.username);
  if (existing) {
    return c.json({ error: 'You are already in an alliance. Leave first.' }, 400);
  }

  const a = await getAlliance(body.allianceId);
  if (!a) return c.json({ error: 'Alliance no longer exists' }, 400);

  if (a.members.length >= 10) {
    return c.json({ error: 'Alliance is full' }, 400);
  }

  // Add member
  a.members.push(body.username);
  await saveAlliance(a);
  await setPlayerAlliance(body.username, a.id);
  console.log(`[ALLIANCE] ${body.username} joined "${a.name}"`);

  // Post a system message to alliance chat
  const joinMsg: AllianceChatMessage = {
    from: '__system__',
    text: `${body.username} has joined the alliance.`,
    createdAt: Date.now(),
  };
  await redis.zAdd(chatKey(a.id), { member: JSON.stringify(joinMsg), score: joinMsg.createdAt });

  return c.json({ ok: true, action: 'joined', alliance: a });
});

/** Leave the alliance. */
alliance.post('/leave', async (c) => {
  const body = await c.req.json<AllianceLeaveRequest>();
  if (!body.username) return c.json({ error: 'username required' }, 400);

  const allianceId = await getPlayerAllianceId(body.username);
  if (!allianceId) return c.json({ error: 'You are not in an alliance' }, 400);

  const a = await getAlliance(allianceId);
  if (!a) {
    await clearPlayerAlliance(body.username);
    return c.json({ ok: true });
  }

  // Remove member
  a.members = a.members.filter(m => m !== body.username);
  await clearPlayerAlliance(body.username);

  if (a.members.length === 0) {
    // Last member left — dissolve alliance
    await deleteAlliance(a.id);
    console.log(`[ALLIANCE] "${a.name}" dissolved (last member ${body.username} left)`);
    return c.json({ ok: true, dissolved: true });
  }

  // If manager left, promote oldest remaining member
  if (a.manager === body.username) {
    a.manager = a.members[0] ?? body.username;
    console.log(`[ALLIANCE] Manager ${body.username} left "${a.name}", promoted ${a.manager}`);
  }

  await saveAlliance(a);

  // Post system message
  const leaveMsg: AllianceChatMessage = {
    from: '__system__',
    text: `${body.username} has left the alliance.`,
    createdAt: Date.now(),
  };
  await redis.zAdd(chatKey(a.id), { member: JSON.stringify(leaveMsg), score: leaveMsg.createdAt });

  console.log(`[ALLIANCE] ${body.username} left "${a.name}"`);
  return c.json({ ok: true });
});

/** Kick a member. Manager only. */
alliance.post('/kick', async (c) => {
  const body = await c.req.json<AllianceKickRequest>();
  if (!body.username || !body.target) {
    return c.json({ error: 'username and target required' }, 400);
  }

  const allianceId = await getPlayerAllianceId(body.username);
  if (!allianceId) return c.json({ error: 'You are not in an alliance' }, 400);

  const a = await getAlliance(allianceId);
  if (!a) return c.json({ error: 'Alliance not found' }, 400);

  if (a.manager !== body.username) {
    return c.json({ error: 'Only the manager can kick members' }, 400);
  }

  if (body.target === body.username) {
    return c.json({ error: 'Cannot kick yourself. Use leave instead.' }, 400);
  }

  if (!a.members.includes(body.target)) {
    return c.json({ error: `${body.target} is not in this alliance` }, 400);
  }

  a.members = a.members.filter(m => m !== body.target);
  await saveAlliance(a);
  await clearPlayerAlliance(body.target);

  // Post system message
  const kickMsg: AllianceChatMessage = {
    from: '__system__',
    text: `${body.target} was removed from the alliance.`,
    createdAt: Date.now(),
  };
  await redis.zAdd(chatKey(a.id), { member: JSON.stringify(kickMsg), score: kickMsg.createdAt });

  console.log(`[ALLIANCE] ${body.username} kicked ${body.target} from "${a.name}"`);
  return c.json({ ok: true });
});

/** Get alliance chat messages. */
alliance.get('/chat', async (c) => {
  const username = c.req.query('username');
  if (!username) return c.json<AllianceChatResponse>({ messages: [] });

  const allianceId = await getPlayerAllianceId(username);
  if (!allianceId) return c.json<AllianceChatResponse>({ messages: [] });

  // Get last 50 messages
  const raw = await redis.zRange(chatKey(allianceId), 0, 49, { by: 'rank', reverse: true });
  const messages: AllianceChatMessage[] = raw
    .map(entry => JSON.parse(entry.member) as AllianceChatMessage)
    .reverse(); // oldest first

  return c.json<AllianceChatResponse>({ messages });
});

/** Send a message to alliance chat. */
alliance.post('/chat', async (c) => {
  const body = await c.req.json<AllianceChatSendRequest>();
  if (!body.username || !body.text?.trim()) {
    return c.json({ error: 'username and text required' }, 400);
  }

  const allianceId = await getPlayerAllianceId(body.username);
  if (!allianceId) return c.json({ error: 'You are not in an alliance' }, 400);

  // Verify alliance still exists and user is a member
  const a = await getAlliance(allianceId);
  if (!a || !a.members.includes(body.username)) {
    await clearPlayerAlliance(body.username);
    return c.json({ error: 'Alliance not found' }, 400);
  }

  const text = body.text.trim().slice(0, 500);
  const msg: AllianceChatMessage = {
    from: body.username,
    text,
    createdAt: Date.now(),
  };

  await redis.zAdd(chatKey(allianceId), { member: JSON.stringify(msg), score: msg.createdAt });

  // Trim to last 50 messages
  const count = await redis.zCard(chatKey(allianceId));
  if (count > 50) {
    await redis.zRemRangeByRank(chatKey(allianceId), 0, count - 51);
  }

  return c.json({ ok: true });
});

export default alliance;
