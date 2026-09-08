You are writing a Devvit web application that will be executed on Reddit.com.

## Tech Stack

- **Frontend**: TypeScript Canvas2D game engine with HTML/CSS overlays, built with Vite. React 19 and Tailwind CSS 4 remain installed/configured tooling; the active game entrypoints initialize the canvas engine directly.
- **Backend**: Node.js v22 serverless environment (Devvit), Hono, and Devvit Redis persistence.
- **Communication**: HTTP requests using `fetch` to Hono JSON endpoints under `/api`, with shared TypeScript request/response types in `src/shared/api.ts`.

## Layout & Architecture

- `/src/server`: **Backend Code**. This runs in a secure, serverless environment.
  - `index.ts`: Main Hono server entry point; mounts public game routes under `/api` and platform handlers under `/internal`.
  - `routes/`: HTTP handlers for game APIs, telemetry, communications, alliances, bots, menus, forms, triggers, and scheduled tasks.
  - `core/`: Game services and persistence, including `game-service.ts`, trading, achievements, NPC behavior, sensor alerts, and developer authentication.
  - Access `redis`, `reddit`, and `context` here via `@devvit/web/server`.
- `/src/client`: **Frontend Code**. This is executed inside of an iFrame on reddit.com
  - `game.ts`: Initializes the game engine and Devvit bridge, connects client actions to server APIs, polls state, and manages HTML overlays.
  - Registered entrypoints in `devvit.json`:
    - `default` → `game.html`: Inline feed view. Loads `loader.ts`, which starts the lightweight splash animation and leaderboard, then dynamically imports `game.ts` after a play-button click.
    - `game` → `play.html`: Expanded game view, requested with `requestExpandedMode(event, 'game')`. Loads `game.ts` directly.
  - `inline.html`, `splash.html`, and `splash-test.html` are not registered entrypoints in the current `devvit.json`.
  - To add an entrypoint, create an HTML file and add its mapping in `devvit.json`. Keep the inline splash fast and preserve deferred loading of the full game bundle.
- `/src/game`: **Client Game Engine**. `game-loop.ts` manages simulation and tier transitions; `renderer.ts` draws the canvas UI and handles its hit targets; `bridge.ts` connects the engine to the client integration. Other modules handle galaxy generation, movement, docking, input, audio, skins, and tutorials.
- `/src/shared`: **Shared Code**. API contracts, game catalogs, types, and reusable logic shared by client and server.
- `/public`: Runtime assets served to the client, including icons and sounds.
- `/tests/e2e`: Playwright tests against the deployed Reddit game. Unit tests live under `src/**/__tests__/` and run with Vitest.

## Frontend

### Rules

- Instead of `window.location` or `window.assign`, use `navigateTo` from `@devvit/web/client`

### Limitations

- `window.alert`: Use `showToast` or `showForm` from `@devvit/web/client`
- File downloads: Use clipboard API with `showToast` to confirm
- Geolocation, camera, microphone, and notifications web APIs: No alternatives
- Inline script tags inside of `html` files: Use a script tag and separate js/ts file

## Commands

- `npm run type-check`: Check typescript types
- `npm run lint`: Check the linter
- `npm run test -- my-file-name`: Run tests isolated to a file

## Source Control

- This project is maintained in the GitHub repository `https://github.com/dougfy/space_hunt.git`.
- Use Git with the `origin` remote on the `main` branch for status, commits, and pushes.

## Code Style

- Prefer type aliases over interfaces when writing typescript
- Prefer named exports over default exports
- Never cast typescript types

## Global Rules

- You may find code that references blocks or `@devvit/public-api` while building a feature. Do NOT use this code as this project is configured to use Devvit web only.
- Whenever you add an endpoint for a new menu item action, ensure that you've added the corresponding mapping to `devvit.json` so that it is properly registered

Docs: https://developers.reddit.com/docs/llms.txt.
