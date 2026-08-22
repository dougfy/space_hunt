import { Hono } from 'hono';
import { context, redis } from '@devvit/web/server';
import type { Alliance, AllianceInvite, AllianceChatMessage } from '../../shared/api';
import { requireDev } from '../core/admin-auth';

const bots = new Hono();

// All bot routes require dev access
bots.use('*', requireDev);

// ── Types ───────────────────────────────────────────────────────────────────

type BotRole = 'alliance-manager' | 'alliance-member';

interface BotConfig {
  name: string;
  role: BotRole;
  active: boolean;
  targets: string[]; // players to interact with (for manager: invite targets)
}

interface BotState {
  fsm: string;
  allianceName?: string;
  allianceId?: string;
  lastActionMs: number;
  invitedPlayers: string[];
  chatCount: number;
}

// ── Redis Keys ──────────────────────────────────────────────────────────────

const REGISTRY_KEY = 'bots:registry';
const LAST_TICK_KEY = 'bots:last_tick';
function stateKey(name: string): string { return `bots:state:${name}`; }

// Alliance keys (mirror alliance.ts)
function allianceKey(id: string): string { return `alliance:${id}`; }
function playerAllianceKey(username: string): string { return `player_alliance:${username.toLowerCase()}`; }
function invitesKey(username: string): string { return `alliance_invites:${username.toLowerCase()}`; }
function chatKey(allianceId: string): string { return `alliance_chat:${allianceId}`; }

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getRegistry(): Promise<BotConfig[]> {
  const data = await redis.get(REGISTRY_KEY);
  if (!data) return [];
  return JSON.parse(data) as BotConfig[];
}

async function saveRegistry(reg: BotConfig[]): Promise<void> {
  await redis.set(REGISTRY_KEY, JSON.stringify(reg));
}

async function getState(name: string): Promise<BotState> {
  const data = await redis.get(stateKey(name));
  if (!data) return { fsm: 'init', lastActionMs: 0, invitedPlayers: [], chatCount: 0 };
  return JSON.parse(data) as BotState;
}

async function saveState(name: string, state: BotState): Promise<void> {
  await redis.set(stateKey(name), JSON.stringify(state));
}

// ── Alliance Helpers (direct Redis, same logic as alliance.ts) ──────────────

async function getAlliance(allianceId: string): Promise<Alliance | null> {
  const data = await redis.get(allianceKey(allianceId));
  if (!data) return null;
  return JSON.parse(data) as Alliance;
}

async function saveAlliance(a: Alliance): Promise<void> {
  await redis.set(allianceKey(a.id), JSON.stringify(a));
}

async function getPlayerAllianceId(username: string): Promise<string | null> {
  return (await redis.get(playerAllianceKey(username))) ?? null;
}

async function setPlayerAlliance(username: string, allianceId: string): Promise<void> {
  await redis.set(playerAllianceKey(username), allianceId);
}

async function getInvites(username: string): Promise<AllianceInvite[]> {
  const data = await redis.get(invitesKey(username));
  if (!data) return [];
  return JSON.parse(data) as AllianceInvite[];
}

async function saveInvites(username: string, invites: AllianceInvite[]): Promise<void> {
  if (invites.length === 0) {
    await redis.del(invitesKey(username));
  } else {
    await redis.set(invitesKey(username), JSON.stringify(invites));
    await redis.expire(invitesKey(username), 86400);
  }
}

// ── FSM: Alliance Manager ───────────────────────────────────────────────────

const MANAGER_COOLDOWN = 30_000; // 30s between actions
const ALLIANCE_NAME_PREFIX = 'Bot Alliance';

