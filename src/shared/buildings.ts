import type {
  BuildType,
  DefenseScore,
  ResourceStore,
  StarBuildingState,
  StarBuildingsState,
} from './api';

export type BuildingCatalogEntry = {
  id: BuildType;
  label: string;
  maxLevel: number;
  durationSeconds: number;
  prereqs: Partial<Record<BuildType, number>>;
};

export const BUILDING_CATALOG: Record<BuildType, BuildingCatalogEntry> = {
  station: {
    id: 'station',
    label: 'Station',
    maxLevel: 8,
    durationSeconds: 300,
    prereqs: {},
  },
  mine: {
    id: 'mine',
    label: 'Mine',
    maxLevel: 8,
    durationSeconds: 300,
    prereqs: { station: 1 },
  },
  solar: {
    id: 'solar',
    label: 'Solar Array',
    maxLevel: 8,
    durationSeconds: 300,
    prereqs: { station: 1 },
  },
  hab: {
    id: 'hab',
    label: 'Hab',
    maxLevel: 8,
    durationSeconds: 300,
    prereqs: { station: 1 },
  },
  warehouse: {
    id: 'warehouse',
    label: 'Warehouse',
    maxLevel: 8,
    durationSeconds: 300,
    prereqs: { station: 2 },
  },
  dock: {
    id: 'dock',
    label: 'Space Dock',
    maxLevel: 5,
    durationSeconds: 600,
    prereqs: { station: 2 },
  },
  shield: {
    id: 'shield',
    label: 'Shield Gen',
    maxLevel: 5,
    durationSeconds: 300,
    prereqs: { station: 2 },
  },
  cannon: {
    id: 'cannon',
    label: 'Ion Cannon',
    maxLevel: 5,
    durationSeconds: 300,
    prereqs: { station: 3 },
  },
  refinery: {
    id: 'refinery',
    label: 'Refinery',
    maxLevel: 3,
    durationSeconds: 300,
    prereqs: { station: 2, mine: 1 },
  },
};

const BUILDING_ORDER: BuildType[] = ['station', 'mine', 'solar', 'hab', 'warehouse', 'dock', 'shield', 'cannon', 'refinery'];
const BASE_RESOURCE_CAP = 1600;
const WAREHOUSE_CAP_BONUS = 400;
const STATION_COST_BASE: ResourceStore = { ore: 420, food: 420, energy: 420, fuel: 0 };
const STATION_COST_STEP: ResourceStore = { ore: 180, food: 180, energy: 180, fuel: 0 };
const BUILD_COST_BASE: Record<Exclude<BuildType, 'station'>, ResourceStore> = {
  mine: { ore: 260, food: 120, energy: 180, fuel: 0 },
  solar: { ore: 300, food: 180, energy: 260, fuel: 0 },
  hab: { ore: 180, food: 220, energy: 120, fuel: 0 },
  warehouse: { ore: 240, food: 180, energy: 180, fuel: 0 },
  dock: { ore: 500, food: 300, energy: 400, fuel: 0 },
  shield: { ore: 400, food: 300, energy: 350, fuel: 0 },
  cannon: { ore: 500, food: 250, energy: 450, fuel: 0 },
  refinery: { ore: 300, food: 100, energy: 200, fuel: 0 },
};
const BUILD_RATE_STEP = 21;

function makeBuildingState(level: number, status: StarBuildingState['status']): StarBuildingState {
  return { level, status, completeAt: null };
}

export function createInitialStarBuildings(): StarBuildingsState {
  return {
    station: makeBuildingState(1, 'ACTIVE'),
    mine: makeBuildingState(0, 'READY'),
    solar: makeBuildingState(0, 'READY'),
    hab: makeBuildingState(0, 'READY'),
    warehouse: makeBuildingState(0, 'LOCKED'),
    dock: makeBuildingState(0, 'LOCKED'),
    shield: makeBuildingState(0, 'LOCKED'),
    cannon: makeBuildingState(0, 'LOCKED'),
    refinery: makeBuildingState(0, 'LOCKED'),
  };
}

export function normalizeStarBuildings(
  input?: Partial<Record<BuildType, Partial<StarBuildingState>>> | null,
): StarBuildingsState {
  const defaults = createInitialStarBuildings();
  const result = {} as StarBuildingsState;

  for (const type of BUILDING_ORDER) {
    const existing = input?.[type];
    const base = defaults[type];
    result[type] = {
      level: Number.isFinite(existing?.level) ? Math.max(0, Math.floor(existing?.level ?? 0)) : base.level,
      status: existing?.status ?? base.status,
      completeAt: Number.isFinite(existing?.completeAt)
        ? Math.max(0, Math.floor(existing?.completeAt ?? 0))
        : null,
    };
  }

  for (const type of BUILDING_ORDER) {
    const building = result[type];
    const unlocked = isBuildUnlocked(result, type);
    if (building.status !== 'UPGRADING') {
      if (building.level > 0) {
        building.status = 'ACTIVE';
      } else if (unlocked) {
        building.status = 'READY';
      } else {
        building.status = 'LOCKED';
      }
      building.completeAt = null;
    }
  }

  return result;
}

export function getBuildingTargetLevel(buildings: StarBuildingsState, type: BuildType): number {
  return buildings[type].level + 1;
}

export function isBuildUnlocked(buildings: StarBuildingsState, type: BuildType): boolean {
  const prereqs = BUILDING_CATALOG[type].prereqs;
  return Object.entries(prereqs).every(([prereqType, requiredLevel]) => {
    const state = buildings[prereqType as BuildType];
    return !!state && state.level >= (requiredLevel ?? 0);
  });
}

