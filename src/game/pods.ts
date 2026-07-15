// ── Fuel Pod Logic ──────────────────────────────────────────────────────────

import type { Asteroid, FuelPod, GameState } from './types';
import {
  POD_COUNT_PER_ASTEROID, POD_SURFACE_OFFSET, POD_COLLECT_RADIUS,
  FUEL_MAX, RED_DOCK_FRACTION,
} from './constants';
import {
  add, sub, scale, normalize, magnitude, createRng, stableHash,
} from './math';


export function generateFuelPods(asteroids: Asteroid[], seed: string): FuelPod[] {
  const rng = createRng(stableHash(seed + ':pods'));
  const pods: FuelPod[] = [];
  let id = 0;

  for (let ai = 0; ai < asteroids.length; ai++) {
    const a = asteroids[ai];
    const n = a.pts.length;
    if (n < 3) continue;

    const count = POD_COUNT_PER_ASTEROID;
    const perimeter: number[] = [];
    let totalPerimeter = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const seg = magnitude(sub(a.pts[j], a.pts[i]));
      perimeter.push(seg);
      totalPerimeter += seg;
    }

    for (let p = 0; p < count; p++) {
      const t = rng.range(0, totalPerimeter);
      let accum = 0;
      let edge = 0;
      let edgeFrac = 0;
      for (let i = 0; i < n; i++) {
        accum += perimeter[i];
        if (accum >= t) {
          edge = i;
          edgeFrac = 1 - (accum - t) / perimeter[i];
          break;
        }
      }

      const pA = a.pts[edge];
      const pB = a.pts[(edge + 1) % n];
      const surfacePoint = add(a.pos, add(pA, scale(sub(pB, pA), edgeFrac)));
      const outward = normalize(sub(surfacePoint, a.pos));
      const podPos = add(surfacePoint, scale(outward, POD_SURFACE_OFFSET));

      const isRefuel = rng.range(0, 1) < RED_DOCK_FRACTION;
      pods.push({
        id: id++,
        astIndex: ai,
        pos: podPos,
        discovered: false,
        collected: false,
        claimRequested: false,
        refuels: isRefuel,
        color: isRefuel ? '#FF5A3D' : '#FFD24A',
      });
    }
  }

  return pods;
}

export function updatePodDiscovery(state: GameState): void {
  const { ship, pods } = state;
  const viewDist = state.camera.orthoSize * 2.5; // pods revealed in view range

  for (let i = 0; i < pods.length; i++) {
    const pod = pods[i];
    if (pod.discovered || pod.collected) continue;
    const d = magnitude(sub(pod.pos, ship.pos));
    if (d < viewDist) {
      pod.discovered = true;
    }
  }
}

export function checkPodCollection(state: GameState): number[] {
  const { ship, pods } = state;
  const collected: number[] = [];

  for (let i = 0; i < pods.length; i++) {
    const pod = pods[i];
    if (pod.collected || pod.claimRequested) continue;
    if (!pod.discovered) continue;

    const d = magnitude(sub(pod.pos, ship.pos));
    if (d < POD_COLLECT_RADIUS) {
      pod.claimRequested = true;
      collected.push(pod.id);
    }
  }
  return collected;
}

export function applyPodCollected(state: GameState, podId: number, mine: boolean): void {
  const pod = state.pods.find(p => p.id === podId);
  if (!pod) return;
  if (pod.collected) return;
  pod.collected = true;

  if (mine) {
    if (pod.refuels) {
      state.fuelPercent = FUEL_MAX;
    } else {
      state.fuelPercent = Math.min(FUEL_MAX, state.fuelPercent + 15);
    }
    state.docksCollected++;
  }
}
