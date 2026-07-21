import { describe, expect, it } from 'vitest';
import {
  normalizeSharedShipShape,
  type ClaimPodResponse,
  type PlayerProfileResponse,
  type PoseUpdateRequest,
  type RoomPosesResponse,
  type ShotsResponse,
} from '../api';

describe('shared API contracts', () => {
  it('normalizes unknown ship shapes to arrow', () => {
    expect(normalizeSharedShipShape(undefined)).toBe('arrow');
    expect(normalizeSharedShipShape('bogus')).toBe('arrow');
    expect(normalizeSharedShipShape('blade')).toBe('blade');
  });

  it('supports representative multiplayer payloads', () => {
    const pose: PoseUpdateRequest = {
      x: 12,
      y: 24,
      angle: 1.2,
      username: 'pilot',
      sessionId: 'pilot:abcd',
      shape: 'needle',
      tier: 1,
      starIndex: 3,
      bodyIndex: -1,
    };

    const room: RoomPosesResponse = {
      items: [{ username: 'pilot', x: pose.x, y: pose.y, angle: pose.angle, shape: 'needle' }],
    };

    const shots: ShotsResponse = {
      shots: [{ id: 's1', shooterId: 'pilot:abcd', origin: { x: 0, y: 0 }, angle: 0, speed: 10, spawnTime: 123 }],
    };

    const claim: ClaimPodResponse = { success: true, podId: 7, mine: true };
    const profile: PlayerProfileResponse = { name: 'pilot', shape: 'delta' };

    expect(room.items).toHaveLength(1);
    expect(shots.shots).toHaveLength(1);
    const roomItem = room.items[0];
    const shotItem = shots.shots[0];
    if (!roomItem || !shotItem) {
      throw new Error('Expected representative payload items');
    }

    expect(roomItem.shape).toBe('needle');
    expect(shotItem.shooterId).toBe('pilot:abcd');
    expect(claim.mine).toBe(true);
    expect(profile.shape).toBe('delta');
  });
});