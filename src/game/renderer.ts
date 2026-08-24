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
import { getShipSprite, preloadShipSprites } from './ship-sprites';
import { getAsteroidSurfaceInfo } from './asteroids';
import type { StarVisualTone } from './ownership-contracts';
import { playSound } from './audio';
import { f } from './font';
import { getFontScale } from './font';
import { installTextAudit, setAuditRegion } from './text-audit';
import { getJourneyPulseAlpha } from './journey';
import { isCoachActive, getCoachStep, coachAdvance, dismissCoach, completeCoach, getCoachPulse, ackCoachStep, isCoachAcked, isShipsTopicActive, getShipsTopicStep, shipsTopicNext, shipsTopicShipsOpened, shipsTopicProbeClicked, dismissShipsTopic, isColonizationTopicActive, getColonizationTopicStep, getColonizationTopicTarget, colonizationTopicNext, colonizationTopicAction, dismissColonizationTopic, isComsTopicActive, getComsTopicIdx, getComsTopicPhase, comsTopicNext, comsTopicTabClicked, comsTopicBranchToAlliance, dismissComsTopic } from './coach';
import { FLEET_COMMAND_SENDER } from '../shared/feature-flags';

// ── View mode helper ────────────────────────────────────────────────────────
function isMobileView(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vm = (globalThis as any).__VIEW_MODE__;
  return vm?.isMobile ?? (window.innerWidth < 600);
}

/** Check if features (station/buildings) on a body have been scanned. */
function isFeatureScanned(starIndex: number, bodyIndex: number): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn = (globalThis as any).__isFeatureScanned;
  return fn ? fn(starIndex, bodyIndex) : false;
}

/** Check if the planet surface has been scanned. */
function isPlanetScanned(starIndex: number, bodyIndex: number): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn = (globalThis as any).__isPlanetScanned;
  return fn ? fn(starIndex, bodyIndex) : false;
}

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
  skinId?: string,
) {
  const size = sizeOverride ?? SHIP_SIZE;

  // Try sprite-based rendering first (skip only if wireframe pref is on, or foreign ship explicitly uses procedural)
  const useWireframe = skinId === 'procedural' || (!skinId && getWireframePref());
  const sprite = !useWireframe ? getShipSprite(shape) : null;
  if (sprite) {
    const dpr = window.devicePixelRatio || 1;
    const screenW = r.width / dpr;
    const screenH = r.height / dpr;
    const screenPos = worldToScreen(pos, camera, screenW, screenH);
    const wpp = worldPerPixel(camera, screenH);
    const pixelSize = (size / wpp) * 4;
    const half = pixelSize / 2;
    r.ctx.save();
    r.ctx.translate(screenPos.x, screenPos.y);
    // Sprite nose points UP; angle=0 means ship faces RIGHT
    r.ctx.rotate(-(angle - Math.PI / 2));
    r.ctx.drawImage(sprite, -half, -half, pixelSize, pixelSize);
    r.ctx.restore();
    return;
  }

  const zs = zoomScale(camera);
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
  skinId?: string,
) {
  const color = GHOST_PALETTE[Math.abs(slot - 1) % GHOST_PALETTE.length] ?? G_BRIGHT;
  drawShip(r, camera, pos, angle, shape, color, undefined, skinId);
}

const TYPEID_TO_SHAPE: Record<number, ShipShape> = {
  1: 'scout', 2: 'frigate', 3: 'destroyer', 4: 'frigate', 5: 'battleship', 6: 'cruiser', 7: 'dreadnought',
  8: 'colony', 10: 'destroyer', 11: 'scout', 12: 'scout', 14: 'scout',
};

/** Draw parked player fleet ships at the current star in planet/system view. */
export function drawPlayerFleetAtStar(
  r: Renderer,
  camera: Camera,
  starIndex: number,
  stationWorldPos: Vec2,
) {
  const fleet = _serverShipsByStarIndex.get(starIndex);
  if (!fleet || fleet.ships.length === 0) return;

  ensureShipIconsLoaded();
  const FLEET_COLOR = '#4fffb0'; // green
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);

  // Exclude the player's active ship from fleet rendering (it's drawn separately)
  const SHAPE_TO_TYPE: Record<string, number> = {
    scout: 1, destroyer: 3, frigate: 4, battleship: 5, cruiser: 6, dreadnought: 7,
  };
  const activeShipTypeId = SHAPE_TO_TYPE[_panelsShipShape] ?? 1;
  let subtractedActive = false;

  let slotIdx = 0;
  let layoutCursor = 0;
  for (const entry of fleet.ships) {
    let count = entry.count;
    // Subtract player's active ship so it isn't drawn twice
    if (!subtractedActive && entry.typeId === activeShipTypeId && starIndex === _panelsStarIndex) {
      count -= 1;
      subtractedActive = true;
    }
    if (count <= 0) continue;
    const catalogEntry = SHIP_CATALOG[entry.typeId as keyof typeof SHIP_CATALOG];
    const countToDraw = Math.min(count, 3); // cap visual at 3 per type
    for (let i = 0; i < countToDraw; i++) {
      const shape = TYPEID_TO_SHAPE[entry.typeId] ?? 'scout';
      const isColony = shape === 'colony';
      const visualSpan = isColony ? 2.4 : 1;
      const visualSlot = layoutCursor + visualSpan / 2;
      // Offset ships upward (+Y world = up on screen) from station, spread out more
      const offsetAngle = Math.PI * 0.5 + (visualSlot - 1.5) * 0.48;
      const offsetDist = (isColony ? 1.05 : 0.5) + layoutCursor * 0.14;
      const pos = {
        x: stationWorldPos.x + Math.cos(offsetAngle) * offsetDist,
        y: stationWorldPos.y + Math.sin(offsetAngle) * offsetDist,
      };

      const sc = worldToScreen(pos, camera, screenW, screenH);
      const icon = !isColony && catalogEntry ? getShipIcon(catalogEntry.icon) : null;
      if (isColony) {
        const shipAngle = offsetAngle + Math.PI;
        drawShip(r, camera, pos, shipAngle, shape, FLEET_COLOR, SHIP_SIZE * 4);
      } else if (icon) {
        const iconSize = 28;
        ctx.drawImage(icon, sc.x - iconSize / 2, sc.y - iconSize / 2, iconSize, iconSize);
      } else {
        // Fallback wireframe
        const shipAngle = offsetAngle + Math.PI;
        drawShip(r, camera, pos, shipAngle, shape, FLEET_COLOR);
      }

      // Label on first ship of this type
      if (i === 0) {
        const label = catalogEntry ? `${catalogEntry.name}${entry.count > 1 ? ' x' + entry.count : ''}` : '';
        if (label) {
          ctx.save();
          ctx.font = f(9, 'bold');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = FLEET_COLOR;
          ctx.fillText(label, sc.x, sc.y - (isColony ? 48 : 20));
          ctx.restore();
        }
      }
      slotIdx++;
      layoutCursor += visualSpan;
    }
  }
}

/** Draw parked foreign (enemy) ships at the current star in planet/system view. */
export function drawForeignShipsAtStar(
  r: Renderer,
  camera: Camera,
  starIndex: number,
  stationWorldPos: Vec2,
) {
  const foreign = _foreignShipsByStarIndex.get(starIndex);
  if (!foreign || foreign.ships.length === 0) return;

  const ENEMY_COLOR = 'rgb(255, 80, 60)';
  const foreignSkinId = foreign.skinId;
  let slotIdx = 0;
  for (const entry of foreign.ships) {
    const shape = TYPEID_TO_SHAPE[entry.typeId] ?? 'destroyer';
    for (let i = 0; i < entry.count; i++) {
      // Offset each ship slightly from the station
      const offsetAngle = (Math.PI * 0.4) + slotIdx * 0.6;
      const offsetDist = 0.35 + slotIdx * 0.15;
      const pos = {
        x: stationWorldPos.x + Math.cos(offsetAngle) * offsetDist,
        y: stationWorldPos.y + Math.sin(offsetAngle) * offsetDist,
      };
      const shipAngle = offsetAngle + Math.PI; // face toward station
      const colonySize = shape === 'colony' ? SHIP_SIZE * 4 : undefined;
      drawShip(r, camera, pos, shipAngle, shape, ENEMY_COLOR, colonySize, foreignSkinId);

      // Label on first ship only
      if (slotIdx === 0) {
        const { ctx } = r;
        const screenW = r.width / (window.devicePixelRatio || 1);
        const screenH = r.height / (window.devicePixelRatio || 1);
        const labelSc = worldToScreen(pos, camera, screenW, screenH);
        ctx.save();
        ctx.font = f(10, 'bold');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = ENEMY_COLOR;
        ctx.fillText(foreign.owner, labelSc.x, labelSc.y - 10);
        ctx.restore();
      }
      slotIdx++;
    }
  }
}

/** Draw compact fuel/shields in the upper-left corner. Used across all tiers. */
export function drawShipStatus(r: Renderer, fuelUnits: number, fuelCapacity: number, shieldPercent: number): void {
  const { ctx } = r;
  ctx.save();
  ctx.font = f(12, 'bold');
  ctx.textBaseline = 'top';
  const y0 = 52; // below system info panel
  const fuelPct = fuelCapacity > 0 ? (fuelUnits / fuelCapacity) * 100 : 0;
  const fuelColor = fuelPct <= 25 ? '#FF5A3D' : '#4fffb0';
  ctx.fillStyle = fuelColor;
  ctx.fillText(`FUEL: ${Math.round(fuelPct)}% [${Math.round(fuelCapacity)}]`, 12, y0);
  const shieldColor = shieldPercent <= 33 ? '#FF5A3D' : '#4fffb0';
  ctx.fillStyle = shieldColor;
  ctx.fillText(`SHIELDS: ${Math.round(shieldPercent)}%`, 12, y0 + 14);
  ctx.restore();
}

