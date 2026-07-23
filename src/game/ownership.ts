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
      return { ...star, owner: 'player', discovered: true, discoveryLevel: 'visited' as const };
    });

    return {
      stars: nextStars,
      events: changed
        ? [{ type: 'home-star-assigned', starIndex: command.homeStarIndex }]
        : [],
    };
  }

  if (command.type === 'probe-star') {
    let discoveredOwner: StarOwnershipState['owner'] | null = null;
    const nextStars: StarOwnershipState[] = stars.map((star) => {
      if (star.index !== command.starIndex) return star;
      // Probe only upgrades from 'none' to 'probed'; doesn't downgrade 'visited'
      if (star.discoveryLevel === 'visited') return star;
      discoveredOwner = star.owner;
      return { ...star, discovered: true, discoveryLevel: 'probed' as const };
    });

    return {
      stars: nextStars,
      events: discoveredOwner
        ? [{ type: 'star-discovered', starIndex: command.starIndex, owner: discoveredOwner }]
        : [],
    };
  }

  // visit-star: marks discovered + visited level, does NOT claim ownership
  let discoveredOwner: StarOwnershipState['owner'] | null = null;
  const nextStars: StarOwnershipState[] = stars.map((star) => {
    if (star.index !== command.starIndex) return star;
    if (star.discoveryLevel === 'visited') return star; // already visited
    discoveredOwner = star.discovered ? null : star.owner;
    return { ...star, discovered: true, discoveryLevel: 'visited' as const };
  });

  return {
    stars: nextStars,
    events: discoveredOwner
      ? [{ type: 'star-discovered', starIndex: command.starIndex, owner: discoveredOwner }]
      : [],
  };
}