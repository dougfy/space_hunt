// ── Main Game Loop ──────────────────────────────────────────────────────────

import type { GameState, ShipShape } from './types';
import { ZoomState } from './types';
import {
  CANVAS_W, CANVAS_H, FUEL_MAX,
  FUEL_DRAIN_PER_SECOND, LOW_FUEL_THRESHOLD, LOW_FUEL_BLINK_PERIOD,
  SHIP_IMPACT_BUFFER,
} from './constants';
import { vec2 } from './math';
import { generateAsteroids } from './asteroids';
import { generateFuelPods, updatePodDiscovery, checkPodCollection } from './pods';
import { createCamera, updateCamera, updateZoomState, getSafeZone, findNearestAsteroidIndex, isOverrideClear } from './camera';
import { updateShip } from './ship';
import { updateGhosts } from './ghosts';
import { createInputState, setupInput, processInput, InputState } from './input';
import {
  createRenderer, resizeRenderer, clearScreen, drawShip, drawAsteroid,
  drawTargetReticle, drawFuelPod, drawGhostShip, drawHUD, drawGhostLabel,
  drawAsteroidLabel, drawPlayerLabel, drawProjectiles, drawShootingHUD,
  drawZoomButton, isFireButtonHit, Renderer,
} from './renderer';
import type { DevvitCallbacks } from './bridge';
import { createShootingState, updateShooting, fireBurst } from './shooting';

let gameState: GameState | null = null;
let renderer: Renderer | null = null;
let inputState: InputState | null = null;
let cleanupInput: (() => void) | null = null;
let animFrame: number | null = null;
let lastTime = 0;
let poseTimer = 0;
let devvitCb: DevvitCallbacks | null = null;

const POSE_INTERVAL = 1 / 12; // ~12Hz pose reporting

export function getGameState(): GameState | null {
  return gameState;
}

/** Swap in real callbacks after a preview session starts */
export function setGameCallbacks(cb: DevvitCallbacks | null): void {
  devvitCb = cb;
}

export function startGame(
  canvas: HTMLCanvasElement,
  seed: string,
  playerName: string,
  shipShape: ShipShape,
  callbacks: DevvitCallbacks | null,
): GameState {
  devvitCb = callbacks;

  // Generate world
  const { asteroids, names } = generateAsteroids(seed);
  const pods = generateFuelPods(asteroids, seed);

  const aspect = CANVAS_W / CANVAS_H;
  const camera = createCamera(aspect);

  gameState = {
    ship: {
      pos: vec2(0, 0),
      vel: vec2(0, 0),
      ang: Math.PI / 2,
      thrust: false,
    },
    asteroids,
    asteroidNames: names,
    pods,
    ghosts: [],
    camera,
    worldOffset: vec2(0, 0),
    tgtPos: vec2(0, 0),
    tgtActive: false,
    fuelPercent: FUEL_MAX,
    docksCollected: 0,
    totalDocks: pods.filter(p => !p.refuels).length,
    zoomState: ZoomState.Normal,
    zoomTimer: 0,
    zoomOverride: -1,
    elapsedTime: 0,
    playerName,
    shipShape,
    impactBufferWorld: SHIP_IMPACT_BUFFER,
    playing: true,
    shooting: createShootingState(),
  };

  renderer = createRenderer(canvas);
  resizeRenderer(renderer);
  // Set camera aspect from actual canvas dimensions (avoids distortion)
  const sw = renderer.width / (window.devicePixelRatio || 1);
  const sh = renderer.height / (window.devicePixelRatio || 1);
  gameState.camera.aspect = sw / sh;
  inputState = createInputState();
  cleanupInput = setupInput(canvas, inputState, () => gameState, () => gameState!.camera);
  lastTime = performance.now();
  poseTimer = 0;

  // Handle resize
  const onResize = () => {
    if (renderer) {
      resizeRenderer(renderer);
      if (gameState) {
        const sw = renderer.width / (window.devicePixelRatio || 1);
        const sh = renderer.height / (window.devicePixelRatio || 1);
        gameState.camera.aspect = sw / sh;
      }
    }
  };
  window.addEventListener('resize', onResize);

  const loop = (now: number) => {
    if (!gameState || !gameState.playing) return;

    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    update(dt);
    render();

    animFrame = requestAnimationFrame(loop);
  };

  animFrame = requestAnimationFrame(loop);

  return gameState;
}

export function stopGame(): void {
  if (animFrame !== null) {
    cancelAnimationFrame(animFrame);
    animFrame = null;
  }
  if (cleanupInput) {
    cleanupInput();
    cleanupInput = null;
  }
  if (gameState) {
    gameState.playing = false;
  }
  gameState = null;
  renderer = null;
  inputState = null;
  devvitCb = null;
}

