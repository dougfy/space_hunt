# Attack Plan — Valcordia Space Economy

**Basis:** ValcordiaSpace design artifacts (`economy_catalog_v1.md`, `domain_model.md`, `game_catalog_v1.md`, `architecture_v1.md`, `design_phase_0.md`, `program_management.md`)

**Platform:** Devvit WebView (TypeScript/Canvas2D), current `spacehunt` codebase.

**Last Updated:** 2026-07-22 (v0.0.266)

---

## Active Issues / TODO

| # | Issue | Status | Notes |
|---|---|---|---|
| 1 | Boundary issue in solar tier — no need to scroll | ❌ Open | System view should fit without scrolling. |
| 2 | Leaving solar→galaxy with bounds on loses bounds state | ❌ Open | Bounds-on flag not preserved across tier transitions. |
| 3 | Galaxy view: separate ship nav from fleet movement picker | ❌ Open | Ship movement shows where ship is + lets user explore. Fleet picker selects ship/location → directs to destination. Probes can explore any star. Colony ships only to fully-explored stars (not probe-explored). Probe info = summary; ship visit = full info. Touch: need a way to select star and show info without hover. |
| 4 | Star coloring not working — see red stars after visiting | ❌ Open | Expected: visited = green, foreign-claimed = red, undiscovered = yellow. May be visit-star not overriding foreign ownership. |
| 5 | Ship name editing blocked by steering keys | ✅ Fixed (v0.0.257) | Mode flag added — keyboard input passes through when editing ship name. |

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

## Feature 4 — Star Colonization ❌ NOT STARTED

**What:** Send a Colony Ship (type 8) to an undiscovered or unclaimed star to claim it, install a Command Center, and start producing resources.

**Why fourth:** colonization is the expansion loop. It creates new stars that generate resources, enabling further growth.

### Sub-features
| # | Item | Detail |
|---|---|---|
| 4.1 | Colonize command | Ship must be type 8, at target star, target must be unowned. Creates star ownership record, installs base buildings, marks star as `owned`. |
| 4.2 | Star capacity (SpanOfControl) | Command Center level determines max building slots on the star. |
| 4.3 | Visual update | Colonized star switches to `player` owner → blue tint in galaxy/system views. |
| 4.4 | Colony Ship consumed | Colony ship is removed from player inventory on successful colonization. |
| 4.5 | Tests | Colonize command: valid, invalid owner, wrong ship type, already owned. |

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

---

## Engineering Principles

- All state mutations are **server-side commands** with idempotency keys.
- All time-dependent calculations (production, movement, builds) use **elapsed-time computation at read time**, not polling ticks.
- Pure **domain reducer functions** for all state transitions — fully unit-testable without UI or server.
- **Shared TypeScript contracts** define request/response shapes across client/server.
- UI is a **thin adapter** over the domain layer; no game logic in render functions.
- Existing non-UI test harness (Vitest, game-service layer, shared contract tests) is the foundation — every new feature adds reducer tests first.
