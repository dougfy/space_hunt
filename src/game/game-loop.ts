// ── Main Game Loop ──────────────────────────────────────────────────────────

import type { GameState, ShipShape } from './types';
import { ZoomState } from './types';
import {
  CANVAS_W, CANVAS_H, FUEL_MAX,
  FUEL_DRAIN_PER_SECOND, LOW_FUEL_THRESHOLD, LOW_FUEL_BLINK_PERIOD,
  SHIP_IMPACT_BUFFER, SYSTEM_SIZE, SHIP_SIZE, PLAYER_MAX_HP,
} from './constants';
import { vec2, add } from './math';
import { generateAsteroids, generateRingAsteroids } from './asteroids';
import { generateFuelPods, updatePodDiscovery, checkPodCollection, applyPodCollected } from './pods';
import { createCamera, updateCamera, updateZoomState, getSafeZone, findNearestAsteroidIndex, isOverrideClear } from './camera';
import { updateShip } from './ship';
import { updateGhosts } from './ghosts';
import { createInputState, setupInput, processInput, InputState } from './input';
import {
  createRenderer, resizeRenderer, clearScreen, drawShip, drawAsteroid,
  drawTargetReticle, drawFuelPod, drawGhostShip, drawHUD, drawGhostLabel,
  drawAsteroidLabel, drawPlayerLabel, drawProjectiles, drawShootingHUD, drawZoomButton,
  isFireButtonHit, Renderer, drawControlButtons, hitTestControlButtons,
  drawGalaxyView, drawSystemView, drawPlanetView, drawTierHUD,
  drawDebugBounds, drawDockPanel, hitTestDockPanel,
  hitTestPlanetPanels, togglePlanetPanel, drawPlanetDebugBounds,
} from './renderer';
import type { DevvitCallbacks } from './bridge';
import { createShootingState, updateShooting, fireBurst } from './shooting';
import { createGalaxyState, NavigationTier, checkTierTransition, applyTransition, getLocalSeed, generateSystem, applyStarNames } from './galaxy';
import { GALAXY_SHIP_SPEED, GALAXY_SIZE, SHIP_MAX_SPEED } from './constants';
import { checkDocking, updateDocking, undock } from './dock';

let gameState: GameState | null = null;
let renderer: Renderer | null = null;
let inputState: InputState | null = null;
let _debugBounds = false;
export function getDebugBounds(): boolean { return _debugBounds; }
export function setDebugBounds(v: boolean): void { _debugBounds = v; }
let cleanupInput: (() => void) | null = null;
let animFrame: number | null = null;
let lastTime = 0;
let poseTimer = 0;
let devvitCb: DevvitCallbacks | null = null;

const POSE_INTERVAL = 1 / 12; // ~12Hz pose reporting

export function getGameState(): GameState | null {
  return gameState;
}

