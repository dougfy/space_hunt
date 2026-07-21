import { describe, it, expect } from 'vitest';
import { checkTierTransition, applyTransition, createGalaxyState, NavigationTier } from '../galaxy';
import { vec2 } from '../math';
import { SYSTEM_SIZE, SYSTEM_EXIT_RADIUS, STAR_ENTER_RADIUS } from '../constants';
import {
  createBeltGalaxyState,
  createSystemGalaxyState,
} from './test-utils';

const center = SYSTEM_SIZE / 2; // 20

describe('checkTierTransition', () => {
  describe('System tier → Local (belt entry)', () => {
    it('detects belt entry from inside', () => {
      const orbitDist = 12;
      const galaxy = createSystemGalaxyState(orbitDist);
      const shipPos = vec2(center + orbitDist - 0.3, center);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.Local);
      expect(transition!.enteredFromInside).toBe(true);
      expect(transition!.bodyIndex).toBe(0);
    });

    it('detects belt entry from outside', () => {
      const orbitDist = 12;
      const galaxy = createSystemGalaxyState(orbitDist);
      const shipPos = vec2(center + orbitDist + 0.3, center);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.Local);
      expect(transition!.enteredFromInside).toBe(false);
    });

    it('does NOT trigger if ship is too far from belt ring', () => {
      const orbitDist = 12;
      const galaxy = createSystemGalaxyState(orbitDist);
      const shipPos = vec2(center + orbitDist - 2, center);

      const transition = checkTierTransition(shipPos, galaxy);

      if (transition) {
        expect(transition.bodyIndex).not.toBe(0);
      }
    });

    it('captures entry angle correctly', () => {
      const orbitDist = 12;
      const galaxy = createSystemGalaxyState(orbitDist);
      const shipPos = vec2(center, center + orbitDist - 0.2);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.entryAngle).toBeCloseTo(Math.PI / 2, 1);
    });
  });

  describe('Local tier → System exit (ring model)', () => {
    it('exits when ship moves far outside belt orbit', () => {
      const orbitDist = 12;
      const galaxy = createBeltGalaxyState({ fromInside: true, orbitDist });
      // exitThreshold = BELT_HALF_WIDTH(3) + 0.5 = 3.5
      // Ship at orbitDist + 3.6 from center → |dist - orbitDist| = 3.6 > 3.5
      const shipPos = vec2(center + orbitDist + 3.6, center);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.System);
    });

    it('exits when ship moves far inside belt orbit', () => {
      const orbitDist = 12;
      const galaxy = createBeltGalaxyState({ fromInside: true, orbitDist });
      const shipPos = vec2(center + orbitDist - 3.6, center);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.System);
    });

    it('does NOT exit if ship is on the orbit ring', () => {
      const orbitDist = 12;
      const galaxy = createBeltGalaxyState({ fromInside: true, orbitDist });
      const shipPos = vec2(center + orbitDist, center);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).toBeNull();
    });

    it('does NOT exit if ship is near edge but within threshold', () => {
      const orbitDist = 12;
      const galaxy = createBeltGalaxyState({ fromInside: true, orbitDist });
      // |dist - orbitDist| = 3.0 < 3.5 threshold
      const shipPos = vec2(center + orbitDist + 3.0, center);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).toBeNull();
    });
  });

  describe('System tier → Galaxy exit', () => {
    it('exits to galaxy when ship exceeds SYSTEM_EXIT_RADIUS', () => {
      const galaxy = createSystemGalaxyState();
      const shipPos = vec2(center + SYSTEM_EXIT_RADIUS + 1, center);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.Galaxy);
    });

    it('passes exitDir for galaxy exit', () => {
      const galaxy = createSystemGalaxyState();
      const shipPos = vec2(center + SYSTEM_EXIT_RADIUS + 1, center);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition!.exitDir).toBeDefined();
      expect(transition!.exitDir!.x).toBeGreaterThan(0);
    });
  });

  describe('Planet tier → System exit', () => {
    it('exits when ship exceeds exitX threshold', () => {
      const galaxy = createBeltGalaxyState();
      galaxy.tier = NavigationTier.Planet;
      const shipPos = vec2(4.6, 0);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.System);
    });
  });

  describe('Galaxy tier → System entry', () => {
    it('enters system when ship is within STAR_ENTER_RADIUS', () => {
      const galaxy = createBeltGalaxyState();
      galaxy.tier = NavigationTier.Galaxy;
      const star = galaxy.stars[0];
      if (!star) throw new Error('Expected test star');
      const shipPos = vec2(star.pos.x + STAR_ENTER_RADIUS - 0.5, star.pos.y);

      const transition = checkTierTransition(shipPos, galaxy);

      expect(transition).not.toBeNull();
      expect(transition!.newTier).toBe(NavigationTier.System);
    });
  });
});

