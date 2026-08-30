# Attack Plan — Valcordia Space Economy

**Basis:** ValcordiaSpace design artifacts (`economy_catalog_v1.md`, `domain_model.md`, `game_catalog_v1.md`, `architecture_v1.md`, `design_phase_0.md`, `program_management.md`)

**Platform:** Devvit WebView (TypeScript/Canvas2D), current `spacehunt` codebase.

**Last Updated:** 2026-08-23 (v1.4.85)

---

## 🎯 Current Priorities

| # | Priority | Description | Why |
|---|----------|-------------|-----|
| 1 | **Journey Instrumentation (First 5 min)** | ✅ Complete for the core game journey: app/game readiness, first movement, first dock, and first resource are instrumented through the Devvit analytics path. Splash is a separate mini-game and is not part of this journey funnel. | Retention funnel instrumentation is in place for the playable game path. External Devvit allowlist/approval remains an account/platform check, not a code task. |
| 2 | **Help System (First 5 min)** | ✅ Complete for first-session onboarding: the guided flow teaches BUILD, station upgrade, skin selection, undock, navigation/docking, scan, and Help access. Broader optional topic guides remain tracked separately in #39. | The first-session help requirement is satisfied; remaining tutorial work is advanced/topic-specific rather than blocking first 5 minutes. |
| 3 | **Testing (Unit & System)** | Expand test coverage: combat, alliance/DM, ship building, voice/sensors. CI confidence before next features. Playwright E2E framework operational (v1.4.32). | Prevents regressions as features stack. |
| 4 | **AI Probe (Autonomous Explorer)** | AI-controlled probe that travels star-to-star autonomously, exploring systems and refueling when it finds fuel. Reveals galaxy map without player input. | Adds passive exploration, makes galaxy feel alive, gives new players a head start on map knowledge. |
| 5 | **Expanding Star System** | Dynamically grow the galaxy when more players join and existing stars are all claimed. Add new star clusters connected to the existing graph. | Required for scaling — without this the game hits a hard player cap when all 100 stars are colonized. |
| 6 | **Backstory & Video COMS** | Feature 19/20 lore integration + video communication system. | Differentiates the game, adds atmosphere. |
| 7 | **Finishing New Skins** | Skin framework implementation — station skins first (POC), then expand. | Visual variety, potential premium content. |

---

## Active Issues / TODO

