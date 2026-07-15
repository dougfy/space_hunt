// ── Asteroid Generation & Collision ─────────────────────────────────────────

import type { Vec2, Asteroid, GameState } from './types';
import {
  ASTEROID_COUNT, ASTEROID_MIN_RADIUS, ASTEROID_MAX_RADIUS,
  ASTEROID_GAP, SPAWN_CLEAR_RADIUS, MAP_HALF_X, MAP_HALF_Y,
  AVOID_LOOKAHEAD, SHIP_MAX_SPEED,
  ASTEROID_NAME_PREFIXES, ASTEROID_NAME_SUFFIXES,
} from './constants';
import {
  vec2, add, sub, scale, normalize, magnitude, sqrMagnitude,
  clamp01, dot, createRng, stableHash,
} from './math';

export interface SurfaceInfo {
  nearest: Vec2;
  edge: number;
  inside: boolean;
}

export function getAsteroidSurfaceInfo(a: Asteroid, p: Vec2): SurfaceInfo {
  const n = a.pts.length;
  if (n < 3) {
    const off = sub(p, a.pos);
    const d = magnitude(off);
    const norm = d > 1e-4 ? scale(off, 1 / d) : vec2(1, 0);
    return {
      nearest: add(a.pos, scale(norm, a.r)),
      edge: Math.max(0, d - a.r),
      inside: d < a.r,
    };
  }

  let minSqr = Infinity;
  let nearest = a.pos;
  let inside = false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = add(a.pos, a.pts[i]);
    const vj = add(a.pos, a.pts[j]);
    const e = sub(vi, vj);
    const e2 = sqrMagnitude(e);
    const t = e2 > 1e-8 ? Math.max(0, Math.min(1, dot(sub(p, vj), e) / e2)) : 0;
    const c = add(vj, scale(e, t));
    const d2 = sqrMagnitude(sub(p, c));
    if (d2 < minSqr) {
      minSqr = d2;
      nearest = c;
    }

    const crosses = ((vi.y > p.y) !== (vj.y > p.y)) &&
      (p.x < (vj.x - vi.x) * (p.y - vi.y) / (vj.y - vi.y) + vi.x);
    if (crosses) inside = !inside;
  }

  return {
    nearest,
    edge: inside ? 0 : Math.sqrt(Math.max(0, minSqr)),
    inside,
  };
}

export function distanceToAsteroidSurface(a: Asteroid, p: Vec2): number {
  const info = getAsteroidSurfaceInfo(a, p);
  return info.inside ? 0 : info.edge;
}

export function computeAvoidance(from: Vec2, asteroids: Asteroid[], impactBuffer: number): Vec2 {
  let steer = vec2(0, 0);
  for (let i = 0; i < asteroids.length; i++) {
    const a = asteroids[i];
    const info = getAsteroidSurfaceInfo(a, from);
    const influence = impactBuffer + AVOID_LOOKAHEAD;
    if (info.inside || info.edge < influence) {
      const off = sub(from, info.nearest);
      const d = magnitude(off);
      let n: Vec2;
      if (d > 1e-4) {
        n = scale(off, 1 / d);
      } else {
        const fromCenter = sub(from, a.pos);
        n = sqrMagnitude(fromCenter) > 1e-6 ? normalize(fromCenter) : vec2(1, 0);
      }
      const t = info.inside ? 1 : 1 - clamp01(info.edge / influence);
      steer = add(steer, scale(n, t * t));
    }
  }
  return steer;
}

export function resolveShipCollisions(state: GameState): void {
  const { ship, asteroids, impactBufferWorld } = state;
  for (let i = 0; i < asteroids.length; i++) {
    const a = asteroids[i];
    const info = getAsteroidSurfaceInfo(a, ship.pos);
    if (info.inside || info.edge < impactBufferWorld) {
      const off = info.inside ? sub(info.nearest, ship.pos) : sub(ship.pos, info.nearest);
      const d = magnitude(off);
      let n: Vec2;
      if (d > 1e-4) {
        n = scale(off, 1 / d);
      } else {
        const fromCenter = sub(ship.pos, a.pos);
        n = sqrMagnitude(fromCenter) > 1e-6 ? normalize(fromCenter) : vec2(1, 0);
      }

      ship.pos = add(info.nearest, scale(n, impactBufferWorld + 0.002));

      // Remove inward velocity component
      const vn = dot(ship.vel, n);
      if (vn < 0) ship.vel = sub(ship.vel, scale(n, vn));

      // Tangential slide
      let tangent = vec2(-n.y, n.x);
      const guide = state.tgtActive ? sub(state.tgtPos, ship.pos) : ship.vel;
      if (dot(tangent, guide) < 0) tangent = scale(tangent, -1);
      const slide = Math.max(0.06, magnitude(ship.vel) * 0.35);
      ship.vel = add(ship.vel, scale(tangent, slide));
      if (magnitude(ship.vel) > SHIP_MAX_SPEED) {
        ship.vel = scale(normalize(ship.vel), SHIP_MAX_SPEED);
      }
    }
  }
}

export function generateAsteroids(seed: string): {
  asteroids: Asteroid[];
  names: string[];
} {
  const rng = createRng(stableHash(seed));
  const asteroids: Asteroid[] = [];
  const names: string[] = [];

  let placed = 0;
  let attempts = 0;
  const maxAttempts = ASTEROID_COUNT * 200;

  while (placed < ASTEROID_COUNT && attempts < maxAttempts) {
    attempts++;

    const px = rng.range(-MAP_HALF_X, MAP_HALF_X);
    const py = rng.range(-MAP_HALF_Y, MAP_HALF_Y);
    const pos = vec2(px, py);
    const radius = rng.range(ASTEROID_MIN_RADIUS, ASTEROID_MAX_RADIUS);
    const pts = genAsteroidPoints(rng, radius);

    let br = 0;
    for (let k = 0; k < pts.length; k++) {
      br = Math.max(br, magnitude(pts[k]));
    }

    // Keep origin clear for ship spawn
    if (magnitude(pos) < br + SPAWN_CLEAR_RADIUS) continue;

    // Reject overlaps
    let ok = true;
    for (let j = 0; j < asteroids.length; j++) {
      const need = br + asteroids[j].r + ASTEROID_GAP;
      if (sqrMagnitude(sub(pos, asteroids[j].pos)) < need * need) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    asteroids.push({ pos, pts, r: br });
    names.push(generateAsteroidName(rng));
    placed++;
  }

  return { asteroids, names };
}

function genAsteroidPoints(rng: ReturnType<typeof createRng>, r: number): Vec2[] {
  const n = rng.rangeInt(8, 13);
  const pts: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const jr = r * rng.range(0.6, 1.2);
    pts.push(vec2(Math.cos(a) * jr, Math.sin(a) * jr));
  }
  return pts;
}

function generateAsteroidName(rng: ReturnType<typeof createRng>): string {
  const prefix = ASTEROID_NAME_PREFIXES[rng.rangeInt(0, ASTEROID_NAME_PREFIXES.length)];
  const suffix = ASTEROID_NAME_SUFFIXES[rng.rangeInt(0, ASTEROID_NAME_SUFFIXES.length)];
  const serial = rng.rangeInt(10, 100);
  return `${prefix} ${suffix}-${serial}`;
}
