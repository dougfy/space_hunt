/**
 * Ship Sprite System — loads PNG sprites for ship shapes.
 * Falls back to procedural drawing when sprites are unavailable.
 */

import type { ShipShape } from './types';

const SHIPS_PATH = 'icons/ships/';

/** Map of ship shape → processed (transparent-bg) canvas ready to draw */
const _shipSprites: Map<ShipShape, HTMLCanvasElement> = new Map();
let _loaded = false;

/** Which shapes have sprites available */
const SPRITE_SHAPES: ShipShape[] = ['scout', 'destroyer', 'frigate', 'battleship', 'cruiser', 'dreadnought', 'colony'];

/** Preload ship sprites. Safe to call multiple times. */
export function preloadShipSprites(): void {
  if (_loaded) return;
  _loaded = true;

  for (const shape of SPRITE_SHAPES) {
    const img = new Image();
    img.src = `${SHIPS_PATH}${shape}.png`;
    img.onload = () => {
      const processed = removeWhiteBackground(img);
      _shipSprites.set(shape, processed);
    };
  }
}

/**
 * Get the processed ship sprite canvas for a shape.
 * Returns null if not yet loaded or no sprite exists for that shape.
 */
export function getShipSprite(shape: ShipShape): HTMLCanvasElement | null {
  const canvas = _shipSprites.get(shape);
  if (!canvas) return null;
  return canvas;
}

/**
 * Remove white background from an image by making white/near-white pixels transparent.
 * Returns an offscreen canvas with the processed result.
 */
function removeWhiteBackground(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    // If pixel is near-white, make it transparent
    if (r > 230 && g > 230 && b > 230) {
      data[i + 3] = 0; // set alpha to 0
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
