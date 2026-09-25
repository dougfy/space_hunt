# Attack Plan II — Valcordia Space Release Roadmap

**Source:** `attack_plan.md`, `colonize-tutorial.md`, `quest-items.md`, and the current `spacehunt` codebase.

**Purpose:** Convert the incomplete backlog into a release sequence that gets a clear, playable first five minutes into players' hands, gives them reasons to return, then expands the game into a durable colony and community system.

**Scope rule:** This document carries forward only work that was incomplete, partial, planned, or still operationally required in the source plan. Completed items are intentionally excluded.

---

## Release Model

| Phase | Release promise | Exit condition |
|---|---|---|
| **1. Ready to Release** | A new player can understand, control, and trust the first five minutes. | A first-time player can move, dock, scan, refuel, understand the UI, and recover from navigation transitions on desktop, mobile, and iPad. |
| **2. Return Quests** | The game gives players seven reasons to come back and complete a meaningful short mission. | Seven server-authoritative quests are playable, resumable, visible from the splash/return surface, and tested end to end. |
| **3. Colonization and Community** | Players build an empire, interact with other players, and see the beginnings of a living community. | Colonization is guided and reliable; social activity, cooperation, progression, and public community surfaces work together. |
| **4. Larger Capabilities** | The galaxy becomes deeper, more strategic, more social, and more scalable. | Remaining combat, economy, sensors, lore, logged-out, automation, accessibility, and scale capabilities are shipped behind tested vertical slices. |

### Rules for Every Phase

- Ship vertical slices, not disconnected frameworks.
- Keep server-authoritative state for anything affecting rewards, ownership, timers, quests, or public results.
- Preserve the current Small font/layout behavior while adding accessibility improvements.
- Every player-facing feature needs a readable empty, loading, success, failure, and retry state.
- Every release candidate needs a focused automated test and a real playtest path.
- Do not add tutorial overlays on top of Help reading surfaces; guided action belongs to the coach, reading belongs to Help, and completion belongs to a separate confirmation card.

---

# Phase 1 — Ready to Release

**Goal:** Make the first five minutes reliable enough for a public release. This phase is about comprehension and recovery, not adding more systems.

## 1.1 First-Five-Minute Blockers

| Source item | Work | Acceptance criteria |
|---|---|---|
| #6 | ✅ Closed: iPad sizing. | Verified working across the supported iPad layouts. |
| #7 | ⏸ Deferred: pinch gesture handling. | Not required for the current release scope; retain as a later interaction enhancement if touch zoom returns. |
| #27 | ✅ Closed: building visibility. | Considered fixed; retain a regression smoke test when economy/rendering code changes. |
| #28 | ✅ Closed: text contrast. | Current UI contrast is acceptable for release; revisit only with a visual regression or accessibility audit. |
| #30 | ✅ Covered: refueling discoverability. | Current tutorial/help and dock flow cover refueling sufficiently for launch. |
| #41 | ❌ Open: preserve return location. | On return from Galaxy/System or a temporary panel, restore the ship to the same tier, star/body, dock state, movement state, and location it occupied before the transition. Do not default to Home or merely preserve the selected star. |
| #37 | ✅ Closed: Feature docking and Space Dock refuel. | Close the partial item for this roadmap; retain server-side behavior as regression coverage. |

## 1.2 Release-Quality Test Coverage

| Source item | Work | Acceptance criteria |
|---|---|---|
| #3.6 | Add dedicated ship service tests. | `buyShip`, `upgradeShip`, `loadStarShips`, and `transferShips` have success, rejection, idempotency, and persistence coverage. |
| #10.9 | Add alliance and DM tests. | Send, receive, report, unread, alliance membership, and failure paths have service-level tests. |
| #15 | Complete voice/sensor integration testing. | Shield, DM, alliance, raider, bot, self-alert suppression, alert caps, and shield-charge scenarios pass in a repeatable test harness. |
| #40 | Wire the staged sound pack. | Canonical names, runtime mappings, duplicate cleanup, and an in-game smoke test are complete. |
| #24 partial | Complete the remaining font-scale rollout only where it does not alter Small. | Medium/Large reflow, hit testing, HTML/CSS scaling, splash scaling, and fixed-container reflow are tested. Small remains pixel-identical. |

