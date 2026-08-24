// ── Main Game Loop ──────────────────────────────────────────────────────────

import type { GameState, ShipShape } from './types';
import { ZoomState } from './types';
import {
  CANVAS_W, CANVAS_H, FUEL_CAPACITY_BY_SHAPE,
  FUEL_DRAIN_PER_SECOND, LOW_FUEL_THRESHOLD, LOW_FUEL_BLINK_PERIOD,
  SHIP_IMPACT_BUFFER, SYSTEM_SIZE, SHIP_SIZE, PLAYER_MAX_HP, GALAXY_SIZE,
  STAR_ENTER_RADIUS, WARP_FUEL_COST_PER_UNIT, WARP_FUEL_MIN_COST,
} from './constants';
import { vec2 } from './math';
import { generateAsteroids, generateRingAsteroids } from './asteroids';
import { generateFuelPods, updatePodDiscovery, checkPodCollection } from './pods';
import { createCamera, updateCamera, updateZoomState, getSafeZone, findNearestAsteroidIndex, isOverrideClear, GALAXY_ORTHO_MIN, GALAXY_ORTHO_MAX, GALAXY_ZOOM_STEP, GALAXY_ORTHO_DEFAULT } from './camera';
import { updateShip } from './ship';
import { updateGhosts } from './ghosts';
import { createInputState, setupInput, processInput, InputState } from './input';
import { playSound } from './audio';
import {
  createRenderer, resizeRenderer, clearScreen, drawShip, drawAsteroid,
  drawTargetReticle, drawFuelPod, drawGhostShip, drawHUD, drawGhostLabel,
  drawAsteroidLabel, drawPlayerLabel, drawProjectiles, drawShootingHUD, drawZoomButton,
  Renderer, drawControlButtons, drawForeignShipsAtStar, drawPlayerFleetAtStar,
  drawGalaxyView, drawSystemView, drawPlanetView, drawTierHUD, drawShipStatus,
  drawDebugBounds, drawDockPanel, drawShipPanel, hitTestDockPanel, triggerDockPanelAction,
  hitTestPlanetPanels, togglePlanetPanel, drawPlanetDebugBounds, closeAllPanels, isAnyPanelOpen,
  worldToScreen, isPointCoveredByOpenPlanetPanel, consumePendingExtensionAction,
  setPanelContext, drawPlanetPanels, consumePendingGalaxyJump, consumePendingTierRevert, showBuildError, hitTestCoachButtons, drawCoachCongratsTop,
  isInTransferMode, hitTestGalaxyStar, completeTransferSelection, hitTestTransferCancel, cancelTransferMode,
  drawGalaxyZoomButtons, hitTestGalaxyZoomButtons, setHomeStarIndex,

  selectGalaxyStar, deselectGalaxyStar, getSelectedStarIndex, hitTestStarInfoDismiss, hitTestStarInfoVisit,
  drawGalaxyModeToggle, drawGalaxyModeBanner, hitTestGalaxyModeBtn, hitTestGalaxyExitBtn, toggleGalaxyMode, setGalaxyMode, getGalaxyMode,
  setGalaxyJumpReturnTier, isFleetPanelOpen, closeFleetPanel,
  getPostId, triggerExplore,
  drawSkinPicker, hitTestSkinPicker,
  drawReportBadge, drawReportPanel, hitTestReportBadge, hitTestReportDismiss,
  openReportPanel, dismissReport, isReportPanelOpen,
  triggerBuildButtonByIndex, triggerShipButtonByIndex,
} from './renderer';
import type { GalaxyMode as _GalaxyMode } from './renderer';
import type { DevvitCallbacks } from './bridge';
import { createShootingState, updateShooting, fireBurst } from './shooting';
import { createGalaxyState, NavigationTier, checkTierTransition, applyTransition, getLocalSeed, applyStarNames, generateSystem, consumeVisitForeignOwner } from './galaxy';
import { checkDocking, updateDocking, undock } from './dock';
import type { DockAction } from './dock';
import { initJourney, skipJourney, journeyAction, updateJourney, isJourneyDone as _isJourneyDone } from './journey';
import { coachAdvance } from './coach';
import { f } from './font';

let gameState: GameState | null = null;
let renderer: Renderer | null = null;
let inputState: InputState | null = null;
let _debugBounds = false;
try { _debugBounds = localStorage.getItem('spacehunt_debug_bounds') === '1'; } catch { /* ignore */ }
export function getDebugBounds(): boolean { return _debugBounds; }
export function setDebugBounds(v: boolean): void {
  _debugBounds = v;
  try { localStorage.setItem('spacehunt_debug_bounds', v ? '1' : '0'); } catch { /* ignore */ }
}
let cleanupInput: (() => void) | null = null;
let animFrame: number | null = null;
let lastTime = 0;
let poseTimer = 0;
let _savedDock: GameState['dock'] = null; // preserved across temporary galaxy jumps
let devvitCb: DevvitCallbacks | null = null;

const POSE_INTERVAL = 1; // 1Hz pose reporting (1 request/sec)

// ── Scout boundary warning ──
let _scoutWarningTimer = 0;
const SCOUT_WARNING_DURATION = 3.5; // seconds

// ── Warp fuel warning (Phase 14d) ──
let _warpFuelWarningTimer = 0;
const WARP_FUEL_WARNING_DURATION = 3.0; // seconds

// ── Docked movement warning ──
let _dockWarningTimer = 0;
const DOCK_WARNING_DURATION = 3.0; // seconds

// ── Dock refuel request (to debit star fuel supply) ──
let _pendingRefuel: { starIndex: number; amount: number } | null = null;

export function consumePendingRefuel(): { starIndex: number; amount: number } | null {
  const r = _pendingRefuel;
  _pendingRefuel = null;
  return r;
}

// ── Space Dock refuel ──
// TODO: cooldown is client-side only — move to a server Redis key (attack plan #37).
const SPACE_DOCK_REFUEL_COOLDOWN_MS = 5 * 60 * 1000;
let _lastSpaceDockRefuelMs = 0;

function handleSpaceDockRefuel(): void {
  if (!gameState) return;
  const remainingMs = SPACE_DOCK_REFUEL_COOLDOWN_MS - (Date.now() - _lastSpaceDockRefuelMs);
  if (_lastSpaceDockRefuelMs > 0 && remainingMs > 0) {
    showBuildError(`REFUEL READY IN ${Math.ceil(remainingMs / 1000)}s`);
    playSound('click');
    return;
  }
  const cap = FUEL_CAPACITY_BY_SHAPE[gameState.shipShape];
  const needed = cap - gameState.fuelUnits;
  if (needed <= 0) {
    showBuildError('FUEL ALREADY FULL');
    playSound('click');
    return;
  }
  _lastSpaceDockRefuelMs = Date.now();
  _pendingRefuel = { starIndex: gameState.galaxy.currentStarIndex, amount: Math.ceil(needed) };
  gameState.fuelUnits = cap;
  playSound('click');
  console.log('[DOCK] space dock refuel:', Math.ceil(needed), 'units');
}

// ── Known players (discovered via probes/visits) ──
const _knownPlayers = new Set<string>();

export function addKnownPlayer(name: string): void {
  _knownPlayers.add(name);
}

export function getKnownPlayers(): string[] {
  return Array.from(_knownPlayers);
}

export function getGameState(): GameState | null {
  return gameState;
}

/** After colonization succeeds, regenerate the system so the new station appears. */
export function onColonizeSuccess(starIndex: number, bodyIndex = 0): void {
  if (!gameState) return;
  const star = gameState.galaxy.stars[starIndex];
  if (!star) return;
  star.owner = 'player';
  star.stationBodyIndex = bodyIndex;
  // Regenerate system bodies so station feature is created
  if (gameState.galaxy.currentStarIndex === starIndex) {
    gameState.galaxy.bodies = generateSystem(star, getPostId());
  }
}

export function refreshGalaxyStarNames(): void {
  if (!gameState) return;
  applyStarNames(gameState.galaxy.stars);
}

/**
 * Mark stars as owned by other players (foreign).
 * Called after profile load with the claimed stars list.
 */
