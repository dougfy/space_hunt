# Test Plan — Valcordia Space

**Platform:** Devvit WebView (TypeScript/Canvas2D), Playwright E2E, OpenAI GPT-4o Vision  
**Last Updated:** 2026-08-16 (v1.4.47)

---

## 🎯 Current Status

| Tier | Tests | Passing | Time | Frequency |
|------|-------|---------|------|-----------|
| **Server (Tier 1)** | 16 planned | 0 implemented | ~30s target | Every deploy |
| **UI (Tier 2)** | 10 | 7 passing | ~5 min | Daily / before release |
| **Multiplayer (Tier 3)** | 8 planned | 0 implemented | ~15 min | Weekly / before release |
| **Colony Ship Journey** | 1 | Partial (timing) | ~30 min | On demand |

---

## Infrastructure ✅ Complete

| Component | Status | Notes |
|-----------|--------|-------|
| Playwright + Reddit auth | ✅ | `login.spec.ts` — automated login via /tmp/.reddit-test-pw |
| OpenAI GPT-4o vision | ✅ | `visual-verify.ts` — screenshot → AI analysis → pass/fail |
| Admin reset endpoint | ✅ | `POST /api/admin/reset-all` — wipes all game state |
| Admin set-state endpoint | ✅ | `POST /api/admin/set-state` — sets buildings/resources/ships/charges |
| Console log capture | ✅ | `page.on('console')` — verifies economy state without __testState |
| Keyboard shortcuts | ✅ | `1-9` for panel buttons, `b/n/t/f/c/u/e/g/z` for actions |
| Sound history tracking | ✅ | `__getSoundHistory()` — ring buffer of last 20 sounds |
| Game state hook | ✅ | `__testState()` — buildings, resources, ships, progress, skin |
| Skin picker bypass | ✅ | `__confirmSkinPicker()` — auto-picks first skin for automation |
| Build cooldown | ✅ | Buttons grey after build, re-enable on next economy poll |

---

## Tier 1: Server Regression (Fast, No UI)

Unit/integration tests against the server API. No browser needed. Run headlessly.

### Prerequisites
- [x] Admin set-state endpoint
- [ ] Vitest test file for server API calls
- [ ] Second test account credentials

### Test Cases

| # | Test | Status | What it verifies |
|---|------|--------|-----------------|
| S-01 | Build station L1→L2 | ❌ | POST /buildings/buy → status=UPGRADING, completeAt set |
| S-02 | Build rejected (no resources) | ❌ | Returns 400 with "insufficient" message |
| S-03 | Build rejected (already building) | ❌ | Returns 400 with "already upgrading" |
| S-04 | Build completes (reconcile) | ❌ | After completeAt, GET shows ACTIVE + level+1 |
| S-05 | Ship buy | ❌ | POST /ships/buy → building state set |
| S-06 | Ship upgrade | ❌ | POST /ships/upgrade → previous consumed, new building |
| S-07 | Blueprint instant build | ❌ | useBlueprint=true → completeAt=now, charge-1 |
| S-08 | Complete button | ❌ | POST /buildings/complete-builds → instant finish |
| S-09 | Scan station (feature) | ❌ | isStation=true → no ore, explored key=:f |
| S-10 | Scan planet | ❌ | isStation=false → resources possible, key=:p |
| S-11 | Scan cooldown | ❌ | Second scan within 60s → "nothing" |
| S-12 | Resource production tick | ❌ | GET after delay → resources grew by rate×time |
| S-13 | Colony ship → colonize | ❌ | Ship consumed, star claimed |
| S-14 | Probe → discover star | ❌ | Star marked discovered in profile |
| S-15 | Shield toggle | ❌ | shieldRaised flips |
| S-16 | Reset all | ❌ | All state cleared, verified empty |

---

## Tier 2: UI Regression (Playwright + GPT-4o Vision)

Visual checks across display modes. Each test: navigate → act → screenshot → AI verify.

### Test Cases

| # | Test | File | Status |
|---|------|------|--------|
| U-01 | Reddit login | `login.spec.ts` | ✅ |
| U-02 | Game reset | `reset-game.spec.ts` | ✅ |
| U-03 | Menu panels readable | `005-menu-panels.spec.ts` | ✅ (STATUS/BUILD/SHIPS/COMS/SETTINGS) |
| U-04 | Overlap check (all modes) | `all-modes-overlap.spec.ts` | ✅ Desktop/Fullscreen pass, Mobile known issue |
| U-05 | Expanded/fullscreen mode | `expanded-mode.spec.ts` | ✅ |
| U-06 | Scan wireframe→raster | `006-scan-raster.spec.ts` | ✅ Station/planet separation works |
| U-07 | Station upgrade + progress | `upgrade-station.spec.ts` | ✅ Progress bar, sound, skin verified |
| U-08 | Admin set-state | `007-admin-set-state.spec.ts` | ✅ Reset → set → verify via console logs |
| U-09 | Build cooldown (buttons grey) | — | ❌ Planned |
| U-10 | Ship panel with fleet | — | ❌ Planned (needs set-state to dock L3) |
| U-11 | Galaxy view star colors | — | ❌ Planned |

