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
import { getShipShapePoints, getShipDetailElements } from './ship';
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
  const firstPoint = points[0];
  if (!firstPoint) return;
  const p0 = worldToScreen(firstPoint, camera, screenW, screenH);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    if (!point) continue;
    const p = worldToScreen(point, camera, screenW, screenH);
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
  const firstWorldPoint = worldPts[0];
  if (!firstWorldPoint) return;
  worldPts.push({ x: firstWorldPoint.x, y: firstWorldPoint.y });

  drawPolyline(r, camera, worldPts, color, lineWidth, false);

  // Draw internal detail elements
  const details = getShipDetailElements(shape);
  const detailLineWidth = lineWidth * 0.7;
  for (const d of details) {
    if (d.type === 'circle') {
      const center: Vec2 = {
        x: pos.x + right.x * (d.center.x * size) + forward.x * (d.center.y * size),
        y: pos.y + right.y * (d.center.x * size) + forward.y * (d.center.y * size),
      };
      drawCircle(r, camera, center, d.radius * size, color, detailLineWidth);
    } else {
      const from: Vec2 = {
        x: pos.x + right.x * (d.from.x * size) + forward.x * (d.from.y * size),
        y: pos.y + right.y * (d.from.x * size) + forward.y * (d.from.y * size),
      };
      const to: Vec2 = {
        x: pos.x + right.x * (d.to.x * size) + forward.x * (d.to.y * size),
        y: pos.y + right.y * (d.to.x * size) + forward.y * (d.to.y * size),
      };
      drawLine(r, camera, from, to, color, detailLineWidth);
    }
  }
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
    const point = asteroid.pts[i];
    if (!point) continue;
    points.push(add(asteroid.pos, point));
  }
  const firstPoint = asteroid.pts[0];
  if (firstPoint) {
    points.push(add(asteroid.pos, firstPoint));
  }
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
  const color = GHOST_PALETTE[Math.abs(slot - 1) % GHOST_PALETTE.length] ?? G_BRIGHT;
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
  ctx.fillStyle = GHOST_PALETTE[Math.abs(slot - 1) % GHOST_PALETTE.length] ?? G_BRIGHT;
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
  SHOT_COLOR_OWN, SHOT_COLOR_ENEMY,
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

