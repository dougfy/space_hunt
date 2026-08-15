# E2E Test Registry

| # | File | Name | What it verifies |
|---|------|------|-----------------|
| 001 | `login.spec.ts` | Reddit Login | Automated login, saves session |
| 002 | `reset-game.spec.ts` | Game Reset | Wipes all game state via admin API |
| 003 | `upgrade-station.spec.ts` | Station Upgrade | Build station, verify progress/sound/skin |
| 004 | `all-modes-overlap.spec.ts` | All Modes Overlap | Check all 4 display modes for UI overlap |
| 005 | `005-menu-panels.spec.ts` | Menu Panel Readability | Each panel (STATUS/BUILD/SHIPS/FLEET/COMS) is readable in Desktop mode |
| 006 | `expanded-mode.spec.ts` | Expanded Mode | Full-screen game loads correctly |
| 007 | `colony-ship-journey.spec.ts` | Colony Ship Journey | Full upgrade path to colony ship (~30 min) |
| 008 | `test-vision.spec.ts` | Vision Validation | Confirms OpenAI GPT-4o integration works |
| 009 | `debug-dom.spec.ts` | DOM Diagnostic | Dumps page structure (debugging only) |

## Running Tests

```bash
# Run a specific test by number
npx playwright test tests/e2e/005-menu-panels.spec.ts --headed

# Run all tests (except long-running colony ship)
npx playwright test tests/e2e --headed --ignore=*colony*

# Run just the overlap checks
npx playwright test tests/e2e/all-modes-overlap.spec.ts --headed

# Full suite including colony ship (30+ min)
npx playwright test tests/e2e --headed
```

## Test Dependencies

```
001-login → (saves reddit-auth.json) → all other tests
002-reset → (fresh game state) → 003, 007
```

## Typical Workflow

1. `login.spec.ts` — refresh auth if expired
2. `reset-game.spec.ts` — clean slate
3. `005-menu-panels.spec.ts` — quick visual checks
4. `all-modes-overlap.spec.ts` — mode-by-mode overlap audit
5. `upgrade-station.spec.ts` — functional build test
6. `colony-ship-journey.spec.ts` — full journey (long)