### #41 Implementation Plan — Returning Player State

**Problem:** `lastPosition` currently stores only `starIndex`, `tier`, and `bodyIndex`. `restorePosition()` then reconstructs a canonical position, clears the dock, and may auto-dock at a station. Inline splash-to-play also skips restoring Local tier because Local is treated as the splash default. This causes returning players to appear in a different tier, at a different location, or docked when they were flying.

#### 1. Define a persisted return snapshot

Extend the shared `lastPosition` contract in `src/shared/api.ts` with a versioned, optional snapshot. Keep old profiles readable.

```ts
type SavedShipState = {
	schemaVersion: 1;
	starIndex: number;
	tier: NavigationTier;
	bodyIndex: number;
	shipPos: Vec2;
	shipVel: Vec2;
	shipAngle: number;
	targetPos: Vec2;
	targetActive: boolean;
	dock: DockState | null;
	galaxyCamPos: Vec2;
	galaxyZoom: number;
};
```

Rules:

- Persist `currentStarIndex` and `bodyIndex` as the logical location.
- Preserve `-1` for Galaxy view rather than silently replacing it with Home; keep a separate `fallbackStarIndex` for legacy restore and validation.
- Save `shipPos`, `shipVel`, `shipAngle`, and target state so a moving ship does not jump to a canonical spawn point.
- Save `dock` exactly, including `targetType`, `featureIndex`, `featureType`, and `approachTimer`.
- Save galaxy camera position/zoom separately; camera state must not be confused with ship position.
- Store only finite, bounded numbers. Reject malformed or out-of-range snapshots and fall back to the safe canonical restore path.

#### 2. Capture state at the right times

Update `savePositionIfChanged()` in `src/client/game.ts`:

- Serialize the full snapshot, not just the three current fields.
- Include dock changes in the dirty comparison, including dock start, completed docking, undock, and dock target changes.
- Save on the existing interval and `pagehide`, but also save immediately before intentional transitions that can unload or replace the view.
- Keep the last-write guard/session identity so a stale page cannot overwrite a newer session's position.
- Do not save splash-preview state as the player's real return state unless a profile restore has already been applied.
- Save after a successful server response only for bookkeeping; do not mark a failed request as durable.

#### 3. Restore by tier without inventing state

Change `restorePosition()` in `src/game/game-loop.ts` to accept the snapshot (with legacy arguments supported temporarily).

| Tier | Restore behavior |
|---|---|
| Galaxy | Set Galaxy tier, restore camera position/zoom, restore the ship snapshot if valid, and keep `dock = null`. |
| System | Generate the saved star system, set the saved star/body context, restore exact ship position/heading/velocity, and keep `dock = null`. |
| Local | Generate the saved ring/pods, restore exact ship position/heading/velocity, and keep `dock = null` unless the snapshot explicitly contains a valid local dock state. |
| Planet | Generate the saved body, restore exact ship position/heading/velocity, then restore the saved dock only if its body/feature still exists and the saved state says `docked: true`. Never auto-dock merely because a station exists. |

For an invalid or missing snapshot, use the existing canonical fallback and log the reason. A legacy `{starIndex, tier, bodyIndex}` profile should restore tier/body but remain explicitly marked as having no dock snapshot; it must not be treated as docked by default.

#### 4. Fix inline and expanded sequencing