import type { GalaxyStar, GalaxyState, FeatureType, PlanetFeature, SystemBody } from './galaxy';
import { buildGalaxyViewModel, getGalaxyStarTone } from './galaxy-view-model';
import { getEnabledResources, getFeatureResourceIds, getFeatureResourceNames } from './economy-catalog';
import { BODY_ENTER_RADIUS, SYSTEM_EXIT_RADIUS, SYSTEM_SIZE, FEATURE_LABELS } from './constants';

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
  palette: 'green' | 'blue' | 'white' | 'red' | 'orange' = 'green',
  cardinalBoost = 1,
) {
  const a = 0.4 + brightness * 0.6;
  const cBright = palette === 'blue'
    ? '110, 190, 255'
    : palette === 'white'
      ? '245, 250, 255'
      : palette === 'red'
        ? '255, 100, 80'
        : palette === 'orange'
          ? '255, 180, 60'
          : '79, 255, 176';
  const cMid = palette === 'blue'
    ? '150, 215, 255'
    : palette === 'white'
      ? '220, 235, 250'
      : palette === 'red'
        ? '255, 150, 130'
        : palette === 'orange'
          ? '255, 200, 120'
          : '150, 255, 210';
  const cSoft = palette === 'blue'
    ? '30, 70, 120'
    : palette === 'white'
      ? '80, 95, 115'
      : palette === 'red'
        ? '120, 30, 20'
        : palette === 'orange'
          ? '120, 70, 10'
          : '30, 120, 80';
  const cBloom = palette === 'blue'
    ? '180, 220, 255'
    : palette === 'white'
      ? '238, 246, 255'
      : palette === 'red'
        ? '255, 180, 160'
        : palette === 'orange'
          ? '255, 220, 150'
          : '180, 255, 220';
  const cCore = palette === 'blue'
    ? '170, 220, 255'
    : palette === 'white'
      ? '245, 250, 255'
      : palette === 'red'
        ? '255, 160, 140'
        : palette === 'orange'
          ? '255, 210, 120'
          : '150, 255, 200';

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
  const boost = Math.max(1, cardinalBoost);
  const spikes = [
    { angle: -Math.PI / 2, len: rayLen * 1.0 * boost, w: 0.8 },   // up
    { angle: Math.PI / 2,  len: rayLen * 1.0 * boost, w: 0.8 },   // down
    { angle: 0,            len: rayLen * 0.7 * boost, w: 0.6 },   // right
    { angle: Math.PI,      len: rayLen * 0.7 * boost, w: 0.6 },   // left
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

// ── Fleet Transfer Mode ──────────────────────────────────────────────────────
type TransferMode = {
  fromStarIndex: number;
  shipTypeId: number;
} | null;

let _transferMode: TransferMode = null;
let _lastScreenStars: Array<{ starIndex: number; sx: number; sy: number }> = [];
let _pendingTransfer: { fromStarIndex: number; toStarIndex: number; shipTypeId: number; count: number } | null = null;
let _transferCancelButton: { x: number; y: number; w: number; h: number } | null = null;

/** Enter transfer mode (called from fleet panel SEND button). */
export function enterTransferMode(fromStarIndex: number, shipTypeId: number): void {
  _transferMode = { fromStarIndex, shipTypeId };
}

/** Cancel transfer mode. */
export function cancelTransferMode(): void {
  _transferMode = null;
}

/** Check if in transfer mode. */
export function isInTransferMode(): boolean {
  return _transferMode !== null;
}

/** Hit-test galaxy stars for transfer target. Returns starIndex or -1. */
export function hitTestGalaxyStar(sx: number, sy: number, radius = 18): number {
  for (const s of _lastScreenStars) {
    const dx = sx - s.sx;
    const dy = sy - s.sy;
    if (dx * dx + dy * dy < radius * radius) {
      return s.starIndex;
    }
  }
  return -1;
}

/** Complete a transfer selection — sets pending transfer and exits transfer mode. */
export function completeTransferSelection(toStarIndex: number): void {
  if (!_transferMode) return;
  if (toStarIndex === _transferMode.fromStarIndex) return; // can't send to same star
  _pendingTransfer = {
    fromStarIndex: _transferMode.fromStarIndex,
    toStarIndex,
    shipTypeId: _transferMode.shipTypeId,
    count: 1,
  };
  _transferMode = null;
}

/** Consume pending transfer request (called by client polling). */
export function consumePendingTransfer(): { fromStarIndex: number; toStarIndex: number; shipTypeId: number; count: number } | null {
  const t = _pendingTransfer;
  _pendingTransfer = null;
  return t;
}

/** Hit-test the transfer cancel button. Returns true if hit. */
export function hitTestTransferCancel(sx: number, sy: number): boolean {
  if (!_transferCancelButton) return false;
  const b = _transferCancelButton;
  return sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h;
}

export function drawGalaxyView(
  r: Renderer,
  camera: Camera,
  galaxy: GalaxyState,
  shipPos: Vec2,
  showLinks = true,
  showNames = true,
) {
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);
  const wpp = worldPerPixel(camera, screenH);
  const galaxyView = buildGalaxyViewModel(galaxy);

  // Pre-compute screen positions for visible stars
  const screenStars: { star: GalaxyStar; tone: 'blue' | 'green' | 'white' | 'red' | 'orange'; sx: number; sy: number }[] = [];
  for (const starView of galaxyView.stars) {
    const star = galaxy.stars[starView.index];
    if (!star) continue;
    const sc = worldToScreen(star.pos, camera, screenW, screenH);
    if (sc.x < -40 || sc.x > screenW + 40 || sc.y < -40 || sc.y > screenH + 40) continue;
    screenStars.push({ star, tone: starView.tone, sx: sc.x, sy: sc.y });
  }

  // Cache for hit testing
  _lastScreenStars = screenStars.map(s => ({ starIndex: s.star.index, sx: s.sx, sy: s.sy }));

  // ── Jump links (constellation lines between nearby stars) ──
  if (showLinks) {
    ctx.save();
    ctx.strokeStyle = G_DIM;
    ctx.lineWidth = 0.8;
    for (let i = 0; i < screenStars.length; i++) {
      const a = screenStars[i];
      if (!a) continue;
      for (let j = i + 1; j < screenStars.length; j++) {
        const b = screenStars[j];
        if (!b) continue;
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
  for (const { star, tone, sx, sy } of screenStars) {
    const dist = Math.sqrt((star.pos.x - shipPos.x) ** 2 + (star.pos.y - shipPos.y) ** 2);
    const nearFactor = Math.max(0, 1 - dist / 30); // brighter when close
    const brightness = 0.5 + nearFactor * 0.5;
    const coreR = Math.max(2, 0.5 / wpp);
    const rayLen = Math.max(6, 1.2 / wpp);
    const cardinalBoost = star.index === galaxy.homeStarIndex ? 1.15 : 1;

    drawStarburst(
      ctx,
      sx,
      sy,
      coreR,
      rayLen,
      brightness,
      tone,
      cardinalBoost,
    );

    if (showNames) {
      ctx.save();
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      if (tone === 'blue') {
        ctx.fillStyle = dist < 15 ? 'rgb(165, 220, 255)' : 'rgba(120, 185, 245, 0.85)';
      } else if (tone === 'white') {
        ctx.fillStyle = dist < 15 ? 'rgb(240, 248, 255)' : 'rgba(210, 225, 240, 0.85)';
      } else if (tone === 'red') {
        ctx.fillStyle = dist < 15 ? 'rgb(255, 130, 110)' : 'rgba(255, 100, 80, 0.85)';
      } else if (tone === 'orange') {
        ctx.fillStyle = dist < 15 ? 'rgb(255, 200, 100)' : 'rgba(255, 180, 60, 0.85)';
      } else {
        ctx.fillStyle = dist < 15 ? G_BRIGHT : G_MED;
      }
      ctx.fillText(star.name, sx, sy + rayLen + 4);
      ctx.restore();
    }
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

  // ── Transfer mode indicator ──
  if (_transferMode) {
    const fromEntry = SHIP_CATALOG[_transferMode.shipTypeId as keyof typeof SHIP_CATALOG];
    const shipName = fromEntry?.name ?? 'Ship';

    // Draw pulsing rings around all valid target stars
    const t = performance.now() * 0.003;
    const pulse = 0.5 + 0.5 * Math.sin(t);
    for (const s of screenStars) {
      if (s.star.index === _transferMode.fromStarIndex) continue;
      ctx.save();
      ctx.strokeStyle = `rgba(79, 255, 176, ${0.2 + pulse * 0.3})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.sx, s.sy, 14 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Highlight source star
    const srcStar = screenStars.find(s => s.star.index === _transferMode!.fromStarIndex);
    if (srcStar) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 200, 80, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(srcStar.sx, srcStar.sy, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Banner at top
    ctx.save();
    ctx.fillStyle = 'rgba(0, 10, 5, 0.85)';
    const bannerH = 24;
    ctx.fillRect(0, screenH - bannerH - 4, screenW, bannerH + 4);
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = G_BRIGHT;
    ctx.fillText(`SENDING ${shipName.toUpperCase()} — TAP DESTINATION STAR`, screenW / 2, screenH - bannerH / 2 - 2);

    // Cancel button
    const cancelW = 60;
    const cancelX = screenW - cancelW - 12;
    const cancelY = screenH - bannerH - 2;
    ctx.strokeStyle = 'rgba(255, 100, 80, 0.8)';
    ctx.lineWidth = 1;
    roundedRect(ctx, cancelX, cancelY, cancelW, 18, 3);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 100, 80, 0.9)';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('CANCEL', cancelX + cancelW / 2, cancelY + 9);
    ctx.restore();

    // Store cancel button rect for hit testing
    _transferCancelButton = { x: cancelX, y: cancelY, w: cancelW, h: 18 };
  } else {
    _transferCancelButton = null;
  }
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
function drawFeatureIcon(ctx: CanvasRenderingContext2D, x: number, y: number, type: FeatureType, size: number, level?: number) {
  ctx.save();
  ctx.strokeStyle = G_BRIGHT;
  ctx.fillStyle = G_BRIGHT;
  ctx.lineWidth = 1.0;
  const s = size;
  const lv = level ?? 1;

  switch (type) {
    case 'mine':
    case 'mine_l2': {
      if (lv <= 2) {
        // Pickaxe / headframe tower
        ctx.beginPath();
        ctx.moveTo(x, y + s); ctx.lineTo(x, y - s);
        ctx.moveTo(x - s * 0.7, y + s); ctx.lineTo(x, y - s);
        ctx.moveTo(x + s * 0.7, y + s); ctx.lineTo(x, y - s);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y - s, s * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.8, y + s); ctx.lineTo(x + s * 0.8, y + s);
        ctx.stroke();
      } else if (lv <= 5) {
        // Twin-braced tower with cross braces + secondary shaft
        ctx.beginPath();
        ctx.moveTo(x, y + s); ctx.lineTo(x, y - s);
        ctx.moveTo(x - s * 0.7, y + s); ctx.lineTo(x, y - s);
        ctx.moveTo(x + s * 0.7, y + s); ctx.lineTo(x, y - s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.35, y + s * 0.2); ctx.lineTo(x + s * 0.35, y + s * 0.2);
        ctx.moveTo(x - s * 0.2, y - s * 0.3); ctx.lineTo(x + s * 0.2, y - s * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y - s, s * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        // Secondary tower
        ctx.beginPath();
        ctx.moveTo(x + s * 0.8, y + s); ctx.lineTo(x + s * 0.8, y - s * 0.3);
        ctx.moveTo(x + s * 0.5, y + s); ctx.lineTo(x + s * 0.8, y - s * 0.3);
        ctx.moveTo(x + s * 1.1, y + s); ctx.lineTo(x + s * 0.8, y - s * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s, y + s); ctx.lineTo(x + s * 1.2, y + s);
        ctx.stroke();
      } else {
        // Massive core bore rig — full industrial complex
        ctx.beginPath();
        ctx.moveTo(x, y + s); ctx.lineTo(x, y - s);
        ctx.moveTo(x - s * 0.7, y + s); ctx.lineTo(x, y - s);
        ctx.moveTo(x + s * 0.7, y + s); ctx.lineTo(x, y - s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.35, y + s * 0.3); ctx.lineTo(x + s * 0.35, y + s * 0.3);
        ctx.moveTo(x - s * 0.2, y - s * 0.2); ctx.lineTo(x + s * 0.2, y - s * 0.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y - s, s * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        // Drill arms extending outward
        ctx.beginPath();
        ctx.moveTo(x - s * 0.5, y - s * 0.3); ctx.lineTo(x - s * 1.2, y - s * 0.8);
        ctx.moveTo(x + s * 0.5, y - s * 0.3); ctx.lineTo(x + s * 1.2, y - s * 0.8);
        ctx.stroke();
        // Sub-shafts
        ctx.beginPath();
        ctx.moveTo(x - s * 0.3, y + s); ctx.lineTo(x - s * 0.3, y + s * 0.4);
        ctx.moveTo(x + s * 0.3, y + s); ctx.lineTo(x + s * 0.3, y + s * 0.4);
        ctx.moveTo(x - s * 0.3, y + s * 0.4); ctx.lineTo(x + s * 0.3, y + s * 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 1.1, y + s); ctx.lineTo(x + s * 1.1, y + s);
        ctx.stroke();
      }
      break;
    }

    case 'relay':
      ctx.beginPath();
      ctx.moveTo(x, y + s);
      ctx.lineTo(x, y - s * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y - s * 0.3, s * 0.7, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.3);
      ctx.lineTo(x + s * 0.8, y - s);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + s * 0.8, y - s, s * 0.25, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'refinery':
      ctx.strokeRect(x - s, y - s * 0.3, s * 2, s * 1.3);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.5, y - s * 0.3); ctx.lineTo(x - s * 0.5, y - s);
      ctx.moveTo(x, y - s * 0.3); ctx.lineTo(x, y - s * 0.8);
      ctx.moveTo(x + s * 0.5, y - s * 0.3); ctx.lineTo(x + s * 0.5, y - s);
      ctx.stroke();
      break;

    case 'station': {
      if (lv <= 2) {
        // Simple cross with docking ports
        ctx.beginPath();
        ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
        ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
        ctx.stroke();
        const portOffsets: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dx, dy] of portOffsets) {
          ctx.beginPath();
          ctx.arc(x + dx * s, y + dy * s, s * 0.25, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (lv <= 5) {
        // Central hub with rectangular docking modules
        ctx.beginPath();
        ctx.arc(x, y, s * 0.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8);
        ctx.stroke();
        // 4 truss arms with module boxes
        ctx.beginPath();
        ctx.moveTo(x - s * 0.4, y); ctx.lineTo(x - s, y);
        ctx.moveTo(x + s * 0.4, y); ctx.lineTo(x + s, y);
        ctx.moveTo(x, y - s * 0.4); ctx.lineTo(x, y - s);
        ctx.moveTo(x, y + s * 0.4); ctx.lineTo(x, y + s);
        ctx.stroke();
        // Module rectangles at ends
        ctx.beginPath();
        ctx.rect(x - s * 1.2, y - s * 0.25, s * 0.3, s * 0.5);
        ctx.rect(x + s * 0.9, y - s * 0.25, s * 0.3, s * 0.5);
        ctx.rect(x - s * 0.25, y - s * 1.2, s * 0.5, s * 0.3);
        ctx.rect(x - s * 0.25, y + s * 0.9, s * 0.5, s * 0.3);
        ctx.stroke();
      } else {
        // Capital command nexus — concentric rings with radial arms
        ctx.beginPath();
        ctx.arc(x, y, s * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        // 8 radial arms
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * s * 0.2, y + Math.sin(a) * s * 0.2);
          ctx.lineTo(x + Math.cos(a) * s * 0.9, y + Math.sin(a) * s * 0.9);
          ctx.stroke();
        }
        // Module boxes at cardinal points
        const cardinals = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
        for (const a of cardinals) {
          const mx = x + Math.cos(a) * s;
          const my = y + Math.sin(a) * s;
          ctx.beginPath();
          ctx.rect(mx - s * 0.15, my - s * 0.15, s * 0.3, s * 0.3);
          ctx.stroke();
        }
      }
      break;
    }

    case 'outpost':
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y + s * 0.6);
      ctx.lineTo(x + s * 0.7, y + s * 0.6);
      ctx.lineTo(x + s * 0.7, y - s * 0.2);
      ctx.lineTo(x, y - s);
      ctx.lineTo(x - s * 0.7, y - s * 0.2);
      ctx.closePath();
      ctx.stroke();
      break;

    case 'colony': {
      if (lv <= 2) {
        // Small dome with windows
        ctx.beginPath();
        ctx.arc(x, y, s * 0.8, Math.PI, 0);
        ctx.lineTo(x + s * 0.8, y + s * 0.4);
        ctx.lineTo(x - s * 0.8, y + s * 0.4);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - s * 0.3, y - s * 0.1, 1.5, 0, Math.PI * 2);
        ctx.arc(x + s * 0.3, y - s * 0.1, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (lv <= 5) {
        // Main dome plus annex dome
        ctx.beginPath();
        ctx.arc(x - s * 0.2, y, s * 0.7, Math.PI, 0);
        ctx.lineTo(x + s * 0.5, y + s * 0.4);
        ctx.lineTo(x - s * 0.9, y + s * 0.4);
        ctx.closePath();
        ctx.stroke();
        // Annex dome
        ctx.beginPath();
        ctx.arc(x + s * 0.7, y + s * 0.1, s * 0.4, Math.PI, 0);
        ctx.lineTo(x + s * 1.1, y + s * 0.4);
        ctx.lineTo(x + s * 0.3, y + s * 0.4);
        ctx.closePath();
        ctx.stroke();
        // Corridor connection
        ctx.beginPath();
        ctx.moveTo(x + s * 0.3, y + s * 0.2); ctx.lineTo(x + s * 0.5, y + s * 0.2);
        ctx.moveTo(x + s * 0.3, y + s * 0.35); ctx.lineTo(x + s * 0.5, y + s * 0.35);
        ctx.stroke();
        // Base
        ctx.beginPath();
        ctx.moveTo(x - s * 1.0, y + s * 0.4); ctx.lineTo(x + s * 1.2, y + s * 0.4);
        ctx.stroke();
      } else {
        // Arcology — dome plus tower with multiple levels
        ctx.beginPath();
        ctx.arc(x - s * 0.3, y + s * 0.1, s * 0.55, Math.PI, 0);
        ctx.lineTo(x + s * 0.25, y + s * 0.5);
        ctx.lineTo(x - s * 0.85, y + s * 0.5);
        ctx.closePath();
        ctx.stroke();
        // Tower
        ctx.beginPath();
        ctx.rect(x + s * 0.4, y - s * 0.8, s * 0.5, s * 1.3);
        ctx.stroke();
        // Tower floor lines
        for (let i = 0; i < 4; i++) {
          const ty = y - s * 0.5 + i * s * 0.35;
          ctx.beginPath();
          ctx.moveTo(x + s * 0.4, ty); ctx.lineTo(x + s * 0.9, ty);
          ctx.stroke();
        }
        // Base platform
        ctx.beginPath();
        ctx.moveTo(x - s * 1.0, y + s * 0.5); ctx.lineTo(x + s * 1.1, y + s * 0.5);
        ctx.stroke();
      }
      break;
    }

    case 'solar_array':
    case 'solar_array_l2': {
      if (lv <= 2) {
        // Two-wing panel array
        ctx.beginPath();
        ctx.rect(x - s * 0.25, y - s * 0.25, s * 0.5, s * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.12, 0, Math.PI * 2);
        ctx.stroke();
        // Horizontal truss
        ctx.beginPath();
        ctx.moveTo(x - s * 0.25, y); ctx.lineTo(x - s * 0.9, y);
        ctx.moveTo(x + s * 0.25, y); ctx.lineTo(x + s * 0.9, y);
        ctx.stroke();
        // Left panel
        ctx.beginPath();
        ctx.rect(x - s * 0.9, y - s * 0.45, s * 0.65, s * 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.58, y - s * 0.45); ctx.lineTo(x - s * 0.58, y + s * 0.45);
        ctx.stroke();
        // Right panel
        ctx.beginPath();
        ctx.rect(x + s * 0.25, y - s * 0.45, s * 0.65, s * 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + s * 0.58, y - s * 0.45); ctx.lineTo(x + s * 0.58, y + s * 0.45);
        ctx.stroke();
      } else if (lv <= 5) {
        // Four-wing panel array with grid subdivisions
        ctx.beginPath();
        ctx.rect(x - s * 0.25, y - s * 0.25, s * 0.5, s * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.12, 0, Math.PI * 2);
        ctx.stroke();
        // 4 truss arms
        ctx.beginPath();
        ctx.moveTo(x - s * 0.25, y); ctx.lineTo(x - s * 0.9, y);
        ctx.moveTo(x + s * 0.25, y); ctx.lineTo(x + s * 0.9, y);
        ctx.moveTo(x, y - s * 0.25); ctx.lineTo(x, y - s * 0.9);
        ctx.moveTo(x, y + s * 0.25); ctx.lineTo(x, y + s * 0.9);
        ctx.stroke();
        // 4 panel rectangles with grid
        const panels: Array<[number, number, number, number]> = [
          [x - s * 0.9, y - s * 0.4, s * 0.65, s * 0.8],
          [x + s * 0.25, y - s * 0.4, s * 0.65, s * 0.8],
          [x - s * 0.4, y - s * 0.9, s * 0.8, s * 0.65],
          [x - s * 0.4, y + s * 0.25, s * 0.8, s * 0.65],
        ];
        for (const [px, py, pw, ph] of panels) {
          ctx.beginPath();
          ctx.rect(px, py, pw, ph);
          ctx.stroke();
        }
      } else {
        // Collector ring — hub with halo ring and radial panels
        ctx.beginPath();
        ctx.arc(x, y, s * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        // Panels at cardinal + diagonal points on ring
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const px = x + Math.cos(a) * s * 0.7;
          const py = y + Math.sin(a) * s * 0.7;
          ctx.beginPath();
          ctx.rect(px - s * 0.12, py - s * 0.12, s * 0.24, s * 0.24);
          ctx.stroke();
        }
        // Truss lines from hub to ring
        ctx.beginPath();
        ctx.moveTo(x - s * 0.2, y); ctx.lineTo(x - s * 0.7, y);
        ctx.moveTo(x + s * 0.2, y); ctx.lineTo(x + s * 0.7, y);
        ctx.moveTo(x, y - s * 0.2); ctx.lineTo(x, y - s * 0.7);
        ctx.moveTo(x, y + s * 0.2); ctx.lineTo(x, y + s * 0.7);
        ctx.stroke();
      }
      break;
    }
    case 'warehouse': {
      // Crate/box icon
      ctx.beginPath();
      ctx.rect(x - s * 0.7, y - s * 0.5, s * 1.4, s * 1.0);
      ctx.stroke();
      // Horizontal divider
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y); ctx.lineTo(x + s * 0.7, y);
      ctx.stroke();
      // Vertical divider
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x, y + s * 0.5);
      ctx.stroke();
      if (lv >= 3) {
        // Stacked second crate
        ctx.beginPath();
        ctx.rect(x - s * 0.5, y - s * 0.9, s * 1.0, s * 0.4);
        ctx.stroke();
      }
      break;
    }
    case 'dock': {
      // Dock gantry / shipyard frame
      ctx.beginPath();
      // Main frame
      ctx.rect(x - s * 0.8, y - s * 0.6, s * 1.6, s * 1.2);
      ctx.stroke();
      // Inner bay opening
      ctx.beginPath();
      ctx.rect(x - s * 0.5, y - s * 0.3, s * 1.0, s * 0.6);
      ctx.stroke();
      // Gantry arms
      ctx.beginPath();
      ctx.moveTo(x - s * 0.8, y - s * 0.6); ctx.lineTo(x - s * 1.1, y - s * 1.0);
      ctx.moveTo(x + s * 0.8, y - s * 0.6); ctx.lineTo(x + s * 1.1, y - s * 1.0);
      ctx.stroke();
      if (lv >= 3) {
        // Second bay
        ctx.beginPath();
        ctx.rect(x - s * 0.5, y + s * 0.4, s * 1.0, s * 0.5);
        ctx.stroke();
      }
      if (lv >= 5) {
        // Third bay / massive structure
        ctx.beginPath();
        ctx.rect(x - s * 0.5, y - s * 1.0, s * 1.0, s * 0.4);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

export function drawSystemView(
  r: Renderer,
  camera: Camera,
  galaxy: GalaxyState,
  _shipPos: Vec2,
) {
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);
  const wpp = worldPerPixel(camera, screenH);
  const center = SYSTEM_SIZE / 2;
  const bodies = galaxy.bodies;
  const star = galaxy.stars[galaxy.currentStarIndex];
  const starName = star ? star.name : '';
  const starTone = star ? getGalaxyStarTone(star, galaxy.homeStarIndex) : 'green';
  const starCardinalBoost = star && star.index === galaxy.homeStarIndex ? 1.15 : 1;

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
  drawStarburst(ctx, starSc.x, starSc.y, starRadPx, starRadPx * 3.5, 1.0, starTone, starCardinalBoost);

  // Star name next to star
  ctx.save();
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  if (starTone === 'blue') {
    ctx.fillStyle = 'rgb(165, 220, 255)';
  } else if (starTone === 'white') {
    ctx.fillStyle = 'rgb(240, 248, 255)';
  } else {
    ctx.fillStyle = G_BRIGHT;
  }
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
    const line = infoLines[i];
    if (!line) continue;
    ctx.fillText(line, infoX + 8, infoY + 20 + i * 12);
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

  const features = getEffectiveFeatures(body, galaxy.currentStarIndex);

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
  for (const feat of features) {
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

  ctx.setLineDash([]);

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

/** Build an effective feature list by merging static features with server-built extensions. */
function getEffectiveFeatures(body: SystemBody, starIndex: number): PlanetFeature[] {
  const serverEcon = _serverEconomyByStarIndex.get(starIndex);
  if (!serverEcon) return body.features;

  const stationFeature = body.features.find(f => f.type === 'station');
  if (!stationFeature) return body.features;

  // Update station name/level from server data
  const stationBuilding = serverEcon.buildings.station;
  const stationLevel = stationBuilding?.level ?? 1;
  const romanNumerals = ['I','II','III','IV','V','VI','VII','VIII'];
  const updatedStation: PlanetFeature = {
    ...stationFeature,
    name: `${body.name} ${romanNumerals[stationLevel - 1] ?? stationLevel} Station`,
    level: stationLevel,
  };

  // Start with non-station static features + updated station
  const baseFeatures = body.features.map(f => f === stationFeature ? updatedStation : f);

  const builtExtensions: PlanetFeature[] = [];
  const rng = createRng(body.seed + 12345);

  const extensionTypes: Array<{ key: 'mine' | 'solar' | 'hab' | 'warehouse' | 'dock'; featureType: FeatureType; label: string }> = [
    { key: 'mine', featureType: 'mine', label: 'Mine' },
    { key: 'solar', featureType: 'solar_array', label: 'Solar Array' },
    { key: 'hab', featureType: 'colony', label: 'Hab' },
    { key: 'warehouse', featureType: 'warehouse', label: 'Warehouse' },
    { key: 'dock', featureType: 'dock', label: 'Space Dock' },
  ];

  // Space extensions evenly around orbit, offset from station
  const baseAngle = updatedStation.angle + Math.PI * 0.4; // start offset from station
  const angleSep = (Math.PI * 2) / (extensionTypes.length + 1); // even spacing

  for (let i = 0; i < extensionTypes.length; i++) {
    const ext = extensionTypes[i]!;
    // Deterministic angle: evenly spaced with small jitter
    const angle = baseAngle + angleSep * (i + 1) + rng.range(-0.15, 0.15);
    const dist = updatedStation.dist + rng.range(-0.2, 0.3);

    const building = serverEcon.buildings[ext.key];
    if (building && building.level > 0 && building.status === 'ACTIVE') {
      builtExtensions.push({
        name: `${body.name} ${ext.label} LV${building.level}`,
        type: ext.featureType,
        angle,
        dist,
        level: building.level,
      });
    }
  }

  if (builtExtensions.length === 0) return baseFeatures;
  return [...baseFeatures, ...builtExtensions];
}

export function drawPlanetView(
  r: Renderer,
  camera: Camera,
  galaxy: GalaxyState,
  _shipPos: Vec2,
  fuelPercent: number,
  shieldPercent: number,
  docked = false,
) {
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);
  const wpp = worldPerPixel(camera, screenH);

  const body = galaxy.bodies[galaxy.currentBodyIndex];
  if (!body) return;

  const star = galaxy.stars[galaxy.currentStarIndex];
  const starName = star ? star.name : '';

  // Merge static features with server-built extensions
  const effectiveFeatures = getEffectiveFeatures(body, galaxy.currentStarIndex);

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
  if (effectiveFeatures.length > 0) {
    for (const feat of effectiveFeatures) {
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
      drawFeatureIcon(ctx, fx, fy, feat.type, 10, feat.level);

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

  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = 'rgba(79, 255, 176, 0.85)';
  const resources = getEnabledResources();
  const resourceLine = resources.length > 0
    ? resources.map((resource) => resource.shortName).join('  ')
    : 'NONE';
  ctx.fillText(`TYPE: TERRESTRIAL`, 14, 50);
  ctx.fillText(`FEATURES: ${effectiveFeatures.length}`, 14, 62);
  ctx.fillText(`RESOURCES: ${resourceLine}`, 14, 74);

  // Blank-line separation between planet info and ship status.
  ctx.fillText(`SHIP FUEL: ${Math.round(fuelPercent)}%`, 14, 98);
  ctx.fillText(`SHIP SHIELDS: ${Math.round(shieldPercent)}%`, 14, 110);
  ctx.restore();

  // ── 7. Feature legend (bottom-left) ──
  if (effectiveFeatures.length > 0) {
    const legX = 10;
    const legH = 20 + effectiveFeatures.length * 14;
    const legY = screenH - legH - 10;
    const legW = Math.min(screenW * 0.45, 320);
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
    for (const [i, feat] of effectiveFeatures.entries()) {
      const label = FEATURE_LABELS[feat.type] || feat.type;
      const resourceNames = getFeatureResourceNames(feat.type);
      const resourceSuffix = resourceNames.length > 0
        ? ` [${resourceNames.join('/')}]`
        : ' [utility]';
      drawFeatureIcon(ctx, legX + 16, legY + 22 + i * 14, feat.type, 5, feat.level);
      ctx.fillStyle = G_MED;
      ctx.fillText(`${feat.name} - ${label}${resourceSuffix}`, legX + 26, legY + 18 + i * 14);
    }
    ctx.restore();
  }

  // ── 8. Bottom-right stub panels ──
  const statusRows = buildMockPlanetStatusRows(galaxy.currentStarIndex, fuelPercent, shieldPercent, docked);
  drawPlanetPanels(ctx, screenW, screenH, statusRows);
}

// ── Right-edge slide-out panels (planet view) ──────────────────────────────

type PanelTab = {
  title: string;
  icon: string;
  /** If true, tab is greyed out when not docked */
  requiresDock?: boolean;
};

const PANEL_TABS: PanelTab[] = [
  { title: 'STATUS', icon: '\u25B3' },       // △
  { title: 'BUILD',  icon: '\u2302', requiresDock: true },  // ⌂
  { title: 'SHIPS',  icon: '\u{1F680}', requiresDock: true }, // 🚀
  { title: 'FLEET',  icon: '\u2694' },        // ⚔
];

function buildMockPlanetStatusRows(
  starIndex: number,
  fuelPercent: number,
  shieldPercent: number,
  docked: boolean,
): string[] {
  const rows: string[] = [];
  void fuelPercent;
  void shieldPercent;

  rows.push(`DOCK: ${docked ? 'established' : 'in orbit'}`);

  const enabledResources = getEnabledResources();
  const serverEcon = _serverEconomyByStarIndex.get(starIndex) ?? null;
  if (serverEcon && enabledResources.length > 0) {
    rows.push('RESOURCES');
    for (const resource of enabledResources) {
      const id = resource.id;
      const amount = id === 'ore' ? serverEcon.store.ore : id === 'food' ? serverEcon.store.food : serverEcon.store.energy;
      const rate = id === 'ore' ? serverEcon.rates.ore : id === 'food' ? serverEcon.rates.food : serverEcon.rates.energy;
      rows.push(`${resource.shortName}: ${Math.floor(amount)}/${serverEcon.cap} (+${rate}/m)`);
    }
  }

  return rows;
}

// -1 = all closed, 0..3 = which panel is open
let _openPanel = -1;

// Layout constants
const TAB_W = 28;      // width of the vertical tab strip
const TAB_H = 56;      // height of each tab (smaller to fit 4)
const TAB_GAP = 4;
const ROW_H = 14;
const PANEL_PAD = 10;

// Per-tab panel widths
const PANEL_WIDTHS: number[] = [180, 280, 260, 180]; // STATUS, BUILD, SHIPS, FLEET

function getEffectivePanelW(tabIndex: number, screenW: number): number {
  const base = PANEL_WIDTHS[tabIndex] ?? 180;
  const maxW = screenW - TAB_W - 16;
  return Math.min(base, maxW);
}

export function togglePlanetPanel(index: number): void {
  if (index < 0 || index >= PANEL_TABS.length) return;
  const wasOpen = _openPanel === index;
  _openPanel = wasOpen ? -1 : index;
  // If fleet panel (3) just closed and we have a return tier, schedule revert
  if (wasOpen && index === 3 && _galaxyJumpReturnTier) {
    _pendingTierRevert = _galaxyJumpReturnTier;
    _galaxyJumpReturnTier = null;
  }
}

/** Get the tab rects for hit testing */
function getPanelTabRects(screenH: number) {
  const panelCount = PANEL_TABS.length;
  const totalH = panelCount * TAB_H + (panelCount - 1) * TAB_GAP;
  const startY = (screenH - totalH) / 2;
  return PANEL_TABS.map((_, i) => ({
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
    const rect = tabRects[i];
    if (!rect) continue;
    const ty = rect.y;
    if (sx >= tabX && sx <= screenW && sy >= ty && sy <= ty + TAB_H) {
      return i;
    }
  }

  // Check if click is inside the open panel body
  if (_openPanel >= 0) {
    const openRect = tabRects[_openPanel];
    if (!openRect) return -1;
    const panelW = getEffectivePanelW(_openPanel, screenW);
    const panelX = screenW - TAB_W - panelW;
    const panelY = openRect.y;
    const bodyH = _lastPanelBodyH > 0 ? _lastPanelBodyH : TAB_H;
    if (sx >= panelX && sx <= screenW - TAB_W && sy >= panelY && sy <= panelY + bodyH) {
      // Handle interactive clicks inside BUILD / SHIPS / FLEET tabs
      if (_openPanel === 1) {
        hitTestBuildPanel(sx, sy);
      } else if (_openPanel === 2) {
        hitTestShipsPanel(sx, sy);
      } else if (_openPanel === 3) {
        hitTestFleetPanel(sx, sy);
      }
      return -2; // inside panel body — consume click
    }
  }

  return -1;
}

/** Returns true when a screen point lies under the currently open planet panel/tab area. */
export function isPointCoveredByOpenPlanetPanel(
  screenW: number,
  screenH: number,
  sx: number,
  sy: number,
): boolean {
  if (_openPanel < 0) return false;

  const tabRects = getPanelTabRects(screenH);
  const openRect = tabRects[_openPanel];
  if (!openRect) return false;

  const tabX = screenW - TAB_W;
  // Occlude tab strip itself.
  if (sx >= tabX - 4 && sx <= screenW && sy >= openRect.y && sy <= openRect.y + TAB_H) {
    return true;
  }

  // Occlude open panel body.
  const panelW = getEffectivePanelW(_openPanel, screenW);
  const panelX = screenW - TAB_W - panelW;
  const panelY = openRect.y;
  const bodyH = _lastPanelBodyH > 0 ? _lastPanelBodyH : TAB_H;
  return sx >= panelX && sx <= screenW - TAB_W && sy >= panelY && sy <= panelY + bodyH;
}

// Track last drawn panel body height for hit testing
let _lastPanelBodyH = 0;

// Track docked state for greying out tabs
let _panelsDocked = false;
let _panelsStarIndex: number | null = null;
let _panelsTier: 'galaxy' | 'system' | 'planet' = 'planet';

/** Called before drawing to set panel context */
export function setPanelContext(docked: boolean, starIndex: number | null, tier: 'galaxy' | 'system' | 'planet' = 'planet'): void {
  _panelsDocked = docked;
  _panelsStarIndex = starIndex;
  _panelsTier = tier;
}

// Pending galaxy jump from fleet panel MAP button
let _pendingGalaxyJump = false;
let _galaxyJumpReturnTier: 'system' | 'planet' | null = null;
let _pendingTierRevert: 'system' | 'planet' | null = null;

export function consumePendingGalaxyJump(): boolean {
  const v = _pendingGalaxyJump;
  _pendingGalaxyJump = false;
  return v;
}

export function consumePendingTierRevert(): 'system' | 'planet' | null {
  const v = _pendingTierRevert;
  _pendingTierRevert = null;
  return v;
}

// Hit test helpers for interactive panels (called from hitTestPlanetPanels)
function hitTestBuildPanel(sx: number, sy: number): void {
  // Check COMPLETE button
  if (_completeButton) {
    const cb = _completeButton;
    if (sx >= cb.x && sx <= cb.x + cb.w && sy >= cb.y && sy <= cb.y + cb.h) {
      _pendingCompleteBuilds = true;
      return;
    }
  }
  // Check extension buttons
  for (const btn of _lastExtensionButtons) {
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      if (btn.enabled) {
        _pendingExtensionAction = btn.action;
      }
      return;
    }
  }
}

function hitTestShipsPanel(sx: number, sy: number): void {
  for (const btn of _lastShipButtons) {
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      if (btn.enabled) {
        if (btn.isUpgrade && btn.upgradeFromTypeId != null) {
          _pendingUpgradeShipRequest = { fromTypeId: btn.upgradeFromTypeId };
        } else {
          _pendingBuyShipRequest = { shipTypeId: btn.shipTypeId, quantity: 1 };
        }
      }
      return;
    }
  }
}

function hitTestFleetPanel(sx: number, sy: number): void {
  // MAP button
  if (_fleetMapButton) {
    const b = _fleetMapButton;
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
      _pendingGalaxyJump = true;
      _galaxyJumpReturnTier = _panelsTier === 'galaxy' ? null : _panelsTier;
      return;
    }
  }
  // SEND buttons (enter transfer mode)
  for (const btn of _fleetSendButtons) {
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      enterTransferMode(btn.starIndex, btn.shipTypeId);
      return;
    }
  }
}

// Pending extension action from BUILD panel click
let _pendingExtensionAction: string | null = null;
export function consumePendingExtensionAction(): string | null {
  const a = _pendingExtensionAction;
  _pendingExtensionAction = null;
  return a;
}

export function drawPlanetPanels(
  ctx: CanvasRenderingContext2D,
  screenW: number,
  screenH: number,
  statusRows: string[],
) {
  const tabRects = getPanelTabRects(screenH);
  const tabX = screenW - TAB_W;

  ctx.save();

  for (let i = 0; i < PANEL_TABS.length; i++) {
    const tab = PANEL_TABS[i];
    const rect = tabRects[i];
    if (!tab || !rect) continue;
    const ty = rect.y;
    const isOpen = _openPanel === i;
    const isDisabled = tab.requiresDock && !_panelsDocked;

    // ── Tab (vertical, right edge) ──
    ctx.fillStyle = isOpen ? 'rgba(0, 30, 15, 0.9)' : 'rgba(0, 10, 5, 0.7)';
    roundedRect(ctx, tabX - 4, ty, TAB_W + 4, TAB_H, 4);
    ctx.fill();

    ctx.strokeStyle = isDisabled ? G_FAINT : isOpen ? G_BRIGHT : G_DIM;
    ctx.lineWidth = 1.5;
    roundedRect(ctx, tabX - 4, ty, TAB_W + 4, TAB_H, 4);
    ctx.stroke();

    // Icon at top of tab
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDisabled ? G_FAINT : isOpen ? G_BRIGHT : G_MED;
    ctx.fillText(tab.icon, tabX + TAB_W / 2, ty + 16);

    // Vertical title text
    ctx.save();
    ctx.translate(tabX + TAB_W / 2, ty + TAB_H / 2 + 6);
    ctx.rotate(-Math.PI / 2);
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDisabled ? G_FAINT : isOpen ? G_BRIGHT : G_DIM;
    ctx.fillText(tab.title, 0, 0);
    ctx.restore();

    // ── Slide-out body (only when open and not disabled) ──
    if (isOpen && !isDisabled) {
      const panelW = getEffectivePanelW(i, screenW);
      const panelX = screenW - TAB_W - panelW;
      const panelY = ty;

      // Draw panel body based on tab index
      let bodyH: number;
      switch (i) {
        case 0: bodyH = drawStatusPanelBody(ctx, panelX, panelY, panelW, statusRows); break;
        case 1: bodyH = drawBuildPanelBody(ctx, panelX, panelY, panelW); break;
        case 2: bodyH = drawShipsPanelBody(ctx, panelX, panelY, panelW); break;
        case 3: bodyH = drawFleetPanelBody(ctx, panelX, panelY, panelW); break;
        default: bodyH = TAB_H;
      }
      _lastPanelBodyH = bodyH;
    } else if (isOpen && isDisabled) {
      // Show "DOCK TO ACCESS" message
      const panelW = getEffectivePanelW(i, screenW);
      const panelX = screenW - TAB_W - panelW;
      const panelY = ty;
      const bodyH = TAB_H;
      ctx.fillStyle = 'rgba(0, 10, 5, 0.88)';
      roundedRect(ctx, panelX, panelY, panelW, bodyH, 4);
      ctx.fill();
      ctx.strokeStyle = G_FAINT;
      ctx.lineWidth = 1;
      roundedRect(ctx, panelX, panelY, panelW, bodyH, 4);
      ctx.stroke();
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = G_FAINT;
      ctx.fillText('DOCK TO ACCESS', panelX + panelW / 2, panelY + bodyH / 2);
      _lastPanelBodyH = bodyH;
    }
  }

  ctx.restore();
}

// ── Panel body renderers ──────────────────────────────────────────────────

function drawPanelFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  title: string, icon: string,
): void {
  ctx.fillStyle = 'rgba(0, 10, 5, 0.88)';
  roundedRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = G_BRIGHT;
  ctx.lineWidth = 1;
  roundedRect(ctx, x, y, w, h, 4);
  ctx.stroke();

  // Title
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(`${icon} ${title}`, x + PANEL_PAD, y + PANEL_PAD);

  // Separator
  ctx.strokeStyle = G_DIM;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + PANEL_PAD, y + 22);
  ctx.lineTo(x + w - PANEL_PAD, y + 22);
  ctx.stroke();
}

/** STATUS panel: resources, fuel, shields */
function drawStatusPanelBody(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
  statusRows: string[],
): number {
  const bodyH = Math.max(TAB_H, statusRows.length * ROW_H + PANEL_PAD * 2 + 24);
  drawPanelFrame(ctx, x, y, w, bodyH, 'STATUS', '\u25B3');

  ctx.font = '8px monospace';
  ctx.fillStyle = G_MED;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let r = 0; r < statusRows.length; r++) {
    const row = statusRows[r];
    if (!row) continue;
    ctx.fillText(row, x + PANEL_PAD, y + 28 + r * ROW_H);
  }
  return bodyH;
}

/** BUILD panel: starbase extension upgrade buttons */
function drawBuildPanelBody(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  const starIndex = _panelsStarIndex;
  const serverEcon = starIndex != null ? _serverEconomyByStarIndex.get(starIndex) : undefined;
  const nowMs = Date.now();

  // Calculate height: header + resource row + extension grid (2 rows of 3)
  const extBtnH = 52;
  const extGap = 6;
  const gridRows = 2;
  const bodyH = 28 + 16 + gridRows * (extBtnH + extGap) + 20;

  drawPanelFrame(ctx, x, y, w, bodyH, 'BUILD', '\u2302');

  // Resource readout
  const oreNow = Math.floor(serverEcon?.store.ore ?? 0);
  const foodNow = Math.floor(serverEcon?.store.food ?? 0);
  const energyNow = Math.floor(serverEcon?.store.energy ?? 0);
  const stationLevel = serverEcon?.buildings.station.level ?? 1;
  ctx.font = '7px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = G_MED;
  ctx.fillText(`STATION LV ${toRoman(stationLevel)}  O:${oreNow} F:${foodNow} E:${energyNow}`, x + PANEL_PAD, y + 28);

  // COMPLETE button (if any build in progress)
  const hasActiveBuild = serverEcon
    ? Object.values(serverEcon.buildings).some((b) => b.status === 'UPGRADING')
    : false;
  const fleetState = starIndex != null ? _serverShipsByStarIndex.get(starIndex) : null;
  const buildingShip = fleetState?.building ?? null;
  const hasActiveShipBuild = buildingShip != null && buildingShip.completeAt > Date.now();
  if (hasActiveBuild || hasActiveShipBuild) {
    const cbW = 54;
    const cbH = 12;
    const cbX = x + w - cbW - PANEL_PAD;
    const cbY = y + 26;
    _completeButton = { x: cbX, y: cbY, w: cbW, h: cbH };
    roundedRect(ctx, cbX, cbY, cbW, cbH, 2);
    ctx.fillStyle = 'rgba(80, 40, 0, 0.6)';
    ctx.fill();
    roundedRect(ctx, cbX, cbY, cbW, cbH, 2);
    ctx.strokeStyle = '#ffb84d';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffb84d';
    ctx.fillText('COMPLETE', cbX + cbW / 2, cbY + cbH / 2);
  } else {
    _completeButton = null;
  }

  // Extension grid: 3 columns x 2 rows
  const gridStartY = y + 44;
  const cols = 3;
  const extBtnW = Math.floor((w - PANEL_PAD * 2 - (cols - 1) * extGap) / cols);
  const gridStartX = x + PANEL_PAD;

  const stationReady = _panelsDocked; // simplified: docked = can build

  _lastExtensionButtons = [];
  for (const [idx, ext] of MOCK_EXTENSION_DEFS.entries()) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const bx = gridStartX + col * (extBtnW + extGap);
    const by = gridStartY + row * (extBtnH + extGap);

    const isStationUpgrade = ext.action === 'upgrade_station';
    const serverBuilding = serverEcon?.buildings[ext.key];
    const level = serverBuilding?.level ?? 0;
    const maxBuildingLevel = Math.min(MAX_STATION_LEVEL, serverEcon?.buildings.station.level ?? 1);
    const nextLevel = Math.min(MAX_STATION_LEVEL, level + 1);
    const isMaxLevel = isStationUpgrade ? level >= MAX_STATION_LEVEL : level >= maxBuildingLevel;
    const effectiveCost = isStationUpgrade
      ? {
          ore: 420 + STATION_UPGRADE_COST_STEP.ore * Math.max(0, level - 1),
          food: 420 + STATION_UPGRADE_COST_STEP.food * Math.max(0, level - 1),
          energy: 420 + STATION_UPGRADE_COST_STEP.energy * Math.max(0, level - 1),
        }
      : {
          ore: ext.cost.ore * nextLevel,
          food: ext.cost.food * nextLevel,
          energy: ext.cost.energy * nextLevel,
        };
    const activeBuildCount = serverEcon
      ? Object.values(serverEcon.buildings).filter((c) => c.status === 'UPGRADING').length
      : 0;
    const canAfford = serverEcon
      ? serverEcon.store.ore >= effectiveCost.ore && serverEcon.store.food >= effectiveCost.food && serverEcon.store.energy >= effectiveCost.energy
      : false;
    const isActive = serverBuilding ? serverBuilding.status === 'UPGRADING' : false;
    const isLocked = serverBuilding ? serverBuilding.status === 'LOCKED' : true;
    const progress = serverBuilding && serverBuilding.status === 'UPGRADING' && serverBuilding.completeAt != null
      ? Math.max(0, Math.min(100, Math.floor(((ext.buildMs - Math.max(0, serverBuilding.completeAt - nowMs)) / ext.buildMs) * 100)))
      : 0;
    const enabled = stationReady && canAfford && !isActive && !isMaxLevel && !isLocked && activeBuildCount === 0;
    const tierLabel = `${ext.label} ${toRoman(nextLevel)}`;

    _lastExtensionButtons.push({ action: ext.action, label: tierLabel, x: bx, y: by, w: extBtnW, h: extBtnH, enabled });

    roundedRect(ctx, bx, by, extBtnW, extBtnH, 3);
    ctx.fillStyle = enabled ? 'rgba(20, 80, 60, 0.6)' : 'rgba(20, 35, 30, 0.5)';
    ctx.fill();
    roundedRect(ctx, bx, by, extBtnW, extBtnH, 3);
    ctx.strokeStyle = enabled ? G_BRIGHT : isMaxLevel ? G_MED : G_FAINT;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = enabled ? G_BRIGHT : G_MED;
    ctx.font = 'bold 7px monospace';
    ctx.fillText(tierLabel, bx + extBtnW / 2, by + 4);

    ctx.font = '6px monospace';
    if (isMaxLevel) {
      ctx.fillStyle = G_MED;
      ctx.fillText(isStationUpgrade ? 'MAX' : `LV ${toRoman(level)}`, bx + extBtnW / 2, by + 18);
    } else if (isActive) {
      ctx.fillStyle = G_MED;
      ctx.fillText(`${progress}%`, bx + extBtnW / 2, by + 18);
      const barX = bx + 4;
      const barY = by + 30;
      const barW = extBtnW - 8;
      const fillW = Math.floor((barW * progress) / 100);
      ctx.fillStyle = 'rgba(79, 255, 176, 0.2)';
      ctx.fillRect(barX, barY, barW, 5);
      ctx.fillStyle = G_BRIGHT;
      ctx.fillRect(barX, barY, fillW, 5);
    } else {
      ctx.fillStyle = G_DIM;
      ctx.fillText(`${effectiveCost.ore}/${effectiveCost.food}/${effectiveCost.energy}`, bx + extBtnW / 2, by + 18);
      const isBusy = activeBuildCount > 0 && !isActive;
      const statusLabel = enabled
        ? (level >= 1 ? 'UPGRADE' : 'BUILD')
        : isBusy
          ? (level >= 1 ? `LV ${toRoman(level)}` : 'BUSY')
          : isLocked ? 'LOCKED' : 'NEED RES';
      ctx.fillStyle = enabled ? G_BRIGHT : G_MED;
      ctx.fillText(statusLabel, bx + extBtnW / 2, by + 30);
    }
  }

  return bodyH;
}

/** SHIPS panel: ship build grid + upgrade section */
function drawShipsPanelBody(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  ensureShipIconsLoaded();
  const starIndex = _panelsStarIndex;
  const serverEcon = starIndex != null ? _serverEconomyByStarIndex.get(starIndex) : undefined;
  const fleetState = starIndex != null ? _serverShipsByStarIndex.get(starIndex) : null;
  const fleetShips = fleetState?.ships ?? [];
  const buildingShip = fleetState?.building ?? null;
  const dockLevel = serverEcon?.buildings.dock?.level ?? 0;
  const nowMs = Date.now();

  // Check if player has any ship on the upgrade path
  const hasUpgradePathShip = fleetShips.some(
    (s) => s.count > 0 && UPGRADE_PATH.includes(s.typeId as any),
  );

  // Show Basic Probe (11) and Colony Ship (8); also show Scout (1) if player has no upgrade-path ship
  const SHOWN_BUILD_IDS = hasUpgradePathShip ? [11, 8] : [1, 11, 8];
  const availableShips = Object.values(SHIP_CATALOG).filter(
    (entry) => SHOWN_BUILD_IDS.includes(entry.id) && entry.dockTier <= dockLevel && entry.dockLevel <= dockLevel,
  );
  const cols = 2;
  const cellW = Math.floor((w - PANEL_PAD * 2 - 6) / cols);
  const cellH = 56;
  const cellGap = 6;

  // Upgrade section (player's ship on upgrade path) — shown at top
  const upgradeEntries: { from: typeof SHIP_CATALOG[keyof typeof SHIP_CATALOG]; to: typeof SHIP_CATALOG[keyof typeof SHIP_CATALOG]; dockLocked: boolean }[] = [];
  for (const ship of fleetShips) {
    if (ship.count <= 0) continue;
    const pathIdx = UPGRADE_PATH.indexOf(ship.typeId as any);
    if (pathIdx >= 0 && pathIdx < UPGRADE_PATH.length - 1) {
      const nextTypeId = UPGRADE_PATH[pathIdx + 1]!;
      const fromEntry = SHIP_CATALOG[ship.typeId as keyof typeof SHIP_CATALOG];
      const toEntry = SHIP_CATALOG[nextTypeId as keyof typeof SHIP_CATALOG];
      if (fromEntry && toEntry) {
        upgradeEntries.push({ from: fromEntry, to: toEntry, dockLocked: toEntry.dockLevel > dockLevel });
      }
    }
  }

  // Calculate body height: upgrade section first, then build grid
  // Check if there's an active upgrade build to show even without upgradeEntries
  const isUpgradeBuildActive = buildingShip != null && UPGRADE_PATH.includes(buildingShip.typeId as any) && buildingShip.completeAt > nowMs;
  const upgradeDisplayH = (upgradeEntries.length > 0 || isUpgradeBuildActive) ? 16 + (cellH + cellGap) : 0;
  const buildRows = Math.ceil(availableShips.length / cols);
  const buildH = buildRows > 0 ? 16 + buildRows * (cellH + cellGap) : 0;
  const bodyH = 28 + upgradeDisplayH + buildH + 12;

  drawPanelFrame(ctx, x, y, w, bodyH, 'SHIPS', '\u{1F680}');

  // Header: dock level
  ctx.font = '7px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = G_MED;
  ctx.fillText(dockLevel > 0 ? `DOCK LV ${toRoman(dockLevel)}` : 'NO DOCK', x + PANEL_PAD, y + 28);

  _lastShipButtons = [];
  const gridStartX = x + PANEL_PAD;
  let cursorY = y + 40;

  // ── UPGRADE section (top, orange) ──
  if (upgradeEntries.length > 0 || isUpgradeBuildActive) {
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffb84d';
    ctx.fillText('UPGRADE', x + PANEL_PAD, cursorY);
    cursorY += 12;

    // Show active upgrade build progress
    if (isUpgradeBuildActive && upgradeEntries.length === 0) {
      const buildCatalog = SHIP_CATALOG[buildingShip!.typeId as keyof typeof SHIP_CATALOG];
      if (buildCatalog) {
        const bx = gridStartX;
        const by = cursorY;
        const fullW = w - PANEL_PAD * 2;

        roundedRect(ctx, bx, by, fullW, cellH, 3);
        ctx.fillStyle = 'rgba(60, 50, 10, 0.5)';
        ctx.fill();
        roundedRect(ctx, bx, by, fullW, cellH, 3);
        ctx.strokeStyle = '#ffb84d';
        ctx.lineWidth = 1;
        ctx.stroke();

        const icon = getShipIcon(buildCatalog.icon);
        if (icon) {
          ctx.drawImage(icon, bx + 4, by + cellH - 28, 24, 24);
        }

        const remaining = Math.max(0, Math.ceil((buildingShip!.completeAt - nowMs) / 1000));
        const totalBuild = buildCatalog.buildSeconds;
        const progress = Math.max(0, Math.min(100, Math.floor(((totalBuild - remaining) / totalBuild) * 100)));

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 7px monospace';
        ctx.fillStyle = '#ffb84d';
        ctx.fillText(`UPGRADING \u2192 ${buildCatalog.name.toUpperCase()}`, bx + 32, by + 6);
        ctx.font = '6px monospace';
        ctx.fillText(`${progress}% (${remaining}s)`, bx + 32, by + 18);

        const barX = bx + 32;
        const barW = fullW - 40;
        const fillW = Math.floor((barW * progress) / 100);
        ctx.fillStyle = 'rgba(255, 184, 77, 0.2)';
        ctx.fillRect(barX, by + 30, barW, 4);
        ctx.fillStyle = '#ffb84d';
        ctx.fillRect(barX, by + 30, fillW, 4);
      }
    }

    for (const [idx, ue] of upgradeEntries.entries()) {
      const bx = gridStartX;
      const by = cursorY + idx * (cellH + cellGap);
      const fullW = w - PANEL_PAD * 2;

      const isUpgradeBuild = buildingShip != null && buildingShip.typeId === ue.to.id && buildingShip.completeAt > nowMs;
      const canAfford = serverEcon
        ? serverEcon.store.ore >= ue.to.cost.ore && serverEcon.store.food >= ue.to.cost.food && serverEcon.store.energy >= ue.to.cost.energy
        : false;
      const isBuilding = buildingShip != null && buildingShip.completeAt > nowMs;
      const enabled = !isBuilding && canAfford && !ue.dockLocked;

      _lastShipButtons.push({ x: bx, y: by, w: fullW, h: cellH, shipTypeId: ue.to.id, enabled, isUpgrade: true, upgradeFromTypeId: ue.from.id });

      roundedRect(ctx, bx, by, fullW, cellH, 3);
      ctx.fillStyle = isUpgradeBuild ? 'rgba(60, 50, 10, 0.5)' : enabled ? 'rgba(50, 40, 10, 0.4)' : 'rgba(30, 25, 10, 0.4)';
      ctx.fill();
      roundedRect(ctx, bx, by, fullW, cellH, 3);
      ctx.strokeStyle = isUpgradeBuild ? '#ffb84d' : enabled ? '#ffb84d' : '#665522';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Icon
      const icon = getShipIcon(ue.to.icon);
      if (icon) {
        ctx.drawImage(icon, bx + 4, by + cellH - 28, 24, 24);
      }

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = enabled || isUpgradeBuild ? '#ffb84d' : '#997733';
      ctx.fillText(`${ue.from.name.toUpperCase()} \u2192 ${ue.to.name.toUpperCase()}`, bx + 32, by + 4);

      if (isUpgradeBuild) {
        const remaining = Math.max(0, Math.ceil((buildingShip!.completeAt - nowMs) / 1000));
        const totalBuild = ue.to.buildSeconds;
        const progress = Math.max(0, Math.min(100, Math.floor(((totalBuild - remaining) / totalBuild) * 100)));
        ctx.font = '6px monospace';
        ctx.fillStyle = '#ffb84d';
        ctx.fillText(`UPGRADING ${progress}% (${remaining}s)`, bx + 32, by + 16);
        const barX = bx + 32;
        const barW = fullW - 40;
        const fillW = Math.floor((barW * progress) / 100);
        ctx.fillStyle = 'rgba(255, 184, 77, 0.2)';
        ctx.fillRect(barX, by + 28, barW, 4);
        ctx.fillStyle = '#ffb84d';
        ctx.fillRect(barX, by + 28, fillW, 4);
      } else {
        ctx.font = '6px monospace';
        ctx.fillStyle = '#997733';
        ctx.fillText(`${ue.to.cost.ore}/${ue.to.cost.food}/${ue.to.cost.energy}  ${ue.to.buildSeconds}s`, bx + 32, by + 16);
        const actionLabel = ue.dockLocked ? `NEED DOCK LV ${ue.to.dockLevel}` : enabled ? 'UPGRADE' : 'NEED RES';
        ctx.fillStyle = enabled ? '#ffb84d' : '#aa7744';
        ctx.fillText(actionLabel, bx + 32, by + 28);
      }
    }

    cursorY += (upgradeEntries.length > 0 ? upgradeEntries.length : 1) * (cellH + cellGap) + 4;
  }

  // ── BUILD section (Basic Probe + Colony Ship) ──
  if (availableShips.length > 0) {
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = G_BRIGHT;
    ctx.fillText('BUILD', x + PANEL_PAD, cursorY);
    cursorY += 12;

    // Building indicator
    if (buildingShip && !UPGRADE_PATH.includes(buildingShip.typeId as any)) {
      const bEntry = SHIP_CATALOG[buildingShip.typeId as keyof typeof SHIP_CATALOG];
      if (bEntry) {
        const remaining = Math.max(0, Math.ceil((buildingShip.completeAt - nowMs) / 1000));
        const totalBuild = bEntry.buildSeconds;
        const progress = Math.max(0, Math.min(100, Math.floor(((totalBuild - remaining) / totalBuild) * 100)));
        ctx.fillStyle = G_MED;
        ctx.font = '7px monospace';
        ctx.fillText(`BUILDING: ${bEntry.name.toUpperCase()} ${progress}% (${remaining}s)`, x + PANEL_PAD + 40, cursorY - 12);
      }
    }

    for (const [idx, entry] of availableShips.entries()) {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const bx = gridStartX + col * (cellW + cellGap);
      const by = cursorY + row * (cellH + cellGap);

      const isBuilding = buildingShip != null && buildingShip.completeAt > nowMs;
      const canAfford = serverEcon
        ? serverEcon.store.ore >= entry.cost.ore && serverEcon.store.food >= entry.cost.food && serverEcon.store.energy >= entry.cost.energy
        : false;
      const enabled = !isBuilding && canAfford;

      _lastShipButtons.push({ x: bx, y: by, w: cellW, h: cellH, shipTypeId: entry.id, enabled, isUpgrade: false });

      roundedRect(ctx, bx, by, cellW, cellH, 3);
      ctx.fillStyle = enabled ? 'rgba(20, 60, 80, 0.5)' : 'rgba(15, 25, 35, 0.5)';
      ctx.fill();
      roundedRect(ctx, bx, by, cellW, cellH, 3);
      ctx.strokeStyle = enabled ? G_BRIGHT : G_FAINT;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Ship icon (bottom-left)
      const icon = getShipIcon(entry.icon);
      if (icon) {
        const iconSize = 24;
        ctx.drawImage(icon, bx + 4, by + cellH - iconSize - 4, iconSize, iconSize);
      }

      // Ship name + cost
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = enabled ? G_BRIGHT : G_MED;
      ctx.font = 'bold 7px monospace';
      ctx.fillText(entry.name.toUpperCase(), bx + 30, by + 4);
      ctx.font = '6px monospace';
      ctx.fillStyle = G_DIM;
      ctx.fillText(`${entry.cost.ore}/${entry.cost.food}/${entry.cost.energy}`, bx + 30, by + 14);
      ctx.fillText(`${entry.buildSeconds}s  SP:${entry.shipPoints}`, bx + 30, by + 24);
    }
  }

  return bodyH;
}

/** FLEET panel: fleet summary */
// Hit rects for fleet panel buttons
let _fleetMapButton: { x: number; y: number; w: number; h: number } | null = null;
let _fleetSendButtons: Array<{ x: number; y: number; w: number; h: number; starIndex: number; shipTypeId: number }> = [];

function drawFleetPanelBody(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  _fleetMapButton = null;
  _fleetSendButtons = [];

  if (_panelsTier === 'galaxy') {
    return drawFleetGalaxyView(ctx, x, y, w);
  }
  return drawFleetLocalView(ctx, x, y, w);
}

/** Fleet panel at Galaxy tier: shows all stars' fleets with SEND buttons */
function drawFleetGalaxyView(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  // Gather all known star fleets
  const entries: Array<{ starIndex: number; ships: Array<{ typeId: number; count: number }> }> = [];
  for (const [si, state] of _serverShipsByStarIndex.entries()) {
    if (state.ships.length > 0) {
      entries.push({ starIndex: si, ships: state.ships });
    }
  }

  // Calculate height
  let lineCount = 0;
  for (const e of entries) {
    lineCount += 1; // star header
    lineCount += e.ships.filter(s => s.count > 0).length; // ship rows
  }
  if (entries.length === 0) lineCount = 2; // "No fleet" + hint
  lineCount += 1; // total row

  const bodyH = Math.max(TAB_H, lineCount * ROW_H + PANEL_PAD * 2 + 28);
  drawPanelFrame(ctx, x, y, w, bodyH, 'FLEET \u2014 ALL STARS', '\u2694');

  ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  let cy = y + 28;
  let totalSP = 0;

  if (entries.length === 0) {
    ctx.fillStyle = G_DIM;
    ctx.fillText('No fleet deployed', x + PANEL_PAD, cy);
    cy += ROW_H;
    ctx.fillText('Dock at a star to build ships', x + PANEL_PAD, cy);
    cy += ROW_H;
  } else {
    for (const e of entries) {
      // Star header
      const isHome = e.starIndex === _panelsStarIndex;
      ctx.fillStyle = G_BRIGHT;
      ctx.fillText(`\u2605 Star ${e.starIndex}${isHome ? ' (HOME)' : ''}`, x + PANEL_PAD, cy);
      cy += ROW_H;

      // Ships at this star
      for (const s of e.ships) {
        if (s.count <= 0) continue;
        const entry = SHIP_CATALOG[s.typeId as keyof typeof SHIP_CATALOG];
        if (!entry) continue;
        totalSP += entry.shipPoints * s.count;
        ctx.fillStyle = G_MED;
        ctx.fillText(`  ${entry.name} x${s.count}`, x + PANEL_PAD, cy);

        // [SEND] button
        const btnW = 28;
        const btnH = 10;
        const btnX = x + w - PANEL_PAD - btnW;
        const btnY = cy;
        ctx.strokeStyle = G_MED;
        ctx.lineWidth = 0.5;
        roundedRect(ctx, btnX, btnY, btnW, btnH, 2);
        ctx.stroke();
        ctx.fillStyle = G_BRIGHT;
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SEND', btnX + btnW / 2, btnY + 1.5);
        ctx.textAlign = 'left';
        ctx.font = '8px monospace';
        _fleetSendButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH, starIndex: e.starIndex, shipTypeId: s.typeId });

        cy += ROW_H;
      }
    }
  }

  // Total
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(`TOTAL: ${totalSP} SP`, x + PANEL_PAD, cy);

  return bodyH;
}

/** Fleet panel at System/Planet tier: single star + MAP button */
function drawFleetLocalView(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  const starIndex = _panelsStarIndex;
  const fleetState = starIndex != null ? _serverShipsByStarIndex.get(starIndex) : null;
  const fleetShips = fleetState?.ships ?? [];

  const rows: string[] = [];
  let totalSP = 0;
  for (const s of fleetShips) {
    const entry = SHIP_CATALOG[s.typeId as keyof typeof SHIP_CATALOG];
    if (entry && s.count > 0) {
      rows.push(`${entry.name.toUpperCase()} x${s.count} (${entry.shipPoints * s.count} SP)`);
      totalSP += entry.shipPoints * s.count;
    }
  }
  if (rows.length === 0) rows.push('No ships at this star');
  rows.push(`TOTAL: ${totalSP} SP`);

  // Extra row for MAP button
  const bodyH = Math.max(TAB_H, (rows.length + 2) * ROW_H + PANEL_PAD * 2 + 28);
  drawPanelFrame(ctx, x, y, w, bodyH, 'FLEET', '\u2694');

  ctx.font = '8px monospace';
  ctx.fillStyle = G_MED;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    ctx.fillText(row, x + PANEL_PAD, y + 28 + r * ROW_H);
  }

  // [GALAXY MAP] button
  const btnW = w - PANEL_PAD * 2;
  const btnH = 14;
  const btnX = x + PANEL_PAD;
  const btnY = y + 28 + rows.length * ROW_H + ROW_H;
  ctx.fillStyle = 'rgba(79, 255, 176, 0.15)';
  roundedRect(ctx, btnX, btnY, btnW, btnH, 3);
  ctx.fill();
  ctx.strokeStyle = G_BRIGHT;
  ctx.lineWidth = 1;
  roundedRect(ctx, btnX, btnY, btnW, btnH, 3);
  ctx.stroke();
  ctx.fillStyle = G_BRIGHT;
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('\u2191 GALAXY MAP', btnX + btnW / 2, btnY + 3.5);
  ctx.textAlign = 'left';
  _fleetMapButton = { x: btnX, y: btnY, w: btnW, h: btnH };

  return bodyH;
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
import { SHIP_CATALOG, UPGRADE_PATH } from '../shared/ships';

// ── Ship Icon Cache ─────────────────────────────────────────────────────────
const _shipIconCache = new Map<string, HTMLImageElement>();
let _shipIconsLoading = false;

function ensureShipIconsLoaded(): void {
  if (_shipIconsLoading) return;
  _shipIconsLoading = true;
  for (const entry of Object.values(SHIP_CATALOG)) {
    if (_shipIconCache.has(entry.icon)) continue;
    const img = new Image();
    img.src = `/icons/${entry.icon}`;
    _shipIconCache.set(entry.icon, img);
  }
}

function getShipIcon(iconFile: string): HTMLImageElement | null {
  const img = _shipIconCache.get(iconFile);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

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

type DockExtensionAction = 'upgrade_station' | 'extend_habitat' | 'extend_ore' | 'extend_defense' | 'extend_warehouse' | 'extend_dock';
export type DockPanelAction = DockAction | DockExtensionAction | 'buy_ships' | 'debug_complete';

let _completeButton: { x: number; y: number; w: number; h: number } | null = null;

type ExtensionButton = {
  action: DockExtensionAction;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  enabled: boolean;
};

type MockExtensionState = {
  action: DockExtensionAction;
  label: string;
  key: 'mine' | 'solar' | 'hab' | 'station' | 'warehouse' | 'dock';
  cost: { ore: number; food: number; energy: number };
  buildMs: number;
};

const MOCK_EXTENSION_DEFS: MockExtensionState[] = [
  { action: 'upgrade_station', label: 'STATION', key: 'station', cost: { ore: 420, food: 420, energy: 420 }, buildMs: 300_000 },
  { action: 'extend_habitat', label: 'HAB', key: 'hab', cost: { ore: 180, food: 220, energy: 120 }, buildMs: 300_000 },
  { action: 'extend_ore', label: 'MINE', key: 'mine', cost: { ore: 260, food: 120, energy: 180 }, buildMs: 300_000 },
  { action: 'extend_defense', label: 'SOLAR', key: 'solar', cost: { ore: 300, food: 180, energy: 260 }, buildMs: 300_000 },
  { action: 'extend_warehouse', label: 'STORE', key: 'warehouse', cost: { ore: 240, food: 180, energy: 180 }, buildMs: 300_000 },
  { action: 'extend_dock', label: 'DOCK', key: 'dock', cost: { ore: 500, food: 300, energy: 400 }, buildMs: 600_000 },
];

let _lastExtensionButtons: ExtensionButton[] = [];

type ServerEconomySnapshot = {
  starIndex: number;
  store: { ore: number; food: number; energy: number };
  rates: { ore: number; food: number; energy: number };
  cap: number;
  buildings: {
    station: { level: number; status: string; completeAt: number | null };
    mine: { level: number; status: string; completeAt: number | null };
    solar: { level: number; status: string; completeAt: number | null };
    hab: { level: number; status: string; completeAt: number | null };
    warehouse: { level: number; status: string; completeAt: number | null };
    dock: { level: number; status: string; completeAt: number | null };
  };
};

const _serverEconomyByStarIndex = new Map<number, ServerEconomySnapshot>();
let _lastEconomyStarIndex: number | null = null;
let _pendingBuildRequest: { buildType: 'station' | 'mine' | 'solar' | 'hab' | 'warehouse' | 'dock' } | null = null;
let _pendingBuyShipRequest: { shipTypeId: number; quantity: number } | null = null;
let _pendingUpgradeShipRequest: { fromTypeId: number } | null = null;
let _pendingCompleteBuilds = false;

export function setServerStarEconomy(snapshot: ServerEconomySnapshot): void {
  _serverEconomyByStarIndex.set(snapshot.starIndex, snapshot);
}

type ServerShipSnapshot = {
  ships: Array<{ typeId: number; count: number }>;
  building: { typeId: number; completeAt: number } | null;
};
const _serverShipsByStarIndex = new Map<number, ServerShipSnapshot>();

export function setServerShipState(
  starIndex: number,
  ships: Array<{ typeId: number; count: number }>,
  building: { typeId: number; completeAt: number } | null,
): void {
  _serverShipsByStarIndex.set(starIndex, { ships, building });
}

/** Bulk-set fleet data from /fleet/all response (replaces all entries). */
export function setServerFleetAll(
  stars: Record<string, { ships: Array<{ typeId: number; count: number }>; building: { typeId: number; completeAt: number } | null }>,
): void {
  _serverShipsByStarIndex.clear();
  for (const [key, val] of Object.entries(stars)) {
    // keys are "s:N" format
    const idx = parseInt(key.replace('s:', ''), 10);
    if (!Number.isNaN(idx)) {
      _serverShipsByStarIndex.set(idx, val);
    }
  }
}

export function consumePendingBuildRequest(): { buildType: 'station' | 'mine' | 'solar' | 'hab' | 'warehouse' | 'dock' } | null {
  const next = _pendingBuildRequest;
  _pendingBuildRequest = null;
  return next;
}

export function consumePendingBuyShipRequest(): { shipTypeId: number; quantity: number } | null {
  const next = _pendingBuyShipRequest;
  _pendingBuyShipRequest = null;
  return next;
}

export function consumePendingUpgradeShipRequest(): { fromTypeId: number } | null {
  const next = _pendingUpgradeShipRequest;
  _pendingUpgradeShipRequest = null;
  return next;
}

export function consumePendingCompleteBuilds(): boolean {
  const next = _pendingCompleteBuilds;
  _pendingCompleteBuilds = false;
  return next;
}

function mapDockActionToBuildType(action: DockExtensionAction): 'station' | 'mine' | 'solar' | 'hab' | 'warehouse' | 'dock' {
  if (action === 'upgrade_station') return 'station';
  if (action === 'extend_ore') return 'mine';
  if (action === 'extend_defense') return 'solar';
  if (action === 'extend_warehouse') return 'warehouse';
  if (action === 'extend_dock') return 'dock';
  return 'hab';
}

const MAX_STATION_LEVEL = 8;
const STATION_UPGRADE_COST_STEP = { ore: 180, food: 180, energy: 180 };
function toRoman(level: number): string {
  const table = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  return table[level - 1] ?? `${level}`;
}

function isDockedAtStation(dock?: DockState): boolean {
  if (!dock || !dock.docked) return false;
  return dock.targetType === 'feature' && dock.targetLabel === 'Station';
}

export function triggerDockPanelAction(action: DockPanelAction, dock?: DockState): boolean {
  if (action === 'upgrade_station' || action === 'extend_habitat' || action === 'extend_ore' || action === 'extend_defense' || action === 'extend_warehouse' || action === 'extend_dock') {
    const serverEcon = _lastEconomyStarIndex == null ? null : _serverEconomyByStarIndex.get(_lastEconomyStarIndex);
    if (!serverEcon || !isDockedAtStation(dock)) return false;
    const buildType = mapDockActionToBuildType(action);
    const building = serverEcon.buildings[buildType];
    const stationLevel = serverEcon.buildings.station.level;
    const isStationUpgrade = buildType === 'station';
    const level = building.level;
    const nextLevel = level + 1;
    const catalog = MOCK_EXTENSION_DEFS.find((d) => d.action === action);
    const maxLevel = buildType === 'dock' ? 5 : MAX_STATION_LEVEL;
    const isMaxLevel = isStationUpgrade ? level >= MAX_STATION_LEVEL : level >= Math.min(maxLevel, stationLevel);
    const effectiveCost = isStationUpgrade
      ? {
          ore: 420 + STATION_UPGRADE_COST_STEP.ore * Math.max(0, level - 1),
          food: 420 + STATION_UPGRADE_COST_STEP.food * Math.max(0, level - 1),
          energy: 420 + STATION_UPGRADE_COST_STEP.energy * Math.max(0, level - 1),
        }
      : {
          ore: (catalog?.cost.ore ?? 0) * nextLevel,
          food: (catalog?.cost.food ?? 0) * nextLevel,
          energy: (catalog?.cost.energy ?? 0) * nextLevel,
        };
    const canAfford =
      serverEcon.store.ore >= effectiveCost.ore &&
      serverEcon.store.food >= effectiveCost.food &&
      serverEcon.store.energy >= effectiveCost.energy;
    const anyActive = Object.values(serverEcon.buildings).some((candidate) => candidate.status === 'UPGRADING');
    if (anyActive || isMaxLevel || !canAfford) return false;
    _pendingBuildRequest = { buildType };
    return true;
  }
  if (action === 'buy_ships') {
    // Ship panel triggered — handled by game loop
    return true;
  }
  if (action === 'debug_complete') {
    // Complete builds — already set _pendingCompleteBuilds in hitTest
    return true;
  }
  return false;
}

const DOCK_ACTIONS: { action: DockAction; label: string; icon: string }[] = [
  { action: 'scan',    label: 'SCAN',    icon: '\u25CE' },     // ◎
  { action: 'leave',   label: 'LEAVE',   icon: '\u2191' },     // ↑
];

export function drawDockPanel(
  r: Renderer,
  dock: DockState,
  _body: SystemBody | null,
  starIndex?: number,
): void {
  const { ctx } = r;
  const dpr = window.devicePixelRatio || 1;
  const screenW = r.width / dpr;
  const screenH = r.height / dpr;

  _lastEconomyStarIndex = starIndex ?? null;

  // Set panel context for right-side tabs
  setPanelContext(dock.docked, starIndex ?? null);

  // Minimal orbit bar at bottom
  const barH = 32;
  const barW = Math.min(screenW - 24, 320);
  const barX = (screenW - barW) / 2;
  const barY = screenH - barH - 8;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 10, 5, 0.85)';
  ctx.strokeStyle = G_DIM;
  ctx.lineWidth = 1;
  roundedRect(ctx, barX, barY, barW, barH, 4);
  ctx.fill();
  ctx.stroke();

  // Orbit status text
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(`\u25CF ORBIT: ${dock.targetName.toUpperCase()}`, barX + 10, barY + barH / 2);

  // Action buttons (SCAN + LEAVE) on right side of bar
  const btnW = 48;
  const btnH = 22;
  const btnGap = 6;
  const btnY = barY + (barH - btnH) / 2;

  _lastDockButtons = [];
  for (const [i, act] of DOCK_ACTIONS.entries()) {
    const bx = barX + barW - (DOCK_ACTIONS.length - i) * (btnW + btnGap);
    const by = btnY;

    _lastDockButtons.push({ ...act, x: bx, y: by, w: btnW, h: btnH });

    const enabled = dock.docked || act.action === 'leave';
    ctx.strokeStyle = enabled ? G_BRIGHT : G_FAINT;
    ctx.lineWidth = 1;
    roundedRect(ctx, bx, by, btnW, btnH, 3);
    ctx.stroke();

    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = enabled ? G_BRIGHT : G_FAINT;
    ctx.fillText(act.icon, bx + 12, by + btnH / 2);

    ctx.font = '7px monospace';
    ctx.fillText(act.label, bx + 32, by + btnH / 2);
  }

  ctx.restore();
}

/** Hit-test dock panel buttons (orbit bar). Returns the action if clicked, null otherwise. */
export function hitTestDockPanel(screenPos: Vec2): DockPanelAction | null {
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

// ── Ship Panel (now integrated into right-side SHIPS tab) ───────────────────

type ShipButton = {
  shipTypeId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  enabled: boolean;
  isUpgrade?: boolean;
  upgradeFromTypeId?: number;
};

let _lastShipButtons: ShipButton[] = [];

// Legacy stubs for game-loop compatibility
export function drawShipPanel(_r: Renderer): void {
  // Ship panel is now drawn inside the right-side SHIPS tab
}

export function isShipPanelOpen(): boolean {
  return _openPanel === 2; // SHIPS tab
}

export function closeShipPanel(): void {
  if (_openPanel === 2) _openPanel = -1;
}

