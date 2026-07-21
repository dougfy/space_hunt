// ── Space Hunt Game Entry (Devvit Integration) ─────────────────────────────
// Initializes the canvas game engine with the Devvit bridge.
// Detects inline vs expanded mode and shows overlay buttons when inline.

import { context, requestExpandedMode } from '@devvit/web/client';
import { consumePendingBuildRequest, consumePendingBuyShipRequest, createDevvitBridge, getGameState, setExternalStarNames, refreshGalaxyStarNames, setServerStarEconomy, setServerShipState } from '../game';
import type { DevvitBridge } from '../game';
import type { ShipShape } from '../game';
import { normalizeSharedShipShape } from '../shared/api';
import type {
  BuildBuildingRequest,
  ClaimPodResponse,
  ClaimedPodsResponse,
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
const username = context.username ?? 'pilot';
const postId = context.postId ?? 'standalone:dev';

// Set version in settings panel (Vite replaces __APP_VERSION__ in JS modules)
declare const __APP_VERSION__: string;
const versionEl = document.getElementById('settings-version');
if (versionEl) versionEl.textContent = 'v' + __APP_VERSION__;

// ── Debug log panel ─────────────────────────────────────────────────────────
const debugLog = document.getElementById('debug-log')!;
const debugToggle = document.getElementById('debug-toggle')!;
const _origLog = console.log;
const _origWarn = console.warn;
const _origError = console.error;
const MAX_DEBUG_LINES = 100;
function appendDebug(prefix: string, args: unknown[]) {
  const line = prefix + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
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
debugToggle.addEventListener('click', () => debugLog.classList.toggle('visible'));
const debugCopy = document.getElementById('debug-copy')!;
debugCopy.addEventListener('click', () => {
  const text = debugLog.textContent || '';
  void navigator.clipboard.writeText(text).then(() => {
    debugCopy.textContent = '\u2713';
    setTimeout(() => { debugCopy.innerHTML = '&#x2398;'; }, 1500);
  });
});

console.log(`[INIT] isInline=${isInline} username=${username} postId=${postId}`);

const sessionId = `${username}:${Math.random().toString(36).slice(2, 8)}`;

// ── Ship shape state ────────────────────────────────────────────────────────
let currentShape: ShipShape = 'arrow';
let currentName = username;



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
bridge.setShipShape('arrow');
bridge.setSharedWorldSeed(postId);

// Start rendering immediately (splash/preview mode — no networking yet)
bridge.beginSplash();

// ── Load user profile from server (deferred until play) ────────────────────
let profileReady: Promise<void> | null = null;

function loadPlayerProfile(): Promise<void> {
  if (profileReady) return profileReady;
  
  profileReady = fetch(`/api/profile?username=${encodeURIComponent(username)}`)
    .then(r => r.json())
    .then((profile: PlayerProfileResponse) => {
      if (profile.name) {
        currentName = profile.name;
        bridge.setPlayerName(profile.name);
        const nameInput = document.getElementById('ship-name-input') as HTMLInputElement | null;
        if (nameInput) nameInput.value = profile.name;
      }
      if (profile.shape && profile.shape !== 'arrow') {
        currentShape = profile.shape;
        bridge.setShipShape(profile.shape);
        document.querySelectorAll<HTMLButtonElement>('.shape-btn').forEach(b => {
          b.classList.toggle('selected', b.dataset.shape === profile.shape);
        });
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
          shape: item.shape || 'arrow',
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
    const res = await fetch(`/api/buildings?username=${encodeURIComponent(username)}&starIndex=${starIndex}`);
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
    const shipsRes = await fetch(`/api/ships?username=${encodeURIComponent(username)}&starIndex=${starIndex}`);
    if (shipsRes.ok) {
      const shipsData = await shipsRes.json() as StarShipsResponse;
      setServerShipState(starIndex, shipsData.ships, shipsData.building);
    }
  } catch {
    // Ignore temporary network errors.
  }
}

// ── Activate multiplayer networking ─────────────────────────────────────────
function startMultiplayer() {
  bridge.beginPlay(); // Activate networking callbacks on existing game
  ghostPollInterval = setInterval(pollGhosts, 250);
  shotPollInterval = setInterval(pollShots, 250);
  economyPollInterval = setInterval(pollEconomy, 1500);
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
  if (ghostPollInterval) clearInterval(ghostPollInterval);
  if (ghostListInterval) clearInterval(ghostListInterval);
  if (shotPollInterval) clearInterval(shotPollInterval);
  if (economyPollInterval) clearInterval(economyPollInterval);
  bridge.quit();
});

// ── Settings panel ──────────────────────────────────────────────────────────
const settingsBtn = document.getElementById('settings-btn')!;
const settingsPanel = document.getElementById('settings-panel')!;
const shapeButtons = settingsPanel.querySelectorAll<HTMLButtonElement>('.shape-btn');
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

shapeButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const shape = normalizeSharedShipShape(btn.dataset.shape);
    currentShape = shape;
    bridge.setShipShape(shape);
    shapeButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    settingsPanel.classList.remove('visible');
    saveProfile();
  });
});

// ── Save profile (debounced) ────────────────────────────────────────────────
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveProfile() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const payload: SaveProfileRequest = { username, name: currentName, shape: currentShape };
    fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, 500);
}


