// ── Ghost Ship Interpolation ────────────────────────────────────────────────

import type { Ghost, GameState } from './types';
import { vec2, lerpAngle } from './math';
import { normalizeShipShape } from './ship';

const GHOST_LERP_SPEED = 14;

export function updateGhosts(state: GameState, dt: number): void {
  for (let i = 0; i < state.ghosts.length; i++) {
    const g = state.ghosts[i];
    if (!g.hasCur) {
      g.curWorld = { ...g.targetWorld };
      g.curAng = g.targetAng;
      g.hasCur = true;
    } else {
      const t = Math.min(1, GHOST_LERP_SPEED * dt);
      g.curWorld = {
        x: g.curWorld.x + (g.targetWorld.x - g.curWorld.x) * t,
        y: g.curWorld.y + (g.targetWorld.y - g.curWorld.y) * t,
      };
      g.curAng = lerpAngle(g.curAng, g.targetAng, t);
    }
  }
}

export function setRemotePoses(state: GameState, items: RemotePoseItem[]): void {
  // Build a map of existing ghosts by slot
  const existing = new Map<number, Ghost>();
  for (const g of state.ghosts) {
    existing.set(g.slot, g);
  }

  const newGhosts: Ghost[] = [];
  for (const item of items) {
    const prev = existing.get(item.slot);
    const shape = normalizeShipShape(item.shape);
    if (prev) {
      prev.targetWorld = vec2(item.x, item.y);
      prev.targetAng = item.a;
      prev.name = item.name;
      prev.shape = shape;
      newGhosts.push(prev);
    } else {
      newGhosts.push({
        slot: item.slot,
        name: item.name,
        shape,
        targetWorld: vec2(item.x, item.y),
        targetAng: item.a,
        curWorld: vec2(item.x, item.y),
        curAng: item.a,
        hasCur: true,
      });
    }
  }
  state.ghosts = newGhosts;
}

export interface RemotePoseItem {
  slot: number;
  name: string;
  shape: string;
  x: number;
  y: number;
  a: number;
}
