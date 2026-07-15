// ── Space Hunt Inline Entry (Attract Mode) ──────────────────────────────────
// Shows the game running in the background with overlay buttons.
// "Play Here" dismisses overlay and starts gameplay inline.
// "Play Full Size" requests expanded mode.

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

// ── Create bridge (game runs in attract/demo mode) ──────────────────────────
const bridge: DevvitBridge = createDevvitBridge(canvas, {
  onPose(_x, _y, _angle) {
    // No pose reporting in attract mode
  },
  onClaimPod(podId) {
    // Auto-approve in attract mode
    bridge.setPodCollected(`${podId}:1`);
  },
});

bridge.setPlayerName(username);
bridge.setShipShape('arrow');
bridge.setSharedWorldSeed(postId);
bridge.beginPlay();

// ── Button handlers ─────────────────────────────────────────────────────────
playHereBtn.addEventListener('click', () => {
  // Dismiss overlay, game continues inline
  overlay.style.display = 'none';
});

playFullBtn.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});
