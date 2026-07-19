// ── Galaxy Generation & Navigation ──────────────────────────────────────────

import type { Vec2 } from './types';
import { vec2, createRng, stableHash, magnitude, sub } from './math';
import {
  GALAXY_SIZE, STAR_COUNT, STAR_MIN_SPACING,
  STAR_ENTER_RADIUS, SYSTEM_SIZE, SYSTEM_BODY_MIN, SYSTEM_BODY_MAX,
  BODY_ENTER_RADIUS, SYSTEM_EXIT_RADIUS,
  STAR_NAME_PREFIXES, STAR_NAME_SUFFIXES,
  PLANET_NAME_PREFIXES, PLANET_NAME_SUFFIXES,
  FEATURE_TYPES, FEATURE_LABELS,
} from './constants';

// ── Types ───────────────────────────────────────────────────────────────────

export enum NavigationTier {
  Galaxy,
  System,
  Local,
  Planet,
}

export interface GalaxyStar {
  index: number;
  pos: Vec2;
  seed: number;
  name: string;
  bodyCount: number;
}

export type FeatureType = 'mine' | 'relay' | 'refinery' | 'station' | 'outpost' | 'colony';

export interface PlanetFeature {
  name: string;
  type: FeatureType;
  angle: number;   // offset angle from planet center (radians)
  dist: number;    // distance from planet center in world units
}

export interface SystemBody {
  index: number;
  pos: Vec2;
  seed: number;
  name: string;
  radius: number;
  type: 'planet' | 'belt';
  orbitDist: number;  // distance from system center
  features: PlanetFeature[];  // sub-features around planets
}

export interface GalaxyState {
  tier: NavigationTier;
  stars: GalaxyStar[];
  homeStarIndex: number;     // persistent home star index for galaxy highlighting
  currentStarIndex: number;  // -1 when in galaxy view
  currentBodyIndex: number;  // -1 when in system view
  bodies: SystemBody[];      // populated when in a system
  galaxySeed: number;
  bodyEntryAngle: number;    // angle (radians) where ship entered current body's orbit
  beltEnteredFromInside: boolean; // true if ship was closer to star than belt when entering
}

let externalStarNames: string[] = [];

export function setExternalStarNames(names: string[]): void {
  const cleaned = Array.from(new Set(
    names
      .map((n) => n.trim())
      .filter((n) => n.length >= 2 && n.length <= 32),
  ));
  externalStarNames = cleaned;
}

function generatedStarName(starSeed: number): string {
  const nameRng = createRng(starSeed);
  const prefix = STAR_NAME_PREFIXES[nameRng.rangeInt(0, STAR_NAME_PREFIXES.length)];
  const suffix = STAR_NAME_SUFFIXES[nameRng.rangeInt(0, STAR_NAME_SUFFIXES.length)];
  return `${prefix} ${suffix}`;
}

function pickStarName(starSeed: number, index: number): string {
  if (externalStarNames.length > 0) {
    const idx = Math.abs(stableHash(`starname:${starSeed}:${index}`)) % externalStarNames.length;
    return externalStarNames[idx];
  }
  return generatedStarName(starSeed);
}

export function applyStarNames(stars: GalaxyStar[]): void {
  for (const star of stars) {
    star.name = pickStarName(star.seed, star.index);
  }
}

// ── Galaxy Generation ───────────────────────────────────────────────────────

