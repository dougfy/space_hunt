# Attack Plan — Valcordia Space

**Authority:** This file is the shared progress tracker and task contract between the human and agent. `AGENTS.md` governs coding and agent behavior; linked design documents explain scope. Other documents must refer here for current task status.

**Platform:** Devvit Web, TypeScript/Canvas2D client, Hono server, Redis persistence.

**Tracker reviewed:** 2026-09-08. **Code baseline inspected:** `f42f4a0`, local version `1.4.168`. This is a documentation review, not a runtime verification or deployment claim.

**Historical basis:** ValcordiaSpace artifacts named in the original plan: `economy_catalog_v1.md`, `domain_model.md`, `game_catalog_v1.md`, `architecture_v1.md`, `design_phase_0.md`, `program_management.md`. These files are not in this checkout; do not assume their contents or requirements.

## Working agreement

1. **Select:** Human and agent identify a stable ID and intended outcome. A request to implement a task authorizes work within that scope; routine reversible work does not need repeated confirmation.
2. **Define:** Before implementation, record owner, in/out of scope, observable acceptance criteria, dependencies and verification method in the active-work record below. Resolve material gameplay choices; do not silently turn optional design proposals into requirements.
3. **Execute:** Inspect the relevant code and linked notes, establish the relevant baseline, then implement within scope. Add child IDs for independently deliverable work; never reuse or renumber IDs.
4. **Verify:** Check each acceptance criterion. Record date, commit or working-tree baseline, commands/manual scenarios, result, environment and evidence link. Code inspection, unit tests, visual checks and live Reddit verification are different evidence types. Use only checks appropriate to the change.
5. **Close:** Update the canonical register and evidence record in the same task. `Done` requires evidence for every agreed criterion. Implementation awaiting checks is `Needs verification`. Record residual work under an ID. User acceptance and deployment are recorded separately; do not infer either from a code change.
6. **Handoff:** If interrupted, record completed work, next action and actual blockers. End the task report with IDs changed, validation results and any remaining decision. Log scope/status changes below; never invent historical verification dates.

### IDs and status rules

- `ISS-001`–`ISS-046` preserve the original issue numbers; `FEAT-001`–`FEAT-021` preserve feature numbers. The former duplicate **Feature 15: Voice Alerts** is now **FEAT-022**; **FEAT-015** exclusively means logged-out support. New epics use FEAT-023 onward.
- Child IDs use `.1`, `.2`, etc. (for example `FEAT-021.3` or `ISS-039.1`). Numbered steps, test scenario numbers, priority ranks and launch checklist rows are not task IDs.
- Canonical statuses: `Design needed`, `Planned`, `Open`, `In progress`, `Partial`, `Blocked`, `Needs verification`, `Done`, `Superseded`, `Deferred`.
- Migration-only status `Reported done` preserves an old completion claim without asserting fresh verification. Verify before converting to `Done`; reopen if evidence contradicts the claim.
- `Blocked` needs a specific blocker and next action. `Superseded` requires a successor ID. `Deferred` requires a reason and revisit trigger. Parent epics cannot be `Done` while required children remain unfinished.
- **Dependencies below are initial planning relationships.** `None identified` is not proof of independence. Parent/shared-work links are labeled; they do not require finishing an entire epic before starting a slice. Refine dependencies for the selected slice and avoid circular completion gates.
- `Not recorded` means no reliable task-level verification date/evidence was provided. Version mentions in historical notes are not verification dates. The review date above must not be copied into these fields as a test date.
- Only the two registers below own current status. Preserved design tables and checklists are historical supporting material; their checkmarks are not independent completion records. Promote a design/checklist slice to a register row with dependencies, acceptance and evidence before executing it.

### Active work / handoff

ISS-046.2 is active (2026-09-08): the user requested a simple in-game mock before implementing ISS-046.1. The agent added a feature-flagged sample map to every selected galaxy star card, with card-wide input interception. Type-check, lint and build pass. Version 1.4.169 was uploaded and installed on r/valcordia_space_dev; next action is human visual review in Reddit. ISS-046.1 remains planned; its probe gating and persistence work have not started.

When work starts, replace this paragraph with:

| Field | Required entry |
|---|---|
| Task / owner / started | Stable ID, responsible agent or human, UTC date |
| Scope | Included outcomes and explicit exclusions |
| Acceptance | Observable pass/fail criteria; resolve any broad epic criteria into a deliverable slice |
| Dependencies / decisions | Prerequisites, available existing capabilities, unresolved human decisions |
| Verification plan | Relevant commands, manual scenarios, target environment and expected results |
| Progress / next action | What changed, remaining work, blockers |
| Evidence / acceptance / release | Evidence link, human acceptance if given, deployment version/environment if performed |

### Suggested next selection

This is a recommendation, not an assigned queue: ISS-041 (movement-state regression), ISS-037 (server refuel rules), ISS-027 (building visibility), then ISS-042 with an ISS-039 infrastructure slice (guided colonization). FEAT-030 should establish the actual test baseline before expanding coverage. The prior priority list is preserved in the appendix.

## Issue register

All original issues are together in numeric order, followed by selected child tasks. Detailed context is linked per row. Broad acceptance criteria are proposed from existing notes and must be made concrete when selecting a slice.

