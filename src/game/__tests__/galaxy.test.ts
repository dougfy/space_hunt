import { describe, it, expect } from 'vitest';
import { checkTierTransition, applyTransition, NavigationTier } from '../galaxy';
import { vec2, magnitude, sub } from '../math';
import { SYSTEM_SIZE, BODY_ENTER_RADIUS, SYSTEM_EXIT_RADIUS, STAR_ENTER_RADIUS } from '../constants';
import {
  createBeltGalaxyState,
  createSystemGalaxyState,
  createPlanetBody,
  createBeltBody,
} from './test-utils';

const center = SYSTEM_SIZE / 2; // 20

describe('checkTierTransition', () => {
  describe('System tier → Local (belt entry)', () => {
    it('detects belt entry from inside (ship closer to star than belt)', () => {
      const orbitDist = 12;
      const galaxy = createSystemGalaxyState(orbitDist);
      // Ship just inside the belt ring (distance = orbitDist - 0.3)
      const shipPos = vec2(center + orbitDist - 0.3, center);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.Local);
      expect(transition!.enteredFromInside).toBe(true);
      expect(transition!.bodyIndex).toBe(0); // belt is index 0
    });

    it('detects belt entry from outside (ship further from star than belt)', () => {
      const orbitDist = 12;
      const galaxy = createSystemGalaxyState(orbitDist);
      // Ship just outside the belt ring (distance = orbitDist + 0.3)
      const shipPos = vec2(center + orbitDist + 0.3, center);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.Local);
      expect(transition!.enteredFromInside).toBe(false);
      expect(transition!.bodyIndex).toBe(0);
    });

    it('does NOT trigger if ship is too far from belt ring', () => {
      const orbitDist = 12;
      const galaxy = createSystemGalaxyState(orbitDist);
      // Ship 2 units inside belt (beyond 0.5 tolerance)
      const shipPos = vec2(center + orbitDist - 2, center);

      const transition = checkTierTransition(shipPos, galaxy);

      // Should not detect belt (might detect planet if close enough, or null)
      if (transition) {
        expect(transition.bodyIndex).not.toBe(0); // not the belt
      }
    });

    it('captures entry angle correctly', () => {
      const orbitDist = 12;
      const galaxy = createSystemGalaxyState(orbitDist);
      // Ship at 90 degrees (top of orbit)
      const shipPos = vec2(center, center + orbitDist - 0.2);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.entryAngle).toBeCloseTo(Math.PI / 2, 1);
    });
  });

  describe('System tier → Planet entry', () => {
    it('detects planet entry when ship is within BODY_ENTER_RADIUS', () => {
      const galaxy = createSystemGalaxyState();
      const planet = galaxy.bodies[1]; // planet is index 1
      // Ship right next to planet
      const shipPos = vec2(planet.pos.x + 0.5, planet.pos.y);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.Planet);
      expect(transition!.bodyIndex).toBe(1);
    });
  });

  describe('System tier → Galaxy exit', () => {
    it('exits to galaxy when ship exceeds SYSTEM_EXIT_RADIUS', () => {
      const galaxy = createSystemGalaxyState();
      // Ship far from center
      const shipPos = vec2(center + SYSTEM_EXIT_RADIUS + 1, center);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.Galaxy);
    });

    it('does NOT exit if ship is within SYSTEM_EXIT_RADIUS', () => {
      const galaxy = createSystemGalaxyState();
      const shipPos = vec2(center + SYSTEM_EXIT_RADIUS - 1, center);

      const transition = checkTierTransition(shipPos, galaxy);

      // Should only trigger belt or planet entry, not galaxy exit
      if (transition) {
        expect(transition.newTier).not.toBe(NavigationTier.Galaxy);
      }
    });
  });

  describe('Local tier → System exit', () => {
    it('exits when ship reaches positive Y boundary (top)', () => {
      const galaxy = createBeltGalaxyState({ fromInside: true });
      const shipPos = vec2(0, 7.6); // halfY=8, threshold=7.5

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.System);
      expect(transition!.exitDir!.y).toBeGreaterThan(0);
    });

    it('exits when ship reaches negative Y boundary (bottom)', () => {
      const galaxy = createBeltGalaxyState({ fromInside: true });
      const shipPos = vec2(0, -7.6);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.System);
      expect(transition!.exitDir!.y).toBeLessThan(0);
    });

    it('exits when ship reaches positive X boundary (right)', () => {
      const galaxy = createBeltGalaxyState({ fromInside: true });
      const shipPos = vec2(9.6, 0); // halfX=10, threshold=9.5

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.System);
      expect(transition!.exitDir!.x).toBeGreaterThan(0);
    });

    it('does NOT exit if ship is within bounds', () => {
      const galaxy = createBeltGalaxyState({ fromInside: true });
      const shipPos = vec2(3, 4);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).toBeNull();
    });
  });

  describe('Planet tier → System exit', () => {
    it('exits when ship exceeds exitX threshold', () => {
      const galaxy = createBeltGalaxyState();
      galaxy.tier = NavigationTier.Planet;
      const shipPos = vec2(4.6, 0); // exitX=4.5

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.System);
      expect(transition!.exitDir!.x).toBeGreaterThan(0);
    });

    it('exits when ship exceeds exitY threshold', () => {
      const galaxy = createBeltGalaxyState();
      galaxy.tier = NavigationTier.Planet;
      const shipPos = vec2(0, 2.9); // exitY=2.8

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.System);
      expect(transition!.exitDir!.y).toBeGreaterThan(0);
    });
  });

  describe('Galaxy tier → System entry', () => {
    it('enters system when ship is within STAR_ENTER_RADIUS', () => {
      const galaxy = createBeltGalaxyState();
      galaxy.tier = NavigationTier.Galaxy;
      const star = galaxy.stars[0]; // at (50, 50)
      const shipPos = vec2(star.pos.x + STAR_ENTER_RADIUS - 0.5, star.pos.y);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.System);
      expect(transition!.starIndex).toBe(0);
    });
  });
});

