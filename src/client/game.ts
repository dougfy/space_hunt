// ── Space Hunt Game Entry (Devvit Integration) ─────────────────────────────
// Initializes the canvas game engine with the Devvit bridge.
// Detects inline vs expanded mode and shows overlay buttons when inline.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
console.log(`[STARTUP] game.ts module executing, t=${(performance.now() - ((globalThis as any).__t0 ?? 0)).toFixed(0)}ms from HTML head`);

import { context, requestExpandedMode } from '@devvit/web/client';
import { telemetry } from '@devvit/analytics/client/reddit';
import versionJson from '../../version.json';
import { consumePendingBuildRequest, consumePendingBuyShipRequest, consumePendingUpgradeShipRequest, consumePendingCompleteBuilds, consumePendingColonizeRequest, consumePendingTransfer, consumePendingCancelRoute, consumePendingTrade, createDevvitBridge, getGameState, getDiscoveredStars, getVisitedStars, getKnownPlayers, addKnownPlayer, setExternalStarNames, refreshGalaxyStarNames, relocateToHomeStar, restorePosition, setDiscoveredStars, setStarClaims, setServerStarEconomy, setServerShipState, setServerFleetAll, setForeignFleet, setIsAdmin, skipJourney, startJourney, isJourneyDone, startCoach, restoreCoach, isCoachSkipped, getCoachStep, coachAdvance, isCoachActive, startShipsTopic, startComsTopic, startColonizationTopic, colonizationTopicAction, openComsPanelForTutorial, getFontScaleName, setFontScaleByName, setTextAuditEnabled, getOverflowReport, playSound, preloadSounds, onColonizeSuccess, setComsUnread, clearComsUnread, isComsPanelOpen, setPostId, setTradeStationInfo, enableFullGestures, setKnownPlayers, getDMPeer, setDMMessages, setDMUnread, consumePendingDMSend, consumeDMInputRequest, submitDMInput, consumePendingDMReport, showDMReportConfirm, getComsTab, setPublicComments, consumePendingPublicPost, consumePublicInputRequest, submitPublicPost, setAllianceInfo, setAllianceInvites, setAllianceChat, getAllianceView, consumeAllianceAction, consumeAllianceInputRequest, submitAllianceInput, setAllianceUsername, consumePendingBotTest, consumePendingBotAdminTest, consumePendingBotCheck, setBotTestLog, consumePendingBotCopy, setLeaderboardData, consumePendingSeedBots, consumePendingToggleShield, consumePendingFleetShare, setFleetShareCooldown, consumePendingExplore, showExploreResult, getShieldCharging, clearShieldCharging, consumePendingRefuel, deductBaseFuel, consumePendingVideoPlay, setReturningReport, getTestState, confirmSkinPicker, getSoundHistory, showBuildError, setBuildCooldown } from '../game';
import type { DevvitBridge } from '../game';
import type { ShipShape } from '../game';
import { getFleetShape } from '../shared/ships';

type CoachUiBridge = typeof globalThis & { __helpPanelOpen?: boolean };
import { initSkins, getActiveSkinId, setActiveSkin, getWireframePref, setWireframePref } from '../game/skin';
import { VIDEO_CATALOG, FLEET_COMMAND_SENDER } from '../shared/feature-flags';
import { proceduralSkin } from '../game/skins/procedural';
import { rasterSkin, preloadRasterSprites } from '../game/skins/raster';
import { scifiSkin, preloadScifiSprites } from '../game/skins/scifi';
import { preloadShipSprites } from '../game/ship-sprites';
import { PROBE_MIN_FUEL_COST } from '../game/constants';
import type {
  BuildBuildingRequest,
  ClaimPodResponse,
  ClaimedPodsResponse,
  ComsUnreadResponse,
  DMListResponse,
  DMUnreadResponse,
  FleetAllResponse,
  PlayerProfileResponse,
  PoseUpdateRequest,
  PostShotsRequest,
  PublicCommentsResponse,
  RoomPosesResponse,
  SaveProfileRequest,
  StarEconomyResponse,
  StarShipsResponse,
  ShotsResponse,
  TradeStationInfoResponse,
  AllianceInfoResponse,
  AllianceInvitesResponse,
  AllianceChatResponse,
} from '../shared/api';
import { isTradingStation } from '../shared/trading';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas #game-canvas not found');

async function loadRealStarNames(): Promise<void> {
  const cacheKey = 'spacehunt_real_star_names_v1';

  // Use cached one-time pull first.
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const names = JSON.parse(cached) as string[];
      if (Array.isArray(names) && names.length > 0) {
        setExternalStarNames(names);
        refreshGalaxyStarNames();
        return;
      }
    }
  } catch (_e) {
    // Ignore cache parse/storage issues.
  }

  // External CDN fetch violates Devvit CSP; fallback names only.
}

void loadRealStarNames();

// ── Mode detection ──────────────────────────────────────────────────────────
const overlay = document.getElementById('overlay') ?? document.createElement('div');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isInline = !!(globalThis as any).__INLINE_MODE__ || overlay.classList.contains('visible');

// View mode: detect mobile/portrait vs desktop
function detectViewMode(): { isMobile: boolean; isPortrait: boolean; screenW: number; screenH: number } {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return { isMobile: w < 600, isPortrait: h > w, screenW: w, screenH: h };
}
const _viewMode = detectViewMode();
// Re-detect on resize
window.addEventListener('resize', () => {
  const m = detectViewMode();
  Object.assign(_viewMode, m);
});
// Export for renderer
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__VIEW_MODE__ = _viewMode;

