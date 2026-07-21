import type { ShipTypeId, ResourceStore } from './api';

export type DockTier = 1 | 2 | 3;

export type ShipCatalogEntry = {
  id: ShipTypeId;
  name: string;
  speed: number;
  offense: number;
  defense: number;
  transport: number;
  shipPoints: number;
  /** Dock tier required */
  dockTier: DockTier;
  /** Minimum dock level within that tier */
  dockLevel: number;
  /** Resource cost to build one unit */
  cost: ResourceStore;
  /** Build time in seconds */
  buildSeconds: number;
};

export const SHIP_CATALOG: Record<ShipTypeId, ShipCatalogEntry> = {
  1: {
    id: 1,
    name: 'Scout',
    speed: 7,
    offense: 10,
    defense: 20,
    transport: 0,
    shipPoints: 1,
    dockTier: 1,
    dockLevel: 1,
    cost: { ore: 100, food: 50, energy: 80 },
    buildSeconds: 60,
  },
  2: {
    id: 2,
    name: 'Freighter',
    speed: 3,
    offense: 0,
    defense: 30,
    transport: 500,
    shipPoints: 2,
    dockTier: 1,
    dockLevel: 1,
    cost: { ore: 200, food: 100, energy: 150 },
    buildSeconds: 120,
  },
  3: {
    id: 3,
    name: 'Destroyer',
    speed: 6,
    offense: 20,
    defense: 30,
    transport: 0,
    shipPoints: 2,
    dockTier: 1,
    dockLevel: 3,
    cost: { ore: 250, food: 120, energy: 200 },
    buildSeconds: 180,
  },
  4: {
    id: 4,
    name: 'Frigate',
    speed: 5,
    offense: 30,
    defense: 40,
    transport: 0,
    shipPoints: 4,
    dockTier: 2,
    dockLevel: 1,
    cost: { ore: 400, food: 200, energy: 350 },
    buildSeconds: 300,
  },
  5: {
    id: 5,
    name: 'Battleship',
    speed: 5,
    offense: 60,
    defense: 60,
    transport: 0,
    shipPoints: 8,
    dockTier: 2,
    dockLevel: 5,
    cost: { ore: 800, food: 400, energy: 700 },
    buildSeconds: 600,
  },
  6: {
    id: 6,
    name: 'Command Cruiser',
    speed: 5,
    offense: 60,
    defense: 80,
    transport: 5,
    shipPoints: 6,
    dockTier: 3,
    dockLevel: 3,
    cost: { ore: 900, food: 500, energy: 800 },
    buildSeconds: 720,
  },
  7: {
    id: 7,
    name: 'Dreadnought',
    speed: 5,
    offense: 80,
    defense: 80,
    transport: 0,
    shipPoints: 10,
    dockTier: 3,
    dockLevel: 3,
    cost: { ore: 1200, food: 600, energy: 1000 },
    buildSeconds: 900,
  },
  8: {
    id: 8,
    name: 'Colony Ship',
    speed: 3,
    offense: 0,
    defense: 30,
    transport: 0,
    shipPoints: 10,
    dockTier: 1,
    dockLevel: 3,
    cost: { ore: 600, food: 400, energy: 500 },
    buildSeconds: 600,
  },
  10: {
    id: 10,
    name: 'Troop Transport',
    speed: 3,
    offense: 10,
    defense: 30,
    transport: 0,
    shipPoints: 4,
    dockTier: 1,
    dockLevel: 3,
    cost: { ore: 350, food: 250, energy: 300 },
    buildSeconds: 300,
  },
  11: {
    id: 11,
    name: 'Basic Probe',
    speed: 5,
    offense: 0,
    defense: 10,
    transport: 0,
    shipPoints: 1,
    dockTier: 1,
    dockLevel: 1,
    cost: { ore: 60, food: 30, energy: 50 },
    buildSeconds: 30,
  },
  12: {
    id: 12,
    name: 'Enhanced Probe',
    speed: 7,
    offense: 0,
    defense: 20,
    transport: 0,
    shipPoints: 3,
    dockTier: 1,
    dockLevel: 3,
    cost: { ore: 180, food: 80, energy: 150 },
    buildSeconds: 120,
  },
  14: {
    id: 14,
    name: 'Wrecker',
    speed: 3,
    offense: 0,
    defense: 30,
    transport: 0,
    shipPoints: 4,
    dockTier: 1,
    dockLevel: 3,
    cost: { ore: 400, food: 200, energy: 300 },
    buildSeconds: 300,
  },
  15: {
    id: 15,
    name: 'Raider',
    speed: 3,
    offense: 0,
    defense: 30,
    transport: 500,
    shipPoints: 4,
    dockTier: 1,
    dockLevel: 3,
    cost: { ore: 380, food: 220, energy: 320 },
    buildSeconds: 300,
  },
};

/** Weapon effectiveness multipliers (attacker → defender → multiplier) */
export const WEAPON_EFFECTIVENESS: Partial<Record<ShipTypeId, Partial<Record<ShipTypeId, number>>>> = {
  1: { 3: 10 },   // Scout → Destroyer
  3: { 4: 10 },   // Destroyer → Frigate
  4: { 1: 10 },   // Frigate → Scout
  5: { 6: 10 },   // Battleship → Command Cruiser
  6: { 5: 10 },   // Command Cruiser → Battleship
  7: { 5: 10 },   // Dreadnought → Battleship
};

/**
 * Determine the effective dock tier from a dock building level.
 * Levels 1-2 = Tier 1, 3-4 = Tier 2, 5 = Tier 3.
 */
export function getDockTier(dockLevel: number): DockTier {
  if (dockLevel >= 5) return 3;
  if (dockLevel >= 3) return 2;
  return 1;
}

/**
 * Get the effective level within the current tier.
 * Tier 1: levels 1-2 → effective 1-2
 * Tier 2: levels 3-4 → effective 1-2
 * Tier 3: level 5 → effective 1
 */
export function getDockTierLevel(dockLevel: number): number {
  if (dockLevel >= 5) return dockLevel - 4;
  if (dockLevel >= 3) return dockLevel - 2;
  return dockLevel;
}

/**
 * Check if a ship type can be built given the current dock level.
 */
export function canBuildShip(shipTypeId: ShipTypeId, dockLevel: number): boolean {
  const entry = SHIP_CATALOG[shipTypeId];
  if (!entry) return false;
  const tier = getDockTier(dockLevel);
  const tierLevel = getDockTierLevel(dockLevel);
  if (tier < entry.dockTier) return false;
  if (tier === entry.dockTier && tierLevel < entry.dockLevel) return false;
  return true;
}

/**
 * Get all ship types available at a given dock level.
 */
export function getAvailableShipTypes(dockLevel: number): ShipCatalogEntry[] {
  return (Object.values(SHIP_CATALOG) as ShipCatalogEntry[]).filter(
    (entry) => canBuildShip(entry.id, dockLevel),
  );
}