export function drawHUD(
  r: Renderer,
  fuelUnits: number,
  fuelCapacity: number,
  fuelCollected: number,
  fuelTotal: number,
  lowFuelBlink: boolean,
  _elapsedTime: number,
) {
  const { ctx } = r;
  const screenW = r.width / (window.devicePixelRatio || 1);
  const screenH = r.height / (window.devicePixelRatio || 1);

  ctx.save();
  ctx.font = f(14, 'bold');
  ctx.textBaseline = 'top';

  // Fuel display
  const fuelPercent = fuelCapacity > 0 ? (fuelUnits / fuelCapacity) * 100 : 0;
  const isLow = fuelPercent <= 25;
  const fuelColor = isLow ? '#FF5A3D' : '#FFD24A';
  ctx.fillStyle = fuelColor;
  ctx.fillText(`FUEL: ${Math.round(fuelPercent)}% [${Math.round(fuelCapacity)}]`, 12, 12);

  ctx.fillStyle = '#FFD24A';
  ctx.fillText(`DOCKS: ${fuelCollected} / ${fuelTotal}`, 12, 30);

  if (isLow && lowFuelBlink) {
    ctx.fillStyle = '#FF5A3D';
    ctx.font = f(12, 'bold');
    ctx.fillText('⚠ LOW FUEL', 12, 50);
  }

  // Bottom hint bar
  ctx.font = f(11, '', 'sans-serif');
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(
    'Click/drag: set target  •  Right-click: clear  •  Zoom close to discover asteroids  •  Colored pods = different resources',
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
  ctx.font = f(13, 'bold', 'sans-serif');
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
  ctx.font = f(12, '', 'sans-serif');
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
  ctx.font = f(13, 'bold', 'sans-serif');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Shadow for readability
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillText(name, sc.x + 1, sc.y + 36);

  // Main text
  ctx.fillStyle = '#4fffb0';
  ctx.fillText(name, sc.x, sc.y + 35);
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
  ctx.font = f(14, 'bold');
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
  // On mobile, push buttons up so they don't overlap the orbit bar (barH=32 + 8px margin)
  const bottomOffset = isMobileView() ? 82 : 36;
  return {
    recenter: { x: screenW - 36, y: screenH - bottomOffset },
    zoom:     { x: screenW - 36 - 52, y: screenH - bottomOffset },
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

// ── Galaxy Zoom +/- Buttons (bottom-left) ───────────────────────────────────

const GZOOM_BTN_SIZE = 22;

function getGalaxyZoomBtnPositions(r: Renderer) {
  const dpr = window.devicePixelRatio || 1;
  const screenH = r.height / dpr;
  return {
    plus:  { x: 28, y: screenH - 68 },
    minus: { x: 28, y: screenH - 38 },
  };
}

export function drawGalaxyZoomButtons(r: Renderer, currentZoom: number, minZoom: number, maxZoom: number): void {
  const { ctx } = r;
  const pos = getGalaxyZoomBtnPositions(r);
  const canZoomIn = currentZoom > minZoom;
  const canZoomOut = currentZoom < maxZoom;

  ctx.save();

  // + button (zoom in)
  const pp = pos.plus;
  ctx.beginPath();
  roundedRect(ctx, pp.x - GZOOM_BTN_SIZE / 2, pp.y - GZOOM_BTN_SIZE / 2, GZOOM_BTN_SIZE, GZOOM_BTN_SIZE, 4);
  ctx.fillStyle = canZoomIn ? 'rgba(20, 80, 60, 0.8)' : 'rgba(20, 40, 35, 0.5)';
  ctx.fill();
  roundedRect(ctx, pp.x - GZOOM_BTN_SIZE / 2, pp.y - GZOOM_BTN_SIZE / 2, GZOOM_BTN_SIZE, GZOOM_BTN_SIZE, 4);
  ctx.strokeStyle = canZoomIn ? G_BRIGHT : G_DIM;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = canZoomIn ? G_BRIGHT : G_DIM;
  ctx.font = f(14, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', pp.x, pp.y);

  // - button (zoom out)
  const mp = pos.minus;
  ctx.beginPath();
  roundedRect(ctx, mp.x - GZOOM_BTN_SIZE / 2, mp.y - GZOOM_BTN_SIZE / 2, GZOOM_BTN_SIZE, GZOOM_BTN_SIZE, 4);
  ctx.fillStyle = canZoomOut ? 'rgba(20, 80, 60, 0.8)' : 'rgba(20, 40, 35, 0.5)';
  ctx.fill();
  roundedRect(ctx, mp.x - GZOOM_BTN_SIZE / 2, mp.y - GZOOM_BTN_SIZE / 2, GZOOM_BTN_SIZE, GZOOM_BTN_SIZE, 4);
  ctx.strokeStyle = canZoomOut ? G_BRIGHT : G_DIM;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = canZoomOut ? G_BRIGHT : G_DIM;
  ctx.font = f(14, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u2013', mp.x, mp.y); // en-dash for minus

  ctx.restore();
}

export type GalaxyZoomHit = 'zoomIn' | 'zoomOut' | null;

export function hitTestGalaxyZoomButtons(r: Renderer, screenX: number, screenY: number): GalaxyZoomHit {
  const pos = getGalaxyZoomBtnPositions(r);
  const hitR = GZOOM_BTN_SIZE / 2 + 6;

  const pdx = screenX - pos.plus.x;
  const pdy = screenY - pos.plus.y;
  if (pdx * pdx + pdy * pdy <= hitR * hitR) return 'zoomIn';

  const mdx = screenX - pos.minus.x;
  const mdy = screenY - pos.minus.y;
  if (mdx * mdx + mdy * mdy <= hitR * hitR) return 'zoomOut';

  return null;
}

// ── Admin Skin Toggle Button ────────────────────────────────────────────────

export function toggleSkin(): void {
  if (getActiveSkinId() === 'procedural') {
    preloadRasterSprites();
    setActiveSkin(rasterSkin);
  } else {
    setActiveSkin(proceduralSkin);
  }
}

const SKIN_BTN_W = 60;
const SKIN_BTN_H = 24;

function getSkinBtnPos(r: Renderer) {
  const dpr = window.devicePixelRatio || 1;
  const screenH = r.height / dpr;
  return { x: 10, y: screenH - 100 }; // above zoom buttons, left edge
}

export function drawSkinToggleButton(r: Renderer): void {
  if (!_isAdmin) return;
  const { ctx } = r;
  const pos = getSkinBtnPos(r);
  const label = getActiveSkinId() === 'procedural' ? 'WIRE' : 'STANDARD';
  ctx.save();
  ctx.beginPath();
  roundedRect(ctx, pos.x, pos.y, SKIN_BTN_W, SKIN_BTN_H, 4);
  ctx.fillStyle = 'rgba(80, 20, 120, 0.85)';
  ctx.fill();
  roundedRect(ctx, pos.x, pos.y, SKIN_BTN_W, SKIN_BTN_H, 4);
  ctx.strokeStyle = '#c090ff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#c090ff';
  ctx.font = f(11, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, pos.x + SKIN_BTN_W / 2, pos.y + SKIN_BTN_H / 2);
  ctx.restore();
}

export function hitTestSkinToggle(r: Renderer, screenX: number, screenY: number): boolean {
  if (!_isAdmin) return false;
  const pos = getSkinBtnPos(r);
  if (screenX >= pos.x && screenX <= pos.x + SKIN_BTN_W &&
      screenY >= pos.y && screenY <= pos.y + SKIN_BTN_H) {
    toggleSkin();
    return true;
  }
  return false;
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
import { generateSystem } from './galaxy';
import { buildGalaxyViewModel, getGalaxyStarTone } from './galaxy-view-model';
import { getEnabledResources, getFeatureResourceIds as _getFeatureResourceIds, getFeatureResourceNames } from './economy-catalog';
import { BODY_ENTER_RADIUS, SYSTEM_EXIT_RADIUS, SYSTEM_SIZE, FEATURE_LABELS, STAR_NAMES, PROBE_BASIC_RANGE, PROBE_ENHANCED_RANGE, PROBE_MIN_FUEL_COST } from './constants';
// ComsMessage type removed — DM system replaces old reddit-comment-based coms
import { isTradingStation } from '../shared/trading';
import { BUILDING_CATALOG } from '../shared/buildings';
import { getActiveSkinId, setActiveSkin, setSkinVariant, registerSkinDrawFn, getDrawFeatureIconForSkinId, getWireframePref } from './skin';
import { proceduralSkin } from './skins/procedural';
import { rasterSkin, preloadRasterSprites, getPlanetSprite, getCartoonStationSprite } from './skins/raster';
import { preloadScifiSprites, getScifiStationSprite, getScifiSolarArraySprite, getScifiHabSprite, getScifiDockSprite, getScifiCannonSprite, scifiSkin } from './skins/scifi';

// Register skin draw functions for cross-player rendering
registerSkinDrawFn('procedural', proceduralSkin.drawFeatureIcon);
registerSkinDrawFn('raster', rasterSkin.drawFeatureIcon);
registerSkinDrawFn('scifi', scifiSkin.drawFeatureIcon);

// ── Monochrome green palette (sci-fi terminal) ─────────────────────────────
const G_BRIGHT = '#4fffb0';        // primary bright green
const G_MED    = 'rgba(79, 255, 176, 0.6)';
const G_DIM    = 'rgba(79, 255, 176, 0.25)';
const G_FAINT  = 'rgba(79, 255, 176, 0.10)';
// Resource costs are read at a glance, so they stay legible even when unaffordable.
const G_COST     = 'rgba(79, 255, 176, 0.9)';
const G_COST_OFF = 'rgba(79, 255, 176, 0.55)';
const JUMP_LINK_MAX = 18; // max world-distance for jump link lines

/** Draw a lens-flare starburst at screen coords */
function drawStarburst(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  coreR: number,
  rayLen: number,
  brightness: number, // 0-1
  palette: 'green' | 'blue' | 'white' | 'red' | 'orange' | 'yellow' | 'cyan' | 'dim' = 'green',
  cardinalBoost = 1,
) {
  // Guard against non-finite values (can happen on first frame after tier change)
  if (!isFinite(x) || !isFinite(y) || !isFinite(coreR) || !isFinite(rayLen)) return;
  const a = 0.4 + brightness * 0.6;
  const cBright = palette === 'blue'
    ? '110, 190, 255'
    : palette === 'white'
      ? '245, 250, 255'
      : palette === 'red'
        ? '255, 100, 80'
        : palette === 'orange'
          ? '255, 180, 60'
          : palette === 'yellow'
            ? '255, 230, 60'
            : palette === 'cyan'
              ? '100, 220, 240'
              : palette === 'dim'
                ? '60, 80, 70'
                : '79, 255, 176';
  const cMid = palette === 'blue'
    ? '150, 215, 255'
    : palette === 'white'
      ? '220, 235, 250'
      : palette === 'red'
        ? '255, 150, 130'
        : palette === 'orange'
          ? '255, 200, 120'
          : palette === 'yellow'
            ? '255, 240, 120'
            : palette === 'cyan'
              ? '150, 230, 245'
              : palette === 'dim'
                ? '50, 65, 55'
                : '150, 255, 210';
  const cSoft = palette === 'blue'
    ? '30, 70, 120'
    : palette === 'white'
      ? '80, 95, 115'
      : palette === 'red'
        ? '120, 30, 20'
        : palette === 'orange'
          ? '120, 70, 10'
          : palette === 'yellow'
            ? '120, 110, 10'
            : palette === 'cyan'
              ? '20, 90, 110'
              : palette === 'dim'
                ? '20, 30, 25'
                : '30, 120, 80';
  const cBloom = palette === 'blue'
    ? '180, 220, 255'
    : palette === 'white'
      ? '238, 246, 255'
      : palette === 'red'
        ? '255, 180, 160'
        : palette === 'orange'
          ? '255, 220, 150'
          : palette === 'yellow'
            ? '255, 245, 150'
            : palette === 'cyan'
              ? '180, 240, 250'
              : palette === 'dim'
                ? '50, 65, 55'
                : '180, 255, 220';
  const cCore = palette === 'blue'
    ? '170, 220, 255'
    : palette === 'white'
      ? '245, 250, 255'
      : palette === 'red'
        ? '255, 160, 140'
        : palette === 'orange'
          ? '255, 210, 120'
          : palette === 'yellow'
            ? '255, 240, 120'
            : palette === 'cyan'
              ? '170, 235, 250'
              : palette === 'dim'
                ? '50, 65, 55'
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
const _validTransferTargets: Set<number> = new Set();
let _pendingTransfer: { fromStarIndex: number; toStarIndex: number; shipTypeId: number; count: number } | null = null;
let _transferCancelButton: { x: number; y: number; w: number; h: number } | null = null;

/** Enter transfer mode (called from fleet panel SEND button). */
export function enterTransferMode(fromStarIndex: number, shipTypeId: number): void {
  // Probes require base fuel
  if (shipTypeId === 11 || shipTypeId === 12) {
    const available = getBaseFuel(fromStarIndex);
    if (available < PROBE_MIN_FUEL_COST) {
      _lockFlash = { action: `NEED ${PROBE_MIN_FUEL_COST} FUEL (HAVE ${Math.floor(available)})`, expireMs: Date.now() + 3000 };
      playSound('click');
      return;
    }
  }
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
  if (_validTransferTargets.size > 0 && !_validTransferTargets.has(toStarIndex)) return; // not a valid target
  _pendingTransfer = {
    fromStarIndex: _transferMode.fromStarIndex,
    toStarIndex,
    shipTypeId: _transferMode.shipTypeId,
    count: 1,
  };
  if (_transferMode.shipTypeId === 8) colonizationTopicAction('colony_sent', toStarIndex);
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

// ── Star Selection / Info Card ──────────────────────────────────────────────
let _selectedStarIndex: number = -1;
let _starInfoDismissBtn: { x: number; y: number; w: number; h: number } | null = null;
let _starInfoVisitBtn: { x: number; y: number; w: number; h: number } | null = null;

// ── Galaxy Mode (NAV vs FLEET COMMAND) ──────────────────────────────────────
export type GalaxyMode = 'nav' | 'fleet';
let _galaxyMode: GalaxyMode = 'nav';
let _galaxyModeBtn: { x: number; y: number; w: number; h: number } | null = null;

export function getGalaxyMode(): GalaxyMode { return _galaxyMode; }
export function setGalaxyMode(mode: GalaxyMode): void { _galaxyMode = mode; }
export function toggleGalaxyMode(): void { _galaxyMode = _galaxyMode === 'nav' ? 'fleet' : 'nav'; }
export function hitTestGalaxyModeBtn(sx: number, sy: number): boolean {
  if (!_galaxyModeBtn) return false;
  const b = _galaxyModeBtn;
  return sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h;
}

/** Select a star to show its info card. */
export function selectGalaxyStar(starIndex: number): void {
  _selectedStarIndex = starIndex;
}

/** Deselect the current star info card. */
export function deselectGalaxyStar(): void {
  _selectedStarIndex = -1;
  _starInfoDismissBtn = null;
  _starInfoVisitBtn = null;
}

/** Get currently selected star index (-1 if none). */
export function getSelectedStarIndex(): number {
  return _selectedStarIndex;
}

/** Hit-test the star info card dismiss button. */
export function hitTestStarInfoDismiss(sx: number, sy: number): boolean {
  if (!_starInfoDismissBtn) return false;
  const b = _starInfoDismissBtn;
  return sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h;
}

/** Hit-test the star info card VISIT button. */
export function hitTestStarInfoVisit(sx: number, sy: number): boolean {
  if (!_starInfoVisitBtn) return false;
  const b = _starInfoVisitBtn;
  return sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h;
}

// ── Galaxy Mode Toggle Button ───────────────────────────────────────────────

const MODE_BTN_W = 80;
const MODE_BTN_H = 22;

export function drawGalaxyModeToggle(r: Renderer): void {
  const { ctx } = r;
  const dpr = window.devicePixelRatio || 1;
  const screenH = r.height / dpr;
  // Position above the zoom buttons (bottom-left)
  const btnX = 28 - MODE_BTN_W / 2;
  const btnY = screenH - 115;

  const isFleet = _galaxyMode === 'fleet';
  const label = isFleet ? '⚓ FLEET' : '🧭 NAV';
  const bgColor = isFleet ? 'rgba(80, 40, 10, 0.85)' : 'rgba(10, 50, 40, 0.85)';
  const borderColor = isFleet ? 'rgba(255, 180, 80, 0.9)' : G_BRIGHT;
  const textColor = isFleet ? 'rgba(255, 200, 100, 1.0)' : G_BRIGHT;

  ctx.save();
  roundedRect(ctx, btnX, btnY, MODE_BTN_W, MODE_BTN_H, 4);
  ctx.fillStyle = bgColor;
  ctx.fill();
  roundedRect(ctx, btnX, btnY, MODE_BTN_W, MODE_BTN_H, 4);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = f(10, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, btnX + MODE_BTN_W / 2, btnY + MODE_BTN_H / 2);
  ctx.restore();

  _galaxyModeBtn = { x: btnX, y: btnY, w: MODE_BTN_W, h: MODE_BTN_H };

  // Escape hatch — always available so no panel state can strand the player here.
  const exitY = btnY - MODE_BTN_H - 6;
  ctx.save();
  roundedRect(ctx, btnX, exitY, MODE_BTN_W, MODE_BTN_H, 4);
  ctx.fillStyle = 'rgba(10, 30, 50, 0.85)';
  ctx.fill();
  roundedRect(ctx, btnX, exitY, MODE_BTN_W, MODE_BTN_H, 4);
  ctx.strokeStyle = 'rgba(120, 200, 255, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(160, 215, 255, 1.0)';
  ctx.font = f(10, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('◄ SYSTEM', btnX + MODE_BTN_W / 2, exitY + MODE_BTN_H / 2);
  ctx.restore();

  _galaxyExitBtn = { x: btnX, y: exitY, w: MODE_BTN_W, h: MODE_BTN_H };
}

let _galaxyExitBtn: { x: number; y: number; w: number; h: number } | null = null;

/** Hit-test the galaxy "return to system" escape hatch. */
export function hitTestGalaxyExitBtn(sx: number, sy: number): boolean {
  if (!_galaxyExitBtn) return false;
  const b = _galaxyExitBtn;
  if (sx < b.x || sx > b.x + b.w || sy < b.y || sy > b.y + b.h) return false;
  closeAllPanels();
  playSound('click');
  return true;
}

/** Draw a mode banner at the top of the galaxy view */
export function drawGalaxyModeBanner(r: Renderer): void {
  const { ctx } = r;
  const dpr = window.devicePixelRatio || 1;
  const screenW = r.width / dpr;
  const isFleet = _galaxyMode === 'fleet';

  const bannerText = isFleet ? 'FLEET COMMAND' : 'NAVIGATION';
  const bannerColor = isFleet ? 'rgba(255, 180, 80, 0.9)' : G_BRIGHT;
  const lineColor = isFleet ? 'rgba(255, 140, 40, 0.3)' : 'rgba(79, 255, 176, 0.2)';

  ctx.save();
  // Thin accent line across the top
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 44);
  ctx.lineTo(screenW, 44);
  ctx.stroke();

  // Mode label (below the GALAXY tier HUD)
  ctx.font = f(9);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = bannerColor;
  ctx.fillText(`[ ${bannerText} ]`, screenW / 2, 30);
  ctx.restore();
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
  const screenStars: { star: GalaxyStar; tone: StarVisualTone; sx: number; sy: number }[] = [];
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
      ctx.font = f(10, 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      if (tone === 'blue') {
        ctx.fillStyle = dist < 15 ? 'rgb(165, 220, 255)' : 'rgba(120, 185, 245, 0.85)';
      } else if (tone === 'white') {
        ctx.fillStyle = dist < 15 ? 'rgb(240, 248, 255)' : 'rgba(210, 225, 240, 0.85)';
      } else if (tone === 'red') {
        ctx.fillStyle = dist < 15 ? 'rgb(255, 130, 110)' : 'rgba(255, 100, 80, 0.85)';
      } else if (tone === 'cyan') {
        ctx.fillStyle = dist < 15 ? 'rgb(100, 220, 240)' : 'rgba(80, 200, 220, 0.85)';
      } else if (tone === 'yellow') {
        ctx.fillStyle = dist < 15 ? 'rgb(255, 240, 100)' : 'rgba(255, 230, 60, 0.85)';
      } else {
        ctx.fillStyle = dist < 15 ? G_BRIGHT : G_MED;
      }
      ctx.fillText(star.name, sx, sy + rayLen + 4);

      // ── Trading station icon (only after probed/visited) ──
      if (_postId && isTradingStation(_postId, star.index) && star.discoveryLevel !== 'none') {
        ctx.font = f(9, 'bold');
        ctx.fillStyle = 'rgb(255, 215, 0)'; // gold
        ctx.fillText('⚖', sx, sy - rayLen - 6);
      }

      // ── Fleet badge ──
      const fleetState = _serverShipsByStarIndex.get(star.index);
      if (fleetState && fleetState.ships.length > 0) {
        const totalShips = fleetState.ships.reduce((sum, s) => sum + s.count, 0);
        if (totalShips > 0) {
          const badgeText = `${totalShips}`;
          ctx.font = f(7, 'bold');
          const tw = ctx.measureText(badgeText).width;
          const bw = tw + 6;
          const bh = 10;
          const bx = sx + rayLen + 2;
          const by = sy - bh / 2;
          ctx.fillStyle = 'rgba(0, 10, 5, 0.8)';
          roundedRect(ctx, bx, by, bw, bh, 3);
          ctx.fill();
          ctx.strokeStyle = G_MED;
          ctx.lineWidth = 0.5;
          roundedRect(ctx, bx, by, bw, bh, 3);
          ctx.stroke();
          ctx.fillStyle = G_BRIGHT;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, bx + bw / 2, by + bh / 2);
        }
      }

      // ── Foreign fleet badge (red) — only show if star is discovered ──
      const foreignFleet = star.discoveryLevel !== 'none' ? _foreignShipsByStarIndex.get(star.index) : undefined;
      if (foreignFleet && foreignFleet.ships.length > 0) {
        const totalForeign = foreignFleet.ships.reduce((sum, s) => sum + s.count, 0);
        if (totalForeign > 0) {
          const fbText = `${totalForeign}`;
          ctx.font = f(7, 'bold');
          const ftw = ctx.measureText(fbText).width;
          const fbw = ftw + 6;
          const fbh = 10;
          // Position below the player's badge (or to the right if no player badge)
          const fbx = sx + rayLen + 2;
          const fby = sy + (fleetState && fleetState.ships.length > 0 ? 8 : -fbh / 2);
          ctx.fillStyle = 'rgba(30, 5, 5, 0.8)';
          roundedRect(ctx, fbx, fby, fbw, fbh, 3);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 80, 60, 0.8)';
          ctx.lineWidth = 0.5;
          roundedRect(ctx, fbx, fby, fbw, fbh, 3);
          ctx.stroke();
          ctx.fillStyle = 'rgb(255, 100, 80)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(fbText, fbx + fbw / 2, fby + fbh / 2);
        }
      }

      ctx.restore();
    }
  }

  // ── Transit lines (animated dashes) ──
  if (_serverTransits.length > 0) {
    const now = Date.now();
    const dashPhase = (performance.now() * 0.05) % 20; // animated offset
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -dashPhase;
    for (const t of _serverTransits) {
      // Look up star world positions directly (don't rely on screenStars which culls off-screen)
      const fromStarData = galaxy.stars[t.fromStarIndex];
      const toStarData = galaxy.stars[t.toStarIndex];
      if (!fromStarData || !toStarData) continue;
      const fromSc = worldToScreen(fromStarData.pos, camera, screenW, screenH);
      const toSc = worldToScreen(toStarData.pos, camera, screenW, screenH);

      // Draw dashed line
      ctx.strokeStyle = 'rgba(255, 184, 77, 0.5)'; // AMBER
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fromSc.x, fromSc.y);
      ctx.lineTo(toSc.x, toSc.y);
      ctx.stroke();

      // Draw moving ship icon along the line
      const elapsed = now - t.departedAt;
      const total = t.arrivalAt - t.departedAt;
      const progress = Math.min(1, Math.max(0, elapsed / total));
      const dotX = fromSc.x + (toSc.x - fromSc.x) * progress;
      const dotY = fromSc.y + (toSc.y - fromSc.y) * progress;

      ctx.setLineDash([]);
      const catalogEntry = SHIP_CATALOG[t.shipTypeId as keyof typeof SHIP_CATALOG];
      const shipIcon = catalogEntry ? getShipIcon(catalogEntry.icon) : null;
      if (shipIcon) {
        const iconSize = 16;
        ctx.drawImage(shipIcon, dotX - iconSize / 2, dotY - iconSize / 2, iconSize, iconSize);
      } else {
        // Fallback dot if icon not loaded
        ctx.fillStyle = '#ffb84d';
        ctx.beginPath();
        ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -dashPhase;
    }
    ctx.restore();
  }

  // ── Sector title (top-left) ──
  ctx.save();
  ctx.font = f(17, 'bold');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText('KORVUS SECTOR', 14, 14);
  ctx.font = f(11);
  ctx.fillStyle = G_MED;
  ctx.fillText('LOCAL STAR MAP', 14, 34);
  // Home star indicator
  const homeStar = galaxy.stars[galaxy.homeStarIndex];
  if (homeStar) {
    ctx.font = f(10);
    ctx.fillStyle = 'rgba(79, 255, 176, 0.85)';
    ctx.fillText(`HOME: ${homeStar.name.toUpperCase()}`, 14, 50);
  }
  ctx.restore();

  // ── Transfer mode indicator ──
  if (_transferMode) {
    const fromEntry = SHIP_CATALOG[_transferMode.shipTypeId as keyof typeof SHIP_CATALOG];
    const shipName = fromEntry?.name ?? 'Ship';

    // Draw pulsing rings around valid target stars (filtered by ship type)
    const t = performance.now() * 0.003;
    const pulse = 0.5 + 0.5 * Math.sin(t);
    _validTransferTargets.clear();
    for (const s of screenStars) {
      if (s.star.index === _transferMode.fromStarIndex) continue;
      // Freighter (2): player-owned stars OR trading stations (if discovered)
      if (_transferMode.shipTypeId === 2) {
        const isTradeTarget = _postId && isTradingStation(_postId, s.star.index) && s.star.discoveryLevel !== 'none';
        if (s.star.owner !== 'player' && !isTradeTarget) continue;
      }
      // Colony Ship (8): only probed/visited + not player-owned
      if (_transferMode.shipTypeId === 8) {
        if (s.star.discoveryLevel === 'none' || s.star.owner === 'player') continue;
      }
      // Probes (11, 12): only unvisited or foreign-owned, within range
      if (_transferMode.shipTypeId === 11 || _transferMode.shipTypeId === 12) {
        if (s.star.discoveryLevel !== 'none' && s.star.owner !== 'foreign') continue;
        // Range check
        const srcStar2 = galaxy.stars[_transferMode.fromStarIndex];
        if (srcStar2) {
          const dx2 = s.star.pos.x - srcStar2.pos.x;
          const dy2 = s.star.pos.y - srcStar2.pos.y;
          const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          const maxRange = _transferMode.shipTypeId === 12 ? PROBE_ENHANCED_RANGE : PROBE_BASIC_RANGE;
          if (dist > maxRange) continue;
        }
      }
      // Raider (15): only foreign-owned stars (claimed by other players)
      if (_transferMode.shipTypeId === 15) {
        if (s.star.owner !== 'foreign') continue;
      }
      _validTransferTargets.add(s.star.index);
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
    ctx.font = f(10, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = G_BRIGHT;
    const isFreighter = _transferMode!.shipTypeId === 2;
    const isRaider = _transferMode!.shipTypeId === 15;
    const isProbe = _transferMode!.shipTypeId === 11 || _transferMode!.shipTypeId === 12;
    const bannerText = isFreighter
      ? `ASSIGN TRADE ROUTE — TAP PICKUP STAR`
      : isRaider
        ? `RAID TARGET — TAP ENEMY STAR`
        : isProbe
          ? `SENDING ${shipName.toUpperCase()} (⛽${PROBE_MIN_FUEL_COST}) — TAP DESTINATION`
          : `SENDING ${shipName.toUpperCase()} — TAP DESTINATION STAR`;
    ctx.fillText(bannerText, screenW / 2, screenH - bannerH / 2 - 2);

    // Cancel button
    const cancelW = 60;
    const cancelX = screenW - cancelW - 12;
    const cancelY = screenH - bannerH - 2;
    ctx.strokeStyle = 'rgba(255, 100, 80, 0.8)';
    ctx.lineWidth = 1;
    roundedRect(ctx, cancelX, cancelY, cancelW, 18, 3);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 100, 80, 0.9)';
    ctx.font = f(8, 'bold');
    ctx.fillText('CANCEL', cancelX + cancelW / 2, cancelY + 9);
    ctx.restore();

    // Store cancel button rect for hit testing
    _transferCancelButton = { x: cancelX, y: cancelY, w: cancelW, h: 18 };
  } else {
    _transferCancelButton = null;
  }

  // ── Star Info Card ──
  if (_selectedStarIndex >= 0 && !_transferMode) {
    const selEntry = screenStars.find(s => s.star.index === _selectedStarIndex);
    if (selEntry) {
      const star = selEntry.star;
      const { sx: starSx, sy: starSy } = selEntry;

      // Selection ring
      ctx.save();
      const pulse = Math.sin(performance.now() * 0.004) * 0.3 + 0.7;
      ctx.strokeStyle = `rgba(79, 255, 176, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(starSx, starSy, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Info card dimensions
      const cardW = 180;
      const cardH = 110;
      // Position card to the right of star, or left if too close to edge
      let cardX = starSx + 24;
      let cardY = starSy - cardH / 2;
      if (cardX + cardW > screenW - 10) cardX = starSx - cardW - 24;
      if (cardY < 10) cardY = 10;
      if (cardY + cardH > screenH - 10) cardY = screenH - cardH - 10;

      // Card background
      ctx.save();
      ctx.fillStyle = 'rgba(0, 12, 8, 0.92)';
      roundedRect(ctx, cardX, cardY, cardW, cardH, 4);
      ctx.fill();
      ctx.strokeStyle = G_MED;
      ctx.lineWidth = 1;
      roundedRect(ctx, cardX, cardY, cardW, cardH, 4);
      ctx.stroke();

      // Dismiss X button (top-right corner of card)
      const xBtnSize = 14;
      const xBtnX = cardX + cardW - xBtnSize - 4;
      const xBtnY = cardY + 4;
      _starInfoDismissBtn = { x: xBtnX, y: xBtnY, w: xBtnSize, h: xBtnSize };
      ctx.fillStyle = 'rgba(255, 100, 80, 0.7)';
      ctx.font = f(10, 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✕', xBtnX + xBtnSize / 2, xBtnY + xBtnSize / 2);

      // Star name (hide for undiscovered)
      ctx.font = f(11, 'bold');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = G_BRIGHT;
      ctx.fillText(star.name, cardX + 8, cardY + 8);

      // Discovery status
      let statusText = 'UNEXPLORED';
      let statusColor = 'rgba(255, 240, 100, 0.9)'; // yellow
      if (star.index === galaxy.homeStarIndex) {
        statusText = 'HOME SYSTEM';
        statusColor = 'rgba(120, 200, 255, 0.9)'; // blue
      } else if (star.owner === 'player') {
        statusText = 'OWNED';
        statusColor = 'rgba(120, 200, 255, 0.9)'; // blue
      } else if (star.owner === 'foreign') {
        statusText = star.claimedBy ? `CLAIMED: ${star.claimedBy}` : 'CLAIMED';
        statusColor = 'rgba(255, 180, 80, 0.9)'; // orange
      } else if (star.discoveryLevel === 'visited') {
        statusText = 'VISITED';
        statusColor = 'rgba(79, 255, 176, 0.9)'; // green
      } else if (star.discoveryLevel === 'probed') {
        statusText = 'PROBED';
        statusColor = 'rgba(100, 220, 240, 0.9)'; // cyan
      }
      ctx.font = f(9);
      ctx.fillStyle = statusColor;
      ctx.fillText(statusText, cardX + 8, cardY + 24);

      // Distance from ship
      const dx = star.pos.x - shipPos.x;
      const dy = star.pos.y - shipPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      ctx.fillStyle = G_MED;
      ctx.fillText(`DIST: ${dist.toFixed(1)} ly`, cardX + 8, cardY + 38);

      // Planet / belt count — only show if probed or visited
      const isExplored = star.index === galaxy.homeStarIndex || star.discoveryLevel === 'probed' || star.discoveryLevel === 'visited';
      if (isExplored) {
        const sysBodies = generateSystem(star, _postId);
        const planetCount = sysBodies.filter(b => b.type === 'planet').length;
        const beltCount = sysBodies.filter(b => b.type === 'belt').length;
        const bodyParts: string[] = [];
        if (planetCount > 0) bodyParts.push(`${planetCount} planet${planetCount > 1 ? 's' : ''}`);
        if (beltCount > 0) bodyParts.push(`${beltCount} belt${beltCount > 1 ? 's' : ''}`);
        ctx.fillText(bodyParts.join(', ') || 'EMPTY', cardX + 8, cardY + 52);
      } else {
        ctx.fillStyle = G_DIM;
        ctx.fillText('SYSTEM DATA UNKNOWN', cardX + 8, cardY + 52);
      }

      // Fleet info if available
      const fleetInfo = _serverShipsByStarIndex.get(star.index);
      if (fleetInfo && fleetInfo.ships.length > 0) {
        const totalShips = fleetInfo.ships.reduce((sum, s) => sum + s.count, 0);
        ctx.fillStyle = G_BRIGHT;
        ctx.fillText(`FLEET: ${totalShips} ship${totalShips > 1 ? 's' : ''}`, cardX + 8, cardY + 66);
      } else {
        ctx.fillStyle = G_DIM;
        ctx.fillText('NO FLEET', cardX + 8, cardY + 66);
      }

      // VISIT button
      const vBtnW = cardW - 16;
      const vBtnH = 16;
      const vBtnX = cardX + 8;
      const vBtnY = cardY + cardH - vBtnH - 6;
      ctx.fillStyle = 'rgba(79, 255, 176, 0.15)';
      roundedRect(ctx, vBtnX, vBtnY, vBtnW, vBtnH, 3);
      ctx.fill();
      ctx.strokeStyle = G_BRIGHT;
      ctx.lineWidth = 1;
      roundedRect(ctx, vBtnX, vBtnY, vBtnW, vBtnH, 3);
      ctx.stroke();
      ctx.fillStyle = G_BRIGHT;
      ctx.font = f(9, 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u21D2 VISIT', vBtnX + vBtnW / 2, vBtnY + vBtnH / 2);
      ctx.textAlign = 'left';
      _starInfoVisitBtn = { x: vBtnX, y: vBtnY, w: vBtnW, h: vBtnH };

      ctx.restore();
    } else {
      // Star not visible on screen — deselect
      _selectedStarIndex = -1;
      _starInfoDismissBtn = null;
      _starInfoVisitBtn = null;
    }
  } else if (_selectedStarIndex < 0) {
    _starInfoDismissBtn = null;
    _starInfoVisitBtn = null;
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
function drawFeatureIcon(ctx: CanvasRenderingContext2D, x: number, y: number, type: FeatureType, size: number, level?: number, skinId?: string) {
  getDrawFeatureIconForSkinId(skinId)(ctx, x, y, type, size, level);
}

// ── System view label placement ──────────────────────────────────────────────
// Star and body names are drawn at fixed offsets, so they collide whenever two
// bodies line up. Each label reserves a box and later ones step vertically until
// they find clear space.
let _sysLabelBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];

function resetSysLabels(): void {
  _sysLabelBoxes = [];
}

/** Reserve space for a left-aligned, middle-baseline label. Returns the y to draw at. */
function reserveSysLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): number {
  const w = ctx.measureText(text).width;
  const h = 11;
  const step = 12;
  for (let i = 0; i < 12; i++) {
    // Alternate below/above the preferred position: 0, +12, -12, +24, ...
    const dy = Math.ceil(i / 2) * step * (i % 2 === 0 ? -1 : 1);
    const ty = y + dy;
    const box = { x, y: ty - h / 2, w, h };
    const clash = _sysLabelBoxes.some((b) =>
      box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y);
    if (!clash) {
      _sysLabelBoxes.push(box);
      return ty;
    }
  }
  _sysLabelBoxes.push({ x, y: y - h / 2, w, h });
  return y;
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

  resetSysLabels();

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
  ctx.font = f(11, 'bold');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  if (starTone === 'blue') {
    ctx.fillStyle = 'rgb(165, 220, 255)';
  } else if (starTone === 'white') {
    ctx.fillStyle = 'rgb(240, 248, 255)';
  } else if (starTone === 'red') {
    ctx.fillStyle = 'rgb(255, 130, 110)';
  } else if (starTone === 'cyan') {
    ctx.fillStyle = 'rgb(100, 220, 240)';
  } else if (starTone === 'yellow') {
    ctx.fillStyle = 'rgb(255, 240, 100)';
  } else {
    ctx.fillStyle = G_BRIGHT;
  }
  ctx.fillText(starName, starSc.x + starRadPx * 4, reserveSysLabel(ctx, starName, starSc.x + starRadPx * 4, starSc.y));
  ctx.restore();

  // ── 3. Bodies (planets & belts) ──
  for (const body of bodies) {
    const sc = worldToScreen(body.pos, camera, screenW, screenH);
    const radPx = Math.max(4, (body.radius / wpp) * 3);

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
      ctx.font = f(9);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = G_MED;
      // Place label at top of belt arc
      const labelX = starSc.x;
      const labelY = starSc.y - beltPx * 0.55 - 4;
      ctx.fillText(body.name, labelX + 4, reserveSysLabel(ctx, body.name, labelX + 4, labelY));
      ctx.restore();
    } else {
      // Planet — raster sprite if scanned, wireframe otherwise
      const bodyScanned = isPlanetScanned(galaxy.currentStarIndex, body.index);
      const planetSprite = bodyScanned ? getPlanetSprite(body.seed) : null;

      if (planetSprite) {
        // Raster planet sprite
        const drawSize = radPx * 2.4;
        ctx.drawImage(planetSprite, sc.x - drawSize / 2, sc.y - drawSize / 2, drawSize, drawSize);
      } else {
        // Procedural wireframe planet
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
      }
      // Planet name
      ctx.save();
      ctx.font = f(10);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = G_BRIGHT;
      const nameX = sc.x + radPx + 5;
      ctx.fillText(body.name, nameX, reserveSysLabel(ctx, body.name, nameX, sc.y));
      ctx.restore();

      // The colonization API currently defaults to body 0.
      const colonyTarget = getColonizationTopicTarget();
      const colonyFleet = colonyTarget === galaxy.currentStarIndex ? _serverShipsByStarIndex.get(colonyTarget) : null;
      const hasColonyShip = colonyFleet?.ships.some((ship) => ship.typeId === 8 && ship.count > 0) ?? false;
      if (body.index === 0 && hasColonyShip && isColonizationTopicActive()) {
        ctx.save();
        ctx.font = f(8, 'bold');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffb84d';
        ctx.fillText('COLONY SHIP -> LAND HERE', nameX, sc.y + radPx + 14);
        ctx.restore();
      }

      // Station icons orbiting this planet (small markers in system view)
      const stationFeats = body.features.filter(f => f.type === 'station');
      for (const feat of stationFeats) {
        const fDist = (radPx + 8); // offset in pixels from planet center
        const fx = sc.x + Math.cos(feat.angle) * fDist;
        const fy = sc.y + Math.sin(feat.angle) * fDist * 0.55; // match ellipse perspective
        drawFeatureIcon(ctx, fx, fy, 'station', 5);
      }

      // Draw player fleet ship icons near first planet in system view
      if (star && body.index === 0) {
        const fleet = _serverShipsByStarIndex.get(star.index);
        if (fleet && fleet.ships.length > 0) {
          ensureShipIconsLoaded();
          let iconSlot = 0;
          for (const entry of fleet.ships) {
            if (entry.count <= 0) continue;
            const catalogEntry = SHIP_CATALOG[entry.typeId as keyof typeof SHIP_CATALOG];
            const icon = catalogEntry ? getShipIcon(catalogEntry.icon) : null;
            if (icon) {
              const iconSize = 20;
              const offsetX = sc.x + radPx + 20 + iconSlot * (iconSize + 4);
              const offsetY = sc.y - iconSize / 2;
              ctx.drawImage(icon, offsetX, offsetY, iconSize, iconSize);
              if (entry.count > 1) {
                ctx.save();
                ctx.font = f(7, 'bold');
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillStyle = '#4fffb0';
                ctx.fillText(`x${entry.count}`, offsetX + iconSize + 1, offsetY + iconSize - 8);
                ctx.restore();
              }
            }
            iconSlot++;
          }
        }
      }
    }
  }

  // ── 4. System title panel (top-left) ──
  ctx.save();
  // Starburst icon
  drawStarburst(ctx, 24, 18, 3, 8, 0.8);
  ctx.font = f(14, 'bold');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(`${starName.toUpperCase()} SYSTEM`, 38, 12);
  ctx.font = f(10);
  ctx.fillStyle = G_MED;
  ctx.fillText('LOCAL NAVIGATION', 38, 30);

  // System metadata
  const starClass = ['O5V', 'B3V', 'A2V', 'F8V', 'G2V', 'K1V', 'M4V'][(star?.seed ?? 0) % 7];
  const sysId = `${starName.substring(0, 2).toUpperCase()}-${((star?.seed ?? 0) % 9000 + 1000)}`;
  ctx.font = f(9);
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

  ctx.font = f(9, 'bold');
  ctx.fillStyle = G_BRIGHT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('LEGEND', legX + 8, legY + 6);

  const items = [
    { label: 'STAR', draw: () => drawStarburst(ctx, legX + 16, legY + 24, 2, 5, 0.8) },
    { label: 'PLANET', draw: () => { ctx.beginPath(); ctx.arc(legX + 16, legY + 40, 4, 0, Math.PI * 2); ctx.strokeStyle = G_BRIGHT; ctx.lineWidth = 1; ctx.stroke(); } },
    { label: 'BELT', draw: () => { ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(legX + 12 + i * 3, legY + 54); ctx.arc(legX + 12 + i * 3, legY + 54, 1.2, 0, Math.PI * 2); } ctx.fillStyle = G_DIM; ctx.fill(); } },
  ];
  ctx.font = f(9);
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

  ctx.font = f(9, 'bold');
  ctx.fillStyle = G_BRIGHT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('SYSTEM INFO', infoX + 8, infoY + 6);

  ctx.font = f(8);
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
  _shipPos: Vec2,
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
  ctx.font = f(9);
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
    ctx.font = f(8);
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
    ctx.font = f(8);
    ctx.fillStyle = 'rgba(255, 200, 50, 0.8)';
    ctx.textAlign = 'center';
    ctx.fillText(`BELT ±${beltTolerance} (d=${body.orbitDist.toFixed(1)})`, starSc.x, starSc.y - outerPx - 4);
  }

  ctx.restore();
}

// ── Planet Debug Bounds ──────────────────────────────────────────────────────

import { DOCK_TRIGGER_RADIUS, DOCK_FEATURE_RADIUS, setDockFeatureProvider } from './dock';
export function drawPlanetDebugBounds(
  r: Renderer,
  camera: Camera,
  galaxy: GalaxyState,
  _shipPos: Vec2,
  worldOffset: Vec2,
) {
  const { ctx } = r;
  const dpr = window.devicePixelRatio || 1;
  const screenW = r.width / dpr;
  const screenH = r.height / dpr;
  const wpp = worldPerPixel(camera, screenH);

  const body = galaxy.bodies[galaxy.currentBodyIndex];
  if (!body) return;

  const features = getEffectiveFeatures(body, galaxy.currentStarIndex, galaxy.currentBodyIndex);

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
  ctx.font = f(7);
  ctx.fillStyle = 'rgba(255, 200, 50, 0.8)';
  ctx.textAlign = 'center';
  ctx.fillText('ORBIT', planetSc.x, planetSc.y - planetDockPx - 3);

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
  // Boundary is 1/10 inset from visible screen edge
  const halfH = camera.orthoSize;
  const aspect = screenW / screenH;
  const exitX = halfH * aspect * 0.9;
  const exitY = halfH * 0.9;
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
  ctx.font = f(7);
  ctx.fillStyle = 'rgba(255, 80, 80, 0.7)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('EXIT BOUNDARY', screenW / 2, tlSc.y - 2);

  ctx.restore();
}

// ── Planet View ──────────────────────────────────────────────────────────────

/** Build an effective feature list by merging static features with server-built extensions. */
function getEffectiveFeatures(body: SystemBody, starIndex: number, bodyIndex: number): PlanetFeature[] {
  const serverEcon = _serverEconomyByStarIndex.get(starIndex);
  if (!serverEcon) return body.features;

  const stationFeature = body.features.find(f => f.type === 'station');
  if (!stationFeature) return body.features;

  // If the body's features haven't been scanned, force all features to wireframe
  const scanned = bodyIndex >= 0 && isFeatureScanned(starIndex, bodyIndex);

  // Update station name/level from server data
  const stationBuilding = serverEcon.buildings.station;
  const stationLevel = stationBuilding?.level ?? 1;
  const romanNumerals = ['I','II','III','IV','V','VI','VII','VIII'];
  const effectiveSkinId = scanned ? (stationBuilding?.skinId ?? serverEcon.preferredSkinId) : 'procedural';
  const updatedStation: PlanetFeature = {
    ...stationFeature,
    name: `${body.name} ${romanNumerals[stationLevel - 1] ?? stationLevel} Station`,
    level: stationLevel,
    ...(effectiveSkinId ? { skinId: effectiveSkinId } : {}),
  };

  // Start with non-station static features + updated station
  const baseFeatures = body.features.map(f => f === stationFeature ? updatedStation : f);

  const builtExtensions: PlanetFeature[] = [];
  const rng = createRng(body.seed + 12345);

  const extensionTypes: Array<{ key: 'mine' | 'solar' | 'hab' | 'warehouse' | 'dock' | 'shield' | 'cannon' | 'refinery'; featureType: FeatureType; label: string }> = [
    { key: 'mine', featureType: 'mine', label: 'Mine' },
    { key: 'solar', featureType: 'solar_array', label: 'Solar Array' },
    { key: 'hab', featureType: 'colony', label: 'Hab' },
    { key: 'warehouse', featureType: 'warehouse', label: 'Warehouse' },
    { key: 'dock', featureType: 'dock', label: 'Space Dock' },
    { key: 'shield', featureType: 'shield', label: 'Shield Gen' },
    { key: 'cannon', featureType: 'cannon', label: 'Ion Cannon' },
    { key: 'refinery', featureType: 'refinery', label: 'Refinery' },
  ];

  // Space extensions evenly around full circle, well-separated from station
  const totalSlots = extensionTypes.length + 1; // +1 for station
  const angleSep = (Math.PI * 2) / totalSlots; // even spacing around full circle

  for (let i = 0; i < extensionTypes.length; i++) {
    const ext = extensionTypes[i]!;
    // Deterministic angle: station occupies slot 0, extensions get slots 1..N
    const angle = updatedStation.angle + angleSep * (i + 1);
    const dist = updatedStation.dist + rng.range(-0.1, 0.15);

    const building = serverEcon.buildings[ext.key];
    if (building && building.level > 0 && (building.status === 'ACTIVE' || building.status === 'UPGRADING')) {
      const featureSkinId = building.skinId ?? serverEcon.preferredSkinId ?? 'procedural';
      builtExtensions.push({
        name: `${body.name} ${ext.label} LV${building.level}`,
        type: ext.featureType,
        angle,
        dist,
        level: building.level,
        skinId: scanned ? featureSkinId : 'procedural',
      });
    }
  }

  return builtExtensions.length === 0 ? baseFeatures : [...baseFeatures, ...builtExtensions];
}

setDockFeatureProvider(getEffectiveFeatures);

export function drawPlanetView(
  r: Renderer,
  camera: Camera,
  galaxy: GalaxyState,
  _shipPos: Vec2,
  fuelUnits: number,
  fuelCapacity: number,
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
  const effectiveFeatures = getEffectiveFeatures(body, galaxy.currentStarIndex, galaxy.currentBodyIndex);

  // Planet is at world origin (0,0) in the planet view
  const planetWorldPos = vec2(0, 0);
  const sc = worldToScreen(planetWorldPos, camera, screenW, screenH);
  _coachPlanetRing = { x: sc.x, y: sc.y, r: DOCK_TRIGGER_RADIUS / wpp };

  // Central planet (modest size — ~1/10 of screen, smaller on mobile)
  const planetScale = isMobileView() ? 2 : 3;
  const planetRadPx = Math.max(4, (0.25 / wpp) * planetScale);
  const orbitRingBasePx = DOCK_TRIGGER_RADIUS / wpp;
  // Scale orbit ring visually with planet but keep minimum at game logic radius
  const orbitRingPx = isMobileView()
    ? Math.max(planetRadPx + 3, orbitRingBasePx * 0.7)
    : Math.max(planetRadPx + 3, orbitRingBasePx);

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
  // Scanned bodies show raster; unscanned stay wireframe.
  // Wireframe pref overrides everything back to procedural.
  const _bodyScanned = isPlanetScanned(galaxy.currentStarIndex, galaxy.currentBodyIndex);
  const _planetSkin = (_bodyScanned && !getWireframePref()) ? 'raster' : 'procedural';
  const planetImg = _planetSkin === 'raster' ? getPlanetSprite(body.seed) : null;
  if (planetImg) {
    // Raster planet sprite
    const drawSize = planetRadPx * 2.4;
    ctx.drawImage(planetImg, sc.x - drawSize / 2, sc.y - drawSize / 2, drawSize, drawSize);
  } else {
    // Procedural planet
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
  }

  // ── 3. Planet name above ──
  ctx.save();
  ctx.font = f(14, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(body.name, sc.x, sc.y - orbitRingPx - 8);
  ctx.restore();

  // ── 4. "ORBIT FOR CONTACT" below ──
  ctx.save();
  ctx.font = f(9);
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
      drawFeatureIcon(ctx, fx, fy, feat.type, 10, feat.level, feat.skinId);

      // Shield ring around station when shields raised
      if (feat.type === 'station' && _serverEconomyByStarIndex.get(galaxy.currentStarIndex)?.shieldRaised) {
        ctx.save();
        const pulse = 0.5 + 0.3 * Math.sin(performance.now() * 0.003);
        ctx.strokeStyle = `rgba(100, 200, 255, ${pulse})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(fx, fy, 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Feature name and type label
      ctx.save();
      const leftSide = !isMobileView() && feat.angle > Math.PI / 2 && feat.angle < Math.PI * 1.5;
      const nameOffset = leftSide ? -24 : 24;

      ctx.font = isMobileView() ? f(7, 'bold') : f(9, 'bold');
      ctx.textAlign = leftSide ? 'right' : 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = G_BRIGHT;
      ctx.fillText(feat.name, fx + nameOffset, fy - 6);

      ctx.font = isMobileView() ? f(7) : f(8);
      ctx.fillStyle = G_MED;
      ctx.textBaseline = 'top';
      ctx.fillText(FEATURE_LABELS[feat.type] || feat.type, fx + nameOffset, fy + 6);
      ctx.restore();
    }
  }

  // ── 6. Title panel (top-left) ──
  ctx.save();
  const mob = isMobileView();
  const hx = mob ? 8 : 14;  // left margin
  const titleFont = mob ? f(11, 'bold') : f(14, 'bold');
  const subFont = mob ? f(8) : f(10);
  const infoFont = mob ? f(7, 'bold') : f(9, 'bold');
  const lineH = mob ? 10 : 12;
  ctx.font = titleFont;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(body.name.toUpperCase(), hx, 12);
  ctx.font = subFont;
  ctx.fillStyle = G_MED;
  ctx.fillText(`${starName.toUpperCase()} SYSTEM`, hx, mob ? 26 : 30);

  // Ownership indicator
  const isHome = galaxy.currentStarIndex === galaxy.homeStarIndex;
  const ownerLabel = isHome ? '\u2302 HOME STAR'
    : star?.owner === 'player' ? '\u2605 CLAIMED'
    : star?.owner === 'foreign' ? '\u2716 FOREIGN'
    : '\u25CB UNCLAIMED';
  const ownerColor = isHome ? '#ffd700'
    : star?.owner === 'player' ? G_BRIGHT
    : star?.owner === 'foreign' ? '#ff6666'
    : G_DIM;
  ctx.font = infoFont;
  ctx.fillStyle = ownerColor;
  let hudY = mob ? 38 : 44;
  ctx.fillText(ownerLabel, hx, hudY);

  ctx.font = infoFont;
  ctx.fillStyle = 'rgba(79, 255, 176, 0.85)';
  const resources = getEnabledResources();
  const resourceLine = resources.length > 0
    ? resources.map((resource) => resource.shortName).join('  ')
    : 'NONE';
  hudY += lineH + 4;
  ctx.fillText(`TYPE: TERRESTRIAL`, hx, hudY);
  hudY += lineH;
  ctx.fillText(`FEATURES: ${effectiveFeatures.length}`, hx, hudY);
  hudY += lineH;
  ctx.fillText(`RESOURCES: ${resourceLine}`, hx, hudY);

  // Richness per resource
  const econ = _serverEconomyByStarIndex.get(galaxy.currentStarIndex);
  if (econ?.richness) {
    const richLine = resources.length > 0
      ? resources.map((res) => {
          const val = res.id === 'ore' ? econ.richness!.ore : res.id === 'food' ? econ.richness!.food : econ.richness!.energy;
          return `${val}/10`;
        }).join('  ')
      : '';
    hudY += lineH;
    ctx.fillText(`RICHNESS:  ${richLine}`, hx, hudY);
  }

  // Blank-line separation between planet info and ship status.
  const shipFuelPct = fuelCapacity > 0 ? (fuelUnits / fuelCapacity) * 100 : 0;
  hudY += lineH + (mob ? 6 : 12);
  ctx.fillText(`SHIP FUEL: ${Math.round(shipFuelPct)}% [${Math.round(fuelCapacity)}]`, hx, hudY);
  hudY += lineH;
  ctx.fillText(`SHIP SHIELDS: ${Math.round(shieldPercent)}%`, hx, hudY);
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

    ctx.font = f(9, 'bold');
    ctx.fillStyle = G_BRIGHT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('FEATURES', legX + 8, legY + 6);

    ctx.font = f(8);
    ctx.fillStyle = G_MED;
    for (const [i, feat] of effectiveFeatures.entries()) {
      const label = FEATURE_LABELS[feat.type] || feat.type;
      const resourceNames = getFeatureResourceNames(feat.type);
      const resourceSuffix = resourceNames.length > 0
        ? ` [${resourceNames.join('/')}]`
        : ' [utility]';
      drawFeatureIcon(ctx, legX + 16, legY + 22 + i * 14, feat.type, 5, feat.level, feat.skinId);
      ctx.fillStyle = G_MED;
      ctx.fillText(`${feat.name} - ${label}${resourceSuffix}`, legX + 26, legY + 18 + i * 14);
    }
    ctx.restore();
  }

  // ── 8. Bottom-right stub panels ──
  const statusRows = buildMockPlanetStatusRows(galaxy.currentStarIndex, fuelUnits, fuelCapacity, shieldPercent, docked);
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
  { title: 'COMS',   icon: '\u{1F4E1}' },    // 📡
  { title: 'TRADE',  icon: '\u2696', requiresDock: true },  // ⚖
];

function buildMockPlanetStatusRows(
  starIndex: number,
  fuelUnits: number,
  fuelCapacity: number,
  shieldPercent: number,
  docked: boolean,
): string[] {
  const rows: string[] = [];
  void fuelUnits;
  void fuelCapacity;
  void shieldPercent;

  // Show trading station label in status
  if (_postId && isTradingStation(_postId, starIndex)) {
    rows.push('⚖ TRADING STATION');
  }

  rows.push(`ORBIT: ${docked ? 'established' : 'approaching'}`);

  const enabledResources = getEnabledResources();
  const serverEcon = _serverEconomyByStarIndex.get(starIndex) ?? null;
  if (serverEcon && enabledResources.length > 0) {
    rows.push('RESOURCES');
    for (const resource of enabledResources) {
      const id = resource.id;
      const storeMap: Record<string, number> = { ore: serverEcon.store.ore, food: serverEcon.store.food, energy: serverEcon.store.energy, fuel: serverEcon.store.fuel };
      const rateMap: Record<string, number> = { ore: serverEcon.rates.ore, food: serverEcon.rates.food, energy: serverEcon.rates.energy, fuel: serverEcon.rates.fuel };
      const richMap: Record<string, number> = serverEcon.richness ? { ore: serverEcon.richness.ore, food: serverEcon.richness.food, energy: serverEcon.richness.energy, fuel: serverEcon.richness.fuel } : {};
      const amount = storeMap[id] ?? 0;
      const rate = rateMap[id] ?? 0;
      const rich = richMap[id] ?? 0;
      const richLabel = rich > 0 ? ` [${rich}]` : '';
      rows.push(`${resource.shortName}: ${Math.floor(amount)}/${serverEcon.cap} (+${rate}/m)${richLabel}`);
    }
    // Defense score
    if (serverEcon.defenseScore && serverEcon.defenseScore.total > 0) {
      rows.push('');
      rows.push(`DEF: ${serverEcon.defenseScore.total} (S:${serverEcon.defenseScore.shield} C:${serverEcon.defenseScore.cannon})`);
      rows.push(`SHIELDS: ${serverEcon.shieldRaised ? 'RAISED' : 'LOWERED'}`);
    }
  }

  return rows;
}

// -1 = all closed, 0..5 = which panel is open
let _openPanel = -1;

// Layout constants
// TAB_W/TAB_H scale with the font so labels keep their room. At scale 1.0 these are
// exactly 28/48, so 'small' stays pixel-identical. Call syncTabMetrics() before use.
let TAB_W = 28;        // width of the vertical tab strip
let TAB_H = 48;        // height of each tab
const TAB_GAP = 3;
const ROW_H = 14;
const PANEL_PAD = 10;

function syncTabMetrics(): void {
  const s = getFontScale();
  TAB_W = Math.round(28 * s);
  TAB_H = Math.round(48 * s);
}

// Per-tab panel widths
const PANEL_WIDTHS: number[] = [180, 280, 260, 220, 220, 200]; // STATUS, BUILD, SHIPS, FLEET, COMS, TRADE

function getEffectivePanelW(tabIndex: number, screenW: number): number {
  const base = PANEL_WIDTHS[tabIndex] ?? 180;
  const maxW = screenW - TAB_W - 16;
  return Math.min(base, maxW);
}

export function togglePlanetPanel(index: number): 'fleet-opened' | 'fleet-closed' | null {
  if (index < 0 || index >= PANEL_TABS.length) return null;
  const wasOpen = _openPanel === index;
  _openPanel = wasOpen ? -1 : index;
  if (index === 1 && !wasOpen) coachAdvance('upgrade_station');
  if (index === 2 && !wasOpen) shipsTopicShipsOpened();
  if (index === 2 && !wasOpen) colonizationTopicAction('ships_opened');
  if (wasOpen && index === 3) queueFleetRevert();
  if (index === 3) return wasOpen ? 'fleet-closed' : 'fleet-opened';
  return null;
}

/** Force the COMS panel open on the PUBLIC tab — used when starting the Comms guide. */
export function openComsPanelForTutorial(): void {
  _openPanel = 4;
  _comsTab = 'public';
}

/**
 * Hand the galaxy-jump breadcrumb to the game loop so it returns the player to the
 * tier they came from. Every path that closes the fleet panel must go through here —
 * dropping the breadcrumb instead strands the player on the galaxy map.
 */
function queueFleetRevert(): void {
  if (!_galaxyJumpReturnTier) return;
  _pendingTierRevert = _galaxyJumpReturnTier;
  _galaxyJumpReturnTier = null;
}

export function setGalaxyJumpReturnTier(tier: 'system' | 'local' | 'planet'): void {
  _galaxyJumpReturnTier = tier;
}

export function isFleetPanelOpen(): boolean {
  return _openPanel === 3;
}

export function closeFleetPanel(): void {
  if (_openPanel === 3) {
    _openPanel = -1;
    queueFleetRevert();
  }
}

export function closeAllPanels(): void {
  if (_openPanel === 3) queueFleetRevert();
  _openPanel = -1;
}

/** Check if any slide-out panel is currently open. */
export function isAnyPanelOpen(): boolean {
  return _openPanel >= 0;
}

/** Get the tab rects for hit testing */
function getPanelTabRects(screenH: number) {
  syncTabMetrics();
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
    const panelY = _lastPanelBodyY;
    const bodyH = _lastPanelBodyH > 0 ? _lastPanelBodyH : TAB_H;
    if (sx >= panelX && sx <= screenW - TAB_W && sy >= panelY && sy <= panelY + bodyH) {
      // Handle interactive clicks inside BUILD / SHIPS / FLEET tabs
      if (_openPanel === 1) {
        hitTestBuildPanel(sx, sy);
      } else if (_openPanel === 5) {
        hitTestTradeButtons(sx, sy);
      } else if (_openPanel === 2) {
        hitTestShipsPanel(sx, sy);
      } else if (_openPanel === 3) {
        hitTestFleetPanel(sx, sy);
      } else if (_openPanel === 4) {
        hitTestComsPanel(sx, sy);
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
  const panelY = _lastPanelBodyY;
  const bodyH = _lastPanelBodyH > 0 ? _lastPanelBodyH : TAB_H;
  return sx >= panelX && sx <= screenW - TAB_W && sy >= panelY && sy <= panelY + bodyH;
}

// Track last drawn panel body height and Y for hit testing
let _lastPanelBodyH = 0;
let _lastPanelBodyY = 0;

// Track docked state for greying out tabs
let _panelsDocked = false;
let _panelsStarIndex: number | null = null;
let _panelsBodyIndex: number = 0;
let _panelsTier: 'galaxy' | 'system' | 'local' | 'planet' = 'planet';
let _panelsShipShape: string = 'scout';
let _panelsOwned = false; // whether player owns the current star
let _panelsForeign = false; // whether star is owned by an opponent
let _homeStarIndex: number | null = null; // player's actual home star
let _isAdmin = false; // whether current player is an admin
let _completeCharges = 0; // auto-complete charges from yellow pods

// ── Coms state ──────────────────────────────────────────────────────────────
let _comsUnreadCount = 0;

// ── DM state ────────────────────────────────────────────────────────────────
import type { DirectMessage, PublicComment, Alliance, AllianceInvite, AllianceChatMessage } from '../shared/api';
let _knownPlayerNames: string[] = [];
let _dmPeer: string | null = null;       // currently open DM conversation
let _dmMessages: DirectMessage[] = [];
let _dmUnreadFrom: string[] = [];         // usernames with unread DMs
let _dmLoading = false;
let _pendingDMSend: { to: string; text: string } | null = null;
let _dmInputRequested: string | null = null;  // peer name when input overlay should show
let _dmReportPending: { messageId: string; from: string; body: string } | null = null; // message to report
let _dmReportButtons: { x: number; y: number; w: number; h: number; msg: DirectMessage }[] = [];
let _dmReportConfirmUntil = 0; // timestamp when "Reported ✓" flash expires

// ── Public COMS state ───────────────────────────────────────────────────────
type ComsTab = 'private' | 'public' | 'alliance' | 'board';
let _comsTab: ComsTab = 'public';
let _publicComments: PublicComment[] = [];
let _publicLoading = false;
let _pendingPublicPost: { text: string; parentId?: string } | null = null;
let _publicInputRequested: { parentId?: string; recipient?: string } | null = null; // signals overlay should show for public post
let _publicPage = 0; // current page of public comments
const PUBLIC_PAGE_SIZE = 4; // messages per page
let _publicRecipient: string | null = null; // selected "TO:" player for public posts

// ── Alliance state ──────────────────────────────────────────────────────────
type AllianceView = 'none' | 'home' | 'chat' | 'invites' | 'invite';
let _allianceView: AllianceView = 'none';
let _allianceInfo: Alliance | null = null;
let _allianceInvites: AllianceInvite[] = [];
let _allianceChat: AllianceChatMessage[] = [];
let _allianceChatPage = 0;
const ALLIANCE_CHAT_PAGE_SIZE = 5;
let _username: string | null = null; // current player username for alliance manager checks
const _allianceInvitedPlayers: Set<string> = new Set(); // track recently invited players for UI feedback
let _pendingAllianceAction: {
  type: 'create' | 'chat' | 'invite' | 'respond' | 'leave' | 'kick' | 'join' | 'reject';
  name?: string;
  text?: string;
  target?: string;
  allianceId?: string;
  accept?: boolean;
} | null = null;
let _allianceInputRequested: { type: 'create' | 'chat' } | null = null;

// ── Leaderboard state ───────────────────────────────────────────────────────
import type { LeaderboardEntry } from '../shared/api';
let _leaderboardData: LeaderboardEntry[] = [];
let _leaderboardSeedButton: { x: number; y: number; w: number; h: number } | null = null;
let _pendingSeedBots = false;

// ── Fleet Share ─────────────────────────────────────────────────────────────
let _pendingFleetShare = false;
let _fleetShareButton: { x: number; y: number; w: number; h: number } | null = null;
let _fleetShareCooldownUntil = 0;

export function consumePendingFleetShare(): boolean {
  if (_pendingFleetShare) { _pendingFleetShare = false; return true; }
  return false;
}

export function setFleetShareCooldown(durationMs: number): void {
  _fleetShareCooldownUntil = Date.now() + durationMs;
}

export function setLeaderboardData(data: LeaderboardEntry[]): void {
  _leaderboardData = data;
}

export function consumePendingSeedBots(): boolean {
  if (_pendingSeedBots) { _pendingSeedBots = false; return true; }
  return false;
}

export function setKnownPlayers(names: string[]): void {
  _knownPlayerNames = names;
}

export function setDMPeer(peer: string | null): void {
  _dmPeer = peer;
  _dmMessages = [];
  _dmLoading = !!peer;
}

export function getDMPeer(): string | null {
  return _dmPeer;
}

export function setDMMessages(messages: DirectMessage[]): void {
  _dmMessages = messages;
  _dmLoading = false;
}

export function setDMUnread(unreadFrom: string[]): void {
  _dmUnreadFrom = unreadFrom;
}

export function consumePendingDMSend(): { to: string; text: string } | null {
  const send = _pendingDMSend;
  _pendingDMSend = null;
  return send;
}

/** Check if the DM input overlay should be shown. Returns peer name or null. */
export function consumeDMInputRequest(): string | null {
  const peer = _dmInputRequested;
  _dmInputRequested = null;
  return peer;
}

/** Submit DM text from the HTML input overlay. */
export function submitDMInput(text: string): void {
  if (_dmPeer && text.trim()) {
    _pendingDMSend = { to: _dmPeer, text: text.trim() };
  }
}

/** Consume a pending DM report (user tapped ⚑ on a message). */
export function consumePendingDMReport(): { messageId: string; from: string; body: string } | null {
  const report = _dmReportPending;
  _dmReportPending = null;
  return report;
}

/** Show "Reported ✓" confirmation flash in DM panel. */
export function showDMReportConfirm(): void {
  _dmReportConfirmUntil = Date.now() + 3000; // 3 seconds
}

// ── Public COMS exports ─────────────────────────────────────────────────────

export function getComsTab(): ComsTab { return _comsTab; }

export function setPublicComments(comments: PublicComment[]): void {
  _publicComments = comments;
  _publicLoading = false;
}

export function setPublicLoading(loading: boolean): void {
  _publicLoading = loading;
}

export function consumePendingPublicPost(): { text: string; parentId?: string } | null {
  const post = _pendingPublicPost;
  _pendingPublicPost = null;
  return post;
}

/** Check if the public post input overlay should show. Returns target or null. */
export function consumePublicInputRequest(): { parentId?: string; recipient?: string } | null {
  const req = _publicInputRequested;
  _publicInputRequested = null;
  return req;
}

/** Submit public post text from the HTML input overlay. */
export function submitPublicPost(text: string, parentId?: string, recipient?: string): void {
  if (text.trim()) {
    // Prefix with u/recipient mention if specified
    const prefix = recipient ? `u/${recipient} ` : '';
    const fullText = prefix + text.trim();
    const post: { text: string; parentId?: string } = { text: fullText };
    if (parentId) post.parentId = parentId;
    _pendingPublicPost = post;
  }
}

/** Get the current public recipient selection. */
export function getPublicRecipient(): string | null { return _publicRecipient === '__ALL__' ? null : _publicRecipient; }

/** Update unread badge count. */
export function setComsUnread(count: number): void {
  _comsUnreadCount = count;
}

/** Clear unread badge (when coms panel is opened). */
export function clearComsUnread(): void {
  _comsUnreadCount = 0;
}

/** Check if coms panel is open. */
export function isComsPanelOpen(): boolean {
  return _openPanel === 4;
}

/** Set admin flag (gates debug features like COMPLETE button). */
export function setIsAdmin(v: boolean): void { _isAdmin = v; }

// ── Alliance exports ────────────────────────────────────────────────────────

export function setAllianceInfo(info: Alliance | null): void {
  _allianceInfo = info;
  if (info) {
    if (_allianceView === 'none') _allianceView = 'home';
  } else {
    _allianceView = 'none';
  }
}

export function setAllianceInvites(invites: AllianceInvite[]): void {
  _allianceInvites = invites;
}

export function setAllianceChat(messages: AllianceChatMessage[]): void {
  _allianceChat = messages;
}

export function getAllianceView(): AllianceView { return _allianceView; }

export function consumeAllianceAction(): typeof _pendingAllianceAction {
  const action = _pendingAllianceAction;
  _pendingAllianceAction = null;
  return action;
}

const SHOW_BOT_TEST_UI = false; // flip to true to show bot test buttons

let _pendingBotTest = false;
let _pendingBotAdminTest = false;
let _pendingBotCheck = false;
let _botTestLog: string | null = null;
let _pendingBotCopy = false;

export function consumePendingBotTest(): boolean {
  const v = _pendingBotTest;
  _pendingBotTest = false;
  return v;
}

export function consumePendingBotAdminTest(): boolean {
  const v = _pendingBotAdminTest;
  _pendingBotAdminTest = false;
  return v;
}

export function consumePendingBotCheck(): boolean {
  const v = _pendingBotCheck;
  _pendingBotCheck = false;
  return v;
}

export function setBotTestLog(log: string): void {
  _botTestLog = log;
}

export function consumePendingBotCopy(): string | null {
  if (!_pendingBotCopy || !_botTestLog) return null;
  _pendingBotCopy = false;
  return _botTestLog;
}

export function consumeAllianceInputRequest(): { type: 'create' | 'chat' } | null {
  const req = _allianceInputRequested;
  _allianceInputRequested = null;
  return req;
}

export function submitAllianceInput(type: 'create' | 'chat', text: string): void {
  if (!text.trim()) return;
  if (type === 'create') {
    _pendingAllianceAction = { type: 'create', name: text.trim() };
  } else {
    _pendingAllianceAction = { type: 'chat', text: text.trim() };
  }
}

export function setAllianceUsername(name: string): void {
  _username = name;
}

/** Called before drawing to set panel context */
export function setPanelContext(docked: boolean, starIndex: number | null, tier: 'galaxy' | 'system' | 'local' | 'planet' = 'planet', shipShape?: string, owned?: boolean, foreign?: boolean, bodyIndex?: number): void {
  // Auto-close dock-required panels when undocking or leaving planet tier
  if (!docked && _panelsDocked && _openPanel >= 0 && PANEL_TABS[_openPanel]?.requiresDock) {
    _openPanel = -1;
  }
  // Auto-close dock-required panels when tier changes away from planet
  if (tier !== 'planet' && _openPanel >= 0 && PANEL_TABS[_openPanel]?.requiresDock) {
    _openPanel = -1;
  }
  // Auto-close BUILD/SHIPS if we dock at an unowned star (but not TRADE tab at trading stations)
  if (owned === false && _openPanel >= 0 && _openPanel !== 5 && PANEL_TABS[_openPanel]?.requiresDock) {
    _openPanel = -1;
  }
  _panelsDocked = docked;
  _panelsStarIndex = starIndex;
  _panelsTier = tier;
  if (shipShape !== undefined) _panelsShipShape = shipShape;
  if (owned !== undefined) _panelsOwned = owned;
  if (foreign !== undefined) _panelsForeign = foreign;
  if (bodyIndex !== undefined) _panelsBodyIndex = bodyIndex;
}

export function setHomeStarIndex(idx: number): void {
  _homeStarIndex = idx;
}

// Pending galaxy jump from fleet panel MAP button
let _pendingGalaxyJump = false;
let _galaxyJumpReturnTier: 'system' | 'local' | 'planet' | null = null;
let _pendingTierRevert: 'system' | 'local' | 'planet' | null = null;

export function consumePendingGalaxyJump(): boolean {
  const v = _pendingGalaxyJump;
  _pendingGalaxyJump = false;
  return v;
}

export function consumePendingTierRevert(): 'system' | 'local' | 'planet' | null {
  const v = _pendingTierRevert;
  _pendingTierRevert = null;
  return v;
}

// Hit test helpers for interactive panels (called from hitTestPlanetPanels)
function hitTestTradeButtons(sx: number, sy: number): void {
  for (const btn of _tradeButtons) {
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      _pendingTrade = { giveType: btn.giveType, receiveType: btn.receiveType };
      playSound('click');
      return;
    }
  }
}

function hitTestBuildPanel(sx: number, sy: number): void {
  // Check COMPLETE button
  if (_completeButton) {
    const cb = _completeButton;
    if (sx >= cb.x && sx <= cb.x + cb.w && sy >= cb.y && sy <= cb.y + cb.h) {
      _pendingCompleteBuilds = true;
      playSound('click');
      return;
    }
  }
  // Check extension buttons
  for (const btn of _lastExtensionButtons) {
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      if (btn.enabled) {
        _pendingExtensionAction = btn.action;
        if (btn.action === 'upgrade_station') coachAdvance('pick_skin');
        playSound('click');
      } else if (btn.lockReason) {
        _lockFlash = { action: btn.action, expireMs: Date.now() + 3000 };
        playSound('click');
      }
      return;
    }
  }
}

function hitTestShipsPanel(sx: number, sy: number): void {
  for (const btn of _lastShipButtons) {
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      if (btn.shipTypeId === 11) shipsTopicProbeClicked(); // Ships guide only cares that the tap landed
      if (btn.shipTypeId === 11 && btn.enabled) colonizationTopicAction('probe_built');
      if (btn.shipTypeId === 8 && btn.enabled) colonizationTopicAction('colony_built');
      if (btn.enabled) {
        if (btn.isUpgrade && btn.upgradeFromTypeId != null) {
          _pendingUpgradeShipRequest = { fromTypeId: btn.upgradeFromTypeId, ...(btn.useBlueprint ? { useBlueprint: true } : {}) };
        } else {
          _pendingBuyShipRequest = { shipTypeId: btn.shipTypeId, quantity: 1, ...(btn.useBlueprint ? { useBlueprint: true } : {}) };
        }
        playSound('click');
      } else if (btn.disableReason) {
        // Voice feedback for why the button is disabled
        if (btn.disableReason === 'insufficient resources') {
          playSound('insufficient_resources');
        } else if (btn.disableReason === 'dock level too low') {
          playSound('dock_low');
        } else {
          playSound('fuel_critical');
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
      playSound('click');
      return;
    }
  }
  // SEND buttons (enter transfer mode)
  for (const btn of _fleetSendButtons) {
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      enterTransferMode(btn.starIndex, btn.shipTypeId);
      playSound('click');
      return;
    }
  }
  // CANCEL route buttons
  for (const btn of _fleetCancelRouteButtons) {
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      _pendingCancelRoute = btn.routeId;
      playSound('click');
      return;
    }
  }
  // POST (share fleet) button
  if (_fleetShareButton) {
    const b = _fleetShareButton;
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
      _pendingFleetShare = true;
      playSound('click');
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
  _coachBuildTabRect = null;
  _coachShipsTabRect = null;

  ctx.save();

  for (let i = 0; i < PANEL_TABS.length; i++) {
    const tab = PANEL_TABS[i];
    const rect = tabRects[i];
    if (!tab || !rect) continue;
    const ty = rect.y;
    const isOpen = _openPanel === i;
    const isAtTradingStation = _postId && _panelsStarIndex != null && !_panelsOwned && isTradingStation(_postId, _panelsStarIndex);
    // TRADE tab (5): visible only at non-owned trading stations, requires dock
    // BUILD/SHIPS (1,2): require dock + owned star
    // FLEET (3): disabled for scouts
    const isHidden = (i === 5 && !isAtTradingStation);
    const isDisabled = isHidden
      || (i === 5 && !_panelsDocked)
      || (i !== 5 && tab.requiresDock && (!_panelsDocked || !_panelsOwned))
      || (i === 3 && _panelsShipShape === 'scout');
    if (isHidden) continue; // skip rendering this tab entirely

    if (i === 1 && !isDisabled) _coachBuildTabRect = { x: tabX - 4, y: ty, w: TAB_W + 4, h: TAB_H };
    if (i === 2 && !isDisabled) _coachShipsTabRect = { x: tabX - 4, y: ty, w: TAB_W + 4, h: TAB_H };

    // Journey pulse: brighten non-disabled tabs
    const pulseAlpha = getJourneyPulseAlpha();
    const hasPulse = pulseAlpha > 0 && !isDisabled && !isOpen;

    // ── Tab (vertical, right edge) ──
    ctx.fillStyle = isOpen ? 'rgba(0, 30, 15, 0.9)' : hasPulse ? `rgba(0, 60, 30, ${0.7 + pulseAlpha * 0.3})` : 'rgba(0, 10, 5, 0.7)';
    roundedRect(ctx, tabX - 4, ty, TAB_W + 4, TAB_H, 4);
    ctx.fill();

    ctx.strokeStyle = isDisabled ? G_FAINT : isOpen ? G_BRIGHT : hasPulse ? `rgba(79, 255, 176, ${0.4 + pulseAlpha * 0.6})` : 'rgba(79, 255, 176, 0.45)';
    ctx.lineWidth = hasPulse ? 2.5 : 1.5;
    roundedRect(ctx, tabX - 4, ty, TAB_W + 4, TAB_H, 4);
    ctx.stroke();

    // Icon at top of tab
    const tabScale = getFontScale();
    const iconPx = Math.round(12 * tabScale);
    const iconY = ty + Math.round(16 * tabScale);
    ctx.font = f(12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDisabled ? G_FAINT : isOpen ? G_BRIGHT : hasPulse ? `rgba(79, 255, 176, ${0.5 + pulseAlpha * 0.5})` : G_BRIGHT;
    ctx.fillText(tab.icon, tabX + TAB_W / 2, iconY);

    // Vertical title text — kept clear of the icon, clamped inside the tab
    ctx.save();
    ctx.font = f(7, 'bold');
    let titleY = ty + TAB_H / 2 + Math.round(6 * tabScale);
    if (tabScale !== 1) {
      const half = ctx.measureText(tab.title).width / 2;
      const minY = iconY + iconPx * 0.5 + 3 + half;
      const maxY = ty + TAB_H - 2 - half;
      titleY = Math.min(Math.max(titleY, minY), maxY);
    }
    ctx.translate(tabX + TAB_W / 2, titleY);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDisabled ? G_FAINT : isOpen ? G_BRIGHT : G_MED;
    ctx.fillText(tab.title, 0, 0);
    ctx.restore();

    // ── Unread badge on COMS tab ──
    const totalUnread = _comsUnreadCount + _dmUnreadFrom.length;
    if (i === 4 && totalUnread > 0 && !isOpen) {
      const badgeX = tabX + TAB_W - 6;
      const badgeY = ty + 4;
      ctx.fillStyle = '#FF5A3D';
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = f(7, 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(totalUnread > 9 ? '9+' : String(totalUnread), badgeX, badgeY);
    }

    // ── Slide-out body (only when open and not disabled) ──
    if (isOpen && !isDisabled) {
      const panelW = getEffectivePanelW(i, screenW);
      const panelX = screenW - TAB_W - panelW;
      let panelY = ty;

      // Ships panel (index 2): anchor from bottom of tab so it grows upward
      if (i === 2) {
        const estimatedH = estimateShipsPanelHeight();
        panelY = ty + TAB_H - estimatedH;
        if (panelY < 4) panelY = 4;
      }

      // Fleet panel (index 3): anchor from bottom of tab so it grows upward
      if (i === 3) {
        const estimatedH = estimateFleetPanelHeight();
        panelY = ty + TAB_H - estimatedH;
        if (panelY < 4) panelY = 4;
      }

      // Trade panel (index 5): anchor from bottom of tab so it grows upward
      if (i === 5) {
        const estimatedH = 42 + 6 * (16 + 3) + PANEL_PAD; // headerH + 6 buttons + padding
        panelY = ty + TAB_H - estimatedH;
        if (panelY < 4) panelY = 4;
      }

      // Draw panel body based on tab index
      let bodyH: number;
      switch (i) {
        case 0: bodyH = drawStatusPanelBody(ctx, panelX, panelY, panelW, statusRows); break;
        case 1: bodyH = drawBuildPanelBody(ctx, panelX, panelY, panelW); break;
        case 2: bodyH = drawShipsPanelBody(ctx, panelX, panelY, panelW); break;
        case 3: bodyH = drawFleetPanelBody(ctx, panelX, panelY, panelW); break;
        case 4: bodyH = drawComsPanelBody(ctx, panelX, panelY, panelW); break;
        case 5: bodyH = drawTradePanelBody(ctx, panelX, panelY, panelW); break;
        default: bodyH = TAB_H;
      }
      _lastPanelBodyH = bodyH;
      _lastPanelBodyY = panelY;
    } else if (isOpen && isDisabled) {
      // Show disabled message
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
      ctx.font = f(9);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = G_FAINT;
      const msg = (i === 3 && _panelsShipShape === 'scout') ? 'UPGRADE SHIP TO ACCESS' : 'DOCK TO ACCESS';
      ctx.fillText(msg, panelX + panelW / 2, panelY + bodyH / 2);
      _lastPanelBodyH = bodyH;
      _lastPanelBodyY = panelY;
    }
  }

  drawCoachOverlay(ctx, screenW, screenH);

  ctx.restore();
}

// ── Coach marks (first-session tutorial) ─────────────────────────────────────

/** BUILD tab rect captured during the last panel draw (null when unavailable). */
let _coachBuildTabRect: { x: number; y: number; w: number; h: number } | null = null;
/** SHIPS tab rect, captured the same way, used by the post-onboarding Ships topic guide. */
let _coachShipsTabRect: { x: number; y: number; w: number; h: number } | null = null;
/** Rect of the primary (GOT IT) button drawn by the last coach overlay. */
let _coachGotItButton: { x: number; y: number; w: number; h: number } | null = null;
/** Rect of the SKIP button shown once a step has been acknowledged. */
let _coachSkipButton: { x: number; y: number; w: number; h: number } | null = null;

const COACH_COPY: Record<string, { step: string; title: string[]; lines: string[]; nudge: string }> = {
  open_build: { step: '1/7', title: ['OPEN YOUR BASE', 'BUILD CONTROL'], lines: ['Tap the BUILD tab to open', 'your starbase menu.'], nudge: 'NOW PRESS BUILD' },
  upgrade_station: { step: '2/7', title: ['UPGRADE THE STATION'], lines: ['Tap STATION to upgrade your', 'base. Higher levels unlock', 'more buildings and ships.'], nudge: 'NOW PRESS STATION' },
  pick_skin: { step: '3/7', title: ['SELECT YOUR LOOK'], lines: ['Other players see your style.', 'Pick a station skin to start', 'the upgrade.'], nudge: 'NOW PICK A STYLE' },
  undock: { step: '4/7', title: ['LEAVE THE STATION'], lines: ['Tap UNDOCK to release your', 'ship and fly free.'], nudge: 'NOW PRESS UNDOCK' },
  navigate_dock: { step: '5/7', title: ['FLY TO THE PLANET'], lines: ['Tap where you want to go,', 'or steer with WASD. You dock', 'on reaching the orbit ring.'], nudge: 'FLY INTO THE ORBIT RING' },
  scan: { step: '6/7', title: ['SCAN THE SURFACE'], lines: ['Tap SCAN to survey the planet', 'for resources, blueprints', 'and anomalies.'], nudge: 'NOW PRESS SCAN' },
  help: { step: '7/7', title: ['THE MANUAL'], lines: ['Your scan is running. Tap ?', 'any time to re-read the', 'controls and guides.'], nudge: 'NOW PRESS ?' },
};

/** Buttons on the final congratulations card. */
let _coachCongratsButtons: Array<{ x: number; y: number; w: number; h: number; id: 'play' | 'more' }> = [];

/** Screen rect of an HTML overlay button — the icon bar sits on top of the canvas. */
function domButtonRect(id: string): { x: number; y: number; w: number; h: number } | null {
  const el = document.getElementById(id);
  const canvas = document.getElementById('game-canvas');
  if (!el || !canvas) return null;
  const r = el.getBoundingClientRect();
  const c = canvas.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height };
}

/** Planet orbit ring projected to screen space, captured during the planet-tier draw. */
let _coachPlanetRing: { x: number; y: number; r: number } | null = null;

/** NEXT / SKIP / branch buttons shared by the post-onboarding Ships and Comms topic guides. */
let _topicPrimaryButton: { x: number; y: number; w: number; h: number } | null = null;
let _topicSkipButton: { x: number; y: number; w: number; h: number } | null = null;
let _topicSecondaryButton: { x: number; y: number; w: number; h: number } | null = null;

/** Per-tab copy for the Comms topic guide, in on-screen left-to-right order. */
const COMS_TOPIC_TABS: Array<{ tab: ComsTab; label: string; title: string; lines: string[] }> = [
  { tab: 'public', label: 'PUBLIC', title: 'PUBLIC', lines: ['Posts here go to the Reddit', 'thread everyone can see.'] },
  { tab: 'private', label: 'DM', title: 'PRIVATE (DM)', lines: ['Direct messages from other', 'commanders arrive here.'] },
  { tab: 'alliance', label: 'ALLY', title: 'ALLIANCE', lines: ['Alliances are teams of players', 'who cooperate — sharing intel,', 'defending stars, and chatting', 'in a private channel.'] },
  { tab: 'board', label: 'BOARD', title: 'LEADERBOARD', lines: ['Every commander ranked', 'by power.'] },
];

function drawCoachOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
  _coachGotItButton = null;
  _coachSkipButton = null;
  _topicPrimaryButton = null;
  _topicSkipButton = null;
  _topicSecondaryButton = null;

  // Help owns the screen while it is open; resume any handoff when it closes.
  if ((globalThis as typeof globalThis & { __helpPanelOpen?: boolean }).__helpPanelOpen) return;

  if (isShipsTopicActive()) {
    drawShipsTopicOverlay(ctx, screenW, screenH);
    return;
  }
  if (isColonizationTopicActive()) {
    drawColonizationTopicOverlay(ctx, screenW, screenH);
    return;
  }
  if (isComsTopicActive()) {
    drawComsTopicOverlay(ctx, screenW, screenH);
    return;
  }

  if (!isCoachActive()) {
    drawHelpReminder(ctx);
    return;
  }

  const step = getCoachStep();
  if (step === 'congrats') return; // drawn top-level by drawCoachCongratsTop
  if (step === 'navigate_dock') {
    const ring = _coachPlanetRing;
    if (!ring || _panelsDocked) return;
    drawCoachCallout(ctx, screenW, screenH, step,
      { x: ring.x - ring.r, y: ring.y - ring.r, w: ring.r * 2, h: ring.r * 2 }, 'above', true);
    return;
  }

  let target: { x: number; y: number; w: number; h: number } | null = null;
  if (step === 'open_build') {
    target = _coachBuildTabRect;
  } else if (step === 'upgrade_station' && _openPanel === 1) {
    const btn = _lastExtensionButtons.find((b) => b.action === 'upgrade_station');
    if (btn) target = { x: btn.x, y: btn.y, w: btn.w, h: btn.h };
  } else if (step === 'help') {
    target = domButtonRect('help-btn');
  }
  if (!target) return;
  drawCoachCallout(ctx, screenW, screenH, step, target, step === 'help' ? 'below' : 'left');
}

/** Small opaque card used by topic guides for steps with no on-screen target (e.g. "you need a Dock").
 * `secondaryLabel`, when given, adds a full-width branch button above the NEXT/SKIP row. */
function drawTopicInfoCard(
  ctx: CanvasRenderingContext2D,
  screenW: number, screenH: number,
  title: string,
  lines: string[],
  primaryLabel: string,
  secondaryLabel?: string,
  target?: { x: number; y: number; w: number; h: number },
): void {
  const AMBER = '#ffb84d';
  const pulse = getCoachPulse();
  const boxW = Math.min(220, screenW - 24);
  const lineH = 11;

  // Vertical extents, computed independently of boxY so boxH can be centred afterward.
  const topPad = 10;
  const titleH = 16;
  const bodyH = lines.length * lineH;
  const contentBottom = topPad + titleH + bodyH; // offset from boxY
  const secondaryH = secondaryLabel ? 24 : 0; // 16px button + 8px gap
  const buttonRowY = contentBottom + (secondaryLabel ? secondaryH : 10);
  const buttonRowH = 16;
  const bottomPad = 10;
  const boxH = buttonRowY + buttonRowH + bottomPad;

  let boxX = (screenW - boxW) / 2;
  let boxY = Math.max(8, Math.min((screenH - boxH) / 2, screenH - boxH - 8));
  if (target) {
    boxX = target.x - boxW - 12;
    if (boxX < 8) boxX = target.x + target.w + 12;
    boxY = target.y + target.h / 2 - boxH / 2;
    boxX = Math.max(8, Math.min(boxX, screenW - boxW - 8));
    boxY = Math.max(8, Math.min(boxY, screenH - boxH - 8));
  }

  ctx.save();
  ctx.fillStyle = target ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(0, 0, screenW, screenH);

  if (target) {
    ctx.strokeStyle = `rgba(255, 184, 77, ${0.65 + pulse * 0.35})`;
    ctx.lineWidth = 2;
    roundedRect(ctx, target.x - 3, target.y - 3, target.w + 6, target.h + 6, 5);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 184, 77, ${0.18 + pulse * 0.22})`;
    ctx.lineWidth = 6;
    roundedRect(ctx, target.x - 5 - pulse * 2, target.y - 5 - pulse * 2, target.w + 10 + pulse * 4, target.h + 10 + pulse * 4, 7);
    ctx.stroke();
  }

  ctx.fillStyle = '#0a0600';
  roundedRect(ctx, boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2;
  roundedRect(ctx, boxX, boxY, boxW, boxH, 6);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = f(9, 'bold');
  ctx.fillStyle = AMBER;
  ctx.fillText(title, boxX + 12, boxY + topPad);

  ctx.font = f(7);
  ctx.fillStyle = G_BRIGHT;
  for (const [i, line] of lines.entries()) {
    ctx.fillText(line, boxX + 12, boxY + topPad + titleH + i * lineH);
  }

  if (secondaryLabel) {
    const bx = boxX + 10;
    const by = boxY + contentBottom + 8;
    const bw = boxW - 20;
    const bh = 16;
    _topicSecondaryButton = { x: bx, y: by, w: bw, h: bh };
    roundedRect(ctx, bx, by, bw, bh, 3);
    ctx.fillStyle = 'rgba(80, 45, 0, 0.6)';
    ctx.fill();
    roundedRect(ctx, bx, by, bw, bh, 3);
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = f(8, 'bold');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = AMBER;
    ctx.fillText(secondaryLabel, bx + 8, by + bh / 2);
  }

  const pw = 76;
  const ph = buttonRowH;
  const px = boxX + boxW - pw - 10;
  const py = boxY + buttonRowY;
  _topicPrimaryButton = { x: px, y: py, w: pw, h: ph };
  roundedRect(ctx, px, py, pw, ph, 3);
  ctx.fillStyle = 'rgba(80, 45, 0, 0.75)';
  ctx.fill();
  roundedRect(ctx, px, py, pw, ph, 3);
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = f(8, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = AMBER;
  ctx.fillText(primaryLabel, px + pw / 2, py + ph / 2);

  const sw = 40;
  const sh = buttonRowH;
  const sx = boxX + 10;
  const sy = boxY + buttonRowY;
  _topicSkipButton = { x: sx, y: sy, w: sw, h: sh };
  roundedRect(ctx, sx, sy, sw, sh, 3);
  ctx.strokeStyle = 'rgba(255, 184, 77, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = f(7, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 184, 77, 0.7)';
  ctx.fillText('SKIP', sx + sw / 2, sy + sh / 2);

  if (target && boxX + boxW <= target.x) {
    const ay = Math.max(boxY + 12, Math.min(target.y + target.h / 2, boxY + boxH - 12));
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(boxX + boxW, ay - 6);
    ctx.lineTo(boxX + boxW + 8, ay);
    ctx.lineTo(boxX + boxW, ay + 6);
    ctx.closePath();
    ctx.fill();
  } else if (target && boxX >= target.x + target.w) {
    const ay = Math.max(boxY + 12, Math.min(target.y + target.h / 2, boxY + boxH - 12));
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(boxX, ay - 6);
    ctx.lineTo(boxX - 8, ay);
    ctx.lineTo(boxX, ay + 6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/** Ring + callout pointing at a real UI target for the topic guides, with a SKIP escape hatch. */
function drawTopicPointer(
  ctx: CanvasRenderingContext2D,
  screenW: number, screenH: number,
  target: { x: number; y: number; w: number; h: number },
  placement: 'left' | 'above',
  title: string,
  lines: string[],
): void {
  const AMBER = '#ffb84d';
  const pulse = getCoachPulse();

  ctx.save();
  ctx.strokeStyle = `rgba(255, 184, 77, ${0.55 + pulse * 0.45})`;
  ctx.lineWidth = 2;
  roundedRect(ctx, target.x - 3, target.y - 3, target.w + 6, target.h + 6, 5);
  ctx.stroke();

  const boxW = Math.min(170, screenW - 16);
  const lineH = 11;
  const boxH = 24 + lines.length * lineH + 16;
  let boxX: number;
  let boxY: number;
  if (placement === 'above') {
    boxX = target.x + target.w / 2 - boxW / 2;
    boxY = target.y - 10 - boxH;
  } else {
    boxX = target.x - 12 - boxW;
    boxY = target.y + target.h / 2 - boxH / 2;
    if (boxX < 6) boxX = Math.min(target.x, screenW - boxW - 6);
  }
  boxX = Math.max(6, Math.min(boxX, screenW - boxW - 6));
  boxY = Math.max(6, Math.min(boxY, screenH - boxH - 6));

  ctx.fillStyle = 'rgba(10, 6, 0, 0.94)';
  roundedRect(ctx, boxX, boxY, boxW, boxH, 5);
  ctx.fill();
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 1.5;
  roundedRect(ctx, boxX, boxY, boxW, boxH, 5);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = f(8, 'bold');
  ctx.fillStyle = AMBER;
  ctx.fillText(title, boxX + 10, boxY + 8);
  ctx.font = f(7);
  ctx.fillStyle = G_BRIGHT;
  for (const [i, line] of lines.entries()) {
    ctx.fillText(line, boxX + 10, boxY + 22 + i * lineH);
  }

  const sw = 30;
  const sh = 12;
  const sx = boxX + boxW - sw - 8;
  const sy = boxY + boxH - sh - 6;
  _topicSkipButton = { x: sx, y: sy, w: sw, h: sh };
  roundedRect(ctx, sx, sy, sw, sh, 3);
  ctx.strokeStyle = 'rgba(255, 184, 77, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = f(7, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 184, 77, 0.7)';
  ctx.fillText('SKIP', sx + sw / 2, sy + sh / 2);

  ctx.restore();
}

function drawShipsTopicOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
  const step = getShipsTopicStep();
  if (step === 'info') {
    drawTopicInfoCard(ctx, screenW, screenH, 'BUILDING SHIPS', [
      'Ships are built at your Space Dock.',
      'Dock at your station and build a',
      'Dock before any ship can be queued.',
    ], 'NEXT');
    return;
  }
  if (step === 'open_ships') {
    const target = _coachShipsTabRect;
    if (!target) return; // SHIPS tab is disabled until docked at an owned, developed station
    drawTopicPointer(ctx, screenW, screenH, target, 'left', 'OPEN SHIPS', [
      'Tap the SHIPS tab to see', 'what you can build.',
    ]);
    return;
  }
  if (step === 'pick_probe' && _openPanel === 2) {
    const btn = _lastShipButtons.find((b) => b.shipTypeId === 11);
    if (!btn) return;
    drawTopicPointer(ctx, screenW, screenH, { x: btn.x, y: btn.y, w: btn.w, h: btn.h }, 'above', 'BUILD A PROBE', [
      'Tap BUILD on the Basic Probe.',
      'Needs a Dock plus a little Ore,',
      'Food and Energy.',
    ]);
  }
}

function drawColonizationTopicOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
  const step = getColonizationTopicStep();
  if (step === 'info') {
    drawTopicInfoCard(ctx, screenW, screenH, 'EXPAND YOUR EMPIRE', [
      'Scout a star with a probe, or build',
      'on your first visit beyond home.',
      'Then travel there personally to claim it.',
    ], 'NEXT');
    return;
  }
  if (step === 'open_ships') {
    const target = _coachShipsTabRect;
    if (!target) return;
    drawTopicPointer(ctx, screenW, screenH, target, 'left', 'OPEN SHIPS', [
      'Open SHIPS to build your probe.',
    ]);
    return;
  }
  if (step === 'build_probe' && _openPanel === 2) {
    const btn = _lastShipButtons.find((candidate) => candidate.shipTypeId === 11);
    if (btn) drawTopicPointer(ctx, screenW, screenH, btn, 'above', 'BUILD A PROBE', [
      'A probe reveals an unowned star',
      'so your Colony Ship can target it.',
    ]);
    return;
  }
  if (step === 'colony_building') {
    drawTopicInfoCard(ctx, screenW, screenH, 'COLONY SHIP BUILDING', [
      'Your Colony Ship is being built.',
      'When construction completes, open',
      'FLEET to send it to a discovered star.',
    ], 'OK');
    return;
  }
  if (step === 'build_colony' && _openPanel === 2) {
    const btn = _lastShipButtons.find((candidate) => candidate.shipTypeId === 8);
    if (btn) drawTopicPointer(ctx, screenW, screenH, btn, 'above', 'BUILD A COLONY SHIP', [
      'This ship claims a discovered',
      'unowned star when you arrive.',
    ]);
    return;
  }
  if (step === 'send_colony') {
    drawTopicInfoCard(ctx, screenW, screenH, 'SEND THE COLONY SHIP', [
      'Open FLEET, press SEND, and choose',
      'a highlighted probed or visited star.',
      'Unexplored stars are unavailable.',
    ], 'NEXT');
    return;
  }
  if (step === 'arrival') {
    drawTopicInfoCard(ctx, screenW, screenH, 'WAIT FOR ARRIVAL', [
      'The Colony Ship travels in real time.',
      'When it arrives, visit that star',
      'yourself to continue.',
    ], 'NEXT');
    return;
  }
  if (step === 'visit') {
    drawTopicInfoCard(ctx, screenW, screenH, 'VISIT THE DESTINATION', [
      'Enter the destination star system.',
      'The Colony Ship marker will identify',
      'the planet selected for colonization.',
    ], 'NEXT');
    return;
  }
  if (step === 'locate_planet') {
    drawTopicInfoCard(ctx, screenW, screenH, 'LOCATE THE PLANET', [
      'Find the planet with the Colony Ship',
      'marker beside it. Scan planets if',
      'you need help finding the marker.',
    ], 'NEXT');
    return;
  }
  if (step === 'orbit') {
    if (_panelsDocked && _colonizeButton) {
      drawTopicPointer(ctx, screenW, screenH, _colonizeButton, 'above', 'CLAIM THIS STAR', [
        'Press COLONIZE to consume the',
        'Colony Ship and claim this star.',
      ]);
      return;
    }
    const ring = _coachPlanetRing;
    if (!ring || _panelsDocked) return;
    drawCoachCallout(ctx, screenW, screenH, 'navigate_dock',
      { x: ring.x - ring.r, y: ring.y - ring.r, w: ring.r * 2, h: ring.r * 2 }, 'above', true);
  }
}

function drawComsTopicOverlay(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
  if (_openPanel !== 4) return; // COMS panel must be open — forced on by openComsPanelForTutorial()
  const idx = getComsTopicIdx();
  const entry = COMS_TOPIC_TABS[idx];
  if (!entry) return;
  const phase = getComsTopicPhase();
  if (phase === 'explain') {
    // Alliance is the one tab with somewhere else to go: real alliance creation/management
    // isn't part of this walkthrough yet, so offer a branch out to explore it directly.
    const secondaryLabel = entry.tab === 'alliance' ? 'EXPLORE ALLIANCE \u2192' : undefined;
    const btn = _comsTabButtons.find((b) => b.tab === entry.tab);
    drawTopicInfoCard(ctx, screenW, screenH, entry.title, entry.lines, idx >= 3 ? 'DONE' : 'NEXT', secondaryLabel, btn);
    return;
  }
  // phase === 'point': ring the tab we want the player to actually tap
  const btn = _comsTabButtons.find((b) => b.tab === entry.tab);
  if (!btn) return;
  drawTopicPointer(ctx, screenW, screenH, { x: btn.x, y: btn.y, w: btn.w, h: btn.h }, 'above', `OPEN ${entry.label}`, [
    `Tap ${entry.label} to see what's there.`,
  ]);
}

/** Ring the ? icon while the idle hint pulses — reminds stalled players the tutorial exists. */
function drawHelpReminder(ctx: CanvasRenderingContext2D): void {
  const alpha = getJourneyPulseAlpha();
  if (alpha <= 0) return;
  const b = domButtonRect('help-btn');
  if (!b) return;
  ctx.save();
  ctx.strokeStyle = `rgba(255, 184, 77, ${0.3 + alpha * 0.7})`;
  ctx.lineWidth = 2;
  roundedRect(ctx, b.x - 4, b.y - 4, b.w + 8, b.h + 8, 5);
  ctx.stroke();
  ctx.restore();
}

/** Final card: congratulate, then offer to finish or continue to another tutorial. */
export function drawCoachCongratsTop(r: Renderer): void {
  _coachCongratsButtons = [];
  if (!isCoachActive() || getCoachStep() !== 'congrats') return;
  const dpr = window.devicePixelRatio || 1;
  drawCoachCongrats(r.ctx, r.width / dpr, r.height / dpr);
}

function drawCoachCongrats(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
  const AMBER = '#ffb84d';
  const boxW = Math.min(250, screenW - 24);
  const boxH = 152;
  const boxX = (screenW - boxW) / 2;
  const boxY = Math.max(8, (screenH - boxH) / 2);

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
  ctx.fillRect(0, 0, screenW, screenH);

  ctx.fillStyle = '#0a0600';
  roundedRect(ctx, boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2;
  roundedRect(ctx, boxX, boxY, boxW, boxH, 6);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = f(12, 'bold');
  ctx.fillStyle = AMBER;
  ctx.fillText('WELL DONE, COMMANDER', boxX + boxW / 2, boxY + 12);

  ctx.font = f(7);
  ctx.fillStyle = G_BRIGHT;
  const lines = [
    'Your base is upgrading and you',
    'have surveyed your first planet.',
    'The galaxy is yours to claim.',
  ];
  for (const [i, line] of lines.entries()) {
    ctx.fillText(line, boxX + boxW / 2, boxY + 32 + i * 11);
  }

  const itemW = boxW - 28;
  const itemH = 20;
  const itemX = boxX + 14;
  const itemY = boxY + 76;
  _coachCongratsButtons.push({ x: itemX, y: itemY, w: itemW, h: itemH, id: 'more' });
  roundedRect(ctx, itemX, itemY, itemW, itemH, 3);
  ctx.fillStyle = 'rgba(80, 45, 0, 0.6)';
  ctx.fill();
  roundedRect(ctx, itemX, itemY, itemW, itemH, 3);
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = f(8, 'bold');
  ctx.fillStyle = AMBER;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('MORE TUTORIALS', itemX + 8, itemY + itemH / 2);

  const fw = 92;
  const fh = 18;
  const fx = boxX + boxW / 2 - fw / 2;
  const fy = boxY + boxH - fh - 10;
  _coachCongratsButtons.push({ x: fx, y: fy, w: fw, h: fh, id: 'play' });
  roundedRect(ctx, fx, fy, fw, fh, 3);
  ctx.strokeStyle = 'rgba(255, 184, 77, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = f(8, 'bold');
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 184, 77, 0.8)';
  ctx.fillText('GO PLAY', fx + fw / 2, fy + fh / 2);

  ctx.restore();
}

/** Coach callout for the skin picker modal — drawn on top of the modal itself. */
export function drawCoachOverSkinPicker(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
  if (!isCoachActive() || getCoachStep() !== 'pick_skin') return;
  const btn = _skinPickerBtns[0];
  if (!btn) return;
  drawCoachCallout(ctx, screenW, screenH, 'pick_skin', { x: btn.x, y: btn.y, w: btn.w, h: btn.h }, 'above');
}

/** Coach callout for the dock panel buttons — the panel draws after the tab strip. */
function drawCoachOverDockPanel(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
  if (!isCoachActive()) return;
  const step = getCoachStep();
  const wanted = step === 'undock' ? 'leave' : step === 'scan' ? 'scan' : null;
  if (!wanted) return;
  const btn = _lastDockButtons.find((b) => b.action === wanted);
  if (!btn) return;
  drawCoachCallout(ctx, screenW, screenH, step, { x: btn.x, y: btn.y, w: btn.w, h: btn.h }, 'above');
}

function drawCoachCallout(
  ctx: CanvasRenderingContext2D,
  screenW: number, screenH: number,
  step: string,
  target: { x: number; y: number; w: number; h: number },
  placement: 'left' | 'above' | 'below',
  circle = false,
): void {
  const copy = COACH_COPY[step];
  if (!copy) return;

  const pulse = getCoachPulse();
  const AMBER = '#ffb84d';

  ctx.save();

  // Highlight ring around the target
  if (circle) {
    const cx = target.x + target.w / 2;
    const cy = target.y + target.h / 2;
    const rad = target.w / 2;
    ctx.strokeStyle = `rgba(255, 184, 77, ${0.55 + pulse * 0.45})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 184, 77, ${0.12 + pulse * 0.18})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, rad + 4 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = `rgba(255, 184, 77, ${0.55 + pulse * 0.45})`;
    ctx.lineWidth = 2;
    roundedRect(ctx, target.x - 3, target.y - 3, target.w + 6, target.h + 6, 5);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 184, 77, ${0.12 + pulse * 0.18})`;
    ctx.lineWidth = 6;
    roundedRect(ctx, target.x - 5 - pulse * 3, target.y - 5 - pulse * 3, target.w + 10 + pulse * 6, target.h + 10 + pulse * 6, 7);
    ctx.stroke();
  }

  // Callout box, beside or above the target depending on available room
  const acked = isCoachAcked();
  const boxW = Math.min(acked ? 132 : 176, screenW - 16);
  const lineH = 11;
  const titleH = copy.title.length * 11;
  const boxH = acked ? 30 : 15 + titleH + 4 + copy.lines.length * lineH + 20;
  let boxX: number;
  let boxY: number;
  if (placement === 'above') {
    boxX = target.x + target.w / 2 - boxW / 2;
    boxY = target.y - 10 - boxH;
  } else if (placement === 'below') {
    boxX = target.x + target.w / 2 - boxW / 2;
    boxY = target.y + target.h + 12;
  } else {
    boxX = target.x - 12 - boxW;
    boxY = target.y + target.h / 2 - boxH / 2;
    if (boxX < 6) boxX = Math.min(target.x, screenW - boxW - 6);
  }
  boxX = Math.max(6, Math.min(boxX, screenW - boxW - 6));
  boxY = Math.max(6, Math.min(boxY, screenH - boxH - 6));

  ctx.fillStyle = 'rgba(10, 6, 0, 0.94)';
  roundedRect(ctx, boxX, boxY, boxW, boxH, 5);
  ctx.fill();
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 1.5;
  roundedRect(ctx, boxX, boxY, boxW, boxH, 5);
  ctx.stroke();

  // Pointer arrow toward the target
  if (placement === 'above' && boxY + boxH <= target.y) {
    const ax = Math.max(boxX + 10, Math.min(target.x + target.w / 2, boxX + boxW - 10));
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(ax - 6, boxY + boxH);
    ctx.lineTo(ax, boxY + boxH + 8);
    ctx.lineTo(ax + 6, boxY + boxH);
    ctx.closePath();
    ctx.fill();
  } else if (placement === 'below' && boxY >= target.y + target.h) {
    const ax = Math.max(boxX + 10, Math.min(target.x + target.w / 2, boxX + boxW - 10));
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(ax - 6, boxY);
    ctx.lineTo(ax, boxY - 8);
    ctx.lineTo(ax + 6, boxY);
    ctx.closePath();
    ctx.fill();
  } else if (placement === 'left' && boxX + boxW <= target.x) {
    const arrowY = Math.max(boxY + 10, Math.min(target.y + target.h / 2, boxY + boxH - 10));
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(boxX + boxW, arrowY - 6);
    ctx.lineTo(boxX + boxW + 8, arrowY);
    ctx.lineTo(boxX + boxW, arrowY + 6);
    ctx.closePath();
    ctx.fill();
  }

  // Header
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  if (acked) {
    // Collapsed nudge: keep pointing at the target, offer SKIP to bail out
    ctx.font = f(8, 'bold');
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(255, 184, 77, ${0.7 + pulse * 0.3})`;
    ctx.fillText(copy.nudge, boxX + 10, boxY + boxH / 2);

    const sw = 30;
    const sh = 12;
    const sx2 = boxX + boxW - sw - 8;
    const sy2 = boxY + boxH / 2 - sh / 2;
    _coachSkipButton = { x: sx2, y: sy2, w: sw, h: sh };
    roundedRect(ctx, sx2, sy2, sw, sh, 3);
    ctx.strokeStyle = 'rgba(255, 184, 77, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = f(7, 'bold');
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 184, 77, 0.7)';
    ctx.fillText('SKIP', sx2 + sw / 2, sy2 + sh / 2);

    ctx.restore();
    return;
  }

  ctx.font = f(7, 'bold');
  ctx.fillStyle = 'rgba(255, 184, 77, 0.65)';
  ctx.fillText(`TUTORIAL ${copy.step}`, boxX + 10, boxY + 8);
  ctx.font = f(9, 'bold');
  ctx.fillStyle = AMBER;
  for (const [i, t] of copy.title.entries()) {
    ctx.fillText(t, boxX + 10, boxY + 19 + i * 11);
  }

  ctx.font = f(7);
  ctx.fillStyle = G_BRIGHT;
  for (const [i, line] of copy.lines.entries()) {
    ctx.fillText(line, boxX + 10, boxY + 23 + titleH + i * lineH);
  }

  // GOT IT button
  const gw = 46;
  const gh = 13;
  const gx = boxX + boxW - gw - 8;
  const gy = boxY + boxH - gh - 6;
  _coachGotItButton = { x: gx, y: gy, w: gw, h: gh };
  roundedRect(ctx, gx, gy, gw, gh, 3);
  ctx.fillStyle = 'rgba(80, 45, 0, 0.75)';
  ctx.fill();
  roundedRect(ctx, gx, gy, gw, gh, 3);
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = f(7, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = AMBER;
  ctx.fillText('GOT IT', gx + gw / 2, gy + gh / 2);

  ctx.restore();
}

/** Returns true when the click landed on a coach button. Call before any other hit test. */
export function hitTestCoachButtons(sx: number, sy: number): boolean {
  if (isShipsTopicActive() || isColonizationTopicActive() || isComsTopicActive()) {
    const skip = _topicSkipButton;
    if (skip && sx >= skip.x && sx <= skip.x + skip.w && sy >= skip.y && sy <= skip.y + skip.h) {
      dismissShipsTopic();
      dismissColonizationTopic();
      dismissComsTopic();
      playSound('click');
      return true;
    }
    const secondary = _topicSecondaryButton;
    if (secondary && sx >= secondary.x && sx <= secondary.x + secondary.w && sy >= secondary.y && sy <= secondary.y + secondary.h) {
      comsTopicBranchToAlliance();
      playSound('click');
      return true;
    }
    const primary = _topicPrimaryButton;
    if (primary && sx >= primary.x && sx <= primary.x + primary.w && sy >= primary.y && sy <= primary.y + primary.h) {
      if (isShipsTopicActive()) shipsTopicNext();
      else if (isColonizationTopicActive()) colonizationTopicNext();
      else comsTopicNext();
      playSound('click');
      return true;
    }
    // Pointer-only steps have no button here — let the tap fall through to the real
    // UI element (SHIPS tab, Probe button, COMS tab) so the click actually registers.
    return false;
  }

  if (!isCoachActive()) return false;
  for (const b of _coachCongratsButtons) {
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
      completeCoach();
      playSound('click');
      // More Tutorials deliberately reopens clean Help, after the player chose it.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (b.id === 'more') (globalThis as any).__openHelpTab?.('next');
      return true;
    }
  }
  const skip = _coachSkipButton;
  if (skip && sx >= skip.x && sx <= skip.x + skip.w && sy >= skip.y && sy <= skip.y + skip.h) {
    dismissCoach();
    playSound('click');
    return true;
  }
  const b = _coachGotItButton;
  if (!b) return false;
  if (sx < b.x || sx > b.x + b.w || sy < b.y || sy > b.y + b.h) return false;
  ackCoachStep();
  playSound('click');
  return true;
}

// ── Panel body renderers ──────────────────────────────────────────────────

function drawPanelFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  title: string, icon: string,
): void {
  installTextAudit(ctx);
  setAuditRegion(title, x, y, w);
  ctx.fillStyle = 'rgba(0, 10, 5, 0.88)';
  roundedRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = G_BRIGHT;
  ctx.lineWidth = 1;
  roundedRect(ctx, x, y, w, h, 4);
  ctx.stroke();

  // Title
  ctx.font = f(9, 'bold');
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

  ctx.font = f(8);
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

/** TRADE panel: trading station exchange buttons */
function drawTradePanelBody(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  _tradeButtons = [];

  if (!_tradeStationInfo || !_postId || _panelsStarIndex == null || _tradeStationInfo.starIndex !== _panelsStarIndex) {
    const bodyH = TAB_H;
    drawPanelFrame(ctx, x, y, w, bodyH, 'TRADE', '\u2696');
    ctx.font = f(8);
    ctx.fillStyle = G_MED;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Loading rates...', x + w / 2, y + bodyH / 2 + 6);
    return bodyH;
  }

  const trades: { give: 'ore' | 'food' | 'energy' | 'fuel'; receive: 'ore' | 'food' | 'energy' | 'fuel'; rateKey: keyof typeof _tradeStationInfo.rates }[] = [
    { give: 'ore', receive: 'food', rateKey: 'ore_food' },
    { give: 'ore', receive: 'energy', rateKey: 'ore_energy' },
    { give: 'ore', receive: 'fuel', rateKey: 'ore_fuel' },
    { give: 'food', receive: 'ore', rateKey: 'food_ore' },
    { give: 'food', receive: 'energy', rateKey: 'food_energy' },
    { give: 'food', receive: 'fuel', rateKey: 'food_fuel' },
    { give: 'energy', receive: 'ore', rateKey: 'energy_ore' },
    { give: 'energy', receive: 'food', rateKey: 'energy_food' },
    { give: 'energy', receive: 'fuel', rateKey: 'energy_fuel' },
    { give: 'fuel', receive: 'ore', rateKey: 'fuel_ore' },
    { give: 'fuel', receive: 'food', rateKey: 'fuel_food' },
    { give: 'fuel', receive: 'energy', rateKey: 'fuel_energy' },
  ];
  const btnH = 16;
  const btnGap = 3;
  const headerH = 42;
  const bodyH = headerH + trades.length * (btnH + btnGap) + PANEL_PAD;
  drawPanelFrame(ctx, x, y, w, bodyH, 'TRADE', '\u2696');

  // Stock header
  ctx.font = f(7);
  ctx.fillStyle = G_MED;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`STOCK O:${Math.floor(_tradeStationInfo.stock.ore)} F:${Math.floor(_tradeStationInfo.stock.food)} E:${Math.floor(_tradeStationInfo.stock.energy)} \u26FD:${Math.floor(_tradeStationInfo.stock.fuel)}`, x + PANEL_PAD, y + 28);

  // Trade buttons
  for (let i = 0; i < trades.length; i++) {
    const t = trades[i]!;
    const rate = _tradeStationInfo.rates[t.rateKey];
    const btnY = y + headerH + i * (btnH + btnGap);
    const btnX = x + PANEL_PAD;
    const btnW = w - PANEL_PAD * 2;

    // Button background
    ctx.fillStyle = 'rgba(0, 30, 20, 0.7)';
    roundedRect(ctx, btnX, btnY, btnW, btnH, 3);
    ctx.fill();
    ctx.strokeStyle = G_DIM;
    ctx.lineWidth = 0.5;
    roundedRect(ctx, btnX, btnY, btnW, btnH, 3);
    ctx.stroke();

    // Label
    const shortNames: Record<string, string> = { ore: 'ORE', food: 'FOOD', energy: 'ENRG', fuel: 'FUEL' };
    ctx.font = f(7, 'bold');
    ctx.fillStyle = G_BRIGHT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${shortNames[t.give]}\u2192${shortNames[t.receive]}  @${rate.toFixed(2)}`, btnX + 6, btnY + btnH / 2);

    // "TRADE 50" label on right
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgb(255, 215, 0)';
    ctx.fillText('TRADE 50', btnX + btnW - 6, btnY + btnH / 2);

    _tradeButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH, giveType: t.give, receiveType: t.receive });
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
  const gridRows = 3;
  const bodyH = 28 + 16 + gridRows * (extBtnH + extGap) + 20;

  drawPanelFrame(ctx, x, y, w, bodyH, 'BUILD', '\u2302');

  // Resource readout
  const oreNow = Math.floor(serverEcon?.store.ore ?? 0);
  const foodNow = Math.floor(serverEcon?.store.food ?? 0);
  const energyNow = Math.floor(serverEcon?.store.energy ?? 0);
  const fuelNow = Math.floor(serverEcon?.store.fuel ?? 0);
  const stationLevel = serverEcon?.buildings.station.level ?? 1;
  ctx.font = f(7);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = G_MED;
  ctx.fillText(`LV${toRoman(stationLevel)} O:${oreNow} F:${foodNow} E:${energyNow} Fu:${fuelNow}`, x + PANEL_PAD, y + 28);

  // COMPLETE button (if any build in progress)
  const hasActiveBuild = serverEcon
    ? Object.values(serverEcon.buildings).some((b) => b.status === 'UPGRADING')
    : false;
  const fleetState = starIndex != null ? _serverShipsByStarIndex.get(starIndex) : null;
  const buildingShip = fleetState?.building ?? null;
  const hasActiveShipBuild = buildingShip != null && buildingShip.completeAt > Date.now();
  if ((_isAdmin || _completeCharges > 0) && (hasActiveBuild || hasActiveShipBuild)) {
    const label = _isAdmin ? 'COMPLETE' : `COMPLETE (${_completeCharges})`;
    const cbW = _isAdmin ? 54 : 70;
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
    ctx.font = f(7, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffb84d';
    ctx.fillText(label, cbX + cbW / 2, cbY + cbH / 2);
  } else {
    _completeButton = null;
  }

  // Extension grid: 4 columns x 2 rows
  const gridStartY = y + 44;
  const cols = 4;
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
    // Actual build duration matches server: 120s + (targetLevel - 1) × 60s, converted to ms
    const actualBuildMs = (120 + (nextLevel - 1) * 60) * 1000;
    const progress = serverBuilding && serverBuilding.status === 'UPGRADING' && serverBuilding.completeAt != null
      ? Math.max(0, Math.min(100, Math.floor(((actualBuildMs - Math.max(0, serverBuilding.completeAt - nowMs)) / actualBuildMs) * 100)))
      : 0;
    const enabled = stationReady && canAfford && !isActive && !isMaxLevel && !isLocked && activeBuildCount === 0 && !_buildCooldown;
    const tierLabel = `${ext.label} ${toRoman(nextLevel)}`;

    // Compute lock reason from prereqs or station-cap
    let lockReason: string | undefined;
    if (isLocked && serverEcon) {
      const catalog = BUILDING_CATALOG[ext.key as keyof typeof BUILDING_CATALOG];
      if (catalog) {
        const missing: string[] = [];
        for (const [prereqType, requiredLevel] of Object.entries(catalog.prereqs)) {
          const prereqState = serverEcon.buildings[prereqType as keyof typeof serverEcon.buildings];
          if (!prereqState || prereqState.level < (requiredLevel ?? 0)) {
            const prereqLabel = BUILDING_CATALOG[prereqType as keyof typeof BUILDING_CATALOG]?.label ?? prereqType;
            missing.push(`${prereqLabel} ${toRoman(requiredLevel ?? 1)}`);
          }
        }
        if (missing.length > 0) lockReason = `NEED ${missing.join(', ')}`;
      }
    } else if (!isStationUpgrade && isMaxLevel && !isLocked && serverEcon) {
      // Building is capped by station level, not truly at catalog max
      const catalogMax = BUILDING_CATALOG[ext.key as keyof typeof BUILDING_CATALOG]?.maxLevel ?? MAX_STATION_LEVEL;
      if (level < catalogMax) {
        lockReason = `NEED Station ${toRoman(level + 1)}`;
      }
    }

    _lastExtensionButtons.push({ action: ext.action, label: tierLabel, x: bx, y: by, w: extBtnW, h: extBtnH, enabled, ...(lockReason !== undefined ? { lockReason } : {}) });

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
    ctx.font = f(7, 'bold');
    ctx.fillText(tierLabel, bx + extBtnW / 2, by + 4);

    ctx.font = f(7);
    if (isMaxLevel) {
      ctx.fillStyle = G_MED;
      ctx.fillText(isStationUpgrade ? 'MAX' : `LV ${toRoman(level)}`, bx + extBtnW / 2, by + 18);
      // Show flash message if station-capped
      if (lockReason && _lockFlash && _lockFlash.action === ext.action && _lockFlash.expireMs > Date.now()) {
        ctx.fillStyle = '#ffb84d';
        ctx.font = f(6);
        ctx.fillText(lockReason, bx + extBtnW / 2, by + 30);
        ctx.font = f(7);
      }
    } else if (isActive) {
      const remainingSec = serverBuilding?.completeAt != null ? Math.max(0, Math.ceil((serverBuilding.completeAt - nowMs) / 1000)) : 0;
      ctx.fillStyle = G_MED;
      ctx.fillText(`${progress}% (${remainingSec}s)`, bx + extBtnW / 2, by + 18);
      const barX = bx + 4;
      const barY = by + 30;
      const barW = extBtnW - 8;
      const fillW = Math.floor((barW * progress) / 100);
      ctx.fillStyle = 'rgba(79, 255, 176, 0.2)';
      ctx.fillRect(barX, barY, barW, 5);
      ctx.fillStyle = G_BRIGHT;
      ctx.fillRect(barX, barY, fillW, 5);
    } else {
      ctx.fillStyle = canAfford ? G_COST : G_COST_OFF;
      ctx.fillText(`${effectiveCost.ore}/${effectiveCost.food}/${effectiveCost.energy}`, bx + extBtnW / 2, by + 18);
      const isBusy = activeBuildCount > 0 && !isActive;
      const isFlashing = isLocked && _lockFlash && _lockFlash.action === ext.action && _lockFlash.expireMs > Date.now();
      const statusLabel = isFlashing && lockReason
        ? lockReason
        : enabled
          ? (level >= 1 ? 'UPGRADE' : 'BUILD')
          : isBusy
            ? (level >= 1 ? `LV ${toRoman(level)}` : 'BUSY')
            : isLocked ? 'LOCKED' : 'NEED RES';
      ctx.fillStyle = isFlashing ? '#ffb84d' : enabled ? G_BRIGHT : G_MED;
      ctx.font = isFlashing ? f(6) : f(7);
      ctx.fillText(statusLabel, bx + extBtnW / 2, by + 30);
      ctx.font = f(7);
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
    (s) => s.count > 0 && UPGRADE_PATH.includes(s.typeId as ShipTypeId),
  );

  // Show Basic Probe (11), Enhanced Probe (12), Colony Ship (8), Freighter (2), Raider (15)
  const SHOWN_BUILD_IDS = hasUpgradePathShip ? [2, 11, 12, 8, 15] : [2, 11, 12, 8, 15];
  const availableShips = Object.values(SHIP_CATALOG).filter(
    (entry) => SHOWN_BUILD_IDS.includes(entry.id),
  );
  const cols = 2;
  const cellW = Math.floor((w - PANEL_PAD * 2 - 6) / cols);
  const cellH = 56;
  const cellGap = 6;

  // Upgrade section (player's ship on upgrade path) — shown at top
  const upgradeEntries: { from: typeof SHIP_CATALOG[keyof typeof SHIP_CATALOG]; to: typeof SHIP_CATALOG[keyof typeof SHIP_CATALOG]; dockLocked: boolean }[] = [];
  for (const ship of fleetShips) {
    if (ship.count <= 0) continue;
    const pathIdx = UPGRADE_PATH.indexOf(ship.typeId as ShipTypeId);
    if (pathIdx >= 0 && pathIdx < UPGRADE_PATH.length - 1) {
      const nextTypeId = UPGRADE_PATH[pathIdx + 1]!;
      const fromEntry = SHIP_CATALOG[ship.typeId as keyof typeof SHIP_CATALOG];
      const toEntry = SHIP_CATALOG[nextTypeId as keyof typeof SHIP_CATALOG];
      if (fromEntry && toEntry) {
        upgradeEntries.push({ from: fromEntry, to: toEntry, dockLocked: !canUpgradeShip(ship.typeId as ShipTypeId, dockLevel) });
      }
    }
  }

  // Calculate body height: upgrade section first, then build grid
  // Check if there's an active upgrade build to show even without upgradeEntries
  const isUpgradeBuildActive = buildingShip != null && UPGRADE_PATH.includes(buildingShip.typeId as ShipTypeId) && buildingShip.completeAt > nowMs;
  const upgradeRows = Math.max(upgradeEntries.length, isUpgradeBuildActive ? 1 : 0);
  const upgradeDisplayH = upgradeRows > 0 ? 16 + upgradeRows * (cellH + cellGap) : 0;
  const buildRows = Math.ceil(availableShips.length / cols);
  const buildH = buildRows > 0 ? 16 + buildRows * (cellH + cellGap) : 0;
  const bodyH = 28 + upgradeDisplayH + buildH + 12;

  drawPanelFrame(ctx, x, y, w, bodyH, 'SHIPS', '\u{1F680}');

  // Header: dock level
  ctx.font = f(7);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = G_MED;
  ctx.fillText(dockLevel > 0 ? `DOCK LV ${toRoman(dockLevel)}` : 'NO DOCK', x + PANEL_PAD, y + 28);

  _lastShipButtons = [];
  const gridStartX = x + PANEL_PAD;
  let cursorY = y + 40;

  // ── UPGRADE section (top, orange) ──
  if (upgradeEntries.length > 0 || isUpgradeBuildActive) {
    ctx.font = f(7, 'bold');
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
        ctx.font = f(7, 'bold');
        ctx.fillStyle = '#ffb84d';
        ctx.fillText(`UPGRADING \u2192 ${buildCatalog.name.toUpperCase()}`, bx + 32, by + 6);
        ctx.font = f(7);
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
      const blueprintOverride = _completeCharges > 0 && dockLevel > 0 && !isBuilding && (ue.dockLocked || !canAfford);
      const enabled = !isBuilding && (canAfford && !ue.dockLocked || blueprintOverride);
      const disableReason = isBuilding ? 'already building' : ue.dockLocked && !blueprintOverride ? 'dock level too low' : !canAfford && !blueprintOverride ? 'insufficient resources' : undefined;

      _lastShipButtons.push({ x: bx, y: by, w: fullW, h: cellH, shipTypeId: ue.to.id, enabled, isUpgrade: true, upgradeFromTypeId: ue.from.id, disableReason, useBlueprint: blueprintOverride });

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
      ctx.font = f(7, 'bold');
      ctx.fillStyle = enabled || isUpgradeBuild ? '#ffb84d' : '#997733';
      ctx.fillText(`${ue.from.name.toUpperCase()} \u2192 ${ue.to.name.toUpperCase()}`, bx + 32, by + 4);

      if (isUpgradeBuild) {
        const remaining = Math.max(0, Math.ceil((buildingShip!.completeAt - nowMs) / 1000));
        const totalBuild = ue.to.buildSeconds;
        const progress = Math.max(0, Math.min(100, Math.floor(((totalBuild - remaining) / totalBuild) * 100)));
        ctx.font = f(7);
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
        ctx.font = f(7);
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
    ctx.font = f(7, 'bold');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = G_BRIGHT;
    ctx.fillText('BUILD', x + PANEL_PAD, cursorY);
    cursorY += 12;

    // Building indicator with progress bar
    if (buildingShip && !UPGRADE_PATH.includes(buildingShip.typeId as ShipTypeId)) {
      const bEntry = SHIP_CATALOG[buildingShip.typeId as keyof typeof SHIP_CATALOG];
      if (bEntry) {
        const remaining = Math.max(0, Math.ceil((buildingShip.completeAt - nowMs) / 1000));
        const totalBuild = bEntry.buildSeconds;
        const progress = Math.max(0, Math.min(100, Math.floor(((totalBuild - remaining) / totalBuild) * 100)));
        ctx.fillStyle = G_BRIGHT;
        ctx.font = f(7);
        ctx.fillText(`BUILDING: ${bEntry.name.toUpperCase()} ${progress}%  (${remaining}s)`, x + PANEL_PAD + 40, cursorY - 12);
        // Progress bar
        const barX = x + PANEL_PAD;
        const barW = w - PANEL_PAD * 2;
        const barY2 = cursorY - 2;
        const barH = 4;
        ctx.fillStyle = 'rgba(79, 255, 176, 0.15)';
        ctx.fillRect(barX, barY2, barW, barH);
        ctx.fillStyle = G_BRIGHT;
        ctx.fillRect(barX, barY2, Math.floor((barW * progress) / 100), barH);
        cursorY += 6;
      }
    }

    for (const [idx, entry] of availableShips.entries()) {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const bx = gridStartX + col * (cellW + cellGap);
      const by = cursorY + row * (cellH + cellGap);

      const isBuilding = buildingShip != null && buildingShip.completeAt > nowMs;
      const dockLocked = !canBuildShip(entry.id as ShipTypeId, dockLevel);
      const canAfford = serverEcon
        ? serverEcon.store.ore >= entry.cost.ore && serverEcon.store.food >= entry.cost.food && serverEcon.store.energy >= entry.cost.energy
        : false;
      const blueprintOverride = _completeCharges > 0 && dockLevel > 0 && !isBuilding && (dockLocked || !canAfford);
      const enabled = !isBuilding && (!dockLocked && canAfford || blueprintOverride);
      const disableReason = isBuilding ? 'already building' : dockLocked && !blueprintOverride ? 'dock level too low' : !canAfford && !blueprintOverride ? 'insufficient resources' : undefined;

      _lastShipButtons.push({ x: bx, y: by, w: cellW, h: cellH, shipTypeId: entry.id, enabled, isUpgrade: false, disableReason, useBlueprint: blueprintOverride });

      roundedRect(ctx, bx, by, cellW, cellH, 3);
      ctx.fillStyle = blueprintOverride ? 'rgba(80, 50, 0, 0.5)' : enabled ? 'rgba(20, 60, 80, 0.5)' : 'rgba(15, 25, 35, 0.5)';
      ctx.fill();
      roundedRect(ctx, bx, by, cellW, cellH, 3);
      ctx.strokeStyle = blueprintOverride ? '#ffb84d' : enabled ? G_BRIGHT : G_FAINT;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Ship icon (bottom-left)
      const icon = getShipIcon(entry.icon);
      if (icon) {
        const iconSize = 24;
        ctx.globalAlpha = dockLocked ? 0.4 : 1;
        ctx.drawImage(icon, bx + 4, by + cellH - iconSize - 4, iconSize, iconSize);
        ctx.globalAlpha = 1;
      }

      // Ship name + cost
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = enabled ? G_BRIGHT : G_MED;
      ctx.font = f(7, 'bold');
      ctx.fillText(entry.name.toUpperCase(), bx + 30, by + 4);
      ctx.font = f(7);
      ctx.fillStyle = dockLocked ? 'rgba(255, 100, 80, 0.7)' : G_DIM;
      if (dockLocked) {
        ctx.fillText(`DOCK LV${entry.dockLevel} REQ`, bx + 30, by + 14);
      } else {
        ctx.fillStyle = G_COST;
        ctx.fillText(`${entry.cost.ore}/${entry.cost.food}/${entry.cost.energy}`, bx + 30, by + 14);
      }
      ctx.fillStyle = G_MED;
      ctx.fillText(`${entry.buildSeconds}s  SP:${entry.shipPoints}`, bx + 30, by + 24);
    }
  }

  return bodyH;
}

/** Estimate fleet panel height without drawing (for bottom-anchoring) */
function estimateShipsPanelHeight(): number {
  const starIndex = _panelsStarIndex;
  const fleetState = starIndex != null ? _serverShipsByStarIndex.get(starIndex) : null;
  const fleetShips = fleetState?.ships ?? [];
  const buildingShip = fleetState?.building ?? null;
  const nowMs = Date.now();

  const isUpgradeBuildActive = buildingShip != null && UPGRADE_PATH.includes(buildingShip.typeId as ShipTypeId) && buildingShip.completeAt > nowMs;
  const upgradeRows = Math.max(
    fleetShips.filter(s => s.count > 0 && UPGRADE_PATH.includes(s.typeId as ShipTypeId)).length,
    isUpgradeBuildActive ? 1 : 0,
  );
  const cellH = 56;
  const cellGap = 6;
  const upgradeDisplayH = upgradeRows > 0 ? 16 + upgradeRows * (cellH + cellGap) : 0;
  const buildRows = Math.ceil(5 / 2); // 5 build options in 2 columns
  const buildH = buildRows > 0 ? 16 + buildRows * (cellH + cellGap) : 0;
  return Math.max(TAB_H, 28 + upgradeDisplayH + buildH + 12);
}

function estimateFleetPanelHeight(): number {
  // Galaxy view: same logic as drawFleetGalaxyView (exclude player's active ship)
  const SHAPE_TO_TYPE: Record<string, number> = {
    scout: 1, destroyer: 3, frigate: 4, battleship: 5, cruiser: 6, dreadnought: 7,
  };
  const activeShipTypeId = SHAPE_TO_TYPE[_panelsShipShape] ?? 1;

  let lineCount = 0;
  for (const [si, state] of _serverShipsByStarIndex.entries()) {
    let ships = state.ships;
    if (si === _panelsStarIndex) {
      ships = ships.map(s => s.typeId === activeShipTypeId ? { ...s, count: s.count - 1 } : s);
    }
    const visible = ships.filter(s => s.count > 0);
    if (visible.length > 0) {
      lineCount += 1;
      lineCount += visible.length;
    }
  }
  if (_serverTransits.length > 0) {
    lineCount += 1 + _serverTransits.length;
  }
  if (lineCount === 0) lineCount = 2;
  lineCount += 1; // total row
  return Math.max(TAB_H, lineCount * ROW_H + PANEL_PAD * 2 + 28);
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

  return drawFleetGalaxyView(ctx, x, y, w);
}

/** Fleet panel at Galaxy tier: shows all stars' fleets with SEND buttons */
function drawFleetGalaxyView(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  // Determine player's active ship typeId to exclude from fleet display
  const SHAPE_TO_TYPE: Record<string, number> = {
    scout: 1, destroyer: 3, frigate: 4, battleship: 5, cruiser: 6, dreadnought: 7,
  };
  const activeShipTypeId = SHAPE_TO_TYPE[_panelsShipShape] ?? 1;

  // Gather all known star fleets, excluding player's active ship at home star
  const entries: Array<{ starIndex: number; ships: Array<{ typeId: number; count: number }> }> = [];
  for (const [si, state] of _serverShipsByStarIndex.entries()) {
    let ships = state.ships;
    // At home star, subtract 1 from the player's active ship type
    if (si === _panelsStarIndex) {
      ships = ships.map(s => s.typeId === activeShipTypeId ? { ...s, count: s.count - 1 } : s);
    }
    const visible = ships.filter(s => s.count > 0);
    if (visible.length > 0) {
      entries.push({ starIndex: si, ships: visible });
    }
  }

  const transits = _serverTransits;
  const fRoutes = _serverFreighterRoutes;

  // Calculate height
  let lineCount = 0;
  for (const e of entries) {
    lineCount += 1; // star header
    lineCount += e.ships.filter(s => s.count > 0).length; // ship rows
  }
  if (transits.length > 0) {
    lineCount += 1; // "IN TRANSIT" header
    lineCount += transits.length; // one row per transit
  }
  if (fRoutes.length > 0) {
    lineCount += 1; // "TRADE ROUTES" header
    lineCount += fRoutes.length * 2; // two rows per route (route + cargo/status)
  }
  if (_serverRaidRoutes.length > 0) {
    lineCount += 1; // "RAID ROUTES" header
    lineCount += _serverRaidRoutes.length * 2;
  }
  if (entries.length === 0 && transits.length === 0 && fRoutes.length === 0) lineCount = 2;
  lineCount += 1; // total row

  const bodyH = Math.max(TAB_H, lineCount * ROW_H + PANEL_PAD * 2 + 28);
  drawPanelFrame(ctx, x, y, w, bodyH, 'FLEET \u2014 ALL STARS', '\u2694');

  ctx.font = f(8);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  let cy = y + 28;
  let totalSP = 0;

  if (entries.length === 0 && transits.length === 0) {
    ctx.fillStyle = G_DIM;
    ctx.fillText('No fleet deployed', x + PANEL_PAD, cy);
    cy += ROW_H;
    ctx.fillText('Dock at a star to build ships', x + PANEL_PAD, cy);
    cy += ROW_H;
  } else {
    for (const e of entries) {
      // Star header
      const isHome = e.starIndex === _homeStarIndex;
      const starName = STAR_NAMES[e.starIndex % STAR_NAMES.length] ?? `Star ${e.starIndex}`;
      ctx.fillStyle = G_BRIGHT;
      ctx.fillText(`\u2605 ${starName}${isHome ? ' (HOME)' : ''}`, x + PANEL_PAD, cy);
      cy += ROW_H;

      // Ships at this star
      for (const s of e.ships) {
        if (s.count <= 0) continue;
        const entry = SHIP_CATALOG[s.typeId as keyof typeof SHIP_CATALOG];
        if (!entry) continue;
        totalSP += entry.shipPoints * s.count;
        ctx.fillStyle = G_MED;
        ctx.fillText(`  ${entry.name} x${s.count}`, x + PANEL_PAD, cy);

        // [SEND] or [FUEL] button
        const isProbe = s.typeId === 11 || s.typeId === 12;
        const probeFuel = isProbe ? getBaseFuel(e.starIndex) : 0;
        const needsFuel = isProbe && probeFuel < PROBE_MIN_FUEL_COST;
        const btnW = 28;
        const btnH = 10;
        const btnX = x + w - PANEL_PAD - btnW;
        const btnY = cy;
        ctx.strokeStyle = needsFuel ? 'rgba(255, 184, 77, 0.6)' : G_MED;
        ctx.lineWidth = 0.5;
        roundedRect(ctx, btnX, btnY, btnW, btnH, 2);
        ctx.stroke();
        ctx.fillStyle = needsFuel ? '#ffb84d' : G_BRIGHT;
        ctx.font = f(7);
        ctx.textAlign = 'center';
        ctx.fillText(needsFuel ? 'FUEL' : 'SEND', btnX + btnW / 2, btnY + 1.5);
        ctx.textAlign = 'left';
        ctx.font = f(8);
        _fleetSendButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH, starIndex: e.starIndex, shipTypeId: s.typeId });

        cy += ROW_H;
      }
    }

    // ── In-Transit Section ──
    if (transits.length > 0) {
      ctx.fillStyle = '#ffb84d'; // AMBER
      ctx.fillText('\u2192 IN TRANSIT', x + PANEL_PAD, cy);
      cy += ROW_H;

      const now = Date.now();
      for (const t of transits) {
        const entry = SHIP_CATALOG[t.shipTypeId as keyof typeof SHIP_CATALOG];
        if (!entry) continue;
        const fromName = STAR_NAMES[t.fromStarIndex % STAR_NAMES.length] ?? '?';
        const toName = STAR_NAMES[t.toStarIndex % STAR_NAMES.length] ?? '?';
        const remainMs = Math.max(0, t.arrivalAt - now);
        const remainSec = Math.ceil(remainMs / 1000);
        const mm = Math.floor(remainSec / 60);
        const ss = remainSec % 60;
        const timeStr = mm > 0 ? `${mm}m${ss.toString().padStart(2, '0')}s` : `${ss}s`;
        ctx.fillStyle = '#ffb84d'; // AMBER
        ctx.fillText(`  ${entry.name} x${t.count}`, x + PANEL_PAD, cy);
        ctx.fillStyle = 'rgba(255, 184, 77, 0.6)';
        ctx.font = f(7);
        ctx.textAlign = 'right';
        ctx.fillText(`${fromName}\u2192${toName} ${timeStr}`, x + w - PANEL_PAD, cy + 1);
        ctx.textAlign = 'left';
        ctx.font = f(8);
        cy += ROW_H;
      }
    }

    // ── Trade Routes Section ──
    _fleetCancelRouteButtons = [];
    if (fRoutes.length > 0) {
      ctx.fillStyle = '#4af'; // CYAN-BLUE
      ctx.fillText('\u{1F6A2} TRADE ROUTES', x + PANEL_PAD, cy);
      cy += ROW_H;

      const now = Date.now();
      for (const route of fRoutes) {
        const homeName = STAR_NAMES[route.homeStarIndex % STAR_NAMES.length] ?? '?';
        const targetName = STAR_NAMES[route.targetStarIndex % STAR_NAMES.length] ?? '?';
        const remainMs = Math.max(0, route.arrivalAt - now);
        const remainSec = Math.ceil(remainMs / 1000);
        const mm = Math.floor(remainSec / 60);
        const ss = remainSec % 60;
        const timeStr = mm > 0 ? `${mm}m${ss.toString().padStart(2, '0')}s` : `${ss}s`;
        const legLabel = route.leg === 'outbound' ? '\u2192 PICKUP' : '\u2190 DELIVER';

        // Route line: "HomeStarName ↔ TargetStarName"
        ctx.fillStyle = '#4af';
        ctx.fillText(`  ${homeName} \u21c4 ${targetName}`, x + PANEL_PAD, cy);

        // [CANCEL] button
        const cancelW = 28;
        const cancelH = 10;
        const cancelX = x + w - PANEL_PAD - cancelW;
        const cancelY = cy;
        ctx.strokeStyle = 'rgba(255, 100, 80, 0.6)';
        ctx.lineWidth = 0.5;
        roundedRect(ctx, cancelX, cancelY, cancelW, cancelH, 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 100, 80, 0.8)';
        ctx.font = f(7);
        ctx.textAlign = 'center';
        ctx.fillText('STOP', cancelX + cancelW / 2, cancelY + 1.5);
        ctx.textAlign = 'left';
        ctx.font = f(8);
        _fleetCancelRouteButtons.push({ x: cancelX, y: cancelY, w: cancelW, h: cancelH, routeId: route.id });
        cy += ROW_H;

        // Status line: leg direction + ETA + cargo summary
        const hasCargo = route.cargo.ore > 0 || route.cargo.food > 0 || route.cargo.energy > 0;
        const cargoStr = hasCargo
          ? ` [${Math.floor(route.cargo.ore)}o/${Math.floor(route.cargo.food)}f/${Math.floor(route.cargo.energy)}e]`
          : '';
        ctx.fillStyle = 'rgba(68, 170, 255, 0.6)';
        ctx.font = f(7);
        ctx.fillText(`    ${legLabel} ${timeStr}${cargoStr}`, x + PANEL_PAD, cy);
        ctx.font = f(8);
        cy += ROW_H;
      }
    }

    // ── Raid Routes Section ──
    if (_serverRaidRoutes.length > 0) {
      ctx.fillStyle = '#f44'; // RED
      ctx.fillText('\u2694\uFE0F RAID ROUTES', x + PANEL_PAD, cy);
      cy += ROW_H;

      const now = Date.now();
      for (const route of _serverRaidRoutes) {
        const homeName = STAR_NAMES[route.homeStarIndex % STAR_NAMES.length] ?? '?';
        const targetName = STAR_NAMES[route.targetStarIndex % STAR_NAMES.length] ?? '?';
        const remainMs = Math.max(0, route.arrivalAt - now);
        const remainSec = Math.ceil(remainMs / 1000);
        const mm = Math.floor(remainSec / 60);
        const ss = remainSec % 60;
        const timeStr = mm > 0 ? `${mm}m${ss.toString().padStart(2, '0')}s` : `${ss}s`;
        const legLabel = route.leg === 'outbound' ? '\u2192 RAIDING' : '\u2190 LOOT';
        const destroyPct = Math.round((1 - route.successChance) * 100);
        const riskStr = destroyPct > 0 ? ` \u2620${destroyPct}%` : '';

        ctx.fillStyle = '#f44';
        ctx.fillText(`  ${homeName} \u2192 ${targetName}${riskStr}`, x + PANEL_PAD, cy);
        cy += ROW_H;

        const hasCargo = route.cargo.ore > 0 || route.cargo.food > 0 || route.cargo.energy > 0;
        const cargoStr = hasCargo
          ? ` [${Math.floor(route.cargo.ore)}o/${Math.floor(route.cargo.food)}f/${Math.floor(route.cargo.energy)}e]`
          : '';
        ctx.fillStyle = 'rgba(255, 68, 68, 0.6)';
        ctx.font = f(7);
        ctx.fillText(`    ${legLabel} ${timeStr}${cargoStr}`, x + PANEL_PAD, cy);
        ctx.font = f(8);
        cy += ROW_H;
      }
    }
  }

  // Total
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(`TOTAL: ${totalSP} SP`, x + PANEL_PAD, cy);

  // Flash message (e.g. "NEED 500 FUEL (HAVE 0)")
  if (_lockFlash && _lockFlash.expireMs > Date.now() && _lockFlash.action.startsWith('NEED')) {
    cy += ROW_H;
    ctx.fillStyle = '#ffb84d';
    ctx.font = f(7);
    ctx.fillText(_lockFlash.action, x + PANEL_PAD, cy);
    ctx.font = f(8);
  }

  // POST button (share fleet to comments)
  _fleetShareButton = null;
  if (entries.length > 0) {
    const btnW = 28;
    const btnH = 10;
    const btnX = x + w - PANEL_PAD - btnW;
    const btnY = cy;
    const onCooldown = Date.now() < _fleetShareCooldownUntil;
    ctx.strokeStyle = onCooldown ? 'rgba(100,100,100,0.5)' : '#4f4';
    ctx.lineWidth = 0.5;
    roundedRect(ctx, btnX, btnY, btnW, btnH, 2);
    ctx.stroke();
    ctx.fillStyle = onCooldown ? 'rgba(100,100,100,0.5)' : '#4f4';
    ctx.font = f(7);
    ctx.textAlign = 'center';
    ctx.fillText(onCooldown ? '...' : 'POST', btnX + btnW / 2, btnY + 1.5);
    ctx.textAlign = 'left';
    ctx.font = f(8);
    if (!onCooldown) {
      _fleetShareButton = { x: btnX, y: btnY, w: btnW, h: btnH };
    }
  }

  return bodyH;
}

/** Fleet panel at System/Planet tier: single star + MAP button */
export function drawFleetLocalView(
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

  ctx.font = f(8);
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
  ctx.font = f(8, 'bold');
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
  ctx.font = f(12, 'bold');
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(tierName, x, 12);
  if (locationName) {
    ctx.font = f(11);
    ctx.fillStyle = G_MED;
    ctx.fillText(locationName, x, 28);
  }
  ctx.restore();
}

// ── Coms Panel Body ─────────────────────────────────────────────────────────

// Hit areas for DM contact buttons and back button
interface ComsContactButton { name: string; x: number; y: number; w: number; h: number }
let _comsContactButtons: ComsContactButton[] = [];
let _comsBackButton: { x: number; y: number; w: number; h: number } | null = null;
let _comsSendButton: { x: number; y: number; w: number; h: number } | null = null;
let _comsTabButtons: { tab: ComsTab; x: number; y: number; w: number; h: number }[] = [];
let _publicReplyButtons: { comment: PublicComment; x: number; y: number; w: number; h: number }[] = [];
let _publicPostButton: { x: number; y: number; w: number; h: number } | null = null;

function getComsTabUnreadCount(tab: ComsTab): number {
  if (tab === 'public') return _comsUnreadCount;
  if (tab === 'private') return _dmUnreadFrom.length;
  if (tab === 'alliance') return _allianceInvites.length;
  return 0;
}

function drawComsPanelBody(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  _comsTabButtons = [];
  _publicReplyButtons = [];
  _publicPostButton = null;

  // Draw tabs (PUBLIC / PRIVATE / ALLIANCE / BOARD)
  const tabH = 16;
  const tabs: { tab: ComsTab; label: string }[] = [
    { tab: 'public', label: 'PUBLIC' },
    { tab: 'private', label: 'DM' },
    { tab: 'alliance', label: 'ALLY' },
    { tab: 'board', label: 'BOARD' },
  ];
  const tabW = (w - 8) / tabs.length;
  for (let i = 0; i < tabs.length; i++) {
    const tx = x + 4 + i * tabW;
    const ty = y;
    const tab = tabs[i]!;
    const active = _comsTab === tab.tab;
    const unreadCount = getComsTabUnreadCount(tab.tab);
    const hasUnread = unreadCount > 0 && !active;
    ctx.fillStyle = active ? 'rgba(0, 255, 128, 0.15)' : hasUnread ? 'rgba(255, 184, 77, 0.18)' : 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(tx, ty, tabW, tabH);
    ctx.strokeStyle = active ? G_BRIGHT : hasUnread ? '#ffb84d' : G_MED;
    ctx.lineWidth = hasUnread ? 1 : 0.5;
    ctx.strokeRect(tx, ty, tabW, tabH);
    ctx.font = f(7, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = active ? G_BRIGHT : hasUnread ? '#ffb84d' : G_MED;
    ctx.fillText(tab.label, tx + tabW / 2, ty + tabH / 2);
    if (hasUnread) {
      const badgeX = tx + tabW - 6;
      const badgeY = ty + 4;
      ctx.fillStyle = '#ff5a3d';
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = f(5, 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(unreadCount > 9 ? '9+' : String(unreadCount), badgeX, badgeY);
    }
    _comsTabButtons.push({ tab: tab.tab, x: tx, y: ty, w: tabW, h: tabH });
  }

  const contentY = y + tabH + 2;

  if (_comsTab === 'private') {
    // If a DM conversation is open, show that
    if (_dmPeer) {
      return tabH + 2 + drawDMConversation(ctx, x, contentY, w);
    }
    // Otherwise show contacts list
    return tabH + 2 + drawComsContacts(ctx, x, contentY, w);
  } else if (_comsTab === 'alliance') {
    return tabH + 2 + drawAllianceBody(ctx, x, contentY, w);
  } else if (_comsTab === 'board') {
    return tabH + 2 + drawLeaderboardBody(ctx, x, contentY, w);
  } else {
    // Public tab
    if (_publicRecipient === null) {
      return tabH + 2 + drawPublicContactList(ctx, x, contentY, w);
    } else if (_publicRecipient === '__ALL__') {
      return tabH + 2 + drawPublicComments(ctx, x, contentY, w);
    } else {
      return tabH + 2 + drawPublicPlayerView(ctx, x, contentY, w);
    }
  }
}

// ── Leaderboard Panel Drawing ──────────────────────────────────────────────

function drawLeaderboardBody(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  const rowH = 14;
  const headerH = 28;
  const players = _leaderboardData;
  const rowCount = Math.max(players.length, 1);
  const bodyH = headerH + rowCount * rowH + PANEL_PAD * 2 + 18; // +18 for seed button

  drawPanelFrame(ctx, x, y, w, bodyH, 'LEADERBOARD', '\u{1F3C6}');

  if (players.length === 0) {
    ctx.font = f(7);
    ctx.fillStyle = G_DIM;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NO PLAYER DATA', x + w / 2, y + headerH + 14);
    // Seed button (admin only)
    if (_isAdmin) {
      const btnW = 80;
      const btnH = 14;
      const btnX = x + (w - btnW) / 2;
      const btnY = y + bodyH - PANEL_PAD - btnH;
      ctx.fillStyle = 'rgba(128, 0, 255, 0.15)';
      ctx.fillRect(btnX, btnY, btnW, btnH);
      ctx.strokeStyle = '#a060ff';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(btnX, btnY, btnW, btnH);
      ctx.font = f(7, 'bold');
      ctx.fillStyle = '#c090ff';
      ctx.fillText('SEED TEST DATA', btnX + btnW / 2, btnY + btnH / 2);
      _leaderboardSeedButton = { x: btnX, y: btnY, w: btnW, h: btnH };
    }
    return bodyH;
  }
  _leaderboardSeedButton = null;

  // Column header
  const colX = {
    rank: x + PANEL_PAD,
    name: x + PANEL_PAD + 18,
    stars: x + w - PANEL_PAD - 68,
    ships: x + w - PANEL_PAD - 40,
    power: x + w - PANEL_PAD,
  };

  ctx.font = f(7, 'bold');
  ctx.textBaseline = 'middle';
  ctx.fillStyle = G_DIM;
  const hdrY = y + headerH - 4;
  ctx.textAlign = 'left';
  ctx.fillText('#', colX.rank, hdrY);
  ctx.fillText('PLAYER', colX.name, hdrY);
  ctx.fillText('STAR', colX.stars, hdrY);
  ctx.fillText('SHIP', colX.ships, hdrY);
  ctx.textAlign = 'right';
  ctx.fillText('PWR', colX.power, hdrY);

  // Draw rows
  for (let i = 0; i < players.length; i++) {
    const entry = players[i]!;
    const ry = y + headerH + i * rowH;
    const isMe = _username !== null && entry.username.toLowerCase() === _username.toLowerCase();

    // Highlight current player's row
    if (isMe) {
      ctx.fillStyle = 'rgba(0, 255, 128, 0.1)';
      ctx.fillRect(x + 4, ry, w - 8, rowH - 1);
    }

    // Rank medal colors
    const rankColor = entry.rank === 1 ? '#ffd700' : entry.rank === 2 ? '#c0c0c0' : entry.rank === 3 ? '#cd7f32' : G_MED;
    ctx.font = f(7, 'bold');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rankColor;
    ctx.fillText(`${entry.rank}`, colX.rank, ry + rowH / 2);

    // Player name (truncated)
    ctx.font = isMe ? f(7, 'bold') : f(7);
    ctx.fillStyle = isMe ? '#0f0' : G_BRIGHT;
    const maxNameW = colX.stars - colX.name - 4;
    let displayName = entry.username;
    while (ctx.measureText(displayName).width > maxNameW && displayName.length > 3) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName !== entry.username) displayName += '…';
    ctx.fillText(displayName, colX.name, ry + rowH / 2);

    // Stats columns
    ctx.font = f(7);
    ctx.fillStyle = G_MED;
    ctx.textAlign = 'left';
    ctx.fillText(`${entry.starCount}`, colX.stars, ry + rowH / 2);
    ctx.fillText(`${entry.totalShips}`, colX.ships, ry + rowH / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = rankColor;
    ctx.fillText(`${entry.power}`, colX.power, ry + rowH / 2);
  }

  // Seed button at bottom (admin only)
  if (_isAdmin) {
    const seedBtnW = 80;
    const seedBtnH = 14;
    const seedBtnX = x + (w - seedBtnW) / 2;
    const seedBtnY = y + bodyH - PANEL_PAD - seedBtnH;
    ctx.fillStyle = 'rgba(128, 0, 255, 0.15)';
    ctx.fillRect(seedBtnX, seedBtnY, seedBtnW, seedBtnH);
    ctx.strokeStyle = '#a060ff';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(seedBtnX, seedBtnY, seedBtnW, seedBtnH);
    ctx.font = f(7, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#c090ff';
    ctx.fillText('SEED TEST DATA', seedBtnX + seedBtnW / 2, seedBtnY + seedBtnH / 2);
    _leaderboardSeedButton = { x: seedBtnX, y: seedBtnY, w: seedBtnW, h: seedBtnH };
  }

  return bodyH;
}

// ── Alliance Panel Drawing ──────────────────────────────────────────────────

let _allianceButtons: { action: string; x: number; y: number; w: number; h: number }[] = [];
let _allianceChatPageButtons: { dir: 'prev' | 'next'; x: number; y: number; w: number; h: number }[] = [];

function drawAllianceBody(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  _allianceButtons = [];
  _allianceChatPageButtons = [];
  _comsBackButton = null;
  _comsSendButton = null;
  _comsContactButtons = [];
  _publicPageButtons = [];
  _publicPostButton = null;
  _publicReplyButtons = [];

  if (_allianceView === 'chat' && _allianceInfo) {
    return drawAllianceChatView(ctx, x, y, w);
  }
  if (_allianceView === 'invites') {
    return drawAllianceInvitesView(ctx, x, y, w);
  }
  if (_allianceView === 'invite' && _allianceInfo) {
    return drawAllianceInvitePlayerView(ctx, x, y, w);
  }
  if (_allianceInfo) {
    return drawAllianceHomeView(ctx, x, y, w);
  }
  return drawAllianceNoneView(ctx, x, y, w);
}

/** No alliance — show create + invites buttons */
function drawAllianceNoneView(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  let cy = y + 4;
  ctx.font = f(8);
  ctx.textAlign = 'center';
  ctx.fillStyle = G_DIM;
  ctx.fillText('No Alliance', x + w / 2, cy + 6);
  cy += 16;

  // CREATE button
  const btnW = w - 16;
  const btnH = 18;
  const bx = x + 8;
  ctx.fillStyle = 'rgba(0, 255, 128, 0.15)';
  ctx.fillRect(bx, cy, btnW, btnH);
  ctx.strokeStyle = G_BRIGHT;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(bx, cy, btnW, btnH);
  ctx.font = f(7, 'bold');
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText('CREATE ALLIANCE', x + w / 2, cy + btnH / 2 + 1);
  _allianceButtons.push({ action: 'create', x: bx, y: cy, w: btnW, h: btnH });
  cy += btnH + 6;

  // INVITES button (show count)
  if (_allianceInvites.length > 0) {
    ctx.fillStyle = 'rgba(255, 200, 0, 0.15)';
    ctx.fillRect(bx, cy, btnW, btnH);
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bx, cy, btnW, btnH);
    ctx.font = f(7, 'bold');
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`INVITES (${_allianceInvites.length})`, x + w / 2, cy + btnH / 2 + 1);
    _allianceButtons.push({ action: 'view_invites', x: bx, y: cy, w: btnW, h: btnH });
    cy += btnH + 6;
  }

  // TEST BOTS button (admin only)
  if (_isAdmin && SHOW_BOT_TEST_UI) {
    ctx.fillStyle = 'rgba(200, 100, 255, 0.15)';
    ctx.fillRect(bx, cy, btnW, btnH);
    ctx.strokeStyle = '#cc66ff';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bx, cy, btnW, btnH);
    ctx.font = f(7, 'bold');
    ctx.fillStyle = '#cc66ff';
    ctx.fillText(_pendingBotTest ? 'RUNNING...' : 'TEST BOTS', x + w / 2, cy + btnH / 2 + 1);
    _allianceButtons.push({ action: 'test_bots', x: bx, y: cy, w: btnW, h: btnH });
    cy += btnH + 4;

    // TEST ADMIN button
    ctx.fillStyle = 'rgba(100, 200, 255, 0.15)';
    ctx.fillRect(bx, cy, btnW, btnH);
    ctx.strokeStyle = '#66ccff';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bx, cy, btnW, btnH);
    ctx.font = f(7, 'bold');
    ctx.fillStyle = '#66ccff';
    ctx.fillText('TEST ADMIN', x + w / 2, cy + btnH / 2 + 1);
    _allianceButtons.push({ action: 'test_admin', x: bx, y: cy, w: btnW, h: btnH });
    cy += btnH + 4;

    // CHECK TEST button
    ctx.fillStyle = 'rgba(0, 255, 200, 0.15)';
    ctx.fillRect(bx, cy, btnW, btnH);
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bx, cy, btnW, btnH);
    ctx.font = f(7, 'bold');
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('CHECK TEST', x + w / 2, cy + btnH / 2 + 1);
    _allianceButtons.push({ action: 'test_check', x: bx, y: cy, w: btnW, h: btnH });
    cy += btnH + 4;

    // COPY LOG button (only when log exists)
    if (_botTestLog) {
      ctx.fillStyle = 'rgba(255, 200, 0, 0.15)';
      ctx.fillRect(bx, cy, btnW, btnH);
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bx, cy, btnW, btnH);
      ctx.font = f(7, 'bold');
      ctx.fillStyle = '#ffcc00';
      ctx.fillText('COPY BOT LOG', x + w / 2, cy + btnH / 2 + 1);
      _allianceButtons.push({ action: 'copy_bot_log', x: bx, y: cy, w: btnW, h: btnH });
      cy += btnH + 6;
    } else {
      cy += 2;
    }
  }

  return cy - y;
}

