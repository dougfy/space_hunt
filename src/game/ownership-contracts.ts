export type StarOwner = 'none' | 'player' | 'foreign';
export type DiscoveryLevel = 'none' | 'probed' | 'visited';
export type VisitMode = 'unvisited' | 'basic_probe' | 'enhanced_probe' | 'ship_visit';

export type StarOwnershipState = {
  index: number;
  owner: StarOwner;
  discovered: boolean;
  discoveryLevel: DiscoveryLevel;
  visitMode?: VisitMode;
};

export type StarOwnershipCommand =
  | {
    type: 'assign-home-star';
    homeStarIndex: number;
  }
  | {
    type: 'visit-star';
    starIndex: number;
  }
  | {
    type: 'probe-star';
    starIndex: number;
  };

export type StarOwnershipEvent =
  | {
    type: 'home-star-assigned';
    starIndex: number;
  }
  | {
    type: 'star-discovered';
    starIndex: number;
    owner: StarOwner;
  };

export type StarVisualTone = 'blue' | 'green' | 'white' | 'red' | 'yellow' | 'cyan';