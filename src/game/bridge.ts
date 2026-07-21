// ── Devvit Bridge ───────────────────────────────────────────────────────────
// Compatibility layer matching the interface that game.tsx expects.
// Replaces the Unity SendMessage bridge with direct function calls.

import type { Projectile, ShipShape } from './types';
import { startGame, stopGame, getGameState, setGameCallbacks } from './game-loop';
import { setRemotePoses, RemotePoseItem } from './ghosts';
import { applyPodCollected } from './pods';
import { normalizeShipShape } from './ship';
import { addRemoteProjectiles } from './shooting';

export interface DevvitBridge {
  /** Start rendering in splash/preview mode (no networking) */
  beginSplash(): void;
  /** Activate multiplayer networking */
  beginPlay(): void;
  /** Set the player's display name */
  setPlayerName(name: string): void;
  /** Set ship shape: arrow | delta | needle | blade */
  setShipShape(shape: string): void;
  /** Set the deterministic world seed (post:xxx) */
  setSharedWorldSeed(seed: string): void;
  /** Push remote player poses (called from realtime updates) */
  setRemotePoses(json: string): void;
  /** Mark a pod as collected (from server broadcast) */
  setPodCollected(payload: string): void;
  /** Bulk set already-claimed pods on late-join */
  setCollectedPods(podIds: number[]): void;
  /** Stop and cleanup the game */
  quit(): void;
  /** Get the current ship's absolute world position and angle for pose reporting */
  getLocalPose(): { x: number; y: number; angle: number };
  /** Get current ghost ships with world positions */
  getGhosts(): Array<{ name: string; shape: string; x: number; y: number }>;
  /** Push remote shots into the game state */
  addRemoteShots(json: string): void;
}

/** Callbacks the game engine will invoke */
export interface DevvitCallbacks {
  /** Ship pose changed — report to server (throttled by caller) */
  onPose(x: number, y: number, angle: number, name: string, tier: number, starIndex: number, bodyIndex: number): void;
  /** Ship touched a fuel pod — request server claim */
  onClaimPod(podId: number): void;
  /** Player fired a burst — send shots to server */
  onFire(projectiles: Projectile[]): void;
}

let canvas: HTMLCanvasElement | null = null;
let callbacks: DevvitCallbacks | null = null;
let pendingSeed: string | null = null;
let pendingName = 'pilot';
let pendingShape: ShipShape = 'arrow';

export function createDevvitBridge(
  targetCanvas: HTMLCanvasElement,
  cb: DevvitCallbacks,
): DevvitBridge {
  canvas = targetCanvas;
  callbacks = cb;

  return {
    beginSplash() {
      if (!canvas || !pendingSeed) {
        console.log(`[BRIDGE] beginSplash bail: canvas=${!!canvas} seed=${!!pendingSeed}`);
        return;
      }
      if (getGameState()) {
        console.log(`[BRIDGE] beginSplash bail: game already running`);
        return;
      }
      startGame(canvas, pendingSeed, pendingName, pendingShape, null);
      const gs = getGameState();
      console.log(`[BRIDGE] beginSplash: tier=${gs?.galaxy.tier} splashMode=${gs?.splashMode} asteroids=${gs?.asteroids.length}`);
    },

    beginPlay() {
      if (!canvas || !callbacks || !pendingSeed) {
        console.log(`[BRIDGE] beginPlay bail: canvas=${!!canvas} callbacks=${!!callbacks} seed=${!!pendingSeed}`);
        return;
      }
      const s = getGameState();
      console.log(`[BRIDGE] beginPlay: gameState=${!!s} splashMode=${s?.splashMode}`);
      if (s && s.splashMode) {
        // Transition from splash to real game — stop splash, start fresh
        stopGame();
        startGame(canvas, pendingSeed, pendingName, pendingShape, callbacks);
        console.log(`[BRIDGE] beginPlay: transitioned from splash to play, tier=${getGameState()?.galaxy.tier}`);
      } else if (s) {
        // Game already running (non-splash) — just activate networking
        setGameCallbacks(callbacks);
      } else {
        // Start fresh with networking
        startGame(canvas, pendingSeed, pendingName, pendingShape, callbacks);
        console.log(`[BRIDGE] beginPlay: started fresh, tier=${getGameState()?.galaxy.tier}`);
      }
    },

    setPlayerName(name: string) {
      const n = name.trim() || 'pilot';
      pendingName = n;
      const s = getGameState();
      if (s) s.playerName = n;
    },

    setShipShape(shape: string) {
      pendingShape = normalizeShipShape(shape);
      const s = getGameState();
      if (s) s.shipShape = pendingShape;
    },

    setSharedWorldSeed(seed: string) {
      pendingSeed = seed;
    },

    setRemotePoses(json: string) {
      const s = getGameState();
      if (!s) return;
      try {
        const payload = JSON.parse(json) as { items: RemotePoseItem[] };
        setRemotePoses(s, payload.items);
      } catch {
        // ignore malformed
      }
    },

    setPodCollected(payload: string) {
      const s = getGameState();
      if (!s) return;
      // payload = "podId:mine(0|1)"
      const parts = payload.split(':');
      const rawPodId = parts[0];
      if (!rawPodId) return;
      const podId = parseInt(rawPodId, 10);
      const mine = parts[1] === '1';
      if (!isNaN(podId)) {
        applyPodCollected(s, podId, mine);
      }
    },

    setCollectedPods(podIds: number[]) {
      const s = getGameState();
      if (!s) return;
      for (const id of podIds) {
        applyPodCollected(s, id, false);
      }
    },

    quit() {
      stopGame();
    },

    getLocalPose() {
      const s = getGameState();
      if (!s) return { x: 0, y: 0, angle: 0 };
      return {
        x: s.ship.pos.x + s.worldOffset.x,
        y: s.ship.pos.y + s.worldOffset.y,
        angle: s.ship.ang,
      };
    },

    getGhosts() {
      const s = getGameState();
      if (!s) return [];
      return s.ghosts.filter(g => g.hasCur).map(g => ({
        name: g.name,
        shape: g.shape as string,
        x: Math.round(g.curWorld.x * 100) / 100,
        y: Math.round(g.curWorld.y * 100) / 100,
      }));
    },

    addRemoteShots(json: string) {
      const s = getGameState();
      if (!s) return;
      try {
        const payload = JSON.parse(json) as { shots: (Projectile & { shooterId?: string })[] };
        if (payload.shots && payload.shots.length) {
          // Convert remote absolute spawnTime to local elapsed-time
          for (const p of payload.shots) {
            p.spawnTime = s.elapsedTime - (Date.now() / 1000 - p.spawnTime);

            // Snap origin to shooter's current ghost position (in local coords)
            // so shots don't appear to start behind the ghost due to latency
            if (p.shooterId) {
              const shooterName = p.shooterId.split(':')[0];
              const ghost = s.ghosts.find(g => g.name === shooterName && g.hasCur);
              if (ghost) {
                p.origin = {
                  x: ghost.curWorld.x - s.worldOffset.x,
                  y: ghost.curWorld.y - s.worldOffset.y,
                };
              }
            }
          }
          addRemoteProjectiles(s, payload.shots);
        }
      } catch {
        // ignore malformed
      }
    },
  };
}
