// ── Space Hunt Game Entry (Devvit Integration) ─────────────────────────────
// Initializes the canvas game engine with the Devvit bridge.
// Detects inline vs expanded mode and shows overlay buttons when inline.

import { context, requestExpandedMode } from '@devvit/web/client';
import { telemetry } from '@devvit/analytics/client/reddit';
import versionJson from '../../version.json';
import { consumePendingBuildRequest, consumePendingBuyShipRequest, consumePendingUpgradeShipRequest, consumePendingCompleteBuilds, consumePendingColonizeRequest, consumePendingTransfer, consumePendingCancelRoute, consumePendingTrade, createDevvitBridge, getGameState, getDiscoveredStars, setExternalStarNames, refreshGalaxyStarNames, relocateToHomeStar, restorePosition, setDiscoveredStars, setStarClaims, setServerStarEconomy, setServerShipState, setServerFleetAll, setForeignFleet, setIsAdmin, skipJourney, startJourney, isJourneyDone, playSound, preloadSounds, onColonizeSuccess, setComsMessages, setComsUnread, clearComsUnread, isComsPanelOpen, setComsLoading, setPostId, setTradeStationInfo } from '../game';
import type { DevvitBridge } from '../game';
import type { ShipShape } from '../game';
import { getFleetShape } from '../shared/ships';
import type {
  BuildBuildingRequest,
  ClaimPodResponse,
  ClaimedPodsResponse,
  ComsResponse,
  ComsUnreadResponse,
  FleetAllResponse,
  PlayerProfileResponse,
  PoseUpdateRequest,
  PostShotsRequest,
  RoomPosesResponse,
  SaveProfileRequest,
  StarEconomyResponse,
  StarShipsResponse,
  ShotsResponse,
  TradeStationInfoResponse,
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const overlay = document.getElementById('overlay') ?? document.createElement('div');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isInline = !!(globalThis as any).__INLINE_MODE__ || overlay.classList.contains('visible');

const playHereBtn = document.getElementById('play-here') ?? document.createElement('button');
const playFullBtn = document.getElementById('play-full') ?? document.createElement('button');

// ── Devvit context ──────────────────────────────────────────────────────────
const _t0 = performance.now();
const username = context.username ?? 'pilot';
const postId = context.postId ?? 'standalone:dev';
let hasTraded = false;
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

console.log(`[INIT] v${versionJson.version} isInline=${isInline} username=${username} postId=${postId}`);

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
setPostId(postId);
preloadSounds();

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
      // Skip journey/tutorial if already completed on server, or if returning player
      if (profile.journeyDone || profile.lastPosition) {
        skipJourney();
      } else {
        startJourney();
        journeyStart();
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

async function pollComsMessages() {
  try {
    setComsLoading(true);
    const res = await fetch('/api/coms/messages?limit=50');
    if (res.ok) {
      const data = await res.json() as ComsResponse;
      setComsMessages(data.messages);
    } else {
      setComsLoading(false);
    }
  } catch (_e) { setComsLoading(false); }
}

async function markComsRead() {
  try {
    await fetch(`/api/coms/mark-read?username=${encodeURIComponent(username)}`, { method: 'POST' });
    clearComsUnread();
  } catch (_e) { /* ignore */ }
}

// Poll coms: check unread every 30s, fetch messages when panel is open
let _lastComsOpen = false;
function pollComsLoop() {
  const panelOpen = isComsPanelOpen();
  if (panelOpen && !_lastComsOpen) {
    // Panel just opened — fetch messages and mark read
    void pollComsMessages();
    void markComsRead();
  } else if (panelOpen) {
    // Panel staying open — refresh messages periodically (handled by interval)
    void pollComsMessages();
  } else {
    // Panel closed — just check unread count
    void pollComsUnread();
  }
  _lastComsOpen = panelOpen;
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
        } else {
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

      // Process pending trade
      const pendingTrade = consumePendingTrade();
      if (pendingTrade && gs) {
        const tradeStarIndex = gs.galaxy.currentStarIndex;
        try {
          const tradeRes = await fetch('/api/trade-station/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username,
              starIndex: tradeStarIndex,
              giveType: pendingTrade.giveType,
              receiveType: pendingTrade.receiveType,
              giveAmount: 50,
            }),
          });
          if (tradeRes.ok) {
            if (!hasTraded) { playSound('freighter_unloading'); hasTraded = true; }
            // Refresh trade station info
            const refreshRes = await fetch(`/api/trade-station?postId=${encodeURIComponent(postId)}&starIndex=${tradeStarIndex}`);
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

      try {
        const fleetRes = await fetch(`/api/fleet/all?username=${encodeURIComponent(username)}`);
        if (fleetRes.ok) {
          const fleetData = await fleetRes.json() as FleetAllResponse;
          setServerFleetAll(fleetData.stars, fleetData.transits, fleetData.freighterRoutes);
          // Mark discovered stars from server (probes consumed on arrival)
          if (fleetData.discoveredStars && fleetData.discoveredStars.length > 0) {
            const gs2 = getGameState();
            if (gs2) {
              let newDiscovery = false;
              for (const si of fleetData.discoveredStars) {
                const star = gs2.galaxy.stars[si];
                if (star && star.discoveryLevel === 'none') {
                  star.discoveryLevel = 'probed';
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
          const foreignData = await foreignRes.json() as { stars: Record<string, { owner: string; ships: Array<{ typeId: number; count: number }> }> };
          setForeignFleet(foreignData.stars);
          // Also mark these stars as foreign-owned in game state
          const gs2 = getGameState();
          if (gs2) {
            for (const key of Object.keys(foreignData.stars)) {
              const idx = parseInt(key.replace('s:', ''), 10);
              if (!Number.isNaN(idx) && gs2.galaxy.stars[idx]) {
                gs2.galaxy.stars[idx].owner = 'foreign';
              }
            }
          }
        }
      } catch (_e) { /* ignore */ }
      return;
    }

    const starIndex = gs.galaxy.currentStarIndex;
    if (starIndex < 0) return;

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
          }),
        });
        if (colonizeRes.ok) {
          // Regenerate system with station, mark star owned
          onColonizeSuccess(pendingColonize.starIndex);
          // Remove colony ship from local fleet display
          setServerShipState(pendingColonize.starIndex,
            [], // server consumed the colony ship; next fleet poll will refresh
            null,
          );
          playSound('colonize');
          console.log('[COLONIZE] Success! Star colonized:', pendingColonize.starIndex);
          journeyEnd(true);
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
          if (pendingBuild.buildType === 'dock') journeyProgress(0.25, 'dock_upgraded');
        } else {
          console.warn('[BUILD] build failed');
          playSound('low_fuel');
        }
      } catch (_e) { /* ignore */ }
    }
    const pendingShip = consumePendingBuyShipRequest();
    if (pendingShip) {
      console.log('[SHIPS] sending buy request, starIndex=', starIndex, 'shipTypeId=', pendingShip.shipTypeId);
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
        if (shipRes.ok) {
          console.log('[SHIPS] buy success');
          playSound('begin_building_ship');
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
      console.log('[SHIPS] sending upgrade request, starIndex=', starIndex, 'fromTypeId=', pendingUpgrade.fromTypeId);
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
      } catch (_e) { /* ignore */ }
    }
    // Also fetch full fleet state so fleet panel shows all stars
    try {
      const fleetRes = await fetch(`/api/fleet/all?username=${encodeURIComponent(username)}`);
      if (fleetRes.ok) {
        const fleetData = await fleetRes.json() as FleetAllResponse;
        setServerFleetAll(fleetData.stars, fleetData.transits);
        // Mark discovered stars from server
        if (fleetData.discoveredStars && fleetData.discoveredStars.length > 0) {
          const gs2 = getGameState();
          if (gs2) {
            for (const si of fleetData.discoveredStars) {
              const star = gs2.galaxy.stars[si];
              if (star && star.discoveryLevel === 'none') {
                star.discoveryLevel = 'probed';
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
  }
}

// ── Save position periodically ──────────────────────────────────────────────
let _lastSavedPosition = '';
let _lastSavedDiscovered = '';
let _lastSavedJourneyDone = false;
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
  const journeyDone = isJourneyDone();
  const posChanged = pos !== _lastSavedPosition;
  const discoveredChanged = discoveredKey !== _lastSavedDiscovered;
  const journeyChanged = journeyDone && !_lastSavedJourneyDone;
  if (!posChanged && !discoveredChanged && !journeyChanged) return;
  // Track star discovery milestone
  if (discoveredChanged && discovered.length >= 2) {
    journeyProgress(0.75, 'star_discovered');
  }
  _lastSavedPosition = pos;
  _lastSavedDiscovered = discoveredKey;
  if (journeyDone) _lastSavedJourneyDone = true;
  // Always send BOTH fields — Devvit hSet may replace the entire hash
  const payload: Record<string, unknown> = {
    username,
    lastPosition: JSON.parse(pos),
    discoveredStars: discovered,
    journeyDone,
  };
  console.log('[SAVE] saving profile:', JSON.stringify(payload));
  fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => r.json()).then(d => console.log('[SAVE] response:', JSON.stringify(d))).catch(e => console.error('[SAVE] FAILED:', e));
}

// ── Devvit Journey Telemetry ────────────────────────────────────────────────
// Simple progression funnel: start → dock_upgraded → ship_upgraded → star_discovered → colonized
let _journeyStarted = false;
const _progressSent = new Set<string>();

function journeyAppReady() {
  void telemetry.appReady().then(() => console.log('[TELEMETRY] app ready sent')).catch((e) => console.warn('[TELEMETRY] app ready failed:', e));
}

function journeyStart() {
  if (_journeyStarted) return;
  _journeyStarted = true;
  void telemetry.startJourney().then((r) => console.log('[TELEMETRY] journey started, id:', r.journeyId)).catch((e) => console.warn('[TELEMETRY] journey start failed:', e));
}

function journeyProgress(progress: number, action: string) {
  if (_progressSent.has(action)) return; // only fire each milestone once
  _progressSent.add(action);
  void telemetry.progress({ progress, action }).then(() => console.log('[TELEMETRY] progress:', progress, action)).catch((e) => console.warn('[TELEMETRY] progress failed:', e));
}

function journeyEnd(win: boolean) {
  void telemetry.endJourney({ complete: true, game: { win, score: 0 } }).then(() => console.log('[TELEMETRY] journey ended, win:', win)).catch((e) => console.warn('[TELEMETRY] end failed:', e));
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
  journeyAppReady();
  ghostPollInterval = setInterval(pollGhosts, 250);
  shotPollInterval = setInterval(pollShots, 250);
  economyPollInterval = setInterval(pollEconomy, 1500);
  setInterval(savePositionIfChanged, 5000);
  setInterval(sendStatsHeartbeat, STATS_HEARTBEAT_MS);
  setInterval(pollComsLoop, 15000); // check coms every 15s
  void pollEconomy();
  void pollComsUnread(); // initial unread check

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
  });
});

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
const adminClaims = document.getElementById('admin-claims')!;
const adminStatus = document.getElementById('admin-status')!;

