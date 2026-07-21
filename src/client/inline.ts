// ── Space Hunt Inline Entry (Attract Mode) ──────────────────────────────────
// Shows the game running in the background with overlay buttons.
// "Play Here" dismisses overlay and starts gameplay inline.
// "Play Full Size" requests expanded mode (loads 'game' entrypoint).

import { context, requestExpandedMode } from '@devvit/web/client';
import { createDevvitBridge } from '../game';
import type { DevvitBridge } from '../game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas #game-canvas not found');

const overlay = document.getElementById('overlay')!;
const playHereBtn = document.getElementById('play-here')!;
const playFullBtn = document.getElementById('play-full')!;

// ── Devvit context ──────────────────────────────────────────────────────────
const username = context.username ?? 'pilot';
const postId = context.postId ?? 'standalone:dev';

// ── Create bridge (game runs in splash/attract mode — no networking) ────────
const bridge: DevvitBridge = createDevvitBridge(canvas, {
  onPose() {},
  onClaimPod(podId) {
    bridge.setPodCollected(`${podId}:1`);
  },
  onFire() {},
});

bridge.setPlayerName(username);
bridge.setShipShape('arrow');
bridge.setSharedWorldSeed(postId);
bridge.beginSplash();

// ── Button handlers ─────────────────────────────────────────────────────────
playHereBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
playHereBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  overlay.style.display = 'none';
  // Start multiplayer inline
  bridge.beginPlay();
});

playFullBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
playFullBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  requestExpandedMode(e, 'game');
});
