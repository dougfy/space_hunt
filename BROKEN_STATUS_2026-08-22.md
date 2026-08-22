# Broken Status Report (2026-08-22)

## Scope

This report documents current health after pulling latest `main` to commit `cd4e8ce` and running validation.

## Verification Commands Run

From repository root:

```bash
npm run type-check
npm run lint
npm run build
npm test
npm_config_cache="$TMPDIR/.npm-cache" npm outdated --json
```

## Result Summary

- `npm run type-check`: pass.
- `npm run lint`: pass.
- `npm run build`: pass (Vite warning on invalid `sourcemapFileNames` output option).
- `npm test`: fail with 23 failed tests.
- Working tree during verification: `main...origin/main`; local `package-lock.json` changed by install step.

## Confirmed Log Files Present

- `docs/playtests/playtest-audit-2026-08-16.log`
- `docs/playtests/playtest-logs-2026-08-16.json`
- `docs/playtests/logs/telemetry_20260811_155052.jsonl`
- `docs/playtests/logs/telemetry_20260811_160010.jsonl`

## What Must Pass To Be "Whole" (Remote Gate)

Remote should consider this repo whole only when all checks below pass on `main` in a clean working tree:

1. `npm run type-check`
2. `npm run lint`
3. `npm run build`
4. `npm test` with **0 failed tests** (currently failing)
5. Playwright E2E run isolated from Vitest (for example `npx playwright test`) and passing for required scenarios

## Current Blocking Test Failures (23)

### 1) Test-runner scope mismatch (Vitest executing Playwright specs)

Vitest currently picks up files in `tests/e2e` that are written for Playwright test runner APIs:

- `tests/e2e/all-modes-overlap.spec.ts:96`
- `tests/e2e/colony-ship-journey.spec.ts:255`
- `tests/e2e/debug-dom.spec.ts:11`
- `tests/e2e/expanded-mode.spec.ts:33`
- `tests/e2e/login.spec.ts:17`
- `tests/e2e/reset-game.spec.ts:36`
- `tests/e2e/test-vision.spec.ts:13`
- `tests/e2e/upgrade-station.spec.ts:121`

Error pattern:
- "Playwright Test did not expect test()/test.describe()/test.use() to be called here."

### 2) Dist test/module resolution issue

- `dist/types/game/game/__tests__/movement.test.js`
- Fails with missing module import for `../../version.json` via `dist/types/game/game/audio.js`.

### 3) Resource-model expectation drift (`fuel` and totals)

Examples:

- `src/server/__tests__/game-service.test.ts:165`
  - Expected store `{ ore, food, energy }`
  - Received store includes `fuel`.
- `src/server/__tests__/game-service.test.ts:199`
  - Expected `energy` cap at `1600`, received `1589`.

## Version Freshness (Devvit And Core Tooling)

From `npm outdated --json` (using temp npm cache):

- `devvit`: `0.14.0` -> latest `0.14.1`
- `@devvit/web`: `0.14.0` -> latest `0.14.1`
- `@devvit/start`: `0.14.0` -> latest `0.14.1`
- `@devvit/analytics`: `0.14.0` -> latest `0.14.1`
- `@devvit/public-api`: `0.14.0` -> latest `0.14.1`

Additional notable updates available:

- `vitest`: `4.1.10` -> `4.1.11`
- `vite`: `8.0.13` -> `8.2.2`
- `typescript`: `6.0.3` -> `7.0.2` (major)
- `react` / `react-dom`: `19.2.6` -> `19.2.8`

## Handoff Focus For Next Remote Fix Round

1. Separate test scopes so Vitest does not execute Playwright specs in `tests/e2e`.
2. Decide whether `dist/types/**/__tests__` should be excluded from unit test discovery.
3. Reconcile expected economy/resource assertions with current `fuel`-inclusive model.
4. Re-run the required gate list above; repo is not whole until all pass.
