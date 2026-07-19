// ── Canvas2D Renderer ───────────────────────────────────────────────────────
// Replaces Unity's LineRenderer with direct Canvas2D path drawing.

import type { Vec2, Asteroid, Camera, ShipShape } from './types';
import {
  SHIP_LINE_WIDTH, ASTEROID_LINE_WIDTH, TARGET_LINE_WIDTH,
  TARGET_RING_RADIUS, POD_LINE_WIDTH, POD_SIZE,
  ASTEROID_COLOR,
  ASTEROID_DISCOVERED_COLOR, TARGET_COLOR,
  BG_COLOR, GHOST_PALETTE,
  BASE_ORTHO, SHIP_SIZE,
} from './constants';
import { vec2, add, sub, normalize, magnitude, scale, createRng } from './math';
import { getShipShapePoints } from './ship';
import { getAsteroidSurfaceInfo } from './asteroids';

export interface Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx, width: canvas.width, height: canvas.height };
}

export function resizeRenderer(r: Renderer) {
  const dpr = window.devicePixelRatio || 1;
  const rect = r.canvas.getBoundingClientRect();
  r.canvas.width = rect.width * dpr;
  r.canvas.height = rect.height * dpr;
  r.width = r.canvas.width;
  r.height = r.canvas.height;
  r.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Convert world coordinates to screen pixel coordinates */
export function worldToScreen(
  worldPos: Vec2,
  camera: Camera,
  screenW: number,
  screenH: number,
): Vec2 {
  const halfH = camera.orthoSize;
  const halfW = halfH * camera.aspect;
  const nx = (worldPos.x - camera.pos.x + halfW) / (halfW * 2);
  const ny = 1 - (worldPos.y - camera.pos.y + halfH) / (halfH * 2);
  return { x: nx * screenW, y: ny * screenH };
}

/** Convert screen pixel coordinates to world coordinates */
export function screenToWorld(
  screenPos: Vec2,
  camera: Camera,
  screenW: number,
  screenH: number,
): Vec2 {
  const halfH = camera.orthoSize;
  const halfW = halfH * camera.aspect;
  const nx = screenPos.x / screenW;
  const ny = screenPos.y / screenH;
  return {
    x: camera.pos.x + (nx * 2 - 1) * halfW,
    y: camera.pos.y + (1 - ny * 2) * halfH,
  };
}

/** World units per screen pixel at current zoom */
function worldPerPixel(camera: Camera, screenH: number): number {
  return (camera.orthoSize * 2) / screenH;
}

/** Scale factor for keeping line widths constant in screen space */
function zoomScale(camera: Camera): number {
  return Math.max(0.05, camera.orthoSize / BASE_ORTHO);
}

export function clearScreen(r: Renderer) {
  r.ctx.fillStyle = BG_COLOR;
  r.ctx.fillRect(0, 0, r.width, r.height);
}

export function drawPolyline(
  r: Renderer,
  camera: Camera,
  points: Vec2[],
  color: string,
  widthWorld: number,
  closed: boolean,
) {
  if (points.length < 2) return;
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);
  const wpp = worldPerPixel(camera, screenH);
  const lineWidthPx = Math.max(1, widthWorld / wpp);

  ctx.beginPath();
  const p0 = worldToScreen(points[0], camera, screenW, screenH);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < points.length; i++) {
    const p = worldToScreen(points[i], camera, screenW, screenH);
    ctx.lineTo(p.x, p.y);
  }
  if (closed) ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidthPx;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function drawCircle(
  r: Renderer,
  camera: Camera,
  center: Vec2,
  radius: number,
  color: string,
  widthWorld: number,
) {
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);
  const wpp = worldPerPixel(camera, screenH);
  const sc = worldToScreen(center, camera, screenW, screenH);
  const radiusPx = radius / wpp;
  const lineWidthPx = Math.max(1, widthWorld / wpp);

  ctx.beginPath();
  ctx.arc(sc.x, sc.y, radiusPx, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidthPx;
  ctx.stroke();
}

export function drawLine(
  r: Renderer,
  camera: Camera,
  from: Vec2,
  to: Vec2,
  color: string,
  widthWorld: number,
) {
  drawPolyline(r, camera, [from, to], color, widthWorld, false);
}

export function drawShip(
  r: Renderer,
  camera: Camera,
  pos: Vec2,
  angle: number,
  shape: ShipShape,
  color: string,
  sizeOverride?: number,
) {
  const zs = zoomScale(camera);
  const size = sizeOverride ?? SHIP_SIZE;
  const lineWidth = SHIP_LINE_WIDTH * zs;

  const forward = { x: Math.cos(angle), y: Math.sin(angle) };
  const right = { x: -forward.y, y: forward.x };
  const pts = getShipShapePoints(shape);

  const worldPts: Vec2[] = pts.map(p => ({
    x: pos.x + right.x * (p.x * size) + forward.x * (p.y * size),
    y: pos.y + right.y * (p.x * size) + forward.y * (p.y * size),
  }));
  // Close the shape
  worldPts.push({ ...worldPts[0] });

  drawPolyline(r, camera, worldPts, color, lineWidth, false);
}

export function drawAsteroid(
  r: Renderer,
  camera: Camera,
  asteroid: Asteroid,
  discovered: boolean,
) {
  const zs = zoomScale(camera);
  const lineWidth = ASTEROID_LINE_WIDTH * zs;
  const color = discovered ? ASTEROID_DISCOVERED_COLOR : ASTEROID_COLOR;
  const n = asteroid.pts.length;
  const points: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    points.push(add(asteroid.pos, asteroid.pts[i]));
  }
  points.push(add(asteroid.pos, asteroid.pts[0]));
  drawPolyline(r, camera, points, color, lineWidth, false);
}

export function drawTargetReticle(
  r: Renderer,
  camera: Camera,
  pos: Vec2,
) {
  const zs = zoomScale(camera);
  const lineWidth = TARGET_LINE_WIDTH * zs;
  const ringRadius = TARGET_RING_RADIUS * zs;
  const armLen = ringRadius * 1.6;

  drawCircle(r, camera, pos, ringRadius, TARGET_COLOR, lineWidth);

  // Crosshair arms
  drawLine(r, camera,
    { x: pos.x - armLen, y: pos.y },
    { x: pos.x + armLen, y: pos.y },
    TARGET_COLOR, lineWidth);
  drawLine(r, camera,
    { x: pos.x, y: pos.y - armLen },
    { x: pos.x, y: pos.y + armLen },
    TARGET_COLOR, lineWidth);
}

export function drawFuelPod(
  r: Renderer,
  camera: Camera,
  podCenter: Vec2,
  asteroid: Asteroid,
  color: string,
) {
  const zs = zoomScale(camera);
  const podWidth = POD_LINE_WIDTH * zs;
  const rad = POD_SIZE;

  // Draw pod circle
  drawCircle(r, camera, podCenter, rad, color, podWidth);

  // Draw stems from asteroid surface to pod
  const info = getAsteroidSurfaceInfo(asteroid, podCenter);
  const diff = sub(podCenter, info.nearest);
  let n = magnitude(diff) > 1e-6
    ? normalize(diff)
    : normalize(sub(podCenter, asteroid.pos));
  if (magnitude(n) < 1e-6) n = vec2(0, 1);
  const t = vec2(-n.y, n.x);
  const halfSep = rad * 0.32;

  const stemA0 = sub(info.nearest, scale(t, halfSep));
  const stemA1 = sub(sub(podCenter, scale(n, rad)), scale(t, halfSep));
  const stemB0 = add(info.nearest, scale(t, halfSep));
  const stemB1 = add(sub(podCenter, scale(n, rad)), scale(t, halfSep));

  const stemWidth = Math.max(podWidth * 0.9, POD_LINE_WIDTH * 0.45);
  drawLine(r, camera, stemA0, stemA1, color, stemWidth);
  drawLine(r, camera, stemB0, stemB1, color, stemWidth);
}

export function drawGhostShip(
  r: Renderer,
  camera: Camera,
  pos: Vec2,
  angle: number,
  shape: ShipShape,
  slot: number,
) {
  const color = GHOST_PALETTE[Math.abs(slot - 1) % GHOST_PALETTE.length];
  drawShip(r, camera, pos, angle, shape, color);
}