// Expose test state for Playwright/automation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__testState = () => {
  const gs = getGameState();
  const ts = getTestState();
  return {
    ...ts,
    playerName: gs?.playerName ?? null,
    shipShape: gs?.shipShape ?? null,
    docked: gs?.dock?.docked ?? false,
    splashMode: gs?.splashMode ?? true,
    playing: gs?.playing ?? false,
    tier: gs?.galaxy?.tier ?? null,
    homeStar: gs?.galaxy?.homeStarIndex ?? null,
  };
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__confirmSkinPicker = () => confirmSkinPicker();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__textAudit = (on?: boolean) => {
  if (on === undefined) return getOverflowReport();
  setTextAuditEnabled(on);
  return `text audit ${on ? 'ON' : 'OFF'} — open panels, then call __textAudit() for the report`;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__getSoundHistory = () => getSoundHistory();

const playHereBtn = document.getElementById('play-here') ?? document.createElement('button');
const playFullBtn = document.getElementById('play-full') ?? document.createElement('button');

// ── Devvit context ──────────────────────────────────────────────────────────
const _t0 = performance.now();
const username = context.username ?? 'pilot';
const postId = context.postId ?? 'standalone:dev';
let hasTraded = false;
// Expose Reddit username for test automation (display name may differ)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__REDDIT_USERNAME__ = username;
console.log(`[PERF] context resolved in ${(performance.now() - _t0).toFixed(0)}ms`);

// Set version in settings panel (Vite replaces __APP_VERSION__ in JS modules)
declare const __APP_VERSION__: string;
const versionEl = document.getElementById('version-display');
if (versionEl) versionEl.textContent = 'v' + __APP_VERSION__;

// ── Debug log panel ─────────────────────────────────────────────────────────
const debugLog = document.getElementById('debug-log')!;
const _origLog = console.log;
const _origWarn = console.warn;
const _origError = console.error;
const MAX_DEBUG_LINES = 100;
function appendDebug(prefix: string, args: unknown[]) {
  const line = prefix + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  // Skip noisy lines from debug panel (still go to browser console)
  if (line.startsWith('[PERF]') || line.startsWith('[CLICK]')) return;
  debugLog.textContent = (debugLog.textContent || '') + line + '\n';
  // Trim old lines
  const lines = debugLog.textContent!.split('\n');
  if (lines.length > MAX_DEBUG_LINES) {
    debugLog.textContent = lines.slice(lines.length - MAX_DEBUG_LINES).join('\n');
  }
  debugLog.scrollTop = debugLog.scrollHeight;
}
console.log = (...args: unknown[]) => { _origLog.apply(console, args); appendDebug('', args); };
console.warn = (...args: unknown[]) => { _origWarn.apply(console, args); appendDebug('[W] ', args); };
console.error = (...args: unknown[]) => { _origError.apply(console, args); appendDebug('[E] ', args); };
const debugCopy = document.getElementById('debug-copy')!;
debugCopy.addEventListener('click', () => {
  const text = debugLog.textContent || '';
  void navigator.clipboard.writeText(text).then(() => {
    debugCopy.textContent = '\u2713';
    setTimeout(() => { debugCopy.innerHTML = '&#x2398;'; }, 1500);
  });
});

// Force save button
const debugForceSave = document.getElementById('debug-force-save');
if (debugForceSave) {
  debugForceSave.addEventListener('click', () => {
    console.log('[DEBUG] force save triggered');
    _lastSavedPosition = '';
    _lastSavedDiscovered = '';
    _lastSavedVisited = '';
    savePositionIfChanged();
  });
}

// Check Redis button
const debugCheckRedis = document.getElementById('debug-check-redis');
if (debugCheckRedis) {
  debugCheckRedis.addEventListener('click', () => {
    console.log('[DEBUG] checking Redis for', username);
    fetch(`/api/debug/profile-raw?username=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(d => {
        console.log('[REDIS-RAW]', JSON.stringify(d));
      })
      .catch(e => console.error('[REDIS-RAW] error:', e));
  });
}

console.log(`[INIT] v${versionJson.version} isInline=${isInline} username=${username} postId=${postId}`);
console.log(`[INIT] viewMode: mobile=${_viewMode.isMobile} portrait=${_viewMode.isPortrait} screen=${_viewMode.screenW}x${_viewMode.screenH}`);

const sessionId = `${username}:${Math.random().toString(36).slice(2, 8)}`;

// ── Ship shape state ────────────────────────────────────────────────────────
let currentShape: ShipShape = 'scout';
let currentName = username;
let playerHomeStarIndex: number | null = null;

// ── Scanned bodies tracking (wireframe → raster on scan) ────────────────────
const _scannedBodies = new Set<string>(); // keys: "starIndex:bodyIndex" (legacy), "starIndex:bodyIndex:f", "starIndex:bodyIndex:p"

/** Check if a body's features (station/buildings) have been scanned */
export function isFeatureScanned(starIndex: number, bodyIndex: number): boolean {
  return _scannedBodies.has(`${starIndex}:${bodyIndex}:f`) || _scannedBodies.has(`${starIndex}:${bodyIndex}`);
}

/** Check if a body's planet surface has been scanned */
export function isPlanetScanned(starIndex: number, bodyIndex: number): boolean {
  return _scannedBodies.has(`${starIndex}:${bodyIndex}:p`) || _scannedBodies.has(`${starIndex}:${bodyIndex}`);
}

/** Legacy: check if body has been scanned (either target) */
export function isBodyScanned(starIndex: number, bodyIndex: number): boolean {
  return isFeatureScanned(starIndex, bodyIndex) || isPlanetScanned(starIndex, bodyIndex);
}

/** Mark a body's features or planet as scanned */
function markBodyScanned(starIndex: number, bodyIndex: number, target?: 'f' | 'p'): void {
  if (target) {
    _scannedBodies.add(`${starIndex}:${bodyIndex}:${target}`);
  } else {
    _scannedBodies.add(`${starIndex}:${bodyIndex}`); // legacy — both
  }
}

// Expose to renderer (cross-module access)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__isBodyScanned = isBodyScanned;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__isFeatureScanned = isFeatureScanned;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__isPlanetScanned = isPlanetScanned;

// ── Active buffs (synced from server economy poll) ──────────────────────────
const _activeBuffs: Array<{ buffId: string; expiresAt: number; grantedAt: number; starIndex: number }> = [];


// ── Create bridge ───────────────────────────────────────────────────────────
const bridge: DevvitBridge = createDevvitBridge(canvas, {
  onPose(x, y, angle, name, tier, starIndex, bodyIndex) {
    const sentName = name || currentName;
    const payload: PoseUpdateRequest = { x, y, angle, username: sentName, sessionId, shape: currentShape, tier, starIndex, bodyIndex, skinId: getActiveSkinId() };
    // Send pose to server via Devvit API route
    fetch('/api/pose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  },
  onClaimPod(podId, isYellow) {
    // Request pod claim from server
    fetch('/api/claim-pod', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ podId, username, isYellow }),
    })
      .then(r => r.json())
      .then((res: ClaimPodResponse) => {
        if (res.success) {
          bridge.setPodCollected(`${res.podId}:${res.mine ? '1' : '0'}`);
        }
      })
      .catch(() => {});
  },
  onFire(projectiles) {
    // Send fired shots to server
    const payload: PostShotsRequest = {
      sessionId,
      shots: projectiles.map(p => ({
        id: p.id,
        origin: p.origin,
        angle: p.angle,
        speed: p.speed,
        spawnTime: Date.now() / 1000,
      })),
    };
    fetch('/api/shots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  },
  onMilestone(event) {
    journeyProgress(event === 'first_move' ? 0.05 : 0.07, event);
  },
});

bridge.setPlayerName(username);
bridge.setShipShape('scout');
bridge.setSharedWorldSeed(postId);
setPostId(postId);
setAllianceUsername(username);
initSkins(proceduralSkin);

// Restore the correct skin object if user previously selected a non-procedural skin
const storedSkinId = getActiveSkinId();
if (storedSkinId === 'scifi') {
  setActiveSkin(scifiSkin);
} else if (storedSkinId === 'raster') {
  setActiveSkin(rasterSkin);
}

// Start rendering immediately (splash/preview mode — no networking yet)
const _tSplash = performance.now();
const _tPageLoad = performance.now();
let _profileProcessed = false;
console.log(`[STARTUP] t=0ms — module init complete, starting splash`);
// Stop the lightweight splash animation before the game engine takes over
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).__stopSplash === 'function') (globalThis as any).__stopSplash();
bridge.beginSplash();
console.log(`[STARTUP] t=${(performance.now() - _tPageLoad).toFixed(0)}ms — beginSplash done in ${(performance.now() - _tSplash).toFixed(0)}ms`);

// Hide loading screen now that splash is rendering (only for inline/play modes which show asteroids)
const _loadingScreen = document.getElementById('loading-screen');
if (_loadingScreen && isInline) _loadingScreen.style.display = 'none';
// In expanded mode (game.html), loading screen stays until startMultiplayer hides it

// Defer heavy asset preloads until after splash is visible (non-blocking)
requestAnimationFrame(() => {
  preloadSounds();
  preloadRasterSprites();
  preloadScifiSprites();
  preloadShipSprites();
  console.log(`[STARTUP] t=${(performance.now() - _tPageLoad).toFixed(0)}ms — deferred preloads queued`);
});

// ── Load user profile from server (deferred until play) ────────────────────
let profileReady: Promise<void> | null = null;

function loadPlayerProfile(): Promise<void> {
  if (profileReady) return profileReady;
  const _tProfile = performance.now();
  console.log(`[STARTUP] t=${(performance.now() - _tPageLoad).toFixed(0)}ms — loadPlayerProfile() starting fetch`);
  profileReady = fetch(`/api/profile?username=${encodeURIComponent(username)}&postId=${encodeURIComponent(postId)}`)
    .then(r => { console.log(`[STARTUP] t=${(performance.now() - _tPageLoad).toFixed(0)}ms — /api/profile response received (${(performance.now() - _tProfile).toFixed(0)}ms)`); return r.json(); })
    .then((profile: PlayerProfileResponse) => {
      console.log(`[STARTUP] t=${(performance.now() - _tPageLoad).toFixed(0)}ms — profile JSON parsed, processing`);
      console.log('[PROFILE] full response:', JSON.stringify({ homeStar: profile.homeStar, lastPosition: profile.lastPosition, discoveredStars: profile.discoveredStars, claimedCount: profile.claimed?.length }));
      if (profile.name) {
        currentName = profile.name;
        bridge.setPlayerName(profile.name);
        const nameInput = document.getElementById('ship-name-input') as HTMLInputElement | null;
        if (nameInput) nameInput.value = profile.name;
      }
      if (profile.homeStar != null) {
        console.log(`[STAR] assigned home star: ${profile.homeStar}`);
        playerHomeStarIndex = profile.homeStar;
        relocateToHomeStar(profile.homeStar);
        journeyProgress(0.10, 'home_star_claimed');
        // Immediately fetch ship shape from home star fleet
        fetch(`/api/ships?username=${encodeURIComponent(username)}&starIndex=${profile.homeStar}`)
          .then(r => r.ok ? r.json() : null)
          .then((data: { ships: Array<{ typeId: number; count: number }> } | null) => {
            if (data) {
              const fleetShape = getFleetShape(data.ships);
              if (fleetShape !== currentShape) {
                currentShape = fleetShape;
                bridge.setShipShape(fleetShape);
                console.log(`[PROFILE] restored ship shape: ${fleetShape}`);
              }
            }
          })
          .catch(() => {});
      }
      // Restore discovered stars BEFORE claims (claims check discoveryLevel)
      if (profile.discoveredStars && profile.discoveredStars.length > 0) {
        console.log(`[PROFILE] restoring ${profile.discoveredStars.length} discovered stars:`, profile.discoveredStars);
        setDiscoveredStars(profile.discoveredStars, profile.enhancedProbeStars);
      } else {
        console.log('[PROFILE] no discoveredStars in profile response');
      }
      // Mark other players' stars as foreign
      if (profile.claimed && profile.claimed.length > 0) {
        console.log(`[PROFILE] setStarClaims: ${profile.claimed.length} claims, usernames: ${profile.claimed.map((c: { starIndex: number; username: string }) => `star${c.starIndex}=${c.username}`).join(', ')}`);
        setStarClaims(profile.claimed, username);
        // Count player's own claims for journey progress
        _claimedStarCount = profile.claimed.filter((c: { username: string }) => c.username.toLowerCase() === username.toLowerCase()).length;
      }
      // Restore last position if different from home star
      if (profile.lastPosition && profile.homeStar != null) {
        const lp = profile.lastPosition;
        console.log(`[PROFILE] lastPosition: star=${lp.starIndex} tier=${lp.tier} body=${lp.bodyIndex}, homeStar=${profile.homeStar}`);
        if (lp.starIndex !== profile.homeStar || lp.tier !== 3 || lp.bodyIndex !== 0) {
          console.log('[PROFILE] restoring position...');
          restorePosition(lp.starIndex, lp.tier, lp.bodyIndex);
        } else {
          console.log('[PROFILE] at default home position, skipping restore');
        }
      } else {
        console.log('[PROFILE] no lastPosition or homeStar');
      }
      // Restore scanned bodies (wireframe → raster state)
      if (profile.scannedBodies && profile.scannedBodies.length > 0) {
        for (const key of profile.scannedBodies) _scannedBodies.add(key);
        console.log(`[PROFILE] restored ${profile.scannedBodies.length} scanned bodies`);
      }
      // Restore wireframe preference from server (syncs across devices)
      if (profile.wireframePref !== undefined) {
        setWireframePref(profile.wireframePref);
        console.log(`[PROFILE] wireframe pref: ${profile.wireframePref}`);
      }
      if (profile.fontScale) {
        setFontScaleByName(profile.fontScale as 'small' | 'medium' | 'large');
        syncFontScaleButtons();
        console.log(`[PROFILE] font scale: ${profile.fontScale}`);
      }
      // New players get the coach marks; the legacy idle hints are for players who
      // have already seen the tutorial and have stalled without doing anything.
      if (profile.journeyDone || profile.lastPosition) {
        startJourney();
        journeyStart(); // always start a telemetry journey so progress events have a journeyId
        journeyProgress(0.01, 'returned_player');
      } else {
        skipJourney();
        startCoach();
        journeyStart();
        journeyProgress(0.01, 'game_start');
      }
      // Resume an interrupted coach sequence regardless of returning-player status
      if (profile.coachStep && profile.coachStep !== 'done') {
        restoreCoach(profile.coachStep, profile.coachSkipped === true);
      }
      // Show/hide debug UI based on server dev mode flag
      const debugDisplay = profile.devMode ? '' : 'none';
      for (const id of ['debug-copy', 'debug-log', 'debug-force-save', 'debug-check-redis', 'debug-toggle']) {
        document.getElementById(id)?.style.setProperty('display', debugDisplay);
      }
      console.log(`[STARTUP] t=${(performance.now() - _tPageLoad).toFixed(0)}ms — profile processing complete`);
      _profileProcessed = true;
    })
    .catch((err) => {
      console.error(`[STARTUP] t=${(performance.now() - _tPageLoad).toFixed(0)}ms — profile load error:`, err);
      _profileProcessed = true;
    });
  
  return profileReady;
}

// ── Realtime ghost updates (poll for now, replace with SSE/WS later) ────────
let ghostPollInterval: ReturnType<typeof setInterval> | null = null;
let shotPollInterval: ReturnType<typeof setInterval> | null = null;
let economyPollInterval: ReturnType<typeof setInterval> | null = null;
let ghostListInterval: ReturnType<typeof setInterval> | null = null;
let _savePositionInterval: ReturnType<typeof setInterval> | null = null;

async function pollGhosts() {
  try {
    const gs = getGameState();
    const tier = gs?.galaxy.tier ?? 0;
    const starIndex = gs?.galaxy.currentStarIndex ?? -1;
    const bodyIndex = gs?.galaxy.currentBodyIndex ?? -1;
    const res = await fetch(`/api/room-poses?postId=${encodeURIComponent(postId)}&exclude=${encodeURIComponent(sessionId)}&tier=${tier}&starIndex=${starIndex}&bodyIndex=${bodyIndex}`);
    if (res.ok) {
      const data = await res.json() as RoomPosesResponse;
      if (data.items) {
        // Map server response to RemotePoseItem format
        const mapped = data.items.map((item, i) => ({
          slot: i + 1,
          name: item.username,
          shape: item.shape || 'scout',
          x: item.x,
          y: item.y,
          a: item.angle,
          skinId: item.skinId,
        }));
        bridge.setRemotePoses(JSON.stringify({ items: mapped }));
      }
    }
  } catch (_e) {
    // ignore network errors
  }
}

// ── Shot polling (piggyback on same interval) ───────────────────────────────
async function pollShots() {
  try {
    const res = await fetch(`/api/shots?postId=${encodeURIComponent(postId)}&exclude=${encodeURIComponent(sessionId)}`);
    if (res.ok) {
      const data = await res.json() as ShotsResponse;
      if (data.shots && data.shots.length) {
        bridge.addRemoteShots(JSON.stringify(data));
      }
    }
  } catch (_e) {
    // ignore
  }
}

// ── Coms Polling ────────────────────────────────────────────────────────────

async function pollComsUnread() {
  try {
    const res = await fetch(`/api/coms/unread?username=${encodeURIComponent(username)}`);
    if (res.ok) {
      const data = await res.json() as ComsUnreadResponse;
      setComsUnread(data.count);
    }
  } catch (_e) { /* ignore */ }
}

async function markComsRead() {
  try {
    await fetch(`/api/coms/mark-read?username=${encodeURIComponent(username)}`, { method: 'POST' });
    clearComsUnread();
  } catch (_e) { /* ignore */ }
}

// Poll coms: fast detection (2s), rate-limited fetches
let _lastComsOpen = false;
let _lastDMPeer: string | null = null;
let _lastDMFetchMs = 0;
let _lastPublicFetchMs = 0;
let _lastUnreadFetchMs = 0;
let _prevDMUnreadCount = 0;
let _prevAllianceChatCount = 0;
const DM_POLL_INTERVAL = 10_000;      // 10s between DM message fetches
const PUBLIC_POLL_INTERVAL = 10_000;  // 10s between public comment fetches
const UNREAD_POLL_INTERVAL = 30_000;  // 30s between unread checks

function pollComsLoop() {
  const now = Date.now();
  const panelOpen = isComsPanelOpen();

  if (panelOpen && !_lastComsOpen) {
    // Panel just opened — immediate load
    setKnownPlayers(getKnownPlayers());
    void pollDMUnread();
    void markComsRead();
    void pollPublicComments();
    void pollAllianceInfo();
    void pollAllianceInvites();
    _lastUnreadFetchMs = now;
    _lastPublicFetchMs = now;
    _lastAllianceFetchMs = now;
    _lastAllianceInviteFetchMs = now;
  } else if (panelOpen) {
    // Panel staying open — rate-limited fetches
    const tab = getComsTab();

    // Always check pending sends regardless of active tab
    const send = consumePendingDMSend();
    if (send) {
      void sendDM(send.to, send.text);
    }
    const dmReport = consumePendingDMReport();
    if (dmReport) {
      void reportDM(dmReport.messageId, dmReport.from, dmReport.body);
    }
    const post = consumePendingPublicPost();
    if (post) {
      void postPublicComment(post.text, post.parentId);
    }

    if (tab === 'private') {
      const peer = getDMPeer();
      if (peer) {
        if (peer !== _lastDMPeer) {
          // Peer changed — fetch immediately
          void pollDMMessages(peer);
          void markDMRead(peer);
          _lastDMFetchMs = now;
        } else if (now - _lastDMFetchMs > DM_POLL_INTERVAL) {
          void pollDMMessages(peer);
          _lastDMFetchMs = now;
        }
      }
      _lastDMPeer = peer;
      // Refresh known players (local, no network)
      setKnownPlayers(getKnownPlayers());
      // Rate-limited unread check
      if (now - _lastUnreadFetchMs > UNREAD_POLL_INTERVAL) {
        void pollDMUnread();
        _lastUnreadFetchMs = now;
      }
    } else if (tab === 'public') {
      // PUBLIC tab — rate-limited fetch
      if (now - _lastPublicFetchMs > PUBLIC_POLL_INTERVAL) {
        void pollPublicComments();
        _lastPublicFetchMs = now;
      }
    } else if (tab === 'alliance') {
      // ALLIANCE tab — process actions & rate-limited fetches
      processAllianceActions();
      processBotTest();
      processBotAdminTest();
      processBotCheck();
      processBotCopy();
      setKnownPlayers(getKnownPlayers());
      if (now - _lastAllianceFetchMs > ALLIANCE_INFO_INTERVAL) {
        void pollAllianceInfo();
        _lastAllianceFetchMs = now;
      }
      if (now - _lastAllianceInviteFetchMs > ALLIANCE_INVITE_INTERVAL) {
        void pollAllianceInvites();
        _lastAllianceInviteFetchMs = now;
      }
      const view = getAllianceView();
      if (view === 'chat' && now - _lastAllianceChatFetchMs > ALLIANCE_CHAT_INTERVAL) {
        void pollAllianceChat();
        _lastAllianceChatFetchMs = now;
      }
    } else if (tab === 'board') {
      // BOARD tab — rate-limited leaderboard fetch
      if (consumePendingSeedBots()) {
        void seedBots();
      }
      if (now - _lastLeaderboardFetchMs > LEADERBOARD_POLL_INTERVAL) {
        void pollLeaderboard();
        _lastLeaderboardFetchMs = now;
      }
    }
  } else {
    // Panel closed — rate-limited unread check
    if (now - _lastUnreadFetchMs > UNREAD_POLL_INTERVAL) {
      void pollDMUnread();
      _lastUnreadFetchMs = now;
    }
    _lastDMPeer = null;
  }
  _lastComsOpen = panelOpen;
}

async function pollDMUnread() {
  try {
    const res = await fetch(`/api/coms/dm/unread?username=${encodeURIComponent(username)}`);
    if (res.ok) {
      const data = await res.json() as DMUnreadResponse;
      // Play sound if new unread DMs arrived while panel is closed
      if (!isComsPanelOpen() && data.unreadFrom.length > _prevDMUnreadCount) {
        playSound('new_comm');
      }
      _prevDMUnreadCount = data.unreadFrom.length;
      setDMUnread(data.unreadFrom);
      // Auto-add Fleet Command as a contact if they have unread messages
      if (data.unreadFrom.some((f: string) => f.toLowerCase() === FLEET_COMMAND_SENDER.toLowerCase())) {
        addKnownPlayer(FLEET_COMMAND_SENDER);
      }
    }
  } catch (_e) { /* ignore */ }
}

async function pollDMMessages(peer: string) {
  try {
    const res = await fetch(`/api/coms/dm/messages?username=${encodeURIComponent(username)}&peer=${encodeURIComponent(peer)}`);
    if (res.ok) {
      const data = await res.json() as DMListResponse;
      setDMMessages(data.messages);
    }
  } catch (_e) { /* ignore */ }
}

async function markDMRead(peer: string) {
  try {
    await fetch(`/api/coms/dm/mark-read?username=${encodeURIComponent(username)}&peer=${encodeURIComponent(peer)}`, { method: 'POST' });
  } catch (_e) { /* ignore */ }
}

async function sendDM(to: string, text: string) {
  try {
    await fetch('/api/coms/dm/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: username, to, text }),
    });
    // Refresh messages after sending
    void pollDMMessages(to);
  } catch (_e) { /* ignore */ }
}

async function reportDM(messageId: string, reportedUsername: string, messageBody: string) {
  try {
    const res = await fetch('/api/coms/dm/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, reporterUsername: username, reportedUsername, messageBody }),
    });
    if (res.ok) {
      console.log('[DM] Report submitted for message:', messageId);
      showDMReportConfirm();
    } else {
      console.warn('[DM] Report failed:', await res.text());
    }
  } catch (e) {
    console.warn('[DM] Report error:', e);
  }
}

// ── Public Comments ─────────────────────────────────────────────────────────

async function pollPublicComments() {
  try {
    const res = await fetch('/api/coms/public/messages');
    if (res.ok) {
      const data = await res.json() as PublicCommentsResponse;
      setPublicComments(data.comments);
    }
  } catch (_e) { /* ignore */ }
}

async function postPublicComment(text: string, parentId?: string) {
  try {
    const res = await fetch('/api/coms/public/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, parentId, username }),
    });
    await res.json(); // consume response
    // Refresh comments after posting (immediate + delayed for Reddit API cache)
    void pollPublicComments();
    setTimeout(() => void pollPublicComments(), 3000);
    setTimeout(() => void pollPublicComments(), 6000);
  } catch (_e) { /* ignore */ }
}

async function shareFleet() {
  try {
    const res = await fetch('/api/share/fleet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    if (res.ok) {
      setFleetShareCooldown(300_000); // 5 min cooldown
    }
  } catch (_e) { /* ignore */ }
}

async function explorePlanet(starIndex: number, bodyIndex: number, isStation: boolean) {
  try {
    const res = await fetch('/api/explore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, starIndex, bodyIndex, isStation }),
    });
    if (res.ok) {
      const data = await res.json() as { explored: boolean; result: { kind: string; label: string; icon: string; amount: number }; buff?: { buffId: string; expiresAt: number; grantedAt: number; starIndex: number } };
      showExploreResult(data.result.kind, data.result.label, data.result.icon, data.result.amount);
      journeyAction('explore');
      // Mark body as scanned — unlocks raster visuals
      // Station scan reveals features only; planet scan reveals planet surface only
      markBodyScanned(starIndex, bodyIndex, isStation ? 'f' : 'p');
      const kind = data.result.kind;
      if (kind === 'nothing') {
        playSound(isStation ? 'scan_nothing_station' : 'scan_nothing_planet');
      } else if (kind === 'blueprint') {
        playSound('scan_blueprint');
      } else if (kind === 'artifact') {
        playSound('scan_artifact');
      } else if (kind === 'anomaly') {
        playSound('scan_anomaly');
        // Play buff activation sound after anomaly sound
        if (data.buff) {
          setTimeout(() => {
            const buffSound = `buff_${data.buff!.buffId}` as Parameters<typeof playSound>[0];
            playSound(buffSound);
          }, 2000);
          // Store active buff locally for HUD
          _activeBuffs.push(data.buff);
        }
      } else if (kind === 'ore') {
        playSound('scan_ore');
        journeyProgress(0.12, 'first_resource_collected');
      } else if (kind === 'food') {
        playSound('scan_food');
        journeyProgress(0.12, 'first_resource_collected');
      } else if (kind === 'energy') {
        playSound('scan_energy');
        journeyProgress(0.12, 'first_resource_collected');
      } else if (kind === 'fuel') {
        playSound('scan_fuel');
        journeyProgress(0.12, 'first_resource_collected');
      }
    }
  } catch (_e) { /* ignore */ }
}

// ── Alliance ────────────────────────────────────────────────────────────────

let _lastAllianceFetchMs = 0;
let _lastAllianceChatFetchMs = 0;
let _lastAllianceInviteFetchMs = 0;
const ALLIANCE_INFO_INTERVAL = 15_000;   // 15s
const ALLIANCE_CHAT_INTERVAL = 5_000;    // 5s
const ALLIANCE_INVITE_INTERVAL = 30_000; // 30s

let _lastLeaderboardFetchMs = 0;
const LEADERBOARD_POLL_INTERVAL = 30_000; // 30s

async function pollLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    if (res.ok) {
      const data = await res.json() as import('../shared/api').LeaderboardResponse;
      setLeaderboardData(data.players);
    }
  } catch (_e) { /* ignore */ }
}

async function seedBots() {
  try {
    await fetch('/api/bots/seed-bots', { method: 'POST' });
    // Re-poll leaderboard after seeding
    await pollLeaderboard();
  } catch (_e) { /* ignore */ }
}

async function pollAllianceInfo() {
  try {
    const res = await fetch(`/api/alliance/info?username=${encodeURIComponent(username)}`);
    if (res.ok) {
      const data = await res.json() as AllianceInfoResponse;
      setAllianceInfo(data.alliance);
    }
  } catch (_e) { /* ignore */ }
}

async function pollAllianceChat() {
  try {
    const res = await fetch(`/api/alliance/chat?username=${encodeURIComponent(username)}`);
    if (res.ok) {
      const data = await res.json() as AllianceChatResponse;
      // Play sound if new alliance messages arrived (not from self)
      if (data.messages.length > _prevAllianceChatCount && _prevAllianceChatCount > 0) {
        const newest = data.messages[data.messages.length - 1];
        if (newest && newest.from !== username) {
          playSound('fleet_command');
        }
      }
      _prevAllianceChatCount = data.messages.length;
      setAllianceChat(data.messages);
    }
  } catch (_e) { /* ignore */ }
}

// ── Sensor Alerts ─────────────────────────────────────────────────────────────

async function pollSensorAlerts() {
  try {
    const res = await fetch(`/api/sensors?username=${encodeURIComponent(username)}`);
    if (res.ok) {
      const data = await res.json() as { alerts: Array<{ type: string; starIndex: number; from: string; ts: number }> };
      let hadAlert = false;
      for (const alert of data.alerts) {
        console.log(`[SENSOR] type=${alert.type} star=${alert.starIndex} from=${alert.from} age=${Math.round((Date.now() - alert.ts) / 1000)}s`);
        if (alert.type === 'raider') {
          playSound('raid_incoming');
          hadAlert = true;
        } else if (alert.type === 'unidentified') {
          playSound('unidentified_ship');
          hadAlert = true;
        }
      }
      // Refresh foreign fleet immediately so the probe/raider icon appears with the sound
      if (hadAlert) {
        void refreshForeignFleet();
      }
    }
  } catch (_e) { /* ignore */ }
}

async function refreshForeignFleet() {
  try {
    const foreignRes = await fetch(`/api/fleet/foreign?postId=${encodeURIComponent(postId)}&username=${encodeURIComponent(username)}`);
    if (foreignRes.ok) {
      const foreignData = await foreignRes.json() as { stars: Record<string, { owner: string; ships: Array<{ typeId: number; count: number }>; skinId?: string }> };
      setForeignFleet(foreignData.stars);
      const gs = getGameState();
      if (gs) {
        for (const [key, val] of Object.entries(foreignData.stars)) {
          const idx = parseInt(key.replace('s:', ''), 10);
          if (!Number.isNaN(idx) && gs.galaxy.stars[idx]) {
            const star = gs.galaxy.stars[idx];
            // Never override player's own stars with foreign ownership
            if (star.owner === 'player' || idx === gs.galaxy.homeStarIndex) continue;
            // Always store claimedBy so economy poll uses correct owner
            star.claimedBy = val.owner;
            if (star.discoveryLevel !== 'none') {
              star.owner = 'foreign';
              if (star.discoveryLevel === 'visited') {
                addKnownPlayer(val.owner);
              }
            }
          }
        }
      }
    }
  } catch (_e) { /* ignore */ }
}

async function pollAllianceInvites() {
  try {
    const res = await fetch(`/api/alliance/invites?username=${encodeURIComponent(username)}`);
    if (res.ok) {
      const data = await res.json() as AllianceInvitesResponse;
      setAllianceInvites(data.invites);
    }
  } catch (_e) { /* ignore */ }
}

async function createAlliance(name: string) {
  try {
    await fetch('/api/alliance/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, name }),
    });
    void pollAllianceInfo();
  } catch (_e) { /* ignore */ }
}

async function inviteToAlliance(target: string) {
  try {
    await fetch('/api/alliance/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, target }),
    });
  } catch (_e) { /* ignore */ }
}

async function respondToInvite(allianceId: string, accept: boolean) {
  try {
    await fetch('/api/alliance/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, allianceId, accept }),
    });
    if (accept) journeyProgress(0.90, 'alliance_joined');
    void pollAllianceInfo();
    void pollAllianceInvites();
  } catch (_e) { /* ignore */ }
}

async function leaveAlliance() {
  try {
    await fetch('/api/alliance/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    void pollAllianceInfo();
  } catch (_e) { /* ignore */ }
}

async function kickAllianceMember(target: string) {
  try {
    await fetch('/api/alliance/kick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, target }),
    });
    void pollAllianceInfo();
  } catch (_e) { /* ignore */ }
}

async function sendAllianceChat(text: string) {
  try {
    await fetch('/api/alliance/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, text }),
    });
    void pollAllianceChat();
  } catch (_e) { /* ignore */ }
}

function processAllianceActions() {
  const action = consumeAllianceAction();
  if (!action) return;
  switch (action.type) {
    case 'create':
      if (action.name) void createAlliance(action.name);
      break;
    case 'invite':
      if (action.target) void inviteToAlliance(action.target);
      break;
    case 'join':
      if (action.allianceId) void respondToInvite(action.allianceId, true);
      break;
    case 'reject':
      if (action.allianceId) void respondToInvite(action.allianceId, false);
      break;
    case 'leave':
      void leaveAlliance();
      break;
    case 'kick':
      if (action.target) void kickAllianceMember(action.target);
      break;
    case 'chat':
      if (action.text) void sendAllianceChat(action.text);
      break;
  }
}

function processBotTest() {
  if (!consumePendingBotTest()) return;
  void runBotEndpoint('/api/bots/test');
}

function processBotAdminTest() {
  if (!consumePendingBotAdminTest()) return;
  void runBotEndpoint('/api/bots/test-admin', { username });
}

function processBotCheck() {
  if (!consumePendingBotCheck()) return;
  void runBotEndpoint('/api/bots/test-check');
}

async function runBotEndpoint(url: string, body?: Record<string, string>) {
  try {
    console.log(`[BOT-TEST] Calling ${url}...`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json() as { ok: boolean; log: string[] };
    const logText = data.log.join('\n');
    setBotTestLog(logText);
    console.log(`[BOT-TEST] Result:\n${logText}`);
  } catch (e) {
    const errMsg = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    setBotTestLog(errMsg);
    console.error('[BOT-TEST] Failed:', e);
  }
}

function processBotCopy() {
  const log = consumePendingBotCopy();
  if (!log) return;
  void navigator.clipboard.writeText(log).then(() => {
    console.log('[BOT-TEST] Log copied to clipboard');
  });
}

let _pollEconomyRunning = false;
async function pollEconomy() {
  if (_pollEconomyRunning || _resetPerformed) return; // prevent re-entrancy / overlapping polls
  _pollEconomyRunning = true;
  // Piggyback bot tick (server self-limits to once per 10s)
  void fetch('/api/bots/tick', { method: 'POST' }).catch(() => {});

  try {
    const gs = getGameState();
    if (!gs) return;

    // At galaxy tier, poll all fleets instead of single-star economy
    if (gs.galaxy.tier === 0) { // NavigationTier.Galaxy = 0
      // Process pending fleet transfers
      const transfer = consumePendingTransfer();
      if (transfer) {
        // Freighter (typeId 2) → create a persistent trade route instead of one-time transfer
        if (transfer.shipTypeId === 2) {
          try {
            const routeRes = await fetch('/api/fleet/freighter-route', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username,
                homeStarIndex: transfer.fromStarIndex,
                targetStarIndex: transfer.toStarIndex,
              }),
            });
            if (!routeRes.ok) {
              const err = await routeRes.json().catch(() => ({ message: 'unknown' }));
              console.warn('[FLEET] freighter route failed:', err);
            } else {
              playSound('send');
            }
          } catch (e) {
            console.warn('[FLEET] freighter route error:', e);
          }
        } else if (transfer.shipTypeId === 15) {
          // Raider (typeId 15) → create a raid route to enemy star
          try {
            const raidRes = await fetch('/api/fleet/raid-route', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username,
                homeStarIndex: transfer.fromStarIndex,
                targetStarIndex: transfer.toStarIndex,
              }),
            });
            if (!raidRes.ok) {
              const err = await raidRes.json().catch(() => ({ message: 'unknown' }));
              console.warn('[FLEET] raid route failed:', err);
            } else {
              playSound('raid_launched');
              journeyAction('raid');
            }
          } catch (e) {
            console.warn('[FLEET] raid route error:', e);
          }
        } else {
          // Optimistic base-fuel deduction for probes (server enforces the real cost)
          if (transfer.shipTypeId === 11 || transfer.shipTypeId === 12) {
            deductBaseFuel(transfer.fromStarIndex, PROBE_MIN_FUEL_COST);
            console.log(`[PROBE] optimistic base fuel deduct: ${PROBE_MIN_FUEL_COST} from star ${transfer.fromStarIndex}`);
          }
          try {
            const transferRes = await fetch('/api/fleet/transfer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username,
                fromStarIndex: transfer.fromStarIndex,
                toStarIndex: transfer.toStarIndex,
                shipTypeId: transfer.shipTypeId,
                count: transfer.count,
              }),
            });
            if (!transferRes.ok) {
              const err = await transferRes.json().catch(() => ({ message: 'unknown' }));
              console.warn('[FLEET] transfer failed:', err);
            } else {
              playSound('send');
              journeyAction('transfer');
              journeyProgress(0.35, 'first_transfer');
            }
          } catch (e) {
            console.warn('[FLEET] transfer error:', e);
          }
        }
      }

      // Process pending cancel route
      const cancelRouteId = consumePendingCancelRoute();
      if (cancelRouteId) {
        try {
          await fetch('/api/fleet/freighter-route', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, routeId: cancelRouteId }),
          });
        } catch (e) {
          console.warn('[FLEET] cancel route error:', e);
        }
      }

      // Process pending fleet share (POST button)
      if (consumePendingFleetShare()) {
        void shareFleet();
      }

      try {
        const fleetRes = await fetch(`/api/fleet/all?username=${encodeURIComponent(username)}`);
        if (fleetRes.ok) {
          const fleetData = await fleetRes.json() as FleetAllResponse;
          setServerFleetAll(fleetData.stars, fleetData.transits, fleetData.freighterRoutes, fleetData.raidRoutes);
          // Mark discovered stars from server (probes consumed on arrival)
          if (fleetData.discoveredStars && fleetData.discoveredStars.length > 0) {
            const gs2 = getGameState();
            if (gs2) {
              const enhancedSet = new Set(fleetData.enhancedProbeStars ?? []);
              let newDiscovery = false;
              for (const si of fleetData.discoveredStars) {
                const star = gs2.galaxy.stars[si];
                if (star && star.discoveryLevel === 'none') {
                  star.discoveryLevel = enhancedSet.has(si) ? 'visited' : 'probed';
                  star.discovered = true;
                  newDiscovery = true;
                }
              }
              if (newDiscovery) playSound('arrive');
            }
          }
          // Update ship shape from home star fleet
          if (playerHomeStarIndex != null) {
            const homeKey = `s:${playerHomeStarIndex}`;
            const homeFleet = fleetData.stars[homeKey];
            if (homeFleet) {
              const fleetShape = getFleetShape(homeFleet.ships);
              if (fleetShape !== currentShape) {
                currentShape = fleetShape;
                bridge.setShipShape(fleetShape);
              }
            }
          }
        }
      } catch (_e) { /* ignore */ }

      // Fetch foreign fleet data for red badges
      try {
        const foreignRes = await fetch(`/api/fleet/foreign?postId=${encodeURIComponent(postId)}&username=${encodeURIComponent(username)}`);
        if (foreignRes.ok) {
          const foreignData = await foreignRes.json() as { stars: Record<string, { owner: string; ships: Array<{ typeId: number; count: number }>; skinId?: string }> };
          setForeignFleet(foreignData.stars);
          // Also mark these stars as foreign-owned in game state
          const gs2 = getGameState();
          if (gs2) {
            for (const [key, val] of Object.entries(foreignData.stars)) {
              const idx = parseInt(key.replace('s:', ''), 10);
              if (!Number.isNaN(idx) && gs2.galaxy.stars[idx]) {
                const star = gs2.galaxy.stars[idx];
                // Never override player's own stars with foreign ownership
                if (star.owner === 'player' || idx === gs2.galaxy.homeStarIndex) continue;
                // Always store claimedBy so economy poll uses correct owner
                star.claimedBy = val.owner;
                if (star.discoveryLevel !== 'none') {
                  star.owner = 'foreign';
                  if (star.discoveryLevel === 'visited') {
                    addKnownPlayer(val.owner);
                  }
                }
              }
            }
          }
        }
      } catch (_e) { /* ignore */ }
      return;
    }

    const starIndex = gs.galaxy.currentStarIndex;
    if (starIndex < 0) return;

    // Process pending planet exploration (SCAN button)
    const exploreReq = consumePendingExplore();
    if (exploreReq) {
      const gs = getGameState();
      const isStation = gs?.dock?.targetType === 'feature';
      void explorePlanet(exploreReq.starIndex, exploreReq.bodyIndex, isStation);
    }

    // Process pending video play from coms
    const videoId = consumePendingVideoPlay();
    if (videoId) {
      const entry = VIDEO_CATALOG[videoId];
      const vOverlay = document.getElementById('video-overlay');
      const vPlayer = document.getElementById('video-player') as HTMLVideoElement | null;
      if (entry && vOverlay && vPlayer) {
        vPlayer.src = entry.path;
        vPlayer.currentTime = 0;
        vOverlay.style.display = 'flex';
        vPlayer.play().catch(() => {});
      }
    }

    // Process pending trade
    const pendingTrade = consumePendingTrade();
    if (pendingTrade) {
      try {
        const tradeRes = await fetch('/api/trade-station/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            starIndex,
            giveType: pendingTrade.giveType,
            receiveType: pendingTrade.receiveType,
            giveAmount: 50,
          }),
        });
        if (tradeRes.ok) {
          if (!hasTraded) { playSound('freighter_unloading'); hasTraded = true; }
          journeyAction('trade');
          // Refresh trade station info
          const refreshRes = await fetch(`/api/trade-station?postId=${encodeURIComponent(postId)}&starIndex=${starIndex}`);
          if (refreshRes.ok) {
            const tradeData = await refreshRes.json() as TradeStationInfoResponse;
            setTradeStationInfo(tradeData);
          }
        } else {
          const err = await tradeRes.json().catch(() => ({ message: 'unknown' }));
          console.warn('[TRADE] failed:', err);
          playSound('insufficient_resources');
        }
      } catch (e) {
        console.warn('[TRADE] error:', e);
        playSound('fuel_critical');
      }
    }

    // Process colonize request
    const pendingColonize = consumePendingColonizeRequest();
    if (pendingColonize) {
      try {
        const colonizeRes = await fetch('/api/colonize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            postId,
            starIndex: pendingColonize.starIndex,
            bodyIndex: pendingColonize.bodyIndex,
          }),
        });
        if (colonizeRes.ok) {
          // Regenerate system with station, mark star owned
          onColonizeSuccess(pendingColonize.starIndex, pendingColonize.bodyIndex);
          // Remove colony ship from local fleet display
          setServerShipState(pendingColonize.starIndex,
            [], // server consumed the colony ship; next fleet poll will refresh
            null,
          );
          playSound('colony_established');
          console.log('[COLONIZE] Success! Star colonized:', pendingColonize.starIndex, 'body:', pendingColonize.bodyIndex);
          journeyAction('colonize');
          _claimedStarCount++;
          checkJourneyProgress('colonize');
        } else {
          const err = await colonizeRes.json().catch(() => ({ message: 'unknown' }));
          console.warn('[COLONIZE] failed:', err);
        }
      } catch (e) {
        console.warn('[COLONIZE] error:', e);
      }
    }

    const pendingBuild = consumePendingBuildRequest();
    if (pendingBuild) {
      const payload: BuildBuildingRequest = {
        username,
        starIndex,
        buildType: pendingBuild.buildType,
        ...(pendingBuild.skinId ? { skinId: pendingBuild.skinId } : {}),
      };
      console.log('[BUILD] sending build request, starIndex=', starIndex, 'type=', pendingBuild.buildType);
      try {
        const buildRes = await fetch('/api/buildings/buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (buildRes.ok) {
          console.log('[BUILD] build success');
          playSound('begin_building_facility');
          setBuildCooldown(); // Disable buttons until next economy poll confirms state
          journeyAction('build');
          journeyProgress(0.15, 'first_building');
          journeyProgress(0.15, 'first_upgrade');
          if (pendingBuild.buildType === 'dock') journeyProgress(0.25, 'dock_upgraded');
          showFeedbackButton();
        } else {
          const errData = await buildRes.json().catch(() => ({ message: 'Build failed' })) as { message?: string };
          const reason = (errData.message ?? 'Build failed').toLowerCase();
          console.warn('[BUILD] build failed:', reason);
          if (reason.includes('insufficient') || reason.includes('resource') || reason.includes('afford')) {
            playSound('upgrade_failed');
            showBuildError('NEED MORE RESOURCES');
          } else if (reason.includes('already') || reason.includes('upgrading')) {
            playSound('upgrade_in_progress');
            showBuildError('ALREADY UPGRADING');
          } else if (reason.includes('max') || reason.includes('level')) {
            playSound('max_level_reached');
            showBuildError('MAX LEVEL REACHED');
          } else {
            playSound('upgrade_failed');
            showBuildError('BUILD FAILED: ' + (errData.message ?? 'Unknown error').toUpperCase());
          }
        }
      } catch (_e) { /* ignore */ }
    }
    const pendingRefuel = consumePendingRefuel();
    if (pendingRefuel) {
      void fetch('/api/refuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, starIndex: pendingRefuel.starIndex, amount: pendingRefuel.amount }),
      }).catch(() => {});
    }
    const pendingShieldToggle = consumePendingToggleShield();
    if (pendingShieldToggle) {
      const charging = getShieldCharging();
      const raising = charging?.raising ?? true;
      console.log('[SHIELD] charge complete, firing server toggle, starIndex=', starIndex, 'raising=', raising);
      try {
        const shieldRes = await fetch('/api/buildings/toggle-shield', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, starIndex }),
        });
        if (shieldRes.ok) {
          const data = await shieldRes.json();
          console.log('[SHIELD] toggle success, raised=', data.shieldRaised);
          playSound(raising ? 'shields_up' : 'shields_down');
        } else {
          console.warn('[SHIELD] toggle failed');
          playSound('low_fuel');
        }
      } catch (_e) { /* ignore */ }
      clearShieldCharging();
    }
    const pendingShip = consumePendingBuyShipRequest();
    if (pendingShip) {
      console.log('[SHIPS] sending buy request, starIndex=', starIndex, 'shipTypeId=', pendingShip.shipTypeId, 'useBlueprint=', pendingShip.useBlueprint);
      try {
        const shipRes = await fetch('/api/ships/buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            starIndex,
            shipTypeId: pendingShip.shipTypeId,
            quantity: pendingShip.quantity,
            ...(pendingShip.useBlueprint ? { useBlueprint: true } : {}),
          }),
        });
        if (shipRes.ok) {
          console.log('[SHIPS] buy success');
          if (pendingShip.shipTypeId === 11) colonizationTopicAction('probe_built');
          if (pendingShip.shipTypeId === 8) colonizationTopicAction('colony_built');
          playSound('begin_building_ship');
          journeyAction('buy_ship');
          journeyProgress(0.20, 'first_ship_built');
          journeyProgress(0.50, 'ship_upgraded');
        } else {
          const err = await shipRes.json().catch(() => ({ message: 'unknown' }));
          console.warn('[SHIPS] buy failed:', err);
          const msg = String((err as Record<string, unknown>)?.message ?? '');
          if (msg.includes('Insufficient')) playSound('insufficient_resources');
          else if (msg.includes('Dock level') || msg.includes('dock')) playSound('dock_low');
          else playSound('fuel_critical');
        }
      } catch (e) {
        console.warn('[SHIPS] buy error:', e);
      }
    }
    const pendingUpgrade = consumePendingUpgradeShipRequest();
    if (pendingUpgrade) {
      console.log('[SHIPS] sending upgrade request, starIndex=', starIndex, 'fromTypeId=', pendingUpgrade.fromTypeId, 'useBlueprint=', pendingUpgrade.useBlueprint);
      try {
        const upgradeRes = await fetch('/api/ships/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            starIndex,
            fromTypeId: pendingUpgrade.fromTypeId,
            ...(pendingUpgrade.useBlueprint ? { useBlueprint: true } : {}),
          }),
        });
        if (upgradeRes.ok) {
          console.log('[SHIPS] upgrade success');
          playSound('begin_ship_upgrade');
          journeyProgress(0.50, 'ship_upgraded');
        } else {
          const err = await upgradeRes.json().catch(() => ({ message: 'unknown' }));
          console.warn('[SHIPS] upgrade failed:', err);
          const msg = String((err as Record<string, unknown>)?.message ?? '');
          if (msg.includes('Insufficient')) playSound('insufficient_resources');
          else if (msg.includes('Dock level')) playSound('dock_low');
          else playSound('fuel_critical');
        }
      } catch (e) {
        console.warn('[SHIPS] upgrade error:', e);
        playSound('fuel_critical');
      }
    }
    if (consumePendingCompleteBuilds()) {
      try {
        const isAdm = ['weirdad4511', 'fred'].includes(username.toLowerCase());
        const endpoint = isAdm ? '/api/debug/complete-builds' : '/api/complete-builds';
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, starIndex }),
        });
      } catch (e) {
        console.warn('[COMPLETE] complete-builds error:', e);
      }
    }
    // Use star owner's username for foreign stars so we load their economy/ships.
    // Check claimedBy directly — it's set even before owner is marked 'foreign'
    // (covers the case where player navigates to a star before claims are visually applied).
    const viewedStar = gs.galaxy.stars[starIndex];
    const isHomeStar = starIndex === gs.galaxy.homeStarIndex;
    // Never load foreign economy for our own home star (bots visiting shouldn't override)
    const econUsername = (!isHomeStar && viewedStar?.owner !== 'player' && viewedStar?.claimedBy) ? viewedStar.claimedBy : username;
    console.log(`[ECON-POLL] star=${starIndex} owner=${viewedStar?.owner} claimedBy=${viewedStar?.claimedBy} econUser=${econUsername} myUser=${username} isHome=${isHomeStar}`);
    const _tBldg = performance.now();
    let buildingsUrl = `/api/buildings?username=${encodeURIComponent(econUsername)}&starIndex=${starIndex}`;
    // Send our active skin when polling our own star so the server saves it as preferredSkinId
    if (econUsername === username) {
      buildingsUrl += `&skinId=${encodeURIComponent(getActiveSkinId())}`;
    }
    const res = await fetch(buildingsUrl);
    console.log(`[PERF] /api/buildings fetch in ${(performance.now() - _tBldg).toFixed(0)}ms`);
    if (!res.ok) return;
    const data = await res.json() as StarEconomyResponse;
    setServerStarEconomy({
      starIndex: data.starIndex,
      store: data.store,
      rates: data.rates,
      cap: data.cap,
      shieldRaised: data.shieldRaised ?? false,
      defenseScore: data.defenseScore ?? { shield: 0, cannon: 0, total: 0 },
      buildings: data.buildings,
      completeCharges: data.completeCharges ?? 0,
      ...(data.richness ? { richness: data.richness } : {}),
    }, econUsername === username);
    // Track economy for journey progress calculation
    if (econUsername === username && data.buildings) {
      _lastEconomyData.set(data.starIndex, { buildings: data.buildings as Record<string, { level?: number }> });
      checkJourneyProgress('economy_update');
    }
    // Sync active buffs from server
    if (data.buffs) {
      _activeBuffs.length = 0;
      _activeBuffs.push(...data.buffs);
    }
    // Poll ship state
    const _tShips = performance.now();
    const shipsRes = await fetch(`/api/ships?username=${encodeURIComponent(econUsername)}&starIndex=${starIndex}`);
    console.log(`[PERF] /api/ships fetch in ${(performance.now() - _tShips).toFixed(0)}ms`);
    if (shipsRes.ok) {
      const shipsData = await shipsRes.json() as StarShipsResponse;
      setServerShipState(starIndex, shipsData.ships, shipsData.building, econUsername === username);
      // Update ship shape based on HOME star fleet only
      if (starIndex === playerHomeStarIndex) {
        const fleetShape = getFleetShape(shipsData.ships);
        if (fleetShape !== currentShape) {
          currentShape = fleetShape;
          bridge.setShipShape(fleetShape);
        }
      }
    }
    // If at a different star, also poll home star for ship shape
    if (playerHomeStarIndex != null && starIndex !== playerHomeStarIndex) {
      try {
        const homeShipsRes = await fetch(`/api/ships?username=${encodeURIComponent(username)}&starIndex=${playerHomeStarIndex}`);
        if (homeShipsRes.ok) {
          const homeShipsData = await homeShipsRes.json() as StarShipsResponse;
          setServerShipState(playerHomeStarIndex, homeShipsData.ships, homeShipsData.building, true);
          const fleetShape = getFleetShape(homeShipsData.ships);
          if (fleetShape !== currentShape) {
            currentShape = fleetShape;
            bridge.setShipShape(fleetShape);
          }
        }
      } catch (_e) { /* ignore */ }
    }
    // Also fetch full fleet state so fleet panel shows all stars
    try {
      const fleetRes = await fetch(`/api/fleet/all?username=${encodeURIComponent(username)}`);
      if (fleetRes.ok) {
        const fleetData = await fleetRes.json() as FleetAllResponse;
        setServerFleetAll(fleetData.stars, fleetData.transits, fleetData.freighterRoutes, fleetData.raidRoutes);
        // Mark discovered stars from server
        if (fleetData.discoveredStars && fleetData.discoveredStars.length > 0) {
          const gs2 = getGameState();
          if (gs2) {
            const enhancedSet = new Set(fleetData.enhancedProbeStars ?? []);
            for (const si of fleetData.discoveredStars) {
              const star = gs2.galaxy.stars[si];
              if (star && star.discoveryLevel === 'none') {
                star.discoveryLevel = enhancedSet.has(si) ? 'visited' : 'probed';
                star.discovered = true;
              }
            }
          }
        }
      }
    } catch (_e) { /* ignore */ }
    // ── Trade Station polling ──
    if (isTradingStation(postId, starIndex)) {
      try {
        const tradeRes = await fetch(`/api/trade-station?postId=${encodeURIComponent(postId)}&starIndex=${starIndex}`);
        if (tradeRes.ok) {
          const tradeData = await tradeRes.json() as TradeStationInfoResponse;
          setTradeStationInfo(tradeData);
        }
      } catch (_e) { /* ignore */ }
    } else {
      setTradeStationInfo(null);
    }
  } catch (_e) {
    // Ignore temporary network errors.
  } finally {
    _pollEconomyRunning = false;
  }
}

// ── Save position periodically ────────────────────────────────────────────────
let _lastSavedPosition = '';
let _lastSavedDiscovered = '';
let _lastSavedVisited = '';
let _lastSavedJourneyDone = false;
let _lastSavedCoachStep = '';
let _lastSavedCoachSkipped = false;
let _resetPerformed = false;
function savePositionIfChanged() {
  if (_resetPerformed) return; // block saves after admin reset
  const gs = getGameState();
  if (!gs) return;
  // When in galaxy view, starIndex is -1; save homeStarIndex so restore has a valid reference
  const effectiveStarIndex = gs.galaxy.currentStarIndex >= 0
    ? gs.galaxy.currentStarIndex
    : gs.galaxy.homeStarIndex;
  const pos = JSON.stringify({
    starIndex: effectiveStarIndex,
    tier: gs.galaxy.tier,
    bodyIndex: gs.galaxy.currentBodyIndex,
  });
  const discovered = getDiscoveredStars();
  const visited = getVisitedStars();
  const discoveredKey = discovered.join(',');
  const visitedKey = visited.join(',');
  const journeyDone = isJourneyDone();
  const coachStep = getCoachStep();
  const coachSkipped = isCoachSkipped();
  const posChanged = pos !== _lastSavedPosition;
  const discoveredChanged = discoveredKey !== _lastSavedDiscovered;
  const visitedChanged = visitedKey !== _lastSavedVisited;
  const journeyChanged = journeyDone && !_lastSavedJourneyDone;
  const coachChanged = coachStep !== _lastSavedCoachStep || coachSkipped !== _lastSavedCoachSkipped;
  if (!posChanged && !discoveredChanged && !visitedChanged && !journeyChanged && !coachChanged) return;
  // Track star discovery milestone
  if (discoveredChanged && discovered.length >= 2) {
    journeyProgress(0.75, 'star_discovered');
    checkJourneyProgress('star_discovered');
  }
  _lastSavedPosition = pos;
  _lastSavedDiscovered = discoveredKey;
  _lastSavedVisited = visitedKey;
  _lastSavedCoachStep = coachStep;
  _lastSavedCoachSkipped = coachSkipped;
  if (journeyDone) _lastSavedJourneyDone = true;
  // Always send BOTH fields — Devvit hSet may replace the entire hash
  const payload: Record<string, unknown> = {
    username,
    lastPosition: JSON.parse(pos),
    discoveredStars: discovered,
    enhancedProbeStars: visited,
    journeyDone,
    coachStep,
    coachSkipped,
    scannedBodies: Array.from(_scannedBodies),
    wireframePref: getWireframePref(),
  };
  console.log('[SAVE] saving profile:', JSON.stringify(payload));
  fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => r.json()).then(d => console.log('[SAVE] response:', JSON.stringify(d))).catch(e => console.error('[SAVE] FAILED:', e));
}

// ── Devvit Journey Telemetry ────────────────────────────────────────────────
// Journey 1: Solo progression — progress based on build tree completion
// Progress only increases, never decreases. Calculated from actual game state.
let _journeyStarted = false;
let _highestProgress = 0;
let _journeyComplete = false;
const _progressSent = new Set<string>(); // kept for updateHelpNextTab compatibility
const _lastEconomyData = new Map<number, { buildings?: Record<string, { level?: number }> }>();
let _claimedStarCount = 0;
// eslint-disable-next-line prefer-const
let _hasColonyShip = false;

function journeyAppReady() {
  void telemetry.appReady().then(() => console.log('[TELEMETRY] app ready sent')).catch((e) => console.warn('[TELEMETRY] app ready failed:', e));
}

function journeyStart() {
  if (_journeyStarted) return;
  _journeyStarted = true;
  void telemetry.startJourney().then((r) => console.log('[TELEMETRY] journey started, id:', r.journeyId)).catch((e) => console.warn('[TELEMETRY] journey start failed:', e));
}

/** Compute journey progress from actual game state (build tree depth) */
function computeJourneyProgress(): number {
  let progress = 0.01; // game_start baseline

  // Check home star economy for building levels
  const homeEcon = (playerHomeStarIndex != null && playerHomeStarIndex >= 0) ? _lastEconomyData.get(playerHomeStarIndex) : null;
  if (homeEcon?.buildings) {
    const b = homeEcon.buildings;
    const station = b.station?.level ?? 0;
    const dock = b.dock?.level ?? 0;
    const shield = b.shield?.level ?? 0;
    const hasMine = (b.mine?.level ?? 0) >= 1;
    const hasSolar = (b.solar?.level ?? 0) >= 1;
    const hasHab = (b.hab?.level ?? 0) >= 1;

    if (hasMine || hasSolar || hasHab) progress = Math.max(progress, 0.10);
    if (station >= 2) progress = Math.max(progress, 0.20);
    if (dock >= 1 && currentShape !== 'scout') progress = Math.max(progress, 0.30);
    if (dock >= 3) progress = Math.max(progress, 0.40);
    if (station >= 3) progress = Math.max(progress, 0.50);
    if (shield >= 1) progress = Math.max(progress, 0.60);
  }

  // Check discovery/colonization state
  const discovered = getDiscoveredStars();
  if (discovered.length > 1) progress = Math.max(progress, 0.70);
  if (discovered.length > 2) progress = Math.max(progress, 0.80);
  if (_hasColonyShip) progress = Math.max(progress, 0.90);
  if (_claimedStarCount > 1) progress = 1.0; // JOURNEY 1 COMPLETE

  return progress;
}

/** Send progress if it increased. Called after state changes. */
function checkJourneyProgress(trigger: string) {
  if (!_journeyStarted || _journeyComplete) return;
  const progress = computeJourneyProgress();
  if (progress > _highestProgress) {
    _highestProgress = progress;
    const action = `tree_${Math.round(progress * 100)}`;
    _progressSent.add(action);
    void telemetry.progress({ progress, action: `${action}:${trigger}` })
      .then(() => console.log('[TELEMETRY] progress:', progress, trigger))
      .catch((e) => console.warn('[TELEMETRY] progress failed:', e));

    if (progress >= 1.0) {
      _journeyComplete = true;
      void telemetry.endJourney({ complete: true, game: { win: true, score: 0 } })
        .then(() => console.log('[TELEMETRY] Journey 1 COMPLETE — colonized!'))
        .catch(() => {});
    }
  }
}

/** Legacy wrapper — old calls now just trigger a state check */
function journeyProgress(_progress: number, action: string) {
  _progressSent.add(action);
  checkJourneyProgress(action);
}

// journeyEnd is handled by checkJourneyProgress (complete) or idle timeout (incomplete)

// ── Player stats tracking ───────────────────────────────────────────────────
let _statsInteractions = 0;
let _statsLastHeartbeat = Date.now();
const STATS_HEARTBEAT_MS = 30_000; // 30s

function trackInteraction() { _statsInteractions++; }
// Count pointer clicks and key presses as interactions
window.addEventListener('pointerdown', trackInteraction, { passive: true });
window.addEventListener('keydown', trackInteraction, { passive: true });

// Journey interaction: track meaningful player actions (server interactions)
function journeyAction(action?: string) {
  if (!_journeyStarted) return;
  void telemetry.interaction({ action: action ?? 'action' }).catch(() => {});
}

// ── Idle timeout: return to splash after 30 minutes of no interaction ──────
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
let _idleTimer: ReturnType<typeof setTimeout> | null = null;
let _isPlaying = false; // set true once startMultiplayer runs

function resetIdleTimer() {
  if (!_isPlaying) return;
  if (_idleTimer) clearTimeout(_idleTimer);
  _idleTimer = setTimeout(() => {
    console.log('[IDLE] 30 min idle — returning to splash');
    savePositionIfChanged();
    journeyProgress(0, 'idle_timeout');
    void telemetry.endJourney({ complete: false, game: { win: false, score: 0 } })
      .then(() => console.log('[TELEMETRY] journey ended — idle timeout'))
      .catch(() => {})
      .finally(() => {
        location.hash = 'idle';
        location.reload();
      });
  }, IDLE_TIMEOUT_MS);
}
window.addEventListener('pointerdown', resetIdleTimer, { passive: true });
window.addEventListener('keydown', resetIdleTimer, { passive: true });
window.addEventListener('pointermove', resetIdleTimer, { passive: true });
window.addEventListener('wheel', resetIdleTimer, { passive: true });
window.addEventListener('touchstart', resetIdleTimer, { passive: true });

function sendStatsHeartbeat() {
  const now = Date.now();
  const deltaSec = (now - _statsLastHeartbeat) / 1000;
  const deltaInt = _statsInteractions;
  _statsLastHeartbeat = now;
  _statsInteractions = 0;
  if (deltaSec < 1 && deltaInt === 0) return; // nothing to report
  fetch('/api/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, deltaSeconds: Math.round(deltaSec), deltaInteractions: deltaInt }),
  }).catch(() => {});
}

// ── Activate multiplayer networking ─────────────────────────────────────────
function startMultiplayer() {
  console.log(`[STARTUP] t=${(performance.now() - _tPageLoad).toFixed(0)}ms — startMultiplayer() entered`);
  // Hide loading screen
  const ls = document.getElementById('loading-screen');
  if (ls) ls.style.display = 'none';
  bridge.beginPlay(); // Activate networking callbacks on existing game
  console.log(`[STARTUP] t=${(performance.now() - _tPageLoad).toFixed(0)}ms — beginPlay done, game is READY`);
  _isPlaying = true;
  resetIdleTimer(); // start the 30-min idle countdown
  journeyAppReady();
  ghostPollInterval = setInterval(pollGhosts, 1000);
  shotPollInterval = setInterval(pollShots, 1000);
  economyPollInterval = setInterval(pollEconomy, 5000);
  _savePositionInterval = setInterval(savePositionIfChanged, 5000);
  setInterval(sendStatsHeartbeat, STATS_HEARTBEAT_MS);
  setInterval(pollComsLoop, 2000); // fast detection, rate-limited fetches
  setInterval(pollSensorAlerts, 30_000); // sensor alerts every 30s
  void pollEconomy();
  void pollComsUnread(); // initial unread check

  // Fetch returning player report (fire-and-forget)
  void fetch(`/api/report?username=${encodeURIComponent(username)}`)
    .then(r => r.ok ? r.json() : null)
    .then((data: { items: Array<{ icon: string; text: string; category: string }>; awaySeconds: number } | null) => {
      if (data?.items?.length) {
        setReturningReport(data.items as import('../shared/api').ReportItem[]);
        console.log(`[REPORT] ${data.items.length} items (away ${data.awaySeconds}s)`);
      }
    })
    .catch(() => {});

  // ── DM Input Overlay ────────────────────────────────────────────────────
  const dmOverlay = document.getElementById('dm-input-overlay');
  const dmInputText = document.getElementById('dm-input-text') as HTMLInputElement | null;
  const dmInputLabel = document.getElementById('dm-input-label');
  const dmInputSend = document.getElementById('dm-input-send');
  const dmInputCancel = document.getElementById('dm-input-cancel');

  // Track overlay mode: 'dm' or 'public' or 'alliance-create' or 'alliance-chat'
  let _overlayMode: 'dm' | 'public' | 'alliance-create' | 'alliance-chat' = 'dm';
  let _overlayPublicParentId: string | undefined = undefined;
  let _overlayPublicRecipient: string | undefined = undefined;

  function hideDMOverlay() {
    if (dmOverlay) dmOverlay.style.display = 'none';
    if (dmInputText) dmInputText.value = '';
  }

  function showDMOverlay(peer: string) {
    if (!dmOverlay || !dmInputText || !dmInputLabel) return;
    _overlayMode = 'dm';
    dmInputLabel.textContent = `Message to ${peer}:`;
    dmInputText.value = '';
    dmInputText.placeholder = 'Type your message...';
    dmOverlay.style.display = 'flex';
    setTimeout(() => dmInputText.focus(), 50);
  }

  function showPublicOverlay(parentId?: string, recipient?: string) {
    if (!dmOverlay || !dmInputText || !dmInputLabel) return;
    _overlayMode = 'public';
    _overlayPublicParentId = parentId;
    _overlayPublicRecipient = recipient;
    if (recipient) {
      dmInputLabel.textContent = `Public message to u/${recipient}:`;
    } else if (parentId) {
      dmInputLabel.textContent = 'Reply to comment:';
    } else {
      dmInputLabel.textContent = 'New public post:';
    }
    dmInputText.value = '';
    dmInputText.placeholder = recipient ? `Message to ${recipient}...` : (parentId ? 'Type your reply...' : 'Type your message...');
    dmOverlay.style.display = 'flex';
    setTimeout(() => dmInputText.focus(), 50);
  }

  function showAllianceOverlay(type: 'create' | 'chat') {
    if (!dmOverlay || !dmInputText || !dmInputLabel) return;
    _overlayMode = type === 'create' ? 'alliance-create' : 'alliance-chat';
    dmInputLabel.textContent = type === 'create' ? 'Alliance name:' : 'Alliance chat:';
    dmInputText.value = '';
    dmInputText.placeholder = type === 'create' ? 'Enter alliance name...' : 'Type your message...';
    if (dmInputSend) dmInputSend.textContent = type === 'create' ? 'CREATE' : 'SEND';
    dmOverlay.style.display = 'flex';
    setTimeout(() => dmInputText.focus(), 50);
  }

  function handleOverlaySubmit() {
    if (!dmInputText || !dmInputText.value.trim()) { hideDMOverlay(); return; }
    const text = dmInputText.value.trim();
    if (_overlayMode === 'dm') {
      const peer = getDMPeer();
      if (peer) {
        submitDMInput(text);
        // sendDM is handled by consumePendingDMSend in the polling loop
      }
    } else if (_overlayMode === 'public') {
      submitPublicPost(text, _overlayPublicParentId, _overlayPublicRecipient);
      // postPublicComment is handled by consumePendingPublicPost in the polling loop
    } else if (_overlayMode === 'alliance-create') {
      submitAllianceInput('create', text);
    } else if (_overlayMode === 'alliance-chat') {
      submitAllianceInput('chat', text);
    }
    hideDMOverlay();
  }

  if (dmInputSend) {
    dmInputSend.addEventListener('click', () => handleOverlaySubmit());
  }
  if (dmInputCancel) {
    dmInputCancel.addEventListener('click', () => hideDMOverlay());
  }
  if (dmInputText) {
    dmInputText.addEventListener('keydown', (e) => {
      e.stopPropagation(); // prevent game controls while typing
      if (e.key === 'Enter') {
        handleOverlaySubmit();
      } else if (e.key === 'Escape') {
        hideDMOverlay();
      }
    });
  }

  // Check for DM, public, and alliance input requests every 100ms
  setInterval(() => {
    const peer = consumeDMInputRequest();
    if (peer) showDMOverlay(peer);
    const pubReq = consumePublicInputRequest();
    if (pubReq) showPublicOverlay(pubReq.parentId, pubReq.recipient);
    const allianceReq = consumeAllianceInputRequest();
    if (allianceReq) showAllianceOverlay(allianceReq.type);
  }, 100);

  // Fetch already-claimed pods so late-joiners see correct state
  fetch(`/api/claimed-pods?postId=${encodeURIComponent(postId)}`)
    .then(r => r.json())
    .then((data: ClaimedPodsResponse) => {
      if (data.podIds && data.podIds.length) {
        bridge.setCollectedPods(data.podIds);
      }
    })
    .catch(() => {});
}

// In expanded mode, start immediately. In inline mode, wait for button press.
if (!isInline) {
  console.log(`[STARTUP] t=${(performance.now() - _tPageLoad).toFixed(0)}ms — expanded mode, starting profile load`);
  // Show loading screen for expanded mode (user already committed to play)
  const ls = document.getElementById('loading-screen');
  if (ls) ls.style.display = 'flex';
  // Safety timeout: hide loading screen after 8s even if profile fetch hangs
  const loadTimeout = setTimeout(() => {
    console.warn(`[STARTUP] t=${(performance.now() - _tPageLoad).toFixed(0)}ms — profile load TIMEOUT (8s) — starting anyway`);
    startMultiplayer();
  }, 8000);
  void loadPlayerProfile()
    .then(() => { clearTimeout(loadTimeout); console.log(`[STARTUP] t=${(performance.now() - _tPageLoad).toFixed(0)}ms — profile loaded, calling startMultiplayer`); startMultiplayer(); })
    .catch(() => { clearTimeout(loadTimeout); console.log(`[STARTUP] t=${(performance.now() - _tPageLoad).toFixed(0)}ms — profile load FAILED, calling startMultiplayer`); startMultiplayer(); });
}

// ── Overlay button handlers (inline mode) ───────────────────────────────────
playHereBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
playHereBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  overlay.classList.remove('visible');
  const ls = document.getElementById('loading-screen');
  if (ls) ls.style.display = 'flex';
  enableFullGestures(canvas);
  const lt = setTimeout(() => { console.warn('[INIT] inline load timeout'); startMultiplayer(); }, 8000);
  void loadPlayerProfile().then(() => { clearTimeout(lt); startMultiplayer(); }).catch(() => { clearTimeout(lt); startMultiplayer(); });
});

playFullBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
playFullBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  overlay.classList.remove('visible');
  void loadPlayerProfile().then(() => {
    setTimeout(() => requestExpandedMode(e, 'game'), 100);
  });
});

// ── Deferred play: if module was loaded via splash play button ──────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deferredMode = (globalThis as any).__DEFERRED_PLAY__ as string | undefined;
if (deferredMode && isInline) {
  console.log(`[INIT] Deferred play mode: ${deferredMode}`);
  overlay.classList.remove('visible');
  const ls = document.getElementById('loading-screen');
  if (ls) ls.style.display = 'flex';
  if (deferredMode === 'full') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const savedEvent = (globalThis as any).__DEFERRED_EVENT__ as MouseEvent | undefined;
    void loadPlayerProfile().then(() => {
      requestExpandedMode(savedEvent ?? new PointerEvent('click'), 'game');
    });
  } else {
    enableFullGestures(canvas);
    void loadPlayerProfile().then(() => startMultiplayer()).catch(() => startMultiplayer());
  }
}

// ── Cleanup on page hide ────────────────────────────────────────────────────
window.addEventListener('pagehide', () => {
  journeyProgress(1.0, 'session_end');
  savePositionIfChanged();
  if (ghostPollInterval) clearInterval(ghostPollInterval);
  if (ghostListInterval) clearInterval(ghostListInterval);
  if (shotPollInterval) clearInterval(shotPollInterval);
  if (economyPollInterval) clearInterval(economyPollInterval);
  bridge.quit();
});

// ── Settings panel ──────────────────────────────────────────────────────────
const settingsBtn = document.getElementById('settings-btn')!;
const settingsPanel = document.getElementById('settings-panel')!;
const feedbackPanel = document.getElementById('feedback-panel')!;
const ghostListEl = document.getElementById('ghost-list')!;
const shipNameInput = document.getElementById('ship-name-input') as HTMLInputElement;

// Populate name input with current username
shipNameInput.value = username;

// Live-update ship name on input
shipNameInput.addEventListener('input', () => {
  const name = shipNameInput.value.trim() || username;
  currentName = name;
  bridge.setPlayerName(name);
  saveProfile();
});
shipNameInput.addEventListener('pointerdown', (e) => e.stopPropagation());

settingsBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  helpPanel.classList.remove('visible');
  feedbackPanel.classList.remove('visible');
  const opening = !settingsPanel.classList.contains('visible');
  settingsPanel.classList.toggle('visible');
  if (opening) {
    updateGhostList();
    ghostListInterval = setInterval(updateGhostList, 500);
  } else if (ghostListInterval) {
    clearInterval(ghostListInterval);
    ghostListInterval = null;
  }
});

// ── Help button ─────────────────────────────────────────────────────────────
const helpBtn = document.getElementById('help-btn')!;
const helpPanel = document.getElementById('help-panel')!;
helpBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
helpBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsPanel.classList.remove('visible');
  feedbackPanel.classList.remove('visible');
  const opening = !helpPanel.classList.contains('visible');
  helpPanel.classList.toggle('visible', opening);
  (globalThis as CoachUiBridge).__helpPanelOpen = opening;
  if (opening) {
    updateHelpNextTab();
  } else if (getCoachStep() === 'help') {
    coachAdvance('congrats');
  }
});
helpPanel.addEventListener('pointerdown', (e) => e.stopPropagation());
helpPanel.addEventListener('click', (e) => e.stopPropagation());
// ── Help "Next" tab — dynamic suggestions based on player progress ──────────
function updateHelpNextTab() {
  const el = document.getElementById('help-next-content');
  if (!el) return;
  const suggestions: string[] = [];
  // Check journey milestones already sent
  if (!_progressSent.has('first_move')) suggestions.push('🕹️ <b>Move your ship</b> — tap anywhere to fly there');
  if (!_progressSent.has('home_star_claimed')) suggestions.push('⭐ <b>Claim your home star</b> — dock at a station');
  if (!_progressSent.has('first_resource_collected')) suggestions.push('💎 <b>Collect resources</b> — fly through asteroid pods');
  if (!_progressSent.has('first_building')) suggestions.push('🏗️ <b>Build your first structure</b> — dock and open BUILD tab');
  if (!_progressSent.has('first_ship_built')) suggestions.push('🚢 <b>Build a ship</b> — requires a Dock building');
  if (!_progressSent.has('dock_upgraded')) suggestions.push('🔧 <b>Upgrade your Dock</b> — unlocks better ships');
  if (!_progressSent.has('first_transfer')) suggestions.push('📦 <b>Transfer resources</b> — between your stars');
  if (!_progressSent.has('ship_upgraded')) suggestions.push('⬆️ <b>Upgrade your ship</b> — stronger hull & weapons');
  if (!_progressSent.has('first_colony')) suggestions.push('🌍 <b>Colonize a new star</b> — build a Colony Ship');
  if (!_progressSent.has('star_discovered')) suggestions.push('🌟 <b>Discover a new star</b> — fly to an unexplored system');
  if (!_progressSent.has('alliance_joined')) suggestions.push('🤝 <b>Join an alliance</b> — team up with other players');
  if (suggestions.length === 0) suggestions.push('🎉 <b>You\'ve done everything!</b> Keep expanding your empire.');
  el.innerHTML = suggestions.map(s => `<div class="help-row">${s}</div>`).join('');
}

// ── Help panel tabs ─────────────────────────────────────────────────────────
document.querySelectorAll('.help-tab-btn').forEach(btn => {
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const tab = (btn as HTMLElement).dataset.helpTab;
    if (!tab) return;
    document.querySelectorAll('.help-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.help-tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`help-tab-${tab}`)?.classList.add('active');
    if (tab === 'next') updateHelpNextTab();
  });
});

/** Open the help panel on a specific tab — lets tutorial items deep-link to docs. */
function openHelpTab(tab: string): void {
  settingsPanel.classList.remove('visible');
  feedbackPanel.classList.remove('visible');
  helpPanel.classList.add('visible');
  (globalThis as CoachUiBridge).__helpPanelOpen = true;
  document.querySelector<HTMLElement>(`.help-tab-btn[data-help-tab="${tab}"]`)?.click();
}

for (const button of document.querySelectorAll<HTMLElement>('.tutorial-topic-btn')) {
  button.addEventListener('pointerdown', (e) => e.stopPropagation());
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    const topic = button.dataset.tutorialTopic;
    if (!topic) return;
    helpPanel.classList.remove('visible');
    (globalThis as CoachUiBridge).__helpPanelOpen = false;
    if (topic === 'ships') {
      startShipsTopic();
    } else if (topic === 'coms') {
      openComsPanelForTutorial();
      startComsTopic();
    } else if (topic === 'colonize') {
      startColonizationTopic();
    }
  });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__openHelpTab = openHelpTab;

// ── Help panel: paginated Buildings & Ships ─────────────────────────────────
{
  const BUILDING_PAGES = [
    { title: 'Station I-VIII', desc: 'Your base — its level caps all other buildings.', icons: Array.from({length: 8}, (_, i) => ({ src: `/icons/skins/wireframe/station-level-${i+1}.svg`, label: `Lv${i+1}`, info: `Station Lv${i+1}: Unlocks all buildings up to this level.` })) },
    { title: 'Mine I-VIII', desc: 'Produces Ore per second.', icons: Array.from({length: 8}, (_, i) => ({ src: `/icons/skins/wireframe/mine-level-${i+1}.svg`, label: `Lv${i+1}`, info: `Mine Lv${i+1}: +${i+1} Ore/sec production.` })) },
    { title: 'Solar Array I-VIII', desc: 'Produces Energy per second.', icons: Array.from({length: 8}, (_, i) => ({ src: `/icons/skins/wireframe/solar-array-level-${i+1}.svg`, label: `Lv${i+1}`, info: `Solar Lv${i+1}: +${i+1} Energy/sec production.` })) },
    { title: 'Hab I-VIII', desc: 'Produces Food, supports expansion.', icons: Array.from({length: 8}, (_, i) => ({ src: `/icons/skins/wireframe/hab-level-${i+1}.svg`, label: `Lv${i+1}`, info: `Hab Lv${i+1}: +${i+1} Food/sec production.` })) },
    { title: 'Dock T1-T3', desc: 'Required to build ships. Higher tiers unlock more powerful vessels.', icons: [{src:'/icons/skins/wireframe/dock-level-1.svg',label:'T1',info:'Dock T1: Scout, Freighter, Probe, Destroyer, Colony Ship'},{src:'/icons/skins/wireframe/dock-level-2.svg',label:'T2',info:'Dock T2: Frigate, Battleship'},{src:'/icons/skins/wireframe/dock-level-3.svg',label:'T3',info:'Dock T3: Command Cruiser, Dreadnought'}] },
    { title: 'Cannon I-VIII', desc: 'Defends your star from enemy ships.', icons: Array.from({length: 8}, (_, i) => ({ src: `/icons/skins/scifi/cannon-level-${i+1}.png`, label: `Lv${i+1}`, info: `Cannon Lv${i+1}: Defensive firepower ${i+1}.` })) },
  ];
  const SHIP_PAGES = [
    { title: 'Dock T1 Lv1', desc: 'Starting ships available at basic dock.', icons: [{src:'/icons/skins/wireframe/ship-scout.svg',label:'Scout',info:'Scout: Fast explorer. Cannot leave star systems.'},{src:'/icons/skins/wireframe/ship-freighter.svg',label:'Freighter',info:'Freighter: Automated cargo transport between stars.'},{src:'/icons/skins/wireframe/ship-probe-basic.svg',label:'B-Probe',info:'Basic Probe: Reveals nearby unexplored stars.'}] },
    { title: 'Dock T1 Lv3', desc: 'Mid-tier combat and utility ships.', icons: [{src:'/icons/skins/wireframe/ship-destroyer.svg',label:'Destroyer',info:'Destroyer: Light warship. First ship that can travel between stars.'},{src:'/icons/skins/wireframe/ship-colony.svg',label:'Colony',info:'Colony Ship: Colonize unclaimed stars to expand your empire.'},{src:'/icons/skins/wireframe/ship-troop-transport.svg',label:'Troop',info:'Troop Transport: Carries ground forces for invasions.'},{src:'/icons/skins/wireframe/ship-probe-enhanced.svg',label:'E-Probe',info:'Enhanced Probe: Reveals distant stars with bonus detail.'},{src:'/icons/skins/wireframe/ship-wrecker.svg',label:'Wrecker',info:'Wrecker: Damages enemy buildings during raids.'},{src:'/icons/skins/wireframe/ship-raider.svg',label:'Raider',info:'Raider: Steals resources from enemy stars.'}] },
    { title: 'Dock T2', desc: 'Heavy warships requiring tier 2 dock.', icons: [{src:'/icons/skins/wireframe/ship-frigate.svg',label:'Frigate',info:'Frigate: Balanced heavy warship with strong shields.'},{src:'/icons/skins/wireframe/ship-battleship.svg',label:'Battleship',info:'Battleship: Massive firepower, slower but devastating.'}] },
    { title: 'Dock T3', desc: 'Capital ships requiring tier 3 dock.', icons: [{src:'/icons/skins/wireframe/ship-command-cruiser.svg',label:'Cmd Cruiser',info:'Command Cruiser: Fleet flagship with command bonuses.'},{src:'/icons/skins/wireframe/ship-dreadnought.svg',label:'Dreadnought',info:'Dreadnought: Ultimate warship. Maximum firepower and armor.'}] },
  ];

  function renderPage(pages: typeof BUILDING_PAGES, idx: number, contentEl: HTMLElement, labelEl: HTMLElement) {
    const page = pages[idx]!;
    labelEl.textContent = `(${idx + 1}/${pages.length})`;
    const icons = page.icons.map((ic, i) =>
      `<div class="icon-card" data-info-idx="${i}" style="cursor:pointer"><img src="${ic.src}" alt="${ic.label}" /><span class="icon-tier">${ic.label}</span></div>`
    ).join('');
    contentEl.innerHTML = `<h4 style="color:#8ff7cf;margin:0 0 4px">${page.title}</h4><div class="help-caption">${page.desc}</div><div class="icon-strip">${icons}</div><div class="help-info-box" style="margin-top:6px;padding:4px 8px;background:rgba(79,255,176,0.08);border:1px solid rgba(79,255,176,0.2);color:#8ff7cf;font-size:9px;min-height:18px;display:none"></div>`;
    // Attach click handlers for icon info
    contentEl.querySelectorAll('.icon-card').forEach(card => {
      card.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); });
      card.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const i = parseInt((card as HTMLElement).dataset.infoIdx ?? '0');
        const infoBox = contentEl.querySelector('.help-info-box') as HTMLElement;
        if (infoBox && page.icons[i]) {
          infoBox.style.display = 'block';
          infoBox.textContent = page.icons[i].info;
        }
      });
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = parseInt((card as HTMLElement).dataset.infoIdx ?? '0');
        const infoBox = contentEl.querySelector('.help-info-box') as HTMLElement;
        if (infoBox && page.icons[i]) {
          infoBox.style.display = 'block';
          infoBox.textContent = page.icons[i].info;
        }
      });
    });
  }

  let bldgIdx = 0, shipIdx = 0;
  const bldgContent = document.getElementById('bldg-page-content');
  const bldgLabel = document.getElementById('bldg-page-label');
  const shipContent = document.getElementById('ship-page-content');
  const shipLabel = document.getElementById('ship-page-label');

  if (bldgContent && bldgLabel) {
    renderPage(BUILDING_PAGES, bldgIdx, bldgContent, bldgLabel);
    document.getElementById('bldg-prev')?.addEventListener('click', (e) => { e.stopPropagation(); bldgIdx = (bldgIdx - 1 + BUILDING_PAGES.length) % BUILDING_PAGES.length; renderPage(BUILDING_PAGES, bldgIdx, bldgContent, bldgLabel); });
    document.getElementById('bldg-next')?.addEventListener('click', (e) => { e.stopPropagation(); bldgIdx = (bldgIdx + 1) % BUILDING_PAGES.length; renderPage(BUILDING_PAGES, bldgIdx, bldgContent, bldgLabel); });
  }
  if (shipContent && shipLabel) {
    renderPage(SHIP_PAGES, shipIdx, shipContent, shipLabel);
    document.getElementById('ship-prev')?.addEventListener('click', (e) => { e.stopPropagation(); shipIdx = (shipIdx - 1 + SHIP_PAGES.length) % SHIP_PAGES.length; renderPage(SHIP_PAGES, shipIdx, shipContent, shipLabel); });
    document.getElementById('ship-next')?.addEventListener('click', (e) => { e.stopPropagation(); shipIdx = (shipIdx + 1) % SHIP_PAGES.length; renderPage(SHIP_PAGES, shipIdx, shipContent, shipLabel); });
  }
}

// ── Feedback button + panel ─────────────────────────────────────────────────
const feedbackBtn = document.getElementById('feedback-btn')!;
const feedbackThanks = document.getElementById('feedback-thanks')!;
let feedbackSubmitted = false;

function showFeedbackPanel(): void {
  if (feedbackSubmitted) return;
  // The tutorial can start after the timer does (replay button), so re-check on fire.
  if (isCoachActive()) {
    console.log('[FEEDBACK] deferred — tutorial in progress');
    setTimeout(showFeedbackPanel, FEEDBACK_RETRY_MS);
    return;
  }
  settingsPanel.classList.remove('visible');
  helpPanel.classList.remove('visible');
  feedbackPanel.classList.add('visible');
}

// Auto-show the feedback dialog after 5 minutes of play
const FEEDBACK_DELAY_MS = 5 * 60 * 1000;
const FEEDBACK_RETRY_MS = 60 * 1000;
let feedbackTimerStarted = false;
function startFeedbackTimer(): void {
  if (feedbackTimerStarted) return;
  feedbackTimerStarted = true;
  console.log('[FEEDBACK] starting 5 minute timer');
  setTimeout(showFeedbackPanel, FEEDBACK_DELAY_MS);
}

// The clock only starts once the tutorial is finished, so it can't interrupt onboarding.
const feedbackGate = setInterval(() => {
  if (!_profileProcessed || isCoachActive()) return;
  clearInterval(feedbackGate);
  startFeedbackTimer();
}, 2_000);

feedbackBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
feedbackBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsPanel.classList.remove('visible');
  helpPanel.classList.remove('visible');
  feedbackPanel.classList.toggle('visible');
});
feedbackPanel.addEventListener('pointerdown', (e) => e.stopPropagation());
feedbackPanel.addEventListener('click', (e) => e.stopPropagation());

document.querySelectorAll('.feedback-option').forEach(btn => {
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const choice = (btn as HTMLElement).dataset.feedback;
    if (!choice || feedbackSubmitted) return;
    feedbackSubmitted = true;
    // Hide options, show thanks
    document.querySelectorAll('.feedback-option').forEach(b => (b as HTMLElement).style.display = 'none');
    feedbackThanks.style.display = 'block';
    // Send to server
    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, postId, choice }),
    }).catch(() => {});
    console.log('[FEEDBACK] submitted:', choice);
    // Auto-hide after 2 seconds
    setTimeout(() => {
      feedbackPanel.classList.remove('visible');
    }, 2000);
  });
});

// Also show feedback panel on first completed objective (first_building)
function showFeedbackButton(): void {
  showFeedbackPanel();
}

// ── Ghost list with paging ──────────────────────────────────────────────────
const GHOST_PAGE_SIZE = 5;
let ghostPage = 0;
const ghostPagerEl = document.getElementById('ghost-pager');

function updateGhostList() {
  const ghosts = bridge.getGhosts();
  if (ghosts.length === 0) {
    ghostListEl.innerHTML = '<span class="ghost-empty">none nearby</span>';
    if (ghostPagerEl) ghostPagerEl.innerHTML = '';
    ghostPage = 0;
    return;
  }
  // Clamp page
  const maxPage = Math.max(0, Math.ceil(ghosts.length / GHOST_PAGE_SIZE) - 1);
  if (ghostPage > maxPage) ghostPage = maxPage;
  const start = ghostPage * GHOST_PAGE_SIZE;
  const pageGhosts = ghosts.slice(start, start + GHOST_PAGE_SIZE);
  ghostListEl.innerHTML = pageGhosts.map(g =>
    `<div class="ghost-row"><span class="ghost-name">${escapeHtml(g.name)}</span><span class="ghost-coords">(${g.x}, ${g.y})</span></div>`
  ).join('');
  // Pager buttons
  if (ghostPagerEl) {
    const parts: string[] = [];
    if (ghostPage > 0) parts.push('<button class="pager-btn" id="ghost-prev">\u25b2 back</button>');
    if (ghostPage < maxPage) parts.push(`<button class="pager-btn" id="ghost-next">\u25bc ${ghosts.length - start - pageGhosts.length} more</button>`);
    ghostPagerEl.innerHTML = parts.join('');
    document.getElementById('ghost-prev')?.addEventListener('click', (e) => { e.stopPropagation(); ghostPage--; updateGhostList(); });
    document.getElementById('ghost-next')?.addEventListener('click', (e) => { e.stopPropagation(); ghostPage++; updateGhostList(); });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

settingsPanel.addEventListener('pointerdown', (e) => e.stopPropagation());
settingsPanel.addEventListener('click', (e) => e.stopPropagation());

// ── Text size (S/M/L) ───────────────────────────────────────────────────────
// 'small' is the historical layout. Medium/Large scale fonts only for now —
// layout constants don't scale yet, so panels can overflow (attack plan #36).
function syncFontScaleButtons(): void {
  const active = getFontScaleName();
  for (const el of document.querySelectorAll<HTMLElement>('.font-scale-btn')) {
    const isActive = el.dataset.fontScale === active;
    el.style.background = isActive ? 'rgba(79,255,176,0.25)' : 'rgba(10,40,25,0.8)';
    el.style.color = isActive ? '#ffffff' : '#4fffb0';
  }
}

for (const el of document.querySelectorAll<HTMLElement>('.font-scale-btn')) {
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const name = el.dataset.fontScale as 'small' | 'medium' | 'large' | undefined;
    if (!name) return;
    setFontScaleByName(name);
    syncFontScaleButtons();
    fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, fontScale: name } satisfies SaveProfileRequest),
    }).catch(() => {});
    console.log('[SETTINGS] font scale:', name);
  });
}
syncFontScaleButtons();

// ── Save profile (debounced) ────────────────────────────────────────────────
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveProfile() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const payload: SaveProfileRequest = { username, name: currentName };
    fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, 500);
}

// ── Admin Panel (only for authorized user) ──────────────────────────────────
try {
const ADMIN_USERS = ['WeirdAd4511', 'Fred', 'weirdad4511', 'fred'];
const adminBtn = document.getElementById('admin-btn')!;
const adminPanel = document.getElementById('admin-panel')!;
const adminStatus = document.getElementById('admin-status')!;
const adminPanelMode = document.getElementById('admin-panel-mode') as HTMLInputElement | null;
const adminResultsPanel = document.getElementById('admin-results-panel');
const adminResultsTitle = document.getElementById('admin-results-title');
const adminResultsContent = document.getElementById('admin-results-content');

console.log('[ADMIN] elements:', !!adminBtn, !!adminPanel, !!adminStatus, 'username=', username);
if (adminBtn && adminPanel && ADMIN_USERS.some(u => u.toLowerCase() === username.toLowerCase())) {
  adminBtn.style.display = 'inline-flex';
  setIsAdmin(true);
  startCoach(true); // admin always sees the coach marks (review mode)
  console.log('[ADMIN] button shown');
}

// Wireframe preference toggle in settings panel
const wireframePrefToggle = document.getElementById('wireframe-pref-toggle') as HTMLInputElement | null;if (wireframePrefToggle) {
  wireframePrefToggle.checked = getWireframePref();
  wireframePrefToggle.addEventListener('pointerdown', (e) => e.stopPropagation());
  wireframePrefToggle.addEventListener('change', (e) => {
    e.stopPropagation();
    setWireframePref(wireframePrefToggle.checked);
    console.log('[SETTINGS] wireframe pref:', wireframePrefToggle.checked);
  });
}

adminBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
adminBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsPanel.classList.remove('visible');
  helpPanel.classList.remove('visible');
  const opening = !adminPanel.classList.contains('visible');
  adminPanel.classList.toggle('visible');
  if (opening) {
    adminStatus.textContent = '';
  } else {
    adminResultsPanel?.classList.remove('visible');
  }
});
adminPanel.addEventListener('pointerdown', (e) => e.stopPropagation());
adminPanel.addEventListener('click', (e) => e.stopPropagation());
adminResultsPanel?.addEventListener('pointerdown', (e) => e.stopPropagation());
adminResultsPanel?.addEventListener('click', (e) => e.stopPropagation());

// Dev mode toggle
document.getElementById('admin-toggle-devmode')?.addEventListener('click', async () => {
  adminStatus.textContent = 'toggling dev mode...';
  try {
    // Fetch current state from profile to toggle
    const profRes = await fetch(`/api/profile?username=${encodeURIComponent(username)}&postId=${encodeURIComponent(postId)}`);
    const prof = await profRes.json() as { devMode?: boolean };
    const newState = !prof.devMode;
    const res = await fetch('/api/admin/dev-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: newState }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    adminStatus.textContent = `dev mode: ${newState ? 'ON' : 'OFF'}`;
    // Apply immediately
    const debugDisplay = newState ? '' : 'none';
    for (const id of ['debug-copy', 'debug-log', 'debug-force-save', 'debug-check-redis', 'debug-toggle']) {
      document.getElementById(id)?.style.setProperty('display', debugDisplay);
    }
  } catch (e) {
    adminStatus.textContent = `dev-mode error: ${e}`;
  }
});

// Admin results panel mode: copy to clipboard vs show in side panel
function adminOutput(title: string, text: string, html?: string): void {
  const usePanel = adminPanelMode?.checked ?? false;
  if (usePanel && adminResultsPanel && adminResultsTitle && adminResultsContent) {
    adminResultsTitle.textContent = title;
    adminResultsContent.innerHTML = html ?? text.split('\n').map(l => `<div class="admin-result-row">${l}</div>`).join('');
    adminResultsPanel.classList.add('visible');
    adminStatus.textContent = title;
  } else {
    navigator.clipboard.writeText(text).then(() => {
      adminStatus.textContent = `${title} — copied to clipboard`;
    }).catch(() => {
      // Clipboard blocked in iframe — fall back to results panel
      if (adminResultsPanel && adminResultsTitle && adminResultsContent) {
        adminResultsTitle.textContent = title;
        adminResultsContent.innerHTML = html ?? text.split('\n').map(l => `<div class="admin-result-row">${l}</div>`).join('');
        adminResultsPanel.classList.add('visible');
        adminStatus.textContent = `${title} (clipboard blocked, showing in panel)`;
      } else {
        adminStatus.textContent = `${title} (clipboard blocked)`;
        console.log(text);
      }
    });
  }
}

// Active players
document.getElementById('admin-active-players')?.addEventListener('click', async () => {
  adminStatus.textContent = 'checking active players...';
  try {
    const res = await fetch(`/api/admin/active-players?postId=${encodeURIComponent(postId)}`);
    const data = await res.json() as { active: Array<{ username: string; starName: string; ago: number; totalShips: number; totalBuildingLevels: number }>; total: number };
    if (data.active.length === 0) {
      adminOutput('Active Players', `No active players (${data.total} total)`);
      return;
    }
    const lines = data.active.map(p => `${p.username} — ${p.starName} — ${p.ago}s ago — ${p.totalShips} ships, ${p.totalBuildingLevels} bldg`);
    const text = `Active Players (${data.active.length}/${data.total})\n${'─'.repeat(40)}\n${lines.join('\n')}`;
    const html = `<div class="admin-result-row" style="color:#44ffaa;margin-bottom:4px">${data.active.length} active / ${data.total} total</div>` +
      data.active.map(p => `<div class="admin-result-row"><b>${p.username}</b> @ ${p.starName}<br/>${p.ago}s ago · ${p.totalShips} ships · ${p.totalBuildingLevels} bldg</div>`).join('');
    adminOutput(`Active Players (${data.active.length})`, text, html);
  } catch (_e) { adminStatus.textContent = 'error loading active players'; }
});

document.getElementById('admin-copy-claims')!.addEventListener('click', async () => {
  adminStatus.textContent = 'loading claims...';
  try {
    const res = await fetch(`/api/stars/claimed?postId=${encodeURIComponent(postId)}`);
    const data = await res.json() as { claimed: Array<{ starIndex: number; username: string }> };
    if (!data.claimed || data.claimed.length === 0) {
      adminOutput('Star Claims', 'No claims found');
      return;
    }
    const gs = getGameState();
    const lines = data.claimed
      .sort((a, b) => a.starIndex - b.starIndex)
      .map(c => {
        const starName = gs?.galaxy.stars[c.starIndex]?.name ?? '';
        const label = starName ? `${starName} (#${c.starIndex})` : `Star ${c.starIndex}`;
        return `${label} — ${c.username}`;
      });
    const text = `Star Claims (${new Date().toISOString()})\n${'─'.repeat(40)}\n${lines.join('\n')}`;
    const html = data.claimed
      .sort((a, b) => a.starIndex - b.starIndex)
      .map(c => {
        const starName = gs?.galaxy.stars[c.starIndex]?.name ?? '';
        const label = starName ? `${starName} (#${c.starIndex})` : `Star ${c.starIndex}`;
        return `<div class="admin-result-row">${label} — <b>${c.username}</b></div>`;
      }).join('');
    adminOutput(`Star Claims (${data.claimed.length})`, text, html);
  } catch (_e) { adminStatus.textContent = 'error loading claims'; }
});

function formatPlaytime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTimeSince(ts: number): string {
  if (!ts) return 'never';
  const ago = (Date.now() - ts) / 1000;
  if (ago < 60) return 'just now';
  if (ago < 3600) return `${Math.floor(ago / 60)}m ago`;
  if (ago < 86400) return `${Math.floor(ago / 3600)}h ago`;
  return `${Math.floor(ago / 86400)}d ago`;
}

type PlayerStatEntry = {username:string;starName:string;starIndex:number;playtimeSeconds:number;interactions:number;lastSeen:number;totalBuildingLevels:number;totalShips:number;shipBreakdown:Array<{name:string;count:number}>};

document.getElementById('admin-copy-stats')!.addEventListener('click', async () => {
  adminStatus.textContent = 'loading player stats...';
  try {
    const res = await fetch(`/api/admin/player-stats?postId=${encodeURIComponent(postId)}`);
    const data = await res.json() as { players: PlayerStatEntry[] };
    const players = data.players ?? [];
    if (players.length === 0) {
      adminStatus.textContent = 'no players to copy';
      return;
    }
    const lines = players.map(p => {
      const ships = p.shipBreakdown.map(s => `${s.count}x ${s.name}`).join(', ') || 'none';
      return `${p.username} | ${p.starName} (#${p.starIndex}) | Play: ${formatPlaytime(p.playtimeSeconds)} | Actions: ${p.interactions} | Last: ${formatTimeSince(p.lastSeen)} | Bldg lvls: ${p.totalBuildingLevels} | Ships: ${p.totalShips} (${ships})`;
    });
    const text = `Player Stats (${new Date().toISOString()})\n${'─'.repeat(60)}\n${lines.join('\n')}`;
    const html = players.map(p => {
      const ships = p.shipBreakdown.map(s => `${s.count}x ${s.name}`).join(', ') || 'none';
      return `<div class="admin-result-row"><b>${p.username}</b> @ ${p.starName}<br/>Play: ${formatPlaytime(p.playtimeSeconds)} · Last: ${formatTimeSince(p.lastSeen)}<br/>Ships: ${p.totalShips} (${ships}) · Bldg: ${p.totalBuildingLevels}</div>`;
    }).join('');
    adminOutput(`Player Stats (${players.length})`, text, html);
  } catch (_e) { adminStatus.textContent = 'error loading stats'; }
});

document.getElementById('admin-reset-claims')!.addEventListener('click', async () => {
  adminStatus.textContent = 'resetting claims...';
  try {
    const res = await fetch('/api/stars/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
    });
    const data = await res.json();
    adminStatus.textContent = `cleared ${data.cleared} claim(s) — reload to re-assign`;
  } catch (_e) { adminStatus.textContent = 'error'; }
});

