import type {
  BuildType,
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
};

const BUILDING_ORDER: BuildType[] = ['station', 'mine', 'solar', 'hab', 'warehouse', 'dock'];
const BASE_RESOURCE_RATE: ResourceStore = { ore: 84, food: 84, energy: 84 };
const BASE_RESOURCE_CAP = 1600;
const WAREHOUSE_CAP_BONUS = 400;
const STATION_COST_BASE: ResourceStore = { ore: 420, food: 420, energy: 420 };
const STATION_COST_STEP: ResourceStore = { ore: 180, food: 180, energy: 180 };
const BUILD_COST_BASE: Record<Exclude<BuildType, 'station'>, ResourceStore> = {
  mine: { ore: 260, food: 120, energy: 180 },
  solar: { ore: 300, food: 180, energy: 260 },
  hab: { ore: 180, food: 220, energy: 120 },
  warehouse: { ore: 240, food: 180, energy: 180 },
  dock: { ore: 500, food: 300, energy: 400 },
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
    };
  }

  const base = BUILD_COST_BASE[type];
  return {
    ore: base.ore * level,
    food: base.food * level,
    energy: base.energy * level,
  };
}

export function getBuildingDurationSeconds(type: BuildType): number {
  return BUILDING_CATALOG[type].durationSeconds;
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

export function computeResourceRatesFromBuildings(buildings: StarBuildingsState): ResourceStore {
  const normalized = normalizeStarBuildings(buildings);
  const hasStation = normalized.station.level > 0;
  if (!hasStation) {
    return { ore: 0, food: 0, energy: 0 };
  }

  return {
    ore: BASE_RESOURCE_RATE.ore + bonusForLevel(normalized.mine.level),
    food: BASE_RESOURCE_RATE.food + bonusForLevel(normalized.hab.level),
    energy: BASE_RESOURCE_RATE.energy + bonusForLevel(normalized.solar.level),
  };
}

export function computeResourceCapFromBuildings(buildings: StarBuildingsState): number {
  const normalized = normalizeStarBuildings(buildings);
  return BASE_RESOURCE_CAP + normalized.warehouse.level * WAREHOUSE_CAP_BONUS;
}
