import { describe, expect, it } from 'vitest';
import { vec2 } from '../math';
import { reduceStarOwnership } from '../ownership';
import { buildGalaxyViewModel, getGalaxyStarTone } from '../galaxy-view-model';
import { NavigationTier, type GalaxyState } from '../galaxy';
import { getEnhancedProbeSurveyData } from '../renderer';
import { applyStarDiscoveryState } from '../game-loop';

describe('reduceStarOwnership', () => {
  it('assigns the home star to the player and marks it discovered', () => {
    const result = reduceStarOwnership([
      { index: 0, owner: 'foreign', discovered: false, discoveryLevel: 'none' },
      { index: 1, owner: 'foreign', discovered: false, discoveryLevel: 'none' },
    ], {
      type: 'assign-home-star',
      homeStarIndex: 1,
    });

    expect(result.stars[0]).toEqual({ index: 0, owner: 'foreign', discovered: false, discoveryLevel: 'none' });
    expect(result.stars[1]).toEqual({ index: 1, owner: 'player', discovered: true, discoveryLevel: 'visited', visitMode: 'ship_visit' });
    expect(result.events).toEqual([{ type: 'home-star-assigned', starIndex: 1 }]);
  });

  it('marks a visited foreign star as discovered without changing ownership', () => {
    const result = reduceStarOwnership([
      { index: 0, owner: 'player', discovered: true, discoveryLevel: 'visited' },
      { index: 1, owner: 'foreign', discovered: false, discoveryLevel: 'none' },
    ], {
      type: 'visit-star',
      starIndex: 1,
    });

    expect(result.stars[1]).toEqual({ index: 1, owner: 'foreign', discovered: true, discoveryLevel: 'visited', visitMode: 'ship_visit' });
    expect(result.events).toEqual([{ type: 'star-discovered', starIndex: 1, owner: 'foreign' }]);
  });

  it('probe-star upgrades from none to probed without changing owner', () => {
    const result = reduceStarOwnership([
      { index: 0, owner: 'foreign', discovered: false, discoveryLevel: 'none' },
    ], {
      type: 'probe-star',
      starIndex: 0,
    });

    expect(result.stars[0]).toEqual({ index: 0, owner: 'foreign', discovered: true, discoveryLevel: 'probed', visitMode: 'basic_probe' });
    expect(result.events).toEqual([{ type: 'star-discovered', starIndex: 0, owner: 'foreign' }]);
  });

  it('probe-star does not downgrade a visited star', () => {
    const result = reduceStarOwnership([
      { index: 0, owner: 'player', discovered: true, discoveryLevel: 'visited' },
    ], {
      type: 'probe-star',
      starIndex: 0,
    });

    expect(result.stars[0]).toEqual({ index: 0, owner: 'player', discovered: true, discoveryLevel: 'visited' });
    expect(result.events).toEqual([]);
  });

  it('tracks whether the visit came from a basic probe or a direct ship visit', () => {
    const probeResult = reduceStarOwnership([
      { index: 0, owner: 'foreign', discovered: false, discoveryLevel: 'none' },
    ], {
      type: 'probe-star',
      starIndex: 0,
    });
    const probeStar = probeResult.stars.find((star) => star.index === 0)!;

    expect(probeStar.discoveryLevel).toBe('probed');
    expect(probeStar.visitMode).toBe('basic_probe');

    const visitResult = reduceStarOwnership([
      { index: 1, owner: 'foreign', discovered: false, discoveryLevel: 'none', visitMode: 'basic_probe' },
    ], {
      type: 'visit-star',
      starIndex: 1,
    });
    const visitedStar = visitResult.stars.find((star) => star.index === 1)!;

    expect(visitedStar.discoveryLevel).toBe('visited');
    expect(visitedStar.visitMode).toBe('ship_visit');
  });

  it('upgrades a basic probe into the enhanced-probe card state when the server marks it as enhanced', () => {
    const star = {
      discovered: true,
      discoveryLevel: 'probed' as const,
      visitMode: 'basic_probe' as const,
    };

    applyStarDiscoveryState(star, true);

    expect(star.discovered).toBe(true);
    expect(star.discoveryLevel).toBe('visited');
    expect(star.visitMode).toBe('enhanced_probe');
  });
});

describe('galaxy view model', () => {
  it('maps home, unowned, and foreign-owned stars to current tones', () => {
    const galaxy: GalaxyState = {
      tier: NavigationTier.Galaxy,
      stars: [
        { index: 0, pos: vec2(10, 10), seed: 1, name: 'Home', bodyCount: 1, owner: 'player', discovered: true, discoveryLevel: 'visited' },
        { index: 1, pos: vec2(20, 20), seed: 2, name: 'Unknown', bodyCount: 1, owner: 'none', discovered: false, discoveryLevel: 'none' },
        { index: 2, pos: vec2(30, 30), seed: 3, name: 'Foreign', bodyCount: 1, owner: 'foreign', discovered: true, discoveryLevel: 'visited' },
      ],
      homeStarIndex: 0,
      currentStarIndex: -1,
      currentBodyIndex: -1,
      bodies: [],
      galaxySeed: 42,
      bodyEntryAngle: 0,
      beltEnteredFromInside: true,
    };

    const view = buildGalaxyViewModel(galaxy);

    expect(view.stars.map((star) => star.tone)).toEqual(['blue', 'yellow', 'red']);
  });

  it('derives tones without renderer dependencies', () => {
    expect(getGalaxyStarTone({ index: 0, owner: 'player', discovered: true, discoveryLevel: 'visited' }, 0)).toBe('blue');
    expect(getGalaxyStarTone({ index: 1, owner: 'none', discovered: false, discoveryLevel: 'none' }, 0)).toBe('yellow');
    expect(getGalaxyStarTone({ index: 2, owner: 'foreign', discovered: true, discoveryLevel: 'visited' }, 0)).toBe('red');
  });

  it('uses the actual system body count for the enhanced-probe card summary', () => {
    const star = {
      index: 17,
      pos: vec2(0, 0),
      seed: 42,
      name: 'Probe Star',
      bodyCount: 8,
      owner: 'foreign' as const,
      discovered: true,
      discoveryLevel: 'visited' as const,
      visitMode: 'enhanced_probe' as const,
    };

    const survey = getEnhancedProbeSurveyData(star);
    expect(survey.planetCount + survey.beltCount).toBe(star.bodyCount);
    expect(survey.bodies.length).toBe(star.bodyCount);
  });
});