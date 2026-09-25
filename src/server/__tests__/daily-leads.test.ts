import { describe, expect, it } from 'vitest';
import {
  CLAIMS_KEY,
  LEADS_PER_DAY,
  claimLead,
  findLeadFor,
  generateDailyLeads,
  getClaims,
  getOpenLeads,
} from '../core/daily-leads';
import type { LeadStore } from '../core/daily-leads';
import { generateStarPositions } from '../../shared/galaxy-positions';
import { rollDiscovery } from '../../shared/exploration';

function createFakeStore(): LeadStore & { hashes: Record<string, Record<string, string>> } {
  const hashes: Record<string, Record<string, string>> = {};
  const kv: Record<string, string> = {};
  return {
    hashes,
    async get(key) { return kv[key]; },
    async set(key, value) { kv[key] = value; },
    async hGetAll(key) { return { ...(hashes[key] ?? {}) }; },
    async hSet(key, values) { hashes[key] = { ...(hashes[key] ?? {}), ...values }; },
  };
}

const POST = 'post-1';
const DAY = '2026-09-23';
const positions = generateStarPositions(POST);
const SEED = 123456;

describe('daily lead generation', () => {
  it('produces five leads for the day', () => {
    expect(generateDailyLeads(POST, DAY, positions, SEED)).toHaveLength(LEADS_PER_DAY);
  });

  it('is deterministic, so every player sees the same five', () => {
    const a = generateDailyLeads(POST, DAY, positions, SEED);
    const b = generateDailyLeads(POST, DAY, positions, SEED);
    expect(b).toEqual(a);
  });

  it('gives different leads on a different day', () => {
    const today = generateDailyLeads(POST, DAY, positions, SEED);
    const tomorrow = generateDailyLeads(POST, '2026-09-24', positions, SEED);
    expect(tomorrow.map((l) => l.id)).not.toEqual(today.map((l) => l.id));
  });

  it('gives different leads on a different post', () => {
    const other = generateStarPositions('post-2');
    const mine = generateDailyLeads(POST, DAY, positions, SEED);
    const theirs = generateDailyLeads('post-2', DAY, other, SEED);
    expect(theirs.map((l) => l.id)).not.toEqual(mine.map((l) => l.id));
  });

  it('never points at a barren body — the promised find is real', () => {
    for (const lead of generateDailyLeads(POST, DAY, positions, SEED)) {
      const actual = rollDiscovery(SEED, lead.starIndex, lead.bodyIndex);
      expect(actual.kind).toBe(lead.kind);
      expect(actual.kind).not.toBe('nothing');
    }
  });

  it('flags the rare tier for unknown-signature leads', () => {
    for (const lead of generateDailyLeads(POST, DAY, positions, SEED)) {
      expect(lead.rare).toBe(['artifact', 'blueprint', 'anomaly'].includes(lead.kind));
    }
  });

  it('never repeats a body within a day', () => {
    const ids = generateDailyLeads(POST, DAY, positions, SEED).map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every body index inside its star', () => {
    const byIndex = new Map(positions.map((p) => [p.index, p]));
    for (const lead of generateDailyLeads(POST, DAY, positions, SEED)) {
      const star = byIndex.get(lead.starIndex)!;
      expect(lead.bodyIndex).toBeGreaterThanOrEqual(0);
      expect(lead.bodyIndex).toBeLessThan(star.bodyCount);
    }
  });

  it('degrades gracefully with no galaxy', () => {
    expect(generateDailyLeads(POST, DAY, [], SEED)).toEqual([]);
  });
});

describe('claiming', () => {
  it('removes a lead from the open pool once claimed', async () => {
    const store = createFakeStore();
    const before = await getOpenLeads(store, POST, DAY, positions, SEED);
    expect(before).toHaveLength(LEADS_PER_DAY);

    await claimLead(store, POST, DAY, before[0]!.id, 'pilot');

    const after = await getOpenLeads(store, POST, DAY, positions, SEED);
    expect(after).toHaveLength(LEADS_PER_DAY - 1);
    expect(after.some((l) => l.id === before[0]!.id)).toBe(false);
  });

  it('disappears for everyone, not just the claimant', async () => {
    const store = createFakeStore();
    const leads = await getOpenLeads(store, POST, DAY, positions, SEED);
    await claimLead(store, POST, DAY, leads[0]!.id, 'first_player');

    // A different player reads the same shared pool.
    const asOther = await getOpenLeads(store, POST, DAY, positions, SEED);
    expect(asOther.some((l) => l.id === leads[0]!.id)).toBe(false);
  });

  it('awards a contested lead to the first claimant only', async () => {
    const store = createFakeStore();
    const leads = generateDailyLeads(POST, DAY, positions, SEED);
    const target = leads[2]!.id;

    const first = await claimLead(store, POST, DAY, target, 'fast_player', 1000);
    const second = await claimLead(store, POST, DAY, target, 'slow_player', 1001);

    expect(first).toEqual({ claimed: true, by: 'fast_player' });
    expect(second).toEqual({ claimed: false, by: 'fast_player' });

    const claims = await getClaims(store, POST, DAY);
    expect(claims.get(target)?.username).toBe('fast_player');
    expect(claims.get(target)?.claimedAt).toBe(1000);
  });

  it('claiming one lead leaves the others alone', async () => {
    const store = createFakeStore();
    const leads = generateDailyLeads(POST, DAY, positions, SEED);
    await claimLead(store, POST, DAY, leads[0]!.id, 'pilot');

    const open = await getOpenLeads(store, POST, DAY, positions, SEED);
    expect(open.map((l) => l.id)).toEqual(leads.slice(1).map((l) => l.id));
  });

  it('scopes claims per day, so a new day restores a full pool', async () => {
    const store = createFakeStore();
    const leads = generateDailyLeads(POST, DAY, positions, SEED);
    for (const lead of leads) await claimLead(store, POST, DAY, lead.id, 'pilot');
    expect(await getOpenLeads(store, POST, DAY, positions, SEED)).toHaveLength(0);

    expect(await getOpenLeads(store, POST, '2026-09-24', positions, SEED)).toHaveLength(LEADS_PER_DAY);
  });

  it('ignores malformed claim rows rather than throwing', async () => {
    const store = createFakeStore();
    store.hashes[CLAIMS_KEY(POST, DAY)] = { 'bad:row': 'not json' };
    await expect(getClaims(store, POST, DAY)).resolves.toBeInstanceOf(Map);
    expect(await getOpenLeads(store, POST, DAY, positions, SEED)).toHaveLength(LEADS_PER_DAY);
  });
});

describe('matching a scan to a lead', () => {
  it('finds the lead a scanned body belongs to', () => {
    const leads = generateDailyLeads(POST, DAY, positions, SEED);
    const target = leads[1]!;
    expect(findLeadFor(leads, target.starIndex, target.bodyIndex)).toEqual(target);
  });

  it('returns nothing for a body with no lead on it', () => {
    const leads = generateDailyLeads(POST, DAY, positions, SEED);
    expect(findLeadFor(leads, 9999, 0)).toBeUndefined();
  });
});
