# Attack Plan — Valcordia Space Economy

**Basis:** ValcordiaSpace design artifacts (`economy_catalog_v1.md`, `domain_model.md`, `game_catalog_v1.md`, `architecture_v1.md`, `design_phase_0.md`, `program_management.md`)

**Platform:** Devvit WebView (TypeScript/Canvas2D), current `spacehunt` codebase.

**Last Updated:** 2026-07-24 (v0.0.301)

---

## Active Issues / TODO

| # | Issue | Status | Notes |
|---|---|---|---|
| 1 | Boundary issue in solar tier — no need to scroll | ❌ Open | System view should fit without scrolling. |
| 2 | Leaving solar→galaxy with bounds on loses bounds state | ❌ Open | Bounds-on flag not preserved across tier transitions. |
| 3 | Galaxy view: separate ship nav from fleet movement picker | ❌ Open | Ship movement shows where ship is + lets user explore. Fleet picker selects ship/location → directs to destination. Probes can explore any star. Colony ships only to fully-explored stars (not probe-explored). Probe info = summary; ship visit = full info. Touch: need a way to select star and show info without hover. |
| 4 | Star coloring not working — see red stars after visiting | ✅ Fixed (v0.0.293) | Foreign stars now show red via `getGalaxyStarTone()` checking `owner === 'foreign'`. |
| 5 | Ship name editing blocked by steering keys | ✅ Fixed (v0.0.257) | Mode flag added — keyboard input passes through when editing ship name. |
| 6 | iPad sizing | ❌ Open | Layout/canvas not adapting properly to iPad screen dimensions. |
| 7 | Pinch gesture conflicts with ship movement | ❌ Open | Pinch-to-zoom triggers ship movement instead of being handled as zoom. Need gesture disambiguation. |
| 8 | Galaxy fuel vs system fuel | ❌ Open | Does galaxy view show fuel status? Should there be separate fuel pools for warp (galaxy) vs thruster (system/planet)? |
| 9 | Extended discovery: belt items, planet items, multiple ores, Knowledge | ❌ Open | Items discoverable in belts and on planets. Multiple ore types. Knowledge = plans/blueprints that unlock build tree upgrades. |
| 10 | Entry into solar tier dumps into belt | ❌ Open | Entering system tier should place ship near system edge, not inside a belt. |
| 11 | Belt (Local tier) missing side controls | ❌ Open | STATUS/BUILD/SHIPS/FLEET tabs not rendering in Local tier. |

---

## Context

The game already has:
- Galaxy / System / Planet / Local tier navigation.
- Star ownership and discovery with visual color coding (home=blue, player-discovered=green, foreign=red, undiscovered=yellow).
- Star discovery persistence across sessions (Redis-backed).
- Position save/restore across sessions.
- Planet-tier docking at stations with a dock panel.
- Ship movement, fuel, shooting, ghosts (other players).
- Economy: resources, buildings, ship building, ship upgrades, ship transfers.
- Admin tools: player stats, debug panel, force save, Redis inspection.
- Non-UI test harness: domain reducers, shared contracts, service layer.

The economy sits on top of this as the **reason to explore, colonize, and fight.**

---

## Feature 1 — Resources ✅ COMPLETE

**What:** Three core resources — **Ore, Food, Energy** — stored per star. Atomics reserved/gated.

**Why first:** everything else (buildings, ships, trade) depends on resources being real and trackable.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| 1.1 | Resource schema | ✅ | `ResourceStore { ore, food, energy }` in shared/api.ts. `StarEconomyState` holds store, rates, cap per star. |
| 1.2 | Production rates | ✅ | `computeResourceRatesFromBuildings()` — base rate + bonus from mine/hab/solar levels. |
| 1.3 | Storage cap | ✅ | `computeResourceCapFromBuildings()` — base 1600 + 400/warehouse level. `clampStore()` enforces ceiling. |
| 1.4 | Server-side tick | ✅ | `tickStarEconomy()` applies `elapsedMin × rate` on load/action, persists `lastTickMs`. |
| 1.5 | Display | ✅ | STATUS panel shows `ORE: X/cap (+rate/m)` per resource. Star info legend in dock panel. |
| 1.6 | Tests | ✅ | `game-service.test.ts`: tick production, clamping, no backward tick. `economy-catalog.test.ts`: resource catalog. |

