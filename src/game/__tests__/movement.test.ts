import { describe, it, expect } from 'vitest';
import { checkTierTransition, applyTransition, NavigationTier } from '../galaxy';
import { vec2, add, scale, magnitude, sub } from '../math';
import { SYSTEM_SIZE } from '../constants';
import { createBeltGalaxyState, createSystemGalaxyState, createTestGameState } from './test-utils';
import { updateShip } from '../ship';
import { getSafeZone } from '../camera';

const center = SYSTEM_SIZE / 2;

/**
 * Simulate ship movement for multiple frames and return worldShipPos after each frame.
 * This mirrors the game-loop logic: updateShip → compute worldShipPos → checkTierTransition.
 */
function simulateFrames(
  state: ReturnType<typeof createTestGameState>,
  frames: number,
  dt = 1 / 60,
): { worldShipPos: { x: number; y: number }; transition: ReturnType<typeof checkTierTransition> } | null {
  for (let i = 0; i < frames; i++) {
    const safeZone = getSafeZone(state.camera);
    updateShip(state, dt, safeZone);

    const tier = state.galaxy.tier;
    const worldShipPos = (tier === NavigationTier.Local || tier === NavigationTier.Planet)
      ? add(state.ship.pos, state.worldOffset)
      : state.ship.pos;

    const transition = checkTierTransition(worldShipPos, state.galaxy);
    if (transition) {
      return { worldShipPos, transition };
    }
  }
  return null;
}

describe('Movement integration — belt entry and exit', () => {
  it('ship enters belt from inside, flies through, exits on correct side', () => {
    // 1. Start in System tier, ship approaching belt from inside
    const orbitDist = 12;
    const state = createTestGameState({
      tier: NavigationTier.System,
      currentBodyIndex: -1,
    });
    state.galaxy = createSystemGalaxyState(orbitDist);
    // Use small orthoSize so ship can reach boundary (mimics zoomed-in state)
    state.camera.orthoSize = 0.5;

    // Place ship just inside the belt tolerance (will trigger entry)
    state.ship.pos = vec2(center + orbitDist - 0.3, center);
    state.tgtPos = vec2(center + orbitDist - 0.3, center);
    state.tgtActive = false;

    // 2. Detect belt entry
    const worldShipPos = state.ship.pos;
    const entryTransition = checkTierTransition(worldShipPos, state.galaxy);
    expect(entryTransition).not.toBeNull();
    expect(entryTransition!.newTier).toBe(NavigationTier.Local);
    expect(entryTransition!.enteredFromInside).toBe(true);

    // 3. Apply entry — ship should be at y=-6 (bottom of local view)
    const entryPos = applyTransition(state.galaxy, entryTransition!);
    expect(entryPos.y).toBe(-6);
    state.ship.pos = entryPos;
    state.ship.vel = vec2(0, 0);
    state.worldOffset = vec2(0, 0);

    // 4. Set target above the belt (will cross through to top/positive-y)
    state.tgtPos = vec2(0, 7.6); // just beyond exit boundary
    state.tgtActive = true;

    // 5. Simulate many frames until ship reaches exit
    const result = simulateFrames(state, 2000);
    expect(result).not.toBeNull();
    expect(result!.transition.newTier).toBe(NavigationTier.System);
    expect(result!.transition.exitDir!.y).toBeGreaterThan(0); // exited top

    // 6. Apply exit — should be placed OUTSIDE belt (crossed through)
    const exitPos = applyTransition(state.galaxy, result!.transition);
    const distFromCenter = magnitude(sub(exitPos, vec2(center, center)));
    expect(distFromCenter).toBeCloseTo(orbitDist + 1.5, 1);
  });

  it('ship enters belt from inside, bounces back, exits on same side', () => {
    const orbitDist = 12;
    const state = createTestGameState({
      tier: NavigationTier.System,
      currentBodyIndex: -1,
    });
    state.galaxy = createSystemGalaxyState(orbitDist);
    state.camera.orthoSize = 0.5;

    // Entry from inside
    state.ship.pos = vec2(center + orbitDist - 0.3, center);
    const entryTransition = checkTierTransition(state.ship.pos, state.galaxy);
    const entryPos = applyTransition(state.galaxy, entryTransition!);
    expect(entryPos.y).toBe(-6);
    state.ship.pos = entryPos;
    state.ship.vel = vec2(0, 0);
    state.worldOffset = vec2(0, 0);

    // Target below (will exit at bottom = bounced back)
    state.tgtPos = vec2(0, -7.6);
    state.tgtActive = true;

    const result = simulateFrames(state, 2000);
    expect(result).not.toBeNull();
    expect(result!.transition.exitDir!.y).toBeLessThan(0); // exited bottom

    // Apply exit — should be placed INSIDE belt (bounced back)
    const exitPos = applyTransition(state.galaxy, result!.transition);
    const distFromCenter = magnitude(sub(exitPos, vec2(center, center)));
    expect(distFromCenter).toBeCloseTo(orbitDist - 1.5, 1);
  });

  it('ship enters belt from outside, flies through, exits on correct side', () => {
    const orbitDist = 12;
    const state = createTestGameState({
      tier: NavigationTier.System,
      currentBodyIndex: -1,
    });
    state.galaxy = createSystemGalaxyState(orbitDist);
    state.camera.orthoSize = 0.5;

    // Entry from outside
    state.ship.pos = vec2(center + orbitDist + 0.3, center);
    const entryTransition = checkTierTransition(state.ship.pos, state.galaxy);
    expect(entryTransition!.enteredFromInside).toBe(false);

    const entryPos = applyTransition(state.galaxy, entryTransition!);
    expect(entryPos.y).toBe(6); // placed at top when entering from outside
    state.ship.pos = entryPos;
    state.ship.vel = vec2(0, 0);
    state.worldOffset = vec2(0, 0);

    // Target below (crossing through from outside = exiting at bottom)
    state.tgtPos = vec2(0, -7.6);
    state.tgtActive = true;

    const result = simulateFrames(state, 2000);
    expect(result).not.toBeNull();
    expect(result!.transition.exitDir!.y).toBeLessThan(0);

    // Apply exit — crossed through → should be INSIDE belt
    const exitPos = applyTransition(state.galaxy, result!.transition);
    const distFromCenter = magnitude(sub(exitPos, vec2(center, center)));
    expect(distFromCenter).toBeCloseTo(orbitDist - 1.5, 1);
  });

  it('ship enters belt from outside, bounces back to outside', () => {
    const orbitDist = 12;
    const state = createTestGameState({
      tier: NavigationTier.System,
      currentBodyIndex: -1,
    });
    state.galaxy = createSystemGalaxyState(orbitDist);
    state.camera.orthoSize = 0.5;

    // Entry from outside
    state.ship.pos = vec2(center + orbitDist + 0.3, center);
    const entryTransition = checkTierTransition(state.ship.pos, state.galaxy);
    const entryPos = applyTransition(state.galaxy, entryTransition!);
    expect(entryPos.y).toBe(6); // top
    state.ship.pos = entryPos;
    state.ship.vel = vec2(0, 0);
    state.worldOffset = vec2(0, 0);

    // Target above (exiting at top = bounced back to outside)
    state.tgtPos = vec2(0, 7.6);
    state.tgtActive = true;

    const result = simulateFrames(state, 2000);
    expect(result).not.toBeNull();
    expect(result!.transition.exitDir!.y).toBeGreaterThan(0);

    // Apply exit — bounced back → should be OUTSIDE belt
    const exitPos = applyTransition(state.galaxy, result!.transition);
    const distFromCenter = magnitude(sub(exitPos, vec2(center, center)));
    expect(distFromCenter).toBeCloseTo(orbitDist + 1.5, 1);
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

    const result = simulateFrames(state, 300);
    expect(result).not.toBeNull();
    expect(result!.transition.newTier).toBe(NavigationTier.Galaxy);
  });
});

describe('Movement integration — planet exit to system', () => {
  it('exits planet when ship exceeds exitX threshold', () => {
    const state = createTestGameState();
    state.galaxy.tier = NavigationTier.Planet;
    state.galaxy.currentBodyIndex = 1; // planet

    // Place ship near right edge
    state.ship.pos = vec2(4.0, 0);
    state.tgtPos = vec2(6, 0); // target beyond threshold
    state.tgtActive = true;

    const result = simulateFrames(state, 300);
    expect(result).not.toBeNull();
    expect(result!.transition.newTier).toBe(NavigationTier.System);
    expect(result!.transition.exitDir!.x).toBeGreaterThan(0);
  });
});
