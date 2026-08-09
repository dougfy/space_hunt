// ── Anomaly Buffs System ─────────────────────────────────────────────────────
// Temporary buffs granted when a player rolls 'anomaly' during planet exploration.
// Buff is picked randomly from the catalog and persists in Redis until expiry.

export type BuffId = 'hyperdrive' | 'resonance' | 'chrono' | 'void_shield' | 'scanner_amp';

export interface ActiveBuff {
  buffId: BuffId;
  expiresAt: number;   // absolute ms timestamp
  grantedAt: number;   // when buff was activated
  starIndex: number;   // where it was discovered
}

export interface BuffCatalogEntry {
  buffId: BuffId;
  name: string;
  description: string;
  durationMs: number;       // 0 = single-use (scanner_amp)
  icon: string;             // short text icon for HUD
  voiceLine: string;        // flavor text for voice announcement
  weight: number;           // relative spawn weight
}

export const BUFF_CATALOG: BuffCatalogEntry[] = [
  {
    buffId: 'hyperdrive',
    name: 'Hyperdrive Surge',
    description: 'Ship transit time reduced by 40%',
    durationMs: 10 * 60_000,  // 10 min
    icon: '⚡',
    voiceLine: 'Anomalous tachyon field detected. Engines overcharged.',
    weight: 25,
  },
  {
    buffId: 'resonance',
    name: 'Resonance Mining',
    description: 'All resource production +50%',
    durationMs: 15 * 60_000,  // 15 min
    icon: '⛏',
    voiceLine: 'Subspace resonance amplifying extraction arrays.',
    weight: 25,
  },
  {
    buffId: 'chrono',
    name: 'Chrono Catalyst',
    description: 'Construction time reduced by 50%',
    durationMs: 10 * 60_000,  // 10 min
    icon: '⏱',
    voiceLine: 'Temporal distortion accelerating construction nanites.',
    weight: 20,
  },
  {
    buffId: 'void_shield',
    name: 'Void Shield',
    description: 'Immunity to raid damage',
    durationMs: 20 * 60_000,  // 20 min
    icon: '🛡',
    voiceLine: 'Anomalous barrier surrounding fleet.',
    weight: 15,
  },
  {
    buffId: 'scanner_amp',
    name: 'Scanner Amplification',
    description: 'Next scan guaranteed discovery',
    durationMs: 0,            // single-use
    icon: '📡',
    voiceLine: 'Sensor array calibrated to anomalous frequency.',
    weight: 15,
  },
];

const TOTAL_BUFF_WEIGHT = BUFF_CATALOG.reduce((s, e) => s + e.weight, 0);

/**
 * Roll a random buff based on weighted catalog.
 * Uses a seeded approach so results are deterministic for the same seed.
 */
export function rollBuff(seed: number): BuffCatalogEntry {
  // Simple LCG float from seed
  const next = (seed * 16807 + 1) >>> 0;
  const roll = (next & 0x7FFFFFFF) / 0x7FFFFFFF;
  const scaled = roll * TOTAL_BUFF_WEIGHT;

  let cumulative = 0;
  for (const entry of BUFF_CATALOG) {
    cumulative += entry.weight;
    if (scaled < cumulative) return entry;
  }
  return BUFF_CATALOG[0]!;
}

/**
 * Get a buff entry by ID.
 */
export function getBuffEntry(buffId: BuffId): BuffCatalogEntry | undefined {
  return BUFF_CATALOG.find(b => b.buffId === buffId);
}

/**
 * Check if a buff is still active (not expired).
 */
export function isBuffActive(buff: ActiveBuff, now: number): boolean {
  // Single-use buffs (durationMs=0) persist until consumed
  if (buff.expiresAt === 0) return true;
  return now < buff.expiresAt;
}

/**
 * Filter active buffs, removing expired ones.
 */
export function filterActiveBuffs(buffs: ActiveBuff[], now: number): ActiveBuff[] {
  return buffs.filter(b => isBuffActive(b, now));
}

/**
 * Check if a specific buff type is active in the buff list.
 */
export function hasActiveBuff(buffs: ActiveBuff[], buffId: BuffId, now: number): boolean {
  return buffs.some(b => b.buffId === buffId && isBuffActive(b, now));
}

// ── Buff Multipliers (used by server logic) ─────────────────────────────────

/** Production multiplier when resonance buff is active. */
export const RESONANCE_MULTIPLIER = 1.5;

/** Transit time multiplier when hyperdrive buff is active. */
export const HYPERDRIVE_MULTIPLIER = 0.6;

/** Build time multiplier when chrono buff is active. */
export const CHRONO_MULTIPLIER = 0.5;