- Expanded mode: load the profile snapshot before `startMultiplayer()`, restore it during splash initialization, then carry the complete state through `bridge.beginPlay()`.
- Inline mode: remove the `savedTier !== NavigationTier.Local` exclusion in `src/game/bridge.ts`. Local is a real saved tier; distinguish it from an untouched splash by an explicit `hasRestoredProfileState` flag, not by tier value.
- During splash-to-play replacement, capture and reapply the complete snapshot, including dock and camera state, rather than only star ownership/discovery.
- Idle-timeout return must follow the same restore path as a normal reload and must not reset to Home or auto-dock.
- Clear the one-time restore marker after the real game starts so later transitions do not repeatedly apply stale profile state.

#### 5. Validate dock references after regeneration

Generated bodies/features can change shape or ordering, so validate saved dock references before applying them:

- `bodyIndex` exists and matches the saved body.
- `featureIndex` exists and matches `featureType`/stable feature identity.
- `targetType` is valid for the current tier.
- The ship is within a reasonable distance of the saved dock target; otherwise restore the ship position and clear only the invalid dock.
- If a dock target disappeared, return the player undocked at the saved ship position and show a recoverable status message.

#### 6. Tests and telemetry

Add focused tests for:

- Round-trip save/restore in Galaxy, System, Local, and Planet tiers.
- Docked Planet restore versus undocked Planet restore.
- Feature dock restore and invalid/missing feature fallback.
- Moving ship restore with position, velocity, heading, and active target.
- Inline splash-to-play restoration for Local and Planet tiers.
- Expanded startup restoration and idle-timeout restoration.
- Legacy three-field profile compatibility.
- Stale save/session ordering and failed-save retry behavior.

Add temporary structured diagnostics:

```text
[RESTORE] source=profile tier=Local star=... body=... docked=false exactPosition=true
[RESTORE] fallback reason=invalid-dock-feature feature=...
[SAVE] snapshot schema=1 tier=Planet star=... body=... docked=true
```

#### #41 Acceptance Criteria

- Returning players resume in the same tier for all four navigation tiers.
- Returning players resume at the saved location within a small tolerance, not a canonical spawn point.
- Docked players return docked to the same valid target.
- Undocked players return undocked, even when a station exists on the body.
- Inline, expanded, normal reload, and idle-timeout return use the same restore semantics.
- Legacy profiles remain playable and are never silently forced into a docked state.
- Save/restore behavior is covered by automated tests and a browser smoke test.

## 1.3 Public Launch Operations

These are release work items, not future feature work:

- ✅ Confirm the approved Devvit app version 1.5.2 is installed in `r/valcordia_space`; the newer splash-fix build is held for the next release batch.
- ✅ Keep the public launch announcement and How-to post visible and easy to find. Verified publicly on 2026-09-21: both posts are visible in the community feed, and the game post is playable.
- ⏳ Pin the launch/game post and the How-to post in the community; public Reddit view does not expose pin state, so verify this directly in Reddit Mod Tools.
- ⚠️ Verify the public subreddit banner and icon in Reddit Mod Tools; public About view confirms the community description, public visibility, rules, and welcome copy but does not expose banner/icon configuration.
- ✅ A newer build with splash-screen fixes is ready; hold it for the next release batch rather than reopening review before launch unless a launch blocker is found.
- Define a Redis backup/export procedure before public growth.
- Define a rollback procedure for app versions and post assets.
- Add a short release checklist covering build, type-check, lint, tests, upload, install, fresh-post cache verification, and browser smoke test.

## Phase 1 Exit Checklist

- [ ] A new player reaches first movement without confusion.
- [ ] A new player reaches first dock and first scan without a dead end.
- [ ] Refueling is understandable and cannot be bypassed.
- [ ] Galaxy/system navigation preserves position.
- [ ] Desktop, phone, and iPad layouts are usable.
- [ ] No critical first-five-minute issue remains open.
- [ ] Focused tests and a real-device smoke test pass.
- [ ] Public launch and rollback operations are documented and tested.

---

# Phase 2 — Seven Return Quests

**Goal:** Turn daily return behavior into a coherent quest loop. The player should see what happened, choose what to do, and receive a meaningful result without needing to guess where the content lives.

