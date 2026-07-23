import { describe, expect, it } from 'vitest';
import { vec2 } from '../math';
import { reduceStarOwnership } from '../ownership';
import { buildGalaxyViewModel, getGalaxyStarTone } from '../galaxy-view-model';
import { NavigationTier, type GalaxyState } from '../galaxy';

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
    expect(result.stars[1]).toEqual({ index: 1, owner: 'player', discovered: true, discoveryLevel: 'visited' });
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

    expect(result.stars[1]).toEqual({ index: 1, owner: 'foreign', discovered: true, discoveryLevel: 'visited' });
    expect(result.events).toEqual([{ type: 'star-discovered', starIndex: 1, owner: 'foreign' }]);
  });

  it('probe-star upgrades from none to probed without changing owner', () => {
    const result = reduceStarOwnership([
      { index: 0, owner: 'foreign', discovered: false, discoveryLevel: 'none' },
    ], {
      type: 'probe-star',
      starIndex: 0,
    });

    expect(result.stars[0]).toEqual({ index: 0, owner: 'foreign', discovered: true, discoveryLevel: 'probed' });
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
});

describe('galaxy view model', () => {
  it('maps home, undiscovered, and discovered foreign stars to blue, green, and white tones', () => {
    const galaxy: GalaxyState = {
      tier: NavigationTier.Galaxy,
      stars: [
        { index: 0, pos: vec2(10, 10), seed: 1, name: 'Home', bodyCount: 1, owner: 'player', discovered: true, discoveryLevel: 'visited' },
        { index: 1, pos: vec2(20, 20), seed: 2, name: 'Unknown', bodyCount: 1, owner: 'foreign', discovered: false, discoveryLevel: 'none' },
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

    expect(view.stars.map((star) => star.tone)).toEqual(['blue', 'yellow', 'green']);
  });

  it('derives tones without renderer dependencies', () => {
    expect(getGalaxyStarTone({ index: 0, owner: 'player', discovered: true, discoveryLevel: 'visited' }, 0)).toBe('blue');
    expect(getGalaxyStarTone({ index: 1, owner: 'foreign', discovered: false, discoveryLevel: 'none' }, 0)).toBe('yellow');
    expect(getGalaxyStarTone({ index: 2, owner: 'foreign', discovered: true, discoveryLevel: 'visited' }, 0)).toBe('green');
  });
});