document.getElementById('admin-reset-all')!.addEventListener('click', async () => {
  adminStatus!.textContent = 'full reset in progress...';
  try {
    // Stop all save timers BEFORE the reset to prevent stale data re-write
    _resetPerformed = true;
    if (_savePositionInterval) { clearInterval(_savePositionInterval); _savePositionInterval = null; }
    if (economyPollInterval) { clearInterval(economyPollInterval); economyPollInterval = null; }
    if (ghostPollInterval) { clearInterval(ghostPollInterval); ghostPollInterval = null; }
    if (shotPollInterval) { clearInterval(shotPollInterval); shotPollInterval = null; }
    const res = await fetch('/api/admin/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, adminUser: username }),
    });
    const data = await res.json();
    const verify = data.verify ? ` | profile keys: [${data.verify.profileKeys}] claims: [${data.verify.claims}]` : '';
    adminStatus!.textContent = `reset: ${data.usersCleared} users, ${data.claimsCleared} claims${verify} — reload`;
  } catch (_e) { adminStatus!.textContent = 'error'; }
});

document.getElementById('admin-complete-builds')!.addEventListener('click', async () => {
  const gs = getGameState();
  const starIndex = gs?.galaxy.currentStarIndex ?? -1;
  if (starIndex < 0) { adminStatus!.textContent = 'not at a star'; return; }
  adminStatus!.textContent = 'completing builds...';
  try {
    await fetch('/api/debug/complete-builds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, starIndex }),
    });
    adminStatus!.textContent = 'builds completed';
  } catch (_e) { adminStatus!.textContent = 'error'; }
});
document.getElementById('admin-spawn-enemy')!.addEventListener('click', async () => {
  adminStatus!.textContent = 'spawning enemy...';
  try {
    const res = await fetch('/api/debug/spawn-enemy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
    });
    const data = await res.json() as { ok?: boolean; enemy?: string; starIndex?: number; message?: string };
    if (data.ok) {
      adminStatus!.textContent = `spawned ${data.enemy} at star #${data.starIndex} with Destroyer`;
    } else {
      adminStatus!.textContent = data.message ?? 'error';
    }
  } catch (_e) { adminStatus!.textContent = 'error'; }
});
document.getElementById('admin-copy-trades')!.addEventListener('click', () => {
  const gs = getGameState();
  if (!gs) { adminStatus!.textContent = 'no game state'; return; }
  const names: string[] = [];
  for (const star of gs.galaxy.stars) {
    if (isTradingStation(postId, star.index)) {
      names.push(`${star.name} (#${star.index})`);
    }
  }
  if (names.length === 0) {
    adminOutput('Trade Stations', 'No trade stations found');
    return;
  }
  const text = `Trade Stations (${new Date().toISOString()})\n${'─'.repeat(40)}\n${names.join('\n')}`;
  const html = names.map(n => `<div class="admin-result-row">${n}</div>`).join('');
  adminOutput(`Trade Stations (${names.length})`, text, html);
});