---

## Feature 2 — Buildings ✅ COMPLETE

**What:** Per-star building slots with levels. Four production families: Ore, Food, Energy production + warehouses. Later: command centers, docks, defense, research.

**Why second:** buildings define production rates and unlock everything else. Nothing else works without them.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| 2.1 | Building schema | ✅ | `StarBuildingsState = Record<BuildType, StarBuildingState>` with level, status, completeAt. |
| 2.2 | Build catalog | ✅ | `BUILDING_CATALOG` — 6 types (station, mine, solar, hab, warehouse, dock) with maxLevel, duration, prereqs. |
| 2.3 | Prerequisite evaluator | ✅ | `isBuildUnlocked()` and `getUnlockedBuildTypes()` — checks prereq levels. Auto-sets LOCKED/READY. |
| 2.4 | Build cost calculator | ✅ | `getBuildingCost(type, level)` — station tiered cost, others scale linearly. |
| 2.5 | BuyBuilding command | ✅ | `POST /buildings/buy` → `startBuildingUpgrade()` — validates prereqs, resources, deducts cost, sets UPGRADING+completeAt. |
| 2.6 | UpgradeBuilding command | ✅ | `POST /buildings/upgrade` — same function, level increment automatic via `getBuildingTargetLevel`. |
| 2.7 | Build completion | ✅ | `reconcileStarBuildings(buildings, now)` — promotes UPGRADING→ACTIVE if `completeAt ≤ now`. |
| 2.8 | Build tree UI | ✅ | `drawBuildPanelBody()` — 3×2 grid with level, cost, progress %, LOCKED/BUILD/UPGRADE states, COMPLETE debug button. |
| 2.9 | Tests | ✅ | `buildings.test.ts`: initial state, tiered costs, reconciliation. `game-service.test.ts`: upgrade flow, rejection cases. |

**Initial buildings unlocked at colonization:** Ore Prod (lv1), Food Prod (lv1), Energy Prod (lv1), Space Dock T1 (lv1).

---

## Feature 3 — Ship Building ✅ COMPLETE (tests partial)

**What:** Ships are built at a star via the Space Dock building. Each ship type has a cost, build time, and prerequisite building.

**Why third:** ships are the primary economic/military tool. Without buildable ships, the economy has no output.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| 3.1 | Ship type catalog | ✅ | `SHIP_CATALOG` — 12 ship types with id, name, speed, offense, defense, transport, cost, buildSeconds, dockTier/Level. `UPGRADE_PATH` for linear progression. |
| 3.2 | BuyShip command | ✅ | `POST /ships/buy` → `buyShip()` — validates dock level, resources, single-build-at-a-time, deducts cost. Also `POST /ships/upgrade` → `upgradeShip()` for path upgrades. |
| 3.3 | Ship completion | ✅ | `reconcileShipBuilding()` — on load, completes builds when `completeAt ≤ now`, adds to fleet. |
| 3.4 | Fleet assignment | ✅ | `POST /fleet/transfer` → `transferShips()` — creates `ShipTransit` with speed-based travel time. `loadAllFleet()` reconciles arrived transits. Fleet stored per-star. |
| 3.5 | Ship list UI | ✅ | `drawShipsPanelBody()` — available builds, upgrade section, build progress. `drawFleetPanelBody()` — galaxy/local views with SEND buttons, transit display, fleet badges on stars. |
| 3.6 | Tests | ⚠️ | No dedicated ship test file. `game-service.test.ts` covers buildings/economy but not `buyShip`, `upgradeShip`, `loadStarShips`, or `transferShips`. |

**Initial ship types available:** Scout (1), Freighter (2), Colony Ship (8), Basic Probe (11).

---

