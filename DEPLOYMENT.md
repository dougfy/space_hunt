# Valcordia Space — Deployment Guide

## Quick Deploy (Standard)

```bash
cd DotsDevvitWeird/spacehunt
npm run ship
```

This runs:
1. **Version bump** — increments patch version in `version.json`
2. **Upload** — `npx devvit upload` builds (vite + devvit) and uploads to Reddit
3. **Install** — `npx devvit install valcordia_space_dev` installs to the dev subreddit

## Verifying Deployment

After `npm run ship`, confirm:
- Upload output says **"X new WebView assets uploaded"** (or "Uploading... done" if no asset changes)
- Install output says **"Successfully installed version 0.0.XXX!"**

### If the subreddit still shows old version:

1. **Re-run install**: `npx devvit install valcordia_space_dev`
2. **Create a new post** on r/valcordia_space_dev (old posts may serve cached webview bundles)
3. **Hard refresh** the browser (Cmd+Shift+R / Ctrl+Shift+R)

Reddit's WebView CDN can cache aggressively. A new post always loads the latest installed version's assets.

## Target Subreddit

- **Dev**: `r/valcordia_space_dev`

## Version Tracking

- `version.json` — local version counter (auto-incremented by `ship` script)
- Devvit auto-bumps its own version number on upload (shown in upload output)
- The devvit version (e.g. 0.0.169) is what's installed on the subreddit

## Other Scripts

| Command | Purpose |
|---------|---------|
| `npm run ship` | Full deploy (bump + upload + install) |
| `npm run deploy` | Type-check + lint + upload (no install) |
| `npm run dev` | Start devvit playtest (live reload) |
| `npm run launch` | Deploy + publish (sends to Reddit review — avoid for dev) |

## Troubleshooting

### "Version X has already been installed"
This is normal — means the subreddit is already on the latest. The webview should update on next post load.

### WebView still showing old code
Reddit caches webview assets per-post. Creating a **new post** guarantees fresh assets. Existing posts may take a few minutes to pick up the new version.

### Build fails
Run `npx tsc --noEmit` to check for TypeScript errors before deploying.
