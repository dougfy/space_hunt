# Sprite Inventory

## Directory Layout

```
icons/
├── ships/                  ← Ship PNGs (loaded by ship-sprites.ts)
├── planets/                ← Planet PNGs (loaded by raster.ts)
├── docks/                  ← Belt pod PNGs (loaded by renderer.ts + splash.ts)
├── skins/
│   ├── procedural/         ← Empty — drawn programmatically
│   ├── wireframe/          ← SVG icons (buildings + ships, used in play.html gallery)
│   ├── cartoon/            ← Starbase PNGs (loaded by raster.ts)
│   └── scifi/              ← Full PNG sprite set (loaded by scifi.ts)
└── _reference/             ← ChatGPT-generated concept art (NOT loaded by game)
```

## What We Have

### Wireframe Skin (`skins/wireframe/`) — SVG
| Feature       | Levels | Files |
|---------------|--------|-------|
| station       | 1-8    | ✅ Complete |
| mine          | 1-8    | ✅ Complete |
| solar-array   | 1-8    | ✅ Complete |
| hab           | 1-8    | ✅ Complete |
| dock          | 1-3    | ⚠️ Only 3 levels |
| ship-*        | —      | ✅ 13 ship types |

### Sci-Fi Skin (`skins/scifi/`) — PNG
| Feature       | Levels | Files |
|---------------|--------|-------|
| station       | 1-8    | ✅ Complete |
| solar-array   | 1-8    | ✅ Complete |
| hab           | 1-8    | ✅ Complete |
| dock          | 1-8    | ✅ Complete |
| cannon        | 1-8    | ✅ Complete |
| mine          | —      | ❌ Missing |
| ships         | —      | ❌ Missing |

### Cartoon/Raster Skin (`skins/cartoon/`) — PNG
| Feature       | Levels | Files |
|---------------|--------|-------|
| station       | 1-8    | ✅ Complete (starbase_lv{N}_256.png) |
| mine          | —      | ❌ Missing |
| solar-array   | —      | ❌ Missing |
| hab           | —      | ❌ Missing |
| dock          | —      | ❌ Missing |
| cannon        | —      | ❌ Missing |
| ships         | —      | ❌ Missing |

### Ships (`ships/`) — PNG
| Ship Type     | File |
|---------------|------|
| scout         | ✅ scout.png |
| destroyer     | ✅ destroyer.png |
| frigate       | ❌ Missing |
| battleship    | ❌ Missing |
| cruiser       | ❌ Missing |
| dreadnought   | ❌ Missing |
| freighter     | ❌ Missing |
| colony        | ❌ Missing |
| raider        | ❌ Missing |
| wrecker       | ❌ Missing |
| troop-transport | ❌ Missing |
| probe-basic   | ❌ Missing |
| probe-enhanced | ❌ Missing |

### Planets (`planets/`) — PNG
7 planet images (256px): planet_01 through planet_08 (missing planet_03)

### Belt Pod Docks (`docks/`) — PNG

One icon per `PodKind`, drawn on asteroids in the Local/belt tier.

| Pod kind  | File        | Pod color |
|-----------|-------------|-----------|
| refuel    | ✅ red.png    | `#FF5A3D` |
| dock      | ✅ yellow.png | `#FFD24A` |
| energy    | ✅ blue.png   | `#66CCFF` |
| ore       | ✅ orange.png | `#FF9933` |
| food      | ✅ green.png  | `#66FF66` |
| upgrade   | ✅ purple.png | `#CC66FF` |

**Conventions for new dock art:** 1254×1254 RGBA, transparent background, and
keep the black keyline — the dark outline stays opaque (~15–35% of opaque
pixels) so the sprite reads against space. `drawFuelPod` draws these raw with
no white/black stripping, so a flattened background will show as a solid box.
(`splash.ts` is the exception: it runs its copies through `stripWhite`.)

`BELT_DOCK_SOURCES` in `renderer.ts` is a full `Record<PodKind, string>`, so
adding a pod kind without art is a compile error. When an image is missing or
still loading, `drawFuelPod` falls back to a procedural ring + crosshair + stem
in the pod's color.

## Reference Art (`_reference/`)

ChatGPT-generated concept images, not used by game code:
- `stations-v1/` — 12 station concepts
- `stations-overview.png` — overview collage
- `solar-arrays/` — 8 concepts
- `habs/` — 8 concepts
- `docks/` — 8 concepts
- `cannons/` — 8 concepts
- `ships/` — 7 ship concepts

## Code Path Constants

| File | Constant | Path |
|------|----------|------|
| `src/game/skins/scifi.ts` | `SCIFI_PATH` | `icons/skins/scifi/` |
| `src/game/skins/raster.ts` | `STARBASE_PATH` | `icons/skins/cartoon/` |
| `src/game/skins/raster.ts` | `PLANET_PATH` | `icons/planets/` |
| `src/game/ship-sprites.ts` | `SHIPS_PATH` | `icons/ships/` |
| `src/game/renderer.ts` | `BELT_DOCK_SOURCES` | `icons/docks/` |
| `src/client/splash.ts` | `DOCK_ICON_SRCS` | `icons/docks/` |
| `src/client/play.html` | (inline) | `/icons/skins/wireframe/*.svg` |
