import { describe, expect, it } from 'vitest';
import { vec2 } from '../math';
import { reduceStarOwnership } from '../ownership';
import { buildGalaxyViewModel, getGalaxyStarTone } from '../galaxy-view-model';
import { NavigationTier, type GalaxyState } from '../galaxy';

describe('reduceStarOwnership', () => {
  it('assigns the home star to the player and marks it discovered', () => {
    const result = reduceStarOwnership([
      { index: 0, owner: 'foreign', discovered: false },
      { index: 1, owner: 'foreign', discovered: false },
    ], {
      type: 'assign-home-star',
      homeStarIndex: 1,
    });

    expect(result.stars[0]).toEqual({ index: 0, owner: 'foreign', discovered: false });
    expect(result.stars[1]).toEqual({ index: 1, owner: 'player', discovered: true });
    expect(result.events).toEqual([{ type: 'home-star-assigned', starIndex: 1 }]);
  });

  it('marks a visited foreign star discovered without changing ownership', () => {
    const result = reduceStarOwnership([
      { index: 0, owner: 'player', discovered: true },
      { index: 1, owner: 'foreign', discovered: false },
    ], {
      type: 'visit-star',
      starIndex: 1,
    });

    expect(result.stars[1]).toEqual({ index: 1, owner: 'foreign', discovered: true });
    expect(result.events).toEqual([{ type: 'star-discovered', starIndex: 1, owner: 'foreign' }]);
  });
});

describe('galaxy view model', () => {
  it('maps home, undiscovered, and discovered foreign stars to blue, green, and white tones', () => {
    const galaxy: GalaxyState = {
      tier: NavigationTier.Galaxy,
      stars: [
        { index: 0, pos: vec2(10, 10), seed: 1, name: 'Home', bodyCount: 1, owner: 'player', discovered: true },
        { index: 1, pos: vec2(20, 20), seed: 2, name: 'Unknown', bodyCount: 1, owner: 'foreign', discovered: false },
        { index: 2, pos: vec2(30, 30), seed: 3, name: 'Foreign', bodyCount: 1, owner: 'foreign', discovered: true },
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

    expect(view.stars.map((star) => star.tone)).toEqual(['blue', 'green', 'white']);
  });

  it('derives tones without renderer dependencies', () => {
    expect(getGalaxyStarTone({ index: 0, owner: 'player', discovered: true }, 0)).toBe('blue');
    expect(getGalaxyStarTone({ index: 1, owner: 'foreign', discovered: false }, 0)).toBe('green');
    expect(getGalaxyStarTone({ index: 2, owner: 'foreign', discovered: true }, 0)).toBe('white');
  });
});