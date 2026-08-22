// ── Text Overflow Audit (dev tool) ───────────────────────────────────────────
// Layout in this renderer is hand-tuned rather than measured (250 fillText calls,
// 3 measureText calls), so scaling fonts silently pushes text out of its panel.
// This patches fillText to measure every draw against the panel currently being
// rendered and logs the offenders, instead of relying on spotting them by eye.
//
// Console: __textAudit(true) then open panels at Medium/Large; __textAudit() to
// dump the collected report.

type Region = { name: string; x: number; y: number; w: number };

export type Overflow = { region: string; text: string; overBy: number; site: string };

let _enabled = false;
let _patched = false;
let _region: Region | null = null;
const _found = new Map<string, Overflow>();

export function setTextAuditEnabled(on: boolean): void {
  _enabled = on;
  if (on) _found.clear();
}

export function isTextAuditEnabled(): boolean {
  return _enabled;
}

/** Called by each panel frame so subsequent text draws know their container. */
export function setAuditRegion(name: string, x: number, y: number, w: number): void {
  if (!_enabled) return;
  _region = { name, x, y, w };
}

export function getOverflowReport(): Overflow[] {
  return [..._found.values()].sort((a, b) => b.overBy - a.overBy);
}

/** Patch a context once so all text draws are measured while auditing is on. */
export function installTextAudit(ctx: CanvasRenderingContext2D): void {
  if (_patched) return;
  _patched = true;
  const orig = ctx.fillText.bind(ctx);
  ctx.fillText = ((text: string, x: number, y: number, maxWidth?: number) => {
    if (_enabled && _region && typeof text === 'string' && text.length > 0) {
      check(ctx, text, x);
    }
    return maxWidth === undefined ? orig(text, x, y) : orig(text, x, y, maxWidth);
  }) as typeof ctx.fillText;
}

const EDGE_TOLERANCE = 2;

function check(ctx: CanvasRenderingContext2D, text: string, x: number): void {
  const region = _region;
  if (!region) return;
  const w = ctx.measureText(text).width;
  const left = ctx.textAlign === 'center' ? x - w / 2 : ctx.textAlign === 'right' ? x - w : x;
  const right = left + w;

  const overRight = right - (region.x + region.w - EDGE_TOLERANCE);
  const overLeft = (region.x + EDGE_TOLERANCE) - left;
  const overBy = Math.max(overRight, overLeft);
  if (overBy <= 0) return;

  const site = callSite();
  const key = `${region.name}|${site}|${text.slice(0, 12)}`;
  if (_found.has(key)) return;
  _found.set(key, { region: region.name, text, overBy: Math.round(overBy), site });
  console.warn(`[TEXT-AUDIT] "${text}" overflows ${region.name} by ${Math.round(overBy)}px @ ${site}`);
}

function callSite(): string {
  const lines = new Error().stack?.split('\n') ?? [];
  // 0 Error, 1 callSite, 2 check, 3 patched fillText, 4 the actual draw call
  return lines[4]?.trim().replace(/^at\s+/, '') ?? 'unknown';
}
