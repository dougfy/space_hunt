// ── Ship Logic ──────────────────────────────────────────────────────────────

import type { Vec2, ShipShape, GameState } from './types';
import {
  SHIP_MAX_SPEED, SHIP_ACCELERATION, SHIP_ARRIVE_RADIUS,
  AVOID_STRENGTH,
} from './constants';
import {
  vec2, add, sub, scale, normalize, magnitude, sqrMagnitude,
  moveTowardsVec2,
} from './math';
import { computeAvoidance, resolveShipCollisions } from './asteroids';

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

  if (state.tgtActive) {
    const d = sub(state.tgtPos, ship.pos);
    const dist = magnitude(d);

    if (dist > 0.03) {
      const tgtInSafe = state.tgtPos.x > safeZone.minX && state.tgtPos.x < safeZone.maxX &&
        state.tgtPos.y > safeZone.minY && state.tgtPos.y < safeZone.maxY;

      let desiredSpeed = state.fuelPercent > 0 ? SHIP_MAX_SPEED : 0;
      if (tgtInSafe && dist < SHIP_ARRIVE_RADIUS) {
        desiredSpeed *= Math.max(0, Math.min(1, (dist - 0.02) / (SHIP_ARRIVE_RADIUS - 0.02)));
      }

      let desiredVel = scale(normalize(d), desiredSpeed);
      // Steer around nearby asteroids
      const avoidance = computeAvoidance(ship.pos, state.asteroids, state.impactBufferWorld);
      desiredVel = add(desiredVel, scale(avoidance, AVOID_STRENGTH));
      if (magnitude(desiredVel) > SHIP_MAX_SPEED) {
        desiredVel = scale(normalize(desiredVel), SHIP_MAX_SPEED);
      }
      ship.vel = moveTowardsVec2(ship.vel, desiredVel, SHIP_ACCELERATION * dt);
      ship.thrust = sqrMagnitude(ship.vel) > 0.0025 && desiredSpeed > 0.02;
    } else {
      state.tgtActive = false;
      ship.thrust = false;
    }
  } else {
    ship.vel = moveTowardsVec2(ship.vel, vec2(0, 0), SHIP_ACCELERATION * 0.6 * dt);
    ship.thrust = false;
  }

  ship.pos = add(ship.pos, scale(ship.vel, dt));

  // Boundary scrolling
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