## Feature 4 — Star Colonization ✅ DONE (v0.0.301)

**What:** Send a Colony Ship (type 8) to a probed/visited unclaimed star, fly there, dock at station, and press COLONIZE to claim it.

**Why fourth:** colonization is the expansion loop. It creates new stars that generate resources, enabling further growth.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| 4.1 | Colonize endpoint | ✅ | `POST /api/colonize` — validates Colony Ship at star, consumes it, claims star, seeds economy (Station lv1 + Dock lv1 + starter resources). First-write-wins for race conditions. |
| 4.2 | COLONIZE button | ✅ | Pulsing green button above orbit bar when docked at unowned station with Colony Ship present. Hit-test sets `_pendingColonizeRequest`. |
| 4.3 | Colony Ship SEND filtering | ✅ | Selection circles only appear on probed/visited + non-player-owned stars (not all stars). |
| 4.4 | Probe SEND filtering | ✅ | Selection circles only appear on unvisited OR foreign-owned stars. |
| 4.5 | Colony Ship consumed | ✅ | Colony ship removed from fleet on successful colonization. |
| 4.6 | Visual update | ✅ | Colonized star immediately set to `owner: 'player'` in local game state → blue tint. BUILD/SHIPS tabs unlock. |
| 4.7 | Probe intel at foreign stars | ⏳ | Deferred — requires passing postId through fleet reconciliation. Planned for follow-up. |

---

## Feature 5 — Cargo and Trade ❌ NOT STARTED

**What:** Freighters carry resources between stars. Resources at a star can be loaded into a ship's cargo hold and unloaded at the destination.

**Why fifth:** cargo transport connects isolated economies — excess ore at one star can fuel building at another.

### Sub-features
| # | Item | Detail |
|---|---|---|
| 5.1 | Cargo schema | Each ship carries `{ ore, food, energy }` cargo, capped at ship's transport capacity. |
| 5.2 | LoadCargo command | Server checks ship is at star, resources available, deducts from star store, adds to cargo. |
| 5.3 | UnloadCargo command | Server checks ship is at destination, adds cargo to star store (up to cap). |
| 5.4 | Cargo UI | Ship detail panel shows current cargo. Load/Unload buttons on dock panel when at a star. |
| 5.5 | Tests | Load/unload success, cap enforcement, ship-not-present rejection. |

---

## Feature 6 — Ship Movement ⚠️ PARTIAL (transfer/transit exists, no real-time interpolation)

**What:** Ships and fleets move across the galaxy map between stars. Movement is time-based; the server stores start/target/ETA and the client interpolates.

**Why sixth:** movement is the connective tissue for trade, colonization, and combat.

### Sub-features
| # | Item | Detail |
|---|---|---|
| 6.1 | MoveShip command | Server records `{ startTime, startPos, targetPos, eta }` based on ship speed. |
| 6.2 | Client interpolation | Client estimates current ship position from stored movement data without additional server calls. |
| 6.3 | Arrival handling | On profile load: if `eta` past, snap ship to target, trigger arrival event (unload, colonize trigger, etc.). |
| 6.4 | Fleet movement | MoveFleet issues one command for all ships in fleet; same ETA logic. |
| 6.5 | Galaxy view markers | Moving ships shown as ghost trails or markers on galaxy/system maps. |
| 6.6 | Tests | ETA computation. Arrival state machine. Fleet movement grouping. |

---

## Feature 7 — Currency and Commerce ❌ NOT STARTED

**What:** Two currencies: `gc_soft` (earned in-game) and `gp_premium` / `ship_points` (premium, purchased). Soft currency earned from production, trade, quests. Premium used for special ships/buffs.

