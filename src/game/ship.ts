// ── Ship Logic ──────────────────────────────────────────────────────────────

import type { Vec2, ShipShape, GameState } from './types';
import {
  SHIP_MAX_SPEED, SHIP_ACCELERATION, SHIP_ARRIVE_RADIUS,
  AVOID_STRENGTH, GALAXY_SHIP_SPEED, SYSTEM_SHIP_SPEED,
} from './constants';
import {
  vec2, add, sub, scale, normalize, magnitude, sqrMagnitude,
  moveTowardsVec2,
} from './math';
import { computeAvoidance, resolveShipCollisions } from './asteroids';
import { NavigationTier } from './galaxy';

export function getShipShapePoints(shape: ShipShape): Vec2[] {
  // Silhouettes derived from SVG icons (hull + nacelles as single polygon)
  switch (shape) {
    case 'scout':
    default:
      // Kite / arrow with tail notch — matches ship-scout.svg
      return [
        vec2(0, 0.72), vec2(0.4, -0.4), vec2(0, -0.2), vec2(-0.4, -0.4),
      ];
    case 'destroyer':
      // Elongated hex hull with side nacelles — matches ship-destroyer.svg
      return [
        vec2(0, 0.8),
        vec2(0.3, 0.2), vec2(0.3, 0.0),
        vec2(0.5, -0.1), vec2(0.5, -0.4),
        vec2(0.3, -0.3), vec2(0.3, -0.6),
        vec2(0, -0.8),
        vec2(-0.3, -0.6), vec2(-0.3, -0.3),
        vec2(-0.5, -0.4), vec2(-0.5, -0.1),
        vec2(-0.3, 0.0), vec2(-0.3, 0.2),
      ];
    case 'frigate':
      // Wider hull with larger nacelles — matches ship-frigate.svg
      return [
        vec2(0, 0.8),
        vec2(0.4, 0.3), vec2(0.4, 0.1),
        vec2(0.6, 0.0), vec2(0.6, -0.4),
        vec2(0.4, -0.3), vec2(0.4, -0.5),
        vec2(0.2, -0.8),
        vec2(-0.2, -0.8),
        vec2(-0.4, -0.5), vec2(-0.4, -0.3),
        vec2(-0.6, -0.4), vec2(-0.6, 0.0),
        vec2(-0.4, 0.1), vec2(-0.4, 0.3),
      ];
    case 'battleship':
      // Broad heavy hull with large nacelles — matches ship-battleship.svg
      return [
        vec2(0, 0.9),
        vec2(0.5, 0.4), vec2(0.5, 0.2),
        vec2(0.7, 0.1), vec2(0.7, -0.5),
        vec2(0.5, -0.4), vec2(0.5, -0.6),
        vec2(0.3, -0.9),
        vec2(-0.3, -0.9),
        vec2(-0.5, -0.6), vec2(-0.5, -0.4),
        vec2(-0.7, -0.5), vec2(-0.7, 0.1),
        vec2(-0.5, 0.2), vec2(-0.5, 0.4),
      ];
    case 'cruiser':
      // Imposing hull, large nacelles, antenna spike — matches ship-command-cruiser.svg
      return [
        vec2(0, 1.14),
        vec2(0.56, 0.44), vec2(0.56, 0.24),
        vec2(0.8, 0.14), vec2(0.8, -0.56),
        vec2(0.56, -0.46), vec2(0.56, -0.66),
        vec2(0.3, -0.96),
        vec2(-0.3, -0.96),
        vec2(-0.56, -0.66), vec2(-0.56, -0.46),
        vec2(-0.8, -0.56), vec2(-0.8, 0.14),
        vec2(-0.56, 0.24), vec2(-0.56, 0.44),
      ];
    case 'dreadnought':
      // Massive fortress, very wide nacelles — matches ship-dreadnought.svg
      return [
        vec2(0, 1.0),
        vec2(0.6, 0.5), vec2(0.66, 0.2),
        vec2(0.9, 0.1), vec2(0.9, -0.6),
        vec2(0.66, -0.5), vec2(0.66, -0.7),
        vec2(0.3, -1.0),
        vec2(-0.3, -1.0),
        vec2(-0.66, -0.7), vec2(-0.66, -0.5),
        vec2(-0.9, -0.6), vec2(-0.9, 0.1),
        vec2(-0.66, 0.2), vec2(-0.6, 0.5),
      ];
  }
}

export type ShipDetail =
  | { type: 'circle'; center: Vec2; radius: number }
  | { type: 'line'; from: Vec2; to: Vec2 };

