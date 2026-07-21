import type { GalaxyState, GalaxyStar } from './galaxy';
import type { Vec2 } from './types';
import type { StarOwner, StarVisualTone } from './ownership-contracts';

export type GalaxyStarViewModel = {
  index: number;
  name: string;
  pos: Vec2;
  owner: StarOwner;
  discovered: boolean;
  isHome: boolean;
  tone: StarVisualTone;
};

export type GalaxyViewModel = {
  stars: GalaxyStarViewModel[];
};

export function getGalaxyStarTone(
  star: Pick<GalaxyStar, 'index' | 'owner' | 'discovered'>,
  homeStarIndex: number,
): StarVisualTone {
  if (star.index === homeStarIndex) return 'blue';
  if (star.discovered && star.owner === 'foreign') return 'white';
  return 'green';
}

export function buildGalaxyViewModel(galaxy: GalaxyState): GalaxyViewModel {
  return {
    stars: galaxy.stars.map((star) => ({
      index: star.index,
      name: star.name,
      pos: star.pos,
      owner: star.owner,
      discovered: star.discovered,
      isHome: star.index === galaxy.homeStarIndex,
      tone: getGalaxyStarTone(star, galaxy.homeStarIndex),
    })),
  };
}