All quests must be server-authoritative, generated at most once per UTC day, resumable after reload, visible from the return/splash surface, and represented in the player's history. Quests should use the existing inventory, economy, fleet, exploration, and community systems instead of creating parallel state models.

## The Seven Quests

### Quest 1 — Air Purifier Failure

**Source:** Air Purifier Event, `quest-items.md`.

- A starbase purifier degrades or fails.
- The player must recover, trade for, receive, or otherwise obtain a replacement unit.
- The affected star shows the condition and the return surface shows the target.
- Resolve through exploration, trade purchase, freighter transfer, or alliance help.
- Keep the daily roll, stale-marker invalidation, prior-day terminal handling, and affected-star targeting explicit.

### Quest 2 — Daily Probe Report

**Source:** Daily Return Mechanics, ★★★★★.

- A probe returns with an unknown signature, discovered star, transit report, or resource lead.
- The player chooses whether to follow the report.
- Reuse existing fleet and returning-report data.

### Quest 3 — Command Directive

**Source:** Daily Return Mechanics, ★★★★★.

- Present three short directives: Explore, Mine, or Military.
- The player selects one and receives a target, timer, or measurable objective.
- The choice affects the day's rewards or available opportunities.

### Quest 4 — Daily Anomaly

**Source:** Daily Return Mechanics, ★★★★★.

- Spawn a temporary relic, derelict, signal, comet, or anomaly at a discoverable location.
- The opportunity expires at the end of the UTC day.
- Use the existing anomaly/buff path, with visible state and a clear reward preview.

### Quest 5 — Automaton Threat

**Source:** Daily Return Mechanics, ★★★★☆; Feature 20.3.

- Automatons approach one of the player's systems.
- The player must scout, defend, redirect, or accept a loss.
- Begin with a readable event and a deterministic resolution before adding full combat complexity.

### Quest 6 — Shared Challenge

**Source:** Daily Return Mechanics, ★★★★★.

- Every player receives the same mission or target system for the day.
- Show personal progress and community-wide progress.
- Make the challenge useful even for players with different empire sizes.

### Quest 7 — Research Choice

**Source:** Daily Return Mechanics, ★★★★☆.

- Offer a choice of temporary research focus for the next 24 hours.
- Start with a small, testable effect: exploration, production, defense, or construction.
- Persist the choice server-side and show remaining duration on return.

## Quest Platform Work

| Workstream | Required work |
|---|---|
| Item Model | Stabilize `ItemId`, catalog entries, stackability, transfer rules, and ownership boundaries. |
| Inventory | Start with profile inventory, then support star-local and in-transit locations required by quests. |
| Exploration Integration | Give artifact results stable item identity and deterministic one-shot behavior. |
| Quest State | Add a common quest record with id, day, state, objective, progress, deadline, reward, and resolution path. |
| Return Surface | Show new, active, complete, failed, and expired quest states without unsolicited tutorial flashing. |
| Quest History | Preserve a compact completed/failed history for the player and return report. |
| Test Harness | Test generation, idempotency, reload/resume, expiration, reward delivery, and invalid requests. |

## Phase 2 Exit Checklist

- [ ] All seven quests can be generated and resumed.
- [ ] Each quest has a visible objective and a clear completion condition.
- [ ] Rewards are server-authoritative and idempotent.
- [ ] Daily generation cannot be blocked by stale roll or terminal state from a prior day.
- [ ] At least one quest uses exploration, one uses economy/trade, one uses fleet movement, and one uses community progress.
- [ ] Players have a meaningful reason to return for at least seven consecutive days.

---

# Phase 3 — Colonization and Community

**Goal:** Make the first major expansion feel like a guided achievement, then give players enough shared identity and interaction to form a community around their galaxies.

## 3.1 Colonization Journey

