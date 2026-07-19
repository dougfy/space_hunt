// ── Camera & Zoom Logic ─────────────────────────────────────────────────────

import type { Camera, GameState } from './types';
import { ZoomState } from './types';
import {
  BASE_ORTHO, CLOSE_ORTHO, ZOOM_TRANSITION_DURATION,
  ZOOM_DWELL_SECONDS, ZOOM_GRACE_SECONDS,
  MAP_HALF_X, MAP_HALF_Y,
  GALAXY_SIZE, SYSTEM_SIZE,
} from './constants';
import { vec2, clamp } from './math';
import { distanceToAsteroidSurface } from './asteroids';
import { NavigationTier } from './galaxy';

// Trigger zoom when ship is within ZOOM_TRIGGER_PIXELS screen pixels of an
// asteroid surface. Converted to world units at runtime using the actual canvas
// height, matching the original C# GetStableZoomTriggerWorld().
const ZOOM_TRIGGER_PIXELS = 100;

// Ortho sizes for non-local tiers (show a good portion of the map, follow ship)
const GALAXY_ORTHO = 20; // shows ~40 units vertically of the 100-unit galaxy
const SYSTEM_ORTHO = 18; // shows ~36 units vertically — fits the full 40-unit system

export function createCamera(aspect: number): Camera {
  return {
    pos: vec2(0, 0),
    orthoSize: BASE_ORTHO,
    aspect,
  };
}

export function updateCamera(state: GameState, dt: number): void {
  const { camera } = state;
  const tier = state.galaxy.tier;

  // ── Galaxy / System tiers: fixed ortho, follow ship ──
  if (tier === NavigationTier.Galaxy) {
    camera.orthoSize = GALAXY_ORTHO;
    camera.pos = { x: state.ship.pos.x, y: state.ship.pos.y };
    // Clamp within galaxy bounds
    const halfW = camera.orthoSize * camera.aspect;
    const halfH = camera.orthoSize;
    camera.pos.x = clamp(camera.pos.x, halfW, GALAXY_SIZE - halfW);
    camera.pos.y = clamp(camera.pos.y, halfH, GALAXY_SIZE - halfH);
    return;
  }

  if (tier === NavigationTier.System) {
    camera.orthoSize = SYSTEM_ORTHO;
    camera.pos = { x: state.ship.pos.x, y: state.ship.pos.y };
    // Clamp within system bounds
    const halfW = camera.orthoSize * camera.aspect;
    const halfH = camera.orthoSize;
    camera.pos.x = clamp(camera.pos.x, halfW, SYSTEM_SIZE - halfW);
    camera.pos.y = clamp(camera.pos.y, halfH, SYSTEM_SIZE - halfH);
    return;
  }

  // ── Planet tier: fixed ortho, origin-centered ──
  if (tier === NavigationTier.Planet) {
    camera.orthoSize = BASE_ORTHO;
    camera.pos = { x: 0, y: 0 };
    return;
  }

  // ── Local tier: zoom behavior, camera follows ship in system coords ──
  // Continuous zoom animation: zoomT goes 0→1 (wide→close)
  const zoomTarget = (state.zoomState === ZoomState.Zoomed || state.zoomState === ZoomState.Releasing) ? 1 : 0;
  const speed = 1 / ZOOM_TRANSITION_DURATION;
  if (state.zoomTimer < zoomTarget) {
    state.zoomTimer = Math.min(zoomTarget, state.zoomTimer + speed * dt);
  } else {
    state.zoomTimer = Math.max(zoomTarget, state.zoomTimer - speed * dt);
  }
  const zoomT = state.zoomTimer;

  // Interpolate ortho size
  camera.orthoSize = BASE_ORTHO + (CLOSE_ORTHO - BASE_ORTHO) * zoomT;

  // Camera follows ship in system coordinates
  camera.pos = { x: state.ship.pos.x, y: state.ship.pos.y };

  // Clamp camera within system bounds
  const halfW = camera.orthoSize * camera.aspect;
  const halfH = camera.orthoSize;
  camera.pos.x = clamp(camera.pos.x, halfW, SYSTEM_SIZE - halfW);
  camera.pos.y = clamp(camera.pos.y, halfH, SYSTEM_SIZE - halfH);
}