/** Alliance home — name, members, buttons */
function drawAllianceHomeView(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  const a = _allianceInfo!;
  let cy = y + 2;

  // Alliance name header
  ctx.font = f(8, 'bold');
  ctx.textAlign = 'center';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(a.name.toUpperCase(), x + w / 2, cy + 7);
  cy += 14;

  ctx.font = f(7);
  ctx.fillStyle = G_DIM;
  ctx.fillText(`${a.members.length}/10 members`, x + w / 2, cy + 5);
  cy += 12;

  // Member list
  ctx.textAlign = 'left';
  const memberH = 14;
  const maxShow = 5;
  const membersToShow = a.members.slice(0, maxShow);
  for (const member of membersToShow) {
    const isManager = member === a.manager;
    ctx.font = f(7);
    ctx.fillStyle = isManager ? '#ffcc00' : G_MED;
    const label = isManager ? `★ ${member} (MGR)` : `  ${member}`;
    ctx.fillText(label, x + 6, cy + 9);

    // Kick button (manager only, not self)
    if (_allianceInfo && _username && _username === a.manager && member !== a.manager) {
      const kickW = 20;
      const kickX = x + w - kickW - 6;
      ctx.fillStyle = 'rgba(255, 80, 80, 0.2)';
      ctx.fillRect(kickX, cy + 1, kickW, memberH - 2);
      ctx.strokeStyle = '#ff5050';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(kickX, cy + 1, kickW, memberH - 2);
      ctx.font = f(7, 'bold');
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff5050';
      ctx.fillText('KICK', kickX + kickW / 2, cy + 9);
      ctx.textAlign = 'left';
      _allianceButtons.push({ action: `kick:${member}`, x: kickX, y: cy + 1, w: kickW, h: memberH - 2 });
    }
    cy += memberH;
  }
  if (a.members.length > maxShow) {
    ctx.font = f(7);
    ctx.fillStyle = G_DIM;
    ctx.fillText(`  +${a.members.length - maxShow} more`, x + 6, cy + 6);
    cy += 10;
  }

  cy += 4;
  ctx.textAlign = 'center';

  // Action buttons
  const btnW = w - 16;
  const btnH = 16;
  const bx = x + 8;

  // CHAT button
  ctx.fillStyle = 'rgba(0, 255, 128, 0.15)';
  ctx.fillRect(bx, cy, btnW, btnH);
  ctx.strokeStyle = G_BRIGHT;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(bx, cy, btnW, btnH);
  ctx.font = f(7, 'bold');
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText('ALLIANCE CHAT', x + w / 2, cy + btnH / 2 + 1);
  _allianceButtons.push({ action: 'chat', x: bx, y: cy, w: btnW, h: btnH });
  cy += btnH + 4;

  // INVITE button (manager only)
  if (_username && _username === a.manager) {
    ctx.fillStyle = 'rgba(100, 200, 255, 0.15)';
    ctx.fillRect(bx, cy, btnW, btnH);
    ctx.strokeStyle = '#66ccff';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bx, cy, btnW, btnH);
    ctx.font = f(7, 'bold');
    ctx.fillStyle = '#66ccff';
    ctx.fillText('INVITE PLAYER', x + w / 2, cy + btnH / 2 + 1);
    _allianceButtons.push({ action: 'invite_view', x: bx, y: cy, w: btnW, h: btnH });
    cy += btnH + 4;
  }

  // LEAVE button
  ctx.fillStyle = 'rgba(255, 80, 80, 0.1)';
  ctx.fillRect(bx, cy, btnW, btnH);
  ctx.strokeStyle = '#ff5050';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(bx, cy, btnW, btnH);
  ctx.font = f(7, 'bold');
  ctx.fillStyle = '#ff5050';
  ctx.fillText('LEAVE ALLIANCE', x + w / 2, cy + btnH / 2 + 1);
  _allianceButtons.push({ action: 'leave', x: bx, y: cy, w: btnW, h: btnH });
  cy += btnH + 4;

  // Admin test buttons (visible while in alliance)
  if (_isAdmin && SHOW_BOT_TEST_UI) {
    ctx.fillStyle = 'rgba(0, 255, 200, 0.15)';
    ctx.fillRect(bx, cy, btnW, btnH);
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bx, cy, btnW, btnH);
    ctx.font = f(7, 'bold');
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('CHECK TEST', x + w / 2, cy + btnH / 2 + 1);
    _allianceButtons.push({ action: 'test_check', x: bx, y: cy, w: btnW, h: btnH });
    cy += btnH + 4;

    if (_botTestLog) {
      ctx.fillStyle = 'rgba(255, 200, 0, 0.15)';
      ctx.fillRect(bx, cy, btnW, btnH);
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bx, cy, btnW, btnH);
      ctx.font = f(7, 'bold');
      ctx.fillStyle = '#ffcc00';
      ctx.fillText('COPY BOT LOG', x + w / 2, cy + btnH / 2 + 1);
      _allianceButtons.push({ action: 'copy_bot_log', x: bx, y: cy, w: btnW, h: btnH });
      cy += btnH + 4;
    }
  }

  return cy - y;
}

