# Playwright E2E Testing

## Overview

End-to-end tests run against the **live game** on Reddit via Playwright. The game
runs inside a Devvit webview iframe on `r/valcordia_space_dev`. Tests use keyboard
shortcuts and a `window.__testState()` hook to drive and verify game actions.

## Prerequisites

- Node.js 18+
- `npm install` (installs `playwright` and `@playwright/test`)
- `npx playwright install chromium` (one-time browser install)
- A saved Reddit login session (see below)

## First-Time Setup: Reddit Login

Playwright needs a saved Reddit session to access the game:

```bash
cd DotsDevvitWeird/spacehunt
npx playwright codegen --save-storage=tests/e2e/reddit-auth.json https://www.reddit.com/login
```

This opens a browser. Log into Reddit, then **close the browser window**. The auth
state is saved to `tests/e2e/reddit-auth.json`. This file is gitignored.

**Note:** Reddit sessions expire. If tests fail with redirect to `/register/`, re-run
the codegen command above to refresh the session.

## Running Tests

```bash
# Run all E2E tests (headed — you'll see the browser)
npx playwright test --headed

# Run a specific test
npx playwright test tests/e2e/upgrade-station.spec.ts --headed

# Run headless (CI-style, but Reddit may block headless browsers)
npx playwright test
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDDIT_POST_URL` | `https://www.reddit.com/r/valcordia_space_dev/` | Target Reddit post/subreddit URL |

## Test Architecture

### Keyboard Shortcuts (in-game)

Tests drive the game via keyboard shortcuts defined in `src/game/input.ts`:

| Key | Action |
|-----|--------|
| `b` | Toggle BUILD panel |
| `n` | Toggle SHIPS panel |
| `t` | Toggle STATUS panel |
| `f` | Toggle FLEET panel |
| `c` | Toggle COMS panel |
| `u` | Undock from station |
| `e` | Scan/explore planet |
| `g` | Recenter camera |
| `z` | Toggle zoom |
| `Escape` | Close any open panel |
| `1`-`9` | Press Nth button in active panel |

### Verification Hooks

The game exposes two `window` functions for test automation:

**`window.__testState()`** — Returns a snapshot of game state:
```js
{
  openPanel: 1,              // -1=none, 0=STATUS, 1=BUILD, 2=SHIPS, 3=FLEET, 4=COMS
  starIndex: 71,             // current star
  skinPickerVisible: false,  // true if skin picker modal is open
  buildings: {               // null until economy data loads
    station: { level: 1, status: 'ACTIVE', completeAt: null },
    mine: { level: 0, status: 'READY', completeAt: null },
    // ... all 9 building types
  },
  store: { ore: 640, food: 640, energy: 640, fuel: 0 },
  rates: { ore: 5, food: 3, energy: 4, fuel: 0 },
  buildButtons: [{ label: 'STATION II', enabled: true, action: 'upgrade_station' }, ...],
  shipButtons: [{ shipTypeId: 1, enabled: true, isUpgrade: false }, ...],
  playerName: 'Red Raider',
  shipShape: 'scout',
  docked: true,
  splashMode: false,
  playing: true,
  tier: 2,                   // NavigationTier (0=Galaxy, 1=System, 2=Local/Planet)
  homeStar: 71,
}
```

**`window.__confirmSkinPicker()`** — Auto-confirms the first skin option. Station,
Hab, Solar, Dock, and Cannon are "skinnable" buildings — pressing their build button
opens a skin picker modal instead of immediately starting the build. Call this to
bypass the modal.

### How Game Frame Detection Works

Reddit renders Devvit apps inside nested iframes:
```
page → <shreddit-app> → <devvit2-custom-post> (shadow DOM) → <devvit2-surface> → <iframe>
```

Tests find the game iframe by scanning `page.frames()` for URLs containing
`game.html`, `inline.html`, or `play.html`. Playwright auto-discovers frames
regardless of shadow DOM nesting.

### Economy Data Timing

The game polls `/api/economy` every 5 seconds. After triggering a build action,
wait ~8 seconds for the server state to reflect in `__testState()`.

## Writing New Tests

### Template

```typescript
import { test, expect } from '@playwright/test';

const POST_URL = process.env.REDDIT_POST_URL ?? 'https://www.reddit.com/r/valcordia_space_dev/';

test('my test', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(POST_URL, { waitUntil: 'domcontentloaded' });

  // Find game frame (use getGameFrame helper from upgrade-station.spec.ts)
  const frame = await getGameFrame(page);

  // Wait for economy data
  let state;
  for (let i = 0; i < 20; i++) {
    state = await frame.evaluate(() => (globalThis as any).__testState());
    if (state?.store) break;
    await page.waitForTimeout(2000);
  }

  // Drive actions via keyboard
  await frame.locator('#game-canvas').press('b');  // open BUILD
  await page.waitForTimeout(500);
  await frame.locator('#game-canvas').press('1');  // press first button
  // ...
});
```

### Build Button Order (1-9)

| Key | BUILD panel | SHIPS panel |
|-----|-------------|-------------|
| 1 | Station | First upgrade/build option |
| 2 | Hab | Second option |
| 3 | Mine | Third option |
| 4 | Solar | ... |
| 5 | Store | |
| 6 | Dock | |
| 7 | Shield | |
| 8 | Cannon | |
| 9 | Refinery | |

### Skinnable Buildings

Station, Hab, Solar, Dock, Cannon trigger a skin picker modal. After pressing
the number key, check `state.skinPickerVisible` and call `__confirmSkinPicker()`
if true. Non-skinnable buildings (Mine, Store, Shield, Refinery) start immediately.

## Deploying Before Testing

Tests run against the **live deployed version**. If you changed game code (especially
`__testState` or keyboard shortcuts), deploy first:

```bash
npm run ship   # bumps version, builds, uploads, installs
```

Reddit caches webview assets per-post. After deploying, the subreddit feed
usually picks up the new version automatically, but individual post pages may
need a new post to reflect changes.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Redirect to `/register/` | Re-run `npx playwright codegen --save-storage=...` to refresh session |
| Game frame not found | Increase wait time in `getGameFrame` loop; check Reddit loaded the post |
| `__testState` returns null | Deploy latest code with `npm run ship`; ensure v1.4.31+ |
| Economy data stays null | Wait longer (up to 40s); check player is docked at a claimed star |
| Skin picker not auto-confirming | Ensure `__confirmSkinPicker` is deployed (v1.4.31+) |
| All build buttons disabled | Player needs resources; reset game state or wait for production |

## Files

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright configuration (browser, auth, timeouts) |
| `tests/e2e/upgrade-station.spec.ts` | Station upgrade E2E test |
| `tests/e2e/debug-dom.spec.ts` | DOM structure diagnostic (for debugging) |
| `tests/e2e/reddit-auth.json` | Saved Reddit session (gitignored) |
| `src/game/input.ts` | Keyboard shortcuts (ACTION_KEYS map) |
| `src/game/renderer.ts` | `getTestState()`, `confirmSkinPicker()`, `triggerBuildButtonByIndex()` |
| `src/client/game.ts` | `window.__testState` and `window.__confirmSkinPicker` exposure |