| ID | Task | Status | Dependencies / successor | Acceptance criteria | Verified on | Context / evidence |
|---|---|---|---|---|---|---|
| ISS-001 | Boundary issue in solar tier — no need to scroll | Reported done | None identified | System view fits within the viewport without scrolling at the selected supported sizes. | Not recorded | [Notes](#iss-001-notes) |
| ISS-002 | Leaving solar→galaxy with bounds on loses bounds state | Reported done | None identified | Bounds setting survives System/Galaxy transitions and page reload. | Not recorded | [Notes](#iss-002-notes) |
| ISS-003 | Galaxy view: separate ship nav from fleet movement picker | Reported done | None identified | Fleet transfer mode filters destinations by ship type without changing player-ship navigation. | Not recorded | [Notes](#iss-003-notes) |
| ISS-004 | Star coloring not working — see red stars after visiting | Reported done | None identified | Visited foreign-owned stars render with the foreign ownership color; own and unowned stars retain their correct colors. | Not recorded | [Notes](#iss-004-notes) |
| ISS-005 | Ship name editing blocked by steering keys | Reported done | None identified | Editing a ship name accepts steering-key characters without moving the ship. | Not recorded | [Notes](#iss-005-notes) |
| ISS-006 | iPad sizing | Open | None identified | At recorded iPad portrait and landscape sizes, canvas/HUD/panels fit and all controls remain reachable; capture both modes. | Not recorded | [Notes](#iss-006-notes) |
| ISS-007 | Pinch gesture conflicts with ship movement | Open | None identified | Two-finger pinch changes zoom without steering; one-finger steering resumes after pinch; verify touch sequences. | Not recorded | [Notes](#iss-007-notes) |
| ISS-008 | Galaxy fuel vs system fuel | Reported done | None identified | Fuel is a persisted resource with refinery production and ownership-gated dock access across navigation tiers. | Not recorded | [Notes](#iss-008-notes) |
| ISS-009 | Extended discovery: belt items, planet items, multiple ores, Knowledge | Partial | FEAT-009 | Finish FEAT-009 remaining discovery scope with persistent rewards and explicit unlock rules; track implementation slices there. | Not recorded | [Notes](#iss-009-notes) |
| ISS-010 | Entry into solar tier dumps into belt | Reported done | None identified | Entering a solar system places the ship at its entry edge rather than inside the central belt. | Not recorded | [Notes](#iss-010-notes) |
| ISS-011 | Belt (Local tier) missing side controls | Reported done | None identified | Local/Belt tier renders reachable side controls with working hit targets. | Not recorded | [Notes](#iss-011-notes) |
| ISS-012 | Ship docked voice repeats on fleet/galaxy view switch | Reported done | None identified | Opening and closing Fleet/Galaxy views while docked preserves dock state without replaying the dock voice. | Not recorded | [Notes](#iss-012-notes) |
| ISS-013 | COMPLETE button visible to all players | Reported done | None identified | COMPLETE is hidden for ordinary players and available only to the intended developer UI. | Not recorded | [Notes](#iss-013-notes) |
| ISS-014 | Help/journey system not persisting across sessions | Reported done | None identified | Journey completion persists across a new browser session without restarting completed guidance. | Not recorded | [Notes](#iss-014-notes) |
| ISS-015 | Help/journey voice plays in system tier | Reported done | None identified | Planet-specific journey voice does not play in System tier. | Not recorded | [Notes](#iss-015-notes) |
| ISS-016 | Probe not consumed after arrival | Reported done | None identified | A probe is consumed once on arrival and the destination discovery persists after polling/reload. | Not recorded | [Notes](#iss-016-notes) |
| ISS-017 | COMS nested replies + loading state | Reported done | None identified | COMS renders nested Reddit replies at the correct depth and shows a loading state while fetching. | Not recorded | [Notes](#iss-017-notes) |
| ISS-018 | Layout overlapping (fleet ships, feature labels, player names) | Reported done | None identified | Fleet ships, feature labels and player names do not overlap in the scoped layouts; record comparison screenshots. | Not recorded | [Notes](#iss-018-notes) |
| ISS-019 | Trading station ⚖ icon visible before discovery | Reported done | None identified | Trading-station icon remains hidden until the star is probed or visited. | Not recorded | [Notes](#iss-019-notes) |
| ISS-020 | Probe arrival not updating star to probed state | Reported done | None identified | Probe arrival updates the client star to Probed from server discovery data without requiring a page reload. | Not recorded | [Notes](#iss-020-notes) |
| ISS-021 | **REDDIT REVIEW: UGC reportability** | Reported done | None identified | Authorized report action records and deduplicates the report and delivers attributed modmail; verify via the appropriate test environment. | Not recorded | [Notes](#iss-021-notes) |
| ISS-022 | **REDDIT REVIEW: Admin endpoint security** | Reported done | None identified | Unauthenticated/non-developer callers receive rejection from admin/debug/bot endpoints; authorized developer access works without trusting client flags. | Not recorded | [Notes](#iss-022-notes) |
| ISS-023 | **Bot smooth presence (Level 2 patrol)** | Reported done | None identified | Bot presence follows timed arrive/linger/depart movement at Galaxy/System/Planet tiers with valid tier values. | Not recorded | [Notes](#iss-023-notes) |
| ISS-024 | **Font readability / dim text** | Partial | ISS-028 | Readability pass preserves usable text and controls; contrast remainder is accepted through ISS-028. | Not recorded | [Notes](#iss-024-notes) |
| ISS-025 | **Undocking not discoverable** | Reported done | None identified | Onboarding highlights UNDOCK; undocking releases the ship on a clear heading without immediate re-docking. | Not recorded | [Notes](#iss-025-notes) |
| ISS-026 | **Tutorial mode (restartable)** | Partial | ISS-039 | Onboarding remains resumable and non-overlapping; advanced topic continuation is completed through ISS-039. | Not recorded | [Notes](#iss-026-notes) |
| ISS-027 | **Buildings not visible on star visit** | Open | None identified | On first arrival and delayed economy responses, permitted buildings render without a rescan/reload; hidden intelligence remains hidden. | Not recorded | [Notes](#iss-027-notes) |
| ISS-028 | **Text contrast too dim** | Open | None identified | Record text/background color pairs and a numeric contrast target before changes; all scoped panels meet it with visual evidence. | Not recorded | [Notes](#iss-028-notes) |
| ISS-029 | **Stuck in galaxy tier** | Reported done | None identified | Closing Fleet, closing all panels or tapping outside them preserves a valid tier-return path; SYSTEM remains an effective escape. | Not recorded | [Notes](#iss-029-notes) |
| ISS-030 | **Refueling not intuitive** | Open | ISS-037 | A new player can locate refuel, understand eligibility/cost/cooldown, and refuel without external instructions. | Not recorded | [Notes](#iss-030-notes) |
| ISS-031 | **Docking at buildings (not just station)** | Superseded | ISS-037, ISS-038 | No independent implementation; docking mechanism is tracked by ISS-037 and structure actions by ISS-038. | Not recorded | [Notes](#iss-031-notes) |
| ISS-032 | **Colonizing a star needs a better guide / simpler flow** | Superseded | ISS-042 | No independent implementation; the colonization usability requirement is accepted through ISS-042. | Not recorded | [Notes](#iss-032-notes) |
| ISS-033 | **Empire overview / management screen** | Open | None identified | One overview lists all owned stars, buildings, ships, stores and routes accurately, including empty/loading/error states. | Not recorded | [Notes](#iss-033-notes) |
| ISS-034 | **External leaderboard publishing** | Open | None identified | Chosen external surface displays the authoritative leaderboard with refresh/error behavior and no private player data. | Not recorded | [Notes](#iss-034-notes) |
| ISS-035 | **Legacy journey hints — rescoped, not retired** | Reported done | None identified | Returning-player idle hints trigger only in their intended state; new-player coach and legacy hints never overlap. | Not recorded | [Notes](#iss-035-notes) |
| ISS-036 | **Font scale picker in Settings (S/M/L)** | Partial | None identified | Small remains visually unchanged; Medium/Large fit scoped panels and HTML overlays with matching hit targets; preference survives reload. | Not recorded | [Notes](#iss-036-notes) |
| ISS-037 | **Feature docking + Space Dock refuel** | Partial | None identified | Server enforces the 300-second cooldown across reloads and owns the fewer-than-two-stars gate; duplicate requests cannot double-grant fuel. | Not recorded | [Notes](#iss-037-notes) |
| ISS-038 | **Dockable structure purposes (per-feature actions)** | Open | ISS-037 | Record an action or explicit non-dockable decision per structure type; enabled actions have server validation and usable UI. | Not recorded | [Notes](#iss-038-notes) |
| ISS-039 | **Tutorial topics beyond onboarding** | Partial | None identified | Named sequences support independent resume/replay/completion and no-target cards; scoped topic guides never overlap Help or require sending messages. | Not recorded | [Notes](#iss-039-notes) |
| ISS-040 | **Wire staged new sound pack into runtime audio map** | Open | None identified | Selected assets have canonical runtime mappings with no missing files; verify intended voice/SFX playback and mute behavior in game. | Not recorded | [Notes](#iss-040-notes) |
| ISS-041 | **Galaxy/System return can reset moving ship to home star** | Open | None identified | Galaxy/System and fleet-return paths preserve moving ship position, target and travel state; home return occurs only by explicit choice. | Not recorded | [Notes](#iss-041-notes) |
| ISS-042 | **Colony expansion sequence and guided tutorial** | Open | ISS-039 (sequence infrastructure) | Resumable scout/build/send/arrive/visit/colonize flow explains invalid targets; server consumes one arrived colony ship once and rejects invalid claims. Resolve optional gates before implementation. | Not recorded | [Notes](#iss-042-notes) |
| ISS-043 | **Splash command center** | Partial | None identified | Splash offers responsive leaderboard states and a Help entry that neither starts gameplay nor auto-launches a coach sequence. | Not recorded | [Notes](#iss-043-notes) |
| ISS-044 | **Player achievement badges** | Open | FEAT-011 (existing milestones) | Player-safe API and badge view show earned/locked conditions accurately; verify persistence and separation between players. | Not recorded | [Notes](#iss-044-notes) |
| ISS-045 | **Radar array and progressive sensor discovery** | Open | FEAT-021 (shared implementation) | Radar detects inbound transits within configured coverage, attributes only permitted identities, and persists deduplicated alerts; FEAT-021 owns shared slices. | Not recorded | [Notes](#iss-045-notes) |
| ISS-046 | **Probe-level solar detail** | Open | FEAT-021 (shared implementation) | Basic/Enhanced/Visited tiers expose the agreed detail contract server-side; ordinary foreign-building visibility is independent of scan rewards. | Not recorded | [Notes](#iss-046-notes) |

| ISS-046.1 | Enhanced Probe miniature system map experiment | Planned | Existing probe arrival and system generator; FEAT-021.3/.5 scope overlap, no radar prerequisite | Enhanced survey unlocks a read-only schematic in the selected galaxy star card; Basic shows counts only; upgrades appear after arrival and survive reload without moving the ship. See scoped criteria below. | Not recorded | [Plan](#iss-046-1-plan) |

| ISS-046.2 | In-game galaxy survey mock for visual review | Needs verification | Existing star selection; precedes ISS-046.1 implementation | Selecting any galaxy star displays a labeled sample map; card fits viewport, dismiss and VISIT work, and map clicks do not steer or select underlying stars. Human reviews the layout in Reddit. | 2026-09-08: local checks only | src/game/renderer.ts; runtime review pending |

## Feature and program register

These are epics, not single-session commitments. The numbered feature design sections below retain the original scope. FEAT-023–030 give previously unnumbered priorities and workstreams a stable home. `Not recorded` applies to verification, including epics historically described as shipped.

| ID | Epic | Status | Dependencies / related work | Acceptance criteria | Verified on |
|---|---|---|---|---|---|
| FEAT-001 | [Resources](#feat-001-design) | Reported done | None identified | Per-star production, caps and spending persist correctly; rejected and duplicate operations preserve balances. | Not recorded |
| FEAT-002 | [Buildings](#feat-002-design) | Reported done | FEAT-001 | Build prerequisites, costs, upgrade completion and production effects match the catalog and persist. | Not recorded |
| FEAT-003 | [Ship building](#feat-003-design) | Partial | FEAT-001, FEAT-002 | Buy, upgrade, completion and fleet delivery pass meaningful service tests; reconcile existing S-05/S-06 coverage before adding tests. | Not recorded |
| FEAT-004 | [Star colonization](#feat-004-design) | Reported done | FEAT-003, FEAT-006 | Valid arrived colony ship claims an eligible star exactly once; invalid claims fail. Guided expansion belongs to ISS-042. | Not recorded |
| FEAT-005 | [Freighter routes and trading stations](#feat-005-design) | Reported done | FEAT-001, FEAT-003, FEAT-006 | Resource transport and trades conserve stores, reconcile arrivals, and reject invalid ownership/targets. | Not recorded |
| FEAT-006 | [Ship movement](#feat-006-design) | Partial | FEAT-003 | Transit reconciliation delivers once; remaining map interpolation matches server timing without changing arrival state. | Not recorded |
| FEAT-007 | [Currency and commerce](#feat-007-design) | Planned | FEAT-001 | Agree currency and premium scope first; implement balances, earn/spend, HUD, insufficiency and duplicate-spend protection for that scope. | Not recorded |
| FEAT-008 | [Combat](#feat-008-design) | Partial | FEAT-003, FEAT-006 | Agreed attack/defense matrix resolves server-side; destruction and reports are consistent; tests cover shields and duplicate resolution. | Not recorded |
| FEAT-009 | [Discovery and exploration](#feat-009-design) | Partial | None identified | Collections, blueprint effects, anomaly HUD, ore types and knowledge follow agreed progression and persist; reconcile FEAT-025 implementation first. | Not recorded |
| FEAT-010 | [Social: mail and alliances](#feat-010-design) | Partial | None identified | Add/verify dedicated permission and lifecycle coverage for DM, alliance membership/chat and shared discovery; two-player checks cover delivery. | Not recorded |
| FEAT-011 | [Sharing](#feat-011-design) | Partial | None identified | Remaining station/discovery shares and activity surface follow the agreed scope, use server cooldowns, and preserve opt-in controls; image cards remain optional. | Not recorded |
| FEAT-012 | [Help system](#feat-012-design) | Partial | ISS-026, ISS-039 | Preserve shipped onboarding and returning hints; complete selected advanced sequences through ISS-039 without competing overlays. | Not recorded |
| FEAT-013 | [Automated player](#feat-013-design) | Partial | FEAT-003, FEAT-006, FEAT-010 | Preserve recorded phases 1–4; remaining chatter obeys rate/content rules and has verified COMS integration and bot leaderboard exclusion. | Not recorded |
| FEAT-014 | [Fuel commodity](#feat-014-design) | Reported done | FEAT-001, FEAT-002 | Fuel production, consumption and owned-dock access persist correctly; Space Dock special rules are tracked separately in ISS-037. | Not recorded |
| FEAT-015 | [Logged-out player support](#feat-015-design) | Planned | None identified | Guest session reaches agreed play scope; login handoff safely migrates allowed progress once; verify currently supported Devvit APIs before implementing. | Not recorded |
| FEAT-016 | [Journey analytics](#feat-016-design) | Needs verification | None identified | Record actual receipt/dashboard evidence for core events and allowlist state; handle rejected/rate-limited/duplicate receipts. Do not infer platform approval from instrumentation. | Not recorded |
| FEAT-017 | [AI-assisted development tooling](#feat-017-design) | Needs verification | None identified | Document tools actually available to this agent and verify intended docs/log access; do not claim a VS Code configuration enables tools in every agent. | Not recorded |
| FEAT-018 | [Settings and secrets](#feat-018-design) | Design needed | None identified | Select required settings and scopes; validate server-side reads, defaults and secret handling without exposing values to the client. | Not recorded |
| FEAT-019 | [Backstory and lore](#feat-019-design) | Planned | None identified | Agree a consistent lore baseline and player-facing scope; FEAT-020 owns gameplay integration and FEAT-029 owns video COMS. | Not recorded |
| FEAT-020 | [Ten lore integrations](#feat-020-design) | Planned | FEAT-019 | Select and accept each FEAT-020.n slice separately; full epic completion requires all ten intended integrations or explicit scope changes. | Not recorded |
| FEAT-021 | [Radar and progressive intelligence](#feat-021-design) | Planned | FEAT-006, FEAT-009, FEAT-022 | Implement FEAT-021.1–7 with visibility/attribution permissions, pre-arrival coverage, persistence and duplicate-alert tests; satisfies ISS-045 and ISS-046. | Not recorded |
| FEAT-022 | [Voice alerts and sensor system](#feat-022-design) | Needs verification | None identified | Verify all nine documented scenarios, including two-player notifications, no self-alert, queue cap, sequential audio and charge double-tap prevention. | Not recorded |
| FEAT-023 | Dynamic galaxy expansion | Design needed | FEAT-004, FEAT-006 | At star-cap exhaustion, new connected clusters admit players while existing coordinates, ownership and saved routes remain valid. | Not recorded |
| FEAT-024 | Daily return mechanics | Design needed | ISS-043 | Select daily slices explicitly; UTC-day generation is idempotent and returning cards reflect server state without unsolicited coach prompts. Dispatch publishing is a separate authorized action. | Not recorded |
| FEAT-025 | Special items and air-purifier quest | Needs verification | FEAT-009 | Reconcile shipped work against [quest-items.md](quest-items.md) phases 1–7; verify grant/repair idempotency, freight, escrow and alliance permissions; track remaining UI and audit-history slices. | Not recorded |
| FEAT-026 | Production readiness and operations | Needs verification | ISS-006, ISS-007, ISS-027, ISS-028, ISS-030, ISS-041, ISS-042, FEAT-016, FEAT-030 | Turn the launch checklist into a dated go/no-go record for the exact release, with explicit accepted deferrals, target environment, recovery plan and evidence. | Not recorded |
| FEAT-027 | Skin coverage and polish | Partial | None identified | Reconcile [skin coverage](docs/visuals/SKIN_COVERAGE.md) with runtime assets; selected skins cover required buildings and retain readable controls across display modes. | Not recorded |
| FEAT-028 | Autonomous exploration probe | Design needed | FEAT-006, FEAT-009, FEAT-014 | Define how player exploration differs from the existing NPC; verify autonomous travel/refueling/discovery, fuel exhaustion and reload recovery. | Not recorded |
| FEAT-029 | Video COMS | Design needed | FEAT-019 | Agree supported media delivery and fallbacks; prototype in Reddit inline/expanded views and verify user-triggered playback and mute controls. | Not recorded |
| FEAT-030 | Regression coverage and CI | Needs verification | None identified | Inventory actual tests, run the local baseline, then close agreed combat/fleet/social/sensor gaps; separate Vitest from Playwright and record automated check results. | Not recorded |


<a id="iss-046-1-plan"></a>

## ISS-046.1 — Enhanced Probe miniature system map experiment

**Planning date:** 2026-09-08. **Owner:** agent for planning; implementation unassigned. **Parent:** ISS-046 / FEAT-021. This is a small presentation experiment within the larger progressive-discovery feature. Implementing it does not complete radar, foreign-building intelligence, or the server-authoritative intelligence contract.

### Proposed player experience

In Galaxy view, select a star using the existing selection interaction. Its information card shows the best available survey detail. The user's “extended probe” means the catalog's **Enhanced Probe (type 12)**; Basic Probe is type 11.

| Available knowledge | Card content |
|---|---|
| Unexplored | Existing name/status/distance and “SYSTEM DATA UNKNOWN”; no miniature map |
| Basic Probe has arrived | Planet/belt counts; “Enhanced Probe reveals system map” |
| Enhanced Probe has arrived | Counts plus a miniature schematic: central star, orbit rings, planet dots and distinct belt rings; “DETAILED SURVEY” |
| Personally visited, home or owned system | Same schematic available; retain applicable ownership/home information |

Proposed defaults: preserve existing alliance-shared discovery eligibility; use generic survey wording when provenance is unknown. Show one selected-star map, not maps over every galaxy star. It is a static schematic, not live radar. Viewing/dismissing it does not visit, scan, claim, steer or consume fuel; the existing VISIT action remains separate. Opening a map is deliberate selection, not an automatic arrival popup.

### Findings from source inspection

- `src/server/core/game-service.ts: loadAllFleet()` consumes arriving probes and persists `discoveredStars` and `enhancedProbeStars`; `FleetAllResponse` already returns both and merges alliance discovery. No new preview endpoint is needed for this experiment.
- `src/game/renderer.ts` already has a selected-star information card (currently 180 × 126) and calls `generateSystem(star, postId)` for planet/belt counts. Reuse that seeded geometry; do not load the actual System tier or a second game engine.
- `src/game/galaxy.ts: generateSystem()` supplies body positions, types, radii and orbit distances. Preview only geometry; exclude generated station features and all economy, fleet or private building data.
- `GalaxyStar.discoveryLevel` currently has `none/probed/visited`; enhanced scans are folded into `visited`. `setDiscoveredStars()` and two fleet-poll branches in `src/client/game.ts` only upgrade stars whose level is `none`. Basic → Enhanced therefore needs a shared upgrade path.
- The profile autosave sends `getVisitedStars()` as `enhancedProbeStars`, and `saveProfile()` overwrites that array. The stored field is already an aggregate of detailed knowledge, not reliable evidence that an Enhanced Probe personally visited a star. A stale autosave can also overwrite newly reconciled knowledge. Preserve known detail monotonically for this experiment and test the arrival/save ordering.
- The transfer picker currently excludes previously discovered non-foreign stars for both probe types. Enhanced re-survey of a Basic-probed star needs a targeted eligibility change, retaining current range/fuel constraints and checking the server transfer path.

### Implementation sequence

1. **Centralize survey detail and upgrade handling.** Introduce a small typed helper/view model returning `unknown`, `summary` or `system-map` from existing knowledge and ownership. Reuse it for profile restore, both fleet-poll paths, preview visibility and probe targeting. An Enhanced result upgrades a Basic result immediately; repeated responses never downgrade it. Preserve existing navigation/discovery behavior and labels outside this experiment. Handle missing legacy enhanced lists explicitly, preserving their existing detailed-knowledge behavior without claiming probe provenance.
2. **Make persistence and targeting reliable.** Allow Enhanced Probe re-survey of a Basic-only eligible star. Ensure normal profile saves cannot erase already recorded detailed knowledge; prefer server-side union/atomic membership updates and test concurrent arrival/autosave ordering. Keep explicit admin reset semantics. Do not persist alliance-derived knowledge as personal entitlement merely because it was returned in a merged response; separate personal save data from effective display data on this path.
3. **Build the schematic renderer.** Add a focused preview module (suggested `src/game/system-preview.ts`) with a pure layout helper. Normalize positions relative to the system center, scale all bodies/rings into a padded square, and use minimum visible marker sizes. Cache generated preview data by post/system seed and relevant layout inputs; do not regenerate it each animation frame. Use simple canvas primitives so the experiment requires no new assets or framework.
4. **Integrate with the star card.** Extend the existing card with a responsive preview region and a survey label. Use a compact bottom-positioned card when a star-adjacent card cannot fit. Calculate draw and hit-test rectangles from one layout result; keep dismiss and VISIT reachable. Ensure map/card clicks cannot fall through to steering and transfer mode still works. Add a dedicated feature flag using the existing feature-flag pattern for easy rollback to the current card.
5. **Verify the experiment.** Run targeted tests, type-check, lint and build. In a dev Reddit playtest, compare Basic and Enhanced results, upgrade a Basic-probed star, reload, and inspect supported screen modes. Record whether players can distinguish planets/belts and understand why the Enhanced Probe provides more information. Keep the experiment flag until that visual review supports keeping it.

### Acceptance and verification contract

| Criterion | Required evidence |
|---|---|
| Unknown has no map; Basic has counts only; Enhanced/visited/home/owned get the schematic | Unit cases for the visibility helper plus in-game screenshots for Basic and Enhanced |
| Probe must arrive before unlocking the map | Service test around transit arrival boundary and one end-to-end arrival check |
| Basic → Enhanced updates an already selected card on the next successful fleet refresh | Integration test and manual observation; no reload needed |
| Knowledge survives reload and stale autosave; duplicate arrivals do not double-consume probes | Service tests for repeated reconciliation and both arrival/save orderings; cover concurrent updates using the chosen storage primitive |
| Legacy and alliance data have explicit behavior | Tests for missing enhanced list, alliance-shared access and not copying shared detail into personal saved state |
| Schematic matches the actual generated system | Compare body count/type and normalized orbit/position data against `generateSystem` for fixed seeds; visit the same sample system visually |
| Preview has no gameplay side effects | Compare tier, ship position/target, fuel and discovery before/after select/dismiss; verify VISIT still works separately |
| Layout remains usable | Desktop, narrow mobile, and iPad portrait/landscape screenshots; test S/M/L font settings for this card, long names, dense systems and edge-of-screen selection |
| Feature can be withdrawn | Flag off restores the existing star card; no new assets or extra network request per render |

**Out of scope:** detailed building/resource intelligence, clickable planets, entering systems remotely, radar contacts, new probe tiers, precise historical probe provenance, broad discovery migration, and redesign of the whole galaxy screen. Do not block this slice on completing the whole FEAT-021 epic.

**Security boundary:** current system geometry is generated from client-visible seeds and discovery fields are writable through the existing profile path. This experiment is a presentation rule for ordinary gameplay, not protection against a modified client. Before adding private building/resources/live-contact intelligence, FEAT-021 must provide authenticated, server-authoritative permissions and filtered responses; a hidden canvas map is not that boundary.

**Effort:** medium, approximately 2–3 focused development days including regression and device checks. The drawing itself is small; discovery upgrades, save ordering and card input/layout are the main work. This is a planning estimate, not a delivery commitment. Refine after a targeted baseline run.

## Verification evidence

- ISS-046.2 | 2026-09-08 | local version 1.4.169, working tree | type-check, lint, build and diff checks passed; `npm run ship` uploaded two changed WebView assets and confirmed installation of 1.4.169 on r/valcordia_space_dev | in-game visual acceptance remains pending; full probe behavior is not implemented.

- ISS-046.1 | 2026-09-08 | working tree based on `f42f4a0` | source review only | probe arrival, restore/poll/save and preview reuse points inspected | findings recorded in the plan above | no runtime criteria verified.

No gameplay tests or live checks were performed during normalization or preview planning. Add records here and link them from the appropriate register row; add an evidence link alongside the feature verification date when applicable.

Record format: `ID | YYYY-MM-DD | baseline/commit | environment | criteria checked | commands/scenarios and results | evidence path/link | remaining gaps`. A source-review record must be labeled as such and cannot stand in for a required live behavior check.

## Tracker change log

- 2026-09-08 | ISS-046.2 scope change | User requested an in-game mock after inline visualization failed to display. Added sample three-planet/one-belt schematic behind ENABLE_PROBE_MAP_MOCK, larger clamped card and input interception. Full ISS-046.1 discovery work remains planned. Local type-check/lint/build and diff checks pass; Vite retains its existing sourcemapFileNames warning.

- 2026-09-08 | ISS-046.1 planning | Inspected probe arrival, discovery restore/poll/save, galaxy selection card and deterministic system generation. Added a scoped Enhanced Probe preview plan; implementation and runtime verification remain pending.

- 2026-09-08 | Documentation normalization | Added separate issue/feature IDs, consolidated all 46 issues, moved Voice Alerts to FEAT-022, registered unnumbered epics, added dependencies/acceptance/verification fields, and separated historical claims from verified completion. ISS-031 retains its successors; ISS-032 is consolidated into ISS-042. No gameplay status was newly verified; no release or human gameplay acceptance is asserted.

## Supporting design and historical notes

The following content preserves original implementation detail, rationale and release claims. It is **not a second status tracker**. Consult the registers above first. Reconcile stale code paths, timings and platform assumptions against current code when selecting a task. In particular, the old Help design predates shipped onboarding, analytics approval claims conflict, and the old startup deferral predates the current dynamic loader.

### Historical priority rationale

| # | Priority | Description | Why |
|---|----------|-------------|-----|
| 1 | **Journey Instrumentation (First 5 min)** | ✅ Complete for the core game journey: app/game readiness, first movement, first dock, and first resource are instrumented through the Devvit analytics path. Splash is a separate mini-game and is not part of this journey funnel. | Retention funnel instrumentation is in place for the playable game path. External Devvit allowlist/approval remains an account/platform check, not a code task. |
| 2 | **Help System (First 5 min)** | ✅ Complete for first-session onboarding: the guided flow teaches BUILD, station upgrade, skin selection, undock, navigation/docking, scan, and Help access. Broader optional topic guides remain tracked separately in ISS-039. | The first-session help requirement is satisfied; remaining tutorial work is advanced/topic-specific rather than blocking first 5 minutes. |
| 3 | **Testing (Unit & System)** | Expand test coverage: combat, alliance/DM, ship building, voice/sensors. CI confidence before next features. Playwright E2E framework operational (v1.4.32). | Prevents regressions as features stack. |
| 4 | **AI Probe (Autonomous Explorer)** | AI-controlled probe that travels star-to-star autonomously, exploring systems and refueling when it finds fuel. Reveals galaxy map without player input. | Adds passive exploration, makes galaxy feel alive, gives new players a head start on map knowledge. |
| 5 | **Expanding Star System** | Dynamically grow the galaxy when more players join and existing stars are all claimed. Add new star clusters connected to the existing graph. | Required for scaling — without this the game hits a hard player cap when all 100 stars are colonized. |
| 6 | **Backstory & Video COMS** | FEAT-019 / FEAT-020 lore integration + video communication system. | Differentiates the game, adds atmosphere. |
| 7 | **Finishing New Skins** | Skin framework implementation — station skins first (POC), then expand. | Visual variety, potential premium content. |

---

## Issue context

Original status wording and implementation notes are retained below for traceability; use the issue register for current status.

<a id="iss-001-notes"></a>

### ISS-001 — Boundary issue in solar tier — no need to scroll

**Historical report:** ✅ Fixed.

System view fits without scrolling.

<a id="iss-002-notes"></a>

### ISS-002 — Leaving solar→galaxy with bounds on loses bounds state

**Historical report:** ✅ Fixed.

Bounds state now persisted in localStorage. Survives tier changes and page reloads.

<a id="iss-003-notes"></a>

### ISS-003 — Galaxy view: separate ship nav from fleet movement picker

**Historical report:** ✅ Done.

Transfer mode with per-ship-type filtering (probes→undiscovered, colony→probed+unowned, freighter→owned+trade stations).

<a id="iss-004-notes"></a>

### ISS-004 — Star coloring not working — see red stars after visiting

**Historical report:** ✅ Fixed (v0.0.293).

Foreign stars now show red via `getGalaxyStarTone()` checking `owner === 'foreign'`.

<a id="iss-005-notes"></a>

### ISS-005 — Ship name editing blocked by steering keys

**Historical report:** ✅ Fixed (v0.0.257).

Mode flag added — keyboard input passes through when editing ship name.

<a id="iss-006-notes"></a>

### ISS-006 — iPad sizing

**Historical report:** ❌ Open.

Layout/canvas not adapting properly to iPad screen dimensions.

<a id="iss-007-notes"></a>

### ISS-007 — Pinch gesture conflicts with ship movement

**Historical report:** ❌ Open.

Pinch-to-zoom triggers ship movement instead of being handled as zoom. Need gesture disambiguation.

<a id="iss-008-notes"></a>

### ISS-008 — Galaxy fuel vs system fuel

**Historical report:** ✅ Done.

**→ FEAT-014 (Fuel as Commodity)** implemented — fuel is real resource, Refinery building, ownership-gated dock.

<a id="iss-009-notes"></a>

### ISS-009 — Extended discovery: belt items, planet items, multiple ores, Knowledge

**Historical report:** ⚠️ Partial.

Multi-color pods (6 types: refuel/dock/energy/ore/food/upgrade). Planet SCAN exploration (7 outcomes). Blueprint + anomaly finds. Full knowledge/multiple ore system still open.

<a id="iss-010-notes"></a>

### ISS-010 — Entry into solar tier dumps into belt

**Historical report:** ✅ Fixed.

`restorePosition` now places ship at system edge (dist 20) instead of center (dist 3).

<a id="iss-011-notes"></a>

### ISS-011 — Belt (Local tier) missing side controls

**Historical report:** ✅ Done.

Added `drawControlButtons` to Local tier render.

<a id="iss-012-notes"></a>

### ISS-012 — Ship docked voice repeats on fleet/galaxy view switch

**Historical report:** ✅ Fixed.

Dock state now saved/restored across temporary galaxy jumps for fleet panel.

<a id="iss-013-notes"></a>

### ISS-013 — COMPLETE button visible to all players

**Historical report:** ✅ Fixed.

COMPLETE button now gated behind `_isAdmin` flag.

<a id="iss-014-notes"></a>

### ISS-014 — Help/journey system not persisting across sessions

**Historical report:** ✅ Fixed.

Journey completion saved to localStorage.

<a id="iss-015-notes"></a>

### ISS-015 — Help/journey voice plays in system tier

**Historical report:** ✅ Fixed.

`updateJourney()` now gated to Planet tier only.

<a id="iss-016-notes"></a>

### ISS-016 — Probe not consumed after arrival

**Historical report:** ✅ Fixed.

Probes consumed on arrival, star marked as discovered. discoveredStars returned in FleetAllResponse.

<a id="iss-017-notes"></a>

### ISS-017 — COMS nested replies + loading state

**Historical report:** ✅ Fixed (v1.1.20).

Reddit comment threading support with depth display.

<a id="iss-018-notes"></a>

### ISS-018 — Layout overlapping (fleet ships, feature labels, player names)

**Historical report:** ✅ Fixed (v1.1.25).

Increased spacing constants across galaxy view.

<a id="iss-019-notes"></a>

### ISS-019 — Trading station ⚖ icon visible before discovery

**Historical report:** ✅ Fixed (v1.1.31).

Icon only shown after star is probed/visited.

<a id="iss-020-notes"></a>

### ISS-020 — Probe arrival not updating star to probed state

**Historical report:** ✅ Fixed (v1.1.29).

Server now returns discoveredStars in FleetAllResponse; client uses authoritative list.

<a id="iss-021-notes"></a>

### ISS-021 — REDDIT REVIEW: UGC reportability

**Historical report:** ✅ Fixed.

DM report button implemented. `POST /api/coms/dm/report` stores report in Redis + sends modmail to subreddit moderators with attribution.

<a id="iss-022-notes"></a>

### ISS-022 — REDDIT REVIEW: Admin endpoint security

**Historical report:** ✅ Fixed.

`requireDev` middleware in `src/server/core/admin-auth.ts` uses `reddit.getCurrentUsername()` (Devvit-authenticated). Applied to all admin/debug/bot routes. Client-side `ADMIN_USERS` retained for UI only.

<a id="iss-023-notes"></a>

### ISS-023 — Bot smooth presence (Level 2 patrol)

**Historical report:** ✅ Fixed.

Server-side time-based drift in `listRoomPoses()`. Bot visible at all tiers (Galaxy patrol, System/Planet arrive-linger-depart). NavigationTier.Planet=3 fix.

<a id="iss-024-notes"></a>

### ISS-024 — Font readability / dim text

**Historical report:** ⚠️ Partial (v1.4.58).

Minimum canvas font raised one step across `renderer.ts` — all 5px → 6px, all 6px → 7px (~80 call sites). Smallest text in the game is now 7px. Contrast pass still open (see ISS-028).

<a id="iss-025-notes"></a>

### ISS-025 — Undocking not discoverable

**Historical report:** ✅ Fixed (v1.4.54).

Coach step 4/7 rings the UNDOCK button with a callout. `undock()` also now picks a release heading with clear line-of-sight to the planet (`findClearReleaseDir()`) so players don't immediately re-dock at the starbase.

<a id="iss-026-notes"></a>

### ISS-026 — Tutorial mode (restartable)

**Historical report:** ⚠️ Onboarding complete; topic continuation open.

Seven-step onboarding is shipped: BUILD → STATION → skin → undock → fly/dock → scan → Help. It persists `coachStep` + `coachSkipped`; SKIP preserves resumable progress while GO PLAY completes it. Feedback waits until the coach ends. **Current post-scan flow (v1.4.76+):** Help is clean reading only; closing it shows congratulations; MORE TUTORIALS opens the Help Next hub; GO PLAY ends onboarding. **Do not restore the old in-Help Replay controls** — they caused conflicting UI. Remaining: named topic sequences / per-sequence progress / true sequence hub tracked in ISS-039.

<a id="iss-027-notes"></a>

### ISS-027 — Buildings not visible on star visit

**Historical report:** ❌ Open.

When visiting a star, buildings and station not rendering initially. May be a timing/load issue where economy data arrives after first render.

<a id="iss-028-notes"></a>

### ISS-028 — Text contrast too dim

**Historical report:** ❌ Open.

Some UI text (labels, descriptions) too dim against dark background. Need minimum contrast ratio pass across all panels.

<a id="iss-029-notes"></a>

### ISS-029 — Stuck in galaxy tier

**Historical report:** ✅ Fixed (v1.4.59).

Root cause: `_galaxyJumpReturnTier` (the breadcrumb back to your previous tier) was converted into an actual revert **only** by `togglePlanetPanel(3)`. `closeAllPanels()` and `closeFleetPanel()` both nulled it without queueing — and `closeAllPanels()` fires on any click outside a panel, which on the galaxy map means anywhere on the star field. Opening FLEET to send a ship then tapping the map stranded the player. Fixed with a shared `queueFleetRevert()` used by all three closers, plus an unconditional **◄ SYSTEM** escape-hatch button on the galaxy tier that returns to `currentStarIndex` regardless of panel state.

<a id="iss-030-notes"></a>

### ISS-030 — Refueling not intuitive

**Historical report:** ❌ Open.

Refueling process unclear. Should be covered in tutorial. Consider auto-refuel when docked at owned station, or prominent REFUEL button.

<a id="iss-031-notes"></a>

### ISS-031 — Docking at buildings (not just station)

**Historical report:** ⚠️ Superseded.

Docking mechanism now works for any feature type (ISS-037). Which structures to enable and what each does when visited is tracked in **ISS-038**.

<a id="iss-032-notes"></a>

### ISS-032 — Colonizing a star needs a better guide / simpler flow

**Historical report:** ❌ Open.

Colonization is currently too complex for players to infer: build Colony Ship → open FLEET → SEND the ship → choose an eligible highlighted star → wait for arrival → fly/visit that star → dock → press COLONIZE. We need either (A) simplify the flow, or (B) add a dedicated interactive colonization guide that walks each step with callouts, explains why only some stars are valid targets, confirms when the Colony Ship is in transit/arrived, and points directly at the final COLONIZE action. This should be treated as a must-have tutorial topic, not just help text.

<a id="iss-033-notes"></a>

### ISS-033 — Empire overview / management screen

**Historical report:** ❌ Open.

Need a "Manage My Empire" screen showing all owned stars, buildings, ships, resources, and routes in one place. Currently requires visiting each star individually.

<a id="iss-034-notes"></a>

### ISS-034 — External leaderboard publishing

**Historical report:** ❌ Open.

Need a way to publish the leaderboard outside the game — embeddable widget, public URL, or subreddit sidebar integration. Currently only visible in-game via COMS/BOARD tab.

<a id="iss-035-notes"></a>

### ISS-035 — Legacy journey hints — rescoped, not retired

**Historical report:** ✅ Repurposed (v1.4.57).

`ENABLE_JOURNEY_HINTS = true`. The old tab pulse / UNDOCK pulse / idle voice prompts now serve **only** players who have already seen the coach tutorial and have stalled without acting — `startJourney()` runs on the returning-player branch, `skipJourney()` on the new-player branch, so the two systems never overlap. UNDOCK pulse gated on `dock.docked`. The `?` icon also rings during the idle pulse to advertise the replay button.

<a id="iss-036-notes"></a>

### ISS-036 — Font scale picker in Settings (S/M/L)

**Historical report:** ⚠️ Stages 1–2 done (v1.4.60).

`src/game/font.ts` provides `f(size, weight?, family?)`, `getFontScale()`, `setFontScale()` (clamped 0.8–1.5, 6px floor). All 229 canvas font strings in `renderer.ts` and `game-loop.ts` converted; scale locked at 1.0. **Current UI = "Small" = 1.0, and Small must remain pixel-identical forever.**

**Root cause of the difficulty:** 250 `ctx.fillText` calls vs only **3** `measureText` calls — layout is assumed, never measured. Every width/offset is hand-tuned to the present font size.

**Impact inventory:** (A) font strings ×229 ✅ done; (B) module layout consts ×18 — `TAB_W/H/GAP`, `ROW_H`, `PANEL_PAD`, `PANEL_WIDTHS`, `MODE_BTN_W/H`, `CTRL_BTN_RADIUS`, `GZOOM_BTN_SIZE`, `SKIN_BTN_W/H`; (C) function-local layout consts ×~110; (D) **inline text offsets ×~101** (`ty + 16`, `by + 18`…) — the class that broke the tab labels, and ungreppable from other arithmetic; (E) hit-test rects, must scale identically to their draw rects or clicks misland; (F) HTML/CSS ×26 inline font decls across the 3 entrypoints — separate system; (G) `splash.ts` unconverted; (H) fixed containers that **cannot** grow (`TAB_W=28` strip, 57px extension buttons, orbit bar) — these need reflow, not scaling.

**Passes:** (1) ✅ **done v1.4.65** — `fontScale` on profile, S/M/L buttons in Settings, restored on load; `f()` short-circuits to identity at scale 1.0 so **Small can never drift** from the original layout; (2) ✅ **done v1.4.65** — `src/game/text-audit.ts` patches `fillText` and measures every draw against the panel being rendered (region registered in `drawPanelFrame`). Console: `__textAudit(true)`, open panels at Medium/Large, then `__textAudit()` for a report sorted by overflow px with call sites; (3) per-panel rollout, each independently shippable — STATUS first (already `ROW_H`-driven), BUILD last (fixed grid); (4) `--font-scale` CSS custom property for HTML, plus reflow rules for H-class containers (tab strip widens at L, extension grid 4→3 columns).

**⚠️ Medium/Large are currently font-only and WILL overflow** — they are shipped as a diagnostic surface for pass 3, not as a finished feature.

**Worked example (v1.4.62, reverted v1.4.64):** side-tab labels 7px → 9px fit the 48px tab height fine but collided with the icon — the rotated title draws at `ty + TAB_H/2 + 6`, an offset hand-tuned for 7px to clear the icon at `ty + 16`. Positioning offsets must scale too, not just widths and heights.

<a id="iss-037-notes"></a>

### ISS-037 — Feature docking + Space Dock refuel

**Historical report:** ⚠️ Partial (v1.4.63).

**Done:** dock detection now shares the renderer's merged static + server-built feature list via `setDockFeatureProvider()` (was iterating static `body.features` only, so built structures rendered but were never dock targets). Provider is used by detection, approach positioning, undock clearance and the line-of-sight release scan so `featureIndex` stays consistent. Docking restricted to `DOCKABLE_FEATURE_TYPES = { station, dock }` — all other built structures are deliberately **not** dockable pending a purpose for each (see ISS-031). `DockState.featureType` added so the orbit bar can vary its action set; at the Space Dock `⛽ REFUEL` replaces `SCAN`. Refuel fills to `FUEL_CAPACITY_BY_SHAPE` and debits star fuel via the existing `_pendingRefuel` path. **⚠️ NOT DONE — both currently client-side and bypassable:** (1) the 5-min cooldown lives in `game-loop.ts` as `_lastSpaceDockRefuelMs` and **resets on page reload** — must move to a server Redis key `refuel:{postId}:{user}` with TTL 300s, checked in a new `POST /api/refuel/dock`; (2) the **"until colony level" gate is not implemented at all** — refuel currently works no matter how many stars the player owns. Intended rule: available only while the player owns fewer than 2 stars, read from the `stars:{postId}` claims registry server-side.

<a id="iss-038-notes"></a>

### ISS-038 — Dockable structure purposes (per-feature actions)

**Historical report:** ❌ Open.

`DOCKABLE_FEATURE_TYPES` in `dock.ts` is the single gate — adding a type there makes it dockable immediately, so each needs its interaction designed first. Open questions recorded inline: `mine`/`mine_l2` → maintenance or yield boost?; `solar_array`/`solar_array_l2` → efficiency check?; `colony` (hab) → population/recruitment?; `warehouse` → cargo transfer?; `shield`/`cannon` → defence control?; `refinery` → fuel conversion?; `relay`/`outpost` → unused feature types, decide whether to keep. Supersedes the docking half of ISS-031.

<a id="iss-039-notes"></a>

### ISS-039 — Tutorial topics beyond onboarding

**Historical report:** ⚠️ Guides shipped; interactive sequences open.

**Shipped through v1.4.79:** post-scan handoff is now linear: step 7 callout sits **below** `?` with an upward arrow → opening Help pauses all canvas coach overlays → closing Help advances to the opaque congratulations card → **MORE TUTORIALS** opens clean Help/Next; **GO PLAY** completes onboarding. Help is documentation-only: the conflicting orange Tutorial/Continue/Replay/Reference controls were removed. `MORE TUTORIALS` now exposes usable guide links: **BUILD A SHIP** → Ships tab; **COMMS** → Guide/Comms section. Comms guide is deliberately read-only: PUBLIC/PRIVATE/ALLIANCE/BOARD explained; no player is required to send UGC. Build tree, ships, buildings, solar/belt are documentation (`doc`) topics, not coach sequences; solar/belt content is in Guide → *Navigating the Tiers* (Galaxy→System→Planet→Belt, entry rings, belt entry, ⊕ bounds, ◄ SYSTEM).

**Next infrastructure required for interactive topics:** (a) named sequences `{ id, title, steps[] }` — coach is still one linear `STEP_ORDER`; (b) per-sequence completion/progress (`coachDone: string[]` + `{ seqId, step }`) replacing single `coachStep`; (c) informational no-target steps — current overlay returns early without a target, so “tap anywhere to fly” needs a reusable centred card; (d) a real topic hub/modal for sequence launch/resume/replay, rather than using Help as a fake picker. **Important UX rule:** Help owns reading, coach owns guided action, congratulations owns the decision; never show them over one another.

**Interactive topic backlog:** Controls 4 steps M — `drawControlButtons` + card steps; Status 2 S; Ships 3 S — `_lastShipButtons`; Comms 5 M — `_comsTabButtons`, opening tabs only; Alliance management separate 4–5 M — `_allianceButtons`; Fleet/Galaxy 5 M — `_fleetMapButton`, `_fleetSendButtons`, `_galaxyModeBtn`, `_galaxyExitBtn`; Returning status 2 S — report badge; Settings/feedback 3 S — HTML buttons via `domButtonRect`.

**Bounds note:** ⊕ is `getCtrlBtnPositions().recenter`; it toggles bounds and recentres. v1.4.73 removed its old hidden side effect of stopping/cancelling the ship. Still consider splitting bounds onto its own control before writing Controls copy. **Order:** named-sequence infrastructure + Controls, then Status/Ships/Settings, then Comms, Fleet/Galaxy, Alliance.

<a id="iss-040-notes"></a>

### ISS-040 — Wire staged new sound pack into runtime audio map

**Historical report:** ❌ Open.

19 new voice/sfx files were moved out of runtime `public/sounds` into `assets/reference/source-audio/pending/` because they are not currently referenced by exact filename in source. Next pass: (1) pick canonical names, (2) move selected files back to `public/sounds`, (3) add mappings in `src/game/audio.ts`, (4) prune/replace near-duplicates (for example `Anomalous signal detected (2).wav` and `Warning hostile raider (1).wav`), (5) run a quick in-game audio smoke test.

<a id="iss-041-notes"></a>

### ISS-041 — Galaxy/System return can reset moving ship to home star

**Historical report:** ❌ Open.

Bug observed in the galaxy view/system transition flow: while the ship is moving through the galaxy, using the return/navigation path can snap the player ship back to the home star instead of preserving the in-progress galaxy position/target. Investigate `_savedDock`, `currentStarIndex`, `galaxy.tier` transitions, and any `◄ SYSTEM` / fleet-panel revert paths that reconstruct system state from home/current star rather than the ship's active galaxy location. Required fix: returning from galaxy/system views must preserve the ship's actual movement state and never teleport it home unless the player explicitly chooses home.

<a id="iss-042-notes"></a>

### ISS-042 — Colony expansion sequence and guided tutorial

**Historical report:** ❌ Open.

Treat expansion as a deliberate multi-step journey rather than a single `COLONIZE` action. **Recommended gates:** (1) Colony Ship construction requires either a Basic Probe in stock or at least one previously visited non-home star; this teaches scouting while preserving a direct-flight path for players who explore manually. (2) Sending a Colony Ship requires the destination to be an unowned star with discovery level `probed` or `visited`; the target picker should explain why other stars are unavailable. (3) On arrival, the colony ship remains staged at the destination and the player must travel there personally. (4) In the destination system, show the colony-ship marker beside its assigned planet; optionally require a planet scan to reveal/confirm that marker. (5) When the player enters the planet's local orbit, expose the `COLONIZE` action. (6) Server validates the ship, star, body, ownership, and arrival state before consuming the ship and claiming the star. **Tutorial lead-through:** `BUILD PROBE` → `SEND PROBE` or `VISIT A STAR` → `BUILD COLONY SHIP` → `OPEN FLEET / SEND` → select highlighted discovered star → wait for arrival → `VISIT DESTINATION` → identify/scan marked planet → orbit it → press `COLONIZE` → show confirmation and new-star setup. Use resumable checkpoints and contextual callouts; do not unlock the final button early. Add explicit transit/arrival states and recovery text for an occupied, invalidated, or already claimed target.

<a id="iss-043-notes"></a>

### ISS-043 — Splash command center

**Historical report:** ⚠️ Leaderboard shipped; tutorial pending.

Put the public leaderboard and a clear tutorial/help entry on the first splash screen before gameplay. The leaderboard should be read-only, compact, and responsive, with loading, empty, and unavailable states. Reuse the existing scoring endpoint rather than creating a second ranking system. Later add a tutorial entry that opens the existing Help documentation without auto-starting any guided sequence.

<a id="iss-044-notes"></a>

### ISS-044 — Player achievement badges

**Historical report:** ❌ Open.

Expose the existing Redis-backed achievement milestones as a player-facing earned/locked badge list. Add a `Badges` view to the Help/general information UI, with compact icon, title, unlock condition, and earned state for each achievement. Read the existing `achievements:{username}` records through a player-safe API; preserve the current server-side milestone triggers and Reddit achievement comments. Consider a future compact HUD badge counter only after the list is useful and tested.

<a id="iss-045-notes"></a>

### ISS-045 — Radar array and progressive sensor discovery

**Historical report:** ❌ Open.

Add a radar array that detects incoming probes and ships, identifies the sender when the signal is attributable, and creates in-game notifications. Radar should also control how much transit and foreign-location detail is visible rather than granting unrestricted map knowledge. Detailed design is in **FEAT-021** below.

<a id="iss-046-notes"></a>

### ISS-046 — Probe-level solar detail

**Historical report:** ❌ Open.

Basic and enhanced probe levels should reveal progressively more detail about planets and their features. A probe or personal visit should unlock solar-system detail on the galaxy map; planet scans remain a separate action for one-time exploration rewards, not the only way to see foreign buildings.

## FEAT-024 design — Daily return mechanics

### Daily Return Mechanics for the Splash Command Center

These mechanics extend ISS-043 beyond a static splash. Each should be:

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

## Playtest Feedback (2026-08-16)

Three playtesters (WeirdAd4511, LegitimateTree5933, Training-Item5275) over ~21 hours. Key themes:

1. **Discoverability:** How to undock, refuel, send ships, and colonize are all unclear without guidance.
2. **Visual clarity:** Font sizes, text contrast, and building visibility on star visits need improvement.
3. **Navigation:** Players get stuck in galaxy tier with no obvious way back.
4. **Depth desire:** Players wanted to dock at individual buildings and manage their whole empire from one screen.
5. **Tutorial is critical:** A restartable, sectioned tutorial covering the 10 most important actions is the ISS-001 UX priority.

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

<a id="feat-001-design"></a>

## FEAT-001 — Resources — Design notes

**What:** Three core resources — **Ore, Food, Energy** — stored per star. Atomics reserved/gated.

**Why first:** everything else (buildings, ships, trade) depends on resources being real and trackable.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| FEAT-001.1 | Resource schema | ✅ | `ResourceStore { ore, food, energy }` in shared/api.ts. `StarEconomyState` holds store, rates, cap per star. |
| FEAT-001.2 | Production rates | ✅ | `computeResourceRatesFromBuildings()` — base rate + bonus from mine/hab/solar levels. |
| FEAT-001.3 | Storage cap | ✅ | `computeResourceCapFromBuildings()` — base 1600 + 400/warehouse level. `clampStore()` enforces ceiling. |
| FEAT-001.4 | Server-side tick | ✅ | `tickStarEconomy()` applies `elapsedMin × rate` on load/action, persists `lastTickMs`. |
| FEAT-001.5 | Display | ✅ | STATUS panel shows `ORE: X/cap (+rate/m)` per resource. Star info legend in dock panel. |
| FEAT-001.6 | Tests | ✅ | `game-service.test.ts`: tick production, clamping, no backward tick. `economy-catalog.test.ts`: resource catalog. |

---

<a id="feat-002-design"></a>

## FEAT-002 — Buildings — Design notes

**What:** Per-star building slots with levels. Four production families: Ore, Food, Energy production + warehouses. Later: command centers, docks, defense, research.

**Why second:** buildings define production rates and unlock everything else. Nothing else works without them.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| FEAT-002.1 | Building schema | ✅ | `StarBuildingsState = Record<BuildType, StarBuildingState>` with level, status, completeAt. |
| FEAT-002.2 | Build catalog | ✅ | `BUILDING_CATALOG` — 6 types (station, mine, solar, hab, warehouse, dock) with maxLevel, duration, prereqs. |
| FEAT-002.3 | Prerequisite evaluator | ✅ | `isBuildUnlocked()` and `getUnlockedBuildTypes()` — checks prereq levels. Auto-sets LOCKED/READY. |
| FEAT-002.4 | Build cost calculator | ✅ | `getBuildingCost(type, level)` — station tiered cost, others scale linearly. |
| FEAT-002.5 | BuyBuilding command | ✅ | `POST /buildings/buy` → `startBuildingUpgrade()` — validates prereqs, resources, deducts cost, sets UPGRADING+completeAt. |
| FEAT-002.6 | UpgradeBuilding command | ✅ | `POST /buildings/upgrade` — same function, level increment automatic via `getBuildingTargetLevel`. |
| FEAT-002.7 | Build completion | ✅ | `reconcileStarBuildings(buildings, now)` — promotes UPGRADING→ACTIVE if `completeAt ≤ now`. |
| FEAT-002.8 | Build tree UI | ✅ | `drawBuildPanelBody()` — 3×2 grid with level, cost, progress %, LOCKED/BUILD/UPGRADE states, COMPLETE debug button. |
| FEAT-002.9 | Tests | ✅ | `buildings.test.ts`: initial state, tiered costs, reconciliation. `game-service.test.ts`: upgrade flow, rejection cases. |

**Initial buildings unlocked at colonization:** Ore Prod (lv1), Food Prod (lv1), Energy Prod (lv1), Space Dock T1 (lv1).

---

<a id="feat-003-design"></a>

## FEAT-003 — Ship Building — Design notes

**What:** Ships are built at a star via the Space Dock building. Each ship type has a cost, build time, and prerequisite building.

**Why third:** ships are the primary economic/military tool. Without buildable ships, the economy has no output.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| FEAT-003.1 | Ship type catalog | ✅ | `SHIP_CATALOG` — 12 ship types with id, name, speed, offense, defense, transport, cost, buildSeconds, dockTier/Level. `UPGRADE_PATH` for linear progression. |
| FEAT-003.2 | BuyShip command | ✅ | `POST /ships/buy` → `buyShip()` — validates dock level, resources, single-build-at-a-time, deducts cost. Also `POST /ships/upgrade` → `upgradeShip()` for path upgrades. |
| FEAT-003.3 | Ship completion | ✅ | `reconcileShipBuilding()` — on load, completes builds when `completeAt ≤ now`, adds to fleet. |
| FEAT-003.4 | Fleet assignment | ✅ | `POST /fleet/transfer` → `transferShips()` — creates `ShipTransit` with speed-based travel time. `loadAllFleet()` reconciles arrived transits. Fleet stored per-star. |
| FEAT-003.5 | Ship list UI | ✅ | `drawShipsPanelBody()` — available builds, upgrade section, build progress. `drawFleetPanelBody()` — galaxy/local views with SEND buttons, transit display, fleet badges on stars. |
| FEAT-003.6 | Tests | ⚠️ | No dedicated ship test file. `game-service.test.ts` covers buildings/economy but not `buyShip`, `upgradeShip`, `loadStarShips`, or `transferShips`. |

**Initial ship types available:** Scout (1), Freighter (2), Colony Ship (8), Basic Probe (11).

---

<a id="feat-004-design"></a>

## FEAT-004 — Star Colonization — Design notes

**What:** Send a Colony Ship (type 8) to a probed/visited unclaimed star, fly there, dock at station, and press COLONIZE to claim it.

**Why fourth:** colonization is the expansion loop. It creates new stars that generate resources, enabling further growth.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| FEAT-004.1 | Colonize endpoint | ✅ | `POST /api/colonize` — validates Colony Ship at star, consumes it, claims star, seeds economy (Station lv1 + Dock lv1 + starter resources). First-write-wins for race conditions. |
| FEAT-004.2 | COLONIZE button | ✅ | Pulsing green button above orbit bar when docked at unowned station with Colony Ship present. Hit-test sets `_pendingColonizeRequest`. |
| FEAT-004.3 | Colony Ship SEND filtering | ✅ | Selection circles only appear on probed/visited + non-player-owned stars (not all stars). |
| FEAT-004.4 | Probe SEND filtering | ✅ | Selection circles only appear on unvisited OR foreign-owned stars. |
| FEAT-004.5 | Colony Ship consumed | ✅ | Colony ship removed from fleet on successful colonization. |
| FEAT-004.6 | Visual update | ✅ | Colonized star immediately set to `owner: 'player'` in local game state → blue tint. BUILD/SHIPS tabs unlock. |
| FEAT-004.7 | Trading stations blocked | ✅ | `colonizeStar()` rejects trading station stars with error. |

---

<a id="feat-005-design"></a>

## FEAT-005 — Freighter Trade Routes & Trading Stations — Design notes

**What:** Freighters run persistent cargo loops between player-owned stars (automated trade routes). Trading stations are neutral stars (~5% of galaxy) where players exchange resources at dynamic rates.

**Why fifth:** cargo transport connects isolated economies — excess ore at one star can fuel building at another. Trading stations provide a resource exchange mechanism without requiring multiple colonies.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| FEAT-005.1 | Freighter route schema | ✅ | `FreighterRoute` with id, homeStar, targetStar, cargo, leg (outbound/return), departedAt, arrivalAt. Stored in `ships` profile field. |
| FEAT-005.2 | Assign route command | ✅ | `POST /api/fleet/freighter-route` — validates freighter at home star, creates persistent loop. |
| FEAT-005.3 | Cancel route command | ✅ | `DELETE /api/fleet/freighter-route` — returns freighter to home star. |
| FEAT-005.4 | Route reconciliation | ✅ | `loadAllFleet()` reconciles route legs: outbound→load cargo from target, return→deliver to home. Auto-relaunches. |
| FEAT-005.5 | Trading station selection | ✅ | Deterministic: hash(postId, starIndex) mod 20 === 0 → ~5% of stars. `shared/trading.ts`. |
| FEAT-005.6 | Trading station economy | ✅ | Each station has stock (ore/food/energy), restocks toward equilibrium (1000) at 10/min. `server/core/trading.ts`. |
| FEAT-005.7 | Exchange rates | ✅ | Dynamic: `rate = clamp(stationHasReceive / stationHasGive, 0.5, 2.0)`. Supply/demand pricing. |
| FEAT-005.8 | Trade execution | ✅ | `POST /api/trade-station/trade` — deducts from player's best star, updates station stock, returns received amount. Max 200/tx. |
| FEAT-005.9 | Trade UI | ✅ | STATUS panel becomes TRADE panel at trading stations: shows stock, 6 exchange rate buttons (TRADE 50 each). |
| FEAT-005.10 | Galaxy map icon | ✅ | Gold ⚖ icon above trading station stars (only visible after probed/visited). |
| FEAT-005.11 | Freighter target filtering | ✅ | Freighters can be sent to player-owned stars OR discovered trading stations. |
| FEAT-005.12 | Colonization block | ✅ | Trading stations cannot be colonized — server rejects with error. |
| FEAT-005.13 | Admin: Show Trade Stations | ✅ | Admin panel button lists all trading station names and indices. |
| FEAT-005.14 | Sound: first trade only | ✅ | Voice announcement plays only on first trade per session to avoid repetition. |

---

<a id="feat-006-design"></a>

## FEAT-006 — Ship Movement — Design notes

**What:** Ships and fleets move across the galaxy map between stars. Movement is time-based with server-stored start/target/ETA; client shows transit progress.

**Why sixth:** movement is the connective tissue for trade, colonization, and combat.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| FEAT-006.1 | Transfer command | ✅ | `POST /fleet/transfer` creates `ShipTransit` with speed-based travel time (`BASE_TRANSIT_SECONDS / speed`). |
| FEAT-006.2 | Transit reconciliation | ✅ | `loadAllFleet()` resolves arrived transits on every poll — delivers ships to destination star. |
| FEAT-006.3 | Transit display | ✅ | Fleet panel shows in-transit ships with progress indicator and ETA. Galaxy view shows transit lines. |
| FEAT-006.4 | Per-ship-type filtering | ✅ | Transfer mode shows valid targets based on ship type (probes→undiscovered, colony→probed+unowned, freighter→owned+trade). |
| FEAT-006.5 | Freighter routes | ✅ | Persistent automated loops (outbound/return legs) with cargo loading/unloading on arrival. |
| FEAT-006.6 | Client interpolation | ⏳ | No real-time position interpolation on galaxy map — ships jump on arrival. Cosmetic only. |

---

<a id="feat-007-design"></a>

## FEAT-007 — Currency and Commerce — Design notes

**What:** Two currencies: `gc_soft` (earned in-game) and `gp_premium` / `ship_points` (premium, purchased). Soft currency earned from production, trade, quests. Premium used for special ships/buffs.

### Sub-features
| # | Item | Detail |
|---|---|---|
| FEAT-007.1 | Currency schema | Player profile carries `{ gc_soft, gp_premium, ship_points }` balances. |
| FEAT-007.2 | Earn events | Quest rewards, resource sell, combat victories grant `gc_soft`. |
| FEAT-007.3 | Spend events | BuyShip (ship-points path), premium buffs, quick-build spend. |
| FEAT-007.4 | Premium buffs | Speed +15%, shield charge +10%, attack +10%, build speed +15% — each 60 min. |
| FEAT-007.5 | Currency HUD | Persistent display of all three balances in Galaxy/System/Planet HUD. |
| FEAT-007.6 | Idempotency | All grant/spend operations include an idempotency key to prevent double-spend. |
| FEAT-007.7 | Tests | Grant, spend, insufficient-funds rejection. Idempotent duplicate submission. |

---

<a id="feat-008-design"></a>

## FEAT-008 — Combat — Design notes

**What:** Ships attack enemy-owned stars and fleets. Combat uses the weapon effectiveness matrix. Outcome is deterministic on the server.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| FEAT-008.1 | Attack command | ❌ | `Deploy` command: ship/fleet targets enemy star or ship. |
| FEAT-008.2 | Damage resolution | ❌ | Server applies `weaponEffectiveness[attShipType][defShipType]` modifier, computes damage, updates HP. |
| FEAT-008.3 | Destruction | ❌ | Ship/fleet destroyed if HP reaches 0. Ownership transfer if star defense eliminated. |
| FEAT-008.4 | Combat event | ❌ | Event pushed to both players via mail/notification: attacker result, defender losses. |
| FEAT-008.5 | Ground defense | ❌ | Defense buildings (Starbase, Battle Station, Ground Defense) add passive defense values. |
| FEAT-008.6 | Shields | ✅ | `toggleShield` command activates planetary shield. Shield state stored per-star. |
| FEAT-008.7 | Raid routes | ✅ | `assignRaidRoute` sends ships on automated attack runs with cargo looting and risk-of-destruction. |
| FEAT-008.8 | Tests | ❌ | Attack outcomes by ship-type matchup. Effectiveness matrix application. Shield blocks attack. |

---

<a id="feat-009-design"></a>

## FEAT-009 — Discovery & Exploration — Design notes

**What:** Multi-layered discovery system: colored pods in belt/splash, planet exploration via SCAN, and knowledge/blueprint progression.

**Why:** Discovery creates the exploration incentive that balances against stay-at-home economy building. Players must physically visit planets to get one-shot rewards, creating a push/pull between exploring and producing.

### Sub-features

| # | Item | Status | Detail |
|---|---|---|---|
| FEAT-009.1 | Multi-color pods | ✅ | 6 pod types with weighted spawn: refuel (15%), dock (10%), energy (25%), ore (25%), food (20%), upgrade (5%). Colors: red, yellow, blue, orange, green, purple. |
| FEAT-009.2 | Planet SCAN | ✅ | SCAN button in orbit bar triggers `POST /api/explore`. One roll per planet per player (global seed, deterministic). Result popup (4s fade). |
| FEAT-009.3 | Discovery table | ✅ | 7 outcomes: nothing (35%), ore (18%), food (14%), energy (14%), artifact (10%), blueprint (6%), anomaly (3%). Resources credited to star economy. |
| FEAT-009.4 | Redis persistence | ✅ | `explored:{username}:{starIndex}:{bodyIndex}` — prevents re-rolls. Cached result returned on revisit. |
| FEAT-009.5 | Artifact collectibles | ❌ | Lore fragments tracked as collection. Achievement integration. |
| FEAT-009.6 | Blueprint effects | ❌ | Ship unlock/discount from blueprint finds. Actual gameplay impact. |
| FEAT-009.7 | Anomaly buffs | ⚠️ | Server grants & applies 5 buff types; client syncs & plays voice. HUD icons pending. |
| FEAT-009.8 | Multiple ore types | ❌ | Differentiated resources beyond ore/food/energy. Rare materials for high-tier builds. |
| FEAT-009.9 | Knowledge system | ❌ | Plans/blueprints that unlock build tree branches. Tech tree progression. |
| FEAT-009.10 | Quest chain (legacy) | ❌ | Linear quest progression (build → mine → launch → discover → colonize). Replaced by contextual hints. |

### Technical Notes

- **Shared module:** `src/shared/exploration.ts` — `rollDiscovery(galaxySeed, starIndex, bodyIndex)` pure function.
- **Pod generation:** `src/game/pods.ts` — weighted `pickPodKind()` using `POD_TYPES` from constants.
- **Server endpoint:** `POST /api/explore` — checks Redis for prior exploration, rolls discovery, grants resources, persists.
- **Determinism:** Same planet always gives same result for any player (global seed). Prevents "known loot spots" meta.
- **Balance:** Discovery rewards are modest (100-300 resources) — supplements economy, doesn't replace it. Exploring is profitable but slower than dedicated production.

---

<a id="feat-010-design"></a>

## FEAT-010 — Social: Mail and Alliances — Design notes

**What:** Player-to-player mail for coordination. Alliances for shared map visibility and combined attacks.

### Sub-features
| # | Item | Status | Detail |
|---|---|---|---|
| FEAT-010.1 | Direct Messages | ✅ | Full DM system: send/receive/unread tracking via COMS panel (private tab). |
| FEAT-010.2 | Public Comments | ✅ | Reddit comment threading: players post/reply on game thread from COMS panel (public tab). |
| FEAT-010.3 | Alliance creation | ✅ | `POST /api/alliance/create` — alphanumeric name, manager role assigned. |
| FEAT-010.4 | Join flow | ✅ | Invite via `POST /api/alliance/invite`, accept/decline via `/respond`. 24h invite expiry. |
| FEAT-010.5 | Alliance chat | ✅ | Real-time alliance chat via sorted set in Redis. COMS panel (alliance tab). |
| FEAT-010.6 | Alliance map visibility | ✅ | `loadAllFleet` merges all alliance members' discovered/enhanced stars into response. |
| FEAT-010.7 | Leaderboard | ✅ | Power-ranked leaderboard (stars×100 + ships×10 + buildings×25 + playtime). BOARD tab in COMS panel. |
| FEAT-010.8 | Alliance kick/leave | ✅ | Manager can kick members. Members can leave. Alliance deleted when empty. |
| FEAT-010.9 | Tests | ❌ | No dedicated alliance/DM test coverage. |

---

## Implementation Phases

| Phase | Features | Status | Goal |
|---|---|---|---|
| **P1** | FEAT-001 Resources, FEAT-002 Buildings | ✅ Complete | Stars produce resources. Players can build and upgrade. |
| **P2** | FEAT-003 Ship Building, FEAT-004 Colonization | ✅ Complete | Players build ships and expand to new stars. |
| **P3** | FEAT-005 Trade Routes + Trading Stations, FEAT-006 Movement | ✅ Complete | Freighter routes, trading stations, inter-star economy. |
| **P4** | FEAT-007 Currency, FEAT-008 Combat | ⚠️ Partial | 8: Shields + raid routes done. 7: Not started. |
| **P5** | FEAT-009 Discovery, FEAT-010 Social | ⚠️ Partial | 10: DMs, alliances, chat, shared map done. 9: Pods + SCAN done, blueprints/anomaly effects pending. |
| **P6** | FEAT-011 Sharing | ⚠️ Partial | Achievements, fleet POST, weekly leaderboard, public COMS done. |
| **P7** | FEAT-012 Help System | ❌ Planned | 5-layer progressive disclosure: idle hints, tab pulse, panel overlays, milestones, build path. Strategy documented in BUILD_TREE.md. |
| **P8** | FEAT-013 Automated Player | ✅ Phase 1–4 | FSM (DORMANT/ECONOMY/SHIPYARD/EXPLORE/ROAM/COLONIZE), scheduler cron, smooth presence (server drift), leaderboard exclusion, admin debug, fly-by. |

---

<a id="feat-011-design"></a>

## FEAT-011 — Sharing — Design notes

**What:** Voluntary share buttons let players post game moments to the subreddit as formatted comments or image cards, driving organic discovery.

**Why:** Reddit apps grow through subreddit engagement. Every share is a mini-ad that shows the game is active and interesting. Players sharing accomplishments creates social proof and FOMO.

### Sub-features

| # | Item | Status | Detail |
|---|---|---|---|
| FEAT-011.1 | Achievement auto-posts | ✅ | `achievements.ts` posts Reddit comments on milestones (first colony, colony 3/5/10, first ship, frigate/battleship/dreadnought upgrade, dock tier 2/3, first transfer). Redis-tracked, fires once per player. |
| FEAT-011.2 | Fleet share button | ✅ | Green "POST" button on fleet panel. `POST /api/share/fleet` posts formatted fleet summary as Reddit comment. 5-min cooldown (Redis TTL). Client shows "..." while on cooldown. |
| FEAT-011.3 | Weekly leaderboard | ✅ | Devvit scheduler cron job (`0 12 * * 1` = Mondays noon UTC). Posts top-10 markdown table as comment. Power score: stars×100 + ships×10 + buildings×25 + playtime/720. |
| FEAT-011.4 | Public COMS | ✅ | Players can post/reply on game thread directly from COMS panel (public tab). Full Reddit comment threading with depth display. |
| FEAT-011.5 | Share cooldown | ✅ | Server-side Redis TTL (300s per type per user). Client-side visual feedback. |
| FEAT-011.6 | Station share | ❌ | Share button on BUILD panel for upgrade announcements. |
| FEAT-011.7 | Discovery share | ❌ | Share button on galaxy view for star discovery cards. |
| FEAT-011.8 | Activity feed post | ❌ | Separate pinned post for activity (currently posts to game post). |
| FEAT-011.9 | Share card image (stretch) | ❌ | Server-side SVG→PNG visual cards. |

### Technical Notes

- **Devvit API access:** The server runs inside Devvit's context and has access to `reddit.submitComment()` for comment posting. The WebView client cannot call Reddit APIs directly — must go through the server.
- **Rate limiting:** Both client-side (disable button + timer) and server-side (Redis TTL check) to prevent abuse.
- **Message formatting:** Use Reddit markdown in comments. Ship names from `SHIP_CATALOG`, star names from galaxy seed, building levels from economy profile.
- **Privacy:** All shares are opt-in. No automatic posting (except achievements on milestones). Player must click the share button deliberately.
- **Spam prevention:** 1 share per type per 5 min. Server enforces via Redis TTL.
- **Scheduler:** `devvit.json` `scheduler.tasks.weekly-leaderboard` with cron. Active postId stored in Redis (`app:active_post_id`) for scheduler access without post context.

---

<a id="feat-013-design"></a>

## FEAT-013 — Automated Player (NPC Bot) — Design notes

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

<a id="feat-022-design"></a>

## FEAT-022 — Voice Alerts & Sensor System — Design notes

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

<a id="feat-012-design"></a>

## FEAT-012 — Help System — Design notes

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

<a id="feat-014-design"></a>

## FEAT-014 — Fuel as a Commodity — Design notes

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

<a id="feat-015-design"></a>

## FEAT-015 — Logged-Out Player Support — Design notes

**What:** Allow logged-out users to play the core game loop (splash, navigation, exploration), prompt login at natural breakpoints for progress saving/sharing, and migrate localStorage state on signup.

**Why:** Reddit has massive logged-out traffic via SEO/shared links. Every logged-out player who converts = subscriber + retention. Logged-out traffic does NOT count toward qualified engagement for Reddit Developer Funds, so conversion is critical.

### Sub-features

| # | Item | Status | Detail |
|---|---|---|---|
| FEAT-015.1 | Detect logged-out state | ❌ | Check `context.userId` presence. Route to limited experience if absent. |
| FEAT-015.2 | "Just play" session | ❌ | Allow splash mode gameplay (navigation, asteroid field) without login. No persistence. |
| FEAT-015.3 | Login prompt at breakpoints | ❌ | Use `showLoginPrompt()` from `@devvit/client` after first star visited, or on "save progress" attempt. Pair with value prop messaging. |
| FEAT-015.4 | localStorage state save | ❌ | Save game state (discovered stars, position) to localStorage keyed by postId for logged-out users. |
| FEAT-015.5 | State migration on login | ❌ | On app init with userId, read localStorage, migrate to Redis, clear local. |
| FEAT-015.6 | Share sheet integration | ❌ | Use `showShareSheet()` from `@devvit/web/client` with custom title/text. Attach deeplink data (challenge, invite code). |
| FEAT-015.7 | Share data reading | ❌ | Use `getShareData()` on page load to detect deeplinked invites/challenges. |
| FEAT-015.8 | Custom share preview image | ❌ | Use `media.upload()` + `setShareImageUrl()` for branded unfurl cards. |

### Technical Notes

- **showLoginPrompt()** reloads the page — only trigger at natural stopping points (after docking, results screen, not mid-flight).
- **localStorage resets** on new app version install — treat as best-effort, not reliable persistence.
- **Privacy:** Only collect data necessary for gameplay continuity. No profiling/personalization.
- **Analytics:** Dashboard distinguishes logged-in vs logged-out engagement. Track conversion rate.

---

<a id="feat-016-design"></a>

## FEAT-016 — Devvit Journeys Analytics — Design notes

**What:** Track player progression funnel via Devvit Journeys telemetry. Measures engagement, completion rates, and drop-off points.

**Why:** Required for understanding player retention and optimizing onboarding. Dashboard at developers.reddit.com shows funnel visualization.

### Sub-features

| # | Item | Status | Detail |
|---|---|---|---|
| FEAT-016.1 | Permission + package | ✅ | `devvit.json` has `"journeys": true`, `@devvit/analytics` v0.13.10 installed. |
| FEAT-016.2 | Server telemetry routes | ✅ | Hono routes at `/api/telemetry/journey/*` forward to `telemetry` plugin. |
| FEAT-016.3 | Client telemetry client | ✅ | `import { telemetry } from '@devvit/analytics/client/reddit'` with default basePath. |
| FEAT-016.4 | appReady event | ✅ | Fires on `startMultiplayer()`. |
| FEAT-016.5 | Journey lifecycle | ✅ | `startJourney()` for new AND returning players. `endJourney()` on colony/idle. |
| FEAT-016.6 | Progress events | ✅ | game_start, returned_player, first_move, first_dock, home_star_claimed, first_resource_collected, first_building, first_upgrade, first_ship_built, dock_upgraded, first_transfer, ship_upgraded, first_colony, star_discovered, alliance_joined, session_end. |
| FEAT-016.7 | Allowlisting | ❌ | App must be allowlisted by Devvit team for events to be recorded. Contact via Discord. Receipt returns `JOURNEY_RECEIPT_DENIED_NOT_ALLOWLISTED` until approved. |
| FEAT-016.8 | Receipt logging | ❌ | Log receipt status from server responses. Handle DENIED/RATE_LIMITED/DUPLICATE gracefully. |

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

<a id="feat-017-design"></a>

## FEAT-017 — AI-Assisted Development — Design notes

**What:** Devvit MCP server integration for AI-driven development workflow.

**Why:** Accelerates development via doc search (`devvit_search`) and live log debugging (`devvit_logs`).

### Sub-features

| # | Item | Status | Detail |
|---|---|---|---|
| FEAT-017.1 | MCP server setup | ✅ | `@devvit/mcp` available via npx. VS Code `.vscode/mcp.json` configured. |
| FEAT-017.2 | devvit_search | ✅ | Hybrid search over all Devvit docs from agent context. |
| FEAT-017.3 | devvit_logs | ⚠️ | Experimental: query app logs for a subreddit. Use "find a bug in my app deployed to valcordia_space_dev from the past week and fix it". |
| FEAT-017.4 | llms.txt context | ✅ | `https://developers.reddit.com/docs/llms.txt` for pre-prompt context. Full version at `llms-full.txt` for large-context models. |

### Notes

- Prefer `devvit_search` over pasting full docs to avoid context pollution.
- `devvit_logs` is experimental — works sometimes, shows glimpse of future AI debugging.
- React, ThreeJS, and Phaser have first-class MCP support with templates.

---

<a id="feat-018-design"></a>

## FEAT-018 — Settings & Secrets (Admin Configuration) — Design notes

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

<a id="feat-019-design"></a>

## FEAT-019 — Backstory & Lore — Design notes

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

<a id="feat-020-design"></a>

## FEAT-020 — Backstory Integration (10 Gameplay Enhancements) — Design notes

**What:** Bring the Luminari/Valcordian/Machine backstory (see BACKSTORY.md) directly into gameplay through existing and new systems.

### FEAT-020.1 — Luminari Artifact Discoveries ⬡ Not Started

**Ties to:** Exploration system, buff system

When players explore planets, rare rolls yield a "Luminari Artifact" — grants a powerful one-time buff. Add flavor text to exploration results: *"Your scanners detect an ancient Luminari energy node, dormant for millennia. Its resonance amplifies your hyperdrive."*

- Modify exploration outcome table to include `luminari_artifact` kind
- Map to existing buff grants (hyperdrive, resonance, etc.)
- Add lore text to explore result UI

### FEAT-020.2 — Valcordian Ruin Star Systems ⬡ Not Started

**Ties to:** Galaxy generation, autobot NPC

Mark 5-10 stars as "Valcordian Ruins" (distinct visual — orange glow or cracked icon). These stars have richer exploration rewards but the Autobot patrols them more aggressively, representing machines guarding old territory.

- Tag ruin stars at galaxy generation (deterministic from seed)
- Renderer: distinct star color/icon for ruin stars
- Exploration: higher reward weights at ruin stars
- Autobot: prioritize ruin stars in patrol routes

### FEAT-020.3 — Machine Raid Escalation ⬡ Not Started

**Ties to:** Autobot FSM, colony count, alliance system

As total player colonies grow, the Autobot becomes more aggressive (matches Act III). At 10 total colonies across all players, raids increase frequency. At 20, the Autobot targets the weakest colony. Creates natural pressure to form alliances.

- Track global colony count in Redis
- Autobot FSM: scale aggression by colony thresholds
- Notification system for escalation events

### FEAT-020.4 — Star Gate Network (Fast Travel) ⬡ Not Started

**Ties to:** Galaxy generation, jump links, fuel system

3-4 star pairs have "Luminari Star Gates" — zero fuel cost, instant travel time. Discoverable only via Enhanced Probes. Lore: *"A dormant Luminari gate activates as your probe approaches."*

- Galaxy generation: designate gate pairs (deterministic from seed)
- Probe discovery: reveal gate connections
- Transit system: zero cost/time for gate links
- Renderer: distinct visual for gate links

### FEAT-020.5 — Introductory Lore Crawl ⬡ Not Started

**Ties to:** Tutorial/journey system, splash screen

On first play, show a brief 3-sentence text crawl before gameplay: *"The Luminari are gone. The Valcordian machines remain. You are humanity's next chapter."* Dismissable with a tap, sets tone in 5 seconds.

- Add lore overlay to tutorial flow (before first undock)
- Fade-in/fade-out text animation
- Skip on tap, auto-advance after 5 seconds
- Only show once (track in profile)

### FEAT-020.6 — Codex Tab in Help Panel ⬡ Not Started

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

### FEAT-020.7 — Machine Stronghold End-Game Objective ⬡ Not Started

**Ties to:** Galaxy generation, alliance system, fleet combat

One star (fixed seed position) is a "Machine Stronghold" — visually distinct, cannot be colonized solo. Requires 3+ alliance members to each send a fleet simultaneously. Conquering it unlocks a unique achievement and permanent resource bonus for the alliance. Maps to Act IV.

- Designate one star as stronghold at generation
- Renderer: unique stronghold visual (red pulsing)
- Alliance fleet coordination mechanic
- Achievement + alliance-wide bonus on conquest
- Resets weekly or per-galaxy cycle

### FEAT-020.8 — Splinter Faction Event (Periodic) ⬡ Not Started

**Ties to:** Scheduler, community voting, buff system

Every 7 days, a timed event: "A splinter faction offers a truce with the machines." Players vote:
- **Accept** → temporary shield buff galaxy-wide (24h)
- **Reject** → raid damage bonus galaxy-wide (24h)

Majority vote wins. Creates a recurring community decision point from Act V.

- Scheduler: trigger event every 7 days
- Redis: store votes per player, tally at deadline
- Apply winning buff to all players for 24h
- Notification/UI for active event + result

### FEAT-020.9 — Reverse-Engineered Tech Unlocks ⬡ Not Started

**Ties to:** Building system, autobot raids, progression

After defeating 5 Autobot raids, players unlock a "Valcordian Tech" building slot — a unique structure outside the normal tree:
- **Machine Harvester** — doubles ore production rate
- **Automaton Shield** — immunity to one raid per day

Ties to "reverse-engineered Valcordian technology" from the lore.

- Track raid defeats per player in Redis
- New building type with special unlock condition
- Unique visual in dock panel (Valcordian aesthetic)

### FEAT-020.10 — Discovery Log Voice Lines ⬡ Not Started

**Ties to:** Audio system, exploration system

Replace generic exploration results with lore-flavored audio voice lines:
- *"Luminari energy signature detected... extracting."*
- *"Warning: Valcordian automaton debris. Salvageable components recovered."*
- *"Ancient star gate fragment found. Navigation data archived."*
- *"Machine patrol remnants detected. Proceed with caution."*

- Record new WAV files with narrative context
- Map exploration outcome kinds to specific voice lines
- Use existing audio system (SoundId + SOUND_FILES)

<a id="feat-021-design"></a>

## FEAT-021 — Radar, Progressive Probes & Foreign-System Intelligence — Design notes

**What:** Build a sensor network that makes movement observable and makes discovery depth depend on the quality of the probe or visit. Radar detects incoming probes and ships, while the galaxy map exposes the appropriate level of solar detail without turning every scan into complete intelligence.

**Why:** Players need a meaningful warning window when other players or NPCs approach their systems. Probe progression should also create a clear information ladder: unexplored, detected, probed, and visited should each answer more questions without requiring repetitive planet scans.

### Discovery and visibility rules

| Situation | Galaxy-map result | Solar-system / foreign-location result |
|---|---|---|
| Unexplored star | Star location and minimal identity only | No bodies, buildings, or resource detail |
| Basic Probe arrives | Star becomes **Probed**; basic solar layout is shown | Planet/body list and coarse planet data; no complete building intelligence |
| Enhanced Probe arrives | Star becomes **Probed+** (or equivalent higher discovery tier); richer solar detail is shown | More planet detail, feature categories, and selected building information |
| Player personally visits | Star becomes **Visited** and receives the highest normal map detail | Full solar layout and visible foreign buildings/features at the visited location; a planet scan is not required merely to render buildings |
| Planet SCAN | Adds the existing one-time exploration result and any scan-specific knowledge | Does not gate ordinary building visibility at a foreign location |

The exact names for the higher probe tier can follow the existing Basic Probe / Enhanced Probe catalog, but the information contract must be explicit and server-authoritative. “Foreign location” means a visited or otherwise revealed system/body owned by another player or faction; showing its buildings must not require claiming the star or completing a planet scan.

### Radar array

- Add a radar/sensor building or equivalent star capability with upgrade levels.
- Detect inbound probes, colony ships, raiders, freighters, and other ship transits before arrival when the route enters the radar coverage window.
- Report the target star, ship/probe type, estimated arrival window, and direction/source where available.
- Apply radar coverage and sensor quality to attribution: identify the sending player or faction when the signal is resolvable; otherwise report an unidentified contact rather than inventing an owner.
- Keep detection server-side and idempotent. Do not reveal hidden targets merely because the client requests a map or polls repeatedly.

### Notifications

Notifications should appear in the returning report, a compact radar/status indicator, and the existing sensor-alert delivery path where appropriate:

| Event | Notification content |
|---|---|
| Incoming probe detected | “Probe detected inbound to [star]. Type: Basic/Enhanced. Source: [player/faction]” |
| Incoming ship detected | “Incoming [ship type] to [star]. ETA: [window]. Source: [player/faction]” |
| Unattributed contact | “Unidentified contact detected near [star].” |
| Probe arrival | “A [probe level] from [player/faction] reached [star]; [detail tier] intelligence is now available.” |

Notifications must deduplicate the same transit, survive a page reload until acknowledged or expired, and avoid exposing the sender when radar confidence is insufficient. The owner of a probed star should be notified when radar can identify who launched the probe; the probe sender should receive an arrival/result report as well.

### Implementation slices

| Slice | Scope | Status |
|---|---|---|
| FEAT-021.1 | Sensor/radar building schema, levels, coverage and upgrade rules | ❌ |
| FEAT-021.2 | Transit detection for probes and ships, including pre-arrival alert timing | ❌ |
| FEAT-021.3 | Server-authoritative discovery detail tiers and galaxy-map solar summaries | ❌ |
| FEAT-021.4 | Foreign-location building visibility without mandatory planet scan | ❌ |
| FEAT-021.5 | Probe-level detail: Basic vs Enhanced (and future tiers) | ❌ |
| FEAT-021.6 | Attributed/unidentified sensor notifications and deduplication | ❌ |
| FEAT-021.7 | Tests for visibility permissions, radar coverage, attribution, reload persistence, and duplicate alerts | ❌ |

### Design constraints

- Radar detects movement; it does not automatically grant full system discovery.
- A probe reveals information according to its level, while a personal visit remains the strongest ordinary discovery action.
- Buildings at foreign locations are map/system intelligence and must be distinct from planet SCAN rewards.
- The server owns transit identity, discovery tier, attribution confidence, and notification state; the client only renders the returned contract.
- Alliance-shared discovery must not silently become alliance-shared live radar unless that capability is explicitly designed and permissioned.

### Priority Order (Suggested)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | FEAT-020.5 Lore Crawl | Low | Sets tone immediately |
| 2 | FEAT-020.1 Luminari Artifacts | Low | Builds on existing buff/explore |
| 3 | FEAT-020.10 Voice Lines | Medium | Adds atmosphere every session |
| 4 | FEAT-020.6 Codex Tab | Medium | Gives collectors a goal |
| 5 | FEAT-020.2 Ruin Stars | Medium | Visual variety + exploration |
| 6 | FEAT-020.4 Star Gates | Medium | Quality-of-life + lore |
| 7 | FEAT-020.3 Raid Escalation | Medium | Dynamic difficulty |
| 8 | FEAT-020.8 Splinter Event | High | Community engagement |
| 9 | FEAT-020.9 Reverse-Eng Tech | High | End-game depth |
| 10 | FEAT-020.7 Machine Stronghold | High | Alliance end-game |

---

## Future Consideration: Foreign Dock & Refuel

Design candidate related to FEAT-014; select and register a child task before implementation.

Docking at another player's space dock is visually possible but gameplay rules are undefined.

**Open questions:**
- Does refueling at a foreign dock consume their fuel stores?
- Should it cost a premium (e.g. 2× fuel rate) as an implicit trade?
- Does the dock owner need to opt-in (alliance only, open-to-all toggle, or always allowed)?
- Can a player access BUILD/SHIPS tabs at a foreign dock, or only REFUEL + TRADE?
- Should the dock owner receive a notification or earn resources from the visit?

**Options to evaluate:**
1. **Free refuel** — simple, encourages exploration, but removes fuel logistics pressure.
2. **Costs their fuel** — creates PvP tension; dock owner may not want visitors.
3. **Trade-based** — visitor pays ore/food/energy in exchange for fuel at a rate set by the dock owner or a fixed formula.
4. **Alliance-only** — refueling at allied docks is free or discounted; hostiles are blocked.
5. **Disabled** — foreign docks are view-only; only your own docks allow refuel.

**Implementation notes:**
- `/api/refuel` already validates star ownership; relaxing that check is the minimum change.
- If fuel is deducted from the owner, the server must load *their* economy profile.
- A dock-access permission flag on the star claim would support opt-in models.

---

## FEAT-026 design — First Reddit Exposure Checklist

Historical launch checklist: complete a fresh dated release review under FEAT-026 before treating any item as verified.

Everything needed before inviting the first real players from Reddit.

### 1. Subreddit & Post Setup

| Item | Status | Notes |
|------|--------|-------|
| Dedicated subreddit created (r/valcordia_space or similar) | ❌ | Public subreddit with game description, rules, and flair. |
| Subreddit banner and icon | ❌ | Use existing screenshots or generate from the game. |
| Welcome/rules post pinned | ❌ | Explain the game, how to play, how to report bugs. |
| First game post published | ❌ | The custom post that embeds the game. |
| Cross-post strategy decided | ❌ | Where to announce: r/WebGames, r/IndieGaming, r/incremental_games, r/reddit (Devvit showcase). |
| Devvit app review passed | ✅ | UGC reportability (ISS-021) and admin security (ISS-022) already resolved. |
| App published (not just uploaded) | ❌ | `devvit publish` to make it installable on the public subreddit. |

### 2. Analytics & Feedback Pipeline

| Item | Status | Notes |
|------|--------|-------|
| Devvit Journey analytics active | ✅ Done (FEAT-016) | Core funnel instrumented and firing in production. |
| Feedback panel accessible | ✅ | In-game feedback button with comment/bug text input. |
| Feedback data retrievable | ✅ | Admin can query `/api/admin/feedback` — verified with 4 entries. |
| Reddit comments enabled on game post | ❌ | Players should be able to comment on the post itself. |
| Modmail pipeline tested | ✅ | DM report button sends modmail (ISS-021). |
| Crash/error logging | ✅ | Client error capture (v1.4.147) — global errors, rejected promises, bracketed warnings posted to `/api/telemetry/error`. Admin query via `/api/telemetry/errors`. |
| Session duration / drop-off visibility | ✅ | Devvit Journeys dashboard shows funnel; player logs provide per-session detail. |

### 3. First 5 Minutes — Playability Gate

These must work smoothly for a brand-new player with no context.

| Item | Status | Notes |
|------|--------|-------|
| Game loads within 5 seconds | ⚠️ | Splash instant; full game first-load ~39s (JS bundle). Loading screen now shows during download (v1.4.148). Subsequent loads fast (cached). **Code-splitting option investigated:** lazy-load game engine after splash would cut time-to-first-visual to ~3–5s but carries **high risk** — game.ts has ~20 top-level side effects, Devvit context must bridge across the split, and the refactor touches every init path. Estimated 4–5 hours with significant regression risk. **Deferred** until after first Reddit exposure; current loading screen is acceptable for launch. |
| Onboarding tutorial completes without confusion | ✅ | 7-step coach shipped (ISS-026). Undocking (ISS-025) and refueling (ISS-030) addressed in coach flow. |
| Player can BUILD their first structure | ✅ | Coach step covers this. |
| Player can UNDOCK and fly | ✅ | Coach step with callout (ISS-025). |
| Player can SCAN a planet | ✅ | Coach step covers this. |
| Player can REFUEL | ⚠️ | Refuel at Space Dock works (ISS-037) but not intuitive (ISS-030). Needs coach callout or auto-refuel. |
| Help panel is discoverable | ✅ | Coach points to `?` button. |
| No dead-end states in first session | ⚠️ | Stuck-in-galaxy fixed (ISS-029), but fuel-empty-at-foreign-star recovery needs testing. |
| Voice/audio works on first interaction | ✅ | AudioContext resumed on first tap. |
| Mobile (Reddit app) layout fits | ⚠️ | iPad sizing (ISS-006) and pinch conflicts (ISS-007) still open. |

### 4. Colonization Flow — Must Be Clear

The path from first star to second star is the core mid-game loop. Playtest feedback (ISS-032, ISS-042) confirms this is too opaque.

| Step | Current State | Required for Launch |
|------|--------------|-------------------|
| Know you need a Colony Ship | ❌ Not taught | Add coach callout or status panel hint after station reaches LV2+. |
| Build a Colony Ship | ✅ Works | Ships tab, requires shipyard. |
| Send the Colony Ship (FLEET tab) | ⚠️ Works but confusing | Highlight eligible stars; explain why others are greyed out. |
| Wait for arrival | ✅ Works | Transit timer visible in Fleet panel. |
| Visit the destination star | ⚠️ No guidance | Player must know to fly there after arrival. Needs a notification or callout. |
| Dock and press COLONIZE | ⚠️ Works but not prompted | Show COLONIZE action prominently when colony ship has arrived. |
| **Interactive colonization tutorial** | ❌ Not started (ISS-042) | Guided multi-step sequence with resumable checkpoints. |

### 5. Known Bugs to Fix Before Launch

| ID | Bug | Severity | Status authority |
|---|-----|----------|-----|
| ISS-006 | iPad sizing | Medium | Issue register |
| ISS-007 | Pinch gesture conflicts | Medium | Issue register |
| ISS-027 | Buildings not visible on star visit | High | Issue register |
| ISS-028 | Text contrast too dim | Medium | Issue register |
| ISS-030 | Refueling not intuitive | High | Issue register |
| ISS-041 | Galaxy/System return resets moving ship | High | Issue register |

### 6. Content & Polish

| Item | Status | Notes |
|------|--------|-------|
| Introductory lore crawl | ❌ (FEAT-020.5) | Sets tone on first load. Low effort, high impact. |
| What's New section in STATUS overlay | ✅ | Shows recent changes to returning players. |
| Splash screen tune-up | ❌ | First impression for new players. Needs: clear game title/tagline, polished layout, responsive sizing, "How to Play" or quick-start hint, smooth transition into game. Review asteroid mini-game speed/difficulty, leaderboard placement, button styling, and overall visual consistency with the in-game UI. |
| Leaderboard visible on splash | ⚠️ (ISS-043) | Shipped but tutorial entry pending. |
| Bot players active for a living galaxy | ⚠️ (FEAT-013) | Bot exists but needs tuning for believable presence. |
| Sound volume / mute easily accessible | ✅ | Settings panel has mute toggle. |
| Screenshot-worthy moments | ❌ | Consider a screenshot/share button for social proof. |

### 7. Deployment & Operations

| Item | Status | Notes |
|------|--------|-------|
| Production subreddit uses `devvit publish` (not `devvit upload`) | ❌ | Upload is dev-only; publish makes it installable. |
| Redis data backup/export plan | ❌ | No built-in backup for Devvit Redis. Consider periodic export via admin endpoint. |
| Rate limiting on public endpoints | ⚠️ | Devvit handles some; verify no abuse vectors on `/api/explore`, `/api/trade-station/trade`. |
| Error handling for Redis outages | ⚠️ | Most endpoints catch errors; test graceful degradation. |
| Version rollback plan | ❌ | Document how to revert if a deploy breaks production. |

### 8. Launch Day Checklist

1. Final playtest on production subreddit (not dev).
2. Verify analytics events firing in Devvit dashboard.
3. Pin a welcome post with instructions and known limitations.
4. Cross-post announcement to 2–3 relevant subreddits.
5. Monitor feedback panel submissions and modmail for first 24 hours.
6. Have a hotfix deploy ready (keep a terminal with the repo open).
7. Check leaderboard is populating correctly with real players.
8. Respond to early Reddit comments within the first few hours.

---

## Future Consideration: Moderator-Based Admin Commands

Design candidate related to FEAT-018; select and register a child task before implementation.

Currently admin access is hardcoded in `src/server/core/admin-auth.ts`. A future improvement could tie admin commands to the subreddit's moderator list using `reddit.getModerators()`. This would allow adding/removing admins via Reddit's mod panel instead of redeploying.

**Approach:** Hybrid — subreddit mods get general admin access (game management, leaderboard resets), while a hardcoded "superadmin" list stays locked for destructive operations (data wipes, debug endpoints). Cache the mod list in memory with a 5-minute TTL to avoid extra API calls per request.