export function setStarClaims(claims: Array<{ starIndex: number; username: string; bodyIndex?: number }>, myUsername: string): void {
  if (!gameState) return;
  let playerClaimCount = 0;
  for (const claim of claims) {
    const star = gameState.galaxy.stars[claim.starIndex];
    if (!star) continue;
    if (claim.bodyIndex != null) {
      star.stationBodyIndex = claim.bodyIndex;
    }
    if (claim.username === myUsername) {
      star.owner = 'player';
      star.discovered = true;
      playerClaimCount++;
    } else {
      // Always store claimedBy so economy poll can use the correct owner username
      // even before the star is visually revealed as foreign
      star.claimedBy = claim.username;
      // Only reveal foreign stars visually if player has already discovered them
      if (star.discoveryLevel !== 'none') {
        star.owner = 'foreign';
        // Only add to contacts at 'visited' level (enhanced probe or physical visit)
        if (star.discoveryLevel === 'visited') {
          addKnownPlayer(claim.username);
        }
        // If player is currently at this star (system/planet tier), regenerate bodies
        // so the foreign starbase appears (covers refresh/late-load timing)
        if (gameState.galaxy.currentStarIndex === claim.starIndex &&
            gameState.galaxy.tier !== NavigationTier.Galaxy) {
          gameState.galaxy.bodies = generateSystem(star, getPostId());
        }
      }
    }
  }
  // Skip tutorial for returning players who already have colonies
  if (playerClaimCount > 1) {
    skipJourney();
  }
}

/** Restore discovered stars from server data. */
export function setDiscoveredStars(starIndices: number[], enhancedProbeStars?: number[]): void {
  if (!gameState) return;
  // If enhancedProbeStars is undefined, this is a legacy profile — treat all as visited
  const legacyMode = enhancedProbeStars === undefined;
  const enhancedSet = new Set(enhancedProbeStars ?? []);
  for (const idx of starIndices) {
    const star = gameState.galaxy.stars[idx];
    if (!star) continue;
    // Mark as discovered — does NOT claim ownership (that requires colonization)
    star.discovered = true;
    if (star.discoveryLevel === 'none') {
      // Legacy profiles: all discovered = visited. New profiles: check enhanced list.
      star.discoveryLevel = (legacyMode || enhancedSet.has(idx)) ? 'visited' : 'probed';
    }
  }
}

/** Get all star indices the player has discovered (any level). */
export function getDiscoveredStars(): number[] {
  if (!gameState) return [];
  return gameState.galaxy.stars
    .filter(s => s.discovered)
    .map(s => s.index);
}

/** Get stars at 'visited' discovery level (enhanced probe or scout visit). */
export function getVisitedStars(): number[] {
  if (!gameState) return [];
  return gameState.galaxy.stars
    .filter(s => s.discoveryLevel === 'visited')
    .map(s => s.index);
}

/** Get all star ownership claims (player + foreign). */
export function getStarOwnership(): Array<{ starIndex: number; owner: 'player' | 'foreign'; claimedBy?: string }> {
  if (!gameState) return [];
  return gameState.galaxy.stars
    .filter(s => s.owner === 'player' || s.owner === 'foreign')
    .map(s => ({ starIndex: s.index, owner: s.owner as 'player' | 'foreign', ...(s.claimedBy ? { claimedBy: s.claimedBy } : {}) }));
}

/** Re-apply star ownership from saved data. */
export function applyStarOwnership(claims: Array<{ starIndex: number; owner: 'player' | 'foreign'; claimedBy?: string }>): void {
  if (!gameState) return;
  for (const claim of claims) {
    const star = gameState.galaxy.stars[claim.starIndex];
    if (!star) continue;
    star.owner = claim.owner;
    star.discovered = true;
    if (claim.claimedBy) {
      star.claimedBy = claim.claimedBy;
      console.log(`[OWNERSHIP] applied star ${claim.starIndex}: owner=${claim.owner} claimedBy=${claim.claimedBy}`);
    } else {
      console.log(`[OWNERSHIP] applied star ${claim.starIndex}: owner=${claim.owner} claimedBy=MISSING`);
    }
  }
}

/**
 * Relocate the player to a different home star.
 * Called after profile load reveals the server-assigned star differs from the default.
 * Only applies when the game is in play mode (not splash).
 */
export function relocateToHomeStar(starIndex: number): void {
  if (!gameState) return;
  if (gameState.galaxy.homeStarIndex === starIndex) return; // already there

  const star = gameState.galaxy.stars[starIndex];
  if (!star) { console.warn(`[RELOCATE] invalid starIndex ${starIndex}`); return; }

  // Clear ownership on the old home star (splash mode may have set a different one)
  const oldHome = gameState.galaxy.stars[gameState.galaxy.homeStarIndex];
  if (oldHome && oldHome.index !== starIndex && oldHome.owner === 'player') {
    oldHome.owner = 'none';
    oldHome.discovered = false;
    oldHome.discoveryLevel = 'none';
  }

  // Update home and current star
  gameState.galaxy.homeStarIndex = starIndex;
  setHomeStarIndex(starIndex);
  gameState.galaxy.currentStarIndex = starIndex;
  star.owner = 'player';
  star.discovered = true;

  // Generate system for the new home star
  gameState.galaxy.bodies = generateSystem(star, getPostId());

  // Place ship at first body (station planet) in Planet tier, docked
  const stationBody = gameState.galaxy.bodies[0];
  if (stationBody) {
    gameState.galaxy.tier = NavigationTier.Planet;
    gameState.galaxy.currentBodyIndex = 0;
    const stationFeature = stationBody.features.find(f => f.type === 'station');
    if (stationFeature) {
      const sx = Math.cos(stationFeature.angle) * stationFeature.dist;
      const sy = Math.sin(stationFeature.angle) * stationFeature.dist;
      const toFeatX = Math.cos(stationFeature.angle);
      const toFeatY = Math.sin(stationFeature.angle);
      gameState.ship.pos = vec2(sx - toFeatX * 0.3, sy - toFeatY * 0.3);
      gameState.ship.ang = stationFeature.angle;
      const fi = stationBody.features.indexOf(stationFeature);
      gameState.dock = {
        docked: true,
        targetType: 'feature',
        bodyIndex: 0,
        featureIndex: fi,
        targetName: stationFeature.name,
        targetLabel: 'Station',
        approachTimer: 1,
      };
    }
  }

  console.log(`[RELOCATE] moved to star ${starIndex} (${star.name})`);
}

/**
 * Restore player to a saved position (star + tier + body).
 * Called on reload to resume where the player left off.
 */