describe('applyTransition — ring model', () => {
  describe('star ownership and discovery', () => {
    it('assigns the starting home star to the player and marks it discovered', () => {
      const galaxy = createGalaxyState('ownership-seed');
      const homeStar = galaxy.stars[galaxy.homeStarIndex];
      if (!homeStar) throw new Error('Expected home star');

      expect(homeStar.owner).toBe('player');
      expect(homeStar.discovered).toBe(true);
    });

    it('marks a foreign star discovered when entering its system from galaxy view', () => {
      const galaxy = createGalaxyState('ownership-seed');
      const foreignStar = galaxy.stars.find((star) => star.index !== galaxy.homeStarIndex);

      expect(foreignStar).toBeDefined();
      expect(foreignStar!.owner).toBe('foreign');
      expect(foreignStar!.discovered).toBe(false);

      galaxy.tier = NavigationTier.Galaxy;
      galaxy.currentStarIndex = -1;
      galaxy.currentBodyIndex = -1;
      galaxy.bodies = [];

      applyTransition(galaxy, {
        newTier: NavigationTier.System,
        starIndex: foreignStar!.index,
        bodyIndex: -1,
        exitDir: vec2(1, 0),
      });

      expect(galaxy.currentStarIndex).toBe(foreignStar!.index);
      const visitedStar = galaxy.stars[foreignStar!.index];
      if (!visitedStar) throw new Error('Expected visited star');
      expect(visitedStar.discovered).toBe(true);
      expect(visitedStar.owner).toBe('foreign');
    });
  });

  describe('belt entry (System → Local)', () => {
    it('keeps ship at current position (no remap)', () => {
      const orbitDist = 12;
      const galaxy = createSystemGalaxyState(orbitDist);
      const currentShipPos = vec2(center + orbitDist - 0.3, center);

      const transition = {
        newTier: NavigationTier.Local,
        starIndex: 0,
        bodyIndex: 0,
        entryAngle: 0,
        enteredFromInside: true,
      };

      const newPos = applyTransition(galaxy, transition, currentShipPos);

      expect(newPos.x).toBe(currentShipPos.x);
      expect(newPos.y).toBe(currentShipPos.y);
    });

    it('updates galaxy state on entry', () => {
      const galaxy = createSystemGalaxyState(12);

      const transition = {
        newTier: NavigationTier.Local,
        starIndex: 0,
        bodyIndex: 0,
        entryAngle: 1.5,
        enteredFromInside: false,
      };

      applyTransition(galaxy, transition, vec2(25, 20));

      expect(galaxy.tier).toBe(NavigationTier.Local);
      expect(galaxy.currentBodyIndex).toBe(0);
      expect(galaxy.bodyEntryAngle).toBeCloseTo(1.5);
      expect(galaxy.beltEnteredFromInside).toBe(false);
    });
  });

  describe('belt exit (Local → System)', () => {
    it('keeps ship at current position (no remap)', () => {
      const orbitDist = 12;
      const galaxy = createBeltGalaxyState({ fromInside: true, orbitDist });
      const currentShipPos = vec2(center + orbitDist + 3.6, center);

      const transition = {
        newTier: NavigationTier.System,
        starIndex: 0,
        bodyIndex: -1,
      };

      const newPos = applyTransition(galaxy, transition, currentShipPos);

      expect(newPos.x).toBe(currentShipPos.x);
      expect(newPos.y).toBe(currentShipPos.y);
    });

    it('sets tier to System', () => {
      const galaxy = createBeltGalaxyState({ fromInside: true, orbitDist: 12 });

      const transition = {
        newTier: NavigationTier.System,
        starIndex: 0,
        bodyIndex: -1,
      };

      applyTransition(galaxy, transition, vec2(35, 20));

      expect(galaxy.tier).toBe(NavigationTier.System);
      expect(galaxy.currentBodyIndex).toBe(-1);
    });
  });

  describe('galaxy exit placement', () => {
    it('places ship offset from star in exit direction', () => {
      const galaxy = createSystemGalaxyState(12);
      galaxy.currentStarIndex = 0;

      const transition = {
        newTier: NavigationTier.Galaxy,
        starIndex: -1,
        bodyIndex: -1,
        exitDir: vec2(1, 0),
      };

      const newPos = applyTransition(galaxy, transition);

      // Star[0] is at (50, 50) — ship should be offset to the right
      expect(newPos.x).toBeGreaterThan(50);
      expect(newPos.y).toBeCloseTo(50, 0);
    });
  });
});
