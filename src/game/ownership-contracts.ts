export type StarOwner = 'player' | 'foreign';

export type StarOwnershipState = {
  index: number;
  owner: StarOwner;
  discovered: boolean;
};

export type StarOwnershipCommand =
  | {
    type: 'assign-home-star';
    homeStarIndex: number;
  }
  | {
    type: 'visit-star';
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

export type StarVisualTone = 'blue' | 'green' | 'white' | 'red' | 'yellow';