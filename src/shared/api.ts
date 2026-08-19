import type { ActiveBuff } from './buffs';

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

export type SharedShipShape = 'scout' | 'destroyer' | 'frigate' | 'battleship' | 'cruiser' | 'dreadnought' | 'colony';

export function normalizeSharedShipShape(shape: string | undefined): SharedShipShape {
  switch (shape) {
    case 'scout':
    case 'destroyer':
    case 'frigate':
    case 'battleship':
    case 'cruiser':
    case 'dreadnought':
    case 'colony':
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
  skinId?: string;
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
  skinId?: string;
};

export type RoomPosesResponse = {
  items: RoomPoseItem[];
};

export type ClaimPodRequest = {
  podId: number;
  username: string;
  isYellow?: boolean;
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
  enhancedProbeStars?: number[];  // stars discovered by enhanced probe
  scannedBodies?: string[];       // "starIndex:bodyIndex" keys for bodies that show raster
  journeyDone?: boolean;
  coachStep?: string;             // coach mark tutorial progress ('done' when finished)
  devMode?: boolean;
  wireframePref?: boolean;        // global wireframe mode — everything renders as wireframe
};

export type ResourceStore = {
  ore: number;
  food: number;
  energy: number;
  fuel: number;
};

export type ResourceRates = {
  ore: number;
  food: number;
  energy: number;
  fuel: number;
};

export type BuildStatus = 'LOCKED' | 'READY' | 'UPGRADING' | 'ACTIVE';

export type BuildType = 'station' | 'mine' | 'solar' | 'hab' | 'warehouse' | 'dock' | 'shield' | 'cannon' | 'refinery';

export type StarBuildingState = {
  level: number;
  status: BuildStatus;
  completeAt: number | null;
  skinId?: string;
};

export type StarBuildingsState = Record<BuildType, StarBuildingState>;

export type StarEconomyState = {
  store: ResourceStore;
  rates: ResourceRates;
  cap: number;
  buildings: StarBuildingsState;
  shieldRaised: boolean;
  lastTickMs: number;
};

export type DefenseScore = {
  shield: number;
  cannon: number;
  total: number;
};

export type StarEconomyResponse = {
  starKey: string;
  starIndex: number;
  store: ResourceStore;
  rates: ResourceRates;
  cap: number;
  buildings: StarBuildingsState;
  shieldRaised: boolean;
  defenseScore: DefenseScore;
  lastTickMs: number;
  completeCharges?: number;
  richness?: ResourceStore;
  buffs?: ActiveBuff[];
  preferredSkinId?: string;
};

export type ToggleShieldRequest = {
  username: string;
  starIndex: number;
};

export type ToggleShieldResponse = {
  ok: true;
  shieldRaised: boolean;
  rates: ResourceRates;
  defenseScore: DefenseScore;
};

export type BuildBuildingRequest = {
  username: string;
  starIndex: number;
  buildType: BuildType;
  skinId?: string;
};

export type BuildBuildingResponse = StarEconomyResponse & {
  ok: true;
};

export type SaveProfileRequest = {
  username: string;
  name?: string;
  lastPosition?: { starIndex: number; tier: number; bodyIndex: number };
  discoveredStars?: number[];
  enhancedProbeStars?: number[];
  journeyDone?: boolean;
  coachStep?: string;
  wireframePref?: boolean;
};

// ── Returning Player Report ─────────────────────────────────────────────────

export type ReportItem = {
  icon: string;      // short emoji/symbol
  text: string;      // human-readable line
  category: 'build' | 'resources' | 'visitor' | 'rumor';
};

export type ReturningReport = {
  items: ReportItem[];
  awaySeconds: number;  // how long the player was gone
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
  useBlueprint?: boolean;
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
  useBlueprint?: boolean;
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

// ── Raid Routes ─────────────────────────────────────────────────────────────

export type RaidRoute = {
  id: string;
  homeStarIndex: number;            // raider's origin (where loot returns)
  targetStarIndex: number;          // enemy star being raided
  cargo: ResourceStore;             // stolen resources (filled on success)
  departedAt: number;               // epoch ms
  arrivalAt: number;                // epoch ms
  leg: 'outbound' | 'return';      // outbound = going to target, return = coming home
  status: 'in-transit' | 'success' | 'destroyed'; // outcome after arrival
  successChance: number;            // 0-1 probability of surviving the raid
};

export type RaidRouteRequest = {
  username: string;
  homeStarIndex: number;
  targetStarIndex: number;
};

export type RaidRouteResponse = {
  ok: true;
  route: RaidRoute;
};

export type FleetAllResponse = {
  stars: Record<string, { ships: StarShipsState; building: ShipBuildingState | null }>;
  transits: ShipTransit[];
  freighterRoutes: FreighterRoute[];
  raidRoutes: RaidRoute[];
  discoveredStars: number[];
  enhancedProbeStars: number[];  // stars discovered by enhanced probe (reveals owner)
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
  fuelCost?: number;
};

// ── Colonization ────────────────────────────────────────────────────────────

export type ColonizeRequest = {
  username: string;
  postId: string;
  starIndex: number;
  bodyIndex?: number;  // body where colony ship is docked (station placed here)
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

// ── Public Comments (Reddit thread) ─────────────────────────────────────────

export type PublicComment = {
  id: string;          // Reddit comment ID (t1_xxx)
  author: string;
  body: string;
  createdAt: number;   // epoch ms
  replies: PublicComment[];
};

export type PublicCommentsResponse = {
  comments: PublicComment[];
};

export type PublicCommentPostRequest = {
  text: string;
  parentId?: string;   // comment ID to reply to; omit for top-level
  username?: string;   // poster's username for attribution
};

// ── Direct Messages ─────────────────────────────────────────────────────────

export type DirectMessage = {
  id: string;
  from: string;
  to: string;
  body: string;
  createdAt: number; // epoch ms
};

export type DMListResponse = {
  messages: DirectMessage[];
};

export type DMSendRequest = {
  from: string;
  to: string;
  text: string;
};

export type DMUnreadResponse = {
  unreadFrom: string[];  // usernames with unread messages
};

export type DMReportRequest = {
  messageId: string;
  reporterUsername: string;
  reportedUsername: string;
  messageBody: string;
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
    ore_fuel: number;
    food_ore: number;
    food_energy: number;
    food_fuel: number;
    energy_ore: number;
    energy_food: number;
    energy_fuel: number;
    fuel_ore: number;
    fuel_food: number;
    fuel_energy: number;
  };
};

export type TradeRequest = {
  username: string;
  starIndex: number;
  giveType: 'ore' | 'food' | 'energy' | 'fuel';
  receiveType: 'ore' | 'food' | 'energy' | 'fuel';
  giveAmount: number;
};

export type TradeResponse = {
  ok: true;
  gave: number;
  received: number;
  giveType: 'ore' | 'food' | 'energy' | 'fuel';
  receiveType: 'ore' | 'food' | 'energy' | 'fuel';
  playerStore: ResourceStore;
  stationStock: ResourceStore;
};

// ── Alliance Types ──────────────────────────────────────────────

export type Alliance = {
  id: string;
  name: string;
  manager: string;
  members: string[];
  createdAt: number;
};

export type AllianceInvite = {
  allianceId: string;
  allianceName: string;
  invitedBy: string;
  createdAt: number;
};

export type AllianceChatMessage = {
  from: string;
  text: string;
  createdAt: number;
};

export type AllianceInfoResponse = {
  alliance: Alliance | null;
};

export type AllianceInvitesResponse = {
  invites: AllianceInvite[];
};

export type AllianceChatResponse = {
  messages: AllianceChatMessage[];
};

export type AllianceCreateRequest = {
  username: string;
  name: string;
};

export type AllianceInviteRequest = {
  username: string;
  target: string;
};

export type AllianceRespondRequest = {
  username: string;
  allianceId: string;
  accept: boolean;
};

export type AllianceLeaveRequest = {
  username: string;
};

export type AllianceKickRequest = {
  username: string;
  target: string;
};

export type AllianceChatSendRequest = {
  username: string;
  text: string;
};

// ── Leaderboard ─────────────────────────────────────────────────────────────

export type LeaderboardEntry = {
  rank: number;
  username: string;
  starCount: number;
  totalShips: number;
  totalBuildingLevels: number;
  playtimeSeconds: number;
  power: number; // composite score
};

export type LeaderboardResponse = {
  players: LeaderboardEntry[];
};