console.log('[ADMIN] elements:', !!adminBtn, !!adminPanel, !!adminClaims, !!adminStatus, 'username=', username);
if (adminBtn && adminPanel && ADMIN_USERS.some(u => u.toLowerCase() === username.toLowerCase())) {
  adminBtn.style.display = 'inline-flex';
  setIsAdmin(true);
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
    void refreshAdminClaims();
    void refreshAdminPlayerStats();
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
  void refreshAdminClaims();
  void refreshAdminPlayerStats();
});

const adminPlayerStats = document.getElementById('admin-player-stats')!;
const adminStatsPager = document.getElementById('admin-stats-pager');
const ADMIN_STATS_PAGE_SIZE = 4;
let adminStatsPage = 0;
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

function renderAdminStatsPage() {
  if (lastPlayerStatsData.length === 0) {
    adminPlayerStats.innerHTML = '<span style="color:#776655">no players</span>';
    if (adminStatsPager) adminStatsPager.innerHTML = '';
    return;
  }
  const maxPage = Math.max(0, Math.ceil(lastPlayerStatsData.length / ADMIN_STATS_PAGE_SIZE) - 1);
  if (adminStatsPage > maxPage) adminStatsPage = maxPage;
  const start = adminStatsPage * ADMIN_STATS_PAGE_SIZE;
  const page = lastPlayerStatsData.slice(start, start + ADMIN_STATS_PAGE_SIZE);
  adminPlayerStats.innerHTML = page.map(p => {
    const ships = p.shipBreakdown.map(s => `${s.count}x ${escapeHtml(s.name)}`).join(', ') || 'none';
    return `<div class="admin-player-card">
      <div><span class="player-name">${escapeHtml(p.username)}</span> — <span class="player-star">${escapeHtml(p.starName)} (#${p.starIndex})</span></div>
      <div class="player-detail">Playtime: ${formatPlaytime(p.playtimeSeconds)} | Actions: ${p.interactions} | Last: ${formatTimeSince(p.lastSeen)}</div>
      <div class="player-detail">Buildings: ${p.totalBuildingLevels} lvls | Ships: ${p.totalShips} (${ships})</div>
    </div>`;
  }).join('');
  if (adminStatsPager) {
    const parts: string[] = [];
    if (adminStatsPage > 0) parts.push('<button class="admin-pager-btn" id="admin-stats-prev">\u25b2 back</button>');
    if (adminStatsPage < maxPage) parts.push(`<button class="admin-pager-btn" id="admin-stats-next">\u25bc ${lastPlayerStatsData.length - start - page.length} more</button>`);
    adminStatsPager.innerHTML = parts.join('');
    document.getElementById('admin-stats-prev')?.addEventListener('click', (e) => { e.stopPropagation(); adminStatsPage--; renderAdminStatsPage(); });
    document.getElementById('admin-stats-next')?.addEventListener('click', (e) => { e.stopPropagation(); adminStatsPage++; renderAdminStatsPage(); });
  }
}