describe('applyTransition — belt exit placement', () => {
  describe('entered from inside (moving outward)', () => {
    it('places ship OUTSIDE belt when crossed through (exit top)', () => {
      const orbitDist = 12;
      const entryAngle = 0; // right side of orbit
      const galaxy = createBeltGalaxyState({ fromInside: true, entryAngle, orbitDist });

      // Simulate: ship exits Local tier at top (positive y) → crossed through
      const transition = {
        newTier: NavigationTier.System,
        starIndex: 0,
        bodyIndex: -1,
        exitDir: vec2(0, 1), // exited at top
      };

      const newPos = applyTransition(galaxy, transition);

      // Should be placed at orbitDist + 1.5 from center
      const distFromCenter = magnitude(sub(newPos, vec2(center, center)));
      expect(distFromCenter).toBeCloseTo(orbitDist + 1.5, 1);
    });

    it('places ship INSIDE belt when bounced back (exit bottom)', () => {
      const orbitDist = 12;
      const entryAngle = 0;
      const galaxy = createBeltGalaxyState({ fromInside: true, entryAngle, orbitDist });

      // Ship exits at bottom (negative y) → did NOT cross through
      const transition = {
        newTier: NavigationTier.System,
        starIndex: 0,
        bodyIndex: -1,
        exitDir: vec2(0, -1),
      };

      const newPos = applyTransition(galaxy, transition);

      const distFromCenter = magnitude(sub(newPos, vec2(center, center)));
      expect(distFromCenter).toBeCloseTo(orbitDist - 1.5, 1);
    });
  });

  describe('entered from outside (moving inward)', () => {
    it('places ship INSIDE belt when crossed through (exit bottom)', () => {
      const orbitDist = 12;
      const entryAngle = 0;
      const galaxy = createBeltGalaxyState({ fromInside: false, entryAngle, orbitDist });

      // Entered from outside → placed at top → crossing through = exiting at bottom
      const transition = {
        newTier: NavigationTier.System,
        starIndex: 0,
        bodyIndex: -1,
        exitDir: vec2(0, -1),
      };

      const newPos = applyTransition(galaxy, transition);

      const distFromCenter = magnitude(sub(newPos, vec2(center, center)));
      expect(distFromCenter).toBeCloseTo(orbitDist - 1.5, 1);
    });

    it('places ship OUTSIDE belt when bounced back (exit top)', () => {
      const orbitDist = 12;
      const entryAngle = 0;
      const galaxy = createBeltGalaxyState({ fromInside: false, entryAngle, orbitDist });

      // Entered from outside → placed at top → exiting at top = bounced back
      const transition = {
        newTier: NavigationTier.System,
        starIndex: 0,
        bodyIndex: -1,
        exitDir: vec2(0, 1),
      };

      const newPos = applyTransition(galaxy, transition);

      const distFromCenter = magnitude(sub(newPos, vec2(center, center)));
      expect(distFromCenter).toBeCloseTo(orbitDist + 1.5, 1);
    });
  });

  describe('angular placement', () => {
    it('preserves entry angle when placing on belt exit', () => {
      const orbitDist = 12;
      const entryAngle = Math.PI / 3; // 60 degrees
      const galaxy = createBeltGalaxyState({ fromInside: true, entryAngle, orbitDist });

      const transition = {
        newTier: NavigationTier.System,
        starIndex: 0,
        bodyIndex: -1,
        exitDir: vec2(0, 1), // crossed through
      };

      const newPos = applyTransition(galaxy, transition);

      // Check angle from center matches entry angle
      const actualAngle = Math.atan2(newPos.y - center, newPos.x - center);
      expect(actualAngle).toBeCloseTo(entryAngle, 1);
    });
  });
});

