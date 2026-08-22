# Broken Status Report (2026-08-22)

## Scope

This report documents the current broken state observed immediately after pulling `main` and running standard validation commands.

## Verification Commands Run

From repository root:

```bash
npm run type-check
npm test
```

## Result Summary

- `npm run type-check`: failed with 20 TypeScript errors.
- `npm test`: failed with 23 failed tests.
- Working tree at time of verification: clean (`main...origin/main`).

## Confirmed Log Files Present

- `docs/playtests/playtest-audit-2026-08-16.log`
- `docs/playtests/playtest-logs-2026-08-16.json`
- `docs/playtests/logs/telemetry_20260811_155052.jsonl`
- `docs/playtests/logs/telemetry_20260811_160010.jsonl`

## TypeScript Breakages (Representative)

1. Missing required `ShipShape` mapping entry:
   - `src/game/constants.ts:43`
   - `FUEL_CAPACITY_BY_SHAPE` is missing `colony`.

2. Missing modules / unresolved imports:
   - `src/game/renderer.ts:15` (`./ship-sprites` not found)
   - `src/game/renderer.ts:1057` (`./skins/scifi` not found)
   - `src/client/game.ts:18` (`../game/skins/scifi` not found)
   - `src/client/game.ts:19` (`../game/ship-sprites` not found)

3. Missing exports expected by current callers:
   - `src/game/renderer.ts:1054` expects `registerSkinDrawFn`, `getDrawFeatureIconForSkinId`, `getWireframePref` from `./skin`
   - `src/game/renderer.ts:1056` expects `getCartoonStationSprite` from `./skins/raster`
   - `src/client/game.ts:14` expects `getWireframePref`, `setWireframePref` from `../game/skin`

4. Type mismatch / API drift:
   - `src/game/renderer.ts:2684` and `src/game/renderer.ts:2810`: `PlanetFeature` has no `skinId`
   - `src/game/renderer.ts:7025` to `src/game/renderer.ts:7028`: skin keys (`solar_array`, `hab`, `dock`, `cannon`) not assignable to `keyof SkinVariants`
   - `src/server/__tests__/game-service.test.ts:20`, `src/server/core/autobot.ts:689`, `src/server/routes/bots.ts:780`: `RedisGameStore` objects missing `del` and `zRange`

## Test Failures (Representative)

1. Vitest is executing Playwright E2E specs and failing with Playwright suite-context errors:
   - `tests/e2e/colony-ship-journey.spec.ts:255`
   - `tests/e2e/debug-dom.spec.ts:11`
   - `tests/e2e/expanded-mode.spec.ts:33`
   - `tests/e2e/login.spec.ts:17`
   - `tests/e2e/reset-game.spec.ts:36`
   - `tests/e2e/test-vision.spec.ts:13`
   - `tests/e2e/upgrade-station.spec.ts:121`

2. Unit/integration expectation drift around resource model (`fuel` now present):
   - `src/game/__tests__/economy-catalog.test.ts:11`
   - `src/game/__tests__/economy-catalog.test.ts:17`
   - `src/server/__tests__/game-service.test.ts:159`
   - `src/server/__tests__/game-service.test.ts:193`

3. Runtime module resolution failures in tests:
   - `src/game/__tests__/movement.test.ts`
   - `dist/types/game/game/__tests__/movement.test.js`
   - Root cause aligns with missing `ship-sprites` module imports above.

## Handoff Notes For Remote Fix

Likely high-priority fix groups:

1. Restore/remove missing modules and exports (`ship-sprites`, `skins/scifi`, skin API export surface).
2. Reconcile domain model changes for `fuel` and `ShipShape` (`colony`) across code and tests.
3. Align `RedisGameStore` contract usage with current interface (`del`, `zRange`).
4. Separate Vitest unit scope from Playwright E2E scope so `npm test` does not execute E2E Playwright specs.
