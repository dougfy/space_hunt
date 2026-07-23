// ── Input Handling ──────────────────────────────────────────────────────────

import type { Vec2, Camera, GameState } from './types';
import { screenToWorld } from './renderer';
import { NavigationTier } from './galaxy';

export interface InputState {
  pointerDown: boolean;
  pointerPos: Vec2 | null;
  cursorPos: Vec2 | null; // always tracks cursor, even without click
  rightClick: boolean;
  fireRequested: boolean;
  zoomToggleRequested: boolean;
  recenterRequested: boolean;
  scrollDelta: number; // accumulated scroll/pinch delta for galaxy zoom
  keysDown: Set<string>;
}

export function createInputState(): InputState {
  return {
    pointerDown: false,
    pointerPos: null,
    cursorPos: null,
    rightClick: false,
    fireRequested: false,
    zoomToggleRequested: false,
    recenterRequested: false,
    scrollDelta: 0,
    keysDown: new Set(),
  };
}

export function setupInput(
  canvas: HTMLCanvasElement,
  input: InputState,
  getState: () => GameState | null,
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
    const rect = canvas.getBoundingClientRect();
    const screenW = rect.width;
    const screenH = rect.height;

    const state = getState();
    const isLocalTier = state?.galaxy.tier === NavigationTier.Local;
    const showRecenter = state?.galaxy.tier !== NavigationTier.Local;

    if (showRecenter) {
      // Check recenter button (bottom-right)
      const rcX = screenW - 36;
      const rcY = screenH - 36;
      const rcdx = pos.x - rcX;
      const rcdy = pos.y - rcY;
      if (rcdx * rcdx + rcdy * rcdy <= 26 * 26) {
        input.recenterRequested = true;
        return;
      }
    }

    // Local zoom is a primary nav control; handle it first so taps never fall through to movement.
    if (isLocalTier) {
      const zBtnX = screenW - 120;
      const zBtnY = screenH - 60;
      const zdx = pos.x - zBtnX;
      const zdy = pos.y - zBtnY;
      if (zdx * zdx + zdy * zdy <= 30 * 30) {
        input.zoomToggleRequested = true;
        return;
      }
    }

    const shootingEnabled = state?.shooting.enabled === true;

    // Check fire button (bottom-right, above recenter area)
    if (shootingEnabled) {
      const btnX = screenW - 50;
      const btnY = screenH - 60;
      const dx = pos.x - btnX;
      const dy = pos.y - btnY;
      if (dx * dx + dy * dy <= 34 * 34) {
        input.fireRequested = true;
        return;
      }

    }

    input.pointerDown = true;
    input.pointerPos = pos;
  };

  const onPointerMove = (e: PointerEvent) => {
    input.cursorPos = getCanvasPos(e, canvas);
    if (input.pointerDown) {
      input.pointerPos = input.cursorPos;
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

  // ── Scroll wheel zoom (galaxy map) ──
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    // Normalize: deltaY > 0 = scroll down = zoom out (increase ortho)
    input.scrollDelta += e.deltaY > 0 ? 1 : -1;
  };
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // ── Pinch zoom (touch, galaxy map) ──
  let pinchDist = 0;
  const activeTouches = new Map<number, { x: number; y: number }>();

  const onTouchStart = (e: TouchEvent) => {
    for (const t of Array.from(e.touches)) {
      activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (activeTouches.size === 2) {
      const pts = Array.from(activeTouches.values());
      pinchDist = Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y);
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    for (const t of Array.from(e.touches)) {
      activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (activeTouches.size === 2) {
      const pts = Array.from(activeTouches.values());
      const newDist = Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y);
      const delta = newDist - pinchDist;
      // Pinch in (fingers closer) = zoom out; pinch out = zoom in
      if (Math.abs(delta) > 8) {
        input.scrollDelta += delta > 0 ? -1 : 1;
        pinchDist = newDist;
      }
    }
  };
  const onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      activeTouches.delete(t.identifier);
    }
    if (activeTouches.size < 2) pinchDist = 0;
  };
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });

  // Keyboard listeners (on window so they work even when canvas isn't focused)
  const MOVEMENT_KEYS = new Set([
    'w', 'a', 's', 'd',
    'h', 'j', 'k', 'l',
    'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  ]);

  const onKeyDown = (e: KeyboardEvent) => {
    // Don't intercept keys when typing in an input field
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const key = e.key.toLowerCase();
    if (MOVEMENT_KEYS.has(key) || key === ' ') {
      e.preventDefault();
      input.keysDown.add(key);
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    input.keysDown.delete(key);
  };

  // Clear keys when window loses focus
  const onBlur = () => { input.keysDown.clear(); };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('contextmenu', onContextMenu);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
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

  // Check if any movement key is held
  const anyMovementKey = hasMovementKey(input.keysDown);

  // Auto-detect input mode: keyboard keys switch to keyboard, pointer click switches to mouse
  if (anyMovementKey) {
    state.inputMode = 'keyboard';
  }
  if (input.pointerDown && input.pointerPos) {
    state.inputMode = 'mouse';
  }

  if (state.inputMode === 'keyboard') {
    // Rotation-based steering: left/right turn, up thrusts forward
    state.keyTurnRate = 0;
    if (input.keysDown.has('a') || input.keysDown.has('arrowleft') || input.keysDown.has('h'))  state.keyTurnRate += 1;  // turn left (CCW)
    if (input.keysDown.has('d') || input.keysDown.has('arrowright') || input.keysDown.has('l')) state.keyTurnRate -= 1;  // turn right (CW)
    state.keyThrust = input.keysDown.has('w') || input.keysDown.has('arrowup') || input.keysDown.has('k');
    if (anyMovementKey) {
      state.tgtActive = false;
    }
    // Space bar fires
    if (input.keysDown.has(' ')) {
      input.fireRequested = true;
    }
  } else {
    // Mouse mode: click sets target
    state.keyThrust = false;
    state.keyTurnRate = 0;
    if (input.pointerDown && input.pointerPos) {
      const worldPos = screenToWorld(input.pointerPos, camera, screenW, screenH);
      state.tgtPos = worldPos;
      state.tgtActive = true;
      console.log('[CLICK] screenPos=', input.pointerPos, 'worldPos=', worldPos, 'tier=', state.galaxy.tier, 'shipPos=', state.ship.pos, 'worldOffset=', state.worldOffset);
    }
  }
}

/** Check if any movement key is currently held */
function hasMovementKey(keysDown: Set<string>): boolean {
  return keysDown.has('w') || keysDown.has('a') || keysDown.has('s') || keysDown.has('d') ||
    keysDown.has('h') || keysDown.has('j') || keysDown.has('k') || keysDown.has('l') ||
    keysDown.has('arrowup') || keysDown.has('arrowdown') || keysDown.has('arrowleft') || keysDown.has('arrowright');
}

function getCanvasPos(e: PointerEvent, canvas: HTMLCanvasElement): Vec2 {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}
