// ── Canvas Font Scale ────────────────────────────────────────────────────────
// Single source for canvas font strings so a user-set scale can be applied
// globally. Layout constants are not scaled yet — see attack plan item 36.

export type FontFamily = 'monospace' | 'sans-serif';
export type FontWeight = '' | 'bold' | 'italic';

const MIN_PX = 6;

let _fontScale = 1.0;

export function getFontScale(): number {
  return _fontScale;
}

export function setFontScale(scale: number): void {
  _fontScale = Math.max(0.8, Math.min(1.5, scale));
}

/** Build a canvas font string at the current scale. */
export function f(size: number, weight: FontWeight = '', family: FontFamily = 'monospace'): string {
  const px = Math.max(MIN_PX, Math.round(size * _fontScale));
  return `${weight ? weight + ' ' : ''}${px}px ${family}`;
}
