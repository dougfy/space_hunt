# Attack Plan — Valcordia Space Economy

**Basis:** ValcordiaSpace design artifacts (`economy_catalog_v1.md`, `domain_model.md`, `game_catalog_v1.md`, `architecture_v1.md`, `design_phase_0.md`, `program_management.md`)

**Platform:** Devvit WebView (TypeScript/Canvas2D), current `spacehunt` codebase.

---

## Context

The game already has:
- Galaxy / System / Planet / Local tier navigation.
- Star ownership and discovery with visual color coding (home=blue, undiscovered=green, discovered foreign=white).
- Planet-tier docking at stations with a dock panel.
- Ship movement, fuel, shooting, ghosts (other players).
- Non-UI test harness: domain reducers, shared contracts, service layer.

The economy sits on top of this as the **reason to explore, colonize, and fight.**

---

## Feature 1 — Resources

**What:** Three core resources — **Ore, Food, Energy** — stored per star. Atomics reserved/gated.

**Why first:** everything else (buildings, ships, trade) depends on resources being real and trackable.

### Sub-features
| # | Item | Detail |
|---|---|---|
| 1.1 | Resource schema | Each owned star carries `{ ore, food, energy }` store values in player profile (Redis/KV). |
| 1.2 | Production rates | Each star produces resources over time at a rate defined by its buildings. Base rate at colonization: small constant per minute. |
| 1.3 | Storage cap | Each resource store has a max (starts small; scales with warehouse buildings). Overflow clamps. |
| 1.4 | Server-side tick | On profile load and on action, server computes elapsed time × rate and applies accumulated production (mirrors legacy `CurrentStoreCalc`). |
| 1.5 | Display | Planet-tier dock panel shows current store values. Star info panel shows production rates. |
| 1.6 | Tests | Pure reducer tests for production accumulation, cap enforcement, overflow clamping. |

---

## Feature 2 — Buildings

**What:** Per-star building slots with levels. Four production families: Ore, Food, Energy production + warehouses. Later: command centers, docks, defense, research.

**Why second:** buildings define production rates and unlock everything else. Nothing else works without them.

### Sub-features
| # | Item | Detail |
|---|---|---|
| 2.1 | Building schema | Each star carries a `buildings` map: `{ [buildType]: { level, status, completeAt } }`. |
| 2.2 | Build catalog | Static catalog from `game_catalog_v1` — building IDs, names, max levels, prereqs, costs per level. Loaded at startup as a shared constant. |
| 2.3 | Prerequisite evaluator | Pure function: given current buildings, returns which build types are unlocked. Mirrors legacy `PreRequisiteTable`. |
| 2.4 | Build cost calculator | Pure function: `(buildType, targetLevel) → { ore, food, energy, durationSeconds }`. |
| 2.5 | BuyBuilding command | Server validates prereqs, deducts resources, writes building with `status: UPGRADING`, `completeAt`. |
| 2.6 | UpgradeBuilding command | Same flow, increments level. |
| 2.7 | Build completion | On profile load: check `completeAt` — if past, mark `ACTIVE`, recalculate production rate. |
| 2.8 | Build tree UI | Planet dock panel shows build tree: locked/building/active states, cost tooltips, upgrade button. |
| 2.9 | Tests | Prereq evaluator unit tests. Cost calculator tests. Build command integration tests (mock store). |

**Initial buildings unlocked at colonization:** Ore Prod (lv1), Food Prod (lv1), Energy Prod (lv1), Space Dock T1 (lv1).

---

## Feature 3 — Ship Building

**What:** Ships are built at a star via the Space Dock building. Each ship type has a cost, build time, and prerequisite building.

**Why third:** ships are the primary economic/military tool. Without buildable ships, the economy has no output.

### Sub-features
| # | Item | Detail |
|---|---|---|
| 3.1 | Ship type catalog | Static reference from `game_catalog_v1`: ID, name, speed, offense, defense, transport, ship-points cost, dock prereq. |
| 3.2 | BuyShip command | Server validates dock level/prereqs, deducts resources or ship-points, queues ship build with `completeAt`. |
| 3.3 | Ship completion | On profile load: if `completeAt` past, mark ship as `IDLE` at home star. |
| 3.4 | Fleet assignment | Ships can be grouped into a fleet for joint movement orders. |
| 3.5 | Ship list UI | Dock panel shows owned ships at current star, their status, and build queue. |
| 3.6 | Tests | BuyShip prereq validation tests. Ship completion state machine tests. |

**Initial ship types available:** Scout (1), Freighter (2), Colony Ship (8), Basic Probe (11).

---

## Feature 4 — Star Colonization

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

## Feature 5 — Cargo and Trade

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

## Feature 6 — Ship Movement

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

## Feature 7 — Currency and Commerce

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

## Feature 8 — Combat

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

## Feature 9 — Quests

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

## Feature 10 — Social: Mail and Alliances

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

| Phase | Features | Goal |
|---|---|---|
| **P1** | 1 Resources, 2 Buildings | Stars produce resources. Players can build and upgrade. |
| **P2** | 3 Ship Building, 4 Colonization | Players build ships and expand. |
| **P3** | 5 Cargo, 6 Movement | Trade routes and inter-star economy emerge. |
| **P4** | 7 Currency, 8 Combat | Economy rewards and conflict. |
| **P5** | 9 Quests, 10 Social | Onboarding, retention, alliances. |

---

## Engineering Principles

- All state mutations are **server-side commands** with idempotency keys.
- All time-dependent calculations (production, movement, builds) use **elapsed-time computation at read time**, not polling ticks.
- Pure **domain reducer functions** for all state transitions — fully unit-testable without UI or server.
- **Shared TypeScript contracts** define request/response shapes across client/server.
- UI is a **thin adapter** over the domain layer; no game logic in render functions.
- Existing non-UI test harness (Vitest, game-service layer, shared contract tests) is the foundation — every new feature adds reducer tests first.