/** Alliance chat view */
function drawAllianceChatView(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  let cy = y + 2;

  // BACK button
  const backW = 30;
  const backH = 12;
  ctx.fillStyle = 'rgba(0, 255, 128, 0.15)';
  ctx.fillRect(x + 4, cy, backW, backH);
  ctx.strokeStyle = G_BRIGHT;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 4, cy, backW, backH);
  ctx.font = f(7, 'bold');
  ctx.textAlign = 'center';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText('BACK', x + 4 + backW / 2, cy + backH / 2 + 1);
  _comsBackButton = { x: x + 4, y: cy, w: backW, h: backH };

  // Header
  ctx.font = f(7, 'bold');
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(_allianceInfo!.name.toUpperCase(), x + w / 2, cy + 7);
  cy += backH + 4;

  // Messages
  const msgs = _allianceChat;
  if (msgs.length === 0) {
    ctx.font = f(7);
    ctx.textAlign = 'center';
    ctx.fillStyle = G_DIM;
    ctx.fillText('No messages yet', x + w / 2, cy + 8);
    cy += 16;
  } else {
    const totalPages = Math.max(1, Math.ceil(msgs.length / ALLIANCE_CHAT_PAGE_SIZE));
    if (_allianceChatPage >= totalPages) _allianceChatPage = totalPages - 1;
    if (_allianceChatPage < 0) _allianceChatPage = 0;

    const startIdx = _allianceChatPage * ALLIANCE_CHAT_PAGE_SIZE;
    const pageItems = msgs.slice(startIdx, startIdx + ALLIANCE_CHAT_PAGE_SIZE);

    ctx.textAlign = 'left';
    for (const msg of pageItems) {
      const isSystem = msg.from === '__system__';
      if (isSystem) {
        ctx.font = f(7, 'italic');
        ctx.fillStyle = '#ffcc00';
        ctx.fillText(`  ${msg.text}`, x + 4, cy + 7);
        cy += 12;
      } else {
        ctx.font = f(7, 'bold');
        ctx.fillStyle = G_BRIGHT;
        ctx.fillText(msg.from, x + 4, cy + 7);
        cy += 9;
        ctx.font = f(7);
        ctx.fillStyle = G_MED;
        // Wrap long text
        const maxChars = Math.floor((w - 12) / 4);
        const body = msg.text.length > maxChars ? msg.text.slice(0, maxChars - 2) + '..' : msg.text;
        ctx.fillText(body, x + 8, cy + 6);
        cy += 10;
      }
    }

    // Pagination
    if (totalPages > 1) {
      ctx.textAlign = 'center';
      ctx.font = f(7);
      ctx.fillStyle = G_DIM;
      ctx.fillText(`${_allianceChatPage + 1}/${totalPages}`, x + w / 2, cy + 6);

      if (_allianceChatPage > 0) {
        const pbx = x + 4;
        ctx.fillStyle = 'rgba(0,255,128,0.15)';
        ctx.fillRect(pbx, cy, 24, 10);
        ctx.strokeStyle = G_BRIGHT;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(pbx, cy, 24, 10);
        ctx.font = f(7, 'bold');
        ctx.fillStyle = G_BRIGHT;
        ctx.fillText('PREV', pbx + 12, cy + 6);
        _allianceChatPageButtons.push({ dir: 'prev', x: pbx, y: cy, w: 24, h: 10 });
      }
      if (_allianceChatPage < totalPages - 1) {
        const nbx = x + w - 28;
        ctx.fillStyle = 'rgba(0,255,128,0.15)';
        ctx.fillRect(nbx, cy, 24, 10);
        ctx.strokeStyle = G_BRIGHT;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(nbx, cy, 24, 10);
        ctx.font = f(7, 'bold');
        ctx.fillStyle = G_BRIGHT;
        ctx.fillText('NEXT', nbx + 12, cy + 6);
        _allianceChatPageButtons.push({ dir: 'next', x: nbx, y: cy, w: 24, h: 10 });
      }
      cy += 14;
    }
  }

  // SEND button
  const btnW = w - 16;
  const btnH = 16;
  const bx = x + 8;
  ctx.fillStyle = 'rgba(0, 255, 128, 0.15)';
  ctx.fillRect(bx, cy, btnW, btnH);
  ctx.strokeStyle = G_BRIGHT;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(bx, cy, btnW, btnH);
  ctx.font = f(7, 'bold');
  ctx.textAlign = 'center';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText('SEND MESSAGE', x + w / 2, cy + btnH / 2 + 1);
  _allianceButtons.push({ action: 'send_chat', x: bx, y: cy, w: btnW, h: btnH });
  cy += btnH + 4;

  return cy - y;
}

