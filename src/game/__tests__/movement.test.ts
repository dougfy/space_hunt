import { describe, it, expect } from 'vitest';
import { checkTierTransition, applyTransition, NavigationTier } from '../galaxy';
import { vec2, magnitude, sub } from '../math';
import { SYSTEM_SIZE } from '../constants';
import { createBeltGalaxyState, createSystemGalaxyState, createTestGameState } from './test-utils';
import { updateShip } from '../ship';
import { getSafeZone } from '../camera';

const center = SYSTEM_SIZE / 2; // 20

function simulateFrames(
  state: ReturnType<typeof createTestGameState>,
  frames: number,
  dt = 1 / 60,
): { shipPos: { x: number; y: number }; transition: ReturnType<typeof checkTierTransition> } | null {
  for (let i = 0; i < frames; i++) {
    const safeZone = getSafeZone(state.camera);
    updateShip(state, dt, safeZone);

    const transition = checkTierTransition(state.ship.pos, state.galaxy);
    if (transition) {
      return { shipPos: state.ship.pos, transition };
    }
  }
  return null;
}

describe('Movement integration — ring model belt transitions', () => {
  it('ship enters belt and stays at same position', () => {
    const orbitDist = 12;
    const state = createTestGameState({
      tier: NavigationTier.System,
      currentBodyIndex: -1,
    });
    state.galaxy = createSystemGalaxyState(orbitDist);

    // Place ship just inside the belt tolerance (will trigger entry)
    state.ship.pos = vec2(center + orbitDist - 0.3, center);

    const transition = checkTierTransition(state.ship.pos, state.galaxy);
    expect(transition).not.toBeNull();
    expect(transition!.newTier).toBe(NavigationTier.Local);

    // Apply entry — ship should stay at same position
    const newPos = applyTransition(state.galaxy, transition!, state.ship.pos);
    expect(newPos.x).toBeCloseTo(state.ship.pos.x, 5);
    expect(newPos.y).toBeCloseTo(state.ship.pos.y, 5);
  });

  it('ship moves outward through belt and exits to System', () => {
    const orbitDist = 12;
    const state = createTestGameState({
      tier: NavigationTier.Local,
      currentBodyIndex: 0,
    });
    state.galaxy = createBeltGalaxyState({ fromInside: true, orbitDist });

    // Place ship on the belt ring, moving outward
    state.ship.pos = vec2(center + orbitDist, center);
    // Target well outside the belt
    state.tgtPos = vec2(center + orbitDist + 5, center);
    state.tgtActive = true;

    const result = simulateFrames(state, 3000);
    expect(result).not.toBeNull();
    expect(result!.transition!.newTier).toBe(NavigationTier.System);

    // Ship should be beyond belt outer edge
    const distFromCenter = magnitude(sub(result!.shipPos, vec2(center, center)));
    expect(distFromCenter).toBeGreaterThan(orbitDist + 3.5);
  });

  it('ship moves inward through belt and exits to System', () => {
    const orbitDist = 12;
    const state = createTestGameState({
      tier: NavigationTier.Local,
      currentBodyIndex: 0,
    });
    state.galaxy = createBeltGalaxyState({ fromInside: false, orbitDist });

    // Place ship on the belt ring, moving inward
    state.ship.pos = vec2(center + orbitDist, center);
    state.tgtPos = vec2(center + orbitDist - 5, center);
    state.tgtActive = true;

    const result = simulateFrames(state, 3000);
    expect(result).not.toBeNull();
    expect(result!.transition!.newTier).toBe(NavigationTier.System);

    // Ship should be beyond belt inner edge
    const distFromCenter = magnitude(sub(result!.shipPos, vec2(center, center)));
    expect(distFromCenter).toBeLessThan(orbitDist - 3.5);
  });

  it('belt exit keeps ship at its position (no remap)', () => {
    const orbitDist = 12;
    const galaxy = createBeltGalaxyState({ fromInside: true, orbitDist });
    // Ship has drifted outside belt threshold
    const shipPos = vec2(center + orbitDist + 4, center);

    const transition = checkTierTransition(shipPos, galaxy);
    expect(transition).not.toBeNull();

    const newPos = applyTransition(galaxy, transition!, shipPos);
    // Position unchanged
    expect(newPos.x).toBe(shipPos.x);
    expect(newPos.y).toBe(shipPos.y);
  });
});

describe('Movement integration — system exit to galaxy', () => {
  it('ship exits system when moving past SYSTEM_EXIT_RADIUS', () => {
    const state = createTestGameState();
    state.galaxy = createSystemGalaxyState();

    // Place ship near exit radius, moving outward
    state.ship.pos = vec2(center + 17.5, center);
    state.ship.vel = vec2(0.5, 0);
    state.tgtPos = vec2(center + 25, center);
    state.tgtActive = true;

    const result = simulateFrames(state, 2000);
    expect(result).not.toBeNull();
    expect(result!.transition!.newTier).toBe(NavigationTier.Galaxy);
  });
});
