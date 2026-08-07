// ── Public API ──────────────────────────────────────────────────────────────
// Main barrel export for the game engine (used by Devvit integration)

export { createDevvitBridge } from './bridge';
export type { DevvitBridge, DevvitCallbacks } from './bridge';
export type { RemotePoseItem } from './ghosts';
export type { GameState, ShipShape, Ghost } from './types';
export { getGameState, getDiscoveredStars, getVisitedStars, getKnownPlayers, addKnownPlayer, refreshGalaxyStarNames, relocateToHomeStar, restorePosition, setDiscoveredStars, setStarClaims, onColonizeSuccess } from './game-loop';
export { skipJourney, startJourney, isJourneyDone } from './journey';
export { setExternalStarNames } from './galaxy';
export { consumePendingBuildRequest, consumePendingBuyShipRequest, consumePendingUpgradeShipRequest, consumePendingCompleteBuilds, consumePendingColonizeRequest, consumePendingTransfer, consumePendingCancelRoute, setServerStarEconomy, setServerShipState, setServerFleetAll, setForeignFleet, setIsAdmin, setComsUnread, clearComsUnread, isComsPanelOpen, setPostId, setTradeStationInfo, consumePendingTrade, setKnownPlayers, setDMPeer, getDMPeer, setDMMessages, setDMUnread, consumePendingDMSend, consumeDMInputRequest, submitDMInput, consumePendingDMReport, showDMReportConfirm, getComsTab, setPublicComments, setPublicLoading, consumePendingPublicPost, consumePublicInputRequest, submitPublicPost, getPublicRecipient, setAllianceInfo, setAllianceInvites, setAllianceChat, getAllianceView, consumeAllianceAction, consumeAllianceInputRequest, submitAllianceInput, setAllianceUsername, consumePendingBotTest, consumePendingBotAdminTest, consumePendingBotCheck, setBotTestLog, consumePendingBotCopy, setLeaderboardData, consumePendingSeedBots, consumePendingToggleShield, consumePendingFleetShare, setFleetShareCooldown, consumePendingExplore, showExploreResult, getShieldCharging, clearShieldCharging } from './renderer';
export { playSound, preloadSounds, toggleMute, isMuted, setVolume } from './audio';
export { enableFullGestures } from './input';