// ── Autobot Admin ──────────────────────────────────────────────────────────

document.getElementById('admin-autobot-state')!.addEventListener('click', async () => {
  adminStatus!.textContent = 'fetching bot state...';
  try {
    const res = await fetch('/api/bots/autobot/state');
    const data = await res.json();
    const json = JSON.stringify(data, null, 2);
    await navigator.clipboard.writeText(json);
    adminStatus!.textContent = 'bot state copied to clipboard';
  } catch (_e) { adminStatus!.textContent = 'error fetching bot state'; }
});

document.getElementById('admin-autobot-tick')!.addEventListener('click', async () => {
  adminStatus!.textContent = 'triggering bot tick...';
  try {
    const res = await fetch('/api/bots/autobot/tick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
    });
    const data = await res.json();
    const json = JSON.stringify(data, null, 2);
    await navigator.clipboard.writeText(json);
    adminStatus!.textContent = 'bot tick result copied to clipboard';
  } catch (_e) { adminStatus!.textContent = 'error triggering bot tick'; }
});

document.getElementById('admin-autobot-reset')!.addEventListener('click', async () => {
  adminStatus!.textContent = 'resetting bot...';
  try {
    await fetch('/api/bots/autobot/reset', { method: 'POST' });
    adminStatus!.textContent = 'bot state reset';
  } catch (_e) { adminStatus!.textContent = 'error resetting bot'; }
});

