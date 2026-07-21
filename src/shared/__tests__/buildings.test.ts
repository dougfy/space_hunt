import { describe, expect, it } from 'vitest';
import {
  computeResourceCapFromBuildings,
  computeResourceRatesFromBuildings,
  createInitialStarBuildings,
  getBuildingCost,
  getUnlockedBuildTypes,
  normalizeStarBuildings,
  reconcileStarBuildings,
} from '../buildings';

describe('shared building rules', () => {
  it('creates expected initial unlock state', () => {
    const buildings = createInitialStarBuildings();

    expect(buildings.station.level).toBe(1);
    expect(buildings.mine.status).toBe('READY');
    expect(buildings.warehouse.status).toBe('LOCKED');
    expect(getUnlockedBuildTypes(buildings)).toEqual(['station', 'mine', 'solar', 'hab']);
  });

  it('computes tiered costs and derived economy stats', () => {
    const buildings = normalizeStarBuildings({
      station: { level: 3, status: 'ACTIVE' },
      mine: { level: 2, status: 'ACTIVE' },
      solar: { level: 1, status: 'ACTIVE' },
      hab: { level: 0, status: 'READY' },
      warehouse: { level: 2, status: 'ACTIVE' },
    });

    expect(getBuildingCost('station', 4)).toEqual({ ore: 780, food: 780, energy: 780 });
    expect(getBuildingCost('mine', 3)).toEqual({ ore: 780, food: 360, energy: 540 });
    expect(computeResourceRatesFromBuildings(buildings)).toEqual({ ore: 147, food: 84, energy: 105 });
    expect(computeResourceCapFromBuildings(buildings)).toBe(2400);
  });

  it('reconciles completed upgrades into active levels', () => {
    const buildings = normalizeStarBuildings({
      mine: { level: 1, status: 'UPGRADING', completeAt: 500 },
      warehouse: { level: 0, status: 'UPGRADING', completeAt: 500 },
    });

    const next = reconcileStarBuildings(buildings, 600);

    expect(next.mine.level).toBe(2);
    expect(next.mine.status).toBe('ACTIVE');
    expect(next.warehouse.level).toBe(1);
    expect(next.warehouse.status).toBe('ACTIVE');
  });
});