### Sub-features
| # | Item | Detail |
|---|---|---|
| 7.1 | Currency schema | Player profile carries `{ gc_soft, gp_premium, ship_points }` balances. |
| 7.2 | Earn events | Quest rewards, resource sell, combat victories grant `gc_soft`. |
| 7.3 | Spend events | BuyShip (ship-points path), premium buffs, quick-build spend. |
| 7.4 | Premium buffs | Speed +15%, shield charge +10%, attack +10%, build speed +15% — each 60 min. |
| 7.5 | Currency HUD | Persistent display of all three balances in Galaxy/System/Planet HUD. |
| 7.6 | Idempotency | All grant/spend operations include an idempotency key to prevent double-spend. |
| 7.7 | Tests | Grant, spend, insufficient-funds rejection. Idempotent duplicate submission. |

---

## Feature 8 — Combat ❌ NOT STARTED

**What:** Ships attack enemy-owned stars and fleets. Combat uses the weapon effectiveness matrix. Outcome is deterministic on the server.

### Sub-features
| # | Item | Detail |
|---|---|---|
| 8.1 | Attack command | `Deploy` command: ship/fleet targets enemy star or ship. |
| 8.2 | Damage resolution | Server applies `weaponEffectiveness[attShipType][defShipType]` modifier, computes damage, updates HP. |
| 8.3 | Destruction | Ship/fleet destroyed if HP reaches 0. Ownership transfer if star defense eliminated. |
| 8.4 | Combat event | Event pushed to both players via mail/notification: attacker result, defender losses. |
| 8.5 | Ground defense | Defense buildings (Starbase, Battle Station, Ground Defense) add passive defense values. |
| 8.6 | Shields | Planetary Shields (`ActivateShield` command) provide temporary immunity. Duration from `ShieldTime` constant. |
| 8.7 | Tests | Attack outcomes by ship-type matchup. Effectiveness matrix application. Shield blocks attack. Ownership transfer on elimination. |

---

## Feature 9 — Quests ❌ NOT STARTED

**What:** Linear tutorial/progression quest chain guiding players through core loops: build → mine → launch → discover → colonize.

### Quest chain (from `game_catalog_v1`)
| qid | Step |
|---|---|
| 0 | Accept quest |
| 1 | Upgrade ore facility |
| 2 | Upgrade food facility |
| 3 | Build a dock |
| 4 | Build a probe |
| 5 | Move a ship |
| 6 | Discover a star |
| 7 | Complete |

### Sub-features
| # | Item | Detail |
|---|---|---|
| 9.1 | Quest state | Player profile tracks `{ currentQuestId, state, progress }`. |
| 9.2 | Event hooks | Building/ship/discovery actions check quest progress and call `UpdateQuest` on match. |
| 9.3 | Rewards | Quest completion grants `gc_soft` or other rewards. |
| 9.4 | Quest panel | Persistent HUD panel shows active quest step and progress. |
| 9.5 | Tests | Each event type advances correct quest step. Completion detection. |

---

## Feature 10 — Social: Mail and Alliances ❌ NOT STARTED

**What:** Player-to-player mail for coordination. Alliances for shared map visibility and combined attacks.

### Sub-features
| # | Item | Detail |
|---|---|---|
| 10.1 | Mail schema | `{ mailId, sender, recipientId, title, body, type, isRead }`. |
| 10.2 | SendMail command | Writes to recipient's mail store. |
| 10.3 | Alliance creation | `CreateAlliance` command, leader role assigned. |
| 10.4 | Join flow | Invitation sent via mail, `JoinAlliance` accepts. |
| 10.5 | Alliance map visibility | Alliance members share fog-of-war on owned/discovered stars. |
| 10.6 | Leaderboard | Ranked by stars owned, buildings built, ships active, net worth. |
| 10.7 | Tests | Mail send/receive. Alliance create/join/leave. Duplicate invite rejection. |

---

## Implementation Phases

| Phase | Features | Status | Goal |
|---|---|---|---|
| **P1** | 1 Resources, 2 Buildings | ✅ Complete | Stars produce resources. Players can build and upgrade. |
| **P2** | 3 Ship Building, 4 Colonization | ⚠️ Ships done, Colonization not started | Players build ships and expand. |
| **P3** | 5 Cargo, 6 Movement | ⚠️ Transfer/transit exists, no cargo or interpolation | Trade routes and inter-star economy emerge. |
| **P4** | 7 Currency, 8 Combat | ❌ Not started | Economy rewards and conflict. |
| **P5** | 9 Quests, 10 Social | ❌ Not started | Onboarding, retention, alliances. |
| **P6** | 11 Sharing | ❌ Not started | Organic virality via Reddit-native sharing. |