/** Invites list view */
function drawAllianceInvitesView(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  let cy = y + 2;

  // BACK button
  const backW = 30;
  const backH = 12;
  ctx.fillStyle = 'rgba(0, 255, 128, 0.15)';
  ctx.fillRect(x + 4, cy, backW, backH);
  ctx.strokeStyle = G_BRIGHT;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 4, cy, backW, backH);
  ctx.font = f(7, 'bold');
  ctx.textAlign = 'center';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText('BACK', x + 4 + backW / 2, cy + backH / 2 + 1);
  _comsBackButton = { x: x + 4, y: cy, w: backW, h: backH };

  ctx.font = f(7, 'bold');
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText('PENDING INVITES', x + w / 2, cy + 7);
  cy += backH + 4;

  if (_allianceInvites.length === 0) {
    ctx.font = f(7);
    ctx.fillStyle = G_DIM;
    ctx.fillText('No invites', x + w / 2, cy + 8);
    return cy - y + 16;
  }

  ctx.textAlign = 'left';
  for (const inv of _allianceInvites) {
    // Alliance name + invited by
    ctx.font = f(7, 'bold');
    ctx.fillStyle = G_MED;
    ctx.fillText(inv.allianceName, x + 6, cy + 8);
    ctx.font = f(7);
    ctx.fillStyle = G_DIM;
    ctx.fillText(`from ${inv.invitedBy}`, x + 6, cy + 17);

    // JOIN / REJECT buttons
    const btnH = 12;
    const joinW = 22;
    const rejectW = 28;
    const joinX = x + w - joinW - rejectW - 10;
    const rejectX = x + w - rejectW - 4;

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,255,128,0.15)';
    ctx.fillRect(joinX, cy + 2, joinW, btnH);
    ctx.strokeStyle = G_BRIGHT;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(joinX, cy + 2, joinW, btnH);
    ctx.font = f(7, 'bold');
    ctx.fillStyle = G_BRIGHT;
    ctx.fillText('JOIN', joinX + joinW / 2, cy + 2 + btnH / 2 + 1);
    _allianceButtons.push({ action: `join:${inv.allianceId}`, x: joinX, y: cy + 2, w: joinW, h: btnH });

    ctx.fillStyle = 'rgba(255,80,80,0.15)';
    ctx.fillRect(rejectX, cy + 2, rejectW, btnH);
    ctx.strokeStyle = '#ff5050';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(rejectX, cy + 2, rejectW, btnH);
    ctx.font = f(7, 'bold');
    ctx.fillStyle = '#ff5050';
    ctx.fillText('REJECT', rejectX + rejectW / 2, cy + 2 + btnH / 2 + 1);
    _allianceButtons.push({ action: `reject:${inv.allianceId}`, x: rejectX, y: cy + 2, w: rejectW, h: btnH });

    ctx.textAlign = 'left';
    cy += 24;
  }

  return cy - y;
}

