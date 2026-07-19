// ── Space Hunt Game Entry (Devvit Integration) ─────────────────────────────
// Initializes the canvas game engine with the Devvit bridge.
// Detects inline vs expanded mode and shows overlay buttons when inline.

import { context, getWebViewMode, requestExpandedMode } from '@devvit/web/client';
import { createDevvitBridge, getGameState, setExternalStarNames, refreshGalaxyStarNames } from '../game';
import type { DevvitBridge } from '../game';

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

  try {
    const url = 'https://cdn.jsdelivr.net/gh/dariusk/corpora@master/data/astronomy/stars.json';
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return;
    const data = await res.json() as { stars?: string[] };
    const names = Array.isArray(data.stars) ? data.stars : [];
    if (names.length > 0) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(names));
      } catch {
        // Ignore storage quota/privacy mode issues.
      }
      setExternalStarNames(names);
      refreshGalaxyStarNames();
    }
  } catch {
    // Internet fetch is optional; fallback names remain active.
  }
}

void loadRealStarNames();

const overlay = document.getElementById('overlay')!;
const playHereBtn = document.getElementById('play-here')!;
const playFullBtn = document.getElementById('play-full')!;

// ── Mode detection ──────────────────────────────────────────────────────────
const mode = getWebViewMode();
const isInline = mode === 'inline';

if (isInline) {
  overlay.classList.add('visible');
}

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
  navigator.clipboard.writeText(text).then(() => {
    debugCopy.textContent = '\u2713';
    setTimeout(() => { debugCopy.innerHTML = '&#x2398;'; }, 1500);
  });
});

const sessionId = `${username}:${Math.random().toString(36).slice(2, 8)}`;

// ── Ship shape state ────────────────────────────────────────────────────────
let currentShape = 'arrow';
let currentName = username;



// ── Create bridge ───────────────────────────────────────────────────────────
const bridge: DevvitBridge = createDevvitBridge(canvas, {
  onPose(x, y, angle, name, tier, starIndex, bodyIndex) {
    const sentName = name || currentName;
    // Send pose to server via Devvit API route
    fetch('/api/pose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y, angle, username: sentName, sessionId, shape: currentShape, tier, starIndex, bodyIndex }),
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
      .then((res: { success: boolean; podId: number; mine: boolean }) => {
        if (res.success) {
          bridge.setPodCollected(`${res.podId}:${res.mine ? '1' : '0'}`);
        }
      })
      .catch(() => {
        // Auto-approve on network failure (offline mode)
        bridge.setPodCollected(`${podId}:1`);
      });
  },
  onFire(projectiles) {
    // Send fired shots to server
    const payload = projectiles.map(p => ({
      id: p.id,
      origin: p.origin,
      angle: p.angle,
      speed: p.speed,
      spawnTime: Date.now() / 1000,
    }));
    fetch('/api/shots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, shots: payload }),
    }).catch(() => {});
  },
});

// ── Configure and start solo preview ────────────────────────────────────────
bridge.setPlayerName(username);
bridge.setShipShape('arrow');
bridge.setSharedWorldSeed(postId);
bridge.beginPreview(); // Start rendering immediately (ship + asteroids, no network)

// ── Load user profile from server ───────────────────────────────────────────
const profileReady = fetch(`/api/profile?username=${encodeURIComponent(username)}`)
  .then(r => r.json())
  .then((profile: { name: string; shape: string }) => {

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

// ── Realtime ghost updates (poll for now, replace with SSE/WS later) ────────
let ghostPollInterval: ReturnType<typeof setInterval> | null = null;
let shotPollInterval: ReturnType<typeof setInterval> | null = null;

async function pollGhosts() {
  try {
    const gs = getGameState();
    const tier = gs?.galaxy.tier ?? 0;
    const starIndex = gs?.galaxy.currentStarIndex ?? -1;
    const bodyIndex = gs?.galaxy.currentBodyIndex ?? -1;
    const res = await fetch(`/api/room-poses?postId=${encodeURIComponent(postId)}&exclude=${encodeURIComponent(sessionId)}&tier=${tier}&starIndex=${starIndex}&bodyIndex=${bodyIndex}`);
    if (res.ok) {
      const data = await res.json() as { items: Array<{ username: string; x: number; y: number; angle: number; shape: string }> };
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
      const data = await res.json() as { shots: Array<{ id: string; shooterId: string; origin: { x: number; y: number }; angle: number; speed: number; spawnTime: number }> };
      if (data.shots && data.shots.length) {
        bridge.addRemoteShots(JSON.stringify(data));
      }
    }
  } catch {
    // ignore
  }
}

// ── Activate multiplayer networking ─────────────────────────────────────────
function startMultiplayer() {
  bridge.beginPlay(); // Activate networking callbacks on existing game
  ghostPollInterval = setInterval(pollGhosts, 250);
  shotPollInterval = setInterval(pollShots, 250);

  // Fetch already-claimed pods so late-joiners see correct state
  fetch(`/api/claimed-pods?postId=${encodeURIComponent(postId)}`)
    .then(r => r.json())
    .then((data: { podIds: number[] }) => {
      if (data.podIds && data.podIds.length) {
        bridge.setCollectedPods(data.podIds);
      }
    })
    .catch(() => {});
}

// In expanded mode, start immediately (user already chose to play).
// In inline mode, wait until user presses "Play Here".
if (!isInline) {
  profileReady.then(() => startMultiplayer());
}

// ── Cleanup on page hide ────────────────────────────────────────────────────
window.addEventListener('pagehide', () => {
  if (ghostPollInterval) clearInterval(ghostPollInterval);
  if (ghostListInterval) clearInterval(ghostListInterval);
  if (shotPollInterval) clearInterval(shotPollInterval);
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
let ghostListInterval: ReturnType<typeof setInterval> | null = null;

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
    const shape = btn.dataset.shape!;
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
    fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, name: currentName, shape: currentShape }),
    }).catch(() => {});
  }, 500);
}

// ── Overlay button handlers (inline mode) ───────────────────────────────────
if (isInline) {
  playHereBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  playHereBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.classList.remove('visible');
    startMultiplayer();
  });

  playFullBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  playFullBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.classList.remove('visible');
    startMultiplayer();
    requestExpandedMode(e, 'game');
  });
}
