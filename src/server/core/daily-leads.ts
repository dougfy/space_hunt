/**
 * Daily Probe Report leads.
 *
 * Five leads per UTC day, shared by everyone on the post. The pool is global on
 * purpose: players race for the same targets, and a lead disappears for all of
 * them the moment someone claims it by scanning that body.
 *
 * Generation is deterministic from (postId, dayKey), so every player sees the
 * same five without needing a write to agree on them, and a reload or a second
 * tab cannot produce a different set. Claims are the only mutable state.
 *
 * Leads never lie: each one points at a body whose `rollDiscovery` outcome is
 * already fixed by the world seed, so the find promised is the find delivered.
 */

import { rollDiscovery } from '../../shared/exploration';
import type { DiscoveryKind } from '../../shared/exploration';
import type { StarPosition } from '../../shared/galaxy-positions';

export const LEADS_PER_DAY = 5;

export type DailyLead = {
  /** Stable within a day; used as the claim key. */
  id: string;
  starIndex: number;
  bodyIndex: number;
  /** What a scan will actually yield. Withheld from low-resolution viewers. */
  kind: DiscoveryKind;
  /** True when the rare tier — drives 'unknown signature' vs 'resource lead'. */
  rare: boolean;
};

export type ClaimedLead = {
  id: string;
  username: string;
  claimedAt: number;
};

export type LeadStore = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<unknown>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hSet(key: string, values: Record<string, string>): Promise<unknown>;
};

export const CLAIMS_KEY = (postId: string, dayKey: string) => `daily_leads:${postId}:${dayKey}:claims`;

const RARE_KINDS: ReadonlySet<DiscoveryKind> = new Set<DiscoveryKind>(['artifact', 'blueprint', 'anomaly']);
/** Kinds worth sending a player across the galaxy for. */
const LEAD_KINDS: ReadonlySet<DiscoveryKind> = new Set<DiscoveryKind>([
  'artifact', 'blueprint', 'anomaly', 'ore', 'food', 'energy', 'fuel',
]);

function leadHash(text: string): number {
  let hash = 23;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function createRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The day's five leads. Pure and deterministic — no I/O, no writes.
 *
 * Candidate bodies are sampled from the galaxy and kept only when their fixed
 * discovery roll is something worth reporting, so a lead never points at a
 * barren rock. Sampling is capped so a galaxy with few interesting bodies
 * degrades to fewer leads rather than spinning.
 */
export function generateDailyLeads(
  postId: string,
  dayKey: string,
  positions: ReadonlyArray<StarPosition>,
  galaxySeed: number,
  count: number = LEADS_PER_DAY,
): DailyLead[] {
  if (positions.length === 0) return [];
  const rng = createRng(leadHash(`${postId}:${dayKey}:leads`));
  const leads: DailyLead[] = [];
  const seen = new Set<string>();
  const maxAttempts = count * 200;

  for (let attempt = 0; attempt < maxAttempts && leads.length < count; attempt++) {
    const star = positions[Math.floor(rng() * positions.length)]!;
    if (star.bodyCount <= 0) continue;
    const bodyIndex = Math.floor(rng() * star.bodyCount);
    const key = `${star.index}:${bodyIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const result = rollDiscovery(galaxySeed, star.index, bodyIndex);
    if (!LEAD_KINDS.has(result.kind)) continue;

    leads.push({
      id: key,
      starIndex: star.index,
      bodyIndex,
      kind: result.kind,
      rare: RARE_KINDS.has(result.kind),
    });
  }

  return leads;
}

/** Claims recorded for the day, keyed by lead id. */
export async function getClaims(
  store: LeadStore,
  postId: string,
  dayKey: string,
): Promise<Map<string, ClaimedLead>> {
  const claims = new Map<string, ClaimedLead>();
  try {
    const raw = await store.hGetAll(CLAIMS_KEY(postId, dayKey));
    for (const [id, value] of Object.entries(raw)) {
      try {
        claims.set(id, JSON.parse(value) as ClaimedLead);
      } catch { /* skip malformed */ }
    }
  } catch { /* treat an unreadable claim set as empty */ }
  return claims;
}

/**
 * Claim a lead for a player. First writer wins: a lead already claimed stays
 * with its original claimant, so two players scanning at once cannot both take
 * it. Returns whether this call was the one that took it.
 */
export async function claimLead(
  store: LeadStore,
  postId: string,
  dayKey: string,
  leadId: string,
  username: string,
  now: number = Date.now(),
): Promise<{ claimed: boolean; by: string }> {
  const existing = await getClaims(store, postId, dayKey);
  const already = existing.get(leadId);
  if (already) return { claimed: false, by: already.username };

  const record: ClaimedLead = { id: leadId, username, claimedAt: now };
  await store.hSet(CLAIMS_KEY(postId, dayKey), { [leadId]: JSON.stringify(record) });
  return { claimed: true, by: username };
}

/**
 * The leads still up for grabs. Claimed leads are removed outright rather than
 * shown as taken — the report should only ever list live targets.
 */
export async function getOpenLeads(
  store: LeadStore,
  postId: string,
  dayKey: string,
  positions: ReadonlyArray<StarPosition>,
  galaxySeed: number,
): Promise<DailyLead[]> {
  const all = generateDailyLeads(postId, dayKey, positions, galaxySeed);
  const claims = await getClaims(store, postId, dayKey);
  return all.filter((lead) => !claims.has(lead.id));
}

/** Lead matching a scanned body, if that scan claims one. */
export function findLeadFor(
  leads: ReadonlyArray<DailyLead>,
  starIndex: number,
  bodyIndex: number,
): DailyLead | undefined {
  return leads.find((l) => l.starIndex === starIndex && l.bodyIndex === bodyIndex);
}
