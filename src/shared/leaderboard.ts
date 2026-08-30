import type { ShipState } from './api';
import { SHIP_CATALOG } from './ships';
import type { ShipTypeId } from './api';

export const LEADERBOARD_STAR_VALUE = 100;
export const LEADERBOARD_SHIP_MULTIPLIER = 10;
export const LEADERBOARD_BUILDING_LEVEL_VALUE = 25;
export const LEADERBOARD_EXPLORED_PLANET_VALUE = 15;

/** Sum catalog-defined ship points, so larger ships contribute more than scouts. */
export function getWeightedShipValue(ships: ShipState[]): number {
  return ships.reduce((total, ship) => {
    const catalog = SHIP_CATALOG[ship.typeId as ShipTypeId];
    return total + ship.count * (catalog?.shipPoints ?? 0);
  }, 0);
}

export function calculateLeaderboardPower(starCount: number, ships: ShipState[], totalBuildingLevels: number, exploredPlanets = 0): number {
  return starCount * LEADERBOARD_STAR_VALUE
    + getWeightedShipValue(ships) * LEADERBOARD_SHIP_MULTIPLIER
    + totalBuildingLevels * LEADERBOARD_BUILDING_LEVEL_VALUE
    + exploredPlanets * LEADERBOARD_EXPLORED_PLANET_VALUE;
}