---

## Tier 3: Multiplayer Regression (Two Browsers)

Two Playwright browser contexts, two Reddit accounts, verifying interactions.

### Prerequisites
- [ ] Second Reddit test account (create + save credentials)
- [ ] Admin set-state to give both players ships + dock L3
- [ ] Both players at different stars in same galaxy

### Test Cases

| # | Test | Status | What it verifies |
|---|------|--------|-----------------|
| M-01 | Ghost presence | ❌ | Player A sees Player B's ship ghost |
| M-02 | Ghost at all tiers | ❌ | Both visible in Galaxy/System/Planet |
| M-03 | Ship skin cross-player | ❌ | A's chosen skin shows correctly to B |
| M-04 | Fleet transfer | ❌ | Ship arrives at other star |
| M-05 | DM messaging | ❌ | Send/receive in COMS panel |
| M-06 | Public chat | ❌ | Both see public messages |
| M-07 | Raid notification | ❌ | Sensor alert fires for defender |
| M-08 | Probe arrival | ❌ | Probed star marked discovered |

### Alliance Tests (Future)
- Alliance invite/accept flow
- Alliance chat visibility
- Allied fleet coordination
- Alliance dissolution

---

## Implementation Phases

### Phase 1 ✅ Complete
- [x] Playwright infrastructure (login, frame detection, key dispatch)
- [x] OpenAI GPT-4o visual verification
- [x] Admin reset endpoint
- [x] Admin set-state endpoint
- [x] Keyboard shortcuts for panel buttons (1-9)
- [x] Sound history tracking
- [x] Console log capture verification
- [x] UI tests U-01 through U-08

### Phase 2 (Next)
- [ ] Implement S-01 through S-08 as Vitest unit tests
- [ ] Create second test account
- [ ] Add U-09, U-10, U-11
- [ ] Fix mobile overlap (BUG-005: FEATURES text at narrow width)

### Phase 3 (Following)
- [ ] Implement S-09 through S-16
- [ ] Set up dual-browser for M-01
- [ ] Complete M-01 through M-04

### Phase 4 (Future)
- [ ] Complete M-05 through M-08
- [ ] Alliance test planning
- [ ] CI integration (headless server tests on deploy)

---

## Bugs Found by Testing

See `VISUAL_BUGS.md` for full details with screenshots.

| # | Bug | Status | Found by |
|---|-----|--------|----------|
| BUG-001 | Ship name overlaps ghost label | ✅ Fixed (v1.4.33) | all-modes-overlap |
| BUG-002 | Subreddit text bleeds into game (Desktop) | ✅ Fixed (platform) | all-modes-overlap |
| BUG-003 | Report badge overlaps info panel | ✅ Fixed (v1.4.33) | 006-scan-raster |
| BUG-004 | Station type label overlaps name | Noted | 006-scan-raster |
| BUG-005 | Mobile FEATURES text clash | Open | all-modes-overlap |
| CRITICAL | Foreign fleet overriding player ownership | ✅ Fixed (v1.4.43) | Manual debug |
| CRITICAL | Progress bar using wrong duration | ✅ Fixed (v1.4.44) | Manual debug |

---

## Running Tests

```bash
# 1. Login (refresh if session expired)
npx playwright test tests/e2e/login.spec.ts --headed

# 2. Quick regression (~2 min)
npx playwright test tests/e2e/007-admin-set-state.spec.ts tests/e2e/005-menu-panels.spec.ts --headed

# 3. Visual regression (~5 min)
npx playwright test tests/e2e --headed --ignore=*colony* --ignore=*debug*

# 4. Full journey (~30 min)
npx playwright test tests/e2e/colony-ship-journey.spec.ts --headed

# 5. Server unit tests (when implemented)
npm run test
```

---

## Key Files

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Browser config, auth state path |
| `tests/e2e/login.spec.ts` | Automated Reddit login |
| `tests/e2e/reset-game.spec.ts` | Full state wipe |
| `tests/e2e/admin-helper.ts` | setGameState() + presets (EARLY/MID/LATE) |
| `tests/e2e/visual-verify.ts` | GPT-4o screenshot verification |
| `tests/e2e/TEST_REGISTRY.md` | Test number/name quick reference |
| `E2E_TESTING.md` | Setup guide + keyboard shortcuts |
| `VISUAL_BUGS.md` | Bug list with screenshots |
| `tests/e2e/.openai-key` | GPT-4o API key (gitignored) |
| `tests/e2e/reddit-auth.json` | Saved Reddit session (gitignored) |