export function restorePosition(starIndex: number, tier: number, bodyIndex: number): void {
  if (!gameState) return;

  // For galaxy tier with invalid starIndex, just switch to galaxy view centered on home
  if (starIndex < 0 || starIndex >= gameState.galaxy.stars.length) {
    if (tier === NavigationTier.Galaxy) {
      const home = gameState.galaxy.stars[gameState.galaxy.homeStarIndex];
      if (home) {
        gameState.galaxy.tier = NavigationTier.Galaxy;
        gameState.galaxy.currentStarIndex = -1;
        gameState.ship.pos = vec2(home.pos.x, home.pos.y);
        gameState.galaxyCamPos = { x: home.pos.x, y: home.pos.y };
        console.log(`[RESTORE] galaxy view at home star (invalid starIndex ${starIndex})`);
      }
    } else {
      console.warn(`[RESTORE] invalid starIndex ${starIndex}`);
    }
    return;
  }

  const star = gameState.galaxy.stars[starIndex];
  if (!star) { console.warn(`[RESTORE] star not found at index ${starIndex}`); return; }

  // Only mark discovered — ownership is set by setStarClaims from server data
  star.discovered = true;
  gameState.galaxy.currentStarIndex = starIndex;

  if (tier === NavigationTier.Galaxy) {
    // At galaxy view — place ship near the star
    gameState.galaxy.tier = NavigationTier.Galaxy;
    gameState.ship.pos = vec2(star.pos.x, star.pos.y);
    gameState.galaxyCamPos = { x: star.pos.x, y: star.pos.y };
    gameState.dock = null; // Clear dock state from startGame
  } else if (tier === NavigationTier.System) {
    // At system view — generate system, place ship near system edge (not center)
    gameState.galaxy.bodies = generateSystem(star, getPostId());
    gameState.galaxy.tier = NavigationTier.System;
    const center = SYSTEM_SIZE / 2;
    const edgeDist = 20; // SYSTEM_EXIT_RADIUS - 2, near outer boundary
    gameState.ship.pos = vec2(center, center + edgeDist);
    gameState.dock = null; // Clear dock state from startGame
  } else if (tier === NavigationTier.Local) {
    // At local orbit ring — generate system + ring asteroids for the body
    gameState.galaxy.bodies = generateSystem(star, getPostId());
    const bi = Math.min(bodyIndex, gameState.galaxy.bodies.length - 1);
    gameState.galaxy.currentBodyIndex = bi;
    gameState.galaxy.tier = NavigationTier.Local;
    gameState.dock = null;
    const body = gameState.galaxy.bodies[bi];
    if (body) {
      const center = SYSTEM_SIZE / 2;
      const localSeed = getLocalSeed(body);
      const { asteroids, names } = generateRingAsteroids(localSeed, center, center, body.orbitDist);
      gameState.asteroids = asteroids;
      gameState.asteroidNames = names;
      gameState.pods = generateFuelPods(asteroids, localSeed);
      gameState.docksCollected = 0;
      gameState.totalDocks = gameState.pods.filter(p => !p.refuels).length;
      // Place ship at orbit distance
      gameState.ship.pos = vec2(center + body.orbitDist, center);
    }
  } else {
    // Planet tier — generate system, go to specific body
    gameState.galaxy.bodies = generateSystem(star, getPostId());
    const bi = Math.min(bodyIndex, gameState.galaxy.bodies.length - 1);
    gameState.galaxy.currentBodyIndex = bi;
    gameState.galaxy.tier = NavigationTier.Planet;
    const body = gameState.galaxy.bodies[bi];
    gameState.dock = null; // Clear stale dock state
    if (body) {
      const stationFeature = body.features.find(f => f.type === 'station');
      if (stationFeature) {
        const sx = Math.cos(stationFeature.angle) * stationFeature.dist;
        const sy = Math.sin(stationFeature.angle) * stationFeature.dist;
        gameState.ship.pos = vec2(sx + Math.cos(stationFeature.angle) * 0.6, sy + Math.sin(stationFeature.angle) * 0.6);
        gameState.ship.ang = stationFeature.angle + Math.PI;
        const fi = body.features.indexOf(stationFeature);
        gameState.dock = {
          docked: true,
          targetType: 'feature',
          bodyIndex: bi,
          featureIndex: fi,
          targetName: stationFeature.name,
          targetLabel: 'Station',
          approachTimer: 1,
        };
      } else {
        gameState.ship.pos = vec2(0, 3);
      }
    }
  }

  console.log(`[RESTORE] position star=${starIndex} tier=${tier} body=${bodyIndex}`);
}