export function drawHUD(
  r: Renderer,
  fuelPercent: number,
  fuelCollected: number,
  fuelTotal: number,
  lowFuelBlink: boolean,
  _elapsedTime: number,
) {
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);

  ctx.save();
  ctx.font = 'bold 14px monospace';
  ctx.textBaseline = 'top';

  // Fuel display
  const isLow = fuelPercent <= 25;
  const fuelColor = isLow ? '#FF5A3D' : '#FFD24A';
  ctx.fillStyle = fuelColor;
  ctx.fillText(`FUEL: ${Math.round(fuelPercent)}%`, 12, 12);

  ctx.fillStyle = '#FFD24A';
  ctx.fillText(`DOCKS: ${fuelCollected} / ${fuelTotal}`, 12, 30);

  if (isLow && lowFuelBlink) {
    ctx.fillStyle = '#FF5A3D';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('⚠ LOW FUEL', 12, 50);
  }

  // Bottom hint bar
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(
    'Click/drag: set target  •  Right-click: clear  •  Zoom close to discover asteroids  •  Red docks refuel to 100%',
    screenW / 2,
    screenH - 6,
  );

  ctx.restore();
}

export function drawAsteroidLabel(
  r: Renderer,
  camera: Camera,
  asteroid: Asteroid,
  name: string,
  discovered: boolean,
) {
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);
  const sc = worldToScreen(asteroid.pos, camera, screenW, screenH);

  // Only draw if on screen
  if (sc.x < -50 || sc.x > screenW + 50 || sc.y < -20 || sc.y > screenH + 20) return;

  ctx.save();
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillText(name, sc.x + 1, sc.y + 1);

  // Main text
  ctx.fillStyle = discovered ? ASTEROID_DISCOVERED_COLOR : ASTEROID_COLOR;
  ctx.fillText(name, sc.x, sc.y);
  ctx.restore();
}

export function drawGhostLabel(
  r: Renderer,
  camera: Camera,
  pos: Vec2,
  name: string,
  slot: number,
) {
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);
  const sc = worldToScreen(pos, camera, screenW, screenH);

  ctx.save();
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = GHOST_PALETTE[Math.abs(slot - 1) % GHOST_PALETTE.length];
  ctx.fillText(`${name} (S${slot})`, sc.x, sc.y + 16);
  ctx.restore();
}

export function drawPlayerLabel(
  r: Renderer,
  camera: Camera,
  pos: Vec2,
  name: string,
) {
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);
  const sc = worldToScreen(pos, camera, screenW, screenH);

  ctx.save();
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Shadow for readability
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillText(name, sc.x + 1, sc.y + 22);

  // Main text
  ctx.fillStyle = '#4fffb0';
  ctx.fillText(name, sc.x, sc.y + 21);
  ctx.restore();
}

// ── Shooting Rendering ────────────────────────────────────────────────────

import type { Projectile, ShootingState } from './types';
import {
  SHOT_LINE_WIDTH, SHOT_TRAIL_LENGTH,
  SHOT_COLOR_OWN, SHOT_COLOR_ENEMY, SHOT_HIT_COLOR,
  SHOT_COOLDOWN, PLAYER_MAX_HP,
} from './constants';
import { getProjectilePos } from './shooting';

export function drawProjectiles(
  r: Renderer,
  camera: Camera,
  projectiles: Projectile[],
  elapsedTime: number,
) {
  const zs = zoomScale(camera);
  const lineWidth = SHOT_LINE_WIDTH * zs;

  for (const p of projectiles) {
    const pos = getProjectilePos(p, elapsedTime);
    const trailEnd: Vec2 = {
      x: pos.x - Math.cos(p.angle) * SHOT_TRAIL_LENGTH,
      y: pos.y - Math.sin(p.angle) * SHOT_TRAIL_LENGTH,
    };
    const color = p.own ? SHOT_COLOR_OWN : SHOT_COLOR_ENEMY;
    drawLine(r, camera, trailEnd, pos, color, lineWidth);
  }
}

export function drawShootingHUD(
  r: Renderer,
  shooting: ShootingState,
) {
  if (!shooting.enabled) return;

  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);

  ctx.save();

  // ── Shields percentage (next to fuel, at y=48) ──
  const shieldPercent = Math.round((shooting.hp / PLAYER_MAX_HP) * 100);
  const shieldColor = shieldPercent <= 33 ? '#FF5A3D' : '#4fffb0';
  ctx.font = 'bold 14px monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = shieldColor;
  if (shooting.invulnRemaining > 0) {
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(Date.now() / 100));
  }
  ctx.fillText(`SHIELDS: ${shieldPercent}%`, 12, 50);
  ctx.globalAlpha = 1;

  // ── Fire button (bottom-right) ──
  const btnRadius = 28;
  const btnX = screenW - 50;
  const btnY = screenH - 60;

  // Cooldown radial fill
  const progress = shooting.cooldownRemaining / SHOT_COOLDOWN;

  // Button background
  ctx.beginPath();
  ctx.arc(btnX, btnY, btnRadius, 0, Math.PI * 2);
  ctx.fillStyle = progress > 0 ? 'rgba(30, 50, 60, 0.7)' : 'rgba(20, 80, 60, 0.8)';
  ctx.fill();

  // Cooldown arc
  if (progress > 0) {
    ctx.beginPath();
    ctx.moveTo(btnX, btnY);
    const startA = -Math.PI / 2;
    const endA = startA + (1 - progress) * Math.PI * 2;
    ctx.arc(btnX, btnY, btnRadius, startA, endA);
    ctx.closePath();
    ctx.fillStyle = 'rgba(79, 255, 176, 0.2)';
    ctx.fill();
  }

  // Button border
  ctx.beginPath();
  ctx.arc(btnX, btnY, btnRadius, 0, Math.PI * 2);
  ctx.strokeStyle = progress > 0 ? 'rgba(79, 255, 176, 0.4)' : '#4fffb0';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Crosshair icon
  const icoSize = 10;
  ctx.strokeStyle = progress > 0 ? 'rgba(79, 255, 176, 0.5)' : '#4fffb0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(btnX - icoSize, btnY); ctx.lineTo(btnX + icoSize, btnY);
  ctx.moveTo(btnX, btnY - icoSize); ctx.lineTo(btnX, btnY + icoSize);
  ctx.stroke();

  // Hit flash overlay
  if (shooting.hitFlashTimer > 0) {
    const alpha = shooting.hitFlashTimer / 0.15;
    ctx.fillStyle = `rgba(255, 80, 60, ${alpha * 0.3})`;
    ctx.fillRect(0, 0, screenW, screenH);
  }

  ctx.restore();
}

