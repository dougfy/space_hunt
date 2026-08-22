/**
 * Raster Skin — uses pre-rendered PNG sprites from public/icons/bases/.
 * Falls back to procedural drawing for feature types without sprites.
 */

import type { FeatureType } from '../galaxy';
import type { RenderSkin, DrawFeatureIconFn } from '../skin';
import { getSkinVariants } from '../skin';
import { proceduralSkin } from './procedural';
import { preloadScifiSprites, getScifiStationSprite, getScifiSolarArraySprite, getScifiHabSprite, getScifiDockSprite, getScifiCannonSprite } from './scifi';

// ── Sprite Loading ──────────────────────────────────────────────────────────

const STARBASE_PATH = 'icons/skins/cartoon/';
const STARBASE_COUNT = 8;
const PLANET_PATH = 'icons/planets/';
const PLANET_IDS = [1, 2, 4, 5, 6, 7, 8]; // available planet sprites (03 missing)

const _sprites: Map<string, HTMLImageElement> = new Map();
const _planetSprites: HTMLImageElement[] = [];
let _spritesLoaded = false;

/** Preload all station, cannon, and planet sprites. Safe to call multiple times. */
export function preloadRasterSprites(): void {
  if (_spritesLoaded) return;
  _spritesLoaded = true;
  for (let i = 1; i <= STARBASE_COUNT; i++) {
    const key = `starbase_lv${i}`;
    const img = new Image();
    img.src = `${STARBASE_PATH}starbase_lv${i}_256.png`;
    _sprites.set(key, img);
  }
  // Cartoon cannon sprites (levels 1-8)
  for (let i = 1; i <= 8; i++) {
    const img = new Image();
    img.src = `${STARBASE_PATH}cannon_lv${i}_256.png`;
    _sprites.set(`cannon_lv${i}`, img);
  }

  for (const id of PLANET_IDS) {
    const img = new Image();
    img.src = `${PLANET_PATH}planet_0${id}_256.png`;
    _planetSprites.push(img);
  }
}

/** Get a cartoon station sprite for the given level (1-8). */
export function getCartoonStationSprite(level: number): HTMLImageElement | null {
  const key = `starbase_lv${Math.min(Math.max(level, 1), 8)}`;
  const img = _sprites.get(key);
  if (img && img.complete && img.naturalWidth > 0) return img;
  return null;
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
    case 'cannon':
      return `cannon_lv${Math.min(Math.max(level, 1), 8)}`;
    case 'shield':
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
  preloadRasterSprites();
  const lv = level ?? 1;

  // Station with sci-fi variant — use sci-fi sprites
  if (type === 'station' && getSkinVariants().station === 'scifi') {
    preloadScifiSprites();
    const scifiImg = getScifiStationSprite(lv);
    if (scifiImg) {
      const drawSize = size * 4;
      ctx.drawImage(scifiImg, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
      return;
    }
  }

  // Solar array with sci-fi variant — use sci-fi sprites
  if ((type === 'solar_array' || type === 'solar_array_l2') && getSkinVariants().solar_array === 'scifi') {
    preloadScifiSprites();
    const solarImg = getScifiSolarArraySprite(lv);
    if (solarImg) {
      const drawSize = size * 4;
      ctx.drawImage(solarImg, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
      return;
    }
  }

  // Hab (colony) with sci-fi variant — use sci-fi sprites
  if (type === 'colony' && getSkinVariants().hab === 'scifi') {
    preloadScifiSprites();
    const habImg = getScifiHabSprite(lv);
    if (habImg) {
      const drawSize = size * 4;
      ctx.drawImage(habImg, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
      return;
    }
  }

  // Dock with sci-fi variant — use sci-fi sprites
  if (type === 'dock' && getSkinVariants().dock === 'scifi') {
    preloadScifiSprites();
    const dockImg = getScifiDockSprite(lv);
    if (dockImg) {
      const drawSize = size * 4;
      ctx.drawImage(dockImg, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
      return;
    }
  }

  // Cannon with sci-fi variant — use sci-fi sprites
  if (type === 'cannon' && getSkinVariants().cannon === 'scifi') {
    preloadScifiSprites();
    const cannonImg = getScifiCannonSprite(lv);
    if (cannonImg) {
      const drawSize = size * 4;
      ctx.drawImage(cannonImg, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
      return;
    }
  }

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
  label: 'Standard',
  drawFeatureIcon: drawFeatureIconRaster,
};