/** Internal detail strokes for each ship shape (local coords, same scale as outline). */
export function getShipDetailElements(shape: ShipShape): ShipDetail[] {
  switch (shape) {
    case 'scout':
    default:
      return [
        { type: 'circle', center: vec2(0, 0.1), radius: 0.1 },
      ];
    case 'destroyer':
      return [
        { type: 'circle', center: vec2(0, 0.05), radius: 0.12 },
        { type: 'line', from: vec2(0, -0.15), to: vec2(0, -0.45) },
      ];
    case 'frigate':
      return [
        { type: 'circle', center: vec2(0, 0.0), radius: 0.16 },
        { type: 'line', from: vec2(-0.1, -0.25), to: vec2(-0.1, -0.55) },
        { type: 'line', from: vec2(0.1, -0.25), to: vec2(0.1, -0.55) },
      ];
    case 'battleship':
      return [
        { type: 'circle', center: vec2(0, 0.15), radius: 0.15 },
        { type: 'line', from: vec2(-0.15, -0.1), to: vec2(-0.15, -0.55) },
        { type: 'line', from: vec2(0.15, -0.1), to: vec2(0.15, -0.55) },
        { type: 'line', from: vec2(-0.15, -0.1), to: vec2(0.15, -0.1) },
        { type: 'line', from: vec2(-0.15, -0.55), to: vec2(0.15, -0.55) },
      ];
    case 'cruiser':
      return [
        { type: 'circle', center: vec2(0, 0.3), radius: 0.18 },
        { type: 'line', from: vec2(-0.15, -0.05), to: vec2(-0.15, -0.5) },
        { type: 'line', from: vec2(0.15, -0.05), to: vec2(0.15, -0.5) },
        { type: 'line', from: vec2(-0.15, -0.05), to: vec2(0.15, -0.05) },
        { type: 'line', from: vec2(-0.15, -0.5), to: vec2(0.15, -0.5) },
        { type: 'line', from: vec2(0, 1.14), to: vec2(0, 1.3) }, // antenna
      ];
    case 'dreadnought':
      return [
        { type: 'line', from: vec2(-0.25, 0.2), to: vec2(0.25, 0.2) },
        { type: 'line', from: vec2(-0.25, -0.4), to: vec2(0.25, -0.4) },
        { type: 'line', from: vec2(-0.25, 0.2), to: vec2(-0.25, -0.4) },
        { type: 'line', from: vec2(0.25, 0.2), to: vec2(0.25, -0.4) },
        { type: 'line', from: vec2(-0.1, -0.4), to: vec2(-0.1, -0.7) },
        { type: 'line', from: vec2(0, -0.4), to: vec2(0, -0.7) },
        { type: 'line', from: vec2(0.1, -0.4), to: vec2(0.1, -0.7) },
        { type: 'line', from: vec2(-0.08, 1.0), to: vec2(-0.12, 1.15) }, // antenna L
        { type: 'line', from: vec2(0.08, 1.0), to: vec2(0.12, 1.15) },  // antenna R
      ];
  }
}

export function normalizeShipShape(shape: string): ShipShape {
  switch (shape) {
    case 'scout':
    case 'destroyer':
    case 'frigate':
    case 'battleship':
    case 'cruiser':
    case 'dreadnought':
      return shape;
    default:
      return 'scout';
  }
}