| Source item | Work | Acceptance criteria |
|---|---|---|
| #32 | ✅ Complete: guided colonization topic. | The game explains eligible stars, probe-first order, Colony Ship transit, personal travel, orbit, and final COLONIZE action. |
| #42 | ✅ Complete: resumable colony expansion checkpoints. | The intended probe → Colony Ship → fleet transit → personal travel → orbit → COLONIZE flow is implemented and guided. |
| #39 | ✅ Complete: interactive topic sequences. | Named sequences, progress/resume behavior, informational cards, and the topic hub are in place. |
| #12.1–12.5 | ✅ Closed: progressive help system. | Idle hints, tab pulses, overlays, milestones, and build-path guidance are sufficient for the current release. |
| #12.6 | Add player ranks. | Cadet-to-Fleet-Admiral progression appears in Status, Comms, and leaderboard surfaces, with tested milestone transitions. |

## 3.2 Social and Community Features

| Source item | Work | Acceptance criteria |
|---|---|---|
| #11.6 | Station share button. | Players can publish a readable station upgrade announcement without leaving the intended game flow. |
| #11.7 | Discovery share button. | Players can share a discovery card with star identity and useful context. |
| #11.8 | Activity feed post. | Public activity is separated from the game post and has clear attribution and moderation behavior. |
| #11.9 | Share card image. | Add server-generated visual cards only after text sharing is reliable; include fallback text. |
| #13.5 | Bot CHATTER state and Comms integration. | Bots respond to mentions with rate limits, never initiate unsolicited messages, and are clearly distinguishable from players. |
| #10.9 | Alliance/DM test coverage. | Social interactions have service and UI regression coverage before wider community rollout. |
| #44 | Player achievement badges. | Earned and locked badges are visible in a player-safe list with stable unlock conditions. |
| #33 | Empire overview. | A Manage My Empire view summarizes owned stars, buildings, ships, resources, and routes. |
| #34 | External leaderboard publishing. | A public leaderboard surface exists outside the game post and is updated from the existing ranking data. |

## 3.3 Community Return Loop

Promote the Phase 2 quests from private daily tasks into community identity:

- Shared Challenge becomes a visible subreddit-wide progress bar.
- Automaton Threat can become a cooperative defense event.
- Daily Reddit Dispatch announces the current situation.
- Activity feed records colonizations, discoveries, upgrades, and major quest outcomes.
- Badges and ranks give players visible long-term status.
- Alliances, Comms, and bot chatter provide lightweight social presence without requiring constant real-time chat.

## Phase 3 Exit Checklist

- [ ] A first colonization can be completed without external instructions.
- [ ] A returning player can resume any colonization checkpoint.
- [ ] Players can share a discovery and a station milestone.
- [ ] The community has a public activity/leaderboard surface.
- [ ] Badges, ranks, and empire overview give players persistent identity.
- [ ] Alliance, DM, and bot behavior has test coverage and moderation-safe limits.

---

# Phase 4 — Larger Capabilities

**Goal:** Complete the remaining strategic, technical, narrative, and scale systems after the core release and community loop are proven.

## 4.1 Combat and Defense

Carry forward Feature 8 items:

- **8.1 Attack command:** deploy a ship or fleet against an enemy star or ship.
- **8.2 Damage resolution:** server-side weapon effectiveness, shields, damage, and HP.
- **8.3 Destruction:** ship/fleet loss and ownership consequences at zero HP.
- **8.4 Combat events:** attacker and defender results, losses, and notifications.
- **8.5 Ground defense:** starbase, battle station, and ground-defense values.
- **8.8 Combat tests:** matchup matrix, shield behavior, destruction, and edge cases.

Ship combat should remain server-authoritative and ship only after the basic quest/community loop has stable telemetry.

## 4.2 Discovery, Sensors, and Intelligence