export function getUnlockedBuildTypes(buildings: StarBuildingsState): BuildType[] {
  return BUILDING_ORDER.filter((type) => isBuildUnlocked(buildings, type));
}

export function getBuildingCost(type: BuildType, targetLevel: number): ResourceStore {
  const level = Math.max(1, Math.floor(targetLevel));
  if (type === 'station') {
    const step = Math.max(0, level - 2);
    return {
      ore: STATION_COST_BASE.ore + STATION_COST_STEP.ore * step,
      food: STATION_COST_BASE.food + STATION_COST_STEP.food * step,
      energy: STATION_COST_BASE.energy + STATION_COST_STEP.energy * step,
      fuel: 0,
    };
  }

  const base = BUILD_COST_BASE[type];
  return {
    ore: base.ore * level,
    food: base.food * level,
    energy: base.energy * level,
    fuel: 0,
  };
}

export function getBuildingDurationSeconds(_type: BuildType, targetLevel = 1): number {
  // 2 min base + 1 min per additional level
  return 120 + (targetLevel - 1) * 60;
}

export function reconcileStarBuildings(buildings: StarBuildingsState, now: number): StarBuildingsState {
  const next = normalizeStarBuildings(buildings);
  for (const type of BUILDING_ORDER) {
    const building = next[type];
    if (building.status === 'UPGRADING' && building.completeAt != null && building.completeAt <= now) {
      building.level += 1;
      building.status = 'ACTIVE';
      building.completeAt = null;
    }
  }
  return normalizeStarBuildings(next);
}

function bonusForLevel(level: number): number {
  return BUILD_RATE_STEP * ((level * (level + 1)) / 2);
}

// ── Per-Star Richness ────────────────────────────────────────────────────────

const RATE_PER_RICHNESS = 17; // base rate = richness * this (richness 5→85/min ≈ old 84, richness 10→170/min)
const DEFAULT_RICHNESS: ResourceStore = { ore: 5, food: 5, energy: 5, fuel: 0 };

/** Simple deterministic hash for per-star seeding */
function starRichnessHash(starIndex: number, offset: number): number {
  let h = (starIndex * 2654435761 + offset * 40503) | 0;
  h = (h ^ (h >>> 16)) | 0;
  h = Math.imul(h, 0x45d9f3b);
  h = (h ^ (h >>> 16)) | 0;
  return (h >>> 0);
}

/** Get deterministic resource richness (1-10) for a star. Home stars get 5-10. */
export function getStarRichness(starIndex: number, isHomeStar = false): ResourceStore {
  const min = isHomeStar ? 5 : 1;
  const range = isHomeStar ? 6 : 10; // 5-10 or 1-10
  return {
    ore:    min + (starRichnessHash(starIndex, 1) % range),
    food:   min + (starRichnessHash(starIndex, 2) % range),
    energy: min + (starRichnessHash(starIndex, 3) % range),
    fuel:   min + (starRichnessHash(starIndex, 4) % range),
  };
}

export function computeResourceRatesFromBuildings(
  buildings: StarBuildingsState,
  shieldRaised = false,
  richness: ResourceStore = DEFAULT_RICHNESS,
): ResourceStore {
  const normalized = normalizeStarBuildings(buildings);
  const hasStation = normalized.station.level > 0;
  if (!hasStation) {
    return { ore: 0, food: 0, energy: 0, fuel: 0 };
  }

  // Refinery fuel production: 1/2.5/5 fuel per minute at lv1/2/3
  const REFINERY_FUEL_RATES = [0, 1, 2.5, 5];
  const refineryLevel = normalized.refinery.level;
  const fuelRate = REFINERY_FUEL_RATES[refineryLevel] ?? 0;
  // Baseline fuel production from planet richness (lower multiplier than other resources)
  const FUEL_RATE_PER_RICHNESS = 2.5; // richness 5→12.5/min, richness 10→25/min
  const baseFuel = richness.fuel * FUEL_RATE_PER_RICHNESS;
  // Refinery consumes ore and energy to produce fuel (1 ore + 1 energy per fuel)
  const refineryOreDrain = fuelRate;
  const refineryEnergyDrain = fuelRate;

  const energyDrain = shieldRaised ? SHIELD_ENERGY_DRAIN * normalized.shield.level : 0;
  return {
    ore: richness.ore * RATE_PER_RICHNESS + Math.round(bonusForLevel(normalized.mine.level) * richness.ore / 5) - refineryOreDrain,
    food: richness.food * RATE_PER_RICHNESS + Math.round(bonusForLevel(normalized.hab.level) * richness.food / 5),
    energy: richness.energy * RATE_PER_RICHNESS + Math.round(bonusForLevel(normalized.solar.level) * richness.energy / 5) - energyDrain - refineryEnergyDrain,
    fuel: baseFuel + fuelRate,
  };
}

export function computeResourceCapFromBuildings(buildings: StarBuildingsState): number {
  const normalized = normalizeStarBuildings(buildings);
  return BASE_RESOURCE_CAP + normalized.warehouse.level * WAREHOUSE_CAP_BONUS;
}

// ── Defense ─────────────────────────────────────────────────────────────────

const SHIELD_DEFENSE_PER_LEVEL = 50;
const CANNON_DEFENSE_PER_LEVEL = 40;
const SHIELD_ENERGY_DRAIN = 20; // per minute per shield level when raised

export function computeDefenseScore(buildings: StarBuildingsState, shieldRaised: boolean): DefenseScore {
  const normalized = normalizeStarBuildings(buildings);
  const shield = shieldRaised ? normalized.shield.level * SHIELD_DEFENSE_PER_LEVEL : 0;
  const cannon = normalized.cannon.level * CANNON_DEFENSE_PER_LEVEL;
  return { shield, cannon, total: shield + cannon };
}