function update(dt: number): void {
  if (!gameState || !inputState || !renderer) return;

  const screenW = renderer.width / (window.devicePixelRatio || 1);
  const screenH = renderer.height / (window.devicePixelRatio || 1);

  gameState.elapsedTime += dt;

  // Process input
  processInput(inputState, gameState, gameState.camera, screenW, screenH);

  // Handle fire request
  if (inputState.fireRequested) {
    inputState.fireRequested = false;
    const burst = fireBurst(gameState);
    if (burst && devvitCb) {
      devvitCb.onFire(burst);
    }
  }

  // Handle zoom toggle — override locks camera zoomed OUT near current asteroid
  if (inputState.zoomToggleRequested) {
    inputState.zoomToggleRequested = false;
    if (gameState.zoomOverride >= 0) {
      // Already overriding — cancel it
      gameState.zoomOverride = -1;
    } else {
      // Lock zoomed-out: find the nearest asteroid to suppress
      const idx = findNearestAsteroidIndex(gameState, renderer.height);
      gameState.zoomOverride = idx; // -1 if not near any
      gameState.zoomState = ZoomState.Normal;
      gameState.zoomTimer = 0;
    }
  }

  // Auto-clear override once ship leaves the suppressed asteroid's zone
  if (gameState.zoomOverride >= 0) {
    const cleared = isOverrideClear(gameState, renderer.height);
    if (cleared) {
      gameState.zoomOverride = -1;
    }
  }

  // Update zoom state machine (skip when manually overridden)
  if (gameState.zoomOverride >= 0) {
    gameState.zoomState = ZoomState.Normal;
  } else {
    updateZoomState(gameState, dt, renderer.height);
  }

  // Update camera
  updateCamera(gameState, dt);

  // Get safe zone from current camera
  const safeZone = getSafeZone(gameState.camera);

  // Update ship physics
  updateShip(gameState, dt, safeZone);

  // Update ghost interpolation
  updateGhosts(gameState, dt);

  // Shooting update
  updateShooting(gameState, dt);

  // Fuel drain
  if (gameState.fuelPercent > 0 && gameState.ship.thrust) {
    gameState.fuelPercent -= FUEL_DRAIN_PER_SECOND * dt;
    if (gameState.fuelPercent < 0) gameState.fuelPercent = 0;
  }

  // Pod discovery
  updatePodDiscovery(gameState);

  // Pod collection (returns list of pod IDs to claim on server)
  const claimed = checkPodCollection(gameState);
  if (devvitCb) {
    for (const podId of claimed) {
      devvitCb.onClaimPod(podId);
    }
  }

  // Pose reporting
  poseTimer += dt;
  if (poseTimer >= POSE_INTERVAL && devvitCb) {
    poseTimer -= POSE_INTERVAL;
    const wx = gameState.ship.pos.x + gameState.worldOffset.x;
    const wy = gameState.ship.pos.y + gameState.worldOffset.y;
    devvitCb.onPose(wx, wy, gameState.ship.ang, gameState.playerName);
  }
}

function render(): void {
  if (!gameState || !renderer) return;

  const { camera } = gameState;
  clearScreen(renderer);

  // Determine if we should show discovered details (only when zoomed in)
  const showPods = gameState.zoomState === ZoomState.Zoomed ||
    gameState.zoomState === ZoomState.Releasing;

  // Draw asteroids
  for (let i = 0; i < gameState.asteroids.length; i++) {
    const a = gameState.asteroids[i];
    const discovered = gameState.pods.some(p => p.astIndex === i && p.discovered);
    drawAsteroid(renderer, camera, a, discovered);

    if (discovered && gameState.asteroidNames[i]) {
      drawAsteroidLabel(renderer, camera, a, gameState.asteroidNames[i], discovered);
    }
  }

  // Draw fuel pods (only when zoomed in)
  if (showPods) {
    for (const pod of gameState.pods) {
      if (!pod.discovered || pod.collected) continue;
      drawFuelPod(
        renderer, camera, pod.pos, gameState.asteroids[pod.astIndex], pod.color,
      );
    }
  }

  // Draw target reticle
  if (gameState.tgtActive) {
    drawTargetReticle(renderer, camera, gameState.tgtPos);
  }

  // Draw ghost ships
  for (const g of gameState.ghosts) {
    const localPos = {
      x: g.curWorld.x - gameState.worldOffset.x,
      y: g.curWorld.y - gameState.worldOffset.y,
    };
    drawGhostShip(renderer, camera, localPos, g.curAng, g.shape, g.slot);
    drawGhostLabel(renderer, camera, localPos, g.name, g.slot);
  }

  // Draw local ship
  drawShip(
    renderer, camera, gameState.ship.pos,
    gameState.ship.ang, gameState.shipShape,
    gameState.ship.thrust ? '#17b97d' : '#8ff7cf',
  );
  // Draw player name under local ship
  drawPlayerLabel(renderer, camera, gameState.ship.pos, gameState.playerName);

  // Draw HUD
  const lowBlink = gameState.fuelPercent <= LOW_FUEL_THRESHOLD &&
    Math.floor(gameState.elapsedTime / LOW_FUEL_BLINK_PERIOD) % 2 === 0;
  drawHUD(
    renderer,
    gameState.fuelPercent,
    gameState.docksCollected,
    gameState.totalDocks,
    lowBlink,
    gameState.elapsedTime,
  );

  // Draw projectiles and shooting HUD
  if (gameState.shooting.enabled) {
    drawProjectiles(renderer, camera, gameState.shooting.projectiles, gameState.elapsedTime);
    drawShootingHUD(renderer, gameState.shooting);
    drawZoomButton(renderer, gameState.zoomOverride >= 0);
  }
}
