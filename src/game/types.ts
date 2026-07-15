// ── Type Definitions ────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

export interface Ship {
  pos: Vec2;
  vel: Vec2;
  ang: number;
  thrust: boolean;
}

export interface Asteroid {
  pos: Vec2;
  pts: Vec2[];
  r: number;
}

export interface FuelPod {
  id: number;
  astIndex: number;
  pos: Vec2;
  discovered: boolean;
  collected: boolean;
  claimRequested: boolean;
  refuels: boolean;
  color: string;
}

export type ShipShape = 'arrow' | 'delta' | 'needle' | 'blade';

export enum ZoomState {
  Normal,
  Arming,
  Zoomed,
  Releasing,
}

export interface Ghost {
  slot: number;
  name: string;
  targetWorld: Vec2;
  targetAng: number;
  shape: ShipShape;
  curWorld: Vec2;
  curAng: number;
  hasCur: boolean;
}

export interface Projectile {
  id: string;
  shooterId: string;
  origin: Vec2;
  angle: number;
  speed: number;
  spawnTime: number;     // elapsed time when spawned
  own: boolean;          // true = fired by local player
}

export interface ShootingState {
  enabled: boolean;
  projectiles: Projectile[];
  cooldownRemaining: number;
  hp: number;
  invulnRemaining: number;
  hitFlashTimer: number;
}

export interface GameState {
  ship: Ship;
  tgtPos: Vec2;
  tgtActive: boolean;
  worldOffset: Vec2;
  asteroids: Asteroid[];
  asteroidNames: string[];
  pods: FuelPod[];
  ghosts: Ghost[];
  camera: Camera;
  fuelPercent: number;
  docksCollected: number;
  totalDocks: number;
  zoomState: ZoomState;
  zoomTimer: number;
  zoomOverride: number; // -1 = inactive, >= 0 = index of asteroid being overridden
  elapsedTime: number;
  playerName: string;
  shipShape: ShipShape;
  impactBufferWorld: number;
  playing: boolean;
  shooting: ShootingState;
}

export interface Camera {
  pos: Vec2;
  orthoSize: number;
  aspect: number;
}
