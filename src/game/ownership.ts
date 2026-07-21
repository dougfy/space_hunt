import type {
  StarOwnershipCommand,
  StarOwnershipEvent,
  StarOwnershipState,
} from './ownership-contracts';

export type StarOwnershipResult = {
  stars: StarOwnershipState[];
  events: StarOwnershipEvent[];
};

export function reduceStarOwnership(
  stars: readonly StarOwnershipState[],
  command: StarOwnershipCommand,
): StarOwnershipResult {
  if (command.type === 'assign-home-star') {
    let changed = false;
    const nextStars: StarOwnershipState[] = stars.map((star) => {
      if (star.index !== command.homeStarIndex) return star;
      changed = changed || star.owner !== 'player' || !star.discovered;
      return { ...star, owner: 'player', discovered: true };
    });

    return {
      stars: nextStars,
      events: changed
        ? [{ type: 'home-star-assigned', starIndex: command.homeStarIndex }]
        : [],
    };
  }

  let discoveredOwner: StarOwnershipState['owner'] | null = null;
  const nextStars: StarOwnershipState[] = stars.map((star) => {
    if (star.index !== command.starIndex || star.discovered) return star;
    discoveredOwner = star.owner;
    return { ...star, discovered: true };
  });

  return {
    stars: nextStars,
    events: discoveredOwner
      ? [{ type: 'star-discovered', starIndex: command.starIndex, owner: discoveredOwner }]
      : [],
  };
}