// ── Docking System ──────────────────────────────────────────────────────────
// Handles docking detection, approach animation, and undocking in Planet tier.

import type { GameState, DockState, Vec2 } from './types';
import { vec2, sub, magnitude, normalize, scale } from './math';
import { NavigationTier } from './galaxy';
import { FEATURE_LABELS } from './constants';
import type { PlanetFeature, SystemBody } from './galaxy';
import { playSound } from './audio';
import { coachAdvance } from './coach';

/** Distance from planet center at which docking begins (matches orbit ring) */
export const DOCK_TRIGGER_RADIUS = 1.0;
/** Distance from feature position at which docking begins */
export const DOCK_FEATURE_RADIUS = 0.4;
/** How fast the approach animation plays (per second, 0→1) */
const APPROACH_SPEED = 1.5;
/** Final distance from planet center when docked (just inside orbit ring) */
const DOCKED_PLANET_DIST = 0.95;
/** Final distance from feature when docked */
const DOCKED_FEATURE_DIST = 0.3;

/**
 * The renderer owns the merged static + server-built feature list. Dock detection has to
 * use the same list, or built structures render without being dockable and `featureIndex`
 * means different things in each module.
 */
type FeatureProvider = (body: SystemBody, starIndex: number, bodyIndex: number) => PlanetFeature[];
let _featureProvider: FeatureProvider | null = null;

export function setDockFeatureProvider(fn: FeatureProvider): void {
  _featureProvider = fn;
}

function dockableFeatures(state: GameState, body: SystemBody): PlanetFeature[] {
  const all = _featureProvider?.(body, state.galaxy.currentStarIndex, state.galaxy.currentBodyIndex) ?? body.features;
  return all.filter((feat) => DOCKABLE_FEATURE_TYPES.has(feat.type));
}

/**
 * Only structures with a defined purpose when visited are dockable. Each remaining type
 * needs its own interaction designed before being enabled (attack plan #31 / #37):
 *   mine, mine_l2       — maintenance / yield boost?
 *   solar_array, _l2    — efficiency check?
 *   colony (hab)        — population / recruitment?
 *   warehouse           — cargo transfer?
 *   shield, cannon      — defence control?
 *   refinery            — fuel conversion?
 *   relay, outpost      — unused feature types
 */
const DOCKABLE_FEATURE_TYPES: ReadonlySet<string> = new Set([
  'station', // starbase — build, ships, trade, refuel
  'dock',    // space dock — refuel
]);

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
  for (const [fi, feat] of dockableFeatures(state, body).entries()) {
    const featPos = getFeatureWorldPos(feat);
    const dist = magnitude(sub(shipPos, featPos));
    if (dist < DOCK_FEATURE_RADIUS) {
      return {
        docked: false,
        targetType: 'feature',
        bodyIndex: body.index,
        featureIndex: fi,
        featureType: feat.type,
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
    const feat = dockableFeatures(state, body)[dock.featureIndex];
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
    const soundId = dock.targetType === 'planet' ? 'ship_entered' : 'docked';
    console.log('[DOCK] fully docked, targetType=', dock.targetType, 'playing sound:', soundId);
    playSound(soundId);
    coachAdvance('scan');
  }
}

/** Undock from current target — push ship away and restore control */
export function undock(state: GameState): void {
  if (!state.dock) return;

  const body = state.galaxy.bodies[state.galaxy.currentBodyIndex];

  // Always push radially outward from planet center so we clear both
  // the planet dock zone and any nearby feature dock zones.
  const shipDist = magnitude(state.ship.pos);
  const outward = shipDist > 0.01
    ? vec2(state.ship.pos.x / shipDist, state.ship.pos.y / shipDist)
    : vec2(0, 1);

  let safeR: number;
  if (state.dock.targetType === 'feature' && body && state.dock.featureIndex >= 0) {
    const feat = dockableFeatures(state, body)[state.dock.featureIndex];
    const featDist = feat ? magnitude(getFeatureWorldPos(feat)) : 2.0;
    // Clear both the feature radius and the planet dock trigger
    safeR = Math.max(featDist + DOCK_FEATURE_RADIUS + 0.15, DOCK_TRIGGER_RADIUS + 0.15);
  } else {
    // Clear planet dock trigger
    safeR = DOCK_TRIGGER_RADIUS + 0.15;
  }

  const release = findClearReleaseDir(outward, body ? dockableFeatures(state, body) : []);
  state.ship.pos = vec2(release.x * safeR, release.y * safeR);
  state.ship.vel = scale(release, 0.3);

  state.dock = null;
  state.tgtActive = false;
}

/**
 * Pick an outward release direction whose straight run back to the planet does not
 * pass through another feature's dock zone, so the player doesn't re-dock at the base.
 * Prefers the smallest rotation away from `preferred`.
 */
function findClearReleaseDir(
  preferred: Vec2,
  features: PlanetFeature[],
): Vec2 {
  if (features.length === 0) return preferred;

  const featPositions = features.map((f) => getFeatureWorldPos(f));
  const clearance = DOCK_FEATURE_RADIUS + 0.25;
  const baseAngle = Math.atan2(preferred.y, preferred.x);

  let best = preferred;
  let bestGap = -Infinity;
  for (let i = 0; i <= 36; i++) {
    // Alternate outward from the preferred heading: 0, +10°, -10°, +20°, ...
    const stepDeg = Math.ceil(i / 2) * 10 * (i % 2 === 0 ? -1 : 1);
    const ang = baseAngle + (stepDeg * Math.PI) / 180;
    const dir = vec2(Math.cos(ang), Math.sin(ang));

    let gap = Infinity;
    for (const fp of featPositions) {
      const along = fp.x * dir.x + fp.y * dir.y;
      if (along <= 0) continue; // feature is behind the release point
      const perp = magnitude(vec2(fp.x - dir.x * along, fp.y - dir.y * along));
      gap = Math.min(gap, perp);
    }
    if (gap >= clearance) return dir;
    if (gap > bestGap) {
      bestGap = gap;
      best = dir;
    }
  }
  return best;
}

/** Action IDs for the dock menu */
export type DockAction = 'contact' | 'trade' | 'missions' | 'leave' | 'scan' | 'ships' | 'refuel';

/** Get available actions for current dock target */
export function getDockActions(_dock: DockState): DockAction[] {
  return ['contact', 'trade', 'missions', 'leave', 'scan', 'ships'];
}
