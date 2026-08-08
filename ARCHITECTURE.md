# Valcordia Space — Architecture Document

> Generated 2026-08-08. Covers v1.2.54.

---

## 1. System Overview

**Platform:** Devvit WebView (Reddit iframe) + Hono HTTP server + Redis  
**Client:** Vanilla TypeScript, Canvas2D, single-page game loop at 60fps  
**Server:** Hono routes on Devvit runtime, Redis for all persistence  
**Communication:** REST polling (no WebSocket) — 5s economy cycle, 1s ghosts/shots  
**Build:** Vite for client bundling, `npm run ship` for deploy pipeline

```
┌─────────────────────────────────────────────────────────┐
│  Reddit Post (iframe)                                    │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Client (game.ts)                                   │ │
│  │  ├── Game Loop (game-loop.ts) — 60fps update/draw   │ │
│  │  ├── Renderer (renderer.ts) — Canvas2D panels/HUD   │ │
│  │  └── Bridge (bridge.ts) — engine↔client interface   │ │
│  └─────────────────────────┬───────────────────────────┘ │
│                            │ REST (fetch)                 │
│  ┌─────────────────────────▼───────────────────────────┐ │
│  │  Server (Hono)                                      │ │
│  │  ├── routes/api.ts — gameplay endpoints             │ │
│  │  ├── routes/alliance.ts — social                    │ │
│  │  ├── routes/coms.ts — messaging                     │ │
│  │  ├── routes/scheduler.ts — cron jobs                │ │
│  │  └── core/game-service.ts — business logic          │ │
│  └─────────────────────────┬───────────────────────────┘ │
│                            │                             │
│  ┌─────────────────────────▼───────────────────────────┐ │
│  │  Redis (Devvit KV)                                  │ │
│  │  Hashes, Sorted Sets, Strings                       │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow

### Login Sequence
1. Client loads → `bridge.setShipShape('scout')` (default)
2. POST `/api/profile` → claim home star → return profile + claims
3. Client restores position, discovered stars, journey state
4. Immediate fetch `/api/ships?starIndex=homeStar` → restore correct ship shape
5. Start polling intervals (economy 5s, ghosts 1s, shots 1s)

### Game Loop Cycle (every 5s via `pollEconomy`)
1. GET `/api/economy` → server runs `tickStarEconomy(now)` → returns resources/rates/buildings
2. GET `/api/ships` → server runs `reconcileShipBuilding(now)` → returns fleet + building state
3. Client updates local state, re-renders panels

### User Action Pattern
1. Client sends POST (e.g. `/api/ships/upgrade`)
2. Server validates (ownership, resources, dock level)
3. Server mutates Redis state (deduct resources, start timer)
4. Server returns new state
5. Client updates locally from response

### Lazy Reconciliation (Critical Pattern)
The server **never runs background timers** for builds. All completion is lazy:
- Load raw state from Redis
- Check if `completeAt <= Date.now()`
- If yes: mutate in-memory (add ship/advance building)
- Save back to Redis only if state changed
- Functions: `reconcileShipBuilding()`, `reconcileStarBuildings()`, `tickStarEconomy()`

---

## 3. Redis Schema

### Player Data
| Key Pattern | Type | Contents |
|---|---|---|
| `profile:{username}` | Hash | `economy` (JSON), `ships` (JSON), `lastPosition`, `discoveredStars`, `journey`, `skins` |
| `achievements:{username}` | Hash | One field per milestone (`colony_1`, `ship_destroyer`, etc.) |
| `score:{username}` | String | Power score (sum of building levels + ship counts) |
| `complete_charges:{username}` | String | Blueprint instant-build charges |
| `sensor_alerts:{username}` | List | Pending audio alert IDs |

### Economy Profile (inside `profile:{username}.economy`)
```json
{
  "homeStar": 42,
  "stars": {
    "s:42": {
      "store": { "ore": 500, "food": 300, "energy": 400, "fuel": 100 },
      "rates": { "ore": 5, "food": 3, "energy": 4, "fuel": 0 },
      "cap": 2000,
      "buildings": {
        "station": { "level": 2, "status": "ACTIVE", "completeAt": null },
        "mine": { "level": 3, "status": "BUILDING", "completeAt": 1723100000000 }
      },
      "lastTickMs": 1723099000000
    }
  }
}
```

### Ships Profile (inside `profile:{username}.ships`)
```json
{
  "stars": {
    "s:42": {
      "ships": [{ "typeId": 3, "count": 1 }, { "typeId": 8, "count": 1 }],
      "building": { "typeId": 4, "completeAt": 1723100000000 }
    }
  },
  "transits": [
    { "typeId": 3, "fromStar": 42, "toStar": 17, "arriveAt": 1723105000000 }
  ]
}
```

### World/Multiplayer Data
| Key Pattern | Type | Contents |
|---|---|---|
| `registry:{postId}` | Hash | Star claims: `s:42` → `username` or `username:bodyIndex` |
| `poses:{postId}:{tier}:{starIndex}:{bodyIndex}` | Hash | Player positions (JSON per session) |
| `shots:{postId}:{tier}:{starIndex}:{bodyIndex}` | Hash | Active projectiles |
| `pods:{postId}:{starIndex}:{bodyIndex}` | Hash | Claimed pod IDs |
| `audit:{postId}` | Sorted Set | Events scored by timestamp |
| `app:active_post_id` | String | Current game post ID |
| `app:dev_mode` | String | `'1'` if debug UI enabled |

### Alliance Data
| Key Pattern | Type | Contents |
|---|---|---|
| `alliance:{id}` | Hash | name, tag, owner, members (JSON array) |
| `player_alliance:{username}` | String | Alliance ID |
| `alliance_invites:{username}` | Sorted Set | Pending invites (scored by expiry) |
| `alliance_chat:{id}` | Sorted Set | Chat messages (scored by timestamp) |

### Trading & DMs
| Key Pattern | Type | Contents |
|---|---|---|
| `tradeStation:{postId}:s:{starIndex}` | Hash | Stock levels per resource |
| `dm:{postId}:{userA}:{userB}` | Sorted Set | DM messages (scored by timestamp) |
| `dm:unread:{postId}:{user}` | Sorted Set | Senders with unread messages |

---

## 4. Client Architecture

### Files
| File | Role |
|---|---|
| `src/client/game.ts` | **Orchestrator** — profile load, all polling intervals, UI event handlers, admin panel |
| `src/client/splash.ts` | Self-contained splash mini-game (asteroid belt with pods) |
| `src/client/loader.ts` | Deferred loader — shows splash, lazy-loads full game on "Play" |
| `src/client/inline.ts` | Inline/attract mode — game running with "Play Here" overlay |

### Polling Intervals
| Interval | Frequency | Endpoint | Purpose |
|---|---|---|---|
| `pollGhosts` | 1s | `/api/room-poses` | Multiplayer ghost positions |
| `pollShots` | 1s | `/api/shots` | Projectile sync |
| `pollEconomy` | 5s | `/api/economy` + `/api/ships` | Resources, buildings, fleet |
| `savePositionIfChanged` | 5s | POST `/api/save-position` | Persist player location |
| `pollComsLoop` | 2s | `/api/coms/*` | DMs, public chat, unread |
| `statsHeartbeat` | 30s | POST `/api/telemetry/heartbeat` | Analytics |

### Ship Shape Restoration
The player's displayed ship type comes from their **home star fleet** only:
1. `getFleetShape(homeFleet.ships)` — iterates upgrade path from highest to lowest
2. Returns shape of first ship with `count > 0`
3. Defaults to `'scout'` if none found
4. Updated immediately on profile load AND during every economy poll

---

## 5. Game Engine Architecture

### Files (`src/game/`)
| File | Role |
|---|---|
| `game-loop.ts` | 60fps update/draw cycle, physics integration, state machine |
| `renderer.ts` | All Canvas2D drawing (~6500 lines): galaxy/system/planet views, dock panel, fleet panel, HUD, transfer mode |
| `galaxy.ts` | World generation: 100 stars, system bodies (planets/belts), navigation tiers |
| `ship.ts` | Ship polygon shapes, movement physics, avoidance |
| `camera.ts` | Dynamic zoom, tier-specific ortho sizes, safe zones |
| `input.ts` | Pointer/touch/keyboard, drag, fire requests |
| `bridge.ts` | Engine↔client interface (poses, pods, shots, multiplayer) |
| `pods.ts` | Fuel pod generation, collection detection, floating text feedback |
| `asteroids.ts` | Procedural polygon asteroids, ring/belt generation, collisions |
| `shooting.ts` | Burst-fire projectiles, auto-aim, HP/invulnerability, hit detection |
| `ghosts.ts` | Remote player interpolation from polling data |
| `dock.ts` | Proximity docking detection, approach animation |
| `journey.ts` | Tutorial/onboarding — pulse hints until first real action |
| `audio.ts` | 30+ WAV sound effects via Web Audio API |
| `skin.ts` | Swappable render styles (procedural/raster) |
| `math.ts` | Vec2 ops, seeded RNG, stable hash |
| `types.ts` | All game state types (GameState, Ship, Ghost, etc.) |
| `constants.ts` | All tuning values (speeds, sizes, fuel rates, colors) |

### Navigation Tiers
```
Galaxy (100 stars, ortho 10-55)
  └── System (star + orbiting bodies)
       └── Local (asteroid ring around a body)  [DEPRECATED — merged into Planet]
            └── Planet (asteroid belt, pods, docking)
```

Tier transitions happen in `checkTierTransition()` based on zoom level and proximity.

### GameState Key Fields
```typescript
interface GameState {
  ship: Ship;           // position, velocity, angle, thrust
  asteroids: Asteroid[];
  pods: FuelPod[];      // collectible items in belt
  ghosts: Ghost[];      // other players
  camera: Camera;
  fuelUnits: number;
  galaxy: GalaxyState;  // tier, stars, bodies, current indices
  dock: DockState | null;
  shooting: ShootingState;
  floatTexts: FloatText[];  // rising text on pod collection
}
```

---

## 6. Server Architecture

### Route Mounting (`src/server/index.ts`)
```
app.route('/api', api);              // Main gameplay
app.route('/api/telemetry', telemetry);
app.route('/api/coms', coms);
app.route('/api/alliance', alliance);
app.route('/api/bots', bots);
app.route('/internal', internal);     // Scheduler triggers
```

### Key Endpoints (`routes/api.ts`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/init` | Initialize session, get postId + config |
| POST | `/profile` | Load/create player profile, claim home star |
| GET | `/economy` | Tick + return star resources/buildings |
| POST | `/build` | Start building construction |
| POST | `/complete-building` | Instant-complete with blueprint charge |
| GET | `/ships` | Load star fleet (with lazy reconciliation) |
| POST | `/ships/buy` | Purchase new ship |
| POST | `/ships/upgrade` | Upgrade ship (consumes source, starts build) |
| GET | `/fleet/all` | All ships across all stars |
| POST | `/fleet/transfer` | Move ships between stars |
| POST | `/fleet/freighter-route` | Set automated hauling route |
| POST | `/fleet/raid-route` | Set offensive raid route |
| POST | `/colonize` | Claim a star (consumes colony ship) |
| POST | `/explore` | Roll planet discovery |
| POST | `/trade` | Execute trade at trade station |
| GET | `/debug/audit` | Admin: view audit log |
| GET | `/debug/profile-raw` | Admin: dump raw Redis data |

### Business Logic (`core/game-service.ts`)
Central ~1900 line file containing:
- `loadProfile()` / `saveEconomyProfile()` — player data CRUD
- `tickStarEconomy()` — advance resources by rates × elapsed time
- `reconcileStarBuildings()` — complete buildings past their timer
- `reconcileShipBuilding()` — complete ship builds past their timer
- `upgradeShip()` — remove source ship, start target build
- `loadStarShips()` — load fleet with reconciliation + scout seeding
- `transferShips()` — move ships between stars (creates transit)
- `colonizeStar()` — consume colony ship, claim star, seed economy
- `loadAllFleet()` — aggregate fleet across all stars

---

## 7. Ship Lifecycle

```
           upgradeShip()
Scout ──────────────────► Building (completeAt = now + buildSeconds)
  │                              │
  │  sourceSlot.count -= 1       │  reconcileShipBuilding()
  │  ships filtered (count>0)    │  (on next /api/ships read)
  │                              ▼
  │                       Destroyer added to ships[]
  │                       building = null
  │                       state saved to Redis
  │
  └── If no upgrade-path ship at home star AND no building:
      loadStarShips() seeds a virtual Scout (in-memory only)
```

**Upgrade Path:** Scout(1) → Destroyer(3) → Frigate(4) → Battleship(5) → Cruiser(6) → Dreadnought(7)

**Special Ships:** Colony Ship(8), Probe(11/12), Freighter(2), Raider(15)

**Ship Shape Display:** Determined by `getFleetShape(homeFleet.ships)` — highest upgrade-path ship with count > 0 at the player's HOME star.

---

## 8. Building Lifecycle

```
READY ──► beginBuilding() ──► BUILDING (completeAt set)
                                    │
                                    │  reconcileStarBuildings() on next read
                                    ▼
                               ACTIVE (level incremented)
                                    │
                                    │  next upgrade available when:
                                    │  - resources sufficient
                                    │  - station level prerequisite met
                                    ▼
                               READY (for next level)
```

**9 Building Types:** station, mine, solar, hab, warehouse, dock, shield, cannon, refinery

**Prerequisites:** Buildings unlock at specific station levels. Some buildings (hab, warehouse, shield, cannon, refinery) start as LOCKED.

**Station Cap:** Other buildings cannot exceed the station level. E.g. Station Lv2 caps all other buildings at Lv2.

---

## 9. Economy System

### Resources
| Resource | Source | Used For |
|---|---|---|
| Ore | Mine building, exploration, pods | Ship/building construction |
| Food | Hab building (via solar), exploration, pods | Ship/building construction |
| Energy | Solar building, exploration, pods | Ship/building construction |
| Fuel | Refinery building, exploration, pods, trade | Ship transfers, probe launches |

### Tick Calculation
```
elapsed = (now - lastTickMs) / 1000
newStore[resource] = min(store[resource] + rates[resource] * elapsed, cap)
```

**Rates** come from building levels (mine → ore, solar → energy, hab → food, refinery → fuel).  
**Cap** comes from warehouse level (base 1000, +500 per warehouse level).

---

## 10. Exploration System

One exploration attempt per planet per player. Deterministic result based on seeded RNG:

| Kind | Weight | Amount | Sound |
|---|---|---|---|
| nothing | 30 | — | `scan_nothing_planet` / `scan_nothing_station` |
| ore | 18 | 100-300 | `scan_ore` |
| food | 14 | 100-250 | `scan_food` |
| energy | 14 | 100-250 | `scan_energy` |
| fuel | 5 | 50-150 | `scan_fuel` |
| artifact | 10 | 1 | `scan_artifact` |
| blueprint | 6 | 1 | `scan_blueprint` |
| anomaly | 3 | 1 | `scan_anomaly` |

Resource discoveries are added to the star's economy store. Artifacts/blueprints/anomalies trigger special effects.

---

## 11. Trading System

~5% of stars are deterministically designated as **Trade Stations** (based on star index).

### Mechanics
- Each station stocks 4 resources with fluctuating supply
- Exchange rates are dynamic: selling lowers price, buying raises it
- **Lazy-tick restocking**: stations drift toward equilibrium over time
- Rates calculated in `shared/trading.ts` (shared between client preview and server execution)

### Redis: `tradeStation:{postId}:s:{starIndex}`
Hash with stock levels per resource type, last tick timestamp.

---

## 12. Combat System

### Client-Side (shooting.ts)
- Burst-fire projectiles (3-round bursts)
- Auto-aim at nearest ghost within range
- HP system (3 HP default), invulnerability frames on hit
- Hit detection against ghost ship positions

### Server-Side
- **Raid Routes:** Player sends raider ship to target star
- **Ion Cannon:** Building defense (cannon building level)
- **Shields:** Toggle on/off (shield building), blocks damage while active
- Shots shared between players via polling (`/api/shots`)

---

## 13. Multiplayer Presence

### Pose Reporting (Client → Server)
Every ~1s, client POST `/api/report-pose` with:
```json
{ "sessionId": "...", "tier": 3, "starIndex": 42, "bodyIndex": 0,
  "x": 12.5, "y": 8.3, "ang": 1.57, "thrust": true, "shape": "destroyer" }
```

### Ghost Rendering (Server → Client)
GET `/api/room-poses` returns all other players in the same tier/star/body. Client interpolates between poll snapshots for smooth movement.

### Pod Claiming
First-write-wins via Redis hash. Client marks pod as `claimRequested`, server confirms ownership. Other clients see pod disappear on next poll.

---

## 14. Alliance System

### Lifecycle
1. Create alliance (name + 3-letter tag) — creator becomes owner
2. Invite players (24h expiry, stored in sorted set scored by expiry time)
3. Accept/reject invites
4. Alliance chat (sorted set, last 50 messages shown)
5. Kick members (owner only)
6. Leave alliance

### Redis Keys
- `alliance:{id}` — hash with metadata + member list
- `player_alliance:{username}` — current alliance ID
- `alliance_invites:{username}` — sorted set of pending invites
- `alliance_chat:{id}` — sorted set of messages

---

## 15. Communications

### Channels
| Channel | Transport | Storage |
|---|---|---|
| Public Chat | Reddit comments on game post | Reddit API |
| Direct Messages | REST poll | `dm:{postId}:{userA}:{userB}` sorted set |
| Fleet Command | Video DM | Feature-flagged, stored as DM with video URL |
| Alliance Chat | REST poll | `alliance_chat:{id}` sorted set |

### Fleet Command Videos
Triggered on milestones (colony ship build start). Sends a DM containing a video URL from `VIDEO_CATALOG` in `feature-flags.ts`.

### Unread Tracking
- `dm:unread:{postId}:{user}` — sorted set of senders with unread messages
- Client polls `/api/coms/unread` to show notification badges

---

## 16. Autobot (NPC AI)

**Identity:** `VALCORDIA_PROBE` — appears as a real player in the game world.

### FSM States
```
DORMANT → ECONOMY → SHIPYARD → EXPLORE → ROAM → COLONIZE → CHATTER
    ▲                                                          │
    └──────────────────────────────────────────────────────────┘
```

| State | Behavior |
|---|---|
| DORMANT | Wait for activation trigger |
| ECONOMY | Build mine/solar/hab in optimal order until targets met |
| SHIPYARD | Build/upgrade ships (destroyer, colony ship) |
| EXPLORE | Scan nearby planets for resources |
| ROAM | Travel to discovered stars, report poses |
| COLONIZE | Send colony ship, claim new star, seed economy |
| CHATTER | Post in alliance chat (flavor text) |

### Execution
- Scheduled via `routes/scheduler.ts` (periodic tick)
- Uses the **same game-service functions** as real players
- State stored in `autobot:VALCORDIA_PROBE` Redis key
- Generates sensor alerts for other players when entering their systems

---

## 17. Admin Testing Bots

Separate from the Autobot NPC. Admin-only FSM bots for testing the alliance system:

| Bot Role | Behavior |
|---|---|
| `alliance-manager` | Creates alliance, invites players, posts chat messages |
| `alliance-member` | Waits for invite, accepts, posts chat messages |

Triggered manually via admin panel buttons. State in `bots:state:{name}`.

---

## 18. Achievements & Leaderboard

### Achievements (`core/achievements.ts`)
One-time milestones posted as Reddit comments:
- First colony, 2nd colony, 3rd colony
- Ship upgrades (destroyer, frigate, battleship, cruiser, dreadnought)
- Dock tier milestones (Lv3, Lv5)
- First fleet transfer

Tracked per-player in `achievements:{username}` hash (prevents duplicates).

### Leaderboard
- **Weekly** automated Reddit comment via scheduler
- Top 10 players ranked by power score
- Power score = sum of all building levels + ship counts across all stars

---

## 19. Colonization Flow

```
1. Build Colony Ship (typeId=8) at home star dock
2. Transfer colony ship to target star (transit timer)
3. Arrive at target star
4. Click "Colonize" at target star
5. Server: consume colony ship, claim star (first-write-wins), seed economy
6. New colony starts with: Station Lv1, Dock Lv1, 640 of each resource
```

**Star Discovery Levels:**
- Unknown → Probed (probe sent) → Visited (player traveled there) → Colonized (claimed)

---

## 20. Sensor Alert System

Fire-and-forget audio cues when foreign ships enter a player's star system.

### Flow
1. Ship transit arrives at target star (reconciled on read)
2. Server pushes alert to `sensor_alerts:{starOwner}` list
3. Client polls `/api/sensor-alerts` on economy cycle
4. Client plays appropriate sound (`hostile_raider`, `unidentified_ship`, `ship_entered`)

---

## 21. Freighter & Raid Routes

### Freighter Routes
- Player sets automated hauling: source star → destination star
- Freighter (typeId=2) moves on timer, transfers resources on arrival
- Continuous loop until cancelled

### Raid Routes
- Player sends Raider (typeId=15) to enemy star
- On arrival: combat resolution against defenses (shields, cannons)
- Success: steal resources. Failure: raider destroyed.

---

## 22. Tutorial/Journey System

Progressive onboarding for new players:

1. Journey starts on first load (if no `journeyDone` flag)
2. Pulse hints appear on UI tabs (building, fleet, etc.)
3. Journey progresses on first real actions (claim star, build, upgrade)
4. Completes and sets `journeyDone` flag

Implemented in `game/journey.ts` with progress milestones reported to Devvit Journeys telemetry.

---

## 23. Skins & Visual Modes

Two render styles, toggled via settings panel:
- **Procedural (wireframe):** Minimalist vector graphics, colored lines
- **Raster:** Sprite-based rendering with textures

Skin selection persisted in localStorage. Toggle button in settings panel (admin-visible).

---

## 24. Audio System

30+ WAV voice lines and sound effects served from `/public/sounds/`.

### Categories
| Category | Examples |
|---|---|
| Navigation | `leaving_orbit`, `undocking`, `undocking_alt` |
| Economy | `begin_building`, `construction_complete`, `insufficient_resources` |
| Fleet | `begin_ship_upgrade`, `begin_building_ship`, `freighter_arrived` |
| Discovery | `scan_ore`, `scan_food`, `scan_energy`, `scan_fuel`, `scan_artifact`, `scan_anomaly`, `scan_blueprint` |
| Combat | `hostile_raider`, `unidentified_ship`, `shields_activated` |
| Social | `new_comm`, `fleet_command` |

All URLs cache-busted with `version.json` version string. Web Audio API playback with volume control.

---

## 25. Build & Deploy

### Deploy Command
```bash
npm run ship
```
Executes: `tsc --build` → `eslint` → version bump → `devvit upload` → `devvit install`

### Version Management
- `version.json` — single source of truth, auto-incremented on each deploy
- Used for sound/asset cache busting

### File Structure
```
src/
├── client/       # Browser entry points (game.ts, splash.ts, loader.ts)
├── game/         # Game engine (game-loop, renderer, physics, audio)
├── server/       # Hono routes + business logic
│   ├── routes/   # HTTP endpoint handlers
│   └── core/     # Shared server logic (game-service, achievements, etc.)
└── shared/       # Types & logic shared between client and server
```

### Key Config
- `tsconfig.json` — `exactOptionalPropertyTypes: true` (use conditional spread, not `undefined`)
- Admin users: hardcoded in `core/admin-auth.ts` (`DEV_USERS`)
- Feature flags: `shared/feature-flags.ts`

---

## 26. Known Patterns & Pitfalls

| Pattern | Detail |
|---|---|
| Lazy reconciliation | Server never runs timers. All completion checked on read. |
| Home star only | Ship shape display comes from home star fleet, not current location. |
| Scout seeding | If home star has no upgrade-path ship AND no building, a virtual Scout is injected (in-memory only, not persisted). |
| First-write-wins | Star claims and pod collection use Redis atomic writes — no locks needed. |
| `exactOptionalPropertyTypes` | Cannot assign `undefined` to optional fields. Use `...(value ? { field: value } : {})` pattern. |
| `postId` scoping | All multiplayer data is scoped to a Reddit post. Different posts = separate game instances. |
| Audit is append-only | `audit:{postId}` sorted set, scored by timestamp. Never deleted. |
| Economy poll drives reconciliation | The 5s economy poll triggers server-side build completion. If client never polls, builds remain in limbo until next session. |
| Admin panel | Gated by `ADMIN_USERS` check client-side AND `requireDev` middleware server-side. |
| Sound cache busting | All WAV URLs include `?v=${version}` to force re-download after deploys with new audio. |