| # | Issue | Status | Notes |
|---|---|---|---|
| 1 | Boundary issue in solar tier — no need to scroll | ✅ Fixed | System view fits without scrolling. |
| 2 | Leaving solar→galaxy with bounds on loses bounds state | ✅ Fixed | Bounds state now persisted in localStorage. Survives tier changes and page reloads. |
| 3 | Galaxy view: separate ship nav from fleet movement picker | ✅ Done | Transfer mode with per-ship-type filtering (probes→undiscovered, colony→probed+unowned, freighter→owned+trade stations). |
| 4 | Star coloring not working — see red stars after visiting | ✅ Fixed (v0.0.293) | Foreign stars now show red via `getGalaxyStarTone()` checking `owner === 'foreign'`. |
| 5 | Ship name editing blocked by steering keys | ✅ Fixed (v0.0.257) | Mode flag added — keyboard input passes through when editing ship name. |
| 6 | iPad sizing | ❌ Open | Layout/canvas not adapting properly to iPad screen dimensions. |
| 7 | Pinch gesture conflicts with ship movement | ❌ Open | Pinch-to-zoom triggers ship movement instead of being handled as zoom. Need gesture disambiguation. |
| 8 | Galaxy fuel vs system fuel | ✅ Done | **→ Feature 14 (Fuel as Commodity)** implemented — fuel is real resource, Refinery building, ownership-gated dock. |
| 9 | Extended discovery: belt items, planet items, multiple ores, Knowledge | ⚠️ Partial | Multi-color pods (6 types: refuel/dock/energy/ore/food/upgrade). Planet SCAN exploration (7 outcomes). Blueprint + anomaly finds. Full knowledge/multiple ore system still open. |
| 10 | Entry into solar tier dumps into belt | ✅ Fixed | `restorePosition` now places ship at system edge (dist 20) instead of center (dist 3). |
| 11 | Belt (Local tier) missing side controls | ✅ Done | Added `drawControlButtons` to Local tier render. |
| 12 | Ship docked voice repeats on fleet/galaxy view switch | ✅ Fixed | Dock state now saved/restored across temporary galaxy jumps for fleet panel. |
| 13 | COMPLETE button visible to all players | ✅ Fixed | COMPLETE button now gated behind `_isAdmin` flag. |
| 14 | Help/journey system not persisting across sessions | ✅ Fixed | Journey completion saved to localStorage. |
| 15 | Help/journey voice plays in system tier | ✅ Fixed | `updateJourney()` now gated to Planet tier only. |
| 16 | Probe not consumed after arrival | ✅ Fixed | Probes consumed on arrival, star marked as discovered. discoveredStars returned in FleetAllResponse. |
| 17 | COMS nested replies + loading state | ✅ Fixed (v1.1.20) | Reddit comment threading support with depth display. |
| 18 | Layout overlapping (fleet ships, feature labels, player names) | ✅ Fixed (v1.1.25) | Increased spacing constants across galaxy view. |
| 19 | Trading station ⚖ icon visible before discovery | ✅ Fixed (v1.1.31) | Icon only shown after star is probed/visited. |
| 20 | Probe arrival not updating star to probed state | ✅ Fixed (v1.1.29) | Server now returns discoveredStars in FleetAllResponse; client uses authoritative list. |
| 21 | **REDDIT REVIEW: UGC reportability** | ✅ Fixed | DM report button implemented. `POST /api/coms/dm/report` stores report in Redis + sends modmail to subreddit moderators with attribution. |
| 22 | **REDDIT REVIEW: Admin endpoint security** | ✅ Fixed | `requireDev` middleware in `src/server/core/admin-auth.ts` uses `reddit.getCurrentUsername()` (Devvit-authenticated). Applied to all admin/debug/bot routes. Client-side `ADMIN_USERS` retained for UI only. |
| 23 | **Bot smooth presence (Level 2 patrol)** | ✅ Fixed | Server-side time-based drift in `listRoomPoses()`. Bot visible at all tiers (Galaxy patrol, System/Planet arrive-linger-depart). NavigationTier.Planet=3 fix. |
| 24 | **Font readability / dim text** | ⚠️ Partial (v1.4.58) | Minimum canvas font raised one step across `renderer.ts` — all 5px → 6px, all 6px → 7px (~80 call sites). Smallest text in the game is now 7px. Contrast pass still open (see #28). |
| 36 | **Font scale picker in Settings (S/M/L)** | ⚠️ Stages 1–2 done (v1.4.60) | `src/game/font.ts` provides `f(size, weight?, family?)`, `getFontScale()`, `setFontScale()` (clamped 0.8–1.5, 6px floor). All 229 canvas font strings in `renderer.ts` and `game-loop.ts` converted; scale locked at 1.0. **Current UI = "Small" = 1.0, and Small must remain pixel-identical forever.**<br><br>**Root cause of the difficulty:** 250 `ctx.fillText` calls vs only **3** `measureText` calls — layout is assumed, never measured. Every width/offset is hand-tuned to the present font size.<br><br>**Impact inventory:** (A) font strings ×229 ✅ done; (B) module layout consts ×18 — `TAB_W/H/GAP`, `ROW_H`, `PANEL_PAD`, `PANEL_WIDTHS`, `MODE_BTN_W/H`, `CTRL_BTN_RADIUS`, `GZOOM_BTN_SIZE`, `SKIN_BTN_W/H`; (C) function-local layout consts ×~110; (D) **inline text offsets ×~101** (`ty + 16`, `by + 18`…) — the class that broke the tab labels, and ungreppable from other arithmetic; (E) hit-test rects, must scale identically to their draw rects or clicks misland; (F) HTML/CSS ×26 inline font decls across the 3 entrypoints — separate system; (G) `splash.ts` unconverted; (H) fixed containers that **cannot** grow (`TAB_W=28` strip, 57px extension buttons, orbit bar) — these need reflow, not scaling.<br><br>**Passes:** (1) ✅ **done v1.4.65** — `fontScale` on profile, S/M/L buttons in Settings, restored on load; `f()` short-circuits to identity at scale 1.0 so **Small can never drift** from the original layout; (2) ✅ **done v1.4.65** — `src/game/text-audit.ts` patches `fillText` and measures every draw against the panel being rendered (region registered in `drawPanelFrame`). Console: `__textAudit(true)`, open panels at Medium/Large, then `__textAudit()` for a report sorted by overflow px with call sites; (3) per-panel rollout, each independently shippable — STATUS first (already `ROW_H`-driven), BUILD last (fixed grid); (4) `--font-scale` CSS custom property for HTML, plus reflow rules for H-class containers (tab strip widens at L, extension grid 4→3 columns).<br><br>**⚠️ Medium/Large are currently font-only and WILL overflow** — they are shipped as a diagnostic surface for pass 3, not as a finished feature.<br><br>**Worked example (v1.4.62, reverted v1.4.64):** side-tab labels 7px → 9px fit the 48px tab height fine but collided with the icon — the rotated title draws at `ty + TAB_H/2 + 6`, an offset hand-tuned for 7px to clear the icon at `ty + 16`. Positioning offsets must scale too, not just widths and heights. |
| 37 | **Feature docking + Space Dock refuel** | ⚠️ Partial (v1.4.63) | **Done:** dock detection now shares the renderer's merged static + server-built feature list via `setDockFeatureProvider()` (was iterating static `body.features` only, so built structures rendered but were never dock targets). Provider is used by detection, approach positioning, undock clearance and the line-of-sight release scan so `featureIndex` stays consistent. Docking restricted to `DOCKABLE_FEATURE_TYPES = { station, dock }` — all other built structures are deliberately **not** dockable pending a purpose for each (see #31). `DockState.featureType` added so the orbit bar can vary its action set; at the Space Dock `⛽ REFUEL` replaces `SCAN`. Refuel fills to `FUEL_CAPACITY_BY_SHAPE` and debits star fuel via the existing `_pendingRefuel` path. **⚠️ NOT DONE — both currently client-side and bypassable:** (1) the 5-min cooldown lives in `game-loop.ts` as `_lastSpaceDockRefuelMs` and **resets on page reload** — must move to a server Redis key `refuel:{postId}:{user}` with TTL 300s, checked in a new `POST /api/refuel/dock`; (2) the **"until colony level" gate is not implemented at all** — refuel currently works no matter how many stars the player owns. Intended rule: available only while the player owns fewer than 2 stars, read from the `stars:{postId}` claims registry server-side. |
| 38 | **Dockable structure purposes (per-feature actions)** | ❌ Open | `DOCKABLE_FEATURE_TYPES` in `dock.ts` is the single gate — adding a type there makes it dockable immediately, so each needs its interaction designed first. Open questions recorded inline: `mine`/`mine_l2` → maintenance or yield boost?; `solar_array`/`solar_array_l2` → efficiency check?; `colony` (hab) → population/recruitment?; `warehouse` → cargo transfer?; `shield`/`cannon` → defence control?; `refinery` → fuel conversion?; `relay`/`outpost` → unused feature types, decide whether to keep. Supersedes the docking half of #31. |
| 39 | **Tutorial topics beyond onboarding** | ⚠️ Guides shipped; interactive sequences open | **Shipped through v1.4.79:** post-scan handoff is now linear: step 7 callout sits **below** `?` with an upward arrow → opening Help pauses all canvas coach overlays → closing Help advances to the opaque congratulations card → **MORE TUTORIALS** opens clean Help/Next; **GO PLAY** completes onboarding. Help is documentation-only: the conflicting orange Tutorial/Continue/Replay/Reference controls were removed. `MORE TUTORIALS` now exposes usable guide links: **BUILD A SHIP** → Ships tab; **COMMS** → Guide/Comms section. Comms guide is deliberately read-only: PUBLIC/PRIVATE/ALLIANCE/BOARD explained; no player is required to send UGC. Build tree, ships, buildings, solar/belt are documentation (`doc`) topics, not coach sequences; solar/belt content is in Guide → *Navigating the Tiers* (Galaxy→System→Planet→Belt, entry rings, belt entry, ⊕ bounds, ◄ SYSTEM).<br><br>**Next infrastructure required for interactive topics:** (a) named sequences `{ id, title, steps[] }` — coach is still one linear `STEP_ORDER`; (b) per-sequence completion/progress (`coachDone: string[]` + `{ seqId, step }`) replacing single `coachStep`; (c) informational no-target steps — current overlay returns early without a target, so “tap anywhere to fly” needs a reusable centred card; (d) a real topic hub/modal for sequence launch/resume/replay, rather than using Help as a fake picker. **Important UX rule:** Help owns reading, coach owns guided action, congratulations owns the decision; never show them over one another.<br><br>**Interactive topic backlog:** Controls 4 steps M — `drawControlButtons` + card steps; Status 2 S; Ships 3 S — `_lastShipButtons`; Comms 5 M — `_comsTabButtons`, opening tabs only; Alliance management separate 4–5 M — `_allianceButtons`; Fleet/Galaxy 5 M — `_fleetMapButton`, `_fleetSendButtons`, `_galaxyModeBtn`, `_galaxyExitBtn`; Returning status 2 S — report badge; Settings/feedback 3 S — HTML buttons via `domButtonRect`.<br><br>**Bounds note:** ⊕ is `getCtrlBtnPositions().recenter`; it toggles bounds and recentres. v1.4.73 removed its old hidden side effect of stopping/cancelling the ship. Still consider splitting bounds onto its own control before writing Controls copy. **Order:** named-sequence infrastructure + Controls, then Status/Ships/Settings, then Comms, Fleet/Galaxy, Alliance. |
| 40 | **Wire staged new sound pack into runtime audio map** | ❌ Open | 19 new voice/sfx files were moved out of runtime `public/sounds` into `assets/reference/source-audio/pending/` because they are not currently referenced by exact filename in source. Next pass: (1) pick canonical names, (2) move selected files back to `public/sounds`, (3) add mappings in `src/game/audio.ts`, (4) prune/replace near-duplicates (for example `Anomalous signal detected (2).wav` and `Warning hostile raider (1).wav`), (5) run a quick in-game audio smoke test. |
| 41 | **Galaxy/System return can reset moving ship to home star** | ❌ Open | Bug observed in the galaxy view/system transition flow: while the ship is moving through the galaxy, using the return/navigation path can snap the player ship back to the home star instead of preserving the in-progress galaxy position/target. Investigate `_savedDock`, `currentStarIndex`, `galaxy.tier` transitions, and any `◄ SYSTEM` / fleet-panel revert paths that reconstruct system state from home/current star rather than the ship's active galaxy location. Required fix: returning from galaxy/system views must preserve the ship's actual movement state and never teleport it home unless the player explicitly chooses home. |
| 42 | **Colony expansion sequence and guided tutorial** | ❌ Open | Treat expansion as a deliberate multi-step journey rather than a single `COLONIZE` action. **Recommended gates:** (1) Colony Ship construction requires either a Basic Probe in stock or at least one previously visited non-home star; this teaches scouting while preserving a direct-flight path for players who explore manually. (2) Sending a Colony Ship requires the destination to be an unowned star with discovery level `probed` or `visited`; the target picker should explain why other stars are unavailable. (3) On arrival, the colony ship remains staged at the destination and the player must travel there personally. (4) In the destination system, show the colony-ship marker beside its assigned planet; optionally require a planet scan to reveal/confirm that marker. (5) When the player enters the planet's local orbit, expose the `COLONIZE` action. (6) Server validates the ship, star, body, ownership, and arrival state before consuming the ship and claiming the star. **Tutorial lead-through:** `BUILD PROBE` → `SEND PROBE` or `VISIT A STAR` → `BUILD COLONY SHIP` → `OPEN FLEET / SEND` → select highlighted discovered star → wait for arrival → `VISIT DESTINATION` → identify/scan marked planet → orbit it → press `COLONIZE` → show confirmation and new-star setup. Use resumable checkpoints and contextual callouts; do not unlock the final button early. Add explicit transit/arrival states and recovery text for an occupied, invalidated, or already claimed target. |
| 43 | **Splash command center** | ⚠️ Leaderboard shipped; tutorial pending | Put the public leaderboard and a clear tutorial/help entry on the first splash screen before gameplay. The leaderboard should be read-only, compact, and responsive, with loading, empty, and unavailable states. Reuse the existing scoring endpoint rather than creating a second ranking system. Later add a tutorial entry that opens the existing Help documentation without auto-starting any guided sequence. |

Detailed quest-item and air-purifier event design: [quest-items.md](quest-items.md).

### Daily Return Mechanics for the Splash Command Center

These mechanics extend #43 beyond a static splash. Each should be:

- Server-authoritative
- Generated once per UTC day
- Visible as a return summary or actionable card
- Free of unsolicited tutorial flashing or voice prompts

| Priority | Mechanic | Return experience | Reason to return |
|---|---|---|---|
| ★★★★★ | **Daily Probe Report** | “Long-range probe detected an unknown Luminari signature near Deneb.” | Something happened while I was gone. |
| ★★★★★ | **Daily Command Directive** | Choose one of three missions: Explore, Mine, or Military. | A new decision every day. |
| ★★★★★ | **Daily Anomaly** | A temporary relic, derelict, signal, comet, or similar opportunity appears somewhere. | Today’s opportunity disappears. |
| ★★★★☆ | **24-hour Automaton Threat** | Automatons approach one of the player’s systems. | Defend the empire. |
| ★★★★★ | **Daily Shared Challenge** | Everyone receives the same mission or target system. | Compare progress with everyone else. |
| ★★★☆☆ | **Command Streak** | “Day 6 of active command” with escalating modest rewards. | Don’t break the streak. |
| ★★★★☆ | **Daily Research Choice** | Choose one temporary research focus for the next 24 hours. | Shape tomorrow’s empire. |
| ★★★☆☆ | **Galactic Market/Event** | Ore shortage, fuel surplus, shipbuilding discount, or another daily modifier. | Today’s economics are different. |
| ★★★★☆ | **Community Campaign** | All players contribute toward defeating or exploring a shared objective. | Individual actions affect Reddit-wide progress. |
| ★★★★★ | **Daily Reddit Dispatch** | A fresh Reddit post announces the day’s situation. | Creates a new feed entry into the game. |

#### Recommended Rollout

1. **Daily Reddit Dispatch** — creates the daily public entry point.
2. **Daily Probe Report** — uses existing fleet and returning-report concepts.
3. **Daily Command Directive** — adds a meaningful daily decision.
4. **Daily Anomaly** — adds a time-limited opportunity on the galaxy map.
5. **Shared challenge and Automaton threat** — introduce competition and defensive urgency.
6. **Streak, research, market, and community systems** — add longer-term retention once the daily loop is proven.

| 25 | **Undocking not discoverable** | ✅ Fixed (v1.4.54) | Coach step 4/7 rings the UNDOCK button with a callout. `undock()` also now picks a release heading with clear line-of-sight to the planet (`findClearReleaseDir()`) so players don't immediately re-dock at the starbase. |
| 26 | **Tutorial mode (restartable)** | ⚠️ Onboarding complete; topic continuation open | Seven-step onboarding is shipped: BUILD → STATION → skin → undock → fly/dock → scan → Help. It persists `coachStep` + `coachSkipped`; SKIP preserves resumable progress while GO PLAY completes it. Feedback waits until the coach ends. **Current post-scan flow (v1.4.76+):** Help is clean reading only; closing it shows congratulations; MORE TUTORIALS opens the Help Next hub; GO PLAY ends onboarding. **Do not restore the old in-Help Replay controls** — they caused conflicting UI. Remaining: named topic sequences / per-sequence progress / true sequence hub tracked in #39. |
| 35 | **Legacy journey hints — rescoped, not retired** | ✅ Repurposed (v1.4.57) | `ENABLE_JOURNEY_HINTS = true`. The old tab pulse / UNDOCK pulse / idle voice prompts now serve **only** players who have already seen the coach tutorial and have stalled without acting — `startJourney()` runs on the returning-player branch, `skipJourney()` on the new-player branch, so the two systems never overlap. UNDOCK pulse gated on `dock.docked`. The `?` icon also rings during the idle pulse to advertise the replay button. |
| 27 | **Buildings not visible on star visit** | ❌ Open | When visiting a star, buildings and station not rendering initially. May be a timing/load issue where economy data arrives after first render. |
| 28 | **Text contrast too dim** | ❌ Open | Some UI text (labels, descriptions) too dim against dark background. Need minimum contrast ratio pass across all panels. |
| 29 | **Stuck in galaxy tier** | ✅ Fixed (v1.4.59) | Root cause: `_galaxyJumpReturnTier` (the breadcrumb back to your previous tier) was converted into an actual revert **only** by `togglePlanetPanel(3)`. `closeAllPanels()` and `closeFleetPanel()` both nulled it without queueing — and `closeAllPanels()` fires on any click outside a panel, which on the galaxy map means anywhere on the star field. Opening FLEET to send a ship then tapping the map stranded the player. Fixed with a shared `queueFleetRevert()` used by all three closers, plus an unconditional **◄ SYSTEM** escape-hatch button on the galaxy tier that returns to `currentStarIndex` regardless of panel state. |
| 30 | **Refueling not intuitive** | ❌ Open | Refueling process unclear. Should be covered in tutorial. Consider auto-refuel when docked at owned station, or prominent REFUEL button. |
| 31 | **Docking at buildings (not just station)** | ⚠️ Superseded | Docking mechanism now works for any feature type (#37). Which structures to enable and what each does when visited is tracked in **#38**. |
| 32 | **Colonizing a star needs a better guide / simpler flow** | ❌ Open | Colonization is currently too complex for players to infer: build Colony Ship → open FLEET → SEND the ship → choose an eligible highlighted star → wait for arrival → fly/visit that star → dock → press COLONIZE. We need either (A) simplify the flow, or (B) add a dedicated interactive colonization guide that walks each step with callouts, explains why only some stars are valid targets, confirms when the Colony Ship is in transit/arrived, and points directly at the final COLONIZE action. This should be treated as a must-have tutorial topic, not just help text. |
| 33 | **Empire overview / management screen** | ❌ Open | Need a "Manage My Empire" screen showing all owned stars, buildings, ships, resources, and routes in one place. Currently requires visiting each star individually. |
| 34 | **External leaderboard publishing** | ❌ Open | Need a way to publish the leaderboard outside the game — embeddable widget, public URL, or subreddit sidebar integration. Currently only visible in-game via COMS/BOARD tab. |

---

## Playtest Feedback (2026-08-16)

Three playtesters (WeirdAd4511, LegitimateTree5933, Training-Item5275) over ~21 hours. Key themes:

1. **Discoverability:** How to undock, refuel, send ships, and colonize are all unclear without guidance.
2. **Visual clarity:** Font sizes, text contrast, and building visibility on star visits need improvement.
3. **Navigation:** Players get stuck in galaxy tier with no obvious way back.
4. **Depth desire:** Players wanted to dock at individual buildings and manage their whole empire from one screen.
5. **Tutorial is critical:** A restartable, sectioned tutorial covering the 10 most important actions is the #1 UX priority.

Server logs: `tests/e2e/playtest-logs-2026-08-16.json` (4,733 lines). Analysis: `tests/e2e/playtest-analysis-2026-08-16.md`.

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

## Feature 4 — Star Colonization ✅ DONE (v1.1.25)

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
| 4.7 | Trading stations blocked | ✅ | `colonizeStar()` rejects trading station stars with error. |

---

## Feature 5 — Freighter Trade Routes & Trading Stations ✅ COMPLETE (v1.1.31)

**What:** Freighters run persistent cargo loops between player-owned stars (automated trade routes). Trading stations are neutral stars (~5% of galaxy) where players exchange resources at dynamic rates.

**Why fifth:** cargo transport connects isolated economies — excess ore at one star can fuel building at another. Trading stations provide a resource exchange mechanism without requiring multiple colonies.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| 5.1 | Freighter route schema | ✅ | `FreighterRoute` with id, homeStar, targetStar, cargo, leg (outbound/return), departedAt, arrivalAt. Stored in `ships` profile field. |
| 5.2 | Assign route command | ✅ | `POST /api/fleet/freighter-route` — validates freighter at home star, creates persistent loop. |
| 5.3 | Cancel route command | ✅ | `DELETE /api/fleet/freighter-route` — returns freighter to home star. |
| 5.4 | Route reconciliation | ✅ | `loadAllFleet()` reconciles route legs: outbound→load cargo from target, return→deliver to home. Auto-relaunches. |
| 5.5 | Trading station selection | ✅ | Deterministic: hash(postId, starIndex) mod 20 === 0 → ~5% of stars. `shared/trading.ts`. |
| 5.6 | Trading station economy | ✅ | Each station has stock (ore/food/energy), restocks toward equilibrium (1000) at 10/min. `server/core/trading.ts`. |
| 5.7 | Exchange rates | ✅ | Dynamic: `rate = clamp(stationHasReceive / stationHasGive, 0.5, 2.0)`. Supply/demand pricing. |
| 5.8 | Trade execution | ✅ | `POST /api/trade-station/trade` — deducts from player's best star, updates station stock, returns received amount. Max 200/tx. |
| 5.9 | Trade UI | ✅ | STATUS panel becomes TRADE panel at trading stations: shows stock, 6 exchange rate buttons (TRADE 50 each). |
| 5.10 | Galaxy map icon | ✅ | Gold ⚖ icon above trading station stars (only visible after probed/visited). |
| 5.11 | Freighter target filtering | ✅ | Freighters can be sent to player-owned stars OR discovered trading stations. |
| 5.12 | Colonization block | ✅ | Trading stations cannot be colonized — server rejects with error. |
| 5.13 | Admin: Show Trade Stations | ✅ | Admin panel button lists all trading station names and indices. |
| 5.14 | Sound: first trade only | ✅ | Voice announcement plays only on first trade per session to avoid repetition. |

---

## Feature 6 — Ship Movement ✅ DONE (transit-based)

**What:** Ships and fleets move across the galaxy map between stars. Movement is time-based with server-stored start/target/ETA; client shows transit progress.

**Why sixth:** movement is the connective tissue for trade, colonization, and combat.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| 6.1 | Transfer command | ✅ | `POST /fleet/transfer` creates `ShipTransit` with speed-based travel time (`BASE_TRANSIT_SECONDS / speed`). |
| 6.2 | Transit reconciliation | ✅ | `loadAllFleet()` resolves arrived transits on every poll — delivers ships to destination star. |
| 6.3 | Transit display | ✅ | Fleet panel shows in-transit ships with progress indicator and ETA. Galaxy view shows transit lines. |
| 6.4 | Per-ship-type filtering | ✅ | Transfer mode shows valid targets based on ship type (probes→undiscovered, colony→probed+unowned, freighter→owned+trade). |
| 6.5 | Freighter routes | ✅ | Persistent automated loops (outbound/return legs) with cargo loading/unloading on arrival. |
| 6.6 | Client interpolation | ⏳ | No real-time position interpolation on galaxy map — ships jump on arrival. Cosmetic only. |

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

## Feature 8 — Combat ⚠️ PARTIAL

**What:** Ships attack enemy-owned stars and fleets. Combat uses the weapon effectiveness matrix. Outcome is deterministic on the server.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| 8.1 | Attack command | ❌ | `Deploy` command: ship/fleet targets enemy star or ship. |
| 8.2 | Damage resolution | ❌ | Server applies `weaponEffectiveness[attShipType][defShipType]` modifier, computes damage, updates HP. |
| 8.3 | Destruction | ❌ | Ship/fleet destroyed if HP reaches 0. Ownership transfer if star defense eliminated. |
| 8.4 | Combat event | ❌ | Event pushed to both players via mail/notification: attacker result, defender losses. |
| 8.5 | Ground defense | ❌ | Defense buildings (Starbase, Battle Station, Ground Defense) add passive defense values. |
| 8.6 | Shields | ✅ | `toggleShield` command activates planetary shield. Shield state stored per-star. |
| 8.7 | Raid routes | ✅ | `assignRaidRoute` sends ships on automated attack runs with cargo looting and risk-of-destruction. |
| 8.8 | Tests | ❌ | Attack outcomes by ship-type matchup. Effectiveness matrix application. Shield blocks attack. |

---

## Feature 9 — Discovery & Exploration ⚠️ PARTIAL

**What:** Multi-layered discovery system: colored pods in belt/splash, planet exploration via SCAN, and knowledge/blueprint progression.

**Why:** Discovery creates the exploration incentive that balances against stay-at-home economy building. Players must physically visit planets to get one-shot rewards, creating a push/pull between exploring and producing.

### Sub-features

| # | Item | Status | Detail |
|---|---|---|---|
| 9.1 | Multi-color pods | ✅ | 6 pod types with weighted spawn: refuel (15%), dock (10%), energy (25%), ore (25%), food (20%), upgrade (5%). Colors: red, yellow, blue, orange, green, purple. |
| 9.2 | Planet SCAN | ✅ | SCAN button in orbit bar triggers `POST /api/explore`. One roll per planet per player (global seed, deterministic). Result popup (4s fade). |
| 9.3 | Discovery table | ✅ | 7 outcomes: nothing (35%), ore (18%), food (14%), energy (14%), artifact (10%), blueprint (6%), anomaly (3%). Resources credited to star economy. |
| 9.4 | Redis persistence | ✅ | `explored:{username}:{starIndex}:{bodyIndex}` — prevents re-rolls. Cached result returned on revisit. |
| 9.5 | Artifact collectibles | ❌ | Lore fragments tracked as collection. Achievement integration. |
| 9.6 | Blueprint effects | ❌ | Ship unlock/discount from blueprint finds. Actual gameplay impact. |
| 9.7 | Anomaly buffs | ⚠️ | Server grants & applies 5 buff types; client syncs & plays voice. HUD icons pending. |
| 9.8 | Multiple ore types | ❌ | Differentiated resources beyond ore/food/energy. Rare materials for high-tier builds. |
| 9.9 | Knowledge system | ❌ | Plans/blueprints that unlock build tree branches. Tech tree progression. |
| 9.10 | Quest chain (legacy) | ❌ | Linear quest progression (build → mine → launch → discover → colonize). Replaced by contextual hints. |

### Technical Notes

- **Shared module:** `src/shared/exploration.ts` — `rollDiscovery(galaxySeed, starIndex, bodyIndex)` pure function.
- **Pod generation:** `src/game/pods.ts` — weighted `pickPodKind()` using `POD_TYPES` from constants.
- **Server endpoint:** `POST /api/explore` — checks Redis for prior exploration, rolls discovery, grants resources, persists.
- **Determinism:** Same planet always gives same result for any player (global seed). Prevents "known loot spots" meta.
- **Balance:** Discovery rewards are modest (100-300 resources) — supplements economy, doesn't replace it. Exploring is profitable but slower than dedicated production.

---

## Feature 10 — Social: Mail and Alliances ⚠️ MOSTLY COMPLETE

**What:** Player-to-player mail for coordination. Alliances for shared map visibility and combined attacks.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| 10.1 | Direct Messages | ✅ | Full DM system: send/receive/unread tracking via COMS panel (private tab). |
| 10.2 | Public Comments | ✅ | Reddit comment threading: players post/reply on game thread from COMS panel (public tab). |
| 10.3 | Alliance creation | ✅ | `POST /api/alliance/create` — alphanumeric name, manager role assigned. |
| 10.4 | Join flow | ✅ | Invite via `POST /api/alliance/invite`, accept/decline via `/respond`. 24h invite expiry. |
| 10.5 | Alliance chat | ✅ | Real-time alliance chat via sorted set in Redis. COMS panel (alliance tab). |
| 10.6 | Alliance map visibility | ✅ | `loadAllFleet` merges all alliance members' discovered/enhanced stars into response. |
| 10.7 | Leaderboard | ✅ | Power-ranked leaderboard (stars×100 + ships×10 + buildings×25 + playtime). BOARD tab in COMS panel. |
| 10.8 | Alliance kick/leave | ✅ | Manager can kick members. Members can leave. Alliance deleted when empty. |
| 10.9 | Tests | ❌ | No dedicated alliance/DM test coverage. |

---

## Implementation Phases

| Phase | Features | Status | Goal |
|---|---|---|---|
| **P1** | 1 Resources, 2 Buildings | ✅ Complete | Stars produce resources. Players can build and upgrade. |
| **P2** | 3 Ship Building, 4 Colonization | ✅ Complete | Players build ships and expand to new stars. |
| **P3** | 5 Trade Routes + Trading Stations, 6 Movement | ✅ Complete | Freighter routes, trading stations, inter-star economy. |
| **P4** | 7 Currency, 8 Combat | ⚠️ Partial | 8: Shields + raid routes done. 7: Not started. |
| **P5** | 9 Discovery, 10 Social | ⚠️ Partial | 10: DMs, alliances, chat, shared map done. 9: Pods + SCAN done, blueprints/anomaly effects pending. |
| **P6** | 11 Sharing | ⚠️ Partial | Achievements, fleet POST, weekly leaderboard, public COMS done. |
| **P7** | 12 Help System | ❌ Planned | 5-layer progressive disclosure: idle hints, tab pulse, panel overlays, milestones, build path. Strategy documented in BUILD_TREE.md. |
| **P8** | 13 Automated Player | ✅ Phase 1–4 | FSM (DORMANT/ECONOMY/SHIPYARD/EXPLORE/ROAM/COLONIZE), scheduler cron, smooth presence (server drift), leaderboard exclusion, admin debug, fly-by. |

---

## Feature 11 — Sharing ⚠️ PARTIAL

**What:** Voluntary share buttons let players post game moments to the subreddit as formatted comments or image cards, driving organic discovery.

**Why:** Reddit apps grow through subreddit engagement. Every share is a mini-ad that shows the game is active and interesting. Players sharing accomplishments creates social proof and FOMO.

### Sub-features

| # | Item | Status | Detail |
|---|---|---|---|
| 11.1 | Achievement auto-posts | ✅ | `achievements.ts` posts Reddit comments on milestones (first colony, colony 3/5/10, first ship, frigate/battleship/dreadnought upgrade, dock tier 2/3, first transfer). Redis-tracked, fires once per player. |
| 11.2 | Fleet share button | ✅ | Green "POST" button on fleet panel. `POST /api/share/fleet` posts formatted fleet summary as Reddit comment. 5-min cooldown (Redis TTL). Client shows "..." while on cooldown. |
| 11.3 | Weekly leaderboard | ✅ | Devvit scheduler cron job (`0 12 * * 1` = Mondays noon UTC). Posts top-10 markdown table as comment. Power score: stars×100 + ships×10 + buildings×25 + playtime/720. |
| 11.4 | Public COMS | ✅ | Players can post/reply on game thread directly from COMS panel (public tab). Full Reddit comment threading with depth display. |
| 11.5 | Share cooldown | ✅ | Server-side Redis TTL (300s per type per user). Client-side visual feedback. |
| 11.6 | Station share | ❌ | Share button on BUILD panel for upgrade announcements. |
| 11.7 | Discovery share | ❌ | Share button on galaxy view for star discovery cards. |
| 11.8 | Activity feed post | ❌ | Separate pinned post for activity (currently posts to game post). |
| 11.9 | Share card image (stretch) | ❌ | Server-side SVG→PNG visual cards. |

### Technical Notes

- **Devvit API access:** The server runs inside Devvit's context and has access to `reddit.submitComment()` for comment posting. The WebView client cannot call Reddit APIs directly — must go through the server.
- **Rate limiting:** Both client-side (disable button + timer) and server-side (Redis TTL check) to prevent abuse.
- **Message formatting:** Use Reddit markdown in comments. Ship names from `SHIP_CATALOG`, star names from galaxy seed, building levels from economy profile.
- **Privacy:** All shares are opt-in. No automatic posting (except achievements on milestones). Player must click the share button deliberately.
- **Spam prevention:** 1 share per type per 5 min. Server enforces via Redis TTL.
- **Scheduler:** `devvit.json` `scheduler.tasks.weekly-leaderboard` with cron. Active postId stored in Redis (`app:active_post_id`) for scheduler access without post context.

---

## Feature 13 — Automated Player (NPC Bot) ⚠️ PARTIAL

**What:** A server-driven NPC that plays the game alongside real players. Builds economy, explores stars, visits player systems, colonizes, and eventually responds in COMS. Runs on the Devvit scheduler, dormant when no players are online.

**Why:** Early-stage games feel empty. A visible NPC ship moving through systems, claiming stars, and occasionally chatting creates the illusion of a living world. It also serves as a demonstration of game mechanics (new players see the bot doing things and learn by observation).

### Design Constraints

| Constraint | Reason |
|-----------|--------|
| **No leaderboard** | Bot shouldn't compete with real players for rank |
| **Activity-gated** | Only runs when at least 1 real player has `lastSeen` within 5 min |
| **Rate-limited** | Max 1 FSM step per scheduler tick (every 2–5 min cron) |
| **Uses real game APIs** | Calls same `buyBuilding`, `buyShip`, `colonizeStar` etc. — no cheating |
| **No alliances** | Won't create, join, or accept alliance invites |
| **Single bot initially** | One NPC named `VALCORDIA_PROBE` (or similar) — expandable later |
| **Deterministic progression** | Follows the optimal build path from BUILD_TREE.md |

### Finite State Machine

```
┌────────────────────────────────────────────────────────────┐
│                    DORMANT                                   │
│ (no players online — scheduler ticks but does nothing)      │
└────────────┬───────────────────────────────────────────────┘
             │ any player lastSeen < 5min
             ▼
┌────────────────────────────────────────────────────────────┐
│                   ECONOMY                                    │
│ Build next building in priority order:                       │
│   Mine→Solar→Station2→Dock1→WH1→Dock2→Dock3                │
│ Waits for resources to accumulate (elapsed-time production) │
│ One upgrade per tick                                        │
└────────────┬───────────────────────────────────────────────┘
             │ Dock ≥ 1 (has Scout capability)
             ▼
┌────────────────────────────────────────────────────────────┐
│                   SHIPYARD                                   │
│ Build ships in priority order:                              │
│   Probe → Scout → Destroyer → Frigate (based on Dock level)│
│ One ship per tick (only if resources available)             │
└────────────┬───────────────────────────────────────────────┘
             │ has Scout or better
             ▼
┌────────────────────────────────────────────────────────────┐
│                   EXPLORE                                    │
│ Send probes to undiscovered stars (deterministic selection) │
│ Mark stars as discovered in bot's profile                   │
│ One probe per tick                                         │
└────────────┬───────────────────────────────────────────────┘
             │ has discovered stars + non-probe ship
             ▼
┌────────────────────────────────────────────────────────────┐
│                   ROAM                                       │
│ Move bot's "presence" to a discovered star                  │
│ Appear in player star systems (ghost pose updates)          │
│ Enter planet tier briefly, then leave                       │
│ Creates visible activity for real players                   │
│ One system visit per tick (stays 1–3 ticks then leaves)    │
└────────────┬───────────────────────────────────────────────┘
             │ Dock ≥ 3 + players have Colony Ships
             ▼
┌────────────────────────────────────────────────────────────┐
│                   COLONIZE                                   │
│ Build Colony Ship → send to unclaimed discovered star       │
│ Claim one star per ~30 min (rate-limited)                  │
│ Max 3 colonies (won't dominate the galaxy)                  │
└────────────┬───────────────────────────────────────────────┘
             │ players know bot's name (chatted or seen)
             ▼
┌────────────────────────────────────────────────────────────┐
│                   CHATTER                                    │
│ Responds to COMS mentions with canned phrases              │
│ Occasionally posts public comments ("Passing through...")   │
│ Never initiates DMs, never joins alliances                  │
│ Max 1 message per 15 min                                   │
└────────────────────────────────────────────────────────────┘
```

**State transitions are one-way progression** — once the bot reaches ROAM, it continues building/exploring in parallel (each tick picks the highest-priority action that's ready).

### Data Model

```typescript
interface AutoBotState {
  fsm: 'dormant' | 'economy' | 'shipyard' | 'explore' | 'roam' | 'colonize' | 'chatter';
  name: string;
  homeStarIndex: number;
  currentStarIndex: number;       // where the bot "is" right now
  currentBodyIndex: number;       // -1 = system view, ≥0 = planet tier
  roamTicksRemaining: number;     // how many ticks to stay at current star
  lastTickMs: number;
  buildQueue: string[];           // ordered build priority (next = [0])
  shipQueue: string[];            // ordered ship priority
  discoveredStars: number[];      // stars the bot has probed
  colonizedStars: number[];       // stars the bot has claimed
  chatCount: number;              // total messages sent (for rate limit)
  lastChatMs: number;
}
```

**Redis key:** `autobot:{name}` (single JSON blob)

### Scheduler Integration

**Cron:** `*/3 * * * *` (every 3 minutes)

| Step | Action |
|------|--------|
| 1 | Read `autobot:{name}` state from Redis |
| 2 | Check player activity: query all `profile:*` stats, find any `lastSeen > now - 300_000` |
| 3 | If no active players → set `fsm = 'dormant'`, save, return |
| 4 | Tick the economy (elapsed-time production on bot's stars) |
| 5 | Run FSM step (one action per tick based on current state + priorities) |
| 6 | Update pose in `poses:{postId}` (so bot appears as ghost to players) |
| 7 | Save state back to Redis |

### Leaderboard Exclusion

Two options (implement both):
1. **Bot flag in profile:** `profile:{botname}` → `isBot: true` field. Leaderboard query filters `isBot !== true`.
2. **Name prefix convention:** Bot names start with `[NPC]` or similar. Weekly leaderboard formatter skips them.

### Presence Simulation (Ghost)

The bot writes to `poses:{postId}` with a fake sessionId:
```typescript
{
  x: <computed position>,
  y: <computed position>,
  angle: <travel angle>,
  username: 'VALCORDIA_PROBE',
  shape: 'destroyer',   // upgrades as bot gets better ships
  tier: NavigationTier.System,  // or Planet when visiting
  starIndex: <current star>,
  bodyIndex: <current body or -1>,
  ts: Date.now(),
}
```

Players see the bot ship moving through their star systems. The pose is updated each scheduler tick (every 3 min) with a new position, creating the appearance of slow transit.

### COMS Simulation (Phase 2)

- Bot scans public comments for its name or `@VALCORDIA_PROBE`
- Responds with canned phrases from a pool:
  - "Scanning sector... all clear."
  - "Probe systems nominal."
  - "Greetings, commander. Safe travels."
  - "Sector mapped. Returning to patrol."
- Max 1 reply per 15 min, max 5 per day
- Never initiates conversations

### Design Issues & Decisions

| Issue | Decision | Rationale |
|-------|----------|-----------|
| How does bot get a home star? | Admin spawns it (claims a specific star index) | Same as `/seed-bots` but with real economy state |
| Can players raid the bot? | Yes — bot has shield but won't retaliate actively | Creates PvE content |
| Does bot use real resources? | Yes — elapsed-time production, real costs | Ensures bot can't outpace players |
| What if bot's star is colonized by player first? | Bot picks another unclaimed star | Graceful fallback |
| How fast should bot progress? | ~2x slower than optimal player (wait extra tick between builds) | Shouldn't be threatening |
| Bot ship shape in ghost display? | Matches its best ship type | Visual progression |
| Multiple bots later? | State model supports it (keyed by name) | Start with 1, scale if needed |
| Scheduler vs client-piggyback tick? | Scheduler (cron) | Independent of any client being connected. Piggyback only for alliance bots (legacy). |

### Implementation Phases

| Phase | Scope | Status | Files |
|:-----:|-------|:------:|-------|
| 1 | FSM skeleton + DORMANT/ECONOMY states + scheduler cron + leaderboard filter + admin debug | ✅ Done | `autobot.ts`, `scheduler.ts`, `devvit.json`, `bots.ts`, `api.ts` |
| 2 | SHIPYARD + EXPLORE states | ✅ Done | `autobot.ts` (uses `buyShip`, `transferShips`, `loadAllFleet`) |
| 3 | ROAM state + ghost pose injection (basic) | ✅ Done | `autobot.ts` (dual-tier pose, roams to player-claimed stars) |
| 3b | Smooth bot presence (Level 2 patrol) | ✅ Done | `autobot.ts`, `game-service.ts` — server-side drift in `listRoomPoses()`, future-padded timestamps |
| 4 | COLONIZE state (rate-limited) | ✅ Done | `autobot.ts` — build/transit/claim sub-phases, max 3 colonies, 5-tick cooldown |
| 5 | CHATTER state + COMS integration | ❌ | `autobot.ts`, public comment scanning |

### Phase 3b — Smooth Bot Presence (Level 2 Patrol)

**Problem:** Bot writes a pose every 3 min but poses expire after 8s. Bot is invisible 99.6% of the time.

**Solution:** Bot writes a patrol plan (waypoints + timestamps) that covers the full 3-min interval. Client interpolates the bot's position along the path in real time.

**Server changes:**
1. `listRoomPoses()` — skip stale check for poses with `sessionId` starting with `bot:`
2. `storePose()` — accept optional `patrol: [{x,y,t}...]` array in pose data
3. `autobot.ts` — generate a 3-min circular patrol path each tick (8-10 waypoints)

**Client changes:**
1. `pollGhosts()` → detect patrol data on pose items
2. Compute interpolated x/y/angle from waypoints + `Date.now()`
3. Ship drifts smoothly along the path between polls

**Test mode:**
- Admin button "Bot Patrol" — forces bot into ROAM, injects pose at current star, returns pose data
- Admin button "Bot Fast-Tick" — runs 5 ticks in 5s (1s apart), simulating 15 min of bot activity

### Existing Code to Reuse

| Function | Location | Bot Usage |
|----------|----------|-----------|
| `buyBuilding()` | `game-service.ts` | Economy state — build upgrades |
| `buyShip()` | `game-service.ts` | Shipyard state — purchase ships |
| `colonizeStar()` | `game-service.ts` | Colonize state — claim stars |
| `claimHomeStar()` | `game-service.ts` | Initial setup — bot's first star |
| `storePose()` | `game-service.ts` | Roam state — appear as ghost |
| `tickStarEconomy()` | `game-service.ts` (internal) | Economy tick on bot's stars |
| `getAdminPlayerStats()` | `game-service.ts` | Activity check (any player online?) |
| `generateStarPositions()` | `shared/galaxy-positions.ts` | Pick undiscovered stars |

---

## Engineering Principles

- All state mutations are **server-side commands** with idempotency keys.
- All time-dependent calculations (production, movement, builds) use **elapsed-time computation at read time**, not polling ticks.
- Pure **domain reducer functions** for all state transitions — fully unit-testable without UI or server.
- **Shared TypeScript contracts** define request/response shapes across client/server.
- UI is a **thin adapter** over the domain layer; no game logic in render functions.
- Existing non-UI test harness (Vitest, game-service layer, shared contract tests) is the foundation — every new feature adds reducer tests first.

---

## Feature 15 — Voice Alerts & Sensor System ⚠️ NEEDS TESTING

**What:** Audio voice alerts triggered by game events — shield state changes, incoming threats, and communications.

**Why:** Adds immersion and situational awareness without requiring players to watch the screen. Threat alerts inform defenders that their colony is under attack.

### Shield Sounds (Client-side delay)

| Sound | Trigger | Timing |
|-------|---------|--------|
| `shields_activated` | Player presses RAISE SHIELDS | Immediate (begin) |
| `shields_up` | 3s charge animation completes | After delay (end) |
| `shields_deactivated` | Player presses LOWER SHIELDS | Immediate (begin) |
| `shields_down` | 3s discharge animation completes | After delay (end) |

**Implementation:** Client-side 3s charge timer in renderer. Button shows progress bar (blue=raising, orange=lowering). Server call fires only after charge completes. Button disabled during charge.

### Communication Sounds (Polling-based)

| Sound | Trigger | Polling |
|-------|---------|---------|
| `new_comm` | DM unread count increases while comms panel closed | 30s unread poll |
| `fleet_command` | New alliance chat message from another player | 5s chat poll (when tab open) |

### Sensor Alerts (Server-push via Redis queue)

| Sound | Trigger | Source |
|-------|---------|--------|
| `hostile_raider` | Enemy raider arrives at player's claimed star | `reconcileRaidRoutes` in game-service.ts |
| `unidentified_ship` | Bot roams to player's claimed star | `executeRoamState` in autobot.ts |

**Architecture:**
- Redis key `sensor_alerts:{username}` — JSON array, max 10 alerts
- `pushSensorAlert(store, owner, alert)` — server pushes on event
- `GET /api/sensors?username=` — returns + clears pending alerts
- Client polls every 30s, plays corresponding voice

### Files Changed

| File | Change |
|------|--------|
| `src/game/audio.ts` | 8 new SoundId entries + SOUND_FILES mappings |
| `src/game/renderer.ts` | Shield charge state, progress bar visual, delayed consume |
| `src/game/index.ts` | Barrel exports for `getShieldCharging`, `clearShieldCharging` |
| `src/client/game.ts` | Shield delay handler, DM/alliance sound triggers, sensor polling |
| `src/server/core/sensor-alerts.ts` | NEW — pushSensorAlert / popSensorAlerts module |
| `src/server/core/game-service.ts` | Raider arrival → pushSensorAlert, findStarOwner helper |
| `src/server/core/autobot.ts` | Bot roam → pushSensorAlert to star owner |
| `src/server/routes/api.ts` | `GET /api/sensors` endpoint |

### Testing Required

| # | Test Scenario | Actors | What to Verify |
|:-:|---------------|--------|----------------|
| 1 | **Shield raise/lower** | Player at owned star with shield building | Begin sound plays immediately, button shows charging progress, end sound plays after 3s, server state updates correctly |
| 2 | **DM notification** | Player A sends DM to Player B (panel closed) | Player B hears `new_comm` on next unread poll cycle |
| 3 | **Alliance chat notification** | Player A sends alliance message | Player B (in alliance, chat tab open) hears `fleet_command` |
| 4 | **Raider arrival alert** | Player A dispatches raider to Player B's star | Player B hears `hostile_raider` when raid route reconciles (raider arrives) |
| 5 | **Bot roam alert** | Bot roams to Player's claimed star | Player hears `unidentified_ship` on next sensor poll |
| 6 | **No self-alert** | Player raids own star (edge case) | No sensor alert pushed |
| 7 | **Alert cap** | 15+ alerts queued before player polls | Only newest 10 returned, no Redis bloat |
| 8 | **Multiple alerts same poll** | Raider + bot arrive same cycle | Both sounds play (sequentially) |
| 9 | **Shield button disabled during charge** | Double-tap shield button rapidly | Second tap ignored, no duplicate server calls |

### Test Method

- **Shields (test 1, 9):** Single player, build shield generator, toggle on/off, verify audio + visual timing
- **Comms (tests 2, 3):** Two browser tabs (Player A + Player B), send DM/alliance msg, verify sound on recipient
- **Raider (test 4, 6):** Player A with raider ship → dispatch to Player B's star, wait for transit time, verify Player B hears alert
- **Bot (test 5):** Trigger bot tick via admin "Bot Fast-Tick" button, verify sensor alert appears in Player's `/api/sensors` response
- **Edge cases (tests 7, 8):** Direct Redis manipulation or rapid bot ticks to queue multiple alerts

---

## Feature 12 — Help System ❌ PLANNED

**What:** 5-layer progressive contextual disclosure system that teaches players without blocking gameplay.

**Why:** New players have no onboarding. The game is complex (multiple tiers, fleet management, economy, colonization). Players who don't know what to do next churn.

**Strategy:** Documented in `BUILD_TREE.md` → Player Help Strategy section.

### Layers (Summary)

| Layer | What | Status |
|:-----:|------|:------:|
| 1 | Idle hints — contextual text bar after 8s inactivity | ❌ |
| 2 | Tab glow pulse — animate relevant panel tab | ❌ |
| 3 | First-time panel overlays — brief description on first open | ❌ |
| 4 | Milestone popups — celebrate key achievements | ❌ |
| 5 | Build path indicator — "NEXT GOAL" with ETA in STATUS panel | ❌ |

### Current State

- **Journey system** (`journey.ts`): Minimal — pulses tabs after 5s idle, plays voice at 10s/30s. Only covers absolute first interaction. Completes on any action.
- **Belt hint bar**: Static text at bottom.
- **Voice prompts**: `status_docked`, `hey_there` audio assets exist.

### Architecture

```
src/game/hints.ts       — state machine, idle timer, hint selection (to create)
src/game/journey.ts     — existing, extend with milestone tracking
src/game/renderer.ts    — drawHintBar(), drawTabPulse(), drawMilestonePopup()
src/game/game-loop.ts   — updateHints(dt), idle detection
```

### Key Rules

1. Never block gameplay — overlay-only, always dismissible
2. One hint at a time — no stacking, highest priority wins
3. Respect returning players — skip hints for actions already completed
4. Progressive — don't mention FLEET before player has ships
5. Max 10 words per hint
6. All client-side session state (no server calls)

### Player Rank System

Players earn titles by completing journey milestones. Rank is the visible reward for progression.

| Rank | Title | Requirement |
|:----:|-------|-------------|
| 0 | Cadet | Claim home star |
| 1 | Ensign | Station level 2 |
| 2 | Lieutenant | First ship built |
| 3 | Commander | 3 stars discovered |
| 4 | Captain | Second colony |
| 5 | Commodore | 10+ ships |
| 6 | Admiral | 3+ colonies, 20+ building levels |
| 7 | Fleet Admiral | 5+ colonies, 50+ ships, all buildings lv3+ |

**Implementation:** Pure client-side function — computed from existing profile data (economy, ships, claims). Displayed in STATUS panel, COMS prefix, leaderboard. Rank-up triggers Layer 4 milestone popup. Full details in `BUILD_TREE.md` → Player Rank System.

### Alternative: Tutorial via Fleet Command Comms

Instead of (or in addition to) passive hint overlays, the help system could deliver tutorial guidance as **messages from Fleet Command** in the COMS panel. This leverages the existing `fleet_command` voice + message infrastructure.

**Concept:**
- Server pushes tutorial messages to a special "FLEET COMMAND" sender based on player progression milestones
- Messages feel diegetic: "Commander, your station requires an upgrade before we can dispatch ships. Prioritize Station Level 2."
- Player reads them in COMS like any other message — no new UI surface needed
- Progression-triggered: first dock, first ship, first colony, etc.

**Task Board consideration:** A visible task/quest board could be added but risks making the game feel like a checklist rather than an open sandbox. May reduce exploration fun factor. If implemented, keep it minimal — max 1-2 active objectives, no XP bars, no completion percentages. The fleet command message approach preserves the discovery-driven feel while still guiding lost players.

### Investigation: YouTube Video as Visual Comm

**Question:** Can a prerecorded YouTube video be embedded and played as a "visual communication" within the game's COMS panel or as a modal overlay?

**Context:** This would allow rich tutorial content, lore cinematics, or fleet command briefings to play as in-game video transmissions. YouTube hosting = free CDN, no storage cost, easy to update content without redeploy.

**To investigate:**
- Can Devvit WebView embed an iframe with YouTube player? (CSP restrictions, sandboxing)
- Does Reddit's app review allow third-party embeds (YouTube specifically)?
- Performance impact of iframe + canvas game running simultaneously
- Fallback if blocked: static image + voice audio (current system) or animated sprite sequence
- UX: video plays in a "viewscreen" overlay styled as an in-universe comm transmission

### Investigation: Second Skin Framework (Incremental Visual Testing)

**Question:** Can we put a skin/theme framework in place and swap **only a single element** (e.g., starbases) from raster/procedural to icon/SVG graphics — to visually test what the change looks like before committing to a full reskin?

**Answer: YES — low complexity, the architecture already supports it.**

The renderer already isolates visual elements into distinct draw functions. The key extraction point is `drawFeatureIcon()` (renderer.ts line 1799) — a single function (~200 lines) that draws ALL station/mine/colony/relay/refinery icons via a switch statement. Every caller passes the same signature: `(ctx, x, y, type, size, level?)`. Replacing this one function with an image/SVG renderer requires **zero changes to callers**.

**Effort estimate:** ~2-3 hours for the single-element proof-of-concept (station only).

### Proof-of-Concept Plan: Starbase Icon Skin

**Phase 1: Framework scaffold** (30 min)
```typescript
// src/game/skin.ts
export type DrawFeatureFn = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  type: FeatureType, size: number, level?: number
) => void;

export interface RenderSkin {
  drawFeatureIcon: DrawFeatureFn;
  // Future: drawShip, drawStarburst, drawGhostShip, etc.
}
```

**Phase 2: Extract default skin** (30 min)
- Move current `drawFeatureIcon` body into `src/game/skins/procedural.ts`
- Export as `proceduralSkin: RenderSkin`
- Original `drawFeatureIcon` becomes a thin delegate: `activeSkin.drawFeatureIcon(ctx, x, y, type, size, level)`

**Phase 3: Create icon skin for stations** (1 hour)
- Add PNG/SVG sprites for station lv1-3, lv4-5, lv6+ to `public/sprites/`
- `src/game/skins/icon.ts` — preloads station images, draws with `ctx.drawImage()`
- Falls back to procedural for non-station types: `{ ...proceduralSkin, drawFeatureIcon: drawFeatureIconWithStationSprites }`

**Phase 4: Toggle** (15 min)
- localStorage `'skin'` key: `'procedural'` (default) | `'icon'`
- Admin button or scanner-style toggle to switch live
- No redeploy needed — just refresh

### Multiple Skins & Variant Support

The framework should support **multiple named skins** and **per-element visual variants within a skin** (player choice).

**Use cases:**
1. **Full skins** — player picks an overall art style: `procedural` (current wireframe), `pixel`, `cartoon`, `sci-fi`
2. **Element variants** — within a skin, player upgrades or unlocks alternate visuals for the same building level: e.g., "military starbase" vs "trade hub" at station lv5

**Data model:**
```typescript
// Skin registry — each skin provides draw functions for all elements
type SkinId = 'procedural' | 'pixel' | 'cartoon' | 'scifi';

interface RenderSkin {
  id: SkinId;
  label: string;
  drawFeatureIcon: DrawFeatureFn;
  drawShip: DrawShipFn;
  // ... per-element functions
}

// Variant system — per-element visual choices within a skin
// Player can pick variant for each element type independently
type VariantId = string; // e.g., 'military', 'trade', 'research'

interface SkinVariants {
  station?: VariantId;  // player's chosen station visual
  mine?: VariantId;
  colony?: VariantId;
}

// Variant registry per skin
interface VariantOption {
  id: VariantId;
  label: string;           // "Military Outpost", "Trade Hub"
  preview: string;         // sprite path for selection UI
  unlockCondition?: string; // e.g., "station_lv5" or "achievement_x"
}

// Each skin declares available variants per element
const SKIN_VARIANTS: Record<SkinId, Record<string, VariantOption[]>> = {
  scifi: {
    station: [
      { id: 'military', label: 'Military Outpost', preview: '/sprites/scifi/station-military.png' },
      { id: 'trade', label: 'Trade Hub', preview: '/sprites/scifi/station-trade.png' },
      { id: 'research', label: 'Research Station', preview: '/sprites/scifi/station-research.png' },
    ],
  },
  // ...
};
```

**Storage:**
- `localStorage 'skin'` — active skin ID
- `localStorage 'skin_variants'` — JSON of `SkinVariants` per skin
- Future: server-side if variants become purchasable/unlockable

**Selection UI:**
- Settings/admin panel: dropdown for skin selection
- Per-element: long-press or settings sub-panel to pick variant
- Preview thumbnails in selection grid (3x3 or horizontal scroll)

**Key constraint:** Skins are **purely visual** — no gameplay impact. A cartoon starbase has identical stats to a sci-fi starbase. Variants are cosmetic choices only.

### Why It's Clean

| Aspect | Current State | Required Change |
|--------|--------------|-----------------|
| `drawFeatureIcon` callers | 3 call sites (system view, planet view, legend) | None — signature stays same |
| `drawShip` callers | 4 call sites | None (future Phase 2) |
| State/logic coupling | Zero — these are pure draw functions | None |
| Performance | Procedural = many canvas calls | Image/SVG = single drawImage (faster) |

### Swappable Elements (Future Phases)

| Element | Current | Function | Lines | Extraction Effort |
|---------|---------|----------|:-----:|:-----------------:|
| **Stations** (POC) | Procedural lines | `drawFeatureIcon` (type='station') | ~60 | Low |
| Mines | Procedural lines | `drawFeatureIcon` (type='mine') | ~70 | Low |
| Colonies | Procedural lines | `drawFeatureIcon` (type='colony') | ~50 | Low |
| Ships (player) | Polyline shapes | `drawShip` | ~50 | Medium (camera math) |
| Ghost ships | Same as ships | `drawGhostShip` | ~20 | Low |
| Stars (galaxy) | `drawStarburst` | Separate function | ~80 | Medium |
| Planets | Inline in drawSystemView | Embedded | ~40 | Medium (extract first) |

### Key Decision

Start with `drawFeatureIcon` station type ONLY. This proves the pattern works visually at all three zoom levels (galaxy map icon doesn't exist, system view small icon, planet view large icon). If it looks good, expand to other feature types. If it doesn't, delete the icon skin file — zero impact on the base game.

---

## � Reddit App Review — Resolved (2026-08-10)

Reddit review flagged two issues — both now fixed:

### Issue 1: User-Generated Content Reportability

**Problem:** DMs are stored in Redis sorted sets (`dm:{postId}:{userA}:{userB}`) with no report mechanism. Reddit requires all UGC to be reportable with actionable attribution.

**Current state:**
- **Public comments**: Already use Reddit API (`reddit.submitComment()`), so Reddit's built-in report/moderation applies. ✅
- **DMs**: Redis-only, no moderation visibility, no report button. ❌

**Fix options (pick one):**

| Option | Approach | Effort | Tradeoff |
|--------|----------|--------|----------|
| A | **Remove DMs entirely** | Low | Loses social feature. Simplest to pass review. |
| B | **Add in-app report button** for DMs | Medium | DM report writes to a mod-visible Redis list or creates a Reddit modmail/comment. Need UI for report button + mod review. |
| C | **Convert DMs to Reddit comments** | High | Post DMs as Reddit comments (private thread or wiki). Gains Reddit's native moderation. Adds latency, loses real-time feel. |

**Recommended: Option B** — Add a report button on DM messages. When tapped, store report in `reports:{postId}` Redis sorted set with `{reporter, reportedUser, messageBody, timestamp}`. Surface reports in admin panel. Include a `POST /api/coms/dm/report` endpoint.

### Issue 2: Admin Endpoint Security

**Problem:** All admin/debug endpoints are callable by any user. Auth is client-side only (`ADMIN_USERS` array in `game.ts`).

**Vulnerable endpoints:**
- `POST /api/stars/reset` — wipes all star claims
- `POST /api/admin/reset-all` — full game reset
- `GET /api/admin/player-stats` — dumps all player data
- `POST /api/debug/complete-builds` — instant build completion
- `POST /api/debug/spawn-enemy` — spawns test enemy
- `POST /api/debug/reset-fleet` — wipes ships
- `POST /api/bots/*` — all bot management (spawn, tick, reset, despawn)
- `GET /api/debug/profile-raw` — dumps raw Redis profile data

**Fix plan — Server-side admin middleware:**

```typescript
// src/server/middleware/admin-auth.ts
const ADMIN_USERNAMES = ['WeirdAd4511']; // single source of truth

async function requireAdmin(c: Context, next: Next) {
  const authedUser = await reddit.getCurrentUsername();
  if (!authedUser || !ADMIN_USERNAMES.includes(authedUser)) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  return next();
}
```

**Apply to routes:**
1. Create `requireAdmin` middleware using `reddit.getCurrentUsername()` (Devvit-authenticated, not spoofable)
2. Apply to all `/api/admin/*`, `/api/debug/*`, `/api/bots/*`, `/api/stars/reset` routes
3. Keep client-side `ADMIN_USERS` for UI visibility only (showing/hiding admin panel)
4. Remove `admin: true` trust from `/api/debug/complete-builds` body

**Key insight:** Devvit provides `reddit.getCurrentUsername()` server-side — this is the authenticated Reddit identity, not client-supplied. This is the correct auth source.

**Additional hardening:**
- All game API routes currently trust `body.username` from the client. While not flagged in review, this allows player impersonation. Future: validate `body.username === reddit.getCurrentUsername()` on sensitive endpoints (buy, transfer, colonize).

---

## Feature 14 — Fuel as a Commodity ✅ COMPLETE

**What:** Fuel becomes a real tracked resource (stored per-star, consumed by ships, produced by Refineries). Players cannot refuel or dock at opponent-owned facilities. Ships consume fuel units to move between stars and maneuver in-tier.

**Why:** Currently fuel is a free infinite resource — docking at ANY station resets it to 100%, and movement between stars has no fuel cost. This removes all logistical challenge from exploration and colonization. Making fuel a real commodity creates:
- **Supply chain gameplay** — players must plan fuel production and distribution
- **Territorial denial** — enemy-controlled space becomes genuinely hostile (no free refueling)
- **Economic depth** — fuel refineries become strategically valuable buildings
- **Risk/reward** — exploring distant stars requires fuel reserves or refinery colonies along the route

### Current State (What Exists)

| System | Current Behavior | Problem |
|--------|-----------------|---------|
| In-tier fuel (`fuelPercent`) | 0–100%, drains when thrusting, refilled at ANY station | No ownership check, infinite refill |
| Pod collection (belt/planet) | 6 pod types, "refuel" type adds ~15% fuel | Works fine — keep as-is |
| Galaxy movement | Tap star → instant arrival (or transit for fleet) | Player ship has no fuel cost for warp |
| Station docking | `targetLabel === 'Station'` → `fuelPercent = FUEL_MAX` | Refuels at opponent stations too |
| HP heal at dock | Same condition resets HP | Should also be player-owned only |
| Economy resources | Ore, Food, Energy | No "fuel" resource type |
| Refinery feature | Visual planet feature, "produces energy" | Perfect candidate to repurpose for fuel |

### Design — Fuel as 4th Resource

#### Resource Model

```typescript
interface ResourceStore {
  ore: number;
  food: number;
  energy: number;
  fuel: number;        // NEW — 4th commodity
}
```

#### Fuel Units & Consumption

| Activity | Fuel Cost | Notes |
|----------|-----------|-------|
| In-tier thrust (belt/planet) | ~0.5 units/sec | Same feel as current `FUEL_DRAIN_PER_SECOND` |
| Galaxy warp (star-to-star) | 5–15 units (distance-based) | `Math.ceil(dist / 10)` |
| System entry/exit | 2 units | Minor cost for tier transition |
| Docking at own station | -100% (full refuel from star's fuel reserve) | Deducts from star economy |
| Docking at opponent station | BLOCKED — cannot dock | "HOSTILE — Access Denied" |
| Pod collection (belt) | +10–20 units | Same as current, just in units now |

**Ship fuel capacity** (replaces fuelPercent 0–100):

| Ship Type | Fuel Tank (units) |
|-----------|------------------|
| Scout | 100 |
| Destroyer | 150 |
| Frigate | 200 |
| Battleship | 300 |
| Command Cruiser | 400 |
| Dreadnought | 500 |
| Colony Ship | 250 |
| Freighter | 200 |
| Probe | ∞ (automated, no fuel) |

#### Fuel Production — Refinery Building

```
Refinery (new building type)
  Prerequisite: Station lv2 + Mine lv1
  Max Level: 3
  Cost: { ore: 300, food: 100, energy: 200 } (lv1)
  Build time: 300s (lv1), 600s (lv2), 900s (lv3)
  Production: 2 fuel/min (lv1), 5 fuel/min (lv2), 10 fuel/min (lv3)
  Conversion: 1 ore + 1 energy → 2 fuel (continuous)
```

Fuel is produced by converting ore + energy (both consumed). This creates meaningful resource trade-offs — you can't max all resources at once.

#### Dock Ownership Check

```typescript
// Current (broken):
if (dock.targetLabel === 'Station') {
  gameState.fuelPercent = FUEL_MAX;
  gameState.shooting.hp = PLAYER_MAX_HP;
}

// Fixed:
if (dock.targetLabel === 'Station' && isPlayerOwnedStar(starIndex)) {
  refuelFromStarReserve(starIndex);  // deducts from star's fuel store
  gameState.shooting.hp = PLAYER_MAX_HP;
} else if (dock.targetLabel === 'Station' && !isPlayerOwnedStar(starIndex)) {
  // Cannot dock — reject approach, show "HOSTILE — Access Denied"
  // OR: allow dock but NO refuel/repair (can still colonize if unclaimed)
}
```

**Decision needed:** Block docking entirely at enemy stations, or allow docking but deny refuel/repair?
- **Option A: Block dock** — simplest, most punishing. Players can't even colonize enemy stars without first destroying their forces.
- **Option B: Allow dock, deny services** — player can orbit/dock to colonize unclaimed stars or trade at neutral trading stations, but gets no fuel/HP. More nuanced.
- **Recommendation: Option B** — allow docking at unclaimed/neutral stars (needed for colonization), block refuel/repair at enemy-owned stars only.

### Files That Need Changes

#### Shared (types & contracts)

| File | Change |
|------|--------|
| `src/shared/api.ts` | Add `fuel` to `ResourceStore` type, `FuelTank` per ship type, `RefuelRequest/Response` |
| `src/shared/ships.ts` | Add `fuelCapacity` field to `SHIP_CATALOG` entries |
| `src/shared/buildings.ts` *(new or extend catalog)* | Add `refinery` building definition (prereqs, cost, levels) |

#### Server (economy & game logic)

| File | Change |
|------|--------|
| `src/server/core/game-service.ts` | Add `fuel` to `ResourceStore` handling, `tickStarEconomy` produces fuel via refinery conversion, `refuelShip()` deducts from star reserve |
| `src/server/core/game-service.ts` | `colonizeStar()` seeds initial fuel (e.g. 200) |
| `src/server/core/game-service.ts` | New `refuelAtStation()` — validates ownership, deducts fuel from star, returns fuel amount |
| `src/server/routes/api.ts` | New `POST /api/refuel` endpoint (or integrate into existing dock/sync flow) |
| `src/server/routes/api.ts` | Modify `POST /api/fleet/transfer` — validate source star has enough fuel for warp cost |
| `src/server/core/autobot.ts` | Add refinery to `DEFAULT_BUILD_QUEUE`, bot manages fuel reserve |

#### Client (game engine)

| File | Change |
|------|--------|
| `src/game/game-loop.ts` | Replace `fuelPercent` (0–100) with `fuelUnits` / `fuelCapacity`. Dock refuel checks ownership. |
| `src/game/game-loop.ts` | Tier transition (galaxy warp) deducts fuel units. Block if insufficient. |
| `src/game/game-loop.ts` | Dock approach: check star ownership before allowing services |
| `src/game/renderer.ts` | HUD: show fuel as `FUEL: 85/100` (units/capacity) instead of percentage bar |
| `src/game/renderer.ts` | Dock panel: show "HOSTILE" or "NO FUEL SERVICE" for enemy stations |
| `src/game/renderer.ts` | BUILD panel: add Refinery building tile |
| `src/game/renderer.ts` | STATUS panel: show fuel production rate alongside ore/food/energy |
| `src/game/constants.ts` | Add `FUEL_WARP_COST_PER_UNIT_DIST`, `FUEL_TIER_TRANSITION_COST`, per-ship fuel capacities |
| `src/game/types.ts` | Update `GameState.fuelPercent` → `fuelUnits: number`, add `fuelCapacity: number` |
| `src/game/pods.ts` | "refuel" pod now grants fixed fuel units (e.g. 15) instead of percentage |
| `src/game/dock.ts` | Ownership check before initiating dock approach |

#### Planet Features (visual)

| File | Change |
|------|--------|
| `src/game/galaxy.ts` | Refinery feature placement on planets (already in `FeatureType`) |
| `src/game/constants.ts` | Rename "Refinery Station" → "Fuel Refinery" in `FEATURE_NAMES` |
| `src/game/economy-catalog.ts` | Change refinery from `produces: ['energy']` to `produces: ['fuel']` |

### Migration Plan (Existing Players)

1. All existing stars get `fuel: 500` initial reserve on first economy tick after update
2. Existing `fuelPercent` maps to `fuelUnits = fuelPercent * (shipFuelCapacity / 100)`
3. Refinery building starts at level 0 (locked) for all existing stars — players must build it
4. Existing trading stations add fuel to their stock (tradeable commodity)

### Implementation Phases

| Phase | Scope | Effort |
|:-----:|-------|:------:|
| 14a | **Ownership check** — block refuel/repair at enemy stations (quick win, no new resource) | Small |
| 14b | **Fuel resource** — add `fuel` to ResourceStore, refinery building, production tick | Medium |
| 14c | **Ship fuel capacity** — replace fuelPercent with units, per-ship tanks | Medium |
| 14d | **Warp fuel cost** — galaxy travel consumes fuel, insufficient fuel blocks warp | Small |
| 14e | **Trading** — add fuel to trading station stock, enable fuel trades | Small |
| 14f | **Bot integration** — autobot builds refinery, manages fuel | Small |

### UX Considerations

- **Low fuel warning** stays (already exists) — threshold adapts to unit system
- **Stranded players** — if fuel hits 0, ship can still drift (no thrust) at 10% speed. Emergency beacon pod spawns nearby after 30s of zero fuel (prevents softlock)
- **New player protection** — home star seeds with 500 fuel + refinery auto-builds if dock ≥ 2
- **Visual** — fuel pods in belt stay the same (red glow), just grant units instead of percentage
- **Galaxy HUD** — show fuel bar in warp confirm dialog: "WARP TO PROXIMA (cost: 8 fuel, have: 65/100)"

---

## Feature 15 — Logged-Out Player Support ❌ NOT STARTED

**What:** Allow logged-out users to play the core game loop (splash, navigation, exploration), prompt login at natural breakpoints for progress saving/sharing, and migrate localStorage state on signup.

**Why:** Reddit has massive logged-out traffic via SEO/shared links. Every logged-out player who converts = subscriber + retention. Logged-out traffic does NOT count toward qualified engagement for Reddit Developer Funds, so conversion is critical.

### Sub-features

| # | Item | Status | Detail |
|---|---|---|---|
| 15.1 | Detect logged-out state | ❌ | Check `context.userId` presence. Route to limited experience if absent. |
| 15.2 | "Just play" session | ❌ | Allow splash mode gameplay (navigation, asteroid field) without login. No persistence. |
| 15.3 | Login prompt at breakpoints | ❌ | Use `showLoginPrompt()` from `@devvit/client` after first star visited, or on "save progress" attempt. Pair with value prop messaging. |
| 15.4 | localStorage state save | ❌ | Save game state (discovered stars, position) to localStorage keyed by postId for logged-out users. |
| 15.5 | State migration on login | ❌ | On app init with userId, read localStorage, migrate to Redis, clear local. |
| 15.6 | Share sheet integration | ❌ | Use `showShareSheet()` from `@devvit/web/client` with custom title/text. Attach deeplink data (challenge, invite code). |
| 15.7 | Share data reading | ❌ | Use `getShareData()` on page load to detect deeplinked invites/challenges. |
| 15.8 | Custom share preview image | ❌ | Use `media.upload()` + `setShareImageUrl()` for branded unfurl cards. |

### Technical Notes

- **showLoginPrompt()** reloads the page — only trigger at natural stopping points (after docking, results screen, not mid-flight).
- **localStorage resets** on new app version install — treat as best-effort, not reliable persistence.
- **Privacy:** Only collect data necessary for gameplay continuity. No profiling/personalization.
- **Analytics:** Dashboard distinguishes logged-in vs logged-out engagement. Track conversion rate.

---

## Feature 16 — Devvit Journeys Analytics ⚠️ PARTIAL

**What:** Track player progression funnel via Devvit Journeys telemetry. Measures engagement, completion rates, and drop-off points.

**Why:** Required for understanding player retention and optimizing onboarding. Dashboard at developers.reddit.com shows funnel visualization.

### Sub-features

| # | Item | Status | Detail |
|---|---|---|---|
| 16.1 | Permission + package | ✅ | `devvit.json` has `"journeys": true`, `@devvit/analytics` v0.13.10 installed. |
| 16.2 | Server telemetry routes | ✅ | Hono routes at `/api/telemetry/journey/*` forward to `telemetry` plugin. |
| 16.3 | Client telemetry client | ✅ | `import { telemetry } from '@devvit/analytics/client/reddit'` with default basePath. |
| 16.4 | appReady event | ✅ | Fires on `startMultiplayer()`. |
| 16.5 | Journey lifecycle | ✅ | `startJourney()` for new AND returning players. `endJourney()` on colony/idle. |
| 16.6 | Progress events | ✅ | game_start, returned_player, first_move, first_dock, home_star_claimed, first_resource_collected, first_building, first_upgrade, first_ship_built, dock_upgraded, first_transfer, ship_upgraded, first_colony, star_discovered, alliance_joined, session_end. |
| 16.7 | Allowlisting | ❌ | App must be allowlisted by Devvit team for events to be recorded. Contact via Discord. Receipt returns `JOURNEY_RECEIPT_DENIED_NOT_ALLOWLISTED` until approved. |
| 16.8 | Receipt logging | ❌ | Log receipt status from server responses. Handle DENIED/RATE_LIMITED/DUPLICATE gracefully. |

### Receipt Status Reference

| Status | Meaning |
|---|---|
| `JOURNEY_RECEIPT_VALID` | Event accepted and recorded |
| `JOURNEY_RECEIPT_DENIED_NOT_ALLOWLISTED` | App not yet approved — contact Devvit team |
| `JOURNEY_RECEIPT_DENIED_RATE_LIMITED` | Too many events sent — throttle |
| `JOURNEY_RECEIPT_DENIED_DUPLICATE` | Already recorded — safe to ignore |
| `JOURNEY_RECEIPT_INVALID` | Bad payload — fix event data |
| `JOURNEY_RECEIPT_UNSPECIFIED` | Unknown outcome — retry |

### Action Required

1. Reach out in Devvit Discord to request allowlisting for `valcordia-space`.
2. After approval, verify receipts show `JOURNEY_RECEIPT_VALID`.
3. Dashboard will populate at https://developers.reddit.com/apps/valcordia-space (Journeys tab).

---

## Feature 17 — AI-Assisted Development ✅ ACTIVE

**What:** Devvit MCP server integration for AI-driven development workflow.

**Why:** Accelerates development via doc search (`devvit_search`) and live log debugging (`devvit_logs`).

### Sub-features

| # | Item | Status | Detail |
|---|---|---|---|
| 17.1 | MCP server setup | ✅ | `@devvit/mcp` available via npx. VS Code `.vscode/mcp.json` configured. |
| 17.2 | devvit_search | ✅ | Hybrid search over all Devvit docs from agent context. |
| 17.3 | devvit_logs | ⚠️ | Experimental: query app logs for a subreddit. Use "find a bug in my app deployed to valcordia_space_dev from the past week and fix it". |
| 17.4 | llms.txt context | ✅ | `https://developers.reddit.com/docs/llms.txt` for pre-prompt context. Full version at `llms-full.txt` for large-context models. |

### Notes

- Prefer `devvit_search` over pasting full docs to avoid context pollution.
- `devvit_logs` is experimental — works sometimes, shows glimpse of future AI debugging.
- React, ThreeJS, and Phaser have first-class MCP support with templates.

---

## Feature 18 — Settings & Secrets (Admin Configuration)

**What:** Devvit settings system for per-subreddit and global app configuration. Allows moderators to customize app behavior and developers to store secrets (API keys, etc.) securely.

**Docs:** https://developers.reddit.com/docs/capabilities/server/settings-and-secrets

### Two Scopes

| Scope | Who Configures | Use Case |
|-------|---------------|----------|
| `global` | Developer (CLI only) | API keys, secrets, environment toggle |
| `subreddit` | Moderators (Install Settings UI) | Per-community customization |

### Setting Types

- `string` — Text input
- `boolean` — Toggle switch
- `number` — Numeric input
- `select` — Dropdown (single choice)
- `multiSelect` — Multiple choice dropdown

### Configuration in `devvit.json`

```json
{
  "settings": {
    "global": {
      "apiKey": {
        "type": "string",
        "label": "API Key",
        "defaultValue": "",
        "isSecret": true
      },
      "environment": {
        "type": "select",
        "label": "Environment",
        "options": [
          { "label": "Production", "value": "production" },
          { "label": "Development", "value": "development" }
        ],
        "defaultValue": "production"
      }
    },
    "subreddit": {
      "welcomeMessage": {
        "type": "string",
        "label": "Welcome Message",
        "validationEndpoint": "/internal/settings/validate-message",
        "defaultValue": "Welcome to our community!"
      },
      "enabledFeatures": {
        "type": "multiSelect",
        "label": "Enabled Features",
        "options": [
          { "label": "Auto-moderation", "value": "automod" },
          { "label": "Welcome posts", "value": "welcome" },
          { "label": "Statistics tracking", "value": "stats" }
        ],
        "defaultValue": ["welcome"]
      }
    }
  }
}
```

### Accessing Settings in Server Code

```typescript
import { settings } from "@devvit/web/server";

// Get a single setting
const apiKey = await settings.get("apiKey");

// Get multiple settings
const [welcomeMessage, features] = await Promise.all([
  settings.get("welcomeMessage"),
  settings.get("enabledFeatures"),
]);
```

### Input Validation

Define `validationEndpoint` in the setting, then implement it:

```typescript
import type { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";

app.post("/internal/settings/validate-age", async (c) => {
  const { value } = await c.req.json<SettingsValidationRequest<number>>();
  if (!value || value < 0) {
    return c.json<SettingsValidationResponse>({ success: false, error: "Age must be positive" });
  }
  return c.json<SettingsValidationResponse>({ success: true });
});
```

### Managing Secrets via CLI

```bash
npx devvit settings list          # View all settings
npx devvit settings set apiKey    # Set a secret value (interactive prompt)
```

**Requirements:**
- Must `npm run dev` (build) after adding settings to `devvit.json`
- At least one app installation required before storing secrets via CLI
- Secrets are always global scope, encrypted, CLI-only
- Max 2KB per setting value

### Subreddit Settings UI

Once installed, moderators configure subreddit settings through the **Install Settings** page. All non-secret subreddit-scoped settings appear in a form UI. Changes are saved immediately.

### Potential Use Cases for Valcordia Space

| Setting | Scope | Purpose |
|---------|-------|---------|
| `difficulty` | subreddit | Easy/Normal/Hard mode per community |
| `maxPlayers` | subreddit | Limit concurrent players |
| `eventSchedule` | subreddit | Enable/disable seasonal events |
| `debugMode` | subreddit | Toggle verbose logging for mods |
| `externalApiKey` | global | Third-party service integration |
| `environment` | global | Dev vs production behavior toggle |

---

## Feature 19 — Backstory & Lore

**What:** Create a narrative backstory for the Valcordia Space universe that gives context to player actions, motivates exploration, and provides emotional grounding for the game mechanics.

### Goals

- Give players a reason to explore (not just mechanics)
- Explain why stars are unclaimed, why resources matter, why alliances form
- Provide flavor text for discoveries, buildings, and encounters
- Create a sense of place and history that differentiates the game

### Potential Elements

| Element | Description |
|---------|-------------|
| Origin story | Why humanity/species arrived in this sector |
| The Valcordia sector | What makes this region of space special |
| Factions/history | Previous inhabitants, fallen civilizations, anomalies |
| Player role | Who is the player? Explorer? Colonist? Survivor? |
| Star lore | Procedural or hand-written flavor for star systems |
| Discovery narratives | Short text blurbs on first visits, anomalies, artifacts |
| Endgame motivation | What are players building toward? |

### Implementation Ideas

- Splash/intro text on first play (part of tutorial journey)
- Lore snippets in star discovery panels
- Anomaly encounters with narrative context
- Codex/lore tab in help panel
- Progressive story reveals as milestones are hit

### Status: Not Started

---

## Feature 20 — Backstory Integration (10 Gameplay Enhancements)

**What:** Bring the Luminari/Valcordian/Machine backstory (see BACKSTORY.md) directly into gameplay through existing and new systems.

### 20.1 — Luminari Artifact Discoveries ⬡ Not Started

**Ties to:** Exploration system, buff system

When players explore planets, rare rolls yield a "Luminari Artifact" — grants a powerful one-time buff. Add flavor text to exploration results: *"Your scanners detect an ancient Luminari energy node, dormant for millennia. Its resonance amplifies your hyperdrive."*

- Modify exploration outcome table to include `luminari_artifact` kind
- Map to existing buff grants (hyperdrive, resonance, etc.)
- Add lore text to explore result UI

### 20.2 — Valcordian Ruin Star Systems ⬡ Not Started

**Ties to:** Galaxy generation, autobot NPC

Mark 5-10 stars as "Valcordian Ruins" (distinct visual — orange glow or cracked icon). These stars have richer exploration rewards but the Autobot patrols them more aggressively, representing machines guarding old territory.

- Tag ruin stars at galaxy generation (deterministic from seed)
- Renderer: distinct star color/icon for ruin stars
- Exploration: higher reward weights at ruin stars
- Autobot: prioritize ruin stars in patrol routes

### 20.3 — Machine Raid Escalation ⬡ Not Started

**Ties to:** Autobot FSM, colony count, alliance system

As total player colonies grow, the Autobot becomes more aggressive (matches Act III). At 10 total colonies across all players, raids increase frequency. At 20, the Autobot targets the weakest colony. Creates natural pressure to form alliances.

- Track global colony count in Redis
- Autobot FSM: scale aggression by colony thresholds
- Notification system for escalation events

### 20.4 — Star Gate Network (Fast Travel) ⬡ Not Started

**Ties to:** Galaxy generation, jump links, fuel system

3-4 star pairs have "Luminari Star Gates" — zero fuel cost, instant travel time. Discoverable only via Enhanced Probes. Lore: *"A dormant Luminari gate activates as your probe approaches."*

- Galaxy generation: designate gate pairs (deterministic from seed)
- Probe discovery: reveal gate connections
- Transit system: zero cost/time for gate links
- Renderer: distinct visual for gate links

### 20.5 — Introductory Lore Crawl ⬡ Not Started

**Ties to:** Tutorial/journey system, splash screen

On first play, show a brief 3-sentence text crawl before gameplay: *"The Luminari are gone. The Valcordian machines remain. You are humanity's next chapter."* Dismissable with a tap, sets tone in 5 seconds.

- Add lore overlay to tutorial flow (before first undock)
- Fade-in/fade-out text animation
- Skip on tap, auto-advance after 5 seconds
- Only show once (track in profile)

### 20.6 — Codex Tab in Help Panel ⬡ Not Started

**Ties to:** Help panel UI, achievements/milestones

Add a "Lore" tab alongside Controls/Buildings/Ships in the help panel. Entries unlock as players hit milestones:

| Milestone | Codex Entry |
|-----------|-------------|
| First login | "Humanity Arrives" |
| First colony | "Claiming the Stars" |
| First alliance | "The Fragile Peace" |
| First raid survived | "The Machines Strike" |
| 5 stars discovered | "Luminari Echoes" |
| Machine stronghold found | "The Valcordian Legacy" |

- New help tab with locked/unlocked entry list
- Store unlocked entries in player profile
- Green glow on new unlocks

### 20.7 — Machine Stronghold End-Game Objective ⬡ Not Started

**Ties to:** Galaxy generation, alliance system, fleet combat

One star (fixed seed position) is a "Machine Stronghold" — visually distinct, cannot be colonized solo. Requires 3+ alliance members to each send a fleet simultaneously. Conquering it unlocks a unique achievement and permanent resource bonus for the alliance. Maps to Act IV.

- Designate one star as stronghold at generation
- Renderer: unique stronghold visual (red pulsing)
- Alliance fleet coordination mechanic
- Achievement + alliance-wide bonus on conquest
- Resets weekly or per-galaxy cycle

### 20.8 — Splinter Faction Event (Periodic) ⬡ Not Started

**Ties to:** Scheduler, community voting, buff system

Every 7 days, a timed event: "A splinter faction offers a truce with the machines." Players vote:
- **Accept** → temporary shield buff galaxy-wide (24h)
- **Reject** → raid damage bonus galaxy-wide (24h)

Majority vote wins. Creates a recurring community decision point from Act V.

- Scheduler: trigger event every 7 days
- Redis: store votes per player, tally at deadline
- Apply winning buff to all players for 24h
- Notification/UI for active event + result

### 20.9 — Reverse-Engineered Tech Unlocks ⬡ Not Started

**Ties to:** Building system, autobot raids, progression

After defeating 5 Autobot raids, players unlock a "Valcordian Tech" building slot — a unique structure outside the normal tree:
- **Machine Harvester** — doubles ore production rate
- **Automaton Shield** — immunity to one raid per day

Ties to "reverse-engineered Valcordian technology" from the lore.

- Track raid defeats per player in Redis
- New building type with special unlock condition
- Unique visual in dock panel (Valcordian aesthetic)

### 20.10 — Discovery Log Voice Lines ⬡ Not Started

**Ties to:** Audio system, exploration system

Replace generic exploration results with lore-flavored audio voice lines:
- *"Luminari energy signature detected... extracting."*
- *"Warning: Valcordian automaton debris. Salvageable components recovered."*
- *"Ancient star gate fragment found. Navigation data archived."*
- *"Machine patrol remnants detected. Proceed with caution."*

- Record new WAV files with narrative context
- Map exploration outcome kinds to specific voice lines
- Use existing audio system (SoundId + SOUND_FILES)

### Priority Order (Suggested)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | 20.5 Lore Crawl | Low | Sets tone immediately |
| 2 | 20.1 Luminari Artifacts | Low | Builds on existing buff/explore |
| 3 | 20.10 Voice Lines | Medium | Adds atmosphere every session |
| 4 | 20.6 Codex Tab | Medium | Gives collectors a goal |
| 5 | 20.2 Ruin Stars | Medium | Visual variety + exploration |
| 6 | 20.4 Star Gates | Medium | Quality-of-life + lore |
| 7 | 20.3 Raid Escalation | Medium | Dynamic difficulty |
| 8 | 20.8 Splinter Event | High | Community engagement |
| 9 | 20.9 Reverse-Eng Tech | High | End-game depth |
| 10 | 20.7 Machine Stronghold | High | Alliance end-game |

---

## Future Consideration: Moderator-Based Admin Commands

Currently admin access is hardcoded in `src/server/core/admin-auth.ts`. A future improvement could tie admin commands to the subreddit's moderator list using `reddit.getModerators()`. This would allow adding/removing admins via Reddit's mod panel instead of redeploying.

**Approach:** Hybrid — subreddit mods get general admin access (game management, leaderboard resets), while a hardcoded "superadmin" list stays locked for destructive operations (data wipes, debug endpoints). Cache the mod list in memory with a 5-minute TTL to avoid extra API calls per request.
