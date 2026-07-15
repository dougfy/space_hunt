// ── Vector Math Utilities ───────────────────────────────────────────────────

import type { Vec2 } from './types';

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function magnitude(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function sqrMagnitude(v: Vec2): number {
  return v.x * v.x + v.y * v.y;
}

export function normalize(v: Vec2): Vec2 {
  const m = magnitude(v);
  if (m < 1e-6) return { x: 0, y: 0 };
  return { x: v.x / m, y: v.y / m };
}

export function distance(a: Vec2, b: Vec2): number {
  return magnitude(sub(a, b));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function moveTowards(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

export function moveTowardsVec2(current: Vec2, target: Vec2, maxDelta: number): Vec2 {
  const d = sub(target, current);
  const dist = magnitude(d);
  if (dist <= maxDelta || dist < 1e-6) return { ...target };
  const n = scale(d, 1 / dist);
  return add(current, scale(n, maxDelta));
}

export function lerpAngle(from: number, to: number, t: number): number {
  let delta = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

export function repeat(t: number, length: number): number {
  return t - Math.floor(t / length) * length;
}

/** Seeded pseudo-random number generator (mulberry32) */
export function createRng(seed: number) {
  let s = seed | 0;
  return {
    next(): number {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min: number, max: number): number {
      return min + this.next() * (max - min);
    },
    rangeInt(min: number, max: number): number {
      return Math.floor(this.range(min, max));
    },
  };
}

export function stableHash(text: string): number {
  let hash = 23;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return hash;
}

/** Try to intersect two infinite lines. Returns intersection point or null. */
export function tryIntersectLines(
  a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2,
): Vec2 | null {
  const da = sub(a1, a0);
  const db = sub(b1, b0);
  const det = da.x * db.y - da.y * db.x;
  if (Math.abs(det) < 1e-5) return null;
  const d = sub(b0, a0);
  const t = (d.x * db.y - d.y * db.x) / det;
  return add(a0, scale(da, t));
}