async function tickManagerBot(bot: BotConfig, state: BotState): Promise<BotState> {
  const now = Date.now();

  if (state.fsm === 'init') {
    // Create an alliance
    const allianceName = `${ALLIANCE_NAME_PREFIX} ${bot.name.slice(-1)}`;
    const id = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const alliance: Alliance = {
      id,
      name: allianceName,
      manager: bot.name,
      members: [bot.name],
      createdAt: now,
    };
    await saveAlliance(alliance);
    await setPlayerAlliance(bot.name, id);

    // Post system chat
    const msg: AllianceChatMessage = { from: '__system__', text: `${bot.name} created the alliance.`, createdAt: now };
    await redis.zAdd(chatKey(id), { member: JSON.stringify(msg), score: now });

    console.log(`[BOT] ${bot.name} created alliance "${allianceName}" (id=${id})`);
    return { ...state, fsm: 'idle', allianceName, allianceId: id, lastActionMs: now };
  }

  if (state.fsm === 'idle') {
    if (now - state.lastActionMs < MANAGER_COOLDOWN) return state;

    // Find a target to invite that hasn't been invited yet
    const uninvited = bot.targets.filter(t => !state.invitedPlayers.includes(t));
    if (uninvited.length === 0) {
      // Everyone invited — occasionally chat
      if (state.allianceId && state.chatCount < 3) {
        const phrases = [
          'Welcome to the alliance!',
          'Let us explore the stars together.',
          'Ready for our next mission?',
        ];
        const text = phrases[state.chatCount % phrases.length]!;
        const chatMsg: AllianceChatMessage = { from: bot.name, text, createdAt: now };
        await redis.zAdd(chatKey(state.allianceId), { member: JSON.stringify(chatMsg), score: now });
        console.log(`[BOT] ${bot.name} sent chat: "${text}"`);
        return { ...state, lastActionMs: now, chatCount: state.chatCount + 1 };
      }
      return state; // nothing to do
    }

    // Invite next target
    const target = uninvited[0]!;
    const targetAllianceId = await getPlayerAllianceId(target);
    if (targetAllianceId) {
      // Target already in an alliance — skip
      console.log(`[BOT] ${bot.name} skipping invite for ${target} (already in alliance)`);
      return { ...state, invitedPlayers: [...state.invitedPlayers, target], lastActionMs: now };
    }

    // Add invite to target's invite list
    const existing = await getInvites(target);
    const alreadyInvited = existing.some(inv => inv.allianceId === state.allianceId);
    if (!alreadyInvited) {
      const invite: AllianceInvite = {
        allianceId: state.allianceId!,
        allianceName: state.allianceName!,
        invitedBy: bot.name,
        createdAt: now,
      };
      existing.push(invite);
      await saveInvites(target, existing);
      console.log(`[BOT] ${bot.name} invited ${target} to "${state.allianceName}"`);
    }

    return { ...state, fsm: 'idle', invitedPlayers: [...state.invitedPlayers, target], lastActionMs: now };
  }

  return state;
}

// ── FSM: Alliance Member ────────────────────────────────────────────────────

const MEMBER_COOLDOWN = 15_000; // 15s between actions

