/**
 * Raster Skin — uses pre-rendered PNG sprites from public/icons/bases/.
 * Falls back to procedural drawing for feature types without sprites.
 */

import type { FeatureType } from '../galaxy';
import type { RenderSkin, DrawFeatureIconFn } from '../skin';
import { proceduralSkin } from './procedural';

// ── Sprite Loading ──────────────────────────────────────────────────────────

const STARBASE_PATH = 'icons/bases2/';
const STARBASE_COUNT = 8;
const PLANET_PATH = 'icons/planets/';
const PLANET_IDS = [1, 2, 4, 5, 6, 7, 8]; // available planet sprites (03 missing)

const _sprites: Map<string, HTMLImageElement> = new Map();
const _planetSprites: HTMLImageElement[] = [];
let _spritesLoaded = false;

/** Preload all station and planet sprites. Safe to call multiple times. */
export function preloadRasterSprites(): void {
  if (_spritesLoaded) return;
  _spritesLoaded = true;
  for (let i = 1; i <= STARBASE_COUNT; i++) {
    const key = `starbase_lv${i}`;
    const img = new Image();
    img.src = `${STARBASE_PATH}starbase_lv${i}_256.png`;
    _sprites.set(key, img);
  }
  for (const id of PLANET_IDS) {
    const img = new Image();
    img.src = `${PLANET_PATH}planet_0${id}_256.png`;
    _planetSprites.push(img);
  }
}

/** Get a planet sprite by seed (deterministic selection). */
export function getPlanetSprite(seed: number): HTMLImageElement | null {
  if (_planetSprites.length === 0) return null;
  const idx = ((seed % _planetSprites.length) + _planetSprites.length) % _planetSprites.length;
  const img = _planetSprites[idx];
  if (img && img.complete && img.naturalWidth > 0) return img;
  return null;
}

// ── Sprite Mapping ──────────────────────────────────────────────────────────
// 8 starbase sprites (lv1-8) from bases2/.
// Station uses its actual level; other features map to a representative level.
// Anything without a mapping falls through to procedural.

function getSpriteKey(type: FeatureType, level: number): string | null {
  switch (type) {
    case 'station':
      return `starbase_lv${Math.min(Math.max(level, 1), 8)}`;
    case 'mine':
    case 'mine_l2':
      return 'starbase_lv2';
    case 'colony':
    case 'outpost':
      return 'starbase_lv3';
    case 'dock':
      return 'starbase_lv4';
    case 'solar_array':
    case 'solar_array_l2':
      return 'starbase_lv5';
    case 'refinery':
    case 'warehouse':
      return 'starbase_lv7';
    case 'relay':
      return 'starbase_lv1';
    case 'shield':
    case 'cannon':
      return null; // shield effect shown as ring around station, no separate icon
    default:
      return null;
  }
}

// ── Draw Function ───────────────────────────────────────────────────────────

const drawFeatureIconRaster: DrawFeatureIconFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: FeatureType,
  size: number,
  level?: number,
) => {
  const lv = level ?? 1;
  const key = getSpriteKey(type, lv);

  if (key) {
    const img = _sprites.get(key);
    if (img && img.complete && img.naturalWidth > 0) {
      const drawSize = size * 4; // scale sprite larger for visibility
      ctx.drawImage(img, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
      return;
    }
  }

  // Fallback to procedural for missing sprites
  proceduralSkin.drawFeatureIcon(ctx, x, y, type, size, level);
};

// ── Export ───────────────────────────────────────────────────────────────────

export const rasterSkin: RenderSkin = {
  id: 'raster',
  label: 'Raster',
  drawFeatureIcon: drawFeatureIconRaster,
};
