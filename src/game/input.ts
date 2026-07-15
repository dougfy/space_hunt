// ── Input Handling ──────────────────────────────────────────────────────────

import type { Vec2, Camera, GameState } from './types';
import { screenToWorld } from './renderer';
import { SHOOTING_ENABLED } from './constants';

export interface InputState {
  pointerDown: boolean;
  pointerPos: Vec2 | null;
  rightClick: boolean;
  fireRequested: boolean;
  zoomToggleRequested: boolean;
}

export function createInputState(): InputState {
  return {
    pointerDown: false,
    pointerPos: null,
    rightClick: false,
    fireRequested: false,
    zoomToggleRequested: false,
  };
}

export function setupInput(
  canvas: HTMLCanvasElement,
  input: InputState,
  _getState: () => GameState | null,
  _getCamera: () => Camera,
): () => void {
  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    if (e.button === 2) {
      // Right click: clear target
      input.rightClick = true;
      return;
    }
    const pos = getCanvasPos(e, canvas);

    // Check fire button (bottom-right)
    if (SHOOTING_ENABLED) {
      const rect = canvas.getBoundingClientRect();
      const screenW = rect.width;
      const screenH = rect.height;
      const btnX = screenW - 50;
      const btnY = screenH - 60;
      const dx = pos.x - btnX;
      const dy = pos.y - btnY;
      if (dx * dx + dy * dy <= 34 * 34) {
        input.fireRequested = true;
        return;
      }

      // Check zoom toggle button (left of fire button)
      const zBtnX = screenW - 120;
      const zBtnY = screenH - 60;
      const zdx = pos.x - zBtnX;
      const zdy = pos.y - zBtnY;
      if (zdx * zdx + zdy * zdy <= 30 * 30) {
        input.zoomToggleRequested = true;
        return;
      }
    }

    input.pointerDown = true;
    input.pointerPos = pos;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (input.pointerDown) {
      input.pointerPos = getCanvasPos(e, canvas);
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.button === 0) {
      input.pointerDown = false;
    }
  };

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'crosshair';

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('contextmenu', onContextMenu);
  };
}

export function processInput(
  input: InputState,
  state: GameState,
  camera: Camera,
  screenW: number,
  screenH: number,
): void {
  if (input.rightClick) {
    state.tgtActive = false;
    input.rightClick = false;
  }

  if (input.pointerDown && input.pointerPos) {
    const worldPos = screenToWorld(input.pointerPos, camera, screenW, screenH);
    state.tgtPos = worldPos;
    state.tgtActive = true;
  }
}

function getCanvasPos(e: PointerEvent, canvas: HTMLCanvasElement): Vec2 {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}
