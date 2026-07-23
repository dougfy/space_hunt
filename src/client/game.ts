// ── Space Hunt Game Entry (Devvit Integration) ─────────────────────────────
// Initializes the canvas game engine with the Devvit bridge.
// Detects inline vs expanded mode and shows overlay buttons when inline.

import { context, requestExpandedMode } from '@devvit/web/client';
import { consumePendingBuildRequest, consumePendingBuyShipRequest, consumePendingUpgradeShipRequest, consumePendingCompleteBuilds, consumePendingTransfer, createDevvitBridge, getGameState, getDiscoveredStars, setExternalStarNames, refreshGalaxyStarNames, relocateToHomeStar, restorePosition, setDiscoveredStars, setStarClaims, setServerStarEconomy, setServerShipState, setServerFleetAll } from '../game';
import type { DevvitBridge } from '../game';
import type { ShipShape } from '../game';
import { getFleetShape } from '../shared/ships';
import type {
  BuildBuildingRequest,
  ClaimPodResponse,
  ClaimedPodsResponse,
  FleetAllResponse,
  PlayerProfileResponse,
  PoseUpdateRequest,
  PostShotsRequest,
  RoomPosesResponse,
  SaveProfileRequest,
  StarEconomyResponse,
  StarShipsResponse,
  ShotsResponse,
} from '../shared/api';

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
  } catch {
    // Ignore cache parse/storage issues.
  }

  // External CDN fetch violates Devvit CSP; fallback names only.
}

void loadRealStarNames();

// ── Mode detection ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const overlay = document.getElementById('overlay') ?? document.createElement('div');
const isInline = !!(globalThis as any).__INLINE_MODE__ || overlay.classList.contains('visible');

const playHereBtn = document.getElementById('play-here') ?? document.createElement('button');
const playFullBtn = document.getElementById('play-full') ?? document.createElement('button');

// ── Devvit context ──────────────────────────────────────────────────────────
const _t0 = performance.now();
const username = context.username ?? 'pilot';
const postId = context.postId ?? 'standalone:dev';
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

console.log(`[INIT] isInline=${isInline} username=${username} postId=${postId}`);

const sessionId = `${username}:${Math.random().toString(36).slice(2, 8)}`;

// ── Ship shape state ────────────────────────────────────────────────────────
let currentShape: ShipShape = 'scout';
let currentName = username;
let playerHomeStarIndex: number | null = null;



// ── Create bridge ───────────────────────────────────────────────────────────
const bridge: DevvitBridge = createDevvitBridge(canvas, {
  onPose(x, y, angle, name, tier, starIndex, bodyIndex) {
    const sentName = name || currentName;
    const payload: PoseUpdateRequest = { x, y, angle, username: sentName, sessionId, shape: currentShape, tier, starIndex, bodyIndex };
    // Send pose to server via Devvit API route
    fetch('/api/pose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  },
  onClaimPod(podId) {
    // Request pod claim from server
    fetch('/api/claim-pod', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ podId, username }),
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
});

bridge.setPlayerName(username);
bridge.setShipShape('scout');
bridge.setSharedWorldSeed(postId);

// Start rendering immediately (splash/preview mode — no networking yet)
const _tSplash = performance.now();
bridge.beginSplash();
console.log(`[PERF] beginSplash (galaxy+asteroids) in ${(performance.now() - _tSplash).toFixed(0)}ms`);

// ── Load user profile from server (deferred until play) ────────────────────
let profileReady: Promise<void> | null = null;

function loadPlayerProfile(): Promise<void> {
  if (profileReady) return profileReady;
  const _tProfile = performance.now();
  profileReady = fetch(`/api/profile?username=${encodeURIComponent(username)}&postId=${encodeURIComponent(postId)}`)
    .then(r => { console.log(`[PERF] /api/profile fetch in ${(performance.now() - _tProfile).toFixed(0)}ms`); return r.json(); })
    .then((profile: PlayerProfileResponse) => {
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
      }
      // Mark other players' stars as foreign
      if (profile.claimed && profile.claimed.length > 0) {
        setStarClaims(profile.claimed, username);
      }
      // Restore discovered stars
      if (profile.discoveredStars && profile.discoveredStars.length > 0) {
        console.log(`[PROFILE] restoring ${profile.discoveredStars.length} discovered stars:`, profile.discoveredStars);
        setDiscoveredStars(profile.discoveredStars);
      } else {
        console.log('[PROFILE] no discoveredStars in profile response');
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
    })
    .catch(() => {});
  
  return profileReady;
}

// ── Realtime ghost updates (poll for now, replace with SSE/WS later) ────────
let ghostPollInterval: ReturnType<typeof setInterval> | null = null;
let shotPollInterval: ReturnType<typeof setInterval> | null = null;
let economyPollInterval: ReturnType<typeof setInterval> | null = null;
let ghostListInterval: ReturnType<typeof setInterval> | null = null;

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
        }));
        bridge.setRemotePoses(JSON.stringify({ items: mapped }));
      }
    }
  } catch {
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
  } catch {
    // ignore
  }
}