async function tickMemberBot(bot: BotConfig, state: BotState): Promise<BotState> {
  const now = Date.now();

  if (state.fsm === 'init') {
    return { ...state, fsm: 'waiting', lastActionMs: now };
  }

  if (state.fsm === 'waiting') {
    if (now - state.lastActionMs < MEMBER_COOLDOWN) return state;

    // Check for pending invites
    const invites = await getInvites(bot.name);
    if (invites.length === 0) return { ...state, lastActionMs: now };

    // Accept the first invite
    const invite = invites[0]!;
    const alliance = await getAlliance(invite.allianceId);
    if (!alliance) {
      // Stale invite — remove it
      await saveInvites(bot.name, invites.slice(1));
      return { ...state, lastActionMs: now };
    }

    // Check cap
    if (alliance.members.length >= 10) {
      await saveInvites(bot.name, invites.slice(1));
      return { ...state, lastActionMs: now };
    }

    // Join
    alliance.members.push(bot.name);
    await saveAlliance(alliance);
    await setPlayerAlliance(bot.name, alliance.id);
    await saveInvites(bot.name, invites.slice(1));

    // Post join message
    const joinMsg: AllianceChatMessage = { from: '__system__', text: `${bot.name} joined the alliance!`, createdAt: now };
    await redis.zAdd(chatKey(alliance.id), { member: JSON.stringify(joinMsg), score: now });

    console.log(`[BOT] ${bot.name} joined alliance "${alliance.name}"`);
    return { ...state, fsm: 'idle', allianceId: alliance.id, allianceName: alliance.name, lastActionMs: now };
  }

  if (state.fsm === 'idle') {
    if (now - state.lastActionMs < MEMBER_COOLDOWN * 2) return state;

    // Occasional chat
    if (state.allianceId && state.chatCount < 3) {
      const phrases = [
        'Happy to be here!',
        'What are we targeting next?',
        'Systems scanned. All clear.',
      ];
      const text = phrases[state.chatCount % phrases.length]!;
      const chatMsg: AllianceChatMessage = { from: bot.name, text, createdAt: now };
      await redis.zAdd(chatKey(state.allianceId), { member: JSON.stringify(chatMsg), score: now });
      console.log(`[BOT] ${bot.name} sent chat: "${text}"`);
      return { ...state, lastActionMs: now, chatCount: state.chatCount + 1 };
    }
    return state;
  }

  return state;
}

// ── Tick Engine ─────────────────────────────────────────────────────────────

const TICK_INTERVAL = 10_000; // minimum 10s between ticks

async function tickAllBots(): Promise<{ ticked: number; skipped: boolean }> {
  const now = Date.now();
  const lastTickStr = await redis.get(LAST_TICK_KEY);
  const lastTick = lastTickStr ? parseInt(lastTickStr, 10) : 0;

  if (now - lastTick < TICK_INTERVAL) {
    return { ticked: 0, skipped: true };
  }
  await redis.set(LAST_TICK_KEY, String(now));

  const registry = await getRegistry();
  const active = registry.filter(b => b.active);
  let ticked = 0;

  for (const bot of active) {
    const state = await getState(bot.name);
    let newState: BotState;

    if (bot.role === 'alliance-manager') {
      newState = await tickManagerBot(bot, state);
    } else {
      newState = await tickMemberBot(bot, state);
    }

    if (newState !== state) {
      await saveState(bot.name, newState);
      ticked++;
    }
  }

  return { ticked, skipped: false };
}

// ── Routes ──────────────────────────────────────────────────────────────────

/** Tick all bots (called by client piggyback) */
bots.post('/tick', async (c) => {
  const result = await tickAllBots();
  return c.json(result);
});

/** Spawn a new bot */
bots.post('/spawn', async (c) => {
  const body = await c.req.json<{ name: string; role: BotRole; targets?: string[] }>();
  if (!body.name || !body.role) return c.json({ error: 'name and role required' }, 400);

  const registry = await getRegistry();
  if (registry.some(b => b.name === body.name)) {
    return c.json({ error: 'bot already exists' }, 409);
  }

  const bot: BotConfig = {
    name: body.name,
    role: body.role,
    active: true,
    targets: body.targets ?? [],
  };
  registry.push(bot);
  await saveRegistry(registry);

  // Initialize state
  await saveState(body.name, { fsm: 'init', lastActionMs: 0, invitedPlayers: [], chatCount: 0 });

  console.log(`[BOT] Spawned ${body.name} (${body.role}) targets=${(body.targets ?? []).join(',')}`);
  return c.json({ ok: true, bot });
});