document.getElementById('admin-autobot-flyby')!.addEventListener('click', async () => {
  const gs = getGameState();
  const tier = gs?.galaxy.tier ?? 0;
  const starIndex = gs?.galaxy.currentStarIndex ?? -1;
  const bodyIndex = gs?.galaxy.currentBodyIndex ?? -1;
  adminStatus!.textContent = `flyby: t${tier} s${starIndex} b${bodyIndex} postId=${postId?.slice(0, 8)}...`;
  try {
    const res = await fetch('/api/bots/autobot/flyby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, starIndex, bodyIndex }),
    });
    const data = await res.json();
    if (data.ok) {
      const poses = data.storedPoses ?? {};
      const poseKeys = Object.keys(poses);
      const planetPose = poses['bot:VALCORDIA_PROBE:planet'];
      const roomT2 = data.roomPosesT2 ?? [];
      adminStatus!.textContent = `s${data.starIndex} b${data.bodyIndex} poses:${poseKeys.length} planet:${planetPose ? `t${planetPose.tier}s${planetPose.starIndex}b${planetPose.bodyIndex}` : 'NONE'} roomT2:${roomT2.length}`;
      console.log('[FLYBY] stored poses:', JSON.stringify(data.storedPoses, null, 2));
      console.log('[FLYBY] roomPosesT2:', JSON.stringify(roomT2, null, 2));
    } else {
      adminStatus!.textContent = `flyby ERR: ${data.error}`;
    }
  } catch (e) { adminStatus!.textContent = `flyby exception: ${e}`; }
});

