// ── Public API ──────────────────────────────────────────────────────────────
// Main barrel export for the game engine (used by Devvit integration)

export { createDevvitBridge } from './bridge';
export type { DevvitBridge, DevvitCallbacks } from './bridge';
export type { RemotePoseItem } from './ghosts';
export type { GameState, ShipShape, Ghost } from './types';
export { getGameState, getDiscoveredStars, refreshGalaxyStarNames, relocateToHomeStar, restorePosition, setDiscoveredStars, setStarClaims } from './game-loop';
export { setExternalStarNames } from './galaxy';
export { consumePendingBuildRequest, consumePendingBuyShipRequest, consumePendingUpgradeShipRequest, consumePendingCompleteBuilds, consumePendingTransfer, setServerStarEconomy, setServerShipState, setServerFleetAll } from './renderer';
