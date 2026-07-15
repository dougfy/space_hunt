// ── Camera & Zoom Logic ─────────────────────────────────────────────────────

import type { Camera, GameState } from './types';
import { ZoomState } from './types';
import {
  BASE_ORTHO, CLOSE_ORTHO, ZOOM_TRANSITION_DURATION,
  ZOOM_DWELL_SECONDS, ZOOM_GRACE_SECONDS,
  MAP_HALF_X, MAP_HALF_Y,
} from './constants';
import { vec2, clamp } from './math';
import { distanceToAsteroidSurface } from './asteroids';

// Trigger zoom when ship is within ZOOM_TRIGGER_PIXELS screen pixels of an
// asteroid surface. Converted to world units at runtime using the actual canvas
// height, matching the original C# GetStableZoomTriggerWorld().
const ZOOM_TRIGGER_PIXELS = 100;

export function createCamera(aspect: number): Camera {
  return {
    pos: vec2(0, 0),
    orthoSize: BASE_ORTHO,
    aspect,
  };
}

export function updateCamera(state: GameState, dt: number): void {
  const { camera } = state;

  // Continuous zoom animation: zoomT goes 0→1 (wide→close)
  // Original: target=1 when Zoomed or Releasing, target=0 when Normal or Arming
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

  // Camera focus: at zero zoom → origin, zoomed → ship position
  const focusX = state.ship.pos.x * zoomT;
  const focusY = state.ship.pos.y * zoomT;
  camera.pos = { x: focusX, y: focusY };

  // Clamp camera within map bounds
  const halfW = camera.orthoSize * camera.aspect;
  const halfH = camera.orthoSize;
  camera.pos.x = clamp(camera.pos.x, -(MAP_HALF_X - halfW), MAP_HALF_X - halfW);
  camera.pos.y = clamp(camera.pos.y, -(MAP_HALF_Y - halfH), MAP_HALF_Y - halfH);
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
  const margin = 0.15;
  return {
    minX: -halfW * (1 - margin),
    maxX: halfW * (1 - margin),
    minY: -halfH * (1 - margin),
    maxY: halfH * (1 - margin),
  };
}
