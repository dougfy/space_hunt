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
import { vec2, add, sub, normalize, magnitude, scale } from './math';
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
