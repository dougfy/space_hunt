/**
 * Shared galaxy star position generator.
 * Used by both game client and server to compute deterministic star positions from a world seed.
 * This must produce IDENTICAL results to the game client's generateGalaxy().
 */

const GALAXY_SIZE = 100;
const STAR_COUNT = 100;
const STAR_MIN_SPACING = 7;
const MIN_HOME_SPACING = 28; // ~4-5 stars free between home stars (at STAR_MIN_SPACING=7)

export interface StarPosition {
  index: number;
  x: number;
  y: number;
}

function createRng(seed: number) {
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

function stableHash(text: string): number {
  let hash = 23;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return hash;
}

/** Generate all star positions for a given world seed (must match game client). */
export function generateStarPositions(worldSeed: string): StarPosition[] {
  const galaxySeed = stableHash(worldSeed + ':galaxy');
  const rng = createRng(galaxySeed);
  const stars: StarPosition[] = [];

  const maxAttempts = STAR_COUNT * 20;
  let attempts = 0;

  while (stars.length < STAR_COUNT && attempts < maxAttempts) {
    attempts++;
    const x = rng.range(4, GALAXY_SIZE - 4);
    const y = rng.range(4, GALAXY_SIZE - 4);

    let tooClose = false;
    for (const existing of stars) {
      const dx = existing.x - x;
      const dy = existing.y - y;
      if (dx * dx + dy * dy < STAR_MIN_SPACING * STAR_MIN_SPACING) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    stars.push({ index: stars.length, x, y });
  }

  return stars;
}

/** Get the default home star (closest to center) — used for the first player. */
export function getDefaultHomeStarIndex(stars: StarPosition[]): number {
  const cx = GALAXY_SIZE / 2;
  const cy = GALAXY_SIZE / 2;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (const star of stars) {
    const d = (star.x - cx) ** 2 + (star.y - cy) ** 2;
    if (d < bestDist) { bestDist = d; bestIdx = star.index; }
  }
  return bestIdx;
}

/**
 * Pick the next home star for a new player.
 *
 * Algorithm: spiral outward from the galaxy center. Divide the spiral into
 * angular sectors so each successive player is placed roughly opposite/offset
 * from the previous ones (like seating people around a growing table).
 *
 * 1. Determine how many home stars already exist (N).
 * 2. Place new player at angular position = N × golden-angle (~137.5°) at a
 *    radius that grows with N. This naturally spirals outward.
 * 3. Find the unclaimed star closest to that ideal spiral point that is also
 *    >= MIN_HOME_SPACING from all existing home stars.
 */
export function pickNextHomeStar(
  stars: StarPosition[],
  claimedStarIndices: number[],
): number {
  const cx = GALAXY_SIZE / 2;
  const cy = GALAXY_SIZE / 2;
  const homeCount = claimedStarIndices.length;

  // Golden angle spiral: each new player gets an angular offset
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5°
  const angle = homeCount * GOLDEN_ANGLE;
  // Radius grows with sqrt(N) to fill area evenly; scale to galaxy
  const maxRadius = GALAXY_SIZE * 0.4; // stay within galaxy bounds
  const radius = Math.min(maxRadius, MIN_HOME_SPACING + Math.sqrt(homeCount) * MIN_HOME_SPACING * 0.6);
  const idealX = cx + Math.cos(angle) * radius;
  const idealY = cy + Math.sin(angle) * radius;

  // Get positions of already-claimed home stars
  const claimedPositions = claimedStarIndices
    .map((idx) => stars.find((s) => s.index === idx))
    .filter((s): s is StarPosition => s != null);

  // Sort stars by distance from the ideal spiral point
  const sorted = [...stars].sort((a, b) => {
    const da = (a.x - idealX) ** 2 + (a.y - idealY) ** 2;
    const db = (b.x - idealX) ** 2 + (b.y - idealY) ** 2;
    return da - db;
  });

  // Find closest unclaimed star to ideal point that respects spacing
  for (const candidate of sorted) {
    if (claimedStarIndices.includes(candidate.index)) continue;

    let farEnough = true;
    for (const claimed of claimedPositions) {
      const dx = candidate.x - claimed.x;
      const dy = candidate.y - claimed.y;
      if (dx * dx + dy * dy < MIN_HOME_SPACING * MIN_HOME_SPACING) {
        farEnough = false;
        break;
      }
    }
    if (farEnough) return candidate.index;
  }

  // Fallback: relax spacing to MIN_HOME_SPACING * 0.6 and try again
  const relaxed = MIN_HOME_SPACING * 0.6;
  for (const candidate of sorted) {
    if (claimedStarIndices.includes(candidate.index)) continue;

    let farEnough = true;
    for (const claimed of claimedPositions) {
      const dx = candidate.x - claimed.x;
      const dy = candidate.y - claimed.y;
      if (dx * dx + dy * dy < relaxed * relaxed) {
        farEnough = false;
        break;
      }
    }
    if (farEnough) return candidate.index;
  }

  // Absolute fallback: any unclaimed star closest to ideal point
  for (const candidate of sorted) {
    if (!claimedStarIndices.includes(candidate.index)) return candidate.index;
  }

  return 0;
}
