## Devvit React Starter

A starter to build web applications on Reddit's developer platform

- [Devvit](https://developers.reddit.com/): A way to build and deploy immersive games on Reddit
- [Vite](https://vite.dev/): For compiling the webView
- [React](https://react.dev/): For UI
- [Hono](https://hono.dev/): For backend logic
- [Tailwind](https://tailwindcss.com/): For styles
- [TypeScript](https://www.typescriptlang.org/): For type safety

## Getting Started

> Make sure you have Node 22 downloaded on your machine before running!

1. Run `npm create devvit@latest --template=react`
2. Go through the installation wizard. You will need to create a Reddit account and connect it to Reddit developers
3. Copy the command on the success page into your terminal

## Deployment

### Quick deploy (recommended)

```bash
npm run ship
```

This does everything in one command:
1. Bumps patch version in `version.json`
2. Runs `devvit upload` (builds via Vite, uploads to Devvit registry)
3. Runs `devvit install valcordia_space_dev` (updates the subreddit to the new version)

### Important: upload vs install

- **`devvit upload`** — publishes a new version to the app registry. Does NOT update running subreddits.
- **`devvit install <subreddit>`** — updates the subreddit to the latest uploaded version. Without this, existing posts keep running the old version.

If you only upload without installing, the subreddit stays on whatever version was last installed.

### Verifying a deploy

After shipping, reload the game post on r/valcordia_space_dev. Check the version in Settings — it should match `version.json`.

### Creating a new post

After deploying, use the subreddit menu action "Create a new post" (mod-only) to spawn a fresh game post running the latest version.

### Other useful commands

- `npx devvit list installations` — see what version is installed on each subreddit
- `npx devvit playtest` — live dev mode (hot reload, no upload needed)

## Commands

- `npm run ship`: Bump version, upload, and install to r/valcordia_space_dev
- `npm run dev`: Starts a development server (playtest) for live development
- `npm run build`: Builds client and server without uploading
- `npm run deploy`: Type-checks, lints, and uploads (does NOT install)
- `npm run launch`: Publishes your app for review
- `npm run login`: Logs your CLI into Reddit
- `npm run type-check`: Type checks, lints, and prettifies your app