export function updateZoomState(state: GameState, dt: number, pixelHeight: number): void {
  // Compute a zoom-independent trigger distance in world units (anchored to BASE_ORTHO)
  const worldPerPixel = (BASE_ORTHO * 2) / Math.max(1, pixelHeight);
  const zoomTriggerWorld = Math.max(0.01, ZOOM_TRIGGER_PIXELS * worldPerPixel);

  // Find nearest asteroid surface distance
  let nearestEdge = Infinity;
  for (let i = 0; i < state.asteroids.length; i++) {
    const edge = distanceToAsteroidSurface(state.asteroids[i], state.ship.pos);
    if (edge < nearestEdge) nearestEdge = edge;
  }
  const inside = nearestEdge < zoomTriggerWorld;
  switch (state.zoomState) {
    case ZoomState.Normal:
      if (inside) {
        state.zoomState = ZoomState.Arming;
        zoomEnter = 0;
      }
      break;

    case ZoomState.Arming:
      if (!inside) {
        state.zoomState = ZoomState.Normal;
      } else {
        zoomEnter += dt;
        if (zoomEnter >= ZOOM_DWELL_SECONDS) {
          state.zoomState = ZoomState.Zoomed;
        }
      }
      break;

    case ZoomState.Zoomed:
      if (!inside) {
        state.zoomState = ZoomState.Releasing;
        zoomExit = 0;
      }
      break;

    case ZoomState.Releasing:
      if (inside) {
        state.zoomState = ZoomState.Zoomed;
      } else {
        zoomExit += dt;
        if (zoomExit >= ZOOM_GRACE_SECONDS) {
          state.zoomState = ZoomState.Normal;
        }
      }
      break;
  }
}

// Module-level timers for zoom enter/exit (not stored in GameState to keep it clean)
let zoomEnter = 0;
let zoomExit = 0;

/** Find the index of the nearest asteroid within zoom trigger range, or -1. */
export function findNearestAsteroidIndex(state: GameState, pixelHeight: number): number {
  const worldPerPx = (BASE_ORTHO * 2) / Math.max(1, pixelHeight);
  const trigger = Math.max(0.01, ZOOM_TRIGGER_PIXELS * worldPerPx);

  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < state.asteroids.length; i++) {
    const edge = distanceToAsteroidSurface(state.asteroids[i], state.ship.pos);
    if (edge < trigger && edge < bestDist) {
      bestDist = edge;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Check if the ship has left the suppressed asteroid's proximity zone. */
export function isOverrideClear(state: GameState, pixelHeight: number): boolean {
  const idx = state.zoomOverride;
  if (idx < 0 || idx >= state.asteroids.length) return true;

  const worldPerPx = (BASE_ORTHO * 2) / Math.max(1, pixelHeight);
  const trigger = Math.max(0.01, ZOOM_TRIGGER_PIXELS * worldPerPx);
  const edge = distanceToAsteroidSurface(state.asteroids[idx], state.ship.pos);
  return edge >= trigger;
}

/** Calculate the safe zone boundaries for ship movement (in local coords) */
export function getSafeZone(camera: Camera): {
  minX: number; maxX: number;
  minY: number; maxY: number;
} {
  const halfW = camera.orthoSize * camera.aspect;
  const halfH = camera.orthoSize;
  const margin = 0.35;
  return {
    minX: -halfW * (1 - margin),
    maxX: halfW * (1 - margin),
    minY: -halfH * (1 - margin),
    maxY: halfH * (1 - margin),
  };
}