/** Invite player picker view */
function drawAllianceInvitePlayerView(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  let cy = y + 2;

  // BACK button
  const backW = 30;
  const backH = 12;
  ctx.fillStyle = 'rgba(0, 255, 128, 0.15)';
  ctx.fillRect(x + 4, cy, backW, backH);
  ctx.strokeStyle = G_BRIGHT;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 4, cy, backW, backH);
  ctx.font = f(7, 'bold');
  ctx.textAlign = 'center';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText('BACK', x + 4 + backW / 2, cy + backH / 2 + 1);
  _comsBackButton = { x: x + 4, y: cy, w: backW, h: backH };

  ctx.font = f(7, 'bold');
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText('INVITE PLAYER', x + w / 2, cy + 7);
  cy += backH + 4;

  // Show known players not in alliance
  const members = new Set(_allianceInfo!.members.map(m => m.toLowerCase()));
  const candidates = _knownPlayerNames.filter(n => !members.has(n.toLowerCase()));

  if (candidates.length === 0) {
    ctx.font = f(7);
    ctx.fillStyle = G_DIM;
    ctx.fillText('No players to invite', x + w / 2, cy + 8);
    return cy - y + 16;
  }

  ctx.textAlign = 'left';
  const rowH = 16;
  for (const player of candidates.slice(0, 6)) {
    ctx.font = f(7);
    ctx.fillStyle = G_MED;
    ctx.fillText(player, x + 6, cy + 10);

    // INVITE button (or SENT indicator)
    const invW = 30;
    const invX = x + w - invW - 6;
    ctx.textAlign = 'center';
    if (_allianceInvitedPlayers.has(player)) {
      ctx.fillStyle = 'rgba(100,200,255,0.05)';
      ctx.fillRect(invX, cy + 1, invW, rowH - 2);
      ctx.font = f(7, 'bold');
      ctx.fillStyle = G_DIM;
      ctx.fillText('SENT', invX + invW / 2, cy + 9);
    } else {
      ctx.fillStyle = 'rgba(100,200,255,0.15)';
      ctx.fillRect(invX, cy + 1, invW, rowH - 2);
      ctx.strokeStyle = '#66ccff';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(invX, cy + 1, invW, rowH - 2);
      ctx.font = f(7, 'bold');
      ctx.fillStyle = '#66ccff';
      ctx.fillText('INVITE', invX + invW / 2, cy + 9);
      _allianceButtons.push({ action: `invite:${player}`, x: invX, y: cy + 1, w: invW, h: rowH - 2 });
    }
    ctx.textAlign = 'left';
    cy += rowH;
  }

  return cy - y;
}