/** Despawn a bot (remove from registry, clean state) */
bots.post('/despawn', async (c) => {
  const body = await c.req.json<{ name: string }>();
  if (!body.name) return c.json({ error: 'name required' }, 400);

  let registry = await getRegistry();
  registry = registry.filter(b => b.name !== body.name);
  await saveRegistry(registry);
  await redis.del(stateKey(body.name));

  // Also remove from alliance if in one
  const allianceId = await getPlayerAllianceId(body.name);
  if (allianceId) {
    const alliance = await getAlliance(allianceId);
    if (alliance) {
      alliance.members = alliance.members.filter(m => m !== body.name);
      if (alliance.members.length === 0) {
        await redis.del(allianceKey(allianceId));
        await redis.del(chatKey(allianceId));
      } else {
        if (alliance.manager === body.name) {
          alliance.manager = alliance.members[0] ?? alliance.manager;
        }
        await saveAlliance(alliance);
      }
    }
    await redis.del(playerAllianceKey(body.name));
  }

  console.log(`[BOT] Despawned ${body.name}`);
  return c.json({ ok: true });
});

/** List all bots with their current state */
bots.get('/list', async (c) => {
  const registry = await getRegistry();
  const result = [];
  for (const bot of registry) {
    const state = await getState(bot.name);
    result.push({ ...bot, state });
  }
  return c.json({ bots: result });
});

/** Reset all bots (wipe registry and all state) */
bots.post('/reset', async (c) => {
  const registry = await getRegistry();
  for (const bot of registry) {
    await redis.del(stateKey(bot.name));
    // Clean up alliance membership
    const allianceId = await getPlayerAllianceId(bot.name);
    if (allianceId) {
      const alliance = await getAlliance(allianceId);
      if (alliance) {
        alliance.members = alliance.members.filter(m => m !== bot.name);
        if (alliance.members.length === 0) {
          await redis.del(allianceKey(allianceId));
          await redis.del(chatKey(allianceId));
        } else {
          if (alliance.manager === bot.name) alliance.manager = alliance.members[0] ?? alliance.manager;
          await saveAlliance(alliance);
        }
      }
      await redis.del(playerAllianceKey(bot.name));
    }
  }
  await redis.del(REGISTRY_KEY);
  await redis.del(LAST_TICK_KEY);
  console.log(`[BOT] Reset all bots (${registry.length} removed)`);
  return c.json({ ok: true, removed: registry.length });
});