/** Swap in real callbacks after the game starts. */
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
    fuelUnits: FUEL_CAPACITY_BY_SHAPE[shipShape],
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
    galaxyZoom: 20,
    galaxyCamPos: { x: 50, y: 50 },
    galaxyZoomCooldown: 0,
    floatTexts: [],
  };

  setHomeStarIndex(gameState.galaxy.homeStarIndex);

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
    if (!stationBody) {
      throw new Error('Missing starting station body');
    }
    gameState.galaxy.tier = NavigationTier.Planet;
    gameState.galaxy.currentBodyIndex = 0;
    const stationFeature = stationBody.features.find(f => f.type === 'station');
    if (stationFeature) {
      // Position ship docked at the station
      const sx = Math.cos(stationFeature.angle) * stationFeature.dist;
      const sy = Math.sin(stationFeature.angle) * stationFeature.dist;
      const toFeatX = Math.cos(stationFeature.angle);
      const toFeatY = Math.sin(stationFeature.angle);
      // Place at docked position (0.3 units away from feature toward planet center)
      gameState.ship.pos = vec2(sx - toFeatX * 0.3, sy - toFeatY * 0.3);
      gameState.ship.ang = stationFeature.angle; // face toward station
      // Set dock state immediately so player starts with full station access
      const fi = stationBody.features.indexOf(stationFeature);
      gameState.dock = {
        docked: true,
        targetType: 'feature',
        bodyIndex: 0,
        featureIndex: fi,
        targetName: stationFeature.name,
        targetLabel: 'Station',
        approachTimer: 1,
      };
    }
  }

  console.log('[INIT] tier=', gameState.galaxy.tier, 'starIdx=', gameState.galaxy.currentStarIndex, 'bodies=', gameState.galaxy.bodies.length, 'shipPos=', gameState.ship.pos, 'asteroids=', gameState.asteroids.length);

  // Initialize journey/tutorial system (only for play mode, not splash)
  if (!isSplash) {
    initJourney();
  }

  renderer = createRenderer(canvas);
  resizeRenderer(renderer);
  // Set camera aspect from actual canvas dimensions (avoids distortion)
  const sw = renderer.width / (window.devicePixelRatio || 1);
  const sh = renderer.height / (window.devicePixelRatio || 1);
  gameState.camera.aspect = sw / sh;
  inputState = createInputState();
  cleanupInput = setupInput(canvas, inputState, () => gameState, () => gameState!.camera, isSplash);
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
    drawSkinPicker(renderer!);
    drawCoachCongratsTop(renderer!);
    drawReportBadge(renderer!, gameState!.elapsedTime);
    drawReportPanel(renderer!);

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

  // Update journey/tutorial system (Planet tier only — voice/pulse shouldn't fire in other tiers)
  if (gameState.galaxy.tier === NavigationTier.Planet) {
    updateJourney();
  }

  // Tick down scout warning timer
  if (_scoutWarningTimer > 0) _scoutWarningTimer = Math.max(0, _scoutWarningTimer - dt);
  if (_warpFuelWarningTimer > 0) _warpFuelWarningTimer = Math.max(0, _warpFuelWarningTimer - dt);
  if (_dockWarningTimer > 0) _dockWarningTimer = Math.max(0, _dockWarningTimer - dt);

  // Intercept UI clicks BEFORE processInput sets ship target

  // Recover fast touch taps: if pointerUp already fired but pendingTap exists,
  // re-assert pointerDown so all existing click handling works unchanged.
  if (!inputState.pointerDown && inputState.pendingTap) {
    inputState.pointerDown = true;
    inputState.pointerPos = inputState.pendingTap;
  }
  // Clear pendingTap now that it's been promoted (or if pointerDown was already true)
  inputState.pendingTap = null;

  // Coach marks draw over everything, so they claim the tap first. Must run before the
  // skin picker and dock panel, both of which can return "not handled" and let the tap
  // fall through to ship movement.
  if (inputState.pointerDown && inputState.pointerPos) {
    if (hitTestCoachButtons(inputState.pointerPos.x, inputState.pointerPos.y)) {
      inputState.pointerDown = false;
    }
  }

  // Skin picker overlay is modal — intercept all taps when visible
  if (inputState.pointerDown && inputState.pointerPos) {
    if (hitTestSkinPicker(inputState.pointerPos.x, inputState.pointerPos.y)) {
      console.log('[TAP] consumed by skin picker');
      inputState.pointerDown = false;
    }
  }

  // Report panel — modal when open, badge when closed
  if (inputState.pointerDown && inputState.pointerPos) {
    if (isReportPanelOpen()) {
      // Check dismiss button or click-anywhere-to-dismiss
      if (hitTestReportDismiss(inputState.pointerPos.x, inputState.pointerPos.y)) {
        dismissReport();
      } else {
        dismissReport(); // click anywhere on backdrop dismisses
      }
      inputState.pointerDown = false;
    } else if (hitTestReportBadge(inputState.pointerPos.x, inputState.pointerPos.y)) {
      openReportPanel();
      inputState.pointerDown = false;
    }
  }

  // Handle dock panel clicks
  if (gameState.dock && inputState.pointerDown && inputState.pointerPos) {
    const dockAction = hitTestDockPanel(inputState.pointerPos);
    if (dockAction) {
      console.log('[TAP] dock action:', dockAction, 'pos:', inputState.pointerPos);
      inputState.pointerDown = false;
      if (dockAction === 'leave') {
        console.log('[DOCK] Undocking from', gameState.dock.targetName);
        if (gameState.dock.targetType === 'planet') {
          playSound('leaving_orbit');
        } else {
          playSound(Math.random() < 0.5 ? 'undocking' : 'undocking_alt');
        }
        undock(gameState);
        journeyAction();
        coachAdvance('navigate_dock');
        devvitCb?.onMilestone?.('first_move');
      } else if (dockAction === 'scan') {
        playSound('begin_scan');
        // Trigger planet exploration
        triggerExplore(gameState.galaxy.currentStarIndex, gameState.galaxy.currentBodyIndex);
        journeyAction();
        coachAdvance('help');
        console.log('[DOCK] SCAN triggered at star', gameState.galaxy.currentStarIndex, 'body', gameState.galaxy.currentBodyIndex);
      } else if (dockAction === 'refuel') {
        handleSpaceDockRefuel();
      } else if (dockAction === 'ships' || dockAction === 'buy_ships') {
        playSound('click');
        // Ship panel toggle/buy handled inside hitTestDockPanel
      } else if (triggerDockPanelAction(dockAction, gameState.dock)) {
        playSound('click');
        console.log('[DOCK] Extension started:', dockAction);
      } else {
        playSound('click');
        console.log('[DOCK] Action stub:', dockAction);
      }
    }
  }

  // Per-frame: if fleet panel is open but we're not at galaxy tier, force jump
  if (isFleetPanelOpen() && gameState.galaxy.tier !== NavigationTier.Galaxy) {
    setGalaxyJumpReturnTier(gameState.galaxy.tier === NavigationTier.System ? 'system' : gameState.galaxy.tier === NavigationTier.Local ? 'local' : 'planet');
    _savedDock = gameState.dock;
    gameState.galaxy.tier = NavigationTier.Galaxy;
    gameState.ship.vel = { x: 0, y: 0 };
    gameState.ship.thrust = false;
    setGalaxyMode('fleet');

  // ── Keyboard action shortcuts (agent/power-user) ──────────────────────────
  } else if (inputState.actionKey) {
    const action = inputState.actionKey;
    inputState.actionKey = null;
    const PANEL_MAP: Record<string, number> = { panel_status: 0, panel_build: 1, panel_ships: 2, panel_fleet: 3, panel_coms: 4 };
    if (action in PANEL_MAP) {
      const idx = PANEL_MAP[action]!;
      const fleetAction = togglePlanetPanel(idx);
      if (fleetAction === 'fleet-opened' && gameState.galaxy.tier !== NavigationTier.Galaxy) {
        _savedDock = gameState.dock;
        const returnTier = gameState.galaxy.tier === NavigationTier.System ? 'system' : gameState.galaxy.tier === NavigationTier.Local ? 'local' : 'planet';
        setGalaxyJumpReturnTier(returnTier);
        gameState.galaxy.tier = NavigationTier.Galaxy;
        gameState.ship.vel = { x: 0, y: 0 };
        gameState.ship.thrust = false;
        setGalaxyMode('fleet');
      }
      playSound('click');
    } else if (action === 'undock' && gameState.dock) {
      console.log('[KEY] Undocking from', gameState.dock.targetName);
      if (gameState.dock.targetType === 'planet') playSound('leaving_orbit');
      else playSound(Math.random() < 0.5 ? 'undocking' : 'undocking_alt');
      undock(gameState);
      journeyAction();
      coachAdvance('navigate_dock');
      devvitCb?.onMilestone?.('first_move');
    } else if (action === 'scan' && gameState.dock) {
      playSound('begin_scan');
      triggerExplore(gameState.galaxy.currentStarIndex, gameState.galaxy.currentBodyIndex);
      journeyAction();
      coachAdvance('help');
      console.log('[KEY] SCAN triggered at star', gameState.galaxy.currentStarIndex, 'body', gameState.galaxy.currentBodyIndex);
    } else if (action === 'close_panel') {
      closeAllPanels();
    } else if (action === 'recenter') {
      inputState.recenterRequested = true;
    } else if (action === 'zoom_toggle') {
      inputState.zoomToggleRequested = true;
    } else if (action.startsWith('btn_')) {
      const idx = parseInt(action.slice(4), 10);
      if (triggerBuildButtonByIndex(idx, gameState.dock ?? undefined)) {
        journeyAction();
        console.log('[KEY] BUILD button', idx, 'triggered');
      } else if (triggerShipButtonByIndex(idx)) {
        journeyAction();
        console.log('[KEY] SHIP button', idx, 'triggered');
      }
    }

  }

  // Handle transfer mode star selection before generic panel outside-click closing.
  // Otherwise a valid star tap can close FLEET, queue a tier revert, and lose the send.
  if (isInTransferMode() && gameState.galaxy.tier === NavigationTier.Galaxy && inputState.pointerDown && inputState.pointerPos) {
    const px = inputState.pointerPos.x;
    const py = inputState.pointerPos.y;
    if (hitTestTransferCancel(px, py)) {
      cancelTransferMode();
      inputState.pointerDown = false;
    } else {
      const targetStar = hitTestGalaxyStar(px, py);
      if (targetStar >= 0) {
        console.log('[GALAXY] selecting transfer target', targetStar);
        completeTransferSelection(targetStar);
        inputState.pointerDown = false;
      }
    }
  }

  // Handle slide-out panel clicks (all tiers)
  if (inputState.pointerDown && inputState.pointerPos) {
    const panelIdx = hitTestPlanetPanels(screenW, screenH, inputState.pointerPos.x, inputState.pointerPos.y);
    if (panelIdx >= 0) {
      journeyAction();
      const fleetAction = togglePlanetPanel(panelIdx);
      // Fleet tab opened from non-galaxy tier → jump to galaxy map (scouts cannot use fleet)
      if (fleetAction === 'fleet-opened' && gameState.galaxy.tier !== NavigationTier.Galaxy) {
        _savedDock = gameState.dock; // preserve dock across temporary galaxy jump
        const returnTier = gameState.galaxy.tier === NavigationTier.System ? 'system' : gameState.galaxy.tier === NavigationTier.Local ? 'local' : 'planet';
        setGalaxyJumpReturnTier(returnTier);
        gameState.galaxy.tier = NavigationTier.Galaxy;
        gameState.ship.vel = { x: 0, y: 0 };
        gameState.ship.thrust = false;
        setGalaxyMode('fleet');
      }
      inputState.pointerDown = false;
    } else if (panelIdx === -2) {
      inputState.pointerDown = false;
    } else if (panelIdx === -1 && isAnyPanelOpen()) {
      // Clicked outside all panels while a panel is open → close it
      closeAllPanels();
      inputState.pointerDown = false;
    }
  }

  // Consume pending extension action from BUILD panel
  if (gameState.dock) {
    const extAction = consumePendingExtensionAction();
    if (extAction) {
      triggerDockPanelAction(extAction as DockAction, gameState.dock);
    }
  }

  // Consume pending galaxy jump from FLEET panel MAP button
  if (consumePendingGalaxyJump()) {
    gameState.galaxy.tier = NavigationTier.Galaxy;
    gameState.ship.vel = { x: 0, y: 0 };
    gameState.ship.thrust = false;
    setGalaxyMode('fleet'); // Fleet panel → fleet command mode
  }

  // Consume pending tier revert when fleet panel closes after galaxy jump
  const revertTier = consumePendingTierRevert();
  if (revertTier) {
    gameState.galaxy.tier = revertTier === 'system' ? NavigationTier.System : revertTier === 'local' ? NavigationTier.Local : NavigationTier.Planet;
    gameState.ship.vel = { x: 0, y: 0 };
    gameState.ship.thrust = false;
    // Restore dock state saved before temporary galaxy jump
    if (_savedDock) {
      gameState.dock = _savedDock;
      _savedDock = null;
    }
  }

  // Handle galaxy zoom +/- button taps
  if (gameState.galaxy.tier === NavigationTier.Galaxy && inputState.pointerDown && inputState.pointerPos) {
    const zHit = hitTestGalaxyZoomButtons(renderer, inputState.pointerPos.x, inputState.pointerPos.y);
    if (zHit === 'zoomIn') {
      gameState.galaxyZoom = Math.max(GALAXY_ORTHO_MIN, gameState.galaxyZoom - GALAXY_ZOOM_STEP);
      gameState.galaxyZoomCooldown = 1.0;
      inputState.pointerDown = false;
    } else if (zHit === 'zoomOut') {
      gameState.galaxyZoom = Math.min(GALAXY_ORTHO_MAX, gameState.galaxyZoom + GALAXY_ZOOM_STEP);
      gameState.galaxyZoomCooldown = 1.0;
      inputState.pointerDown = false;
    }
  }



  // Handle galaxy mode toggle button tap
  if (gameState.galaxy.tier === NavigationTier.Galaxy && inputState.pointerDown && inputState.pointerPos) {
    if (hitTestGalaxyExitBtn(inputState.pointerPos.x, inputState.pointerPos.y)) {
      // Unconditional exit — works even when no return-tier breadcrumb survives
      const starIdx = gameState.galaxy.currentStarIndex >= 0
        ? gameState.galaxy.currentStarIndex
        : gameState.galaxy.homeStarIndex;
      const star = gameState.galaxy.stars[starIdx];
      if (star) {
        gameState.galaxy.currentStarIndex = starIdx;
        gameState.galaxy.bodies = generateSystem(star, getPostId());
        gameState.galaxy.tier = NavigationTier.System;
        const center = SYSTEM_SIZE / 2;
        gameState.ship.pos = vec2(center, center + 20);
        gameState.ship.vel = { x: 0, y: 0 };
        gameState.ship.thrust = false;
        gameState.dock = null;
        _savedDock = null;
        setGalaxyMode('nav');
        cancelTransferMode();
      }
      inputState.pointerDown = false;
    } else if (hitTestGalaxyModeBtn(inputState.pointerPos.x, inputState.pointerPos.y)) {
      toggleGalaxyMode();
      inputState.pointerDown = false;
    }
  }

  // Handle star info card selection (galaxy tier, not in transfer mode, not dragging)
    if (!isInTransferMode() && gameState.galaxy.tier === NavigationTier.Galaxy
      && inputState.pointerDown && inputState.pointerPos) {
    const px = inputState.pointerPos.x;
    const py = inputState.pointerPos.y;

    // Check dismiss button first
    if (getSelectedStarIndex() >= 0 && hitTestStarInfoDismiss(px, py)) {
      deselectGalaxyStar();
      inputState.pointerDown = false;
    } else if (getSelectedStarIndex() >= 0 && hitTestStarInfoVisit(px, py)) {
      // VISIT button: set ship target to the selected star's position
      const starIdx = getSelectedStarIndex();
      const targetStar = gameState.galaxy.stars[starIdx];
      if (targetStar) {
        gameState.tgtPos = { x: targetStar.pos.x, y: targetStar.pos.y };
        gameState.tgtActive = true;
        deselectGalaxyStar();
      }
      inputState.pointerDown = false;
    } else {
      // Check if tapping a star (toggle if same star)
      const tappedStar = hitTestGalaxyStar(px, py);
      if (tappedStar >= 0 && tappedStar === getSelectedStarIndex()) {
        deselectGalaxyStar();
        inputState.pointerDown = false;
      } else if (tappedStar >= 0) {
        console.log('[GALAXY] selecting star', tappedStar, 'mode=', getGalaxyMode());
        selectGalaxyStar(tappedStar);
        // Center camera on the tapped star, keep current zoom level
        const star = gameState.galaxy.stars[tappedStar];
        if (star) {
          gameState.galaxyCamPos = { x: star.pos.x, y: star.pos.y };
          gameState.galaxyZoomCooldown = 1.0;
        }
        inputState.pointerDown = false; // consume click — don't move ship
      } else if (getSelectedStarIndex() >= 0) {
        // Tapped empty space — deselect
        deselectGalaxyStar();
        // In fleet mode consume click; in nav mode let processInput handle ship movement
        if (getGalaxyMode() === 'fleet') inputState.pointerDown = false;
      } else if (getGalaxyMode() === 'fleet') {
        // Fleet mode: consume all taps (no ship movement)
        inputState.pointerDown = false;
      }
    }
  }

  // Deselect star when leaving galaxy tier
  if (gameState.galaxy.tier !== NavigationTier.Galaxy && getSelectedStarIndex() >= 0) {
    deselectGalaxyStar();
  }

  // Process input (ship targeting, etc.) — skip in fleet mode at galaxy tier
  // ── Docked movement warning: intercept clicks/keys when docked ──
  if (gameState.dock && gameState.dock.docked) {
    const DOCK_MOVEMENT_KEYS = new Set(['w','a','s','d','h','j','k','l','arrowup','arrowdown','arrowleft','arrowright']);
    const hasMovement = [...inputState.keysDown].some(k => DOCK_MOVEMENT_KEYS.has(k));
    const hasSpaceClick = inputState.pointerDown && inputState.pointerPos;
    if ((hasMovement || hasSpaceClick) && _dockWarningTimer <= 0) {
      // Close any open panel first before showing dock warning
      if (isAnyPanelOpen()) {
        closeAllPanels();
      } else {
        _dockWarningTimer = DOCK_WARNING_DURATION;
        playSound('ship_is_docked');
      }
      journeyAction();
    }
    if (hasMovement || hasSpaceClick) {
      inputState.pointerDown = false;
      inputState.pendingTap = null;
    }
  }

  if (!(gameState.galaxy.tier === NavigationTier.Galaxy && getGalaxyMode() === 'fleet')) {
    processInput(inputState, gameState, gameState.camera, screenW, screenH);
  }

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

  // Handle recenter — snap camera to ship and toggle boundary rings.
  // Deliberately does NOT halt the ship: tapping this mid-flight used to cancel
  // your destination and kill momentum, which was surprising.
  if (inputState.recenterRequested) {
    inputState.recenterRequested = false;
    gameState.camera.pos = { x: gameState.ship.pos.x, y: gameState.ship.pos.y };
    // Reset galaxy zoom and camera position to ship
    gameState.galaxyZoom = GALAXY_ORTHO_DEFAULT;
    gameState.galaxyCamPos = { x: gameState.ship.pos.x, y: gameState.ship.pos.y };
    setDebugBounds(!_debugBounds);
  }

  // ── Galaxy zoom: consume scroll/pinch delta ──
  if (inputState.scrollDelta !== 0 && gameState.galaxy.tier === NavigationTier.Galaxy) {
    const prevZoom = gameState.galaxyZoom;
    gameState.galaxyZoom += inputState.scrollDelta * GALAXY_ZOOM_STEP;
    gameState.galaxyZoom = Math.max(GALAXY_ORTHO_MIN, Math.min(GALAXY_ORTHO_MAX, gameState.galaxyZoom));

    // Zoom-toward-cursor: keep world point under cursor stationary on screen
    // galaxyCamPos is always clamped/in-sync with camera.pos now
    if (inputState.cursorPos) {
      const screenW = renderer.width / (window.devicePixelRatio || 1);
      const screenH = renderer.height / (window.devicePixelRatio || 1);
      const camX = gameState.galaxyCamPos.x, camY = gameState.galaxyCamPos.y;
      const aspect = gameState.camera.aspect;
      const oldHalfH = prevZoom;
      const oldHalfW = oldHalfH * aspect;
      const nx = inputState.cursorPos.x / screenW;
      const ny = inputState.cursorPos.y / screenH;
      const newHalfH = gameState.galaxyZoom;
      const newHalfW = newHalfH * aspect;
      // Only shift axes where viewport is smaller than galaxy (otherwise camera is centered)
      if (newHalfW * 2 < GALAXY_SIZE) {
        const wbX = camX + (nx * 2 - 1) * oldHalfW;
        const waX = camX + (nx * 2 - 1) * newHalfW;
        gameState.galaxyCamPos.x = camX + (wbX - waX);
      }
      if (newHalfH * 2 < GALAXY_SIZE) {
        const wbY = camY + (1 - ny * 2) * oldHalfH;
        const waY = camY + (1 - ny * 2) * newHalfH;
        gameState.galaxyCamPos.y = camY + (wbY - waY);
      }
    }

    // Suppress auto-lerps for 1 second after user zooms
    gameState.galaxyZoomCooldown = 1.0;

    inputState.scrollDelta = 0;
  } else {
    inputState.scrollDelta = 0;
  }

  // ── Galaxy drag-to-pan ──
  // Fleet mode: always pan on drag
  // Nav mode (extended): pan only while Shift is held (avoids conflict with click-to-move)
  // Nav mode (inline): no drag-pan (uses buttons)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _isInlineMode = !!(globalThis as any).__INLINE_MODE__;
  const isFleetMode = getGalaxyMode() === 'fleet';
  const shiftHeld = inputState.keysDown.has('shift');
  const canDragPan = isFleetMode || (!_isInlineMode && shiftHeld);
  if (inputState.dragDelta && gameState.galaxy.tier === NavigationTier.Galaxy && canDragPan) {
    const screenH = renderer.height / (window.devicePixelRatio || 1);
    // Convert screen pixels to world units based on current ortho size
    const worldPerPx = (gameState.galaxyZoom * 2) / screenH;
    gameState.galaxyCamPos.x -= inputState.dragDelta.x * worldPerPx;
    gameState.galaxyCamPos.y += inputState.dragDelta.y * worldPerPx; // Y is inverted (screen down = world up)
    gameState.galaxyZoomCooldown = 1.0; // suppress auto-lerp
    inputState.dragDelta = null;
  } else {
    inputState.dragDelta = null;
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

    // Refill resources at station/starbase — only at player-owned or unclaimed stars
    if (gameState.dock.targetType === 'feature' && gameState.dock.targetLabel === 'Station') {
      const dockStar = gameState.galaxy.currentStarIndex >= 0
        ? gameState.galaxy.stars[gameState.galaxy.currentStarIndex] : null;
      const starOwner = dockStar?.owner ?? 'none';
      const isHome = gameState.galaxy.currentStarIndex === gameState.galaxy.homeStarIndex;
      if (starOwner !== 'foreign' || isHome) {
        const cap = FUEL_CAPACITY_BY_SHAPE[gameState.shipShape];
        const needed = cap - gameState.fuelUnits;
        if (needed > 0 && !_pendingRefuel) {
          _pendingRefuel = { starIndex: gameState.galaxy.currentStarIndex, amount: Math.ceil(needed) };
        }
        gameState.fuelUnits = cap;
        gameState.shooting.hp = PLAYER_MAX_HP;
      }
    }
  } else if (gameState.dock && !gameState.dock.docked) {
    // Docking approach animation in progress
    updateDocking(gameState, dt);
    // Detect dock completion
    if (gameState.dock.docked) {
      devvitCb?.onMilestone?.('first_dock');
    }
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
  const fuelCapacity = FUEL_CAPACITY_BY_SHAPE[gameState.shipShape];
  if (gameState.fuelUnits > 0 && gameState.ship.thrust) {
    const prevFuel = gameState.fuelUnits;
    gameState.fuelUnits -= FUEL_DRAIN_PER_SECOND * dt;
    if (gameState.fuelUnits < 0) gameState.fuelUnits = 0;
    // Play fuel warnings once when crossing thresholds (percentage-based)
    const prevPct = (prevFuel / fuelCapacity) * 100;
    const curPct = (gameState.fuelUnits / fuelCapacity) * 100;
    if (prevPct > LOW_FUEL_THRESHOLD && curPct <= LOW_FUEL_THRESHOLD) {
      playSound('low_fuel');
    }
    if (prevPct > 10 && curPct <= 10) {
      playSound('fuel_critical');
    }
  }

  // Pod discovery
  updatePodDiscovery(gameState);

  // Pod collection (returns list of pod IDs to claim on server)
  const claimed = checkPodCollection(gameState);
  if (devvitCb) {
    for (const podId of claimed) {
      const pod = gameState.pods.find(p => p.id === podId);
      devvitCb.onClaimPod(podId, pod ? !pod.refuels : false);
    }
  }

  // Update floating texts (age + cull expired)
  for (const ft of gameState.floatTexts) ft.age += dt;
  gameState.floatTexts = gameState.floatTexts.filter(ft => ft.age < 1.5);

  // Safety: dock state should only exist at Planet tier. Clear if stale.
  if (gameState.dock && gameState.galaxy.tier !== NavigationTier.Planet) {
    gameState.dock = null;
  }

  // Galaxy tier transitions — skip in splash mode and when docked
  if (!gameState.splashMode && !gameState.dock) {
  const tier = gameState.galaxy.tier;
  // In ring model, Local tier uses system coords directly (no worldOffset)
  // Planet tier: static boundary — ship pos IS the world pos (no scrolling)
  const worldShipPos = gameState.ship.pos;
  const transition = checkTierTransition(worldShipPos, gameState.galaxy);
  if (transition) {
    // Star pass-through: if ship has active target at a DIFFERENT star, skip entering this star
    // Only applies when in galaxy tier flying between stars
    console.log('[TRANSITION] check:', tier, '→', transition.newTier, 'star=', transition.starIndex, 'body=', transition.bodyIndex, 'tgtActive=', gameState.tgtActive, 'shipShape=', gameState.shipShape);
    let skipTransition = false;
    if (transition.newTier === NavigationTier.System && tier === NavigationTier.Galaxy && gameState.tgtActive) {
      const targetStar = gameState.galaxy.stars[transition.starIndex];
      if (targetStar) {
        const tgtDistToStar = Math.sqrt(
          (gameState.tgtPos.x - targetStar.pos.x) ** 2 + (gameState.tgtPos.y - targetStar.pos.y) ** 2,
        );
        // If the target isn't this star (target position is far from star center), skip
        if (tgtDistToStar > STAR_ENTER_RADIUS) {
          skipTransition = true;
        }
      }
    }

    // Belt pass-through: if ship has active target beyond the belt, don't enter Local tier
    if (transition.newTier === NavigationTier.Local) {
      const center = SYSTEM_SIZE / 2;
      const body = gameState.galaxy.bodies[transition.bodyIndex];
      if (body && gameState.tgtActive) {
        const beltTolerance = 0.5;
        const tgtDistFromCenter = Math.sqrt(
          (gameState.tgtPos.x - center) ** 2 + (gameState.tgtPos.y - center) ** 2,
        );
        // If target is NOT on the belt (farther than beltTolerance from orbit),
        // the player wants to fly through, not enter. Only enter if clicking ON the belt.
        const tgtOnBelt = Math.abs(tgtDistFromCenter - body.orbitDist) <= beltTolerance;
        if (!tgtOnBelt) {
          skipTransition = true;
        }
      }
    }

    if (skipTransition) {
      console.log('[TRANSITION] skipped (pass-through)');
      // Do nothing — let ship fly through the belt
    } else
    // Ship gate: scouts cannot enter Galaxy tier
    if (transition.newTier === NavigationTier.Galaxy && gameState.shipShape === 'scout') {
      // Block exit — bounce ship back toward system center
      const center = SYSTEM_SIZE / 2;
      const dx = center - gameState.ship.pos.x;
      const dy = center - gameState.ship.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0) {
        gameState.ship.pos = vec2(
          gameState.ship.pos.x + (dx / d) * 0.5,
          gameState.ship.pos.y + (dy / d) * 0.5,
        );
      }
      gameState.ship.vel = vec2(0, 0);
      gameState.tgtActive = false;
      // Show warning message
      _scoutWarningTimer = SCOUT_WARNING_DURATION;
      playSound('scout_range_exceeded');
      // Don't apply transition
    } else if (transition.newTier === NavigationTier.System && tier === NavigationTier.Galaxy) {
      // ── Phase 14d: Warp fuel cost ──────────────────────────────────────────
      const star = gameState.galaxy.stars[transition.starIndex];
      const dist = star ? Math.sqrt(
        (gameState.ship.pos.x - star.pos.x) ** 2 + (gameState.ship.pos.y - star.pos.y) ** 2,
      ) : 0;
      // Use distance from the previous star (or origin) to the target star
      const prevStar = gameState.galaxy.currentStarIndex >= 0
        ? gameState.galaxy.stars[gameState.galaxy.currentStarIndex] : null;
      const warpDist = prevStar && star ? Math.sqrt(
        (prevStar.pos.x - star.pos.x) ** 2 + (prevStar.pos.y - star.pos.y) ** 2,
      ) : dist;
      const warpCost = Math.max(WARP_FUEL_MIN_COST, Math.ceil(warpDist * WARP_FUEL_COST_PER_UNIT));
      if (gameState.fuelUnits < warpCost) {
        // Insufficient fuel — bounce back
        const center = star ? star.pos : gameState.ship.pos;
        const dx2 = gameState.ship.pos.x - center.x;
        const dy2 = gameState.ship.pos.y - center.y;
        const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (d2 > 0) {
          gameState.ship.pos = vec2(
            gameState.ship.pos.x + (dx2 / d2) * 0.5,
            gameState.ship.pos.y + (dy2 / d2) * 0.5,
          );
        }
        gameState.ship.vel = vec2(0, 0);
        gameState.tgtActive = false;
        _warpFuelWarningTimer = WARP_FUEL_WARNING_DURATION;
        playSound('low_fuel');
      } else {
        // Deduct warp fuel and proceed with Galaxy→System transition
        gameState.fuelUnits -= warpCost;
        console.log('[WARP] cost=', warpCost, 'remaining=', gameState.fuelUnits);
    console.log('[TRANSITION] Galaxy→System shipPos=', gameState.ship.pos, 'starIdx=', transition.starIndex);
    const newPos = applyTransition(gameState.galaxy, transition, gameState.ship.pos, getPostId());
    gameState.ship.pos = newPos;
    gameState.worldOffset = vec2(0, 0);
    gameState.tgtActive = false;

    // When visiting a foreign star, add the owner to known contacts
    const foreignOwner = consumeVisitForeignOwner();
    if (foreignOwner) {
      addKnownPlayer(foreignOwner);
    }

    closeFleetPanel();
    gameState.ship.vel = vec2(0, 0);

    // Galaxy→System never spawns local content
    gameState.asteroids = [];
    gameState.asteroidNames = [];
    gameState.pods = [];
      } // end warp fuel else
    } else {
    // Non-warp transitions (System↔Local, Local→Planet, System→Galaxy, etc.)
    console.log('[TRANSITION] from tier=', gameState.galaxy.tier, 'to=', transition.newTier, 'shipPos=', gameState.ship.pos, 'worldShipPos=', worldShipPos, 'starIdx=', transition.starIndex, 'bodyIdx=', transition.bodyIndex);
    const newPos2 = applyTransition(gameState.galaxy, transition, gameState.ship.pos, getPostId());
    gameState.ship.pos = newPos2;
    gameState.worldOffset = vec2(0, 0);
    gameState.tgtActive = false;

    const foreignOwner2 = consumeVisitForeignOwner();
    if (foreignOwner2) {
      addKnownPlayer(foreignOwner2);
    }

    if (transition.newTier === NavigationTier.Galaxy) {
      setGalaxyMode('nav');
    }

    const isBeltTransition2 = (
      (tier === NavigationTier.System && transition.newTier === NavigationTier.Local) ||
      (tier === NavigationTier.Local && transition.newTier === NavigationTier.System)
    );
    if (!isBeltTransition2) {
      gameState.ship.vel = vec2(0, 0);
    }

    if (transition.newTier === NavigationTier.Local) {
      const body2 = gameState.galaxy.bodies[transition.bodyIndex];
      if (!body2) return;
      const localSeed2 = getLocalSeed(body2);
      const center2 = SYSTEM_SIZE / 2;
      const { asteroids: ast2, names: nm2 } = generateRingAsteroids(localSeed2, center2, center2, body2.orbitDist);
      gameState.asteroids = ast2;
      gameState.asteroidNames = nm2;
      gameState.pods = generateFuelPods(ast2, localSeed2);
      gameState.docksCollected = 0;
      gameState.totalDocks = gameState.pods.filter(p => !p.refuels).length;
    } else if (transition.newTier === NavigationTier.Planet) {
      gameState.asteroids = [];
      gameState.asteroidNames = [];
      gameState.pods = [];
    } else {
      gameState.asteroids = [];
      gameState.asteroidNames = [];
      gameState.pods = [];
    }
    } // end non-warp else
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
  const screenW = renderer.width / (window.devicePixelRatio || 1);
  const screenH = renderer.height / (window.devicePixelRatio || 1);
  const fuelCap = FUEL_CAPACITY_BY_SHAPE[gameState.shipShape];
  const fuelPct = (gameState.fuelUnits / fuelCap) * 100;
  clearScreen(renderer);

  // ── Galaxy tier ──
  if (tier === NavigationTier.Galaxy) {
    const shipRenderSize = SHIP_SIZE * 3;
    drawGalaxyView(renderer, camera, gameState.galaxy, gameState.ship.pos, true, _debugBounds);

    // Draw ghost ships in galaxy
    for (const g of gameState.ghosts) {
      const localPos = {
        x: g.curWorld.x - gameState.worldOffset.x,
        y: g.curWorld.y - gameState.worldOffset.y,
      };
      drawGhostShip(renderer, camera, localPos, g.curAng, g.shape, g.slot, g.skinId);
      if (g.name !== gameState.playerName) drawGhostLabel(renderer, camera, localPos, g.name, g.slot);
    }

    // Draw ship (hidden in fleet mode)
    if (getGalaxyMode() === 'nav') {
      drawShip(
        renderer, camera, gameState.ship.pos,
        gameState.ship.ang, gameState.shipShape,
        gameState.ship.thrust ? '#17b97d' : '#8ff7cf',
        shipRenderSize,
      );
      drawPlayerLabel(renderer, camera, gameState.ship.pos, gameState.playerName);
    }

    drawTierHUD(renderer, 'GALAXY', '', 'center');
    drawGalaxyModeBanner(renderer);
    drawControlButtons(renderer, false, false, _debugBounds);
    drawGalaxyZoomButtons(renderer, gameState.galaxyZoom, GALAXY_ORTHO_MIN, GALAXY_ORTHO_MAX);
    drawGalaxyModeToggle(renderer);

    // Draw side panels (not docked at galaxy level)
    setPanelContext(false, gameState.galaxy.currentStarIndex >= 0 ? gameState.galaxy.currentStarIndex : null, 'galaxy', gameState.shipShape);
    drawPlanetPanels(renderer.ctx, screenW, screenH, ['TIER: GALAXY']);
    drawShipStatus(renderer, gameState.fuelUnits, fuelCap, (gameState.shooting.hp / PLAYER_MAX_HP) * 100);

    // Warp fuel warning overlay
    if (_warpFuelWarningTimer > 0) {
      const ctx = renderer.ctx;
      const alpha = Math.min(1, _warpFuelWarningTimer / 0.5);
      ctx.save();
      ctx.font = f(13, 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(255, 160, 40, ${alpha})`;
      ctx.fillText('INSUFFICIENT FUEL FOR WARP', screenW / 2, screenH * 0.18);
      ctx.font = f(11);
      ctx.fillStyle = `rgba(200, 220, 210, ${alpha * 0.85})`;
      ctx.fillText('Refuel at a station before traveling', screenW / 2, screenH * 0.18 + 20);
      ctx.restore();
    }
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
      drawGhostShip(renderer, camera, localPos, g.curAng, g.shape, g.slot, g.skinId);
      if (g.name !== gameState.playerName) drawGhostLabel(renderer, camera, localPos, g.name, g.slot);
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

    // Draw side panels (not docked at system level)
    setPanelContext(false, gameState.galaxy.currentStarIndex >= 0 ? gameState.galaxy.currentStarIndex : null, 'system', gameState.shipShape);
    drawPlanetPanels(renderer.ctx, screenW, screenH, ['TIER: SYSTEM']);

    // Scout boundary warning overlay
    if (_scoutWarningTimer > 0) {
      const ctx = renderer.ctx;
      const alpha = Math.min(1, _scoutWarningTimer / 0.5); // fade out in last 0.5s
      ctx.save();
      ctx.font = f(13, 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(255, 80, 60, ${alpha})`;
      ctx.fillText('SCOUT RANGE EXCEEDED', screenW / 2, screenH * 0.18);
      ctx.font = f(11);
      ctx.fillStyle = `rgba(200, 220, 210, ${alpha * 0.85})`;
      ctx.fillText('Upgrade ship at station to leave system', screenW / 2, screenH * 0.18 + 20);
      ctx.restore();
    }
    drawShipStatus(renderer, gameState.fuelUnits, fuelCap, (gameState.shooting.hp / PLAYER_MAX_HP) * 100);
    return;
  }

  // ── Planet tier ──
  if (tier === NavigationTier.Planet) {
    const shieldPercent = (gameState.shooting.hp / PLAYER_MAX_HP) * 100;
    const isDocked = gameState.dock?.docked === true;
    const currentStar = gameState.galaxy.currentStarIndex >= 0 ? gameState.galaxy.stars[gameState.galaxy.currentStarIndex] : null;
    const isOwned = currentStar?.owner === 'player' || gameState.galaxy.currentStarIndex === gameState.galaxy.homeStarIndex;
    const isForeign = currentStar?.owner === 'foreign' && gameState.galaxy.currentStarIndex !== gameState.galaxy.homeStarIndex;
    setPanelContext(isDocked, gameState.galaxy.currentStarIndex >= 0 ? gameState.galaxy.currentStarIndex : null, 'planet', gameState.shipShape, isOwned, isForeign, gameState.galaxy.currentBodyIndex);
    drawPlanetView(
      renderer,
      camera,
      gameState.galaxy,
      gameState.ship.pos,
      gameState.fuelUnits,
      fuelCap,
      shieldPercent,
      isDocked,
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
      const ghostSc = worldToScreen(localPos, camera, screenW, screenH);
      if (isPointCoveredByOpenPlanetPanel(screenW, screenH, ghostSc.x, ghostSc.y)) {
        continue;
      }
      drawGhostShip(renderer, camera, localPos, g.curAng, g.shape, g.slot, g.skinId);
      if (g.name !== gameState.playerName) drawGhostLabel(renderer, camera, localPos, g.name, g.slot);
    }

    // Draw fleet ships near station (or near planet if no station)
    if (gameState.galaxy.currentStarIndex >= 0) {
      const body = gameState.galaxy.bodies[gameState.galaxy.currentBodyIndex];
      if (body) {
        const stationFeat = body.features.find(f => f.type === 'station');
        const anchorPos = stationFeat
          ? { x: Math.cos(stationFeat.angle) * stationFeat.dist, y: Math.sin(stationFeat.angle) * stationFeat.dist }
          : { x: 0, y: 1.5 }; // above planet center
        drawPlayerFleetAtStar(renderer, camera, gameState.galaxy.currentStarIndex, anchorPos);
        drawForeignShipsAtStar(renderer, camera, gameState.galaxy.currentStarIndex, anchorPos);
      }
    }

    // Draw ship
    const shipSc = worldToScreen(gameState.ship.pos, camera, screenW, screenH);
    if (!isPointCoveredByOpenPlanetPanel(screenW, screenH, shipSc.x, shipSc.y)) {
      drawShip(
        renderer, camera, gameState.ship.pos,
        gameState.ship.ang, gameState.shipShape,
        gameState.ship.thrust ? '#17b97d' : '#8ff7cf',
      );
      drawPlayerLabel(renderer, camera, gameState.ship.pos, gameState.playerName);
    }

    // Planet tier info is in the planet view itself (top-left), no separate HUD needed
    drawControlButtons(renderer, false, false, _debugBounds);

    // Draw dock panel only when fully docked
    if (gameState.dock?.docked) {
      const body = gameState.galaxy.currentBodyIndex >= 0
        ? (gameState.galaxy.bodies[gameState.galaxy.currentBodyIndex] ?? null)
        : null;
      drawDockPanel(renderer, gameState.dock, body, gameState.galaxy.currentStarIndex);
      drawShipPanel(renderer);
    }

    // Docked movement warning overlay
    if (_dockWarningTimer > 0) {
      const ctx = renderer.ctx;
      const alpha = Math.min(1, _dockWarningTimer / 0.5);
      ctx.save();
      ctx.font = f(13, 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(255, 100, 80, ${alpha})`;
      ctx.fillText('UNDOCK TO MOVE', screenW / 2, screenH * 0.18);
      ctx.font = f(11);
      ctx.fillStyle = `rgba(200, 220, 210, ${alpha * 0.85})`;
      ctx.fillText('Press UNDOCK to leave station', screenW / 2, screenH * 0.18 + 20);
      ctx.restore();
    }
    return;
  }

  // ── Local tier ──
  // Determine if we should show discovered details (only when zoomed in)
  const showPods = gameState.zoomState === ZoomState.Zoomed ||
    gameState.zoomState === ZoomState.Releasing;

  // Draw asteroids
  for (const [i, a] of gameState.asteroids.entries()) {
    const discovered = gameState.pods.some(p => p.astIndex === i && p.discovered);
    drawAsteroid(renderer, camera, a, discovered);

    const asteroidName = gameState.asteroidNames[i];
    if (discovered && asteroidName) {
      drawAsteroidLabel(renderer, camera, a, asteroidName, discovered);
    }
  }

  // Draw fuel pods (only when zoomed in)
  if (showPods) {
    for (const pod of gameState.pods) {
      if (!pod.discovered || pod.collected) continue;
      const asteroid = gameState.asteroids[pod.astIndex];
      if (!asteroid) continue;
      drawFuelPod(
        renderer, camera, pod.pos, asteroid, pod.color,
      );
    }
  }

  // Draw floating collection texts
  for (const ft of gameState.floatTexts) {
    const scr = worldToScreen({ x: ft.x, y: ft.y + ft.age * 0.5 }, camera, screenW, screenH);
    const alpha = Math.max(0, 1 - ft.age / 1.5);
    renderer.ctx.save();
    renderer.ctx.globalAlpha = alpha;
    renderer.ctx.font = f(14, 'bold');
    renderer.ctx.fillStyle = ft.color;
    renderer.ctx.textAlign = 'center';
    renderer.ctx.fillText(ft.text, scr.x, scr.y);
    renderer.ctx.restore();
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
    drawGhostShip(renderer, camera, localPos, g.curAng, g.shape, g.slot, g.skinId);
    if (g.name !== gameState.playerName) drawGhostLabel(renderer, camera, localPos, g.name, g.slot);
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
  const lowBlink = fuelPct <= LOW_FUEL_THRESHOLD &&
    Math.floor(gameState.elapsedTime / LOW_FUEL_BLINK_PERIOD) % 2 === 0;
  drawHUD(
    renderer,
    gameState.fuelUnits,
    fuelCap,
    gameState.docksCollected,
    gameState.totalDocks,
    lowBlink,
    gameState.elapsedTime,
  );

  // Draw projectiles and shooting HUD
  if (gameState.shooting.enabled) {
    drawProjectiles(renderer, camera, gameState.shooting.projectiles, gameState.elapsedTime);
    drawShootingHUD(renderer, gameState.shooting);
  }

  // Local zoom control is always available, independent of weapon systems.
  drawZoomButton(renderer, gameState.zoomOverride >= 0);

  // Local tier HUD
  const bodyName = gameState.galaxy.currentBodyIndex >= 0
    ? gameState.galaxy.bodies[gameState.galaxy.currentBodyIndex]?.name ?? '' : '';
  drawTierHUD(renderer, 'BELT', bodyName, 'center');

  drawControlButtons(renderer, false, false, _debugBounds);

  // Draw side panels (Belt tier)
  setPanelContext(false, gameState.galaxy.currentStarIndex >= 0 ? gameState.galaxy.currentStarIndex : null, 'local', gameState.shipShape);
  drawPlanetPanels(renderer.ctx, screenW, screenH, ['TIER: BELT']);
}
