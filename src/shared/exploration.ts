// ── Planet Exploration Discovery System ──────────────────────────────────────
// Deterministic discovery rolls based on global seed (starIndex + bodyIndex).
// Each player gets ONE exploration per planet, stored server-side.
import type { ItemId } from './items';

/** Pod resource/effect types collected in belt & splash. */
export type PodKind = 'refuel' | 'dock' | 'energy' | 'ore' | 'food' | 'upgrade';

// ── Discovery Result Types ──────────────────────────────────────────────────

export type DiscoveryKind =
  | 'nothing'       // barren — no find
  | 'ore'           // resource cache: ore
  | 'food'          // resource cache: food
  | 'energy'        // resource cache: energy
  | 'fuel'          // resource cache: fuel
  | 'artifact'      // lore collectible (achievement fuel)
  | 'blueprint'     // ship upgrade discount/unlock
  | 'anomaly';      // rare temporary buff

export interface DiscoveryResult {
  kind: DiscoveryKind;
  amount: number;       // resource quantity (0 for non-resource)
  label: string;        // human-readable description
  icon: string;         // short emoji/symbol for HUD
  itemId?: ItemId;      // persistent item granted by this discovery
  itemCount?: number;
}

// ── Discovery Table ─────────────────────────────────────────────────────────
// Weights sum to 100. Roll is seeded per planet (deterministic).

interface DiscoveryEntry {
  kind: DiscoveryKind;
  weight: number;
  minAmount: number;
  maxAmount: number;
  label: string;
  icon: string;
}

const DISCOVERY_TABLE: DiscoveryEntry[] = [
  { kind: 'nothing',   weight: 30, minAmount: 0,   maxAmount: 0,   label: 'Barren surface — nothing of interest', icon: '—' },
  { kind: 'ore',       weight: 18, minAmount: 100, maxAmount: 300, label: 'Ore deposit discovered',               icon: '�ite' },
  { kind: 'food',      weight: 14, minAmount: 100, maxAmount: 250, label: 'Organic matter found',                 icon: 'bio' },
  { kind: 'energy',    weight: 14, minAmount: 100, maxAmount: 250, label: 'Energy crystal cache',                 icon: 'nrg' },
  { kind: 'fuel',      weight: 5,  minAmount: 50,  maxAmount: 150, label: 'Fuel source discovered',               icon: 'fuel' },
  { kind: 'artifact',  weight: 10, minAmount: 1,   maxAmount: 1,   label: 'Ancient artifact recovered',           icon: 'art' },
  { kind: 'blueprint', weight: 6,  minAmount: 1,   maxAmount: 1,   label: 'Ship blueprint found',                 icon: 'bpt' },
  { kind: 'anomaly',   weight: 3,  minAmount: 1,   maxAmount: 1,   label: 'Anomalous signal detected',            icon: 'anm' },
];

// ── Seeded RNG (same as game/math.ts stableHash + createRng pattern) ────────

function explorationHash(text: string): number {
  let hash = 23;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function seededFloat(seed: number): number {
  // LCG step
  const next = (seed * 16807 + 1) >>> 0;
  return (next & 0x7FFFFFFF) / 0x7FFFFFFF;
}

// ── Core Roll Function ──────────────────────────────────────────────────────

/**
 * Roll a discovery for a specific planet. Deterministic given the same inputs.
 * @param galaxySeed - world seed (shared by all players)
 * @param starIndex - index of the star system
 * @param bodyIndex - index of the body within the system
 * @param isStation - if true, exclude ore from results (stations yield tech/artifacts, not raw ore)
 */
export function rollDiscovery(galaxySeed: number, starIndex: number, bodyIndex: number, isStation = false): DiscoveryResult {
  const key = `explore:${galaxySeed}:${starIndex}:${bodyIndex}`;
  const baseSeed = explorationHash(key);

  // Build effective table — stations yield tech/artifacts (no raw resources)
  const table = isStation
    ? DISCOVERY_TABLE.map(e => {
        // Stations don't yield raw resources — redistribute to tech/lore
        if (e.kind === 'ore' || e.kind === 'food' || e.kind === 'fuel') return { ...e, weight: 0 };
        if (e.kind === 'energy') return { ...e, weight: 5, label: 'Power cell salvaged', icon: 'nrg' }; // small energy find OK
        if (e.kind === 'blueprint') return { ...e, weight: e.weight + 20 };
        if (e.kind === 'artifact') return { ...e, weight: e.weight + 12 };
        if (e.kind === 'anomaly') return { ...e, weight: e.weight + 5 };
        return e;
      })
    : DISCOVERY_TABLE;
  const totalWeight = table.reduce((s, e) => s + e.weight, 0);

  // First roll: pick discovery kind
  const kindRoll = seededFloat(baseSeed);
  const scaled = kindRoll * totalWeight;
  let cumulative = 0;
  let entry: DiscoveryEntry = table[0]!;
  for (const e of table) {
    cumulative += e.weight;
    if (scaled < cumulative) {
      entry = e;
      break;
    }
  }

  // Second roll: determine amount within range
  const amountRoll = seededFloat(baseSeed + 7919);
  const amount = entry.minAmount === entry.maxAmount
    ? entry.minAmount
    : Math.floor(entry.minAmount + amountRoll * (entry.maxAmount - entry.minAmount + 1));

  return {
    kind: entry.kind,
    amount,
    label: entry.label,
    icon: entry.icon,
    ...(entry.kind === 'artifact' ? { itemId: 'luminari_artifact' as const, itemCount: 1 } : {}),
  };
}

// ── API Contract ────────────────────────────────────────────────────────────

export interface ExploreRequest {
  starIndex: number;
  bodyIndex: number;
}

export interface ExploreResponse {
  explored: boolean;        // false if already explored (duplicate)
  result: DiscoveryResult;
}

// ── Pod Kind → Resource mapping (for future pod-to-economy bridge) ──────────

export function podKindToResource(kind: PodKind): 'ore' | 'food' | 'energy' | null {
  switch (kind) {
    case 'ore': return 'ore';
    case 'food': return 'food';
    case 'energy': return 'energy';
    default: return null;
  }
}