export function generateGalaxy(worldSeed: string): GalaxyStar[] {
  const galaxySeed = stableHash(worldSeed + ':galaxy');
  const rng = createRng(galaxySeed);
  const stars: GalaxyStar[] = [];

  // Poisson-disc-like placement: try to place STAR_COUNT stars with min spacing
  const maxAttempts = STAR_COUNT * 20;
  let attempts = 0;

  while (stars.length < STAR_COUNT && attempts < maxAttempts) {
    attempts++;
    const x = rng.range(4, GALAXY_SIZE - 4); // keep away from edges
    const y = rng.range(4, GALAXY_SIZE - 4);

    // Check minimum spacing from existing stars
    let tooClose = false;
    for (const existing of stars) {
      const dx = existing.pos.x - x;
      const dy = existing.pos.y - y;
      if (dx * dx + dy * dy < STAR_MIN_SPACING * STAR_MIN_SPACING) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const index = stars.length;
    const starSeed = stableHash(`${galaxySeed}:star:${index}`);
    stars.push({
      index,
      pos: vec2(x, y),
      seed: starSeed,
      name: pickStarName(starSeed, index),
      bodyCount: rng.rangeInt(SYSTEM_BODY_MIN, SYSTEM_BODY_MAX + 1),
    });
  }

  return stars;
}

// ── System Generation ───────────────────────────────────────────────────────

// ── System Body Generation ──────────────────────────────────────────────────

function romanNumeral(n: number): string {
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  return numerals[n - 1] || String(n);
}

export function generateSystem(star: GalaxyStar): SystemBody[] {
  const rng = createRng(star.seed);
  const bodies: SystemBody[] = [];
  const center = SYSTEM_SIZE / 2;

  for (let i = 0; i < star.bodyCount; i++) {
    const bodySeed = stableHash(`${star.seed}:body:${i}`);
    const nameRng = createRng(bodySeed);
    const prefix = PLANET_NAME_PREFIXES[nameRng.rangeInt(0, PLANET_NAME_PREFIXES.length)];
    const suffix = PLANET_NAME_SUFFIXES[nameRng.rangeInt(0, PLANET_NAME_SUFFIXES.length)];

    // Place bodies at increasing distances from center (spread across system)
    const minDist = 4 + i * 3.2;
    const maxDist = minDist + 2.5;
    const dist = rng.range(minDist, maxDist);
    const angle = rng.range(0, Math.PI * 2);

    const x = center + Math.cos(angle) * dist;
    const y = center + Math.sin(angle) * dist;

    const type: 'planet' | 'belt' = (i === 0) ? 'planet' : (rng.next() < 0.3 ? 'belt' : 'planet');
    const radius = type === 'belt' ? rng.range(0.6, 1.0) : rng.range(0.4, 0.8);

    // Generate sub-features for planets
    const features: PlanetFeature[] = [];
    if (type === 'planet') {
      const featRng = createRng(bodySeed + 777);
      const featCount = featRng.rangeInt(1, 4); // 1–3 features per planet
      const usedAngles: number[] = [];
      for (let f = 0; f < featCount; f++) {
        // First planet in system always gets a station as first feature (home base)
        const ft = (i === 0 && f === 0)
          ? 'station' as FeatureType
          : FEATURE_TYPES[featRng.rangeInt(0, FEATURE_TYPES.length)];
        // Spread features around the planet, avoid overlap
        let fAngle = featRng.range(0, Math.PI * 2);
        for (const ua of usedAngles) {
          if (Math.abs(fAngle - ua) < 0.8) fAngle += 1.2;
        }
        usedAngles.push(fAngle);
        const fDist = featRng.range(1.8, 3.0);
        const fName = `${prefix}${suffix} ${romanNumeral(f + 1)} ${FEATURE_LABELS[ft]}`;
        features.push({ name: fName, type: ft, angle: fAngle, dist: fDist });
      }
    }

    bodies.push({
      index: i,
      pos: vec2(x, y),
      seed: bodySeed,
      name: `${prefix}${suffix}`,
      radius,
      type,
      orbitDist: dist,
      features,
    });
  }

  return bodies;
}

// ── Seed for Local Tier ─────────────────────────────────────────────────────

export function getLocalSeed(body: SystemBody): string {
  return `local:${body.seed}`;
}

// ── Navigation State ────────────────────────────────────────────────────────

export function createGalaxyState(worldSeed: string): GalaxyState {
  const galaxySeed = stableHash(worldSeed + ':galaxy');
  const stars = generateGalaxy(worldSeed);

  // Pick home star: closest to galaxy center
  const cx = GALAXY_SIZE / 2;
  const cy = GALAXY_SIZE / 2;
  let homeIdx = 0;
  let bestDist = Infinity;
  for (const star of stars) {
    const d = (star.pos.x - cx) ** 2 + (star.pos.y - cy) ** 2;
    if (d < bestDist) { bestDist = d; homeIdx = star.index; }
  }

  const homeStar = stars[homeIdx];
  return {
    tier: NavigationTier.System,
    stars,
    homeStarIndex: homeIdx,
    currentStarIndex: homeIdx,
    currentBodyIndex: -1,
    bodies: generateSystem(homeStar),
    galaxySeed,
    bodyEntryAngle: 0,
    beltEnteredFromInside: true,
  };
}

// ── Tier Transitions ────────────────────────────────────────────────────────

export interface TierTransition {
  newTier: NavigationTier;
  starIndex: number;
  bodyIndex: number;
  exitDir?: Vec2;    // for belt radial exit: raw (x, y) world position at exit
  entryAngle?: number; // angle (radians) of ship around center when entering body
  enteredFromInside?: boolean; // true if ship was closer to star than belt orbit
  exitedOutward?: boolean;    // true if ship exited belt toward outside (positive localY)
  beltWrap?: boolean;         // true if ship wrapped around belt tangentially (stays in Local)
  wrapDir?: number;           // +1 or -1 indicating wrap direction
}

/**
 * Check if the ship's position triggers a tier change.
 * Returns transition info or null if no change.
 */
export function checkTierTransition(
  shipPos: Vec2,
  galaxy: GalaxyState,
): TierTransition | null {
  const { tier } = galaxy;

  if (tier === NavigationTier.Galaxy) {
    // Check proximity to any star
    for (const star of galaxy.stars) {
      const dist = magnitude(sub(shipPos, star.pos));
      if (dist < STAR_ENTER_RADIUS) {
        // exitDir = direction from star to ship (approach direction)
        const dx = shipPos.x - star.pos.x;
        const dy = shipPos.y - star.pos.y;
        return { newTier: NavigationTier.System, starIndex: star.index, bodyIndex: -1, exitDir: vec2(dx, dy) };
      }
    }
  } else if (tier === NavigationTier.System) {
    const center = vec2(SYSTEM_SIZE / 2, SYSTEM_SIZE / 2);
    const shipDistFromCenter = magnitude(sub(shipPos, center));

    // Check proximity to bodies — planets first, then belts
    // (so a planet near a belt isn't overshadowed by the belt's orbital check)
    for (const body of galaxy.bodies) {
      if (body.type !== 'belt') {
        const dist = magnitude(sub(shipPos, body.pos));
        if (dist < BODY_ENTER_RADIUS) {
          return { newTier: NavigationTier.Planet, starIndex: galaxy.currentStarIndex, bodyIndex: body.index };
        }
      }
    }
    for (const body of galaxy.bodies) {
      if (body.type === 'belt') {
        // Belt is a ring — ship must be very close to the orbital ring AND nearly stopped
        // (tight tolerance so flying past doesn't accidentally enter)
        const beltTolerance = 0.5;
        if (Math.abs(shipDistFromCenter - body.orbitDist) < beltTolerance) {
          const entryAngle = Math.atan2(shipPos.y - center.y, shipPos.x - center.x);
          const enteredFromInside = shipDistFromCenter < body.orbitDist;
          return { newTier: NavigationTier.Local, starIndex: galaxy.currentStarIndex, bodyIndex: body.index, entryAngle, enteredFromInside };
        }
      }
    }
    // Check exit: distance from system center
    if (shipDistFromCenter > SYSTEM_EXIT_RADIUS) {
      const center = SYSTEM_SIZE / 2;
      return { newTier: NavigationTier.Galaxy, starIndex: -1, bodyIndex: -1, exitDir: vec2(shipPos.x - center, shipPos.y - center) };
    }
  } else if (tier === NavigationTier.Local) {
    // Ring model: ship is in system coordinates. Exit when radial distance from
    // belt orbit exceeds BELT_HALF_WIDTH + buffer.
    const center = vec2(SYSTEM_SIZE / 2, SYSTEM_SIZE / 2);
    const shipDistFromCenter = magnitude(sub(shipPos, center));
    const body = galaxy.currentBodyIndex >= 0 ? galaxy.bodies[galaxy.currentBodyIndex] : null;
    const orbitDist = body ? body.orbitDist : 12;
    const beltHalfWidth = 3.0; // matches BELT_HALF_WIDTH in asteroids.ts
    const exitThreshold = beltHalfWidth + 0.5; // small buffer past the asteroid field edge

    if (Math.abs(shipDistFromCenter - orbitDist) > exitThreshold) {
      return { newTier: NavigationTier.System, starIndex: galaxy.currentStarIndex, bodyIndex: -1 };
    }
  } else if (tier === NavigationTier.Planet) {
    // Check exit: ship reaches edge of planet view (camera is fixed at origin with orthoSize=3.2)
    // Visible area is about ±3.2 vertically, ±5.1 horizontally (aspect ~1.6)
    // Transition when ship is near visible edge
    const exitX = 4.5;
    const exitY = 2.8;
    if (Math.abs(shipPos.x) > exitX || Math.abs(shipPos.y) > exitY) {
      // Normalise ship pos as exit direction so placement matches the side they left from
      const m = magnitude(shipPos);
      const exitDir = m > 0 ? vec2(shipPos.x / m, shipPos.y / m) : vec2(0, 1);
      return { newTier: NavigationTier.System, starIndex: galaxy.currentStarIndex, bodyIndex: -1, exitDir };
    }
  }

  return null;
}

/**
 * Apply a tier transition — updates galaxy state and returns new ship position.
 * In the ring model, belt transitions don't remap position — the ship stays in system coords.
 */
export function applyTransition(
  galaxy: GalaxyState,
  transition: TierTransition,
  currentShipPos?: Vec2,
): Vec2 {
  galaxy.tier = transition.newTier;

  if (transition.newTier === NavigationTier.System) {
    const prevBodyIndex = galaxy.currentBodyIndex;
    const prevBody = prevBodyIndex >= 0 ? galaxy.bodies[prevBodyIndex] : null;
    if (transition.starIndex >= 0) {
      galaxy.currentStarIndex = transition.starIndex;
      const star = galaxy.stars[transition.starIndex];
      galaxy.bodies = generateSystem(star);
    }
    galaxy.currentBodyIndex = -1;
    const center = SYSTEM_SIZE / 2;

    // Coming from a belt: ship stays at its current position (ring model — no remap needed)
    if (prevBody && prevBody.type === 'belt') {
      // Ship is already in system coords, just return current position
      if (currentShipPos) return currentShipPos;
      // Fallback: shouldn't happen, but place on ring
      const angle = galaxy.bodyEntryAngle;
      return vec2(center + Math.cos(angle) * prevBody.orbitDist, center + Math.sin(angle) * prevBody.orbitDist);
    }
    // If we came from a planet, place ship just outside the planet's enter radius
    if (prevBody && prevBody.type === 'planet') {
      const offset = BODY_ENTER_RADIUS + 0.5;
      if (transition.exitDir) {
        const m = magnitude(transition.exitDir);
        const dir = m > 0 ? vec2(transition.exitDir.x / m, transition.exitDir.y / m) : vec2(0, 1);
        return vec2(prevBody.pos.x + dir.x * offset, prevBody.pos.y + dir.y * offset);
      }
      const angle = Math.atan2(prevBody.pos.y - center, prevBody.pos.x - center);
      return vec2(prevBody.pos.x + Math.cos(angle) * offset, prevBody.pos.y + Math.sin(angle) * offset);
    }
    // Default: entering from galaxy — place ship at system edge in approach direction
    if (transition.exitDir) {
      const m = magnitude(transition.exitDir);
      if (m > 0) {
        const dx = transition.exitDir.x / m;
        const dy = transition.exitDir.y / m;
        const edgeDist = SYSTEM_EXIT_RADIUS - 2;
        return vec2(center + dx * edgeDist, center + dy * edgeDist);
      }
    }
    return vec2(center, center + SYSTEM_EXIT_RADIUS - 3);
  } else if (transition.newTier === NavigationTier.Local) {
    // Ring model: ship stays at its current position in system coords.
    // Just update galaxy state to track which body we're in.
    galaxy.currentBodyIndex = transition.bodyIndex;
    if (transition.entryAngle !== undefined) {
      galaxy.bodyEntryAngle = transition.entryAngle;
    }
    if (transition.enteredFromInside !== undefined) {
      galaxy.beltEnteredFromInside = transition.enteredFromInside;
    }
    // Return current position — no remap
    if (currentShipPos) return currentShipPos;
    // Fallback: place on ring at entry angle
    const center = SYSTEM_SIZE / 2;
    const body = galaxy.bodies[transition.bodyIndex];
    const orbitDist = body ? body.orbitDist : 12;
    const angle = transition.entryAngle ?? 0;
    return vec2(center + Math.cos(angle) * orbitDist, center + Math.sin(angle) * orbitDist);
  } else if (transition.newTier === NavigationTier.Planet) {
    galaxy.currentBodyIndex = transition.bodyIndex;
    // Place ship at edge of planet view (inside exit thresholds)
    return vec2(0, 2.4);
  } else {
    // Returning to galaxy — place ship offset from star in exit direction
    if (galaxy.currentStarIndex >= 0) {
      const star = galaxy.stars[galaxy.currentStarIndex];
      galaxy.currentStarIndex = -1;
      galaxy.currentBodyIndex = -1;
      galaxy.bodies = [];
      const offset = STAR_ENTER_RADIUS + 1;
      if (transition.exitDir) {
        const m = magnitude(transition.exitDir);
        if (m > 0) {
          return vec2(star.pos.x + (transition.exitDir.x / m) * offset, star.pos.y + (transition.exitDir.y / m) * offset);
        }
      }
      return vec2(star.pos.x, star.pos.y + offset);
    }
    galaxy.currentStarIndex = -1;
    galaxy.currentBodyIndex = -1;
    galaxy.bodies = [];
    return vec2(GALAXY_SIZE / 2, GALAXY_SIZE / 2);
  }
}