export function refreshGalaxyStarNames(): void {
  if (!gameState) return;
  applyStarNames(gameState.galaxy.stars);
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

  const aspect = CANVAS_W / CANVAS_H;
  const camera = createCamera(aspect);

  const isSplash = !callbacks;

  gameState = {
    ship: {
      pos: isSplash ? vec2(0, 5) : vec2(SYSTEM_SIZE / 2, SYSTEM_SIZE - 2),
      vel: vec2(0, 0),
      ang: Math.PI / 2,
      thrust: false,
    },
    asteroids: [],
    asteroidNames: [],
    pods: [],
    ghosts: [],
    camera,
    worldOffset: vec2(0, 0),
    tgtPos: vec2(0, 0),
    tgtActive: false,
    inputMode: 'mouse',
    keyThrust: false,
    keyTurnRate: 0,
    fuelPercent: FUEL_MAX,
    docksCollected: 0,
    totalDocks: 0,
    zoomState: ZoomState.Normal,
    zoomTimer: 0,
    zoomOverride: -1,
    elapsedTime: 0,
    playerName,
    shipShape,
    impactBufferWorld: SHIP_IMPACT_BUFFER,
    playing: true,
    splashMode: isSplash,
    dock: null,
    shooting: createShootingState(),
    galaxy: createGalaxyState(seed),
  };

  // Splash mode: drop into a self-contained asteroid field immediately
  if (isSplash) {
    gameState.galaxy.tier = NavigationTier.Local;
    const splashSeed = `splash:${seed}`;
    const { asteroids, names } = generateAsteroids(splashSeed);
    gameState.asteroids = asteroids;
    gameState.asteroidNames = names;
    gameState.pods = generateFuelPods(asteroids, splashSeed);
    gameState.totalDocks = gameState.pods.filter(p => !p.refuels).length;
  } else {
    // Play mode: start at Planet level, docked at home station
    const stationBody = gameState.galaxy.bodies[0]; // guaranteed to be a planet with station
    gameState.galaxy.tier = NavigationTier.Planet;
    gameState.galaxy.currentBodyIndex = 0;
    const stationFeature = stationBody.features.find(f => f.type === 'station');
    if (stationFeature) {
      // Position ship near the station but outside dock range
      const sx = Math.cos(stationFeature.angle) * stationFeature.dist;
      const sy = Math.sin(stationFeature.angle) * stationFeature.dist;
      // Offset away from feature by more than DOCK_FEATURE_RADIUS (0.4)
      const awayX = Math.cos(stationFeature.angle);
      const awayY = Math.sin(stationFeature.angle);
      gameState.ship.pos = vec2(sx + awayX * 0.6, sy + awayY * 0.6);
      gameState.ship.ang = stationFeature.angle + Math.PI; // face toward station
    }
  }

  console.log('[INIT] tier=', gameState.galaxy.tier, 'starIdx=', gameState.galaxy.currentStarIndex, 'bodies=', gameState.galaxy.bodies.length, 'shipPos=', gameState.ship.pos, 'asteroids=', gameState.asteroids.length);

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

  // Intercept UI clicks BEFORE processInput sets ship target

  // Handle dock panel clicks
  if (gameState.dock && inputState.pointerDown && inputState.pointerPos) {
    const dockAction = hitTestDockPanel(inputState.pointerPos);
    if (dockAction) {
      inputState.pointerDown = false;
      if (dockAction === 'leave') {
        console.log('[DOCK] Undocking from', gameState.dock.targetName);
        undock(gameState);
      } else {
        console.log('[DOCK] Action stub:', dockAction);
      }
    }
  }

  // Handle planet panel slide-out clicks
  if (gameState.galaxy.tier === NavigationTier.Planet && inputState.pointerDown && inputState.pointerPos) {
    const panelIdx = hitTestPlanetPanels(screenW, screenH, inputState.pointerPos.x, inputState.pointerPos.y);
    if (panelIdx >= 0) {
      togglePlanetPanel(panelIdx);
      inputState.pointerDown = false;
    } else if (panelIdx === -2) {
      inputState.pointerDown = false;
    }
  }

  // Process input (ship targeting, etc.)
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

  // Handle recenter — snap camera to ship, stop movement, toggle debug bounds
  if (inputState.recenterRequested) {
    inputState.recenterRequested = false;
    gameState.tgtActive = false;
    gameState.ship.vel = { x: 0, y: 0 };
    gameState.ship.thrust = false;
    gameState.camera.pos = { x: gameState.ship.pos.x, y: gameState.ship.pos.y };
    _debugBounds = !_debugBounds;
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

  // Update ship physics (skip when docked — ship is locked in place)
  if (gameState.dock && gameState.dock.docked) {
    // Ship is fully docked — freeze in place
    gameState.ship.vel = vec2(0, 0);
    gameState.ship.thrust = false;

    // Refill resources at station/starbase
    if (gameState.dock.targetType === 'feature' && gameState.dock.targetLabel === 'Station') {
      gameState.fuelPercent = FUEL_MAX;
      gameState.shooting.hp = PLAYER_MAX_HP;
    }
  } else if (gameState.dock && !gameState.dock.docked) {
    // Docking approach animation in progress
    updateDocking(gameState, dt);
  } else {
    updateShip(gameState, dt, safeZone);

    // Check for docking in Planet tier (only when not already docked)
    if (gameState.galaxy.tier === NavigationTier.Planet && !gameState.dock) {
      const newDock = checkDocking(gameState);
      if (newDock) {
        gameState.dock = newDock;
        gameState.tgtActive = false;
        console.log('[DOCK] Approaching', newDock.targetName, newDock.targetType);
      }
    }
  }

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
  } else {
    // Solo/preview mode — apply immediately without server round-trip
    for (const podId of claimed) {
      applyPodCollected(gameState, podId, true);
    }
  }

  // Galaxy tier transitions — skip in splash mode and when docked
  if (!gameState.splashMode && !gameState.dock) {
  const tier = gameState.galaxy.tier;
  // In ring model, Local tier uses system coords directly (no worldOffset)
  const worldShipPos = (tier === NavigationTier.Planet)
    ? add(gameState.ship.pos, gameState.worldOffset)
    : gameState.ship.pos;
  const transition = checkTierTransition(worldShipPos, gameState.galaxy);
  if (transition) {
    console.log('[TRANSITION] from tier=', gameState.galaxy.tier, 'to=', transition.newTier, 'shipPos=', gameState.ship.pos, 'worldShipPos=', worldShipPos, 'starIdx=', transition.starIndex, 'bodyIdx=', transition.bodyIndex);
    const newPos = applyTransition(gameState.galaxy, transition, gameState.ship.pos);
    gameState.ship.pos = newPos;
    gameState.worldOffset = vec2(0, 0);
    gameState.tgtActive = false;

    // Belt transitions (Local↔System): don't reset velocity — ship keeps moving
    const isBeltTransition = (
      (tier === NavigationTier.System && transition.newTier === NavigationTier.Local) ||
      (tier === NavigationTier.Local && transition.newTier === NavigationTier.System)
    );
    if (!isBeltTransition) {
      gameState.ship.vel = vec2(0, 0);
    }

    // Regenerate world content for new tier
    if (transition.newTier === NavigationTier.Local) {
      const body = gameState.galaxy.bodies[transition.bodyIndex];
      const localSeed = getLocalSeed(body);
      const center = SYSTEM_SIZE / 2;
      const { asteroids, names } = generateRingAsteroids(localSeed, center, center, body.orbitDist);
      gameState.asteroids = asteroids;
      gameState.asteroidNames = names;
      gameState.pods = generateFuelPods(asteroids, localSeed);
      gameState.docksCollected = 0;
      gameState.totalDocks = gameState.pods.filter(p => !p.refuels).length;
      console.log('[RING] Local tier entered. asteroids=', asteroids.length, 'pods=', gameState.pods.length, 'docks=', gameState.totalDocks, 'orbitDist=', body.orbitDist);
    } else if (transition.newTier === NavigationTier.Planet) {
      gameState.asteroids = [];
      gameState.asteroidNames = [];
      gameState.pods = [];
    } else {
      gameState.asteroids = [];
      gameState.asteroidNames = [];
      gameState.pods = [];
    }
  }
  } // end splash mode guard

  // Pose reporting
  poseTimer += dt;
  if (poseTimer >= POSE_INTERVAL && devvitCb) {
    poseTimer -= POSE_INTERVAL;
    const wx = gameState.ship.pos.x;
    const wy = gameState.ship.pos.y;
    devvitCb.onPose(
      wx, wy, gameState.ship.ang, gameState.playerName,
      gameState.galaxy.tier, gameState.galaxy.currentStarIndex, gameState.galaxy.currentBodyIndex,
    );
  }
}