describe('applyTransition — Local tier entry placement', () => {
  it('places ship at y=-6 when entering from inside', () => {
    const galaxy = createSystemGalaxyState(12);
    const transition = {
      newTier: NavigationTier.Local,
      starIndex: 0,
      bodyIndex: 0,
      entryAngle: 0,
      enteredFromInside: true,
    };

    const newPos = applyTransition(galaxy, transition);

    expect(newPos.x).toBe(0);
    expect(newPos.y).toBe(-6);
  });

  it('places ship at y=+6 when entering from outside', () => {
    const galaxy = createSystemGalaxyState(12);
    const transition = {
      newTier: NavigationTier.Local,
      starIndex: 0,
      bodyIndex: 0,
      entryAngle: 0,
      enteredFromInside: false,
    };

    const newPos = applyTransition(galaxy, transition);

    expect(newPos.x).toBe(0);
    expect(newPos.y).toBe(6);
  });

  it('stores beltEnteredFromInside on galaxy state', () => {
    const galaxy = createSystemGalaxyState(12);
    const transition = {
      newTier: NavigationTier.Local,
      starIndex: 0,
      bodyIndex: 0,
      entryAngle: 1.5,
      enteredFromInside: false,
    };

    applyTransition(galaxy, transition);

    expect(galaxy.beltEnteredFromInside).toBe(false);
    expect(galaxy.bodyEntryAngle).toBeCloseTo(1.5);
    expect(galaxy.tier).toBe(NavigationTier.Local);
  });
});

describe('applyTransition — planet exit', () => {
  it('places ship near planet using exitDir', () => {
    const galaxy = createSystemGalaxyState();
    galaxy.tier = NavigationTier.Local; // pretend we were in local
    galaxy.currentBodyIndex = 1; // planet
    const planet = galaxy.bodies[1];

    const transition = {
      newTier: NavigationTier.System,
      starIndex: 0,
      bodyIndex: -1,
      exitDir: vec2(1, 0), // exited to the right
    };

    const newPos = applyTransition(galaxy, transition);

    // Should be placed to the right of the planet at BODY_ENTER_RADIUS + 0.5
    expect(newPos.x).toBeCloseTo(planet.pos.x + BODY_ENTER_RADIUS + 0.5, 1);
    expect(newPos.y).toBeCloseTo(planet.pos.y, 1);
  });
});