async function pollEconomy() {
  try {
    const gs = getGameState();
    if (!gs) return;

    // At galaxy tier, poll all fleets instead of single-star economy
    if (gs.galaxy.tier === 0) { // NavigationTier.Galaxy = 0
      // Process pending fleet transfers
      const transfer = consumePendingTransfer();
      if (transfer) {
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
          }
        } catch (e) {
          console.warn('[FLEET] transfer error:', e);
        }
      }

      try {
        const fleetRes = await fetch(`/api/fleet/all?username=${encodeURIComponent(username)}`);
        if (fleetRes.ok) {
          const fleetData = await fleetRes.json() as FleetAllResponse;
          setServerFleetAll(fleetData.stars, fleetData.transits);
          // Mark stars with probes as discovered (probed level)
          const PROBE_TYPE_IDS = [11, 12];
          const probeStars: number[] = [];
          for (const [key, val] of Object.entries(fleetData.stars)) {
            const idx = parseInt(key.replace('s:', ''), 10);
            if (!Number.isNaN(idx) && val.ships.some(s => PROBE_TYPE_IDS.includes(s.typeId) && s.count > 0)) {
              probeStars.push(idx);
            }
          }
          if (probeStars.length > 0) {
            const gs2 = getGameState();
            if (gs2) {
              for (const si of probeStars) {
                const star = gs2.galaxy.stars[si];
                if (star && star.discoveryLevel === 'none') {
                  star.discoveryLevel = 'probed';
                  star.discovered = true;
                }
              }
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
      } catch { /* ignore */ }
      return;
    }

    const starIndex = gs.galaxy.currentStarIndex;
    if (starIndex < 0) return;
    const pendingBuild = consumePendingBuildRequest();
    if (pendingBuild) {
      const payload: BuildBuildingRequest = {
        username,
        starIndex,
        buildType: pendingBuild.buildType,
      };
      await fetch('/api/buildings/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => null);
    }
    const pendingShip = consumePendingBuyShipRequest();
    if (pendingShip) {
      try {
        const shipRes = await fetch('/api/ships/buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            starIndex,
            shipTypeId: pendingShip.shipTypeId,
            quantity: pendingShip.quantity,
          }),
        });
        if (!shipRes.ok) {
          const err = await shipRes.json().catch(() => ({ message: 'unknown' }));
          console.warn('[SHIPS] buy failed:', err);
        }
      } catch (e) {
        console.warn('[SHIPS] buy error:', e);
      }
    }
    const pendingUpgrade = consumePendingUpgradeShipRequest();
    if (pendingUpgrade) {
      try {
        const upgradeRes = await fetch('/api/ships/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            starIndex,
            fromTypeId: pendingUpgrade.fromTypeId,
          }),
        });
        if (!upgradeRes.ok) {
          const err = await upgradeRes.json().catch(() => ({ message: 'unknown' }));
          console.warn('[SHIPS] upgrade failed:', err);
        }
      } catch (e) {
        console.warn('[SHIPS] upgrade error:', e);
      }
    }
    if (consumePendingCompleteBuilds()) {
      try {
        await fetch('/api/debug/complete-builds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, starIndex }),
        });
      } catch (e) {
        console.warn('[DEBUG] complete-builds error:', e);
      }
    }
    const _tBldg = performance.now();
    const res = await fetch(`/api/buildings?username=${encodeURIComponent(username)}&starIndex=${starIndex}`);
    console.log(`[PERF] /api/buildings fetch in ${(performance.now() - _tBldg).toFixed(0)}ms`);
    if (!res.ok) return;
    const data = await res.json() as StarEconomyResponse;
    setServerStarEconomy({
      starIndex: data.starIndex,
      store: data.store,
      rates: data.rates,
      cap: data.cap,
      buildings: data.buildings,
    });
    // Poll ship state
    const _tShips = performance.now();
    const shipsRes = await fetch(`/api/ships?username=${encodeURIComponent(username)}&starIndex=${starIndex}`);
    console.log(`[PERF] /api/ships fetch in ${(performance.now() - _tShips).toFixed(0)}ms`);
    if (shipsRes.ok) {
      const shipsData = await shipsRes.json() as StarShipsResponse;
      setServerShipState(starIndex, shipsData.ships, shipsData.building);
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
          setServerShipState(playerHomeStarIndex, homeShipsData.ships, homeShipsData.building);
          const fleetShape = getFleetShape(homeShipsData.ships);
          if (fleetShape !== currentShape) {
            currentShape = fleetShape;
            bridge.setShipShape(fleetShape);
          }
        }
      } catch { /* ignore */ }
    }
    // Also fetch full fleet state so fleet panel shows all stars
    try {
      const fleetRes = await fetch(`/api/fleet/all?username=${encodeURIComponent(username)}`);
      if (fleetRes.ok) {
        const fleetData = await fleetRes.json() as FleetAllResponse;
        setServerFleetAll(fleetData.stars, fleetData.transits);
        // Mark stars with probes as discovered (probed level)
        const PROBE_TYPE_IDS = [11, 12];
        const gs2 = getGameState();
        if (gs2) {
          for (const [key, val] of Object.entries(fleetData.stars)) {
            const idx = parseInt(key.replace('s:', ''), 10);
            if (!Number.isNaN(idx) && val.ships.some(s => PROBE_TYPE_IDS.includes(s.typeId) && s.count > 0)) {
              const star = gs2.galaxy.stars[idx];
              if (star && star.discoveryLevel === 'none') {
                star.discoveryLevel = 'probed';
                star.discovered = true;
              }
            }
          }
        }
      }
    } catch { /* ignore */ }
  } catch {
    // Ignore temporary network errors.
  }
}