function drawComsContacts(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  _comsContactButtons = [];
  _comsBackButton = null;
  _comsSendButton = null;
  _allianceButtons = [];
  _allianceChatPageButtons = [];

  const headerH = 28;
  const contactH = 22;
  const players = _knownPlayerNames;
  const contactCount = players.length;
  const bodyH = headerH + Math.max(contactCount, 1) * contactH + PANEL_PAD * 2;

  drawPanelFrame(ctx, x, y, w, bodyH, 'COMMS', '\u{1F4E1}');

  if (contactCount === 0) {
    ctx.font = f(7);
    ctx.fillStyle = G_DIM;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NO CONTACTS DISCOVERED', x + w / 2, y + headerH + 20);
    ctx.font = f(7);
    ctx.fillText('Use Enhanced Probes or visit', x + w / 2, y + headerH + 34);
    ctx.fillText('foreign stars to discover players', x + w / 2, y + headerH + 44);
    return bodyH;
  }

  // Draw contact list
  for (let i = 0; i < contactCount; i++) {
    const player = players[i]!;
    const cy = y + headerH + i * contactH;
    const hasUnread = _dmUnreadFrom.some(u => u.toLowerCase() === player.toLowerCase());

    // Contact row background on hover/unread
    if (hasUnread) {
      ctx.fillStyle = 'rgba(0, 255, 128, 0.08)';
      ctx.fillRect(x + 4, cy, w - 8, contactH - 2);
    }

    // Unread indicator
    if (hasUnread) {
      ctx.fillStyle = '#0f0';
      ctx.beginPath();
      ctx.arc(x + PANEL_PAD + 4, cy + contactH / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player name
    ctx.font = f(8, 'bold');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hasUnread ? G_BRIGHT : G_MED;
    ctx.fillText(player, x + PANEL_PAD + (hasUnread ? 12 : 2), cy + contactH / 2);

    // Message icon
    ctx.font = f(8);
    ctx.textAlign = 'right';
    ctx.fillStyle = G_DIM;
    ctx.fillText('\u{1F4AC}', x + w - PANEL_PAD, cy + contactH / 2);

    // Store hit area
    _comsContactButtons.push({
      name: player,
      x: x + 4, y: cy, w: w - 8, h: contactH - 2,
    });
  }

  return bodyH;
}

function drawDMConversation(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  _comsContactButtons = [];
  _allianceButtons = [];
  _allianceChatPageButtons = [];
  _videoPlayButtons = [];
  const headerH = 28;
  const maxMsgs = 5;
  const msgH = 24;
  const inputH = 20;
  const visibleCount = Math.min(_dmMessages.length, maxMsgs);
  const bodyH = headerH + Math.max(visibleCount, 2) * msgH + inputH + PANEL_PAD * 2;

  drawPanelFrame(ctx, x, y, w, bodyH, `DM: ${_dmPeer}`, '\u{1F4AC}');

  // Back button
  const backW = 30;
  const backH = 14;
  const backX = x + w - backW - PANEL_PAD;
  const backY = y + 6;
  ctx.fillStyle = 'rgba(0, 255, 128, 0.15)';
  ctx.fillRect(backX, backY, backW, backH);
  ctx.strokeStyle = G_DIM;
  ctx.strokeRect(backX, backY, backW, backH);
  ctx.font = f(7, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = G_MED;
  ctx.fillText('BACK', backX + backW / 2, backY + backH / 2);
  _comsBackButton = { x: backX, y: backY, w: backW, h: backH };

  if (_dmLoading) {
    ctx.font = f(7);
    ctx.fillStyle = G_DIM;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOADING...', x + w / 2, y + bodyH / 2);
    return bodyH;
  }

  if (_dmMessages.length === 0) {
    ctx.font = f(7);
    ctx.fillStyle = G_DIM;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No messages yet', x + w / 2, y + headerH + 20);
    ctx.font = f(7);
    ctx.fillText('Tap SEND to start a conversation', x + w / 2, y + headerH + 34);
  } else {
    // Show most recent messages
    const startIdx = Math.max(0, _dmMessages.length - maxMsgs);
    _dmReportButtons = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 4, y + headerH, w - 8, visibleCount * msgH);
    ctx.clip();
    for (let i = startIdx; i < _dmMessages.length; i++) {
      const msg = _dmMessages[i]!;
      const rowIdx = i - startIdx;
      const my = y + headerH + rowIdx * msgH;
      const isMe = msg.from.toLowerCase() !== _dmPeer!.toLowerCase();
      const isSystem = msg.body.startsWith('[ALLIANCE]');
      const isFleetCommand = msg.from === FLEET_COMMAND_SENDER;
      const videoMatch = msg.body.match(/^\[VIDEO:([^\]]+)\]\s*/);

      // Author + time
      ctx.font = f(7, 'bold');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isFleetCommand ? '#c090ff' : isSystem ? '#fc0' : isMe ? '#4af' : G_BRIGHT;
      const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const label = isFleetCommand ? '\u2605 FLEET CMD' : isSystem ? '\u2694\uFE0F ALLIANCE' : isMe ? 'YOU' : msg.from;
      ctx.fillText(`${label}  ${timeStr}`, x + PANEL_PAD, my + 2);

      // Report flag for peer messages (not your own, not system, not Fleet Command)
      if (!isMe && !isSystem && !isFleetCommand) {
        const flagW = 14;
        const flagH = 10;
        const flagX = x + w - PANEL_PAD - flagW;
        const flagY = my + 1;
        ctx.fillStyle = 'rgba(255, 80, 80, 0.15)';
        ctx.fillRect(flagX, flagY, flagW, flagH);
        ctx.font = f(7);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 80, 80, 0.6)';
        ctx.fillText('\u2691', flagX + flagW / 2, flagY + flagH / 2);
        _dmReportButtons.push({ x: flagX, y: flagY, w: flagW, h: flagH, msg });
      }

      // Message body
      if (videoMatch) {
        // Video message — show PLAY button
        const videoId = videoMatch[1]!;
        const btnW = 50;
        const btnH = 12;
        const btnX = x + PANEL_PAD;
        const btnY = my + 11;
        const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.003);
        ctx.fillStyle = `rgba(192, 144, 255, ${0.15 * pulse})`;
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.strokeStyle = `rgba(192, 144, 255, ${0.6 * pulse})`;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(btnX, btnY, btnW, btnH);
        ctx.font = f(7, 'bold');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(192, 144, 255, ${0.9 * pulse})`;
        ctx.fillText('\u25B6 PLAY', btnX + btnW / 2, btnY + btnH / 2);
        _videoPlayButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH, videoId });
        // Show text after video tag
        const textAfter = msg.body.slice(videoMatch[0].length);
        if (textAfter) {
          ctx.font = f(7);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(192, 144, 255, 0.6)';
          ctx.fillText(textAfter.slice(0, 30), btnX + btnW + 4, btnY + btnH / 2);
        }
      } else {
        ctx.font = f(7);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isFleetCommand ? 'rgba(192, 144, 255, 0.8)' : isSystem ? 'rgba(255, 204, 0, 0.8)' : isMe ? 'rgba(68, 170, 255, 0.7)' : G_MED;
        const maxChars = Math.floor((w - PANEL_PAD * 2) / 4.2);
        const displayBody = isSystem ? msg.body.slice(11) : msg.body;
        const bodyText = displayBody.length > maxChars ? displayBody.slice(0, maxChars - 1) + '\u2026' : displayBody;
        ctx.fillText(bodyText, x + PANEL_PAD, my + 12);
      }
    }
    ctx.restore();
  }

  // Send button at bottom (hide for Fleet Command — system sender, no replies)
  const isFleetCommandPeer = _dmPeer?.toLowerCase() === FLEET_COMMAND_SENDER.toLowerCase();
  const sendY = y + bodyH - inputH - PANEL_PAD;
  const sendW = w - PANEL_PAD * 2;
  const sendH = inputH;
  const sendX = x + PANEL_PAD;
  if (!isFleetCommandPeer) {
    ctx.fillStyle = 'rgba(0, 255, 128, 0.12)';
    ctx.fillRect(sendX, sendY, sendW, sendH);
    ctx.strokeStyle = G_MED;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(sendX, sendY, sendW, sendH);
    ctx.font = f(8, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = G_BRIGHT;
    ctx.fillText('\u{1F4E8} SEND MESSAGE', sendX + sendW / 2, sendY + sendH / 2);
    _comsSendButton = { x: sendX, y: sendY, w: sendW, h: sendH };
  }

  // Report confirmation flash
  const reportRemaining = _dmReportConfirmUntil - Date.now();
  if (reportRemaining > 0) {
    const alpha = Math.min(reportRemaining / 1000, 1.0);
    ctx.fillStyle = `rgba(0, 200, 100, ${0.15 * alpha})`;
    ctx.fillRect(x + 4, y + headerH, w - 8, 16);
    ctx.font = f(7, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(100, 255, 150, ${alpha})`;
    ctx.fillText('\u2713 REPORT SUBMITTED TO MODERATORS', x + w / 2, y + headerH + 8);
  }

  return bodyH;
}

// ── Public Contact List (landing page for PUBLIC tab) ───────────────────────

let _publicPageButtons: { dir: 'prev' | 'next'; x: number; y: number; w: number; h: number }[] = [];

function drawPublicContactList(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  _comsContactButtons = [];
  _comsBackButton = null;
  _comsSendButton = null;
  _allianceButtons = [];
  _allianceChatPageButtons = [];

  const headerH = 28;
  const contactH = 22;
  const players = _knownPlayerNames;
  // +1 for "ALL" row
  const totalRows = players.length + 1;
  const bodyH = headerH + Math.max(totalRows, 2) * contactH + PANEL_PAD * 2;

  drawPanelFrame(ctx, x, y, w, bodyH, 'PUBLIC THREAD', '\u{1F310}');

  // "ALL" row — view all public messages
  const allY = y + headerH;
  ctx.fillStyle = 'rgba(255, 136, 0, 0.06)';
  ctx.fillRect(x + 4, allY, w - 8, contactH - 2);
  ctx.font = f(8, 'bold');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f80';
  ctx.fillText('\u{1F310} ALL (Public Thread)', x + PANEL_PAD + 2, allY + contactH / 2);
  _comsContactButtons.push({ name: '__PUBLIC_ALL__', x: x + 4, y: allY, w: w - 8, h: contactH - 2 });

  if (players.length === 0) {
    ctx.font = f(7);
    ctx.fillStyle = G_DIM;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No other players discovered yet', x + w / 2, allY + contactH + 20);
    return bodyH;
  }

  // Draw player rows
  for (let i = 0; i < players.length; i++) {
    const player = players[i]!;
    const cy = y + headerH + (i + 1) * contactH;

    ctx.fillStyle = 'rgba(255, 136, 0, 0.03)';
    ctx.fillRect(x + 4, cy, w - 8, contactH - 2);

    ctx.font = f(8, 'bold');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = G_MED;
    ctx.fillText(player, x + PANEL_PAD + 2, cy + contactH / 2);

    // Icon
    ctx.font = f(8);
    ctx.textAlign = 'right';
    ctx.fillStyle = G_DIM;
    ctx.fillText('\u{1F4E2}', x + w - PANEL_PAD, cy + contactH / 2);

    _comsContactButtons.push({ name: `__PUBLIC_TO__${player}`, x: x + 4, y: cy, w: w - 8, h: contactH - 2 });
  }

  return bodyH;
}

// ── Public Player View (conversation-style for a specific player) ───────────

function drawPublicPlayerView(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  _comsContactButtons = [];
  _comsBackButton = null;
  _comsSendButton = null;
  _publicReplyButtons = [];
  _publicPostButton = null;
  _publicPageButtons = [];

  const player = _publicRecipient!;
  const headerH = 28;
  const msgH = 24;
  const sendBtnH = 20;
  // Filter messages involving this player (from them, or mentioning u/player)
  const relevant = _publicComments.filter(c =>
    c.author.toLowerCase() === player.toLowerCase() ||
    c.body.toLowerCase().includes(`u/${player.toLowerCase()}`)
  );
  const maxVisible = 5;
  const visibleCount = Math.min(relevant.length, maxVisible);
  const bodyH = headerH + Math.max(visibleCount, 3) * msgH + sendBtnH + PANEL_PAD * 2;

  drawPanelFrame(ctx, x, y, w, bodyH, `MSG: ${player}`, '\u{1F4E2}');

  // Back button
  const backW = 30;
  const backH = 14;
  const backX = x + w - backW - PANEL_PAD;
  const backY = y + 6;
  ctx.fillStyle = 'rgba(255, 136, 0, 0.15)';
  ctx.fillRect(backX, backY, backW, backH);
  ctx.strokeStyle = 'rgba(255, 136, 0, 0.4)';
  ctx.strokeRect(backX, backY, backW, backH);
  ctx.font = f(7, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f80';
  ctx.fillText('BACK', backX + backW / 2, backY + backH / 2);
  _comsBackButton = { x: backX, y: backY, w: backW, h: backH };

  const contentTop = y + headerH;

  if (_publicLoading) {
    ctx.font = f(7);
    ctx.fillStyle = G_DIM;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOADING...', x + w / 2, y + bodyH / 2);
    return bodyH;
  }

  if (relevant.length === 0) {
    ctx.font = f(7);
    ctx.fillStyle = G_DIM;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`No messages with ${player}`, x + w / 2, contentTop + 20);
    ctx.font = f(7);
    ctx.fillText('Send the first public message!', x + w / 2, contentTop + 34);
  } else {
    // Show most recent messages involving this player (newest at bottom)
    const shown = relevant.slice(-maxVisible);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 4, contentTop, w - 8, maxVisible * msgH);
    ctx.clip();
    for (let i = 0; i < shown.length; i++) {
      const comment = shown[i]!;
      const my = contentTop + i * msgH;

      // Author + time
      ctx.font = f(7, 'bold');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = comment.author.toLowerCase() === player.toLowerCase() ? '#f80' : '#4af';
      const timeStr = new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      ctx.fillText(`${comment.author}  ${timeStr}`, x + PANEL_PAD, my + 2);

      // Message body
      ctx.font = f(7);
      ctx.fillStyle = G_MED;
      const maxChars = Math.floor((w - PANEL_PAD * 2) / 4.2);
      const bodyText = comment.body.length > maxChars ? comment.body.slice(0, maxChars - 1) + '\u2026' : comment.body;
      ctx.fillText(bodyText, x + PANEL_PAD, my + 12);
    }
    ctx.restore();
  }

  // Send message button (prominent, like DM view)
  const sendY = y + bodyH - sendBtnH - PANEL_PAD;
  const sendW = w - PANEL_PAD * 2;
  const sendX = x + PANEL_PAD;
  ctx.fillStyle = 'rgba(255, 136, 0, 0.15)';
  ctx.fillRect(sendX, sendY, sendW, sendBtnH);
  ctx.strokeStyle = '#f80';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(sendX, sendY, sendW, sendBtnH);
  ctx.font = f(8, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f80';
  ctx.fillText(`\u{1F4E8} SEND MESSAGE TO ${player.toUpperCase()}`, sendX + sendW / 2, sendY + sendBtnH / 2);
  _publicPostButton = { x: sendX, y: sendY, w: sendW, h: sendBtnH };

  return bodyH;
}

// ── Public Comments Drawing (ALL view) ──────────────────────────────────────

function drawPublicComments(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
): number {
  _comsContactButtons = [];
  _comsBackButton = null;
  _comsSendButton = null;
  _publicPageButtons = [];
  _allianceButtons = [];
  _allianceChatPageButtons = [];

  const headerH = 28;
  const pageBarH = 14; // pagination bar
  const msgH = 28;
  const postBtnH = 20;
  const visibleCount = PUBLIC_PAGE_SIZE;
  const bodyH = headerH + visibleCount * msgH + pageBarH + postBtnH + PANEL_PAD * 2;

  const title = (_publicRecipient && _publicRecipient !== '__ALL__') ? `TO: ${_publicRecipient}` : 'PUBLIC THREAD';
  drawPanelFrame(ctx, x, y, w, bodyH, title, '\u{1F310}');

  // Back button (return to contact list)
  const backW = 30;
  const backH = 14;
  const backX = x + w - backW - PANEL_PAD;
  const backY = y + 6;
  ctx.fillStyle = 'rgba(255, 136, 0, 0.15)';
  ctx.fillRect(backX, backY, backW, backH);
  ctx.strokeStyle = 'rgba(255, 136, 0, 0.4)';
  ctx.strokeRect(backX, backY, backW, backH);
  ctx.font = f(7, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f80';
  ctx.fillText('BACK', backX + backW / 2, backY + backH / 2);
  _comsBackButton = { x: backX, y: backY, w: backW, h: backH };

  const contentTop = y + headerH;

  if (_publicLoading) {
    ctx.font = f(7);
    ctx.fillStyle = G_DIM;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOADING...', x + w / 2, y + bodyH / 2);
    return bodyH;
  }

  if (_publicComments.length === 0) {
    ctx.font = f(7);
    ctx.fillStyle = G_DIM;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No public messages yet', x + w / 2, contentTop + 40);
    ctx.font = f(7);
    ctx.fillText('Be the first to post!', x + w / 2, contentTop + 54);
  } else {
    // Show in chat order (oldest first, newest at bottom) — page 0 = most recent page
    const totalPages = Math.max(1, Math.ceil(_publicComments.length / PUBLIC_PAGE_SIZE));
    // Clamp page
    if (_publicPage >= totalPages) _publicPage = totalPages - 1;
    if (_publicPage < 0) _publicPage = 0;

    // Page 0 = last page of messages (most recent), page 1 = second-to-last, etc.
    const reversedPageIdx = totalPages - 1 - _publicPage;
    const startIdx = reversedPageIdx * PUBLIC_PAGE_SIZE;
    const pageItems = _publicComments.slice(startIdx, startIdx + PUBLIC_PAGE_SIZE);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 4, contentTop, w - 8, visibleCount * msgH);
    ctx.clip();
    for (let i = 0; i < pageItems.length; i++) {
      const comment = pageItems[i]!;
      const my = contentTop + i * msgH;

      // Author + time
      ctx.font = f(7, 'bold');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#f80';
      const timeStr = new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      ctx.fillText(`${comment.author}  ${timeStr}`, x + PANEL_PAD, my + 2);

      // Message body
      ctx.font = f(7);
      ctx.fillStyle = G_MED;
      const maxChars = Math.floor((w - PANEL_PAD * 2 - 20) / 4.2);
      const bodyText = comment.body.length > maxChars ? comment.body.slice(0, maxChars - 1) + '\u2026' : comment.body;
      ctx.fillText(bodyText, x + PANEL_PAD, my + 12);

      // Reply count indicator
      if (comment.replies.length > 0) {
        ctx.font = f(7);
        ctx.fillStyle = G_DIM;
        ctx.textAlign = 'right';
        ctx.fillText(`${comment.replies.length}\u{1F4AC}`, x + w - PANEL_PAD, my + 6);
      }

      // Reply button
      const replyW = 20;
      const replyH = 10;
      const replyX = x + w - PANEL_PAD - replyW;
      const replyY = my + 15;
      ctx.fillStyle = 'rgba(255, 136, 0, 0.1)';
      ctx.fillRect(replyX, replyY, replyW, replyH);
      ctx.strokeStyle = 'rgba(255, 136, 0, 0.3)';
      ctx.lineWidth = 0.3;
      ctx.strokeRect(replyX, replyY, replyW, replyH);
      ctx.font = f(6);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f80';
      ctx.fillText('REPLY', replyX + replyW / 2, replyY + replyH / 2);
      _publicReplyButtons.push({ comment, x: replyX, y: replyY, w: replyW, h: replyH });
    }
    ctx.restore();

    // Pagination bar
    if (totalPages > 1) {
      const pageY = contentTop + visibleCount * msgH + 2;
      const pageBtnW = 24;
      const pageBtnH = 12;

      // Prev button
      if (_publicPage > 0) {
        const prevX = x + PANEL_PAD;
        ctx.fillStyle = 'rgba(255, 136, 0, 0.1)';
        ctx.fillRect(prevX, pageY, pageBtnW, pageBtnH);
        ctx.strokeStyle = 'rgba(255, 136, 0, 0.4)';
        ctx.lineWidth = 0.3;
        ctx.strokeRect(prevX, pageY, pageBtnW, pageBtnH);
        ctx.font = f(7, 'bold');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f80';
        ctx.fillText('\u25C0 PREV', prevX + pageBtnW / 2, pageY + pageBtnH / 2);
        _publicPageButtons.push({ dir: 'prev', x: prevX, y: pageY, w: pageBtnW, h: pageBtnH });
      }

      // Page indicator
      ctx.font = f(7);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = G_DIM;
      ctx.fillText(`${_publicPage + 1}/${totalPages}`, x + w / 2, pageY + pageBtnH / 2);

      // Next button
      if (_publicPage < totalPages - 1) {
        const nextX = x + w - PANEL_PAD - pageBtnW;
        ctx.fillStyle = 'rgba(255, 136, 0, 0.1)';
        ctx.fillRect(nextX, pageY, pageBtnW, pageBtnH);
        ctx.strokeStyle = 'rgba(255, 136, 0, 0.4)';
        ctx.lineWidth = 0.3;
        ctx.strokeRect(nextX, pageY, pageBtnW, pageBtnH);
        ctx.font = f(7, 'bold');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f80';
        ctx.fillText('NEXT \u25B6', nextX + pageBtnW / 2, pageY + pageBtnH / 2);
        _publicPageButtons.push({ dir: 'next', x: nextX, y: pageY, w: pageBtnW, h: pageBtnH });
      }
    }
  }

  // New post button at bottom
  const postY = y + bodyH - postBtnH - PANEL_PAD;
  const postW = w - PANEL_PAD * 2;
  const postX = x + PANEL_PAD;
  ctx.fillStyle = 'rgba(255, 136, 0, 0.12)';
  ctx.fillRect(postX, postY, postW, postBtnH);
  ctx.strokeStyle = '#f80';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(postX, postY, postW, postBtnH);
  ctx.font = f(8, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f80';
  const postLabel = (_publicRecipient && _publicRecipient !== '__ALL__')
    ? `\u{270F}\u{FE0F} MSG ${_publicRecipient.toUpperCase()}`
    : '\u{270F}\u{FE0F} NEW POST';
  ctx.fillText(postLabel, postX + postW / 2, postY + postBtnH / 2);
  _publicPostButton = { x: postX, y: postY, w: postW, h: postBtnH };

  return bodyH;
}

/** Hit-test COMS panel clicks — contacts and DM buttons. */
export function hitTestComsPanel(sx: number, sy: number): boolean {
  // Tab buttons
  for (const tab of _comsTabButtons) {
    if (sx >= tab.x && sx <= tab.x + tab.w && sy >= tab.y && sy <= tab.y + tab.h) {
      _comsTab = tab.tab;
      const topicIdx = COMS_TOPIC_TABS.findIndex((t) => t.tab === tab.tab);
      if (topicIdx >= 0) comsTopicTabClicked(topicIdx);
      return true;
    }
  }
  // Back button
  if (_comsBackButton) {
    const b = _comsBackButton;
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
      if (_comsTab === 'alliance') {
        // Return to alliance home view
        _allianceView = _allianceInfo ? 'home' : 'none';
        _allianceChatPage = 0;
        _allianceInvitedPlayers.clear();
      } else if (_comsTab === 'public') {
        // Return to public contact list
        _publicRecipient = null;
        _publicPage = 0;
      } else {
        // Return to private contact list
        _dmPeer = null;
        _dmMessages = [];
      }
      _comsBackButton = null;
      _comsSendButton = null;
      return true;
    }
  }
  // Page buttons (public comments pagination)
  for (const btn of _publicPageButtons) {
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      if (btn.dir === 'prev') _publicPage--;
      else _publicPage++;
      return true;
    }
  }
  // Send button — show DM input overlay
  if (_comsSendButton && _dmPeer) {
    const b = _comsSendButton;
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
      _dmInputRequested = _dmPeer;
      return true;
    }
  }
  // Report buttons on DM messages
  for (const btn of _dmReportButtons) {
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      _dmReportPending = { messageId: btn.msg.id, from: btn.msg.from, body: btn.msg.body };
      return true;
    }
  }
  // Video play buttons
  for (const btn of _videoPlayButtons) {
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      _pendingVideoPlay = btn.videoId;
      playSound('click');
      return true;
    }
  }
  // Contact buttons
  for (const btn of _comsContactButtons) {
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      // Handle PUBLIC tab contact list buttons
      if (btn.name === '__PUBLIC_ALL__') {
        _publicRecipient = '__ALL__';
        _publicPage = 0;
        return true;
      }
      if (btn.name.startsWith('__PUBLIC_TO__')) {
        _publicRecipient = btn.name.slice('__PUBLIC_TO__'.length);
        _publicPage = 0;
        return true;
      }
      // PRIVATE tab contact — open DM
      _dmPeer = btn.name;
      _dmMessages = [];
      _dmLoading = true;
      return true;
    }
  }
  // Public post button
  if (_publicPostButton) {
    const b = _publicPostButton;
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
      const req: { parentId?: string; recipient?: string } = {};
      if (_publicRecipient && _publicRecipient !== '__ALL__') req.recipient = _publicRecipient;
      _publicInputRequested = req;
      return true;
    }
  }
  // Public reply buttons
  for (const btn of _publicReplyButtons) {
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      _publicInputRequested = { parentId: btn.comment.id };
      return true;
    }
  }
  // Alliance buttons
  for (const btn of _allianceButtons) {
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      const a = btn.action;
      if (a === 'create') {
        _allianceInputRequested = { type: 'create' };
      } else if (a === 'view_invites') {
        _allianceView = 'invites';
      } else if (a === 'chat') {
        _allianceView = 'chat';
        _allianceChatPage = 0;
      } else if (a === 'invite_view') {
        _allianceView = 'invite';
      } else if (a === 'leave') {
        _pendingAllianceAction = { type: 'leave' };
      } else if (a === 'send_chat') {
        _allianceInputRequested = { type: 'chat' };
      } else if (a.startsWith('kick:')) {
        _pendingAllianceAction = { type: 'kick', target: a.slice(5) };
      } else if (a.startsWith('join:')) {
        _pendingAllianceAction = { type: 'join', allianceId: a.slice(5) };
      } else if (a.startsWith('reject:')) {
        _pendingAllianceAction = { type: 'reject', allianceId: a.slice(7) };
      } else if (a.startsWith('invite:')) {
        const target = a.slice(7);
        _pendingAllianceAction = { type: 'invite', target };
        _allianceInvitedPlayers.add(target);
      } else if (a === 'test_bots') {
        _pendingBotTest = true;
      } else if (a === 'test_admin') {
        _pendingBotAdminTest = true;
      } else if (a === 'test_check') {
        _pendingBotCheck = true;
      } else if (a === 'copy_bot_log') {
        _pendingBotCopy = true;
      }
      return true;
    }
  }
  // Alliance chat pagination
  for (const btn of _allianceChatPageButtons) {
    if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
      if (btn.dir === 'prev') _allianceChatPage--;
      else _allianceChatPage++;
      return true;
    }
  }
  // Leaderboard seed button
  if (_leaderboardSeedButton) {
    const b = _leaderboardSeedButton;
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
      _pendingSeedBots = true;
      return true;
    }
  }
  return false;
}

// ── Dock Panel ──────────────────────────────────────────────────────────────

import type { DockState } from './types';
import type { DockAction } from './dock';
import type { ShipTypeId } from '../shared/api';
import { SHIP_CATALOG, UPGRADE_PATH, canBuildShip, canUpgradeShip } from '../shared/ships';

// ── Ship Icon Cache ─────────────────────────────────────────────────────────
const _shipIconCache = new Map<string, HTMLImageElement>();
let _shipIconsLoading = false;

