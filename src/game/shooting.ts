// ── Shooting System ─────────────────────────────────────────────────────────

import type { GameState, Projectile, ShootingState, Vec2 } from './types';
import {
  SHOOTING_ENABLED,
  SHOT_BURST_COUNT,
  SHOT_SPREAD_DEG,
  SHOT_SPEED,
  SHOT_LIFETIME,
  SHOT_COOLDOWN,
  SHOT_HIT_RADIUS,
  PLAYER_MAX_HP,
  HIT_INVULN_TIME,
  RESPAWN_INVULN_TIME,
} from './constants';

export function createShootingState(): ShootingState {
  return {
    enabled: SHOOTING_ENABLED,
    projectiles: [],
    cooldownRemaining: 0,
    hp: PLAYER_MAX_HP,
    invulnRemaining: 0,
    hitFlashTimer: 0,
  };
}

/** Fire a burst toward the nearest ghost (or forward if none in range). */
export function fireBurst(state: GameState): Projectile[] | null {
  const { shooting, ship, worldOffset, ghosts, elapsedTime } = state;
  if (!shooting.enabled) return null;
  if (shooting.cooldownRemaining > 0) return null;

  // Determine aim angle: toward nearest ghost, or ship facing direction
  // All positions in local (camera-relative) coordinates
  let aimAngle = ship.ang;
  let closestDist = Infinity;

  for (const g of ghosts) {
    if (!g.hasCur) continue;
    // Convert ghost world pos to local coords for aiming
    const gLocalX = g.curWorld.x - worldOffset.x;
    const gLocalY = g.curWorld.y - worldOffset.y;
    const dx = gLocalX - ship.pos.x;
    const dy = gLocalY - ship.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Only auto-aim within a reasonable range (~5 world units)
    if (dist < 5 && dist < closestDist) {
      closestDist = dist;
      aimAngle = Math.atan2(dy, dx);
    }
  }

  // Generate burst with spread
  const spreadRad = (SHOT_SPREAD_DEG * Math.PI) / 180;
  const projectiles: Projectile[] = [];
  const step = SHOT_BURST_COUNT > 1 ? spreadRad / (SHOT_BURST_COUNT - 1) : 0;
  const startAngle = aimAngle - spreadRad / 2;

  for (let i = 0; i < SHOT_BURST_COUNT; i++) {
    const angle = SHOT_BURST_COUNT > 1 ? startAngle + step * i : aimAngle;
    projectiles.push({
      id: `${Date.now()}-${i}`,
      shooterId: '__local__',
      origin: { x: ship.pos.x, y: ship.pos.y },
      angle,
      speed: SHOT_SPEED,
      spawnTime: elapsedTime,
      own: true,
    });
  }

  shooting.cooldownRemaining = SHOT_COOLDOWN;
  shooting.projectiles.push(...projectiles);

  return projectiles;
}

/** Add remote projectiles (from other players via polling). Deduplicates by ID. */
export function addRemoteProjectiles(state: GameState, projectiles: Projectile[]) {
  const existingIds = new Set(state.shooting.projectiles.map(p => p.id));
  for (const p of projectiles) {
    if (existingIds.has(p.id)) continue; // Already have this shot
    p.own = false;
    state.shooting.projectiles.push(p);
  }
}

/** Get the current world position of a projectile. */
export function getProjectilePos(p: Projectile, elapsedTime: number): Vec2 {
  const age = elapsedTime - p.spawnTime;
  return {
    x: p.origin.x + Math.cos(p.angle) * p.speed * age,
    y: p.origin.y + Math.sin(p.angle) * p.speed * age,
  };
}

/** Update shooting state each frame. Returns true if player was hit this frame. */
export function updateShooting(state: GameState, dt: number): boolean {
  const { shooting, ship, worldOffset, elapsedTime } = state;
  if (!shooting.enabled) return false;

  // Cooldown tick
  if (shooting.cooldownRemaining > 0) {
    shooting.cooldownRemaining = Math.max(0, shooting.cooldownRemaining - dt);
  }

  // Invulnerability tick
  if (shooting.invulnRemaining > 0) {
    shooting.invulnRemaining = Math.max(0, shooting.invulnRemaining - dt);
  }

  // Hit flash tick
  if (shooting.hitFlashTimer > 0) {
    shooting.hitFlashTimer = Math.max(0, shooting.hitFlashTimer - dt);
  }

  // Remove expired projectiles
  shooting.projectiles = shooting.projectiles.filter(
    p => (elapsedTime - p.spawnTime) < SHOT_LIFETIME,
  );

  // Check if any enemy projectile hits local player
  let wasHit = false;
  if (shooting.invulnRemaining <= 0) {
    const playerWorld: Vec2 = {
      x: ship.pos.x + worldOffset.x,
      y: ship.pos.y + worldOffset.y,
    };

    for (let i = shooting.projectiles.length - 1; i >= 0; i--) {
      const p = shooting.projectiles[i];
      if (!p) continue;
      if (p.own) continue; // Can't hit yourself

      const pos = getProjectilePos(p, elapsedTime);
      const dx = pos.x - playerWorld.x;
      const dy = pos.y - playerWorld.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < SHOT_HIT_RADIUS) {
        // Hit!
        shooting.projectiles.splice(i, 1);
        shooting.hp--;
        shooting.hitFlashTimer = 0.15;
        wasHit = true;

        if (shooting.hp <= 0) {
          // "Death" — respawn with invuln
          shooting.hp = PLAYER_MAX_HP;
          shooting.invulnRemaining = RESPAWN_INVULN_TIME;
        } else {
          // Brief invulnerability to prevent duplicate hits
          shooting.invulnRemaining = HIT_INVULN_TIME;
        }
        break; // Only one hit per frame
      }
    }
  }

  return wasHit;
}

/** Check if firing is ready. */
export function canFire(state: GameState): boolean {
  return state.shooting.enabled && state.shooting.cooldownRemaining <= 0;
}

/** Get cooldown progress (0 = ready, 1 = just fired). */
export function getCooldownProgress(state: GameState): number {
  if (SHOT_COOLDOWN <= 0) return 0;
  return state.shooting.cooldownRemaining / SHOT_COOLDOWN;
}
