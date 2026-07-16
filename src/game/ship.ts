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
  switch (shape) {
    case 'delta':
      return [
        vec2(0, 1), vec2(-0.78, -0.72), vec2(0, -0.22), vec2(0.78, -0.72),
      ];
    case 'needle':
      return [
        vec2(0, 1), vec2(-0.26, -0.98), vec2(0, -0.58), vec2(0.26, -0.98),
      ];
    case 'blade':
      return [
        vec2(0, 1), vec2(-0.86, -0.18), vec2(-0.18, -0.92), vec2(0.58, -0.58),
      ];
    case 'arrow':
    default:
      return [
        vec2(0, 1), vec2(-0.58, -0.72), vec2(0, -0.5), vec2(0.58, -0.72),
      ];
  }
}

export function normalizeShipShape(shape: string): ShipShape {
  if (shape === 'delta' || shape === 'needle' || shape === 'blade') return shape;
  return 'arrow';
}

export function updateShip(state: GameState, dt: number, safeZone: { minX: number; maxX: number; minY: number; maxY: number }): void {
  const { ship } = state;
  const maxSpeed = state.galaxy.tier === NavigationTier.Local || state.galaxy.tier === NavigationTier.Planet
    ? SHIP_MAX_SPEED
    : state.galaxy.tier === NavigationTier.System ? SYSTEM_SHIP_SPEED
    : GALAXY_SHIP_SPEED;

  if (state.tgtActive) {
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
      // Scale acceleration with tier speed so deceleration feels proportional
      const accelScale = maxSpeed / SHIP_MAX_SPEED;
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
    const accelScale = maxSpeed / SHIP_MAX_SPEED;
    ship.vel = moveTowardsVec2(ship.vel, vec2(0, 0), SHIP_ACCELERATION * accelScale * 0.6 * dt);
    ship.thrust = false;
  }

  ship.pos = add(ship.pos, scale(ship.vel, dt));

  // Boundary scrolling (Local tier only — Galaxy/System tiers follow the ship with the camera,
  // Planet tier has fixed camera so ship moves freely for edge-based tier transitions)
  if (state.galaxy.tier === NavigationTier.Local) {
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

  // Update angle from velocity
  if (sqrMagnitude(ship.vel) > 0.01) {
    ship.ang = Math.atan2(ship.vel.y, ship.vel.x);
  }
}

function applyWorldShift(state: GameState, shift: Vec2): void {
  const halfW = state.camera.orthoSize * state.camera.aspect;
  const halfH = state.camera.orthoSize;

  const desired = add(state.worldOffset, shift);
  const limX = Math.max(0, 10 - halfW);
  const limY = Math.max(0, 8 - halfH);
  desired.x = Math.max(-limX, Math.min(limX, desired.x));
  desired.y = Math.max(-limY, Math.min(limY, desired.y));

  const actual = sub(desired, state.worldOffset);
  state.worldOffset = desired;

  if (sqrMagnitude(actual) > 0) {
    for (let i = 0; i < state.asteroids.length; i++) {
      state.asteroids[i].pos = sub(state.asteroids[i].pos, actual);
    }
    for (let i = 0; i < state.pods.length; i++) {
      state.pods[i].pos = sub(state.pods[i].pos, actual);
    }
    for (let i = 0; i < state.shooting.projectiles.length; i++) {
      state.shooting.projectiles[i].origin = sub(state.shooting.projectiles[i].origin, actual);
    }
    if (state.tgtActive) {
      state.tgtPos = sub(state.tgtPos, actual);
    }
  }
}