// ── Save position periodically ──────────────────────────────────────────────
let _lastSavedPosition = '';
let _lastSavedDiscovered = '';
function savePositionIfChanged() {
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
  const discoveredKey = discovered.join(',');
  const posChanged = pos !== _lastSavedPosition;
  const discoveredChanged = discoveredKey !== _lastSavedDiscovered;
  if (!posChanged && !discoveredChanged) return;
  _lastSavedPosition = pos;
  _lastSavedDiscovered = discoveredKey;
  // Always send BOTH fields — Devvit hSet may replace the entire hash
  const payload: Record<string, unknown> = {
    username,
    lastPosition: JSON.parse(pos),
    discoveredStars: discovered,
  };
  console.log('[SAVE] saving profile:', JSON.stringify(payload));
  fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => r.json()).then(d => console.log('[SAVE] response:', JSON.stringify(d))).catch(e => console.error('[SAVE] FAILED:', e));
}

// ── Player stats tracking ───────────────────────────────────────────────────
let _statsInteractions = 0;
let _statsLastHeartbeat = Date.now();
const STATS_HEARTBEAT_MS = 30_000; // 30s

function trackInteraction() { _statsInteractions++; }
// Count pointer clicks and key presses as interactions
window.addEventListener('pointerdown', trackInteraction, { passive: true });
window.addEventListener('keydown', trackInteraction, { passive: true });

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
  bridge.beginPlay(); // Activate networking callbacks on existing game
  ghostPollInterval = setInterval(pollGhosts, 250);
  shotPollInterval = setInterval(pollShots, 250);
  economyPollInterval = setInterval(pollEconomy, 1500);
  setInterval(savePositionIfChanged, 5000);
  setInterval(sendStatsHeartbeat, STATS_HEARTBEAT_MS);
  void pollEconomy();

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
  console.log('[INIT] Expanded mode — loading profile then starting multiplayer');
  void loadPlayerProfile().then(() => startMultiplayer()).catch(() => startMultiplayer());
}