---

## Feature 11 — Sharing ❌ NOT STARTED

**What:** Voluntary share buttons let players post game moments to the subreddit as formatted comments or image cards, driving organic discovery.

**Why:** Reddit apps grow through subreddit engagement. Every share is a mini-ad that shows the game is active and interesting. Players sharing accomplishments creates social proof and FOMO.

### Design Approach

**Mechanism:** Each share action calls a server endpoint that creates a **Reddit comment** on a pinned "Activity Feed" post (or the game post itself) using the Devvit `reddit.submitComment()` API. The comment contains formatted text + optional inline image (generated server-side as an SVG→PNG card). The player sees a confirmation toast.

**Alternative:** If comment posting isn't viable (rate limits, permissions), fall back to **clipboard copy** of formatted text that players can paste wherever they want.

### Share Types

| # | Share Type | Trigger Location | Content |
|---|---|---|---|
| 11.1 | Station | Dock panel (BUILD tab) | "🏗️ {username} upgraded {starName} Station to Level {N}! ({ore}/{food}/{energy} production)" |
| 11.2 | Fleet | Fleet panel | "🚀 {username}'s fleet: {shipList} — {totalShips} ships across {starCount} systems" |
| 11.3 | Mission Result | Fleet panel (transit arrival) | "📡 {username}'s {shipName} arrived at {starName}! ({discoveryLevel})" |
| 11.4 | Discovered System | Galaxy view (star info card) | "🌟 {username} discovered {starName} — {spectralType} with {planetCount} planets and {beltCount} asteroid belts" |
| 11.5 | Leaderboard | Weekly auto-post or manual | "🏆 Week {N} Rankings: 1. {user} ({score}) 2. {user} ({score}) ..." |

### Sub-features

| # | Item | Detail |
|---|---|---|
| 11.1 | Share button UI | Small share icon (⤴) on each shareable panel. Canvas-rendered, hit-tested. Subtle — not intrusive. |
| 11.2 | Share API endpoint | `POST /api/share` — accepts `{ username, shareType, payload }`. Server formats the message and posts via Devvit API. Rate-limited: 1 share per type per 5 minutes per user. |
| 11.3 | Devvit comment posting | Server uses `context.reddit.submitComment()` on the game post (or a designated activity post). Formatted with markdown + flair. |
| 11.4 | Fallback: clipboard | If Devvit comment API unavailable or rate-limited, copy formatted text to clipboard with toast "Copied! Paste in comments." |
| 11.5 | Share cooldown | Redis key `share:{username}:{type}` with TTL = 300s. Prevents spam. Client shows cooldown timer on button. |
| 11.6 | Activity feed post | On app install, create a pinned "Activity Feed" post where all shares go as comments. Keeps the game post clean. |
| 11.7 | Leaderboard automation | Scheduled job (Devvit scheduler) runs weekly, computes rankings from player stats, posts leaderboard comment. |
| 11.8 | Share card image (stretch) | Server-side SVG template rendered to PNG — shows station/fleet/star as a visual card embedded in the comment. |

### Technical Notes

- **Devvit API access:** The server runs inside Devvit's context and has access to `context.reddit` for comment posting. The WebView client cannot call Reddit APIs directly — must go through the server.
- **Rate limiting:** Both client-side (disable button + timer) and server-side (Redis TTL check) to prevent abuse.
- **Message formatting:** Use Reddit markdown in comments. Ship names from `SHIP_CATALOG`, star names from galaxy seed, building levels from economy profile.
- **Privacy:** All shares are opt-in. No automatic posting. Player must click the share button deliberately.
- **Spam prevention:** Max 1 share per type per 5 min. Max 10 total shares per hour per user. Server enforces both.

### Implementation Priority