- **9.5 Artifact collectibles:** lore fragments, collections, and achievement integration.
- **9.6 Blueprint effects:** actual unlocks or discounts from blueprint discoveries.
- **9.7 Anomaly buffs:** HUD icons and complete client presentation for existing server buffs.
- **9.8 Multiple ore types:** rare materials and differentiated resource economy.
- **9.9 Knowledge system:** plans, blueprints, and build-tree branches.
- **21.1–21.7 / #45:** radar array, coverage, transit detection, progressive foreign intelligence, attributed notifications, and tests.
- **#46:** probe-level solar detail, with basic and enhanced probes revealing different information.

## 4.3 Economy and Dockable Structures

- **7.1–7.7:** soft currency, premium currency, ship points, earn/spend paths, buffs, HUD, idempotency, and tests.
- **#38:** define and implement purposes for mine, solar array, colony/hab, warehouse, shield, cannon, refinery, relay, and outpost interactions.
- Complete the remaining Space Dock rules from **#37** if any Phase 1 implementation remains partial.

## 4.4 Lore and Long-Term Motivation

- **Feature 19:** backstory, factions, Valcordia sector, player role, star lore, and endgame motivation.
- **Feature 20.1–20.10:** Luminari artifacts, ruin stars, machine raid escalation, star-gate network, lore crawl, Codex, machine stronghold, splinter faction, reverse-engineered technology, and discovery voice lines.
- **Current priority #6:** integrate backstory and video COMS where the narrative earns its complexity.
- **Current priority #7:** finish the skin framework and evaluate premium-safe visual variety.

## 4.5 Scale, Automation, and Access

- **Current priority #4:** autonomous AI probe with travel, exploration, and refueling behavior.
- **Current priority #5:** dynamically expand the galaxy when the current star graph is saturated.
- **15.1–15.8:** logged-out play, natural login prompts, local-storage migration, persistence after signup, and share/deep-link integration.
- **16.7:** Devvit journeys allowlisting.
- **16.8:** receipt logging and graceful denied/rate-limited/duplicate handling.
- Remaining accessibility work from **#24:** layout constants, inline offsets, hit-test scaling, HTML/CSS, splash conversion, and fixed-container reflow.

## 4.6 Remaining Daily Mechanics

After the seven Phase 2 quests prove the return loop, add the remaining daily mechanics:

- Command Streak
- Galactic Market/Event
- Community Campaign
- expanded Daily Reddit Dispatch variants
- additional research and anomaly variants

Each should reuse the Phase 2 quest platform rather than creating a separate daily-event framework.

## Phase 4 Exit Checklist

- [ ] Combat has a complete server-authoritative vertical slice and tests.
- [ ] Radar and probe intelligence create useful, bounded information.
- [ ] Currency and rare-resource systems have idempotent economy paths.
- [ ] Lore appears through gameplay, not only documentation.
- [ ] Logged-out users can understand the game before being asked to register.
- [ ] The galaxy and automation model can scale beyond the initial star graph.
- [ ] Accessibility scaling and hit testing work across all supported surfaces.

---

# Cross-Phase Sequencing

1. **Phase 1 first:** fix discoverability, mobile reliability, transition bugs, and release operations.
2. **Phase 2 next:** build the common quest/item/return platform and ship exactly seven quests as vertical slices.
3. **Phase 3 after retention evidence:** use colonization as the central guided journey and connect it to sharing, ranks, badges, empire management, and community activity.
4. **Phase 4 last:** add systems whose value depends on an active, understandable, and socially visible player base.

## Metrics to Carry Between Phases

- First movement completion
- First dock completion
- First scan completion
- First return within 24 hours
- Quest start, resume, completion, and abandonment
- Time from probe build to first colonization
- Colonization completion rate
- Shares per active player
- Community post engagement
- Active players with a second session
- Error/recovery rate on mobile and transitions

## Explicitly Excluded from This Plan

The source plan's completed items are not repeated here: existing onboarding steps, completed fuel commodity work, completed navigation fixes, shipped Comms foundations, implemented admin security, completed bot patrol behavior, and other items marked done. The plan only tracks remaining work and the dependencies needed to release it safely.