// ── Overlay button handlers (inline mode) ───────────────────────────────────
playHereBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
playHereBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  overlay.classList.remove('visible');
  void loadPlayerProfile().then(() => startMultiplayer()).catch(() => startMultiplayer());
});

playFullBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
playFullBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  overlay.classList.remove('visible');
  void loadPlayerProfile().then(() => {
    setTimeout(() => requestExpandedMode(e, 'game'), 100);
  });
});

// ── Cleanup on page hide ────────────────────────────────────────────────────
window.addEventListener('pagehide', () => {
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
  helpPanel.classList.toggle('visible');
});
helpPanel.addEventListener('pointerdown', (e) => e.stopPropagation());
helpPanel.addEventListener('click', (e) => e.stopPropagation());

function updateGhostList() {
  const ghosts = bridge.getGhosts();
  if (ghosts.length === 0) {
    ghostListEl.innerHTML = '<span class="ghost-empty">none nearby</span>';
    return;
  }
  ghostListEl.innerHTML = ghosts.map(g =>
    `<div class="ghost-row"><span class="ghost-name">${escapeHtml(g.name)}</span><span class="ghost-coords">(${g.x}, ${g.y})</span></div>`
  ).join('');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

settingsPanel.addEventListener('pointerdown', (e) => e.stopPropagation());
settingsPanel.addEventListener('click', (e) => e.stopPropagation());

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
const adminBtn = document.getElementById('admin-btn');
const adminPanel = document.getElementById('admin-panel');
const adminClaims = document.getElementById('admin-claims');
const adminStatus = document.getElementById('admin-status');

console.log('[ADMIN] elements:', !!adminBtn, !!adminPanel, !!adminClaims, !!adminStatus, 'username=', username);
if (adminBtn && adminPanel && ADMIN_USERS.some(u => u.toLowerCase() === username.toLowerCase())) {
  adminBtn.style.display = 'inline-flex';
  console.log('[ADMIN] button shown');
}

adminBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
adminBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsPanel.classList.remove('visible');
  helpPanel.classList.remove('visible');
  const opening = !adminPanel.classList.contains('visible');
  adminPanel.classList.toggle('visible');
  if (opening) {
    refreshAdminClaims();
    refreshAdminPlayerStats();
  }
});
adminPanel.addEventListener('pointerdown', (e) => e.stopPropagation());
adminPanel.addEventListener('click', (e) => e.stopPropagation());

async function refreshAdminClaims() {
  adminStatus.textContent = 'loading...';
  try {
    const res = await fetch(`/api/stars/claimed?postId=${encodeURIComponent(postId)}`);
    const data = await res.json() as { claimed: Array<{ starIndex: number; username: string }> };
    if (!data.claimed || data.claimed.length === 0) {
      adminClaims.innerHTML = '<span style="color:#776655">no claims</span>';
    } else {
      adminClaims.innerHTML = data.claimed
        .sort((a, b) => a.starIndex - b.starIndex)
        .map(c => `<div class="admin-claim-row"><span class="admin-claim-star">Star ${c.starIndex}</span><span class="admin-claim-user">${escapeHtml(c.username)}</span></div>`)
        .join('');
    }
    adminStatus.textContent = `${data.claimed?.length ?? 0} claim(s)`;
  } catch (e) {
    adminStatus.textContent = 'error loading claims';
  }
}