Start with **11.4 Discovered System** (simplest — just star data, no complex aggregation) and **11.2 Fleet** (already have the data in fleet panel). Station and Mission follow naturally. Leaderboard is a separate scheduled job.

---

## Engineering Principles

- All state mutations are **server-side commands** with idempotency keys.
- All time-dependent calculations (production, movement, builds) use **elapsed-time computation at read time**, not polling ticks.
- Pure **domain reducer functions** for all state transitions — fully unit-testable without UI or server.
- **Shared TypeScript contracts** define request/response shapes across client/server.
- UI is a **thin adapter** over the domain layer; no game logic in render functions.
- Existing non-UI test harness (Vitest, game-service layer, shared contract tests) is the foundation — every new feature adds reducer tests first.

---

## Feature 12 — Help System (Contextual Idle Hints)

**What:** A tutorial/hint system that shows contextual guidance when the player is idle, teaching them what to do next based on their current state.

**Why:** New players have no onboarding. The game is complex (multiple tiers, fleet management, economy, colonization). Players who don't know what to do next churn.

### Design

- **Trigger:** Player hasn't interacted for ~8 seconds.
- **Placement:** Thin bar at bottom of screen, above orbit/dock bar.
- **Behavior:** Fades in after idle timeout, fades out on any input.
- **Dismissal:** Tapping anywhere or interacting with any control.
- **Dedup:** Each hint shown once per session (tracked in a `Set<string>`).
- **Expandable:** Small "?" icon on right; tap to expand full tip text.

### Contextual Hints

| # | State | Hint Text |
|---|---|---|
| 12.1 | Docked at home station, no ships built | "Tap BUILD to construct your first scout ship" |
| 12.2 | Has scout, never visited another star | "Tap FLEET → send your scout to explore nearby stars" |
| 12.3 | In galaxy view, no target set | "Tap a star to see info, then VISIT to fly there" |
| 12.4 | At unowned star with colony ship | "Orbit the planet and tap COLONIZE to claim this star" |
| 12.5 | Docked at owned station, low resources | "Build mines and solar arrays to generate resources" |
| 12.6 | In system view, never entered a planet | "Fly close to a planet to enter orbit" |
| 12.7 | Ship idle in transit view | "Your ship is en route. Tap another star to explore" |
| 12.8 | Docked, full storage | "Build a warehouse to increase storage capacity" |
| 12.9 | Has multiple stars, no transfers | "Use FLEET to transfer ships between your colonies" |
| 12.10 | New player, splash screen | "Tap anywhere to begin your journey" |

### Voice Prompt Locations (future audio cues)

| # | Event | Prompt |
|---|---|---|
| V.1 | Leave dock | "Undocking. Safe travels, pilot." |
| V.2 | Dock established | "Docking complete. Station online." |
| V.3 | Colonize success | "Colony established. Star claimed." |
| V.4 | Ship build complete | "Construction complete. Ship ready." |
| V.5 | Enter new star system | "Entering [star name] system." |
| V.6 | Low fuel warning | "Fuel reserves critical." |
| V.7 | Under attack | "Shields taking fire." |
| V.8 | Fleet arrival | "Ship has arrived at destination." |
| V.9 | First discovery | "New system detected." |
| V.10 | Exit to galaxy | "Leaving system. Engaging warp." |

### Implementation Priority

Start with **12.1–12.4** (early game flow). Add idle timer + hint bar renderer. Voice prompts are a separate pass (requires audio asset creation).

### Onboarding — Side Panel Pulse

For brand-new players (no ships built, first session), pulse/brighten the right-side tab buttons (STATUS, BUILD, SHIPS, FLEET) with a slow glow animation to draw attention. The pulse fades once the player taps any tab. Implementation:
- Track `hasEverOpenedPanel` in session state (starts false).
- While false, apply a sine-wave alpha boost (0.4→1.0) on the tab button borders/text.
- On first tab tap, set flag true, stop pulsing permanently for that session.
- Optionally pulse only the most relevant tab (e.g. BUILD when docked with no ships).
