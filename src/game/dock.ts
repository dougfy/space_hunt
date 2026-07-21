// ── Docking System ──────────────────────────────────────────────────────────
// Handles docking detection, approach animation, and undocking in Planet tier.

import type { GameState, DockState, Vec2 } from './types';
import { vec2, sub, magnitude, normalize, scale } from './math';
import { NavigationTier } from './galaxy';
import { FEATURE_LABELS } from './constants';
import type { PlanetFeature } from './galaxy';

/** Distance from planet center at which docking begins (matches orbit ring) */
export const DOCK_TRIGGER_RADIUS = 0.4;
/** Distance from feature position at which docking begins */
export const DOCK_FEATURE_RADIUS = 0.4;
/** How fast the approach animation plays (per second, 0→1) */
const APPROACH_SPEED = 1.5;
/** Final distance from planet center when docked (matches orbit ring = 0.25 * 1.6) */
const DOCKED_PLANET_DIST = 0.4;
/** Final distance from feature when docked */
const DOCKED_FEATURE_DIST = 0.3;

/** Check if ship should begin docking to the planet or a feature (Planet tier). Returns new DockState or null. */
export function checkDocking(state: GameState): DockState | null {
  if (state.dock) return null;
  if (state.galaxy.tier !== NavigationTier.Planet) return null;
  if (state.splashMode) return null;

  const shipPos = state.ship.pos;
  const body = state.galaxy.bodies[state.galaxy.currentBodyIndex];
  if (!body) return null;

  // Planet is at origin in Planet tier
  const planetPos = vec2(0, 0);

  // Check features first (smaller targets take priority)
  for (const [fi, feat] of body.features.entries()) {
    const featPos = getFeatureWorldPos(feat);
    const dist = magnitude(sub(shipPos, featPos));
    if (dist < DOCK_FEATURE_RADIUS) {
      return {
        docked: false,
        targetType: 'feature',
        bodyIndex: body.index,
        featureIndex: fi,
        targetName: feat.name,
        targetLabel: FEATURE_LABELS[feat.type] ?? feat.type,
        approachTimer: 0,
      };
    }
  }

  // Check planet itself
  const dist = magnitude(sub(shipPos, planetPos));
  if (dist < DOCK_TRIGGER_RADIUS) {
    return {
      docked: false,
      targetType: 'planet',
      bodyIndex: body.index,
      featureIndex: -1,
      targetName: body.name,
      targetLabel: 'Planet',
      approachTimer: 0,
    };
  }

  return null;
}

/** Get the world position of a feature (planet at origin in Planet tier) */
export function getFeatureWorldPos(feat: PlanetFeature): Vec2 {
  return vec2(
    Math.cos(feat.angle) * feat.dist,
    Math.sin(feat.angle) * feat.dist,
  );
}

/** Update docking approach animation. */
export function updateDocking(state: GameState, dt: number): void {
  const dock = state.dock;
  if (!dock) return;

  const body = state.galaxy.bodies[state.galaxy.currentBodyIndex];
  const planetPos = vec2(0, 0);

  // Advance approach timer
  dock.approachTimer = Math.min(1, dock.approachTimer + APPROACH_SPEED * dt);

  // Compute target position
  let targetPos: Vec2;
  let targetAngle: number;

  if (dock.targetType === 'feature' && body && dock.featureIndex >= 0) {
    const feat = body.features[dock.featureIndex];
    if (!feat) return;
    const featPos = getFeatureWorldPos(feat);
    // Dock just outside the feature
    const toFeat = normalize(sub(featPos, planetPos));
    targetPos = vec2(
      featPos.x - toFeat.x * DOCKED_FEATURE_DIST,
      featPos.y - toFeat.y * DOCKED_FEATURE_DIST,
    );
    targetAngle = Math.atan2(toFeat.y, toFeat.x);
  } else {
    // Dock in orbit around planet
    const shipToBody = sub(planetPos, state.ship.pos);
    const angle = Math.atan2(shipToBody.y, shipToBody.x);
    targetPos = vec2(
      -Math.cos(angle) * DOCKED_PLANET_DIST,
      -Math.sin(angle) * DOCKED_PLANET_DIST,
    );
    targetAngle = angle;
  }

  // Lerp ship toward target
  const t = dock.approachTimer;
  const eased = t * t * (3 - 2 * t); // smoothstep
  state.ship.pos = vec2(
    state.ship.pos.x + (targetPos.x - state.ship.pos.x) * eased * 0.15,
    state.ship.pos.y + (targetPos.y - state.ship.pos.y) * eased * 0.15,
  );
  // Lerp angle
  state.ship.ang = state.ship.ang + (targetAngle - state.ship.ang) * eased * 0.15;
  // Kill velocity
  state.ship.vel = vec2(0, 0);
  state.ship.thrust = false;

  // Mark as fully docked when close enough
  if (dock.approachTimer >= 1) {
    dock.docked = true;
    state.ship.pos = targetPos;
    state.ship.ang = targetAngle;
  }
}

/** Undock from current target — push ship away and restore control */
export function undock(state: GameState): void {
  if (!state.dock) return;

  const body = state.galaxy.bodies[state.galaxy.currentBodyIndex];

  // Determine what we're pushing away from
  let targetPos: Vec2;
  if (state.dock.targetType === 'feature' && body && state.dock.featureIndex >= 0) {
    const feat = body.features[state.dock.featureIndex];
    if (!feat) return;
    targetPos = getFeatureWorldPos(feat);
  } else {
    targetPos = vec2(0, 0); // planet center
  }

  // Push ship away from the dock target
  const diff = sub(state.ship.pos, targetPos);
  const m = magnitude(diff);
  const away = m > 0.01 ? vec2(diff.x / m, diff.y / m) : vec2(0, 1);
  const pushDist = 0.6; // comfortably outside dock trigger radius
  state.ship.pos = vec2(
    targetPos.x + away.x * pushDist,
    targetPos.y + away.y * pushDist,
  );
  state.ship.vel = scale(away, 0.3);

  state.dock = null;
  state.tgtActive = false;
}

/** Action IDs for the dock menu */
export type DockAction = 'contact' | 'trade' | 'missions' | 'leave' | 'scan' | 'ships';

/** Get available actions for current dock target */
export function getDockActions(_dock: DockState): DockAction[] {
  return ['contact', 'trade', 'missions', 'leave', 'scan', 'ships'];
}