document.getElementById('admin-refresh')!.addEventListener('click', () => {
  refreshAdminClaims();
  refreshAdminPlayerStats();
});

const adminPlayerStats = document.getElementById('admin-player-stats')!;
let lastPlayerStatsData: Array<{username:string;starName:string;starIndex:number;playtimeSeconds:number;interactions:number;lastSeen:number;totalBuildingLevels:number;totalShips:number;shipBreakdown:Array<{name:string;count:number}>}> = [];

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

async function refreshAdminPlayerStats() {
  adminPlayerStats.innerHTML = '<span style="color:#776655">loading...</span>';
  try {
    const res = await fetch(`/api/admin/player-stats?postId=${encodeURIComponent(postId)}`);
    const data = await res.json() as { players: typeof lastPlayerStatsData };
    lastPlayerStatsData = data.players ?? [];
    if (lastPlayerStatsData.length === 0) {
      adminPlayerStats.innerHTML = '<span style="color:#776655">no players</span>';
      return;
    }
    adminPlayerStats.innerHTML = lastPlayerStatsData.map(p => {
      const ships = p.shipBreakdown.map(s => `${s.count}x ${escapeHtml(s.name)}`).join(', ') || 'none';
      return `<div class="admin-player-card">
        <div><span class="player-name">${escapeHtml(p.username)}</span> — <span class="player-star">${escapeHtml(p.starName)} (#${p.starIndex})</span></div>
        <div class="player-detail">Playtime: ${formatPlaytime(p.playtimeSeconds)} | Actions: ${p.interactions} | Last: ${formatTimeSince(p.lastSeen)}</div>
        <div class="player-detail">Buildings: ${p.totalBuildingLevels} lvls | Ships: ${p.totalShips} (${ships})</div>
      </div>`;
    }).join('');
  } catch {
    adminPlayerStats.innerHTML = '<span style="color:#776655">error</span>';
  }
}

document.getElementById('admin-copy-stats')!.addEventListener('click', () => {
  if (lastPlayerStatsData.length === 0) {
    adminStatus!.textContent = 'no stats to copy';
    return;
  }
  const lines = lastPlayerStatsData.map(p => {
    const ships = p.shipBreakdown.map(s => `${s.count}x ${s.name}`).join(', ') || 'none';
    return `${p.username} | ${p.starName} (#${p.starIndex}) | Play: ${formatPlaytime(p.playtimeSeconds)} | Actions: ${p.interactions} | Last: ${formatTimeSince(p.lastSeen)} | Bldg lvls: ${p.totalBuildingLevels} | Ships: ${p.totalShips} (${ships})`;
  });
  const text = `Player Stats (${new Date().toISOString()})\n${'─'.repeat(60)}\n${lines.join('\n')}`;
  void navigator.clipboard.writeText(text).then(() => {
    adminStatus!.textContent = 'stats copied to clipboard';
  });
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
    refreshAdminClaims();
  } catch { adminStatus.textContent = 'error'; }
});

document.getElementById('admin-reset-all')!.addEventListener('click', async () => {
  adminStatus.textContent = 'full reset in progress...';
  try {
    const res = await fetch('/api/admin/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, adminUser: username }),
    });
    const data = await res.json();
    adminStatus.textContent = `reset: ${data.usersCleared} users, ${data.claimsCleared} claims — reload`;
    refreshAdminClaims();
  } catch { adminStatus.textContent = 'error'; }
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
  } catch { adminStatus!.textContent = 'error'; }
});
} catch (adminErr) { console.error('[ADMIN] init error:', adminErr); }