export function drawZoomButton(
  r: Renderer,
  zoomed: boolean,
) {
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);

  const btnRadius = 24;
  const btnX = screenW - 120;
  const btnY = screenH - 60;

  ctx.save();

  // Button background
  ctx.beginPath();
  ctx.arc(btnX, btnY, btnRadius, 0, Math.PI * 2);
  ctx.fillStyle = zoomed ? 'rgba(20, 80, 60, 0.8)' : 'rgba(30, 50, 60, 0.7)';
  ctx.fill();

  // Button border
  ctx.beginPath();
  ctx.arc(btnX, btnY, btnRadius, 0, Math.PI * 2);
  ctx.strokeStyle = zoomed ? '#4fffb0' : 'rgba(79, 255, 176, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Magnifying glass icon
  const glassR = 8;
  const glassX = btnX - 2;
  const glassY = btnY - 2;
  ctx.beginPath();
  ctx.arc(glassX, glassY, glassR, 0, Math.PI * 2);
  ctx.strokeStyle = zoomed ? '#4fffb0' : 'rgba(79, 255, 176, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Handle
  ctx.beginPath();
  ctx.moveTo(glassX + glassR * 0.7, glassY + glassR * 0.7);
  ctx.lineTo(glassX + glassR * 1.4, glassY + glassR * 1.4);
  ctx.stroke();

  // + or - inside lens
  ctx.strokeStyle = zoomed ? '#4fffb0' : 'rgba(79, 255, 176, 0.5)';
  ctx.lineWidth = 2;
  const icoS = 4;
  if (!zoomed) {
    // + for zoom in
    ctx.beginPath();
    ctx.moveTo(glassX - icoS, glassY); ctx.lineTo(glassX + icoS, glassY);
    ctx.moveTo(glassX, glassY - icoS); ctx.lineTo(glassX, glassY + icoS);
    ctx.stroke();
  } else {
    // - for zoom out
    ctx.beginPath();
    ctx.moveTo(glassX - icoS, glassY); ctx.lineTo(glassX + icoS, glassY);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Bottom-right control buttons (recenter + zoom) ──────────────────────────

const CTRL_BTN_RADIUS = 20;

function getCtrlBtnPositions(r: Renderer) {
  const dpr = window.devicePixelRatio || 1;
  const screenW = r.width / dpr;
  const screenH = r.height / dpr;
  return {
    recenter: { x: screenW - 36, y: screenH - 36 },
    zoom:     { x: screenW - 36 - 52, y: screenH - 36 },
  };
}

export function drawControlButtons(
  r: Renderer,
  showZoom: boolean,
  zoomed: boolean,
  boundsActive: boolean,
  showRecenter = true,
) {
  const { ctx } = r;
  const pos = getCtrlBtnPositions(r);

  ctx.save();

  // ── Recenter button ──
  if (showRecenter) {
    const rc = pos.recenter;
    ctx.beginPath();
    ctx.arc(rc.x, rc.y, CTRL_BTN_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = boundsActive ? 'rgba(20, 80, 60, 0.8)' : 'rgba(30, 50, 60, 0.7)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rc.x, rc.y, CTRL_BTN_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = boundsActive ? '#4fffb0' : 'rgba(79, 255, 176, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Crosshair icon
    const cr = 7;
    ctx.strokeStyle = boundsActive ? '#4fffb0' : 'rgba(79, 255, 176, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(rc.x, rc.y, cr, 0, Math.PI * 2);
    ctx.stroke();
    const ext = 4;
    ctx.beginPath();
    ctx.moveTo(rc.x - cr - ext, rc.y); ctx.lineTo(rc.x + cr + ext, rc.y);
    ctx.moveTo(rc.x, rc.y - cr - ext); ctx.lineTo(rc.x, rc.y + cr + ext);
    ctx.stroke();
  }

  // ── Zoom button (only in planet tier with shooting) ──
  if (showZoom) {
    const zc = pos.zoom;
    ctx.beginPath();
    ctx.arc(zc.x, zc.y, CTRL_BTN_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = zoomed ? 'rgba(20, 80, 60, 0.8)' : 'rgba(30, 50, 60, 0.7)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(zc.x, zc.y, CTRL_BTN_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = zoomed ? '#4fffb0' : 'rgba(79, 255, 176, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Magnifying glass
    const glassR = 7;
    ctx.beginPath();
    ctx.arc(zc.x - 2, zc.y - 2, glassR, 0, Math.PI * 2);
    ctx.strokeStyle = zoomed ? '#4fffb0' : 'rgba(79, 255, 176, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(zc.x - 2 + glassR * 0.7, zc.y - 2 + glassR * 0.7);
    ctx.lineTo(zc.x - 2 + glassR * 1.4, zc.y - 2 + glassR * 1.4);
    ctx.stroke();
    const icoS = 3.5;
    if (!zoomed) {
      ctx.beginPath();
      ctx.moveTo(zc.x - 2 - icoS, zc.y - 2); ctx.lineTo(zc.x - 2 + icoS, zc.y - 2);
      ctx.moveTo(zc.x - 2, zc.y - 2 - icoS); ctx.lineTo(zc.x - 2, zc.y - 2 + icoS);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(zc.x - 2 - icoS, zc.y - 2); ctx.lineTo(zc.x - 2 + icoS, zc.y - 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export type ControlButtonHit = 'recenter' | 'zoom' | null;

export function hitTestControlButtons(
  r: Renderer,
  screenX: number,
  screenY: number,
  showZoom: boolean,
  showRecenter = true,
): ControlButtonHit {
  const pos = getCtrlBtnPositions(r);
  const hitR = CTRL_BTN_RADIUS + 6;

  if (showRecenter) {
    const rdx = screenX - pos.recenter.x;
    const rdy = screenY - pos.recenter.y;
    if (rdx * rdx + rdy * rdy <= hitR * hitR) return 'recenter';
  }

  if (showZoom) {
    const zdx = screenX - pos.zoom.x;
    const zdy = screenY - pos.zoom.y;
    if (zdx * zdx + zdy * zdy <= hitR * hitR) return 'zoom';
  }

  return null;
}

/** Check if a screen tap hit the fire button. */
export function isFireButtonHit(
  r: Renderer,
  screenX: number,
  screenY: number,
): boolean {
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);
  const btnX = screenW - 50;
  const btnY = screenH - 60;
  const btnRadius = 34; // slightly larger hit area
  const dx = screenX - btnX;
  const dy = screenY - btnY;
  return (dx * dx + dy * dy) <= btnRadius * btnRadius;
}

// ── Galaxy / System Rendering ─────────────────────────────────────────────

import type { GalaxyStar, SystemBody, GalaxyState, FeatureType } from './galaxy';
import { STAR_ENTER_RADIUS, BODY_ENTER_RADIUS, SYSTEM_EXIT_RADIUS, SYSTEM_SIZE, GALAXY_SIZE, FEATURE_LABELS } from './constants';

// ── Monochrome green palette (sci-fi terminal) ─────────────────────────────
const G_BRIGHT = '#4fffb0';        // primary bright green
const G_MED    = 'rgba(79, 255, 176, 0.6)';
const G_DIM    = 'rgba(79, 255, 176, 0.25)';
const G_FAINT  = 'rgba(79, 255, 176, 0.10)';
const JUMP_LINK_MAX = 18; // max world-distance for jump link lines

/** Draw a lens-flare starburst at screen coords */
function drawStarburst(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  coreR: number,
  rayLen: number,
  brightness: number, // 0-1
  palette: 'green' | 'blue' = 'green',
) {
  const a = 0.4 + brightness * 0.6;
  const cBright = palette === 'blue' ? '110, 190, 255' : '79, 255, 176';
  const cMid = palette === 'blue' ? '150, 215, 255' : '150, 255, 210';
  const cSoft = palette === 'blue' ? '30, 70, 120' : '30, 120, 80';
  const cBloom = palette === 'blue' ? '180, 220, 255' : '180, 255, 220';
  const cCore = palette === 'blue' ? '170, 220, 255' : '150, 255, 200';

  // ── 1. Wide soft green halo ──
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const haloR = rayLen * 2.2;
  const haloGrad = ctx.createRadialGradient(x, y, 0, x, y, haloR);
  haloGrad.addColorStop(0, `rgba(${cBright}, ${a * 0.18})`);
  haloGrad.addColorStop(0.25, `rgba(${cBright}, ${a * 0.08})`);
  haloGrad.addColorStop(0.6, `rgba(${cSoft}, ${a * 0.03})`);
  haloGrad.addColorStop(1, `rgba(${cBright}, 0)`);
  ctx.beginPath();
  ctx.arc(x, y, haloR, 0, Math.PI * 2);
  ctx.fillStyle = haloGrad;
  ctx.fill();
  ctx.restore();

  // ── 2. Diffraction spikes — many thin rays ──
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Primary cross (vertical + horizontal) — longest
  const spikes = [
    { angle: -Math.PI / 2, len: rayLen * 1.0, w: 0.8 },   // up
    { angle: Math.PI / 2,  len: rayLen * 1.0, w: 0.8 },   // down
    { angle: 0,            len: rayLen * 0.7, w: 0.6 },   // right
    { angle: Math.PI,      len: rayLen * 0.7, w: 0.6 },   // left
    // Secondary diagonals — shorter, thinner
    { angle: Math.PI / 4,       len: rayLen * 0.35, w: 0.4 },
    { angle: -Math.PI / 4,      len: rayLen * 0.35, w: 0.4 },
    { angle: Math.PI * 3 / 4,   len: rayLen * 0.35, w: 0.4 },
    { angle: -Math.PI * 3 / 4,  len: rayLen * 0.35, w: 0.4 },
    // Tertiary — very subtle accent spikes
    { angle: Math.PI / 6,        len: rayLen * 0.22, w: 0.25 },
    { angle: -Math.PI / 6,       len: rayLen * 0.22, w: 0.25 },
    { angle: Math.PI * 5 / 6,    len: rayLen * 0.22, w: 0.25 },
    { angle: -Math.PI * 5 / 6,   len: rayLen * 0.22, w: 0.25 },
  ];
  for (const spike of spikes) {
    const dx = Math.cos(spike.angle);
    const dy = Math.sin(spike.angle);
    const px = -dy;
    const py = dx;
    const halfW = spike.w;

    ctx.beginPath();
    ctx.moveTo(x + px * halfW, y + py * halfW);
    ctx.lineTo(x + dx * spike.len, y + dy * spike.len);
    ctx.lineTo(x - px * halfW, y - py * halfW);
    ctx.closePath();

    const grad = ctx.createLinearGradient(x, y, x + dx * spike.len, y + dy * spike.len);
    grad.addColorStop(0, `rgba(220, 255, 240, ${a * 0.8})`);
    grad.addColorStop(0.1, `rgba(${cMid}, ${a * 0.5})`);
    grad.addColorStop(0.4, `rgba(${cBright}, ${a * 0.15})`);
    grad.addColorStop(1, `rgba(${cBright}, 0)`);
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.restore();

  // ── 3. Core bloom (layered radial gradients for soft glow) ──
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Outer green bloom
  const bloomR = coreR * 3.0;
  const bloomGrad = ctx.createRadialGradient(x, y, 0, x, y, bloomR);
  bloomGrad.addColorStop(0, `rgba(${cBloom}, ${a * 0.6})`);
  bloomGrad.addColorStop(0.3, `rgba(${cBright}, ${a * 0.25})`);
  bloomGrad.addColorStop(0.7, `rgba(${cBright}, ${a * 0.05})`);
  bloomGrad.addColorStop(1, `rgba(${cBright}, 0)`);
  ctx.beginPath();
  ctx.arc(x, y, bloomR, 0, Math.PI * 2);
  ctx.fillStyle = bloomGrad;
  ctx.fill();
  ctx.restore();

  // ── 4. Hot white core ──
  ctx.save();
  const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR * 1.2);
  coreGrad.addColorStop(0, `rgba(255, 255, 255, ${a})`);
  coreGrad.addColorStop(0.4, `rgba(230, 255, 245, ${a * 0.9})`);
  coreGrad.addColorStop(0.8, `rgba(${cCore}, ${a * 0.4})`);
  coreGrad.addColorStop(1, `rgba(${cBright}, 0)`);
  ctx.beginPath();
  ctx.arc(x, y, coreR * 1.2, 0, Math.PI * 2);
  ctx.fillStyle = coreGrad;
  ctx.fill();
  ctx.restore();

  // ── 5. Bright center dot ──
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, coreR * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
  ctx.fill();
  ctx.restore();
}

export function drawGalaxyView(
  r: Renderer,
  camera: Camera,
  galaxy: GalaxyState,
  shipPos: Vec2,
  showLinks = true,
) {
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);
  const wpp = worldPerPixel(camera, screenH);
  const stars = galaxy.stars;

  // Pre-compute screen positions for visible stars
  const screenStars: { star: GalaxyStar; sx: number; sy: number }[] = [];
  for (const star of stars) {
    const sc = worldToScreen(star.pos, camera, screenW, screenH);
    if (sc.x < -40 || sc.x > screenW + 40 || sc.y < -40 || sc.y > screenH + 40) continue;
    screenStars.push({ star, sx: sc.x, sy: sc.y });
  }

  // ── Jump links (constellation lines between nearby stars) ──
  if (showLinks) {
    ctx.save();
    ctx.strokeStyle = G_DIM;
    ctx.lineWidth = 0.8;
    for (let i = 0; i < screenStars.length; i++) {
      const a = screenStars[i];
      for (let j = i + 1; j < screenStars.length; j++) {
        const b = screenStars[j];
        const dx = a.star.pos.x - b.star.pos.x;
        const dy = a.star.pos.y - b.star.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < JUMP_LINK_MAX) {
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // ── Stars (starburst effect) ──
  for (const { star, sx, sy } of screenStars) {
    const dist = Math.sqrt((star.pos.x - shipPos.x) ** 2 + (star.pos.y - shipPos.y) ** 2);
    const nearFactor = Math.max(0, 1 - dist / 30); // brighter when close
    const brightness = 0.5 + nearFactor * 0.5;
    const coreR = Math.max(2, 0.5 / wpp);
    const rayLen = Math.max(6, 1.2 / wpp);

    drawStarburst(
      ctx,
      sx,
      sy,
      coreR,
      rayLen,
      brightness,
      star.index === galaxy.homeStarIndex ? 'blue' : 'green',
    );

    // Name label (always show)
    ctx.save();
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = dist < 15 ? G_BRIGHT : G_MED;
    ctx.fillText(star.name, sx, sy + rayLen + 4);
    ctx.restore();
  }

  // ── Sector title (top-left) ──
  ctx.save();
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText('KORVUS SECTOR', 14, 14);
  ctx.font = '11px monospace';
  ctx.fillStyle = G_MED;
  ctx.fillText('LOCAL STAR MAP', 14, 34);
  ctx.restore();
}

/** Draw a panel border (corner brackets) */
function drawPanelBorder(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  cornerLen = 8,
) {
  ctx.strokeStyle = G_MED;
  ctx.lineWidth = 1;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x, y + h - cornerLen); ctx.lineTo(x, y + h); ctx.lineTo(x + cornerLen, y + h);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w - cornerLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cornerLen);
  ctx.stroke();
}

/** Trace a rounded rectangle path (compatible fallback for ctx.roundRect) */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** Draw a small icon for a planet feature */
function drawFeatureIcon(ctx: CanvasRenderingContext2D, x: number, y: number, type: FeatureType, size: number) {
  ctx.save();
  ctx.strokeStyle = G_BRIGHT;
  ctx.fillStyle = G_BRIGHT;
  ctx.lineWidth = 1.0;
  const s = size;

  switch (type) {
    case 'mine':
      // Pickaxe shape — angled line with head
      ctx.beginPath();
      ctx.moveTo(x - s, y + s * 0.8);
      ctx.lineTo(x + s * 0.3, y - s * 0.5);
      ctx.lineTo(x + s, y - s * 0.2);
      ctx.moveTo(x + s * 0.3, y - s * 0.5);
      ctx.lineTo(x + s * 0.5, y - s * 0.9);
      ctx.stroke();
      break;

    case 'relay':
      // Satellite dish — arc with line
      ctx.beginPath();
      ctx.moveTo(x, y + s);
      ctx.lineTo(x, y - s * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y - s * 0.3, s * 0.7, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();
      // Antenna
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.3);
      ctx.lineTo(x + s * 0.8, y - s);
      ctx.stroke();
      // Signal waves
      ctx.beginPath();
      ctx.arc(x + s * 0.8, y - s, s * 0.25, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'refinery':
      // Factory/building — rectangle with chimney stacks
      ctx.strokeRect(x - s, y - s * 0.3, s * 2, s * 1.3);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.5, y - s * 0.3);
      ctx.lineTo(x - s * 0.5, y - s);
      ctx.moveTo(x, y - s * 0.3);
      ctx.lineTo(x, y - s * 0.8);
      ctx.moveTo(x + s * 0.5, y - s * 0.3);
      ctx.lineTo(x + s * 0.5, y - s);
      ctx.stroke();
      break;

    case 'station':
      // Cross/station shape — like the reference Helios Station
      ctx.beginPath();
      // Horizontal bar
      ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
      // Vertical bar
      ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
      ctx.stroke();
      // Corner circles (docking ports)
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        ctx.beginPath();
        ctx.arc(x + dx * s, y + dy * s, s * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;

    case 'outpost':
      // Small building — triangle roof + box
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y + s * 0.6);
      ctx.lineTo(x + s * 0.7, y + s * 0.6);
      ctx.lineTo(x + s * 0.7, y - s * 0.2);
      ctx.lineTo(x, y - s);
      ctx.lineTo(x - s * 0.7, y - s * 0.2);
      ctx.closePath();
      ctx.stroke();
      break;

    case 'colony':
      // Dome shape
      ctx.beginPath();
      ctx.arc(x, y, s * 0.8, Math.PI, 0);
      ctx.lineTo(x + s * 0.8, y + s * 0.4);
      ctx.lineTo(x - s * 0.8, y + s * 0.4);
      ctx.closePath();
      ctx.stroke();
      // Window dots
      ctx.beginPath();
      ctx.arc(x - s * 0.3, y - s * 0.1, 1.5, 0, Math.PI * 2);
      ctx.arc(x + s * 0.3, y - s * 0.1, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}

export function drawSystemView(
  r: Renderer,
  camera: Camera,
  galaxy: GalaxyState,
  shipPos: Vec2,
) {
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);
  const wpp = worldPerPixel(camera, screenH);
  const center = SYSTEM_SIZE / 2;
  const bodies = galaxy.bodies;
  const star = galaxy.stars[galaxy.currentStarIndex];
  const starName = star ? star.name : '';

  const starSc = worldToScreen({ x: center, y: center }, camera, screenW, screenH);

  // ── 1. Orbital rings (faint ellipses for each body) ──
  ctx.save();
  ctx.strokeStyle = G_FAINT;
  ctx.lineWidth = 0.7;
  for (const body of bodies) {
    const orbitPx = body.orbitDist / wpp;
    if (orbitPx < 4) continue;
    ctx.beginPath();
    // Slight ellipse (0.55 vertical scale for perspective feel)
    ctx.ellipse(starSc.x, starSc.y, orbitPx, orbitPx * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // ── 2. Central star (starburst) ──
  const starRadPx = Math.max(8, 2.0 / wpp);
  drawStarburst(ctx, starSc.x, starSc.y, starRadPx, starRadPx * 3.5, 1.0);

  // Star name next to star
  ctx.save();
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(starName, starSc.x + starRadPx * 4, starSc.y);
  ctx.restore();

  // ── 3. Bodies (planets & belts) ──
  for (const body of bodies) {
    const sc = worldToScreen(body.pos, camera, screenW, screenH);
    const radPx = Math.max(4, body.radius / wpp);

    if (body.type === 'belt') {
      // Asteroid belt: scatter small circles along the orbit arc
      const rng = createRng(body.seed);
      const beltPx = body.orbitDist / wpp;
      const count = Math.min(80, Math.max(20, Math.floor(beltPx * 0.8)));
      ctx.save();
      ctx.fillStyle = G_DIM;
      for (let i = 0; i < count; i++) {
        const a = rng.range(0, Math.PI * 2);
        const dr = rng.range(-0.8, 0.8) / wpp; // scatter width in pixels
        const r = beltPx + dr;
        const bx = starSc.x + Math.cos(a) * r;
        const by = starSc.y + Math.sin(a) * r;
        const dotR = rng.range(1, 2.5);
        ctx.beginPath();
        ctx.arc(bx, by, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Belt name
      ctx.save();
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = G_MED;
      // Place label at top of belt arc
      const labelX = starSc.x;
      const labelY = starSc.y - beltPx * 0.55 - 4;
      ctx.fillText(body.name, labelX + 4, labelY);
      ctx.restore();
    } else {
      // Planet — outlined circle with surface detail
      ctx.save();
      // Dark fill
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, radPx, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 20, 10, 0.8)';
      ctx.fill();
      // Surface bands (horizontal lines for gas-giant feel)
      ctx.save();
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, radPx, 0, Math.PI * 2);
      ctx.clip();
      const bandRng = createRng(body.seed + 99);
      const bandCount = bandRng.rangeInt(2, 5);
      ctx.strokeStyle = G_DIM;
      ctx.lineWidth = 0.7;
      for (let b = 0; b < bandCount; b++) {
        const by = sc.y - radPx + (b + 1) * (radPx * 2) / (bandCount + 1);
        const bw = Math.sqrt(Math.max(0, radPx * radPx - (by - sc.y) * (by - sc.y)));
        ctx.beginPath();
        ctx.moveTo(sc.x - bw, by);
        ctx.quadraticCurveTo(sc.x, by + bandRng.range(-1, 1), sc.x + bw, by);
        ctx.stroke();
      }
      ctx.restore();
      // Outline
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, radPx, 0, Math.PI * 2);
      ctx.strokeStyle = G_BRIGHT;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Planetary ring (for some planets based on seed)
      if (body.seed % 5 === 0) {
        ctx.beginPath();
        ctx.ellipse(sc.x, sc.y, radPx * 1.8, radPx * 0.4, -0.2, 0, Math.PI * 2);
        ctx.strokeStyle = G_MED;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.restore();
      // Crosshair marker inside planet
      ctx.save();
      ctx.strokeStyle = G_DIM;
      ctx.lineWidth = 0.5;
      const ch = radPx * 0.5;
      ctx.beginPath();
      ctx.moveTo(sc.x - ch, sc.y); ctx.lineTo(sc.x + ch, sc.y);
      ctx.moveTo(sc.x, sc.y - ch); ctx.lineTo(sc.x, sc.y + ch);
      ctx.stroke();
      ctx.restore();
      // Planet name
      ctx.save();
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = G_BRIGHT;
      ctx.fillText(body.name, sc.x + radPx + 5, sc.y);
      ctx.restore();

      // Station icons orbiting this planet (small markers in system view)
      const stationFeats = body.features.filter(f => f.type === 'station');
      for (const feat of stationFeats) {
        const fDist = (radPx + 8); // offset in pixels from planet center
        const fx = sc.x + Math.cos(feat.angle) * fDist;
        const fy = sc.y + Math.sin(feat.angle) * fDist * 0.55; // match ellipse perspective
        drawFeatureIcon(ctx, fx, fy, 'station', 5);
      }
    }
  }

  // ── 4. System title panel (top-left) ──
  ctx.save();
  // Starburst icon
  drawStarburst(ctx, 24, 18, 3, 8, 0.8);
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(`${starName.toUpperCase()} SYSTEM`, 38, 12);
  ctx.font = '10px monospace';
  ctx.fillStyle = G_MED;
  ctx.fillText('LOCAL NAVIGATION', 38, 30);

  // System metadata
  const starClass = ['O5V', 'B3V', 'A2V', 'F8V', 'G2V', 'K1V', 'M4V'][(star?.seed ?? 0) % 7];
  const sysId = `${starName.substring(0, 2).toUpperCase()}-${((star?.seed ?? 0) % 9000 + 1000)}`;
  ctx.font = '9px monospace';
  ctx.fillStyle = G_DIM;
  ctx.fillText(`STAR CLASS: ${starClass}`, 14, 50);
  ctx.fillText(`SYSTEM ID: ${sysId}`, 14, 62);
  ctx.fillText(`BODIES: ${bodies.length}`, 14, 74);
  ctx.restore();

  // ── 5. Legend panel (bottom-left) ──
  const legX = 10;
  const legY = screenH - 104;
  const legW = 110;
  const legH = 94;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 10, 5, 0.7)';
  ctx.fillRect(legX, legY, legW, legH);
  drawPanelBorder(ctx, legX, legY, legW, legH);

  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = G_BRIGHT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('LEGEND', legX + 8, legY + 6);

  const items = [
    { label: 'STAR', draw: () => drawStarburst(ctx, legX + 16, legY + 24, 2, 5, 0.8) },
    { label: 'PLANET', draw: () => { ctx.beginPath(); ctx.arc(legX + 16, legY + 40, 4, 0, Math.PI * 2); ctx.strokeStyle = G_BRIGHT; ctx.lineWidth = 1; ctx.stroke(); } },
    { label: 'BELT', draw: () => { ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(legX + 12 + i * 3, legY + 54); ctx.arc(legX + 12 + i * 3, legY + 54, 1.2, 0, Math.PI * 2); } ctx.fillStyle = G_DIM; ctx.fill(); } },
  ];
  ctx.font = '9px monospace';
  ctx.fillStyle = G_MED;
  for (const item of items) {
    item.draw();
    ctx.fillStyle = G_MED;
  }
  ctx.textBaseline = 'middle';
  ctx.fillText('STAR', legX + 28, legY + 24);
  ctx.fillText('PLANET', legX + 28, legY + 40);
  ctx.fillText('BELT', legX + 28, legY + 54);
  ctx.fillText('ROUTE', legX + 28, legY + 68);
  // Route icon: dashed line
  ctx.beginPath();
  ctx.setLineDash([2, 2]);
  ctx.moveTo(legX + 10, legY + 68);
  ctx.lineTo(legX + 24, legY + 68);
  ctx.strokeStyle = G_MED;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── 6. System info panel (bottom-right) ──
  const infoW = 150;
  const infoH = 90;
  const infoX = screenW - infoW - 10;
  const infoY = screenH - infoH - 10;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 10, 5, 0.7)';
  ctx.fillRect(infoX, infoY, infoW, infoH);
  drawPanelBorder(ctx, infoX, infoY, infoW, infoH);

  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = G_BRIGHT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('SYSTEM INFO', infoX + 8, infoY + 6);

  ctx.font = '8px monospace';
  ctx.fillStyle = G_MED;
  const planets = bodies.filter(b => b.type === 'planet').length;
  const belts = bodies.filter(b => b.type === 'belt').length;
  const infoLines = [
    `${starName.toUpperCase()}`,
    `TYPE:         ${starClass}`,
    `PLANETS:      ${planets}`,
    `ASTEROID BELTS: ${belts}`,
    `BODIES:       ${bodies.length}`,
  ];
  for (let i = 0; i < infoLines.length; i++) {
    ctx.fillText(infoLines[i], infoX + 8, infoY + 20 + i * 12);
  }
  ctx.restore();
}

// ── Debug Bounds Overlay (System View) ───────────────────────────────────────

export function drawDebugBounds(
  r: Renderer,
  camera: Camera,
  galaxy: GalaxyState,
  shipPos: Vec2,
) {
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);
  const wpp = worldPerPixel(camera, screenH);
  const center = SYSTEM_SIZE / 2;
  const starSc = worldToScreen({ x: center, y: center }, camera, screenW, screenH);

  ctx.save();

  // ── System exit radius (outer boundary) ──
  const exitPx = SYSTEM_EXIT_RADIUS / wpp;
  ctx.beginPath();
  ctx.arc(starSc.x, starSc.y, exitPx, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 80, 80, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  // Label
  ctx.font = '9px monospace';
  ctx.fillStyle = 'rgba(255, 80, 80, 0.8)';
  ctx.textAlign = 'center';
  ctx.fillText(`EXIT r=${SYSTEM_EXIT_RADIUS}`, starSc.x, starSc.y - exitPx - 6);

  // ── Planet entry zones (BODY_ENTER_RADIUS circles around each planet) ──
  for (const body of galaxy.bodies) {
    if (body.type === 'belt') continue;
    const sc = worldToScreen(body.pos, camera, screenW, screenH);
    const radiusPx = BODY_ENTER_RADIUS / wpp;
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, radiusPx, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(80, 255, 180, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Label
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(80, 255, 180, 0.8)';
    ctx.textAlign = 'center';
    ctx.fillText(`ENTER r=${BODY_ENTER_RADIUS}`, sc.x, sc.y - radiusPx - 4);
  }

  // ── Belt entry zones (±tolerance rings around each belt orbit) ──
  const beltTolerance = 0.5;
  for (const body of galaxy.bodies) {
    if (body.type !== 'belt') continue;
    const innerPx = (body.orbitDist - beltTolerance) / wpp;
    const outerPx = (body.orbitDist + beltTolerance) / wpp;
    // Inner ring
    ctx.beginPath();
    ctx.arc(starSc.x, starSc.y, innerPx, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    // Outer ring
    ctx.beginPath();
    ctx.arc(starSc.x, starSc.y, outerPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Label
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(255, 200, 50, 0.8)';
    ctx.textAlign = 'center';
    ctx.fillText(`BELT ±${beltTolerance} (d=${body.orbitDist.toFixed(1)})`, starSc.x, starSc.y - outerPx - 4);
  }

  // ── Ship distance from center (debug readout) ──
  const dx = shipPos.x - center;
  const dy = shipPos.y - center;
  const shipDist = Math.sqrt(dx * dx + dy * dy);
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`SHIP dist=${shipDist.toFixed(2)}  pos=(${shipPos.x.toFixed(1)},${shipPos.y.toFixed(1)})`, 10, screenH - 20);

  ctx.restore();
}

// ── Planet Debug Bounds ──────────────────────────────────────────────────────

import { DOCK_TRIGGER_RADIUS, DOCK_FEATURE_RADIUS } from './dock';

export function drawPlanetDebugBounds(
  r: Renderer,
  camera: Camera,
  galaxy: GalaxyState,
  shipPos: Vec2,
  worldOffset: Vec2,
) {
  const { ctx } = r;
  const dpr = window.devicePixelRatio || 1;
  const screenW = r.width / dpr;
  const screenH = r.height / dpr;
  const wpp = worldPerPixel(camera, screenH);

  const body = galaxy.bodies[galaxy.currentBodyIndex];
  if (!body) return;

  ctx.save();
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1;

  // Planet dock radius
  const planetSc = worldToScreen(vec2(0, 0), camera, screenW, screenH);
  const planetDockPx = DOCK_TRIGGER_RADIUS / wpp;
  ctx.beginPath();
  ctx.arc(planetSc.x, planetSc.y, planetDockPx, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 200, 50, 0.6)';
  ctx.stroke();
  ctx.font = '7px monospace';
  ctx.fillStyle = 'rgba(255, 200, 50, 0.8)';
  ctx.textAlign = 'center';
  ctx.fillText('DOCK', planetSc.x, planetSc.y - planetDockPx - 3);

  // Feature dock radii
  for (const feat of body.features) {
    const fx = Math.cos(feat.angle) * feat.dist;
    const fy = Math.sin(feat.angle) * feat.dist;
    const fsc = worldToScreen(vec2(fx, fy), camera, screenW, screenH);
    const featDockPx = DOCK_FEATURE_RADIUS / wpp;
    ctx.beginPath();
    ctx.arc(fsc.x, fsc.y, featDockPx, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
    ctx.fillText(feat.name.split(' ').pop() || '', fsc.x, fsc.y - featDockPx - 3);
  }

  // Ship position readout (local + world-space used by transition logic)
  const worldShipPos = vec2(shipPos.x + worldOffset.x, shipPos.y + worldOffset.y);
  ctx.setLineDash([]);
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `SHIP local=(${shipPos.x.toFixed(2)},${shipPos.y.toFixed(2)}) world=(${worldShipPos.x.toFixed(2)},${worldShipPos.y.toFixed(2)})`,
    10,
    screenH - 20,
  );

  // Exit boundaries in local coordinates, matching:
  // |shipPos.x + worldOffset.x| > exitX  ||  |shipPos.y + worldOffset.y| > exitY
  const exitX = 4.5;
  const exitY = 2.8;
  const minX = -exitX - worldOffset.x;
  const maxX = exitX - worldOffset.x;
  const minY = -exitY - worldOffset.y;
  const maxY = exitY - worldOffset.y;

  const tlSc = worldToScreen(vec2(minX, maxY), camera, screenW, screenH);
  const brSc = worldToScreen(vec2(maxX, minY), camera, screenW, screenH);
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = 'rgba(255, 80, 80, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(tlSc.x, tlSc.y, brSc.x - tlSc.x, brSc.y - tlSc.y);
  ctx.setLineDash([]);
  ctx.font = '7px monospace';
  ctx.fillStyle = 'rgba(255, 80, 80, 0.7)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('EXIT BOUNDARY', screenW / 2, tlSc.y - 2);

  ctx.restore();
}

// ── Planet View ──────────────────────────────────────────────────────────────

export function drawPlanetView(
  r: Renderer,
  camera: Camera,
  galaxy: GalaxyState,
  shipPos: Vec2,
  fuelPercent: number,
  shieldPercent: number,
) {
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);
  const wpp = worldPerPixel(camera, screenH);

  const body = galaxy.bodies[galaxy.currentBodyIndex];
  if (!body) return;

  const star = galaxy.stars[galaxy.currentStarIndex];
  const starName = star ? star.name : '';

  // Planet is at world origin (0,0) in the planet view
  const planetWorldPos = vec2(0, 0);
  const sc = worldToScreen(planetWorldPos, camera, screenW, screenH);

  // Central planet (modest size — ~1/10 of screen)
  const planetRadPx = Math.max(4, 0.25 / wpp);
  const orbitRingPx = planetRadPx * 1.6;

  // ── 1. Dashed orbit ring ──
  ctx.save();
  ctx.beginPath();
  ctx.arc(sc.x, sc.y, orbitRingPx, 0, Math.PI * 2);
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = G_DIM;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── 2. Planet body ──
  ctx.save();
  // Dark fill
  ctx.beginPath();
  ctx.arc(sc.x, sc.y, planetRadPx, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 20, 10, 0.85)';
  ctx.fill();

  // Surface bands
  ctx.save();
  ctx.beginPath();
  ctx.arc(sc.x, sc.y, planetRadPx, 0, Math.PI * 2);
  ctx.clip();
  const bandRng = createRng(body.seed + 99);
  const bandCount = bandRng.rangeInt(3, 6);
  ctx.strokeStyle = G_MED;
  ctx.lineWidth = 1.0;
  for (let b = 0; b < bandCount; b++) {
    const by = sc.y - planetRadPx + (b + 1) * (planetRadPx * 2) / (bandCount + 1);
    const bw = Math.sqrt(Math.max(0, planetRadPx * planetRadPx - (by - sc.y) * (by - sc.y)));
    ctx.beginPath();
    ctx.moveTo(sc.x - bw * 0.9, by);
    ctx.quadraticCurveTo(sc.x, by + bandRng.range(-2, 2), sc.x + bw * 0.9, by);
    ctx.stroke();
  }
  ctx.restore();

  // Planet outline
  ctx.beginPath();
  ctx.arc(sc.x, sc.y, planetRadPx, 0, Math.PI * 2);
  ctx.strokeStyle = G_BRIGHT;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Planetary ring (for some planets)
  if (body.seed % 5 === 0) {
    ctx.beginPath();
    ctx.ellipse(sc.x, sc.y, planetRadPx * 1.8, planetRadPx * 0.35, -0.2, 0, Math.PI * 2);
    ctx.strokeStyle = G_MED;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.restore();

  // ── 3. Planet name above ──
  ctx.save();
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(body.name, sc.x, sc.y - orbitRingPx - 8);
  ctx.restore();

  // ── 4. "ORBIT FOR CONTACT" below ──
  ctx.save();
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = G_MED;
  ctx.fillText('ORBIT FOR CONTACT', sc.x, sc.y + orbitRingPx + 6);
  ctx.restore();

  // ── 5. Sub-features around the planet ──
  if (body.features && body.features.length > 0) {
    for (const feat of body.features) {
      // Place features at their actual world positions
      const featWorldPos = vec2(
        Math.cos(feat.angle) * feat.dist,
        Math.sin(feat.angle) * feat.dist,
      );
      const fsc = worldToScreen(featWorldPos, camera, screenW, screenH);
      const fx = fsc.x;
      const fy = fsc.y;

      // Dashed connection line from orbit ring edge to feature
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.moveTo(
        sc.x + Math.cos(feat.angle) * orbitRingPx,
        sc.y - Math.sin(feat.angle) * orbitRingPx,
      );
      ctx.lineTo(fx, fy);
      ctx.strokeStyle = G_DIM;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Feature icon
      drawFeatureIcon(ctx, fx, fy, feat.type, 10);

      // Feature name and type label
      ctx.save();
      const leftSide = feat.angle > Math.PI / 2 && feat.angle < Math.PI * 1.5;
      const nameOffset = leftSide ? -16 : 16;

      ctx.font = 'bold 9px monospace';
      ctx.textAlign = leftSide ? 'right' : 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = G_BRIGHT;
      ctx.fillText(feat.name, fx + nameOffset, fy - 4);

      ctx.font = '8px monospace';
      ctx.fillStyle = G_MED;
      ctx.textBaseline = 'top';
      ctx.fillText(FEATURE_LABELS[feat.type] || feat.type, fx + nameOffset, fy + 4);
      ctx.restore();
    }
  }

  // ── 6. Title panel (top-left) ──
  ctx.save();
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(body.name.toUpperCase(), 14, 12);
  ctx.font = '10px monospace';
  ctx.fillStyle = G_MED;
  ctx.fillText(`${starName.toUpperCase()} SYSTEM`, 14, 30);

  ctx.font = '9px monospace';
  ctx.fillStyle = G_DIM;
  ctx.fillText(`TYPE: TERRESTRIAL`, 14, 50);
  ctx.fillText(`FEATURES: ${body.features ? body.features.length : 0}`, 14, 62);
  ctx.fillText(`FUEL: ${Math.round(fuelPercent)}%`, 14, 74);
  ctx.fillText(`SHIELDS: ${Math.round(shieldPercent)}%`, 14, 86);
  ctx.restore();

  // ── 7. Feature legend (bottom-left) ──
  if (body.features && body.features.length > 0) {
    const legX = 10;
    const legH = 20 + body.features.length * 14;
    const legY = screenH - legH - 10;
    const legW = 140;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 10, 5, 0.7)';
    ctx.fillRect(legX, legY, legW, legH);
    drawPanelBorder(ctx, legX, legY, legW, legH);

    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = G_BRIGHT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('FEATURES', legX + 8, legY + 6);

    ctx.font = '8px monospace';
    ctx.fillStyle = G_MED;
    for (let i = 0; i < body.features.length; i++) {
      const feat = body.features[i];
      const label = FEATURE_LABELS[feat.type] || feat.type;
      drawFeatureIcon(ctx, legX + 16, legY + 22 + i * 14, feat.type, 5);
      ctx.fillStyle = G_MED;
      ctx.fillText(`${feat.name} - ${label}`, legX + 26, legY + 18 + i * 14);
    }
    ctx.restore();
  }

  // ── 8. Bottom-right stub panels ──
  drawPlanetPanels(ctx, screenW, screenH);
}

// ── Right-edge slide-out panels (planet view) ──────────────────────────────

interface StubPanel {
  title: string;
  icon: string;
  rows: string[];
}

const PLANET_PANELS: StubPanel[] = [
  {
    title: 'STATUS',
    icon: '\u25B3', // △
    rows: ['HULL: ████████░░ 82%', 'FUEL: ██████░░░░ 61%', 'CARGO: 3 / 12'],
  },
  {
    title: 'COMMS',
    icon: '\u25CE', // ◎
    rows: ['No signals detected', '── scan to discover ──'],
  },
  {
    title: 'NAV',
    icon: '\u2316', // ⌖
    rows: ['ORBIT: stable', 'VECTOR: holding'],
  },
];

// -1 = all closed, 0..2 = which panel is open
let _openPanel = -1;

// Layout constants
const TAB_W = 28;      // width of the vertical tab strip
const TAB_H = 72;      // height of each tab
const TAB_GAP = 6;
const PANEL_W = 170;   // width of the slide-out body
const ROW_H = 14;
const PANEL_PAD = 10;

export function togglePlanetPanel(index: number): void {
  _openPanel = _openPanel === index ? -1 : index;
}

/** Get the tab rects for hit testing */
function getPanelTabRects(screenH: number) {
  const totalH = PLANET_PANELS.length * TAB_H + (PLANET_PANELS.length - 1) * TAB_GAP;
  const startY = (screenH - totalH) / 2;
  return PLANET_PANELS.map((_, i) => ({
    y: startY + i * (TAB_H + TAB_GAP),
  }));
}

/**
 * Hit-test the planet panels. Returns:
 *  - tab index (>=0) if a tab was clicked (toggle it)
 *  - -2 if click is inside an open panel body (consume but don't toggle)
 *  - -1 if click is outside all panel areas (don't consume)
 */
export function hitTestPlanetPanels(
  screenW: number, screenH: number,
  sx: number, sy: number,
): number {
  const tabRects = getPanelTabRects(screenH);
  const tabX = screenW - TAB_W;

  // Check if click is on a tab
  for (let i = 0; i < tabRects.length; i++) {
    const ty = tabRects[i].y;
    if (sx >= tabX && sx <= screenW && sy >= ty && sy <= ty + TAB_H) {
      return i;
    }
  }

  // Check if click is inside the open panel body
  if (_openPanel >= 0) {
    const p = PLANET_PANELS[_openPanel];
    const bodyH = p.rows.length * ROW_H + PANEL_PAD * 2 + 20;
    const panelX = screenW - TAB_W - PANEL_W;
    const tabY = tabRects[_openPanel].y;
    const panelY = tabY;
    if (sx >= panelX && sx <= screenW - TAB_W && sy >= panelY && sy <= panelY + Math.max(bodyH, TAB_H)) {
      return -2; // inside panel body — consume click
    }
  }

  return -1;
}

function drawPlanetPanels(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
  const tabRects = getPanelTabRects(screenH);
  const tabX = screenW - TAB_W;

  ctx.save();

  for (let i = 0; i < PLANET_PANELS.length; i++) {
    const p = PLANET_PANELS[i];
    const ty = tabRects[i].y;
    const isOpen = _openPanel === i;

    // ── Tab (vertical, right edge) ──
    ctx.fillStyle = isOpen ? 'rgba(0, 30, 15, 0.9)' : 'rgba(0, 10, 5, 0.7)';
    roundedRect(ctx, tabX - 4, ty, TAB_W + 4, TAB_H, 4);
    ctx.fill();

    ctx.strokeStyle = isOpen ? G_BRIGHT : G_DIM;
    ctx.lineWidth = 1.5;
    roundedRect(ctx, tabX - 4, ty, TAB_W + 4, TAB_H, 4);
    ctx.stroke();

    // Icon at top of tab
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isOpen ? G_BRIGHT : G_MED;
    ctx.fillText(p.icon, tabX + TAB_W / 2, ty + 18);

    // Vertical title text
    ctx.save();
    ctx.translate(tabX + TAB_W / 2, ty + TAB_H / 2 + 8);
    ctx.rotate(-Math.PI / 2);
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isOpen ? G_BRIGHT : G_DIM;
    ctx.fillText(p.title, 0, 0);
    ctx.restore();

    // Arrow indicator
    ctx.font = '10px monospace';
    ctx.fillStyle = isOpen ? G_BRIGHT : G_DIM;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isOpen ? '\u203A' : '\u2039', tabX + TAB_W / 2, ty + TAB_H - 10);

    // ── Slide-out body (only when open) ──
    if (isOpen) {
      const bodyH = p.rows.length * ROW_H + PANEL_PAD * 2 + 22;
      const panelX = screenW - TAB_W - PANEL_W;
      const panelY = ty;
      const drawH = Math.max(bodyH, TAB_H);

      // Panel background
      ctx.fillStyle = 'rgba(0, 10, 5, 0.88)';
      roundedRect(ctx, panelX, panelY, PANEL_W, drawH, 4);
      ctx.fill();

      ctx.strokeStyle = G_BRIGHT;
      ctx.lineWidth = 1;
      roundedRect(ctx, panelX, panelY, PANEL_W, drawH, 4);
      ctx.stroke();

      // Panel title
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = G_BRIGHT;
      ctx.fillText(`${p.icon} ${p.title}`, panelX + PANEL_PAD, panelY + PANEL_PAD);

      // Separator line
      ctx.strokeStyle = G_DIM;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(panelX + PANEL_PAD, panelY + 22);
      ctx.lineTo(panelX + PANEL_W - PANEL_PAD, panelY + 22);
      ctx.stroke();

      // Rows
      ctx.font = '8px monospace';
      ctx.fillStyle = G_MED;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      for (let r = 0; r < p.rows.length; r++) {
        ctx.fillText(p.rows[r], panelX + PANEL_PAD, panelY + 28 + r * ROW_H);
      }
    }
  }

  ctx.restore();
}

/** Draw a tier indicator in the top-right */
export function drawTierHUD(
  r: Renderer,
  tierName: string,
  locationName: string,
  align: 'right' | 'center' = 'right',
) {
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const x = align === 'center' ? screenW / 2 : screenW - 12;

  ctx.save();
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(tierName, x, 12);
  if (locationName) {
    ctx.font = '11px monospace';
    ctx.fillStyle = G_MED;
    ctx.fillText(locationName, x, 28);
  }
  ctx.restore();
}

// ── Dock Panel ──────────────────────────────────────────────────────────────

import type { DockState } from './types';
import type { DockAction } from './dock';

interface DockButton {
  action: DockAction;
  label: string;
  icon: string; // unicode character
  x: number;
  y: number;
  w: number;
  h: number;
}

let _lastDockButtons: DockButton[] = [];

const DOCK_ACTIONS: { action: DockAction; label: string; icon: string }[] = [
  { action: 'contact', label: 'CONTACT', icon: '\u{1F4E1}' }, // 📡
  { action: 'trade',   label: 'TRADE',   icon: '\u{1F4E6}' }, // 📦
  { action: 'missions',label: 'MISSIONS',icon: '\u2605' },     // ★
  { action: 'leave',   label: 'LEAVE',   icon: '\u2191' },     // ↑
  { action: 'scan',    label: 'SCAN',    icon: '\u25CE' },     // ◎
];

export function drawDockPanel(
  r: Renderer,
  dock: DockState,
): void {
  const { ctx } = r;
  const dpr = window.devicePixelRatio || 1;
  const screenW = r.width / dpr;
  const screenH = r.height / dpr;

  // Panel dimensions
  const panelH = 110;
  const panelW = Math.min(screenW - 24, 400);
  const panelX = (screenW - panelW) / 2;
  const panelY = screenH - panelH - 12;

  // Panel background
  ctx.save();
  ctx.fillStyle = 'rgba(0, 10, 5, 0.92)';
  ctx.strokeStyle = G_BRIGHT;
  ctx.lineWidth = 1.5;
  roundedRect(ctx, panelX, panelY, panelW, panelH, 4);
  ctx.fill();
  ctx.stroke();

  // "ORBIT ESTABLISHED" header line
  const headerY = panelY + 16;
  const lineW = panelW * 0.25;
  ctx.strokeStyle = G_DIM;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(panelX + 12, headerY);
  ctx.lineTo(panelX + lineW, headerY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(panelX + panelW - lineW, headerY);
  ctx.lineTo(panelX + panelW - 12, headerY);
  ctx.stroke();

  const headerText = `ORBIT: ${dock.targetName.toUpperCase()}`;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(headerText, screenW / 2, headerY);

  // Action buttons
  const btnCount = DOCK_ACTIONS.length;
  const btnW = 56;
  const btnH = 52;
  const btnGap = 8;
  const totalBtnW = btnCount * btnW + (btnCount - 1) * btnGap;
  const btnStartX = (screenW - totalBtnW) / 2;
  const btnY = panelY + 28;

  _lastDockButtons = [];

  for (let i = 0; i < btnCount; i++) {
    const act = DOCK_ACTIONS[i];
    const bx = btnStartX + i * (btnW + btnGap);
    const by = btnY;

    _lastDockButtons.push({ ...act, x: bx, y: by, w: btnW, h: btnH });

    const isLeave = act.action === 'leave';
    const isStub = !dock.docked || (!isLeave && act.action !== 'scan');

    // Button border
    ctx.strokeStyle = isStub ? G_FAINT : G_BRIGHT;
    ctx.lineWidth = 1.5;
    roundedRect(ctx, bx, by, btnW, btnH, 3);
    ctx.stroke();

    // Icon
    ctx.font = '18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isStub ? G_FAINT : G_BRIGHT;
    ctx.fillText(act.icon, bx + btnW / 2, by + 20);

    // Label
    ctx.font = '8px monospace';
    ctx.fillStyle = isStub ? G_FAINT : G_MED;
    ctx.fillText(act.label, bx + btnW / 2, by + btnH - 8);
  }

  // Status text
  const statusText = dock.docked
    ? `You are in a stable orbit around ${dock.targetName}.`
    : `Approaching ${dock.targetName}...`;
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = G_DIM;
  ctx.fillText(statusText, screenW / 2, panelY + panelH - 18);

  ctx.restore();
}

/** Hit-test dock panel buttons. Returns the action if a button was clicked, null otherwise. */
export function hitTestDockPanel(screenPos: Vec2): DockAction | null {
  for (const btn of _lastDockButtons) {
    if (
      screenPos.x >= btn.x && screenPos.x <= btn.x + btn.w &&
      screenPos.y >= btn.y && screenPos.y <= btn.y + btn.h
    ) {
      return btn.action;
    }
  }
  return null;
}