/** Run a full bot integration test — resets, spawns, ticks multiple times, and returns log */
bots.post('/test', async (c) => {
  const log: string[] = [];
  const push = (msg: string) => { log.push(msg); console.log(`[BOT-TEST] ${msg}`); };

  try {
    // Step 1: Reset
    push('Resetting bot system...');
    const registry = await getRegistry();
    for (const bot of registry) {
      await redis.del(stateKey(bot.name));
      const aid = await getPlayerAllianceId(bot.name);
      if (aid) {
        const a = await getAlliance(aid);
        if (a) {
          a.members = a.members.filter(m => m !== bot.name);
          if (a.members.length === 0) { await redis.del(allianceKey(aid)); await redis.del(chatKey(aid)); }
          else { if (a.manager === bot.name) a.manager = a.members[0] ?? a.manager; await saveAlliance(a); }
        }
        await redis.del(playerAllianceKey(bot.name));
      }
    }
    await redis.del(REGISTRY_KEY);
    await redis.del(LAST_TICK_KEY);
    push(`Reset done (${registry.length} bots removed).`);

    // Step 2: Spawn bots
    const mgrName = 'TestBot-Mgr';
    const memName = 'TestBot-Mem';
    const newReg: BotConfig[] = [
      { name: mgrName, role: 'alliance-manager', active: true, targets: [memName] },
      { name: memName, role: 'alliance-member', active: true, targets: [] },
    ];
    await saveRegistry(newReg);
    push(`Spawned ${mgrName} (manager, targets=[${memName}]) and ${memName} (member).`);

    // Step 3: Force-tick multiple times (bypass rate limit AND cooldowns)
    const TICKS = 6;
    for (let i = 1; i <= TICKS; i++) {
      // Force tick by setting lastTick to 0
      await redis.set(LAST_TICK_KEY, '0');
      // Reset per-bot cooldowns so FSM advances immediately
      for (const bot of newReg) {
        const s = await getState(bot.name);
        if (s.lastActionMs > 0) {
          await saveState(bot.name, { ...s, lastActionMs: 0 });
        }
      }
      const result = await tickAllBots();
      const mgrState = await getState(mgrName);
      const memState = await getState(memName);
      push(`Tick ${i}: mgr.fsm=${mgrState.fsm} alliance="${mgrState.allianceName ?? 'none'}" invited=${mgrState.invitedPlayers.length} | mem.fsm=${memState.fsm} alliance="${memState.allianceName ?? 'none'}" (ticked=${result.ticked})`);
    }

    // Step 4: Validate
    const mgrFinal = await getState(mgrName);
    const memFinal = await getState(memName);

    if (mgrFinal.allianceId) push(`✅ Manager created alliance: "${mgrFinal.allianceName}"`);
    else push('❌ Manager failed to create alliance');

    if (mgrFinal.invitedPlayers.includes(memName)) push(`✅ Manager invited ${memName}`);
    else push(`❌ Manager did not invite ${memName}`);

    if (memFinal.allianceId) push(`✅ Member joined alliance: "${memFinal.allianceName}"`);
    else push(`⚠️ Member not yet in alliance (fsm=${memFinal.fsm}). May need more ticks.`);

    // Check alliance chat
    if (mgrFinal.allianceId) {
      const chatData = await redis.zRange(chatKey(mgrFinal.allianceId), 0, -1);
      push(`Alliance chat messages: ${chatData.length}`);
    }

    push('--- Test complete ---');
  } catch (e) {
    push(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }

  return c.json({ ok: true, log });
});

/** Admin integration test — spawns bot, invites admin, waits for admin to join */
const ADMIN_TEST_KEY = 'bots:admin_test';

bots.post('/test-admin', async (c) => {
  const body = await c.req.json<{ username: string }>().catch(() => ({ username: '' }));
  const adminName = body.username || 'WeirdAd4511';
  const log: string[] = [];
  const push = (msg: string) => { log.push(msg); console.log(`[BOT-TEST-ADMIN] ${msg}`); };

  try {
    // Reset existing bots
    push('Resetting bot system...');
    const registry = await getRegistry();
    for (const bot of registry) {
      await redis.del(stateKey(bot.name));
      const aid = await getPlayerAllianceId(bot.name);
      if (aid) {
        const a = await getAlliance(aid);
        if (a) {
          a.members = a.members.filter(m => m !== bot.name);
          if (a.members.length === 0) { await redis.del(allianceKey(aid)); await redis.del(chatKey(aid)); }
          else { if (a.manager === bot.name) a.manager = a.members[0] ?? a.manager; await saveAlliance(a); }
        }
        await redis.del(playerAllianceKey(bot.name));
      }
    }
    await redis.del(REGISTRY_KEY);
    await redis.del(LAST_TICK_KEY);
    push(`Reset done.`);

    // Spawn manager targeting admin
    const mgrName = 'Zephyr-7';
    const newReg: BotConfig[] = [
      { name: mgrName, role: 'alliance-manager', active: true, targets: [adminName] },
    ];
    await saveRegistry(newReg);
    push(`Spawned ${mgrName} (targets=[${adminName}]).`);

    // Force-tick to create alliance + invite admin
    for (let i = 0; i < 3; i++) {
      await redis.set(LAST_TICK_KEY, '0');
      const s = await getState(mgrName);
      if (s.lastActionMs > 0) await saveState(mgrName, { ...s, lastActionMs: 0 });
      await tickAllBots();
    }

    const mgrState = await getState(mgrName);
    if (mgrState.allianceId) push(`✅ Alliance created: "${mgrState.allianceName}"`);
    else push('❌ Failed to create alliance');

    if (mgrState.invitedPlayers.includes(adminName)) {
      push(`✅ Invited ${adminName}. Waiting for admin to join...`);
    } else {
      push(`⚠️ Invite not yet sent (will happen on next tick).`);
    }

    // Store test state for check endpoint
    await redis.set(ADMIN_TEST_KEY, JSON.stringify({
      mgrName,
      adminName,
      allianceId: mgrState.allianceId,
      allianceName: mgrState.allianceName,
      startedAt: Date.now(),
    }));

    push(`Go to COMS > Alliance > Invites and JOIN the alliance.`);
    push(`Then click CHECK TEST to validate.`);
  } catch (e) {
    push(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }

  return c.json({ ok: true, log });
});

/** Check if admin joined the bot's alliance */
bots.post('/test-check', async (c) => {
  const log: string[] = [];
  const push = (msg: string) => { log.push(msg); console.log(`[BOT-TEST-CHECK] ${msg}`); };

  try {
    const testData = await redis.get(ADMIN_TEST_KEY);
    if (!testData) {
      push('❌ No active admin test. Run TEST ADMIN first.');
      return c.json({ ok: false, log });
    }

    const test = JSON.parse(testData) as {
      mgrName: string;
      adminName: string;
      allianceId?: string;
      allianceName?: string;
      startedAt: number;
    };

    push(`Checking test: "${test.allianceName}" (started ${Math.round((Date.now() - test.startedAt) / 1000)}s ago)`);

    if (!test.allianceId) {
      push('❌ No alliance was created during test setup.');
      return c.json({ ok: false, log });
    }

    // Check if admin is in the alliance
    const alliance = await getAlliance(test.allianceId);
    if (!alliance) {
      push('❌ Alliance no longer exists.');
      return c.json({ ok: false, log });
    }

    push(`Alliance members: [${alliance.members.join(', ')}]`);

    if (alliance.members.includes(test.adminName)) {
      push(`✅ ${test.adminName} successfully joined "${test.allianceName}"!`);
      push(`✅ Alliance has ${alliance.members.length} members.`);

      // Check chat
      const chatData = await redis.zRange(chatKey(test.allianceId), 0, -1);
      push(`Alliance chat: ${chatData.length} messages.`);

      // Force a few more ticks so bot chats
      for (let i = 0; i < 3; i++) {
        await redis.set(LAST_TICK_KEY, '0');
        const s = await getState(test.mgrName);
        if (s.lastActionMs > 0) await saveState(test.mgrName, { ...s, lastActionMs: 0 });
        await tickAllBots();
      }

      const chatAfter = await redis.zRange(chatKey(test.allianceId), 0, -1);
      if (chatAfter.length > chatData.length) {
        push(`✅ Bot sent ${chatAfter.length - chatData.length} new chat messages after admin joined.`);
      }

      push('--- Admin test PASSED ---');
      await redis.del(ADMIN_TEST_KEY);
    } else {
      push(`⏳ ${test.adminName} has NOT joined yet.`);
      push(`Go to COMS > Alliance > Invites and accept the invite from Zephyr-7.`);

      // Check if invite still exists
      const invites = await getInvites(test.adminName);
      const hasInvite = invites.some(inv => inv.allianceId === test.allianceId);
      if (hasInvite) push(`✅ Invite is still pending for ${test.adminName}.`);
      else push(`⚠️ No pending invite found — it may have expired or been rejected.`);
    }
  } catch (e) {
    push(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }

  return c.json({ ok: true, log });
});

// ── Seed bot profiles for leaderboard testing ───────────────────────────────

bots.post('/seed-bots', async (c) => {
  const postId = context.postId;
  if (!postId) return c.json({ error: 'no postId' }, 400);

  const registry = await getRegistry();
  // Ensure default bots are in registry
  const defaults: BotConfig[] = [
    { name: 'AstroBot_X', role: 'alliance-manager', active: true, targets: [] },
    { name: 'NovaHunter', role: 'alliance-member', active: true, targets: [] },
    { name: 'StarForge99', role: 'alliance-member', active: true, targets: [] },
    { name: 'VoidWalker', role: 'alliance-member', active: true, targets: [] },
  ];
  for (const bot of defaults) {
    if (!registry.some(b => b.name === bot.name)) {
      registry.push(bot);
      await saveState(bot.name, { fsm: 'init', lastActionMs: 0, invitedPlayers: [], chatCount: 0 });
    }
  }
  await saveRegistry(registry);

  const starsKey = `stars:${postId}`;
  const now = Date.now();
  const seeded: string[] = [];

  // Assign varying stats to each bot
  for (let i = 0; i < registry.length; i++) {
    const bot = registry[i]!;
    const name = bot.name;
    const profileKey = `profile:${name}`;

    // Varying star claims (bot index determines how many stars: 1-3)
    const starCount = (i % 3) + 1;
    const baseStarIndex = 50 + i * 5; // use high star indices to avoid collisions
    for (let s = 0; s < starCount; s++) {
      const sIdx = baseStarIndex + s;
      await redis.hSet(starsKey, { [`s:${sIdx}`]: name });
    }

    // Varying buildings per star
    const buildingLevel = 2 + i; // 2, 3, 4, ...
    const economy = {
      stars: Object.fromEntries(
        Array.from({ length: starCount }, (_, s) => {
          const sIdx = baseStarIndex + s;
          return [`s:${sIdx}`, {
            store: { ore: 100, food: 80, energy: 60 },
            rates: { ore: 1, food: 1, energy: 1 },
            cap: 500,
            buildings: {
              station: { level: buildingLevel, status: 'ACTIVE', completeAt: null },
              mine: { level: Math.max(1, buildingLevel - 1), status: 'ACTIVE', completeAt: null },
              solar: { level: Math.max(1, buildingLevel - 1), status: 'ACTIVE', completeAt: null },
              hab: { level: 1, status: 'ACTIVE', completeAt: null },
              warehouse: { level: 1, status: 'ACTIVE', completeAt: null },
              dock: { level: Math.min(buildingLevel, 3), status: 'ACTIVE', completeAt: null },
            },
            lastTickMs: now,
          }];
        }),
      ),
    };

    // Varying ships per star
    const shipCount = 3 + i * 2; // 3, 5, 7, ...
    const ships = {
      stars: Object.fromEntries(
        Array.from({ length: starCount }, (_, s) => {
          const sIdx = baseStarIndex + s;
          return [`s:${sIdx}`, {
            ships: [
              { typeId: 1, count: shipCount },
              { typeId: 2, count: Math.max(1, Math.floor(shipCount / 2)) },
            ],
            building: null,
          }];
        }),
      ),
    };

    // Varying playtime
    const playtimeSeconds = 3600 * (1 + i * 2); // 1h, 3h, 5h, ...

    await redis.hSet(profileKey, {
      economy: JSON.stringify(economy),
      ships: JSON.stringify(ships),
      stats: JSON.stringify({ playtimeSeconds, interactions: 10 + i * 5, lastSeen: now }),
    });

    seeded.push(`${name}: ${starCount} stars, lvl${buildingLevel} buildings, ${shipCount} ships/star, ${playtimeSeconds / 3600}h`);
  }

  return c.json({ ok: true, seeded });
});

// ── Autobot Debug Routes ────────────────────────────────────────────────────

import { tickAutoBot, resetAutoBot, getAutoBotState, injectGhostPose } from '../core/autobot';
import { type RedisGameStore } from '../core/game-service';

/** Manually trigger one autobot tick (for testing without waiting for cron). */
bots.post('/autobot/tick', async (c) => {
  console.log('[BOTS] manual autobot tick triggered');
  try {
    // Accept postId from client body to seed the active post key
    let bodyPostId: string | undefined;
    try {
      const body = await c.req.json() as { postId?: string };
      bodyPostId = body.postId;
    } catch { /* no body or invalid JSON — that's fine */ }
    if (bodyPostId) {
      await redis.set('app:active_post_id', bodyPostId);
      console.log(`[BOTS] autobot tick seeded postId=${bodyPostId}`);
    }
    const result = await tickAutoBot();
    return c.json({ ok: true, action: result.action, state: result.state, debug: result.debug });
  } catch (e) {
    return c.json({ ok: false, error: String(e) }, 500);
  }
});

/** Get current autobot state (debug inspection). */
bots.get('/autobot/state', async (c) => {
  const state = await getAutoBotState();
  return c.json({ ok: true, state });
});

/** Reset autobot to default state (fresh start). */
bots.post('/autobot/reset', async (c) => {
  await resetAutoBot();
  return c.json({ ok: true, message: 'autobot state reset to default' });
});

/** Seed the active postId for the autobot scheduler (call from client with known postId). */
bots.post('/autobot/seed-post', async (c) => {
  const { postId } = await c.req.json() as { postId?: string };
  if (!postId) return c.json({ ok: false, error: 'missing postId' }, 400);
  await redis.set('app:active_post_id', postId);
  console.log(`[BOTS] autobot seed-post: stored postId=${postId}`);
  return c.json({ ok: true, postId });
});

/**
 * Admin fly-by: inject the bot's pose at a specific star so the admin
 * can see it immediately. Accepts { postId, starIndex, tier? }.
 * The pose is future-padded to survive until the next cron tick.
 */
bots.post('/autobot/flyby', async (c) => {
  const body = await c.req.json() as { postId?: string; starIndex?: number; tier?: number; bodyIndex?: number };
  const postId = body.postId;
  if (!postId) return c.json({ ok: false, error: 'missing postId' }, 400);
  const starIndex = body.starIndex ?? -1;
  const bodyIndex = body.bodyIndex ?? -1;

  const store: RedisGameStore = {
    hSet: (key, values) => redis.hSet(key, values),
    hGetAll: (key) => redis.hGetAll(key),
    hGet: (key, field) => redis.hGet(key, field),
    hDel: (key, fields) => redis.hDel(key, fields),
    get: (key) => redis.get(key),
    set: (key, value) => redis.set(key, value),
    del: (key) => redis.del(key),
    zRange: (key, min, max, options) => redis.zRange(key, min, max, options ? { by: 'score' } : undefined),
  };

  const state = await getAutoBotState();
  // Temporarily move bot to target star for the pose injection
  const origStar = state.currentStarIndex;
  state.currentStarIndex = starIndex >= 0 ? starIndex : origStar;

  try {
    await injectGhostPose(store, state, postId, starIndex >= 0 ? starIndex : undefined, body.tier, bodyIndex >= 0 ? bodyIndex : undefined);

    // Verify: read back all bot poses from Redis and report what's stored
    const allPoses = await redis.hGetAll(`poses:${postId}`);
    const botPoses: Record<string, unknown> = {};
    for (const [sid, raw] of Object.entries(allPoses)) {
      if (sid.startsWith('bot:')) {
        try { botPoses[sid] = JSON.parse(raw); } catch { botPoses[sid] = raw; }
      }
    }

    // Also test what room-poses would return for tier 2
    const { listRoomPoses } = await import('../core/game-service');
    const roomPoses = await listRoomPoses(store, {
      postId,
      exclude: '',
      tier: 3,
      starIndex: starIndex >= 0 ? starIndex : state.currentStarIndex,
      bodyIndex,
    });

    console.log(`[BOTS] fly-by: injected at star #${state.currentStarIndex} body #${bodyIndex}, stored poses:`, JSON.stringify(botPoses));
    console.log(`[BOTS] fly-by: room-poses query tier=2 star=${starIndex} body=${bodyIndex} returned ${roomPoses.items.length} items:`, JSON.stringify(roomPoses.items));
    return c.json({ ok: true, starIndex: state.currentStarIndex, bodyIndex, tier: body.tier ?? 'all', storedPoses: botPoses, roomPosesT2: roomPoses.items });
  } catch (e) {
    return c.json({ ok: false, error: String(e) }, 500);
  }
});

export default bots;