export function updateShip(state: GameState, dt: number, safeZone: { minX: number; maxX: number; minY: number; maxY: number }): void {
  const { ship } = state;
  const maxSpeed = state.galaxy.tier === NavigationTier.Local || state.galaxy.tier === NavigationTier.Planet
    ? SHIP_MAX_SPEED
    : state.galaxy.tier === NavigationTier.System ? SYSTEM_SHIP_SPEED
    : GALAXY_SHIP_SPEED;

  const accelScale = maxSpeed / SHIP_MAX_SPEED;

  // ── Keyboard mode: rotation + thrust ──
  if (state.inputMode === 'keyboard' && (state.keyThrust || state.keyTurnRate !== 0 || !state.tgtActive)) {
    // Turn: left/right rotates ship angle
    const TURN_SPEED = 3.5; // radians per second (~200°/s)
    if (state.keyTurnRate !== 0) {
      ship.ang += state.keyTurnRate * TURN_SPEED * dt;
    }

    if (state.keyThrust && state.fuelPercent > 0) {
      // Thrust in facing direction
      const forwardDir = vec2(Math.cos(ship.ang), Math.sin(ship.ang));
      let desiredVel = scale(forwardDir, maxSpeed);

      // Asteroid avoidance (Local tier)
      if (state.galaxy.tier === NavigationTier.Local) {
        const avoidance = computeAvoidance(ship.pos, state.asteroids, state.impactBufferWorld);
        desiredVel = add(desiredVel, scale(avoidance, AVOID_STRENGTH));
      }
      if (magnitude(desiredVel) > maxSpeed) {
        desiredVel = scale(normalize(desiredVel), maxSpeed);
      }

      ship.vel = moveTowardsVec2(ship.vel, desiredVel, SHIP_ACCELERATION * accelScale * dt);
      ship.thrust = true;
    } else {
      // No thrust: decelerate
      ship.vel = moveTowardsVec2(ship.vel, vec2(0, 0), SHIP_ACCELERATION * accelScale * 0.6 * dt);
      ship.thrust = false;
    }
  } else if (state.tgtActive) {
    const d = sub(state.tgtPos, ship.pos);
    const dist = magnitude(d);

    if (dist > 0.03) {
      const tgtInSafe = state.tgtPos.x > safeZone.minX && state.tgtPos.x < safeZone.maxX &&
        state.tgtPos.y > safeZone.minY && state.tgtPos.y < safeZone.maxY;

      let desiredSpeed = state.fuelPercent > 0 ? maxSpeed : 0;
      // Scale arrive radius with tier speed so the ship decelerates proportionally
      const arriveR = SHIP_ARRIVE_RADIUS * (maxSpeed / SHIP_MAX_SPEED);
      // In Planet tier, don't decelerate near target if target is near visible edge
      // (this lets the ship fly off-screen to trigger tier transition)
      const nearEdge = state.galaxy.tier === NavigationTier.Planet && !tgtInSafe;
      if (dist < arriveR && !nearEdge) {
        desiredSpeed *= Math.max(0, Math.min(1, (dist - 0.02) / (arriveR - 0.02)));
      }

      let desiredVel = scale(normalize(d), desiredSpeed);
      // Steer around nearby asteroids (only in local tier)
      if (state.galaxy.tier === NavigationTier.Local) {
        const avoidance = computeAvoidance(ship.pos, state.asteroids, state.impactBufferWorld);
        desiredVel = add(desiredVel, scale(avoidance, AVOID_STRENGTH));
      }
      if (magnitude(desiredVel) > maxSpeed) {
        desiredVel = scale(normalize(desiredVel), maxSpeed);
      }
      ship.vel = moveTowardsVec2(ship.vel, desiredVel, SHIP_ACCELERATION * accelScale * dt);
      ship.thrust = sqrMagnitude(ship.vel) > 0.0025 && desiredSpeed > 0.02;
    } else {
      // In Planet tier near edge, keep flying past target toward boundary
      if (state.galaxy.tier === NavigationTier.Planet &&
          (Math.abs(ship.pos.x) > 3.5 || Math.abs(ship.pos.y) > 2.0)) {
        // Don't stop — keep current velocity
        ship.thrust = true;
      } else {
        state.tgtActive = false;
        ship.thrust = false;
      }
    }
  } else {
    ship.vel = moveTowardsVec2(ship.vel, vec2(0, 0), SHIP_ACCELERATION * accelScale * 0.6 * dt);
    ship.thrust = false;
  }

  ship.pos = add(ship.pos, scale(ship.vel, dt));

  // Boundary scrolling (Planet tier only — Galaxy/System/Local tiers follow the ship with the camera)
  if (state.galaxy.tier === NavigationTier.Planet) {
  let worldShift = vec2(0, 0);
  if (ship.pos.x < safeZone.minX) {
    worldShift = { ...worldShift, x: ship.pos.x - safeZone.minX };
    ship.pos = { ...ship.pos, x: safeZone.minX };
  } else if (ship.pos.x > safeZone.maxX) {
    worldShift = { ...worldShift, x: ship.pos.x - safeZone.maxX };
    ship.pos = { ...ship.pos, x: safeZone.maxX };
  }
  if (ship.pos.y < safeZone.minY) {
    worldShift = { ...worldShift, y: ship.pos.y - safeZone.minY };
    ship.pos = { ...ship.pos, y: safeZone.minY };
  } else if (ship.pos.y > safeZone.maxY) {
    worldShift = { ...worldShift, y: ship.pos.y - safeZone.maxY };
    ship.pos = { ...ship.pos, y: safeZone.maxY };
  }

  if (sqrMagnitude(worldShift) > 0) {
    applyWorldShift(state, worldShift);
  }
  }

  // Hard collision resolution
  resolveShipCollisions(state);

  // Update angle from velocity (mouse mode only — keyboard mode controls angle directly)
  if (state.inputMode !== 'keyboard' && sqrMagnitude(ship.vel) > 0.01) {
    ship.ang = Math.atan2(ship.vel.y, ship.vel.x);
  }
}

function applyWorldShift(state: GameState, shift: Vec2): void {
  // Only used by Planet tier for edge-based transitions
  const desired = add(state.worldOffset, shift);

  const actual = sub(desired, state.worldOffset);
  state.worldOffset = desired;

  if (sqrMagnitude(actual) > 0) {
    for (const asteroid of state.asteroids) {
      asteroid.pos = sub(asteroid.pos, actual);
    }
    for (const pod of state.pods) {
      pod.pos = sub(pod.pos, actual);
    }
    for (const projectile of state.shooting.projectiles) {
      projectile.origin = sub(projectile.origin, actual);
    }
    if (state.tgtActive) {
      state.tgtPos = sub(state.tgtPos, actual);
    }
  }
}