async function refreshAdminPlayerStats() {
  adminPlayerStats.innerHTML = '<span style="color:#776655">loading...</span>';
  if (adminStatsPager) adminStatsPager.innerHTML = '';
  try {
    const res = await fetch(`/api/admin/player-stats?postId=${encodeURIComponent(postId)}`);
    const data = await res.json() as { players: typeof lastPlayerStatsData };
    lastPlayerStatsData = data.players ?? [];
    adminStatsPage = 0;
    renderAdminStatsPage();
  } catch (_e) {
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
    void refreshAdminClaims();
  } catch (_e) { adminStatus.textContent = 'error'; }
});

document.getElementById('admin-reset-all')!.addEventListener('click', async () => {
  adminStatus!.textContent = 'full reset in progress...';
  try {
    const res = await fetch('/api/admin/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, adminUser: username }),
    });
    const data = await res.json();
    adminStatus!.textContent = `reset: ${data.usersCleared} users, ${data.claimsCleared} claims — reload`;
    void refreshAdminClaims();
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
      void refreshAdminClaims();
    } else {
      adminStatus!.textContent = data.message ?? 'error';
    }
  } catch (_e) { adminStatus!.textContent = 'error'; }
});
document.getElementById('admin-trade-stations')!.addEventListener('click', () => {
  const gs = getGameState();
  if (!gs) { adminStatus!.textContent = 'no game state'; return; }
  const names: string[] = [];
  for (const star of gs.galaxy.stars) {
    if (isTradingStation(postId, star.index)) {
      names.push(`${star.name} (#${star.index})`);
    }
  }
  const el = document.getElementById('admin-trade-list')!;
  el.innerHTML = names.length > 0
    ? names.map(n => `<div>${n}</div>`).join('')
    : '<span style="color:#776655">none</span>';
  adminStatus!.textContent = `${names.length} trading station(s)`;
});
} catch (adminErr) { console.error('[ADMIN] init error:', adminErr); }

