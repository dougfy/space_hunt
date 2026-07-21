export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

export type SharedShipShape = 'arrow' | 'delta' | 'needle' | 'blade';

export function normalizeSharedShipShape(shape: string | undefined): SharedShipShape {
  switch (shape) {
    case 'delta':
    case 'needle':
    case 'blade':
      return shape;
    default:
      return 'arrow';
  }
}

export type OkResponse = {
  ok: true;
};

export type PoseUpdateRequest = {
  x: number;
  y: number;
  angle: number;
  username: string;
  sessionId?: string;
  shape?: SharedShipShape;
  tier?: number;
  starIndex?: number;
  bodyIndex?: number;
};

export type RoomPosesQuery = {
  postId: string;
  exclude?: string;
  tier?: number;
  starIndex?: number;
  bodyIndex?: number;
};

export type RoomPoseItem = {
  username: string;
  x: number;
  y: number;
  angle: number;
  shape: SharedShipShape;
};

export type RoomPosesResponse = {
  items: RoomPoseItem[];
};

export type ClaimPodRequest = {
  podId: number;
  username: string;
};

export type ClaimPodResponse = {
  success: true;
  podId: number;
  mine: boolean;
};

export type ClaimedPodsResponse = {
  podIds: number[];
};

export type ShotItem = {
  id: string;
  origin: { x: number; y: number };
  angle: number;
  speed: number;
  spawnTime: number;
};

export type PostShotsRequest = {
  sessionId: string;
  shots: ShotItem[];
};

export type RemoteShotItem = ShotItem & {
  shooterId: string;
};

export type ShotsResponse = {
  shots: RemoteShotItem[];
};

export type PlayerProfileResponse = {
  name: string;
  shape: SharedShipShape;
};

export type ResourceStore = {
  ore: number;
  food: number;
  energy: number;
};

export type ResourceRates = {
  ore: number;
  food: number;
  energy: number;
};

export type BuildStatus = 'LOCKED' | 'READY' | 'UPGRADING' | 'ACTIVE';

export type BuildType = 'station' | 'mine' | 'solar' | 'hab' | 'warehouse' | 'dock';

export type StarBuildingState = {
  level: number;
  status: BuildStatus;
  completeAt: number | null;
};

export type StarBuildingsState = Record<BuildType, StarBuildingState>;

export type StarEconomyState = {
  store: ResourceStore;
  rates: ResourceRates;
  cap: number;
  buildings: StarBuildingsState;
  lastTickMs: number;
};

export type StarEconomyResponse = {
  starKey: string;
  starIndex: number;
  store: ResourceStore;
  rates: ResourceRates;
  cap: number;
  buildings: StarBuildingsState;
  lastTickMs: number;
};

export type BuildBuildingRequest = {
  username: string;
  starIndex: number;
  buildType: BuildType;
};

export type BuildBuildingResponse = StarEconomyResponse & {
  ok: true;
};

export type SaveProfileRequest = {
  username: string;
  name?: string;
  shape?: SharedShipShape;
};

// ── Ship Types ──────────────────────────────────────────────────────────────

export type ShipTypeId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10 | 11 | 12 | 14 | 15;

export type ShipState = {
  typeId: ShipTypeId;
  count: number;
};

export type ShipBuildingState = {
  typeId: ShipTypeId;
  completeAt: number;
};

export type StarShipsState = ShipState[];

export type BuyShipRequest = {
  username: string;
  starIndex: number;
  shipTypeId: ShipTypeId;
  quantity: number;
};

export type BuyShipResponse = {
  ok: true;
  ships: StarShipsState;
  building: ShipBuildingState | null;
  store: ResourceStore;
};

export type StarShipsResponse = {
  starIndex: number;
  ships: StarShipsState;
  building: ShipBuildingState | null;
};
