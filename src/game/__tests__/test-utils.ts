import { NavigationTier, type GalaxyState, type SystemBody } from '../galaxy';
import type { GameState } from '../types';
import { ZoomState } from '../types';
import { vec2 } from '../math';
import { SYSTEM_SIZE } from '../constants';

const center = SYSTEM_SIZE / 2; // 20

/** Create a belt body at a given orbit distance */
export function createBeltBody(orbitDist = 12, index = 0): SystemBody {
  const angle = 0;
  return {
    index,
    pos: vec2(center + Math.cos(angle) * orbitDist, center + Math.sin(angle) * orbitDist),
    seed: 12345,
    name: 'Test Belt',
    radius: 0.8,
    type: 'belt',
    orbitDist,
    features: [],
  };
}

/** Create a planet body at a given orbit distance */
export function createPlanetBody(orbitDist = 8, index = 0): SystemBody {
  const angle = Math.PI / 4;
  return {
    index,
    pos: vec2(center + Math.cos(angle) * orbitDist, center + Math.sin(angle) * orbitDist),
    seed: 54321,
    name: 'Test Planet',
    radius: 0.6,
    type: 'planet',
    orbitDist,
    features: [{ name: 'Station', type: 'station', angle: 0, dist: 2.0 }],
  };
}

/** Create a GalaxyState configured for belt-crossing tests */
export function createBeltGalaxyState(opts: {
  fromInside?: boolean;
  entryAngle?: number;
  orbitDist?: number;
} = {}): GalaxyState {
  const { fromInside = true, entryAngle = 0, orbitDist = 12 } = opts;
  const belt = createBeltBody(orbitDist, 0);
  const planet = createPlanetBody(8, 1);
  return {
    tier: NavigationTier.Local,
    stars: [{ index: 0, pos: vec2(50, 50), seed: 999, name: 'Test Star', bodyCount: 2 }],
    currentStarIndex: 0,
    currentBodyIndex: 0,
    bodies: [belt, planet],
    galaxySeed: 42,
    bodyEntryAngle: entryAngle,
    beltEnteredFromInside: fromInside,
  };
}

/** Create a GalaxyState at System tier with belt + planet */
export function createSystemGalaxyState(orbitDist = 12): GalaxyState {
  const belt = createBeltBody(orbitDist, 0);
  const planet = createPlanetBody(8, 1);
  return {
    tier: NavigationTier.System,
    stars: [{ index: 0, pos: vec2(50, 50), seed: 999, name: 'Test Star', bodyCount: 2 }],
    currentStarIndex: 0,
    currentBodyIndex: -1,
    bodies: [belt, planet],
    galaxySeed: 42,
    bodyEntryAngle: 0,
    beltEnteredFromInside: true,
  };
}

/** Create a minimal GameState for movement tests */
export function createTestGameState(galaxyOverride?: Partial<GalaxyState>): GameState {
  const galaxy: GalaxyState = {
    tier: NavigationTier.Local,
    stars: [{ index: 0, pos: vec2(50, 50), seed: 999, name: 'Test Star', bodyCount: 2 }],
    currentStarIndex: 0,
    currentBodyIndex: 0,
    bodies: [createBeltBody()],
    galaxySeed: 42,
    bodyEntryAngle: 0,
    beltEnteredFromInside: true,
    ...galaxyOverride,
  };

  return {
    ship: { pos: vec2(0, -6), vel: vec2(0, 0), ang: 0, thrust: false },
    tgtPos: vec2(0, 0),
    tgtActive: false,
    worldOffset: vec2(0, 0),
    asteroids: [],
    asteroidNames: [],
    pods: [],
    ghosts: [],
    camera: { pos: vec2(0, 0), orthoSize: 3.2, aspect: 1.5 },
    fuelPercent: 100,
    docksCollected: 0,
    totalDocks: 0,
    zoomState: ZoomState.Normal,
    zoomTimer: 0,
    zoomOverride: -1,
    elapsedTime: 0,
    playerName: 'TestPlayer',
    shipShape: 'arrow',
    impactBufferWorld: 0.12,
    playing: true,
    splashMode: false,
    shooting: { enabled: false, projectiles: [], cooldownRemaining: 0, hp: 3, invulnRemaining: 0, hitFlashTimer: 0 },
    galaxy,
  };
}
