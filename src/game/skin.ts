/**
 * Render Skin Framework — swappable visual styles for game elements.
 *
 * Skins define how features (stations, mines, etc.) and ships are drawn.
 * The active skin is selected via localStorage and can be changed at runtime.
 *
 * Directory structure:
 *   public/icons/             — legacy SVGs (used by procedural skin as reference)
 *   public/icons/skins/procedural/  — current wireframe style sprites
 *   public/icons/skins/scifi/       — sci-fi style sprites
 *   public/icons/skins/cartoon/     — cartoon style sprites
 *
 * Each skin folder contains:
 *   station-level-{1-8}.svg
 *   mine-level-{1-8}.svg
 *   solar-array-level-{1-8}.svg
 *   hab-level-{1-8}.svg
 *   dock-level-{1-3}.svg
 *   ship-{type}.svg
 */

import type { FeatureType } from './galaxy';

// ── Skin IDs ────────────────────────────────────────────────────────────────

export type SkinId = 'procedural' | 'raster' | 'scifi' | 'cartoon';

export const SKIN_LABELS: Record<SkinId, string> = {
  procedural: 'Wireframe',
  raster: 'Standard',
  scifi: 'Sci-Fi',
  cartoon: 'Cartoon',
};

// ── Draw Function Signatures ────────────────────────────────────────────────

export type DrawFeatureIconFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: FeatureType,
  size: number,
  level?: number,
) => void;

// Future expansion:
// export type DrawShipFn = (ctx, x, y, shape, angle, size, color) => void;
// export type DrawStarburstFn = (ctx, x, y, innerR, outerR, alpha, tone) => void;

// ── Skin Interface ──────────────────────────────────────────────────────────

export interface RenderSkin {
  id: SkinId;
  label: string;
  drawFeatureIcon: DrawFeatureIconFn;
  // Future:
  // drawShip: DrawShipFn;
  // drawStarburst: DrawStarburstFn;
}

// ── Variant System (per-element visual choices within a skin) ────────────────

export type VariantId = string;

export interface VariantOption {
  id: VariantId;
  label: string;
  preview: string; // sprite path for selection UI
}

export interface SkinVariants {
  station?: VariantId;
  mine?: VariantId;
  colony?: VariantId;
  solar_array?: VariantId;
  hab?: VariantId;
  dock?: VariantId;
  cannon?: VariantId;
  // Extend as needed
}

// ── Active Skin State ───────────────────────────────────────────────────────

let _activeSkin: RenderSkin | null = null;
let _activeSkinId: SkinId = 'procedural';
let _variants: SkinVariants = {};

const SKIN_STORAGE_KEY = 'skin';
const VARIANTS_STORAGE_KEY = 'skin_variants';
const WIREFRAME_PREF_KEY = 'wireframe_pref';

let _wireframePref = false; // global wireframe lock — overrides skin choice

/** Get global wireframe preference. */
export function getWireframePref(): boolean { return _wireframePref; }

/** Set global wireframe preference. When true, everything renders as wireframe. */
export function setWireframePref(v: boolean): void {
  _wireframePref = v;
  localStorage.setItem(WIREFRAME_PREF_KEY, v ? '1' : '0');
}

/** Initialize skin system — call once at game startup. */
export function initSkins(defaultSkin: RenderSkin): void {
  const stored = localStorage.getItem(SKIN_STORAGE_KEY) as SkinId | null;
  _activeSkinId = stored && stored in SKIN_LABELS ? stored : 'procedural';
  _activeSkin = defaultSkin; // Always start with procedural; others loaded on demand

  // Restore wireframe preference
  _wireframePref = localStorage.getItem(WIREFRAME_PREF_KEY) === '1';

  const varRaw = localStorage.getItem(VARIANTS_STORAGE_KEY);
  if (varRaw) {
    try { _variants = JSON.parse(varRaw); } catch { /* use default */ }
  }
}

/** Get the active skin's draw function for features. */
export function getActiveDrawFeatureIcon(): DrawFeatureIconFn {
  return _activeSkin?.drawFeatureIcon ?? fallbackDrawFeatureIcon;
}

/** Get active skin ID. Returns 'procedural' when wireframe pref is on. */
export function getActiveSkinId(): SkinId {
  return _wireframePref ? 'procedural' : _activeSkinId;
}

/** Switch skin at runtime. */
export function setActiveSkin(skin: RenderSkin): void {
  _activeSkin = skin;
  _activeSkinId = skin.id;
  localStorage.setItem(SKIN_STORAGE_KEY, skin.id);
}

/** Get current variants. */
export function getSkinVariants(): SkinVariants {
  return { ..._variants };
}

/** Set a variant for an element type. */
export function setSkinVariant(element: keyof SkinVariants, variant: VariantId): void {
  _variants[element] = variant;
  localStorage.setItem(VARIANTS_STORAGE_KEY, JSON.stringify(_variants));
}

/** Get the draw function for a specific skin ID (used for rendering other players' buildings). */
export function getDrawFeatureIconForSkinId(skinId: SkinId | string | undefined): DrawFeatureIconFn {
  if (!skinId || skinId === _activeSkinId) {
    return getActiveDrawFeatureIcon();
  }
  const found = _skinRegistry.get(skinId as SkinId);
  return found ?? getActiveDrawFeatureIcon();
}

const _skinRegistry = new Map<SkinId, DrawFeatureIconFn>();

/** Register a skin's draw function (call during skin preload). */
export function registerSkinDrawFn(id: SkinId, fn: DrawFeatureIconFn): void {
  _skinRegistry.set(id, fn);
}

// Fallback — draws nothing (should never be reached)
function fallbackDrawFeatureIcon(): void { /* noop */ }
