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

export type SharedShipShape = 'scout' | 'destroyer' | 'frigate' | 'battleship' | 'cruiser' | 'dreadnought';

export function normalizeSharedShipShape(shape: string | undefined): SharedShipShape {
  switch (shape) {
    case 'scout':
    case 'destroyer':
    case 'frigate':
    case 'battleship':
    case 'cruiser':
    case 'dreadnought':
      return shape;
    default:
      return 'scout';
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
  homeStar?: number;
  lastPosition?: { starIndex: number; tier: number; bodyIndex: number };
  claimed?: Array<{ starIndex: number; username: string }>;
  discoveredStars?: number[];
  journeyDone?: boolean;
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
  lastPosition?: { starIndex: number; tier: number; bodyIndex: number };
  discoveredStars?: number[];
  journeyDone?: boolean;
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

export type UpgradeShipRequest = {
  username: string;
  starIndex: number;
  fromTypeId: ShipTypeId;
};

export type UpgradeShipResponse = {
  ok: true;
  ships: StarShipsState;
  building: ShipBuildingState | null;
  store: ResourceStore;
};

// ── Fleet Management ─────────────────────────────────────────────────────────

export type ShipTransit = {
  shipTypeId: ShipTypeId;
  count: number;
  fromStarIndex: number;
  toStarIndex: number;
  departedAt: number;   // epoch ms
  arrivalAt: number;    // epoch ms
};

export type FreighterRoute = {
  id: string;                       // unique route id
  homeStarIndex: number;            // where cargo is delivered (home base)
  targetStarIndex: number;          // where cargo is picked up
  cargo: ResourceStore;             // what the freighter is currently carrying
  departedAt: number;               // epoch ms when current leg started
  arrivalAt: number;                // epoch ms when current leg completes
  leg: 'outbound' | 'return';      // outbound = going to pickup, return = coming home loaded
};

export type FreighterRouteRequest = {
  username: string;
  homeStarIndex: number;
  targetStarIndex: number;
};

export type FreighterRouteResponse = {
  ok: true;
  route: FreighterRoute;
};

export type FreighterRouteCancelRequest = {
  username: string;
  routeId: string;
};

export type FleetAllResponse = {
  stars: Record<string, { ships: StarShipsState; building: ShipBuildingState | null }>;
  transits: ShipTransit[];
  freighterRoutes: FreighterRoute[];
  discoveredStars: number[];
};

export type FleetTransferRequest = {
  username: string;
  fromStarIndex: number;
  toStarIndex: number;
  shipTypeId: ShipTypeId;
  count: number;
};

export type FleetTransferResponse = {
  ok: true;
  from: { starIndex: number; ships: StarShipsState };
  transit: ShipTransit;
};

// ── Colonization ────────────────────────────────────────────────────────────

export type ColonizeRequest = {
  username: string;
  postId: string;
  starIndex: number;
};

export type ColonizeResponse = {
  ok: true;
  starIndex: number;
  starName: string;
};

// ── Player stats (playtime + interactions) ──────────────────────────────────

export type StatsHeartbeatRequest = {
  username: string;
  deltaSeconds: number;
  deltaInteractions: number;
};

export type PlayerStatsData = {
  playtimeSeconds: number;
  interactions: number;
  lastSeen: number;
};

export type AdminPlayerSummary = {
  username: string;
  starIndex: number;
  starName: string;
  playtimeSeconds: number;
  interactions: number;
  lastSeen: number;
  totalBuildingLevels: number;
  totalShips: number;
  shipBreakdown: Array<{ name: string; count: number }>;
};

export type AdminPlayerStatsResponse = {
  players: AdminPlayerSummary[];
};

// ── Coms (Reddit Comments) ──────────────────────────────────────────────────

export type ComsMessage = {
  id: string;
  author: string;
  body: string;
  createdAt: number; // epoch ms
  isApp: boolean;
  depth: number; // 0 = top-level, 1+ = nested reply
};

export type ComsResponse = {
  messages: ComsMessage[];
  total: number;
};

export type ComsReplyRequest = {
  text: string;
};

export type ComsUnreadResponse = {
  hasNew: boolean;
  count: number;
  latestTimestamp: number;
};

// ── Trading Stations ────────────────────────────────────────────────────────

export type TradeStationState = {
  stock: ResourceStore;
  lastTickMs: number;
};

export type TradeStationInfoResponse = {
  starIndex: number;
  stock: ResourceStore;
  rates: {
    ore_food: number;
    ore_energy: number;
    food_ore: number;
    food_energy: number;
    energy_ore: number;
    energy_food: number;
  };
};

export type TradeRequest = {
  username: string;
  starIndex: number;
  giveType: 'ore' | 'food' | 'energy';
  receiveType: 'ore' | 'food' | 'energy';
  giveAmount: number;
};

export type TradeResponse = {
  ok: true;
  gave: number;
  received: number;
  giveType: 'ore' | 'food' | 'energy';
  receiveType: 'ore' | 'food' | 'energy';
  playerStore: ResourceStore;
  stationStock: ResourceStore;
};