function ensureShipIconsLoaded(): void {
  if (_shipIconsLoading) return;
  _shipIconsLoading = true;
  for (const entry of Object.values(SHIP_CATALOG)) {
    if (_shipIconCache.has(entry.icon)) continue;
    const img = new Image();
    img.src = `/icons/skins/wireframe/${entry.icon}`;
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

type DockExtensionAction = 'upgrade_station' | 'extend_habitat' | 'extend_ore' | 'extend_defense' | 'extend_warehouse' | 'extend_dock' | 'extend_shield' | 'extend_cannon' | 'extend_refinery';
export type DockPanelAction = DockAction | DockExtensionAction | 'buy_ships' | 'debug_complete' | 'toggle_shield' | 'refuel';

let _completeButton: { x: number; y: number; w: number; h: number } | null = null;

type ExtensionButton = {
  action: DockExtensionAction;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  enabled: boolean;
  lockReason?: string;
};

type MockExtensionState = {
  action: DockExtensionAction;
  label: string;
  key: 'mine' | 'solar' | 'hab' | 'station' | 'warehouse' | 'dock' | 'shield' | 'cannon' | 'refinery';
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
  { action: 'extend_shield', label: 'SHIELD', key: 'shield', cost: { ore: 400, food: 300, energy: 350 }, buildMs: 300_000 },
  { action: 'extend_cannon', label: 'CANNON', key: 'cannon', cost: { ore: 500, food: 250, energy: 450 }, buildMs: 300_000 },
  { action: 'extend_refinery', label: 'REFINERY', key: 'refinery', cost: { ore: 300, food: 100, energy: 200 }, buildMs: 300_000 },
];

let _lastExtensionButtons: ExtensionButton[] = [];
let _lockFlash: { action: string; expireMs: number } | null = null;
let _buildCooldown = false; // Set after successful build, cleared on next economy poll

/** Show a build/action error message in the panel area (visible for 4 seconds). */
export function showBuildError(message: string): void {
  _lockFlash = { action: message, expireMs: Date.now() + 4000 };
}

/** Mark that a build was just started — disables all buttons until next economy refresh. */
export function setBuildCooldown(): void {
  _buildCooldown = true;
}

type ServerEconomySnapshot = {
  starIndex: number;
  store: { ore: number; food: number; energy: number; fuel: number };
  rates: { ore: number; food: number; energy: number; fuel: number };
  cap: number;
  shieldRaised: boolean;
  defenseScore: { shield: number; cannon: number; total: number };
  buildings: {
    station: { level: number; status: string; completeAt: number | null; skinId?: string };
    mine: { level: number; status: string; completeAt: number | null; skinId?: string };
    solar: { level: number; status: string; completeAt: number | null; skinId?: string };
    hab: { level: number; status: string; completeAt: number | null; skinId?: string };
    warehouse: { level: number; status: string; completeAt: number | null; skinId?: string };
    dock: { level: number; status: string; completeAt: number | null; skinId?: string };
    shield: { level: number; status: string; completeAt: number | null; skinId?: string };
    cannon: { level: number; status: string; completeAt: number | null; skinId?: string };
    refinery: { level: number; status: string; completeAt: number | null; skinId?: string };
  };
  completeCharges?: number;
  richness?: { ore: number; food: number; energy: number; fuel: number };
  preferredSkinId?: string;
};

const _serverEconomyByStarIndex = new Map<number, ServerEconomySnapshot>();
let _lastEconomyStarIndex: number | null = null;
let _pendingBuildRequest: { buildType: 'station' | 'mine' | 'solar' | 'hab' | 'warehouse' | 'dock' | 'shield' | 'cannon' | 'refinery'; skinId?: string } | null = null;
let _pendingBuyShipRequest: { shipTypeId: number; quantity: number; useBlueprint?: boolean } | null = null;
let _pendingUpgradeShipRequest: { fromTypeId: number; useBlueprint?: boolean } | null = null;
let _pendingCompleteBuilds = false;
let _pendingColonizeRequest: { starIndex: number; bodyIndex: number } | null = null;
let _pendingToggleShield = false;
let _pendingExplore: { starIndex: number; bodyIndex: number } | null = null;

// ── Station Skin Picker State ───────────────────────────────────────────────
let _skinPickerVisible = false;
let _skinPickerLevel = 1;
let _skinPickerPendingBuild = false; // true = fire build after skin picked
let _skinPickerBuildType: 'station' | 'hab' | 'solar' | 'dock' | 'cannon' = 'station'; // which building triggered the picker
let _skinPickerBtns: Array<{ x: number; y: number; w: number; h: number; skinId: string }> = [];
let _skinPickerCancelBtn: { x: number; y: number; w: number; h: number } | null = null;

// ── Returning Player Report ─────────────────────────────────────────────────

import type { ReportItem } from '../shared/api';

let _reportItems: ReportItem[] = [];
let _reportVisible = false;
let _reportBadgeVisible = false;
let _reportBadgePulse = 0;
let _reportDismissBtn: { x: number; y: number; w: number; h: number } | null = null;

/** Set returning player report data (called once on login). */
export function setReturningReport(items: ReportItem[]): void {
  _reportItems = items;
  _reportBadgeVisible = items.length > 0;
  _reportVisible = false;
}

/** Draw the orange report badge on the left side of the screen. */
export function drawReportBadge(r: Renderer, elapsedTime: number): void {
  if (!_reportBadgeVisible || _reportVisible) return;
  const { ctx } = r;

  // Position: upper-left, below the info panel text
  const badgeW = 52;
  const badgeH = 22;
  const bx = 8;
  const by = 140;

  // Pulsing glow
  _reportBadgePulse = 0.5 + 0.5 * Math.sin(elapsedTime * 3);
  const alpha = 0.6 + 0.4 * _reportBadgePulse;

  ctx.save();
  ctx.globalAlpha = alpha;
  roundedRect(ctx, bx, by, badgeW, badgeH, 6);
  ctx.fillStyle = 'rgba(200, 120, 20, 0.85)';
  ctx.fill();
  roundedRect(ctx, bx, by, badgeW, badgeH, 6);
  ctx.strokeStyle = '#ffaa44';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Icon
  ctx.font = f(9, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('STATUS', bx + badgeW / 2, by + badgeH / 2);

  ctx.restore();
}

/** Hit test the report badge. Returns true if clicked. */
export function hitTestReportBadge(px: number, py: number): boolean {
  if (!_reportBadgeVisible) return false;
  const bx = 8, by = 140, bw = 52, bh = 22;
  return px >= bx && px <= bx + bw && py >= by && py <= by + bh;
}

/** Open the report panel. */
export function openReportPanel(): void {
  _reportVisible = true;
}

/** Close/dismiss the report panel and badge. */
export function dismissReport(): void {
  _reportVisible = false;
  _reportBadgeVisible = false;
  _reportItems = [];
}

/** Is the report panel currently open? */
export function isReportPanelOpen(): boolean {
  return _reportVisible;
}

/** Draw the full report panel overlay. */
export function drawReportPanel(r: Renderer): void {
  if (!_reportVisible || _reportItems.length === 0) return;
  const { ctx } = r;
  const dpr = window.devicePixelRatio || 1;
  const screenW = r.width / dpr;
  const screenH = r.height / dpr;

  // Semi-transparent backdrop
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, screenW, screenH);

  // Panel
  const panelW = Math.min(320, screenW - 40);
  const lineH = 18;
  const headerH = 36;
  const dismissH = 28;
  const panelH = Math.min(screenH - 60, headerH + _reportItems.length * lineH + 16 + dismissH);
  const px = (screenW - panelW) / 2;
  const py = (screenH - panelH) / 2;

  roundedRect(ctx, px, py, panelW, panelH, 8);
  ctx.fillStyle = 'rgba(20, 15, 5, 0.95)';
  ctx.fill();
  roundedRect(ctx, px, py, panelW, panelH, 8);
  ctx.strokeStyle = '#ffaa44';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Title
  ctx.font = f(13, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffaa44';
  ctx.fillText('RETURNING REPORT', px + panelW / 2, py + headerH / 2);

  // Separator
  ctx.beginPath();
  ctx.moveTo(px + 10, py + headerH);
  ctx.lineTo(px + panelW - 10, py + headerH);
  ctx.strokeStyle = 'rgba(255, 170, 68, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Report items
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < _reportItems.length; i++) {
    const item = _reportItems[i]!;
    const iy = py + headerH + 10 + i * lineH;
    if (iy + lineH > py + panelH - dismissH) break; // overflow guard

    // Category color
    const color = item.category === 'build' ? '#44ff88'
      : item.category === 'resources' ? '#88ccff'
      : item.category === 'visitor' ? '#ff8844'
      : '#cccccc';

    ctx.font = f(10);
    ctx.fillStyle = color;
    ctx.fillText(`${item.icon} ${item.text}`, px + 12, iy + lineH / 2);
  }

  // Dismiss button
  const dbW = 80;
  const dbH = 22;
  const dbX = px + (panelW - dbW) / 2;
  const dbY = py + panelH - dismissH - 2;
  _reportDismissBtn = { x: dbX, y: dbY, w: dbW, h: dbH };

  roundedRect(ctx, dbX, dbY, dbW, dbH, 4);
  ctx.fillStyle = 'rgba(200, 120, 20, 0.5)';
  ctx.fill();
  roundedRect(ctx, dbX, dbY, dbW, dbH, 4);
  ctx.strokeStyle = '#ffaa44';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = f(9, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffdd88';
  ctx.fillText('DISMISS', dbX + dbW / 2, dbY + dbH / 2);

  ctx.restore();
}

/** Hit test the report panel dismiss button. */
export function hitTestReportDismiss(px: number, py: number): boolean {
  if (!_reportDismissBtn) return false;
  const { x, y, w, h } = _reportDismissBtn;
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

// ── Skin Picker Overlay ─────────────────────────────────────────────────────

/** Draw a full-screen modal overlay letting the player choose a station visual style. */
export function drawSkinPicker(r: Renderer): void {
  if (!_skinPickerVisible) return;
  // Wireframe pref blocks picker — everything is wireframe
  if (getWireframePref()) {
    _skinPickerVisible = false;
    return;
  }
  const { ctx } = r;
  const dpr = window.devicePixelRatio || 1;
  const screenW = r.width / dpr;
  const screenH = r.height / dpr;

  ctx.save();
  // Dim background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, 0, screenW, screenH);

  // Panel dimensions — 2x2 grid
  const panelW = Math.min(360, screenW - 30);
  const panelH = 340;
  const px = (screenW - panelW) / 2;
  const py = (screenH - panelH) / 2;

  // Panel background
  roundedRect(ctx, px, py, panelW, panelH, 8);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.95)';
  ctx.fill();
  roundedRect(ctx, px, py, panelW, panelH, 8);
  ctx.strokeStyle = '#70b0ff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = f(17, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const pickerLabel = _skinPickerBuildType === 'station' ? 'STATION' :
                      _skinPickerBuildType === 'hab' ? 'HAB' :
                      _skinPickerBuildType === 'solar' ? 'SOLAR ARRAY' :
                      _skinPickerBuildType === 'dock' ? 'DOCK' : 'CANNON';
  ctx.fillText(`CHOOSE ${pickerLabel} STYLE`, px + panelW / 2, py + 28);

  // 2x2 grid layout
  const gap = 10;
  const colW = (panelW - gap * 3) / 2;
  const rowH = 120;
  const startY = py + 50;

  const skins = [
    { id: 'raster', label: 'STANDARD', locked: false },
    { id: 'scifi', label: 'SCI-FI', locked: false },
    { id: 'cartoon', label: '', locked: true },
  ];

  _skinPickerBtns = [];
  preloadRasterSprites();
  preloadScifiSprites();
  preloadShipSprites();

  for (let i = 0; i < skins.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cellX = px + gap + col * (colW + gap);
    const cellY = startY + row * (rowH + gap);
    const skin = skins[i]!;

    // Cell background
    const isLocked = skin.locked;
    roundedRect(ctx, cellX, cellY, colW, rowH, 6);
    ctx.fillStyle = isLocked ? 'rgba(30, 30, 30, 0.7)' : 'rgba(20, 30, 50, 0.8)';
    ctx.fill();
    roundedRect(ctx, cellX, cellY, colW, rowH, 6);
    ctx.strokeStyle = isLocked ? '#555' : '#4080c0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Preview image
    const previewSize = 56;
    const imgX = cellX + (colW - previewSize) / 2;
    const imgY = cellY + 8;

    if (skin.id === 'procedural') {
      // Draw wireframe station preview
      ctx.strokeStyle = '#4fffb0';
      ctx.lineWidth = 1.5;
      const cx = imgX + previewSize / 2;
      const cy = imgY + previewSize / 2;
      const r2 = previewSize * 0.35;
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2 - Math.PI / 2;
        const bx = cx + Math.cos(a) * r2;
        const by = cy + Math.sin(a) * r2;
        if (j === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
      }
      ctx.closePath();
      ctx.stroke();
      // inner circle
      ctx.beginPath();
      ctx.arc(cx, cy, r2 * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (skin.id === 'raster') {
      const img = getCartoonStationSprite(_skinPickerLevel);
      if (img) {
        ctx.drawImage(img, imgX, imgY, previewSize, previewSize);
      } else {
        ctx.fillStyle = '#333';
        ctx.fillRect(imgX, imgY, previewSize, previewSize);
      }
    } else if (skin.id === 'scifi') {
      const img = _skinPickerBuildType === 'solar' ? getScifiSolarArraySprite(_skinPickerLevel) :
                  _skinPickerBuildType === 'hab' ? getScifiHabSprite(_skinPickerLevel) :
                  _skinPickerBuildType === 'dock' ? getScifiDockSprite(_skinPickerLevel) :
                  _skinPickerBuildType === 'cannon' ? getScifiCannonSprite(_skinPickerLevel) :
                  getScifiStationSprite(_skinPickerLevel);
      if (img) {
        ctx.drawImage(img, imgX, imgY, previewSize, previewSize);
      } else {
        ctx.fillStyle = '#333';
        ctx.fillRect(imgX, imgY, previewSize, previewSize);
      }
    } else {
      // Locked/cartoon — grey placeholder
      ctx.fillStyle = '#222';
      ctx.fillRect(imgX, imgY, previewSize, previewSize);
      ctx.fillStyle = '#666';
      ctx.font = f(20);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u{1F512}', imgX + previewSize / 2, imgY + previewSize / 2);
    }

    // Button area
    const btnH = 28;
    const btnY = cellY + rowH - btnH - 8;
    const btnW = colW - 20;
    const btnX = cellX + 10;

    if (!isLocked) {
      roundedRect(ctx, btnX, btnY, btnW, btnH, 4);
      ctx.fillStyle = skin.id === 'scifi' ? 'rgba(60, 60, 160, 0.85)' :
                      skin.id === 'procedural' ? 'rgba(40, 120, 80, 0.85)' :
                      'rgba(60, 140, 60, 0.85)';
      ctx.fill();
      roundedRect(ctx, btnX, btnY, btnW, btnH, 4);
      ctx.strokeStyle = skin.id === 'scifi' ? '#80a0ff' :
                        skin.id === 'procedural' ? '#4fffb0' : '#80ff80';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = f(11, 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(skin.label, btnX + btnW / 2, btnY + btnH / 2);
      _skinPickerBtns.push({ x: btnX, y: btnY, w: btnW, h: btnH, skinId: skin.id });
    } else {
      ctx.fillStyle = '#555';
      ctx.font = f(10);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('COMING SOON', cellX + colW / 2, btnY + btnH / 2);
    }

    // Dim locked cells
    if (isLocked) {
      roundedRect(ctx, cellX, cellY, colW, rowH, 6);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fill();
    }
  }

  // Cancel button at bottom
  const cancelW = 80;
  const cancelH = 24;
  const cancelX = px + panelW / 2 - cancelW / 2;
  const cancelY = py + panelH - 40;
  roundedRect(ctx, cancelX, cancelY, cancelW, cancelH, 4);
  ctx.fillStyle = 'rgba(80, 40, 40, 0.8)';
  ctx.fill();
  roundedRect(ctx, cancelX, cancelY, cancelW, cancelH, 4);
  ctx.strokeStyle = '#ff6644';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#ffaa88';
  ctx.font = f(10, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CANCEL', cancelX + cancelW / 2, cancelY + cancelH / 2);
  _skinPickerCancelBtn = { x: cancelX, y: cancelY, w: cancelW, h: cancelH };

  drawCoachOverSkinPicker(ctx, screenW, screenH);

  ctx.restore();
}

/** Hit test the skin picker overlay. Returns true if the picker consumed the tap. */
export function hitTestSkinPicker(screenX: number, screenY: number): boolean {
  if (!_skinPickerVisible) return false;

  // Check cancel button first
  if (_skinPickerCancelBtn) {
    const cb = _skinPickerCancelBtn;
    if (screenX >= cb.x && screenX <= cb.x + cb.w &&
        screenY >= cb.y && screenY <= cb.y + cb.h) {
      _skinPickerVisible = false;
      _skinPickerBtns = [];
      _skinPickerPendingBuild = false;
      _skinPickerCancelBtn = null;
      playSound('click');
      return true;
    }
  }

  for (const btn of _skinPickerBtns) {
    if (screenX >= btn.x && screenX <= btn.x + btn.w &&
        screenY >= btn.y && screenY <= btn.y + btn.h) {
      // Apply the selected skin
      if (btn.skinId === 'procedural') {
        setActiveSkin(proceduralSkin);
        setSkinVariant('station', 'cartoon');
      } else if (btn.skinId === 'raster') {
        setActiveSkin(rasterSkin);
        setSkinVariant('station', 'cartoon');
      } else if (btn.skinId === 'scifi') {
        preloadScifiSprites();
        setActiveSkin(scifiSkin);
        setSkinVariant('station', 'scifi');
        setSkinVariant('solar_array', 'scifi');
        setSkinVariant('hab', 'scifi');
        setSkinVariant('dock', 'scifi');
        setSkinVariant('cannon', 'scifi');
      }
      _skinPickerVisible = false;
      _skinPickerBtns = [];
      coachAdvance('undock');
      // If picker was shown before a build, now fire the build
      if (_skinPickerPendingBuild) {
        _skinPickerPendingBuild = false;
        _pendingBuildRequest = { buildType: _skinPickerBuildType, skinId: btn.skinId };
      }
      return true;
    }
  }

  // Picker is visible but no button hit — still consume the tap (modal)
  return true;
}

/** Auto-confirm the first skin option (for automation/testing). */
export function confirmSkinPicker(): boolean {
  if (!_skinPickerVisible || _skinPickerBtns.length === 0) return false;
  const btn = _skinPickerBtns[0]!;
  _skinPickerVisible = false;
  _skinPickerBtns = [];
  if (_skinPickerPendingBuild) {
    _skinPickerPendingBuild = false;
    _pendingBuildRequest = { buildType: _skinPickerBuildType, skinId: btn.skinId };
  }
  return true;
}

let _pendingVideoPlay: string | null = null; // video ID to play (from Fleet Command DM)
let _videoPlayButtons: Array<{ x: number; y: number; w: number; h: number; videoId: string }> = [];
let _lastExploreResult: { kind: string; label: string; icon: string; amount: number; showUntil: number } | null = null;
let _colonizeButton: { x: number; y: number; w: number; h: number } | null = null;
let _shieldToggleButton: { x: number; y: number; w: number; h: number } | null = null;

// Shield charging state — visual delay between button press and server-confirmed state
const SHIELD_CHARGE_DURATION_MS = 3000; // 3 seconds to raise/lower
let _shieldCharging: { raising: boolean; startMs: number } | null = null;

export function getShieldCharging(): { raising: boolean; startMs: number } | null {
  return _shieldCharging;
}

export function clearShieldCharging(): void {
  _shieldCharging = null;
}

export function setServerStarEconomy(snapshot: ServerEconomySnapshot, isOwner?: boolean): void {
  // Debug: log building status on every economy update
  const bSummary = Object.entries(snapshot.buildings).map(([k, v]) => `${k}:L${v.level}/${v.status}`).join(' ');
  console.log(`[ECON] star=${snapshot.starIndex} isOwner=${isOwner} buildings=[${bSummary}]`);
  // Detect building completions: was UPGRADING, now ACTIVE → play sound (only for owner)
  const prev = _serverEconomyByStarIndex.get(snapshot.starIndex);
  if (isOwner && prev?.buildings && snapshot.buildings) {
    for (const key of Object.keys(snapshot.buildings) as Array<keyof typeof snapshot.buildings>) {
      const oldB = prev.buildings[key];
      const newB = snapshot.buildings[key];
      if (oldB && newB && oldB.status === 'UPGRADING' && newB.status === 'ACTIVE') {
        playSound('construction_complete_building');
        break; // one sound per poll cycle
      }
    }

  }
  _serverEconomyByStarIndex.set(snapshot.starIndex, snapshot);
  if (_buildCooldown) console.log('[ECON] buildCooldown cleared');
  _buildCooldown = false; // Economy refreshed — re-enable build buttons
  // Update complete charges from server
  if (snapshot.completeCharges != null) {
    _completeCharges = snapshot.completeCharges;
  }
}

/** Deduct fuel from a star's local economy snapshot (optimistic client-side update). */
export function deductBaseFuel(starIndex: number, amount: number): void {
  const econ = _serverEconomyByStarIndex.get(starIndex);
  if (econ) {
    econ.store.fuel = Math.max(0, econ.store.fuel - amount);
  }
}

/** Get available fuel at a star's base. */
export function getBaseFuel(starIndex: number): number {
  return _serverEconomyByStarIndex.get(starIndex)?.store.fuel ?? 0;
}

type ServerShipSnapshot = {
  ships: Array<{ typeId: number; count: number }>;
  building: { typeId: number; completeAt: number } | null;
};
const _serverShipsByStarIndex = new Map<number, ServerShipSnapshot>();

type TransitRecord = {
  shipTypeId: number;
  count: number;
  fromStarIndex: number;
  toStarIndex: number;
  departedAt: number;
  arrivalAt: number;
};
let _serverTransits: TransitRecord[] = [];
let _postId: string = '';

export function getPostId(): string {
  return _postId;
}

export function setPostId(postId: string): void {
  _postId = postId;
}

// ── Trade Station State ──
import type { TradeStationInfoResponse } from '../shared/api';
let _tradeStationInfo: TradeStationInfoResponse | null = null;

export function setTradeStationInfo(info: TradeStationInfoResponse | null): void {
  _tradeStationInfo = info;
}

export function getTradeStationInfo(): TradeStationInfoResponse | null {
  return _tradeStationInfo;
}

// Trade buttons state
type TradeButtonDef = { x: number; y: number; w: number; h: number; giveType: 'ore' | 'food' | 'energy' | 'fuel'; receiveType: 'ore' | 'food' | 'energy' | 'fuel' };
let _tradeButtons: TradeButtonDef[] = [];
let _pendingTrade: { giveType: 'ore' | 'food' | 'energy' | 'fuel'; receiveType: 'ore' | 'food' | 'energy' | 'fuel' } | null = null;

export function consumePendingTrade(): { giveType: 'ore' | 'food' | 'energy' | 'fuel'; receiveType: 'ore' | 'food' | 'energy' | 'fuel' } | null {
  const t = _pendingTrade;
  _pendingTrade = null;
  return t;
}

type FreighterRouteRecord = {
  id: string;
  homeStarIndex: number;
  targetStarIndex: number;
  cargo: { ore: number; food: number; energy: number; fuel: number };
  departedAt: number;
  arrivalAt: number;
  leg: 'outbound' | 'return';
};
let _serverFreighterRoutes: FreighterRouteRecord[] = [];

type RaidRouteRecord = {
  id: string;
  homeStarIndex: number;
  targetStarIndex: number;
  cargo: { ore: number; food: number; energy: number; fuel: number };
  departedAt: number;
  arrivalAt: number;
  leg: 'outbound' | 'return';
  status: 'in-transit' | 'success' | 'destroyed';
  successChance: number;
};
let _serverRaidRoutes: RaidRouteRecord[] = [];

let _pendingCancelRoute: string | null = null;
let _fleetCancelRouteButtons: Array<{ x: number; y: number; w: number; h: number; routeId: string }> = [];

// Foreign (enemy) fleet data — ships at other players' stars
const _foreignShipsByStarIndex = new Map<number, { owner: string; ships: Array<{ typeId: number; count: number }>; skinId?: string }>();

export function setForeignFleet(
  stars: Record<string, { owner: string; ships: Array<{ typeId: number; count: number }>; skinId?: string }>,
): void {
  _foreignShipsByStarIndex.clear();
  for (const [key, val] of Object.entries(stars)) {
    const idx = parseInt(key.replace('s:', ''), 10);
    if (!Number.isNaN(idx)) {
      _foreignShipsByStarIndex.set(idx, val);
    }
  }
}

export function setServerShipState(
  starIndex: number,
  ships: Array<{ typeId: number; count: number }>,
  building: { typeId: number; completeAt: number } | null,
  isOwner?: boolean,
): void {
  // Detect ship build completion: was building, now not (or past completeAt)
  const prev = _serverShipsByStarIndex.get(starIndex);
  if (isOwner && prev?.building && !building) {
    playSound('construction_complete');
  }
  _serverShipsByStarIndex.set(starIndex, { ships, building });
}

/** Bulk-set fleet data from /fleet/all response (replaces all entries). */
export function setServerFleetAll(
  stars: Record<string, { ships: Array<{ typeId: number; count: number }>; building: { typeId: number; completeAt: number } | null }>,
  transits?: TransitRecord[],
  freighterRoutes?: FreighterRouteRecord[],
  raidRoutes?: RaidRouteRecord[],
): void {
  // Detect freighter route leg completions for sound effects (disabled — voice too repetitive)
  // if (freighterRoutes && _serverFreighterRoutes.length > 0) {
  //   for (const newRoute of freighterRoutes) {
  //     const oldRoute = _serverFreighterRoutes.find(r => r.id === newRoute.id);
  //     if (oldRoute && oldRoute.leg !== newRoute.leg) {
  //       if (newRoute.leg === 'outbound') {
  //         playSound('freighter_unloading');
  //       } else {
  //         playSound('freighter_arrived');
  //       }
  //     }
  //   }
  // }

  _serverShipsByStarIndex.clear();
  for (const [key, val] of Object.entries(stars)) {
    // keys are "s:N" format
    const idx = parseInt(key.replace('s:', ''), 10);
    if (!Number.isNaN(idx)) {
      _serverShipsByStarIndex.set(idx, val);
    }
  }
  _serverTransits = transits ?? [];
  _serverFreighterRoutes = freighterRoutes ?? [];
  _serverRaidRoutes = raidRoutes ?? [];
}

/** Consume a pending freighter route cancel request. */
export function consumePendingCancelRoute(): string | null {
  const id = _pendingCancelRoute;
  _pendingCancelRoute = null;
  return id;
}

export function consumePendingBuildRequest(): { buildType: 'station' | 'mine' | 'solar' | 'hab' | 'warehouse' | 'dock' | 'shield' | 'cannon' | 'refinery'; skinId?: string } | null {
  const next = _pendingBuildRequest;
  _pendingBuildRequest = null;
  return next;
}

export function consumePendingBuyShipRequest(): { shipTypeId: number; quantity: number; useBlueprint?: boolean } | null {
  const next = _pendingBuyShipRequest;
  _pendingBuyShipRequest = null;
  return next;
}

export function consumePendingUpgradeShipRequest(): { fromTypeId: number; useBlueprint?: boolean } | null {
  const next = _pendingUpgradeShipRequest;
  _pendingUpgradeShipRequest = null;
  return next;
}

export function consumePendingCompleteBuilds(): boolean {
  const next = _pendingCompleteBuilds;
  _pendingCompleteBuilds = false;
  return next;
}

export function consumePendingColonizeRequest(): { starIndex: number; bodyIndex: number } | null {
  const next = _pendingColonizeRequest;
  _pendingColonizeRequest = null;
  return next;
}

export function consumePendingToggleShield(): boolean {
  // Only fire the server call once the charge animation completes
  if (!_pendingToggleShield || !_shieldCharging) return false;
  const elapsed = Date.now() - _shieldCharging.startMs;
  if (elapsed < SHIELD_CHARGE_DURATION_MS) return false;
  // Charge complete — consume the pending flag
  _pendingToggleShield = false;
  return true;
}

export function consumePendingExplore(): { starIndex: number; bodyIndex: number } | null {
  const next = _pendingExplore;
  _pendingExplore = null;
  return next;
}

export function consumePendingVideoPlay(): string | null {
  const next = _pendingVideoPlay;
  _pendingVideoPlay = null;
  return next;
}

export function showExploreResult(kind: string, label: string, icon: string, amount: number): void {
  _lastExploreResult = { kind, label, icon, amount, showUntil: performance.now() + 4000 };
}

export function triggerExplore(starIndex: number, bodyIndex: number): void {
  _pendingExplore = { starIndex, bodyIndex };
}

function mapDockActionToBuildType(action: DockExtensionAction): 'station' | 'mine' | 'solar' | 'hab' | 'warehouse' | 'dock' | 'shield' | 'cannon' | 'refinery' {
  if (action === 'upgrade_station') return 'station';
  if (action === 'extend_ore') return 'mine';
  if (action === 'extend_defense') return 'solar';
  if (action === 'extend_warehouse') return 'warehouse';
  if (action === 'extend_dock') return 'dock';
  if (action === 'extend_shield') return 'shield';
  if (action === 'extend_cannon') return 'cannon';
  if (action === 'extend_refinery') return 'refinery';
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
  // Allow building when docked at the planet (orbit) or at a station feature
  return dock.targetType === 'planet' || (dock.targetType === 'feature' && dock.targetLabel === 'Station');
}

export function triggerDockPanelAction(action: DockPanelAction, dock?: DockState): boolean {
  if (action === 'upgrade_station' || action === 'extend_habitat' || action === 'extend_ore' || action === 'extend_defense' || action === 'extend_warehouse' || action === 'extend_dock' || action === 'extend_shield' || action === 'extend_cannon' || action === 'extend_refinery') {
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
    // Show skin picker for any build type that has skin variants
    const skinnableTypes = ['station', 'hab', 'solar', 'dock', 'cannon'];
    if (skinnableTypes.includes(buildType)) {
      _skinPickerLevel = nextLevel;
      _skinPickerVisible = true;
      _skinPickerPendingBuild = true;
      _skinPickerBuildType = buildType as 'station' | 'hab' | 'solar' | 'dock' | 'cannon';
      playSound('click');
      return true;
    }
    // Non-skinnable builds (mine, warehouse, refinery, shield) — fire immediately
    _pendingBuildRequest = { buildType };
    playSound('click');
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

/** Trigger a BUILD panel button by 1-based index (1=Station, 2=Hab, ..., 9=Refinery). */
export function triggerBuildButtonByIndex(index: number, dock?: DockState): boolean {
  if (_openPanel !== 1) return false; // BUILD panel must be open
  const btn = _lastExtensionButtons[index - 1];
  if (!btn || !btn.enabled) return false;
  return triggerDockPanelAction(btn.action as DockPanelAction, dock);
}

/** Trigger a SHIPS panel button by 1-based index. */
export function triggerShipButtonByIndex(index: number): boolean {
  if (_openPanel !== 2) return false; // SHIPS panel must be open
  const btn = _lastShipButtons[index - 1];
  if (!btn || !btn.enabled) return false;
  if (btn.isUpgrade && btn.upgradeFromTypeId != null) {
    _pendingUpgradeShipRequest = { fromTypeId: btn.upgradeFromTypeId, ...(btn.useBlueprint != null ? { useBlueprint: btn.useBlueprint } : {}) };
  } else {
    _pendingBuyShipRequest = { shipTypeId: btn.shipTypeId, quantity: 1, ...(btn.useBlueprint != null ? { useBlueprint: btn.useBlueprint } : {}) };
  }
  playSound('click');
  return true;
}

/** Get a test-friendly snapshot of current game economy and state. */
export function getTestState(): {
  openPanel: number;
  starIndex: number | null;
  skinPickerVisible: boolean;
  buildings: Record<string, { level: number; status: string; completeAt: number | null; skinId?: string; progress?: number }> | null;
  store: { ore: number; food: number; energy: number; fuel: number } | null;
  rates: { ore: number; food: number; energy: number; fuel: number } | null;
  buildButtons: Array<{ label: string; enabled: boolean; action: string }>;
  shipButtons: Array<{ shipTypeId: number; enabled: boolean; isUpgrade: boolean }>;
  shipBuilding: { typeId: number; completeAt: number; progress: number } | null;
  ships: Array<{ typeId: number; count: number }> | null;
  activeSkinId: string;
  coach: { active: boolean; step: string };
} {
  const econ = _lastEconomyStarIndex != null ? _serverEconomyByStarIndex.get(_lastEconomyStarIndex) : null;
  const fleet = _lastEconomyStarIndex != null ? _serverShipsByStarIndex.get(_lastEconomyStarIndex) : null;
  const nowMs = Date.now();
  return {
    openPanel: _openPanel,
    starIndex: _lastEconomyStarIndex,
    skinPickerVisible: _skinPickerVisible,
    buildings: econ ? Object.fromEntries(
      Object.entries(econ.buildings).map(([k, v]) => {
        // Actual build duration matches server: 120s + (targetLevel - 1) × 60s
        const targetLvl = v.level + 1;
        const buildDurMs = (120 + (targetLvl - 1) * 60) * 1000;
        const progress = v.status === 'UPGRADING' && v.completeAt != null
          ? Math.max(0, Math.min(100, Math.floor(((buildDurMs - Math.max(0, v.completeAt - nowMs)) / buildDurMs) * 100)))
          : undefined;
        const entry: { level: number; status: string; completeAt: number | null; skinId?: string; progress?: number } = {
          level: v.level, status: v.status, completeAt: v.completeAt,
        };
        if (v.skinId != null) entry.skinId = v.skinId;
        if (progress != null) entry.progress = progress;
        return [k, entry];
      })
    ) : null,
    store: econ?.store ?? null,
    rates: econ?.rates ?? null,
    buildButtons: _lastExtensionButtons.map(b => ({ label: b.label, enabled: b.enabled, action: b.action })),
    shipButtons: _lastShipButtons.map(b => ({ shipTypeId: b.shipTypeId, enabled: b.enabled, isUpgrade: !!b.isUpgrade })),
    shipBuilding: fleet?.building ? {
      typeId: fleet.building.typeId,
      completeAt: fleet.building.completeAt,
      progress: Math.max(0, Math.min(100, Math.floor(((fleet.building.completeAt - nowMs) / 1000)))),
    } : null,
    ships: fleet?.ships ?? null,
    activeSkinId: getActiveSkinId(),
    coach: { active: isCoachActive(), step: getCoachStep() },
  };
}

const DOCK_ACTIONS: { action: DockAction; label: string; icon: string }[] = [
  { action: 'scan',    label: 'SCAN',    icon: '\u25CE' },     // ◎
  { action: 'leave',   label: 'UNDOCK',  icon: '\u2191' },     // ↑
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
  ctx.font = f(9, 'bold');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = G_BRIGHT;
  ctx.fillText(`\u25CF ORBIT: ${dock.targetName.toUpperCase()}`, barX + 10, barY + barH / 2);

  // NO INTERCHANGE indicator at opponent stations (no resource transfer available)
  const isForeignStation = _panelsForeign && dock.targetType === 'feature' && dock.targetLabel === 'Station';
  if (isForeignStation && dock.docked) {
    const adText = '\u26D4 NO INTERCHANGE';
    const adW = 130;
    const adH = 20;
    const adX = (screenW - adW) / 2;
    const adY = barY - adH - 8;

    ctx.fillStyle = 'rgba(60, 10, 10, 0.9)';
    roundedRect(ctx, adX, adY, adW, adH, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 80, 60, 0.8)';
    ctx.lineWidth = 1;
    roundedRect(ctx, adX, adY, adW, adH, 3);
    ctx.stroke();

    ctx.font = f(9, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgb(255, 100, 80)';
    ctx.fillText(adText, adX + adW / 2, adY + adH / 2);
  }

  // Action buttons on right side of bar
  const btnW = 48;
  const btnH = 22;
  const btnGap = 6;
  const btnY = barY + (barH - btnH) / 2;

  // Determine if shield button should show
  const shieldLevel = (starIndex != null && dock.docked && _panelsOwned)
    ? (_serverEconomyByStarIndex.get(starIndex)?.buildings.shield?.level ?? 0)
    : 0;
  const shieldRaised = starIndex != null
    ? (_serverEconomyByStarIndex.get(starIndex)?.shieldRaised ?? false)
    : false;
  const showShieldBtn = shieldLevel >= 1;
  const isCharging = _shieldCharging != null;

  // Build action list: [SHIELDS?] + SCAN + UNDOCK
  interface OrbitBtn { action: string; label: string; icon: string; color?: string }
  const orbitBtns: OrbitBtn[] = [];
  if (showShieldBtn) {
    const shLabel = isCharging
      ? (_shieldCharging!.raising ? 'CHARGING' : 'LOWERING')
      : (shieldRaised ? 'SHIELDS' : 'SHIELDS');
    orbitBtns.push({ action: 'toggle_shield', label: shLabel, icon: '\u26E8', color: isCharging ? '#ffdc64' : shieldRaised ? '#64c8ff' : '#ff6666' });
  }
  for (const act of DOCK_ACTIONS) {
    // Space Dock offers a refuel instead of a surface scan
    if (act.action === 'scan' && dock.featureType === 'dock') {
      orbitBtns.push({ action: 'refuel', label: 'REFUEL', icon: '\u26FD', color: '#ffdc64' });
      continue;
    }
    orbitBtns.push(act);
  }

  const shieldBtnW = 58; // slightly wider for SHIELDS label

  _lastDockButtons = [];
  _shieldToggleButton = null;
  for (const [i, act] of orbitBtns.entries()) {
    const isShield = act.action === 'toggle_shield';
    const thisW = isShield ? shieldBtnW : btnW;
    // Calculate x from right edge
    let rightOffset = 0;
    for (let j = i + 1; j < orbitBtns.length; j++) {
      rightOffset += (orbitBtns[j]!.action === 'toggle_shield' ? shieldBtnW : btnW) + btnGap;
    }
    rightOffset += thisW;
    const bx = barX + barW - rightOffset;
    const by = btnY;

    if (isShield) {
      // Store shield button rect for hit testing
      if (!isCharging) {
        _shieldToggleButton = { x: bx, y: by, w: thisW, h: btnH };
      }
      // Draw with colored outline
      const color = act.color!;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      roundedRect(ctx, bx, by, thisW, btnH, 3);
      ctx.stroke();

      // Charging progress fill
      if (isCharging) {
        const progress = Math.min(1, (Date.now() - _shieldCharging!.startMs) / SHIELD_CHARGE_DURATION_MS);
        ctx.fillStyle = `rgba(255, 220, 100, 0.2)`;
        roundedRect(ctx, bx, by, thisW * progress, btnH, 3);
        ctx.fill();
      }

      ctx.font = f(10);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(act.icon, bx + 12, by + btnH / 2);

      ctx.font = f(7);
      ctx.fillText(act.label, bx + 36, by + btnH / 2);
    } else {
      _lastDockButtons.push({ action: act.action as DockAction, label: act.label, icon: act.icon, x: bx, y: by, w: thisW, h: btnH });

      const enabled = dock.docked || act.action === 'leave';
      // Journey pulse on UNDOCK button so player knows how to leave
      const undockPulse = (act.action === 'leave' && dock.docked) ? getJourneyPulseAlpha() : 0;
      const hasUndockPulse = undockPulse > 0;

      ctx.strokeStyle = hasUndockPulse ? `rgba(79, 255, 176, ${0.4 + undockPulse * 0.6})` : enabled ? G_BRIGHT : G_FAINT;
      ctx.lineWidth = hasUndockPulse ? 2.5 : 1;
      roundedRect(ctx, bx, by, thisW, btnH, 3);
      ctx.stroke();

      ctx.font = f(10);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = hasUndockPulse ? `rgba(79, 255, 176, ${0.6 + undockPulse * 0.4})` : enabled ? G_BRIGHT : G_FAINT;
      ctx.fillText(act.icon, bx + 12, by + btnH / 2);

      ctx.font = f(7);
      ctx.fillText(act.label, bx + 32, by + btnH / 2);
    }
  }

  // ── Exploration result popup (above orbit bar, fades out) ──
  if (_lastExploreResult && performance.now() < _lastExploreResult.showUntil) {
    const remaining = _lastExploreResult.showUntil - performance.now();
    const alpha = Math.min(1, remaining / 1000); // fade out over last 1s
    const popW = 200;
    const popH = 24;
    const popX = (screenW - popW) / 2;
    const popY = barY - popH - 50;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = _lastExploreResult.kind === 'nothing' ? 'rgba(80, 80, 80, 0.9)' : 'rgba(0, 60, 30, 0.9)';
    roundedRect(ctx, popX, popY, popW, popH, 4);
    ctx.fill();
    ctx.strokeStyle = _lastExploreResult.kind === 'nothing' ? 'rgba(150, 150, 150, 0.8)' : G_BRIGHT;
    ctx.lineWidth = 1;
    roundedRect(ctx, popX, popY, popW, popH, 4);
    ctx.stroke();

    ctx.font = f(9);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = _lastExploreResult.kind === 'nothing' ? '#aaa' : G_BRIGHT;
    const text = _lastExploreResult.amount > 0 && _lastExploreResult.kind !== 'artifact' && _lastExploreResult.kind !== 'blueprint' && _lastExploreResult.kind !== 'anomaly'
      ? `${_lastExploreResult.label} (+${_lastExploreResult.amount})`
      : _lastExploreResult.label;
    ctx.fillText(text, popX + popW / 2, popY + popH / 2);
    ctx.globalAlpha = 1;
  }

  // ── COLONIZE button (above orbit bar) ──
  // Show when: docked (planet or station) + star not player-owned + Colony Ship present + NOT a trading station
  _colonizeButton = null;
  const canColonizeTarget = dock.targetLabel === 'Station' || dock.targetLabel === 'Planet';
  const isTradeStation = _postId && starIndex != null && isTradingStation(_postId, starIndex);
  if (dock.docked && canColonizeTarget && starIndex != null && !isTradeStation) {
    const starShips = _serverShipsByStarIndex.get(starIndex);
    const hasColonyShip = starShips?.ships.some(s => s.typeId === 8 && s.count > 0) ?? false;
    if (!_panelsOwned && hasColonyShip) {
      const colBtnW = 140;
      const colBtnH = 28;
      const colBtnX = (screenW - colBtnW) / 2;
      const colBtnY = barY - colBtnH - 12;

      // Pulsing glow effect
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.004);
      ctx.strokeStyle = `rgba(79, 255, 176, ${pulse})`;
      ctx.lineWidth = 2;
      roundedRect(ctx, colBtnX, colBtnY, colBtnW, colBtnH, 5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0, 40, 20, 0.9)';
      roundedRect(ctx, colBtnX, colBtnY, colBtnW, colBtnH, 5);
      ctx.fill();

      ctx.font = f(11, 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(79, 255, 176, ${0.8 + 0.2 * pulse})`;
      ctx.fillText('\u2605 COLONIZE', colBtnX + colBtnW / 2, colBtnY + colBtnH / 2);

      _colonizeButton = { x: colBtnX, y: colBtnY, w: colBtnW, h: colBtnH };
    }
  }

  drawCoachOverDockPanel(ctx, screenW, screenH);

  ctx.restore();
}

/** Hit-test dock panel buttons (orbit bar). Returns the action if clicked, null otherwise. */
export function hitTestDockPanel(screenPos: Vec2): DockPanelAction | null {
  // Check SHIELD TOGGLE button
  if (_shieldToggleButton) {
    const b = _shieldToggleButton;
    if (screenPos.x >= b.x && screenPos.x <= b.x + b.w &&
        screenPos.y >= b.y && screenPos.y <= b.y + b.h) {
      _pendingToggleShield = true;
      // Determine if raising or lowering based on current state
      const starIndex = _panelsStarIndex;
      const serverEcon = starIndex != null ? _serverEconomyByStarIndex.get(starIndex) : null;
      const currentlyRaised = serverEcon?.shieldRaised ?? false;
      const raising = !currentlyRaised;
      _shieldCharging = { raising, startMs: Date.now() };
      playSound(raising ? 'shields_activated' : 'shields_deactivated');
      return null; // consumed internally
    }
  }
  // Check COLONIZE button first (above orbit bar)
  if (_colonizeButton) {
    const b = _colonizeButton;
    if (screenPos.x >= b.x && screenPos.x <= b.x + b.w &&
        screenPos.y >= b.y && screenPos.y <= b.y + b.h) {
      if (_panelsStarIndex != null) {
        _pendingColonizeRequest = { starIndex: _panelsStarIndex, bodyIndex: _panelsBodyIndex };
        playSound('click');
      }
      return null; // consumed internally
    }
  }
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
  disableReason?: string | undefined;
  useBlueprint?: boolean;
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