// Audit Log button
document.getElementById('admin-audit-log')?.addEventListener('click', async () => {
  adminStatus!.textContent = 'Loading audit log...';
  try {
    const res = await fetch('/api/debug/audit?limit=100');
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
      adminStatus!.textContent = `audit error: ${res.status} ${errBody.error ?? errBody.detail ?? ''}`;
      return;
    }
    const data = await res.json() as { count: number; entries: Array<Record<string, unknown>> };
    const lines = data.entries.map((e) => {
      const ts = new Date(e.t as number).toLocaleString();
      const event = e.event as string;
      const user = (e.user as string) ?? '?';
      const details = Object.entries(e)
        .filter(([k]) => !['t', 'event', 'user'].includes(k))
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      return { ts, event, user, details };
    });
    const text = `Audit Log (${data.count} entries)\n${'─'.repeat(40)}\n` + lines.map(l => `${l.ts} | ${l.event} | ${l.user} | ${l.details}`).join('\n');
    const html = lines.map(l =>
      `<div class="admin-result-row"><span style="color:#666">${l.ts}</span> <span style="color:#88aaff">${l.event}</span> <b>${l.user}</b> ${l.details}</div>`
    ).join('');
    adminOutput(`Audit Log (${data.count})`, text, html);
  } catch (e) { adminStatus!.textContent = `audit error: ${e}`; }
});

// Video player — preload so it's instant on click
const videoOverlay = document.getElementById('video-overlay');
const videoPlayer = document.getElementById('video-player') as HTMLVideoElement | null;
const videoClose = document.getElementById('video-close');
if (videoPlayer) {
  videoPlayer.preload = 'auto';
}
document.getElementById('admin-play-video')?.addEventListener('click', () => {
  const explEntry = VIDEO_CATALOG['exploration'];
  if (videoOverlay && videoPlayer && explEntry) {
    videoPlayer.src = explEntry.path;
    videoPlayer.currentTime = 0;
    videoOverlay.style.display = 'flex';
    videoPlayer.play().catch(() => {});
  }
});
videoClose?.addEventListener('click', () => {
  if (videoOverlay && videoPlayer) {
    videoPlayer.pause();
    videoOverlay.style.display = 'none';
  }
});
videoOverlay?.addEventListener('click', (e) => {
  if (e.target === videoOverlay) {
    videoPlayer?.pause();
    videoOverlay.style.display = 'none';
  }
});

} catch (adminErr) { console.error('[ADMIN] init error:', adminErr); }

