// ── Canvas Font Scale ────────────────────────────────────────────────────────
// Single source for canvas font strings so a user-set scale can be applied
// globally. Layout constants are not scaled yet — see attack plan item 36.

export type FontFamily = 'monospace' | 'sans-serif';
export type FontWeight = '' | 'bold' | 'italic';
export type FontScaleName = 'small' | 'medium' | 'large';

/** 'small' is the historical layout and must stay pixel-identical to pre-scale builds. */
export const FONT_SCALES: Record<FontScaleName, number> = {
  small: 1.0,
  medium: 1.15,
  large: 1.3,
};

const MIN_PX = 6;

let _fontScale = 1.0;
let _fontScaleName: FontScaleName = 'small';

export function getFontScale(): number {
  return _fontScale;
}

export function getFontScaleName(): FontScaleName {
  return _fontScaleName;
}

export function setFontScaleByName(name: FontScaleName): void {
  if (!(name in FONT_SCALES)) return;
  _fontScaleName = name;
  _fontScale = FONT_SCALES[name];
}

export function setFontScale(scale: number): void {
  _fontScale = Math.max(0.8, Math.min(1.5, scale));
}

/** Build a canvas font string at the current scale. */
export function f(size: number, weight: FontWeight = '', family: FontFamily = 'monospace'): string {
  // Scale 1.0 must be a pure identity so 'small' cannot drift from the original layout.
  const px = _fontScale === 1 ? size : Math.max(MIN_PX, Math.round(size * _fontScale));
  return `${weight ? weight + ' ' : ''}${px}px ${family}`;
}
