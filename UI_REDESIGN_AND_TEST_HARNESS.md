# UI Redesign & Test Harness Plan

## Screen Size Detection

Already available: renderer always computes `screenW` and `screenH` in CSS pixels.
- **Mobile**: width < 500px (Reddit app inline/expanded)
- **Desktop**: width ≥ 500px
- Can use `window.devicePixelRatio` and canvas dimensions to detect at runtime
- Touch vs pointer already works (pointerdown events)

---

## Phase 1: Right-Side Tab Redesign

Replace the bottom dock panel + floating ship panel with right-side tabs that expand into content panels.

### Current right-side tabs:
- STATUS (planet info, fuel/shields)
- COMMS (placeholder)
- NAV (placeholder)

### New right-side tabs:

| Tab | Content | Available |
|-----|---------|-----------|
| **STATUS** | Ship fuel/shields readout, UNDOCK button, SCAN button, orbit info | Always |
| **BUILD** | Starbase extensions (STATION, HAB, MINE, SOLAR, STORE, DOCK upgrade buttons) | Greyed when not docked |
| **SHIPS** | Build ships grid + upgrades section (current ship panel content) | Greyed when not docked |
| **FLEET** | Fleet summary — all owned ships across all stars, ship counts, total SP | Always |

### Work Items:

- [ ] **1.1** Add layout mode detection (`isMobile` flag based on screenW < 500)
- [ ] **1.2** Refactor `PLANET_PANELS_BASE` to 4 tabs: STATUS, BUILD, SHIPS, FLEET
- [ ] **1.3** Move dock panel extension strip (STATION/HAB/MINE/etc) into BUILD tab panel body
- [ ] **1.4** Move ship build grid + upgrades into SHIPS tab panel body
- [ ] **1.5** Create FLEET tab showing fleet summary across all stars
- [ ] **1.6** Move UNDOCK/SCAN into STATUS tab (replace LEAVE/SCAN orbit buttons)
- [ ] **1.7** Grey out BUILD/SHIPS tabs when not docked (visual + disable clicks)
- [ ] **1.8** Remove bottom dock panel (orbit buttons row + extension strip)
- [ ] **1.9** Keep COMPLETE debug button accessible (move into BUILD or STATUS)
- [ ] **1.10** Mobile layout: tabs at bottom instead of right side when `isMobile`
- [ ] **1.11** Panel content adapts to available width (narrower on mobile)

### Questions to resolve:
- CONTACT/TRADE/MISSIONS — keep as future placeholders or remove?
- Does FLEET need to show ships at other stars, or just current star?
- Should tabs auto-open when docking?

---

## Phase 2: Mobile-First Polish

- [ ] **2.1** Touch-friendly hit targets (min 44px tap areas)
- [ ] **2.2** Panel content scrollable when taller than viewport
- [ ] **2.3** Font size scaling for small screens
- [ ] **2.4** Collapse planet info HUD on very small screens
- [ ] **2.5** Test in Reddit app WebView (inline 320px width + expanded ~375px)

---

## Phase 3: Test Harness — Simulated Players

### Goals:
- Automated backend testing without Reddit/Devvit
- Simulated player(s) performing actions (build, upgrade, buy ships, dock)
- Verify economy ticking, build timers, resource deduction
- Stress test concurrent operations

### Architecture:

```
tools/test-harness/
  harness.ts          — Main runner: creates fake store, spawns players
  simulated-player.ts — Bot that performs random/scripted actions
  scenarios/
    basic-economy.ts  — Builds station, waits, checks resources accumulate
    ship-upgrade.ts   — Builds scout, upgrades to destroyer, verifies
    concurrent.ts     — Multiple players building at same star
  fake-store.ts       — In-memory Redis mock (already exists in tests)
```

### Work Items:

- [ ] **3.1** Extract `createFakeStore` from test file into reusable `tools/test-harness/fake-store.ts`
- [ ] **3.2** Create `SimulatedPlayer` class — wraps game-service calls with a username
  - Methods: `buildExtension()`, `buyShip()`, `upgradeShip()`, `completeBuilds()`, `getEconomy()`, `getShips()`
  - Tracks own state (resources, fleet, buildings)
- [ ] **3.3** Create scenario runner that executes test scenarios sequentially
- [ ] **3.4** Scenario: `basic-economy` — init star, build mine+solar, advance time, verify resource accumulation
- [ ] **3.5** Scenario: `ship-upgrade` — build scout, upgrade to destroyer, verify fleet changes
- [ ] **3.6** Scenario: `concurrent-players` — 2+ players at same star building simultaneously
- [ ] **3.7** Scenario: `resource-exhaustion` — drain resources, verify builds fail gracefully
- [ ] **3.8** Add `npm run test:harness` script to package.json
- [ ] **3.9** Optional: time-travel helper (advance `now` parameter to simulate waiting)

### Example usage:
```typescript
const store = createFakeStore();
const player = new SimulatedPlayer(store, 'test-pilot', starIndex: 42);

await player.buildExtension('station'); // starts station build
player.advanceTime(120_000);            // skip 2 minutes
await player.reconcile();               // tick economy
expect(player.resources.ore).toBeGreaterThan(0);

await player.buyShip(1);               // build scout
player.advanceTime(60_000);
await player.reconcile();
expect(player.fleet).toContainEqual({ typeId: 1, count: 1 });

await player.upgradeShip(1);           // scout → destroyer
player.advanceTime(180_000);
await player.reconcile();
expect(player.fleet).toContainEqual({ typeId: 3, count: 1 });
```

---

## Priority Order

1. **Slow Loading Resolution** — Investigate and fix slow initial load times
2. **Mobile UI Review** — Review and improve the mobile experience (layout, touch targets, responsiveness)
3. **Test Harness (Phase 3)** — Low risk, validates existing logic, unblocks confidence for UI changes
4. **Mobile Polish (Phase 2)** — Detailed touch/scroll/font refinements after review

---

## Notes

- Screen size IS detectable: `r.width / dpr` gives CSS pixel width at any frame
- Devvit WebView on Reddit mobile: inline ≈ 320-375px wide, expanded ≈ 375-414px
- Desktop embed: typically 500-800px wide
- Current panels already use `screenW`/`screenH` for positioning
- Touch input already works (pointerdown events throughout)