function render(): void {
  if (!gameState || !renderer) return;

  const { camera } = gameState;
  const tier = gameState.galaxy.tier;
  clearScreen(renderer);

  // ── Galaxy tier ──
  if (tier === NavigationTier.Galaxy) {
    const shipRenderSize = SHIP_SIZE * 3;
    drawGalaxyView(renderer, camera, gameState.galaxy, gameState.ship.pos, !_debugBounds);

    // Draw ghost ships in galaxy
    for (const g of gameState.ghosts) {
      const localPos = {
        x: g.curWorld.x - gameState.worldOffset.x,
        y: g.curWorld.y - gameState.worldOffset.y,
      };
      drawGhostShip(renderer, camera, localPos, g.curAng, g.shape, g.slot);
      drawGhostLabel(renderer, camera, localPos, g.name, g.slot);
    }

    // Draw ship
    drawShip(
      renderer, camera, gameState.ship.pos,
      gameState.ship.ang, gameState.shipShape,
      gameState.ship.thrust ? '#17b97d' : '#8ff7cf',
      shipRenderSize,
    );
    drawPlayerLabel(renderer, camera, gameState.ship.pos, gameState.playerName);

    drawTierHUD(renderer, 'GALAXY', '', 'center');
    drawControlButtons(renderer, false, false, _debugBounds);
    return;
  }

  // ── System tier ──
  if (tier === NavigationTier.System) {
    const shipRenderSize = SHIP_SIZE * 3;
    drawSystemView(renderer, camera, gameState.galaxy, gameState.ship.pos);
    if (_debugBounds) {
      drawDebugBounds(renderer, camera, gameState.galaxy, gameState.ship.pos);
    }

    // Draw ghost ships in system
    for (const g of gameState.ghosts) {
      const localPos = {
        x: g.curWorld.x - gameState.worldOffset.x,
        y: g.curWorld.y - gameState.worldOffset.y,
      };
      drawGhostShip(renderer, camera, localPos, g.curAng, g.shape, g.slot);
      drawGhostLabel(renderer, camera, localPos, g.name, g.slot);
    }

    // Draw ship
    drawShip(
      renderer, camera, gameState.ship.pos,
      gameState.ship.ang, gameState.shipShape,
      gameState.ship.thrust ? '#17b97d' : '#8ff7cf',
      shipRenderSize,
    );
    drawPlayerLabel(renderer, camera, gameState.ship.pos, gameState.playerName);

    drawTierHUD(renderer, 'SYSTEM', '');

    drawControlButtons(renderer, false, false, _debugBounds);
    return;
  }

  // ── Planet tier ──
  if (tier === NavigationTier.Planet) {
    const shieldPercent = (gameState.shooting.hp / PLAYER_MAX_HP) * 100;
    drawPlanetView(
      renderer,
      camera,
      gameState.galaxy,
      gameState.ship.pos,
      gameState.fuelPercent,
      shieldPercent,
    );
    if (_debugBounds) {
      drawPlanetDebugBounds(renderer, camera, gameState.galaxy, gameState.ship.pos, gameState.worldOffset);
    }

    // Draw ghost ships in planet view
    for (const g of gameState.ghosts) {
      const localPos = {
        x: g.curWorld.x - gameState.worldOffset.x,
        y: g.curWorld.y - gameState.worldOffset.y,
      };
      drawGhostShip(renderer, camera, localPos, g.curAng, g.shape, g.slot);
      drawGhostLabel(renderer, camera, localPos, g.name, g.slot);
    }

    // Draw ship
    drawShip(
      renderer, camera, gameState.ship.pos,
      gameState.ship.ang, gameState.shipShape,
      gameState.ship.thrust ? '#17b97d' : '#8ff7cf',
    );
    drawPlayerLabel(renderer, camera, gameState.ship.pos, gameState.playerName);

    // Planet tier info is in the planet view itself (top-left), no separate HUD needed
    drawControlButtons(renderer, false, false, _debugBounds);

    // Draw dock panel only when fully docked
    if (gameState.dock?.docked) {
      drawDockPanel(renderer, gameState.dock);
    }
    return;
  }

  // ── Local tier ──
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

  // Local tier HUD
  const bodyName = gameState.galaxy.currentBodyIndex >= 0
    ? gameState.galaxy.bodies[gameState.galaxy.currentBodyIndex]?.name ?? '' : '';
  drawTierHUD(renderer, 'LOCAL', bodyName, 'center');
}
