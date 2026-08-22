/**
 * Sci-Fi Skin — uses ChatGPT-generated sci-fi sprites.
 * Has station and solar array art; falls back to raster/procedural for other types.
 */

import type { FeatureType } from '../galaxy';
import type { RenderSkin, DrawFeatureIconFn } from '../skin';
import { proceduralSkin } from './procedural';

const SCIFI_PATH = 'icons/skins/scifi/';
const SPRITE_COUNT = 8;

const _scifiSprites: Map<string, HTMLImageElement> = new Map();
let _loaded = false;

/** Preload all sci-fi sprites. Safe to call multiple times. */
export function preloadScifiSprites(): void {
  if (_loaded) return;
  _loaded = true;
  for (let i = 1; i <= SPRITE_COUNT; i++) {
    const stationKey = `scifi_station_lv${i}`;
    const stationImg = new Image();
    stationImg.src = `${SCIFI_PATH}station-level-${i}.png`;
    _scifiSprites.set(stationKey, stationImg);

    const solarKey = `scifi_solar_array_lv${i}`;
    const solarImg = new Image();
    solarImg.src = `${SCIFI_PATH}solar-array-level-${i}.png`;
    _scifiSprites.set(solarKey, solarImg);

    const habKey = `scifi_hab_lv${i}`;
    const habImg = new Image();
    habImg.src = `${SCIFI_PATH}hab-level-${i}.png`;
    _scifiSprites.set(habKey, habImg);

    const dockKey = `scifi_dock_lv${i}`;
    const dockImg = new Image();
    dockImg.src = `${SCIFI_PATH}dock-level-${i}.png`;
    _scifiSprites.set(dockKey, dockImg);

    const cannonKey = `scifi_cannon_lv${i}`;
    const cannonImg = new Image();
    cannonImg.src = `${SCIFI_PATH}cannon-level-${i}.png`;
    _scifiSprites.set(cannonKey, cannonImg);
  }
}

/** Get a sci-fi station sprite for the given level (1-8). */
export function getScifiStationSprite(level: number): HTMLImageElement | null {
  const key = `scifi_station_lv${Math.min(Math.max(level, 1), 8)}`;
  const img = _scifiSprites.get(key);
  if (img && img.complete && img.naturalWidth > 0) return img;
  return null;
}

/** Get a sci-fi solar array sprite for the given level (1-8). */
export function getScifiSolarArraySprite(level: number): HTMLImageElement | null {
  const key = `scifi_solar_array_lv${Math.min(Math.max(level, 1), 8)}`;
  const img = _scifiSprites.get(key);
  if (img && img.complete && img.naturalWidth > 0) return img;
  return null;
}

/** Get a sci-fi hab sprite for the given level (1-8). */
export function getScifiHabSprite(level: number): HTMLImageElement | null {
  const key = `scifi_hab_lv${Math.min(Math.max(level, 1), 8)}`;
  const img = _scifiSprites.get(key);
  if (img && img.complete && img.naturalWidth > 0) return img;
  return null;
}

/** Get a sci-fi dock sprite for the given level (1-8). */
export function getScifiDockSprite(level: number): HTMLImageElement | null {
  const key = `scifi_dock_lv${Math.min(Math.max(level, 1), 8)}`;
  const img = _scifiSprites.get(key);
  if (img && img.complete && img.naturalWidth > 0) return img;
  return null;
}

/** Get a sci-fi cannon sprite for the given level (1-8). */
export function getScifiCannonSprite(level: number): HTMLImageElement | null {
  const key = `scifi_cannon_lv${Math.min(Math.max(level, 1), 8)}`;
  const img = _scifiSprites.get(key);
  if (img && img.complete && img.naturalWidth > 0) return img;
  return null;
}

// ── Sci-Fi Draw Function ────────────────────────────────────────────────────
// Always draws with sci-fi sprites (no variant check). Falls back to procedural
// for types without sci-fi art.

const drawFeatureIconScifi: DrawFeatureIconFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: FeatureType,
  size: number,
  level?: number,
) => {
  const lv = level ?? 1;
  const drawSize = size * 4;
  preloadScifiSprites();

  let img: HTMLImageElement | null = null;
  switch (type) {
    case 'station':
      img = getScifiStationSprite(lv);
      break;
    case 'solar_array':
    case 'solar_array_l2':
      img = getScifiSolarArraySprite(lv);
      break;
    case 'colony':
    case 'outpost':
      img = getScifiHabSprite(lv);
      break;
    case 'dock':
      img = getScifiDockSprite(lv);
      break;
    case 'cannon':
      img = getScifiCannonSprite(lv);
      break;
  }

  if (img) {
    ctx.drawImage(img, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
    return;
  }

  // Fallback to procedural for missing sprites
  proceduralSkin.drawFeatureIcon(ctx, x, y, type, size, level);
};

// ── Export ───────────────────────────────────────────────────────────────────

export const scifiSkin: RenderSkin = {
  id: 'scifi',
  label: 'Sci-Fi',
  drawFeatureIcon: drawFeatureIconScifi,
};
