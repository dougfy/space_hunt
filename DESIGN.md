# Valcordia Space — Game Design & Architecture

## Game Description

Valcordia Space is a multiplayer space exploration game built on Reddit's Devvit platform. Players pilot ships through a procedurally generated galaxy, navigating between stars, planetary systems, asteroid belts, and planet surfaces. The game uses a hierarchical coordinate system where each "tier" represents a different zoom level into the same spatial structure — like Google Maps for space.

Players collect fuel pods, dock at stations, encounter other players as ghost ships, and navigate through asteroid fields. The core gameplay loop involves exploring increasingly detailed environments while managing fuel and avoiding collisions.

## Coordinate System — Hierarchical Tiers

The game uses a **nested coordinate hierarchy** where each tier is a magnified view of a region in the tier above:

```
Galaxy (100×100 world units)
  └─ Star at absolute position (e.g. 50.2, 47.8)
       └─ System (40×40 units, polar from star center)
            ├─ Planet at (orbitDist, angle) → Planet tier (±4.5 × ±2.8)
            └─ Belt at orbitDist → Local tier (arc section)
                     localX = tangential (along belt ring)
                     localY = radial (through belt, toward/away from star)
```

### Tier 0: Galaxy (`NavigationTier.Galaxy`)

- **Space**: 100×100 units
- **Content**: ~100 stars placed via Poisson-disc sampling
- **Camera**: orthoSize=20, follows ship, clamped to bounds
- **Ship speed**: `GALAXY_SHIP_SPEED` (4.5 u/s)
- **Entry**: Exit from System tier (ship beyond `SYSTEM_EXIT_RADIUS`)
- **Exit**: Ship within `STAR_ENTER_RADIUS` (3.0) of any star → System tier

### Tier 1: System (`NavigationTier.System`)

- **Space**: 40×40 units, center at (20, 20)
- **Content**: 3–8 bodies (planets + belts) at increasing orbital distances
- **Camera**: orthoSize=18, follows ship, clamped to bounds
- **Ship speed**: `SYSTEM_SHIP_SPEED` (1.8 u/s)
- **Body placement**: polar coordinates (orbitDist, angle) from system center
- **Entry**: From Galaxy (near star) or from Local/Planet (exit body)
- **Exit to Galaxy**: Ship distance from center > `SYSTEM_EXIT_RADIUS` (18)
- **Exit to Local**: Ship within `beltTolerance` (0.5) of belt's orbitDist
- **Exit to Planet**: Ship within `BODY_ENTER_RADIUS` (2.0) of planet pos

### Tier 2: Local / Belt (`NavigationTier.Local`)

- **Space**: Rectangle representing an **arc section** of the belt ring
- **Coordinate mapping** (polar ↔ local):
  - `localX` = tangential distance along belt (arc direction)
  - `localY` = radial distance from belt center line
  - `localY > 0` = outward from star (farther from system center)
  - `localY < 0` = inward toward star (closer to system center)
- **Dimensions**: `MAP_HALF_X` (10) tangential × `MAP_HALF_Y` (8) radial
- **Content**: 60 asteroids, fuel pods, player ghosts
- **Camera**: orthoSize=3.2 (zooms in near asteroids), origin-centered with worldOffset scrolling
- **Ship speed**: `SHIP_MAX_SPEED` (0.9 u/s)
- **Boundary scrolling**: Ship stays in safe zone, worldOffset tracks true position
- **Exit (radial/Y)**: `|worldShipPos.y| > MAP_HALF_Y - 0.5` → back to System
  - `worldShipPos.y > 0` → exited outward → place OUTSIDE belt in System
  - `worldShipPos.y < 0` → exited inward → place INSIDE belt in System
- **Exit (tangential/X)**: `|worldShipPos.x| > MAP_HALF_X - 0.5` → update angular position, wrap or exit
- **System placement on exit**: 
  - New angle = `entryAngle + worldShipPos.x / orbitDist`
  - New radius = `orbitDist ± 1.5` based on Y-exit direction

### Tier 3: Planet (`NavigationTier.Planet`)

- **Space**: Small area (~±4.5 × ±2.8 visible)
- **Content**: Planet features (stations, mines, relays, etc.)
- **Camera**: Fixed at origin, orthoSize=3.2
- **Ship speed**: `SHIP_MAX_SPEED` (0.9 u/s), free movement (no scrolling)
- **Exit**: Ship beyond exitX=4.5 or exitY=2.8 → back to System at planet pos + offset

## Module Reference

### `galaxy.ts` — Navigation & World Generation

| Function | Purpose |
|---|---|
| `generateGalaxy(seed)` | Creates star field (Poisson-disc, 100 stars) |
| `generateSystem(star)` | Creates bodies for a star (3–8 planets/belts) |
| `createGalaxyState(seed)` | Initializes full navigation state |
| `checkTierTransition(shipPos, galaxy)` | Detects boundary crossings, returns transition info |
| `applyTransition(galaxy, transition)` | Updates galaxy state, returns new ship position |
| `getLocalSeed(body)` | Deterministic seed for asteroid generation |

**Key types:**
- `NavigationTier` enum: Galaxy, System, Local, Planet
- `GalaxyState`: Current tier, stars, bodies, entry metadata
- `TierTransition`: Describes a tier change (new tier, indices, exit info)

### `game-loop.ts` — Main Loop & State Management

| Function | Purpose |
|---|---|
| `startGame(canvas, seed, name, shape, callbacks)` | Initializes game state and starts animation |
| `update(dt)` | Per-frame update: input → ship → camera → transitions → render |
| `getGameState()` | Access current state for external queries |

**Transition logic** (in `update`):
1. Compute `worldShipPos = ship.pos + worldOffset` (Local/Planet) or `ship.pos` (System/Galaxy)
2. Call `checkTierTransition(worldShipPos, galaxy)`
3. If transition: `applyTransition` → reset ship vel/offset → regenerate content

### `ship.ts` — Ship Movement & Boundary Scrolling

| Function | Purpose |
|---|---|
| `updateShip(state, dt, safeZone)` | Steering, acceleration, boundary scrolling |
| `applyWorldShift(state, shift)` | Moves worldOffset + repositions asteroids/pods |

**Boundary scrolling** (Local tier only):
- Ship clamped within safe zone (±orthoSize × 0.65)
- Overflow → worldShift → worldOffset accumulates
- worldOffset clamped to `±(MAP_HALF - orthoSize)`

### `camera.ts` — Camera & Zoom

| Function | Purpose |
|---|---|
| `updateCamera(state, dt)` | Per-tier camera logic (follow, zoom, clamp) |
| `updateZoomState(state, dt, pixelHeight)` | Proximity-based zoom near asteroids |
| `getSafeZone(camera)` | Computes safe zone for boundary scrolling |

### `renderer.ts` — Canvas Drawing

| Function | Purpose |
|---|---|
| `worldToScreen(pos, camera, w, h)` | World → screen pixel conversion (Y-flipped) |
| `screenToWorld(pos, camera, w, h)` | Screen → world (for click handling) |
| `drawSystemView(r, camera, galaxy, shipPos)` | Renders orbital rings, bodies, labels |
| `drawGalaxyView(r, camera, galaxy, shipPos)` | Renders star field |
| `drawPlanetView(r, camera, galaxy, shipPos)` | Renders planet surface features |
| `drawDebugBounds(r, camera, galaxy, shipPos)` | Debug overlays for radii/tolerances |

**Y-flip**: `worldToScreen` uses `ny = 1 - (...)` so positive world-Y renders toward screen bottom. All game logic uses world coordinates; rendering handles the flip.

### `input.ts` — Click/Tap Handling

| Function | Purpose |
|---|---|
| `setupInput(canvas)` | Registers pointer event listeners |
| `processInput(input, state, camera, w, h)` | Converts screen clicks to world target positions |

### `asteroids.ts` — Asteroid Generation

| Function | Purpose |
|---|---|
| `generateAsteroids(seed)` | Creates 60 asteroids with Poisson-disc placement |

### `pods.ts` — Fuel Pod Generation & Collection

| Function | Purpose |
|---|---|
| `generateFuelPods(asteroids, seed)` | Places pods near asteroid surfaces |
| `checkPodCollection(state)` | Detects ship proximity to pods |
| `applyPodCollected(state, podId, local)` | Awards fuel/docks |

### `shooting.ts` — Combat System

| Function | Purpose |
|---|---|
| `fireBurst(state)` | Creates projectile burst from ship |
| `updateShooting(state, dt)` | Moves projectiles, checks hits |

### `ghosts.ts` — Multiplayer Ghost Ships

| Function | Purpose |
|---|---|
| `updateGhosts(state, ghosts)` | Interpolates other players' positions |

### `math.ts` — Vector & RNG Utilities

Core math: `vec2`, `add`, `sub`, `scale`, `magnitude`, `normalize`, `dot`, `clamp`, `lerp`, `createRng`, `stableHash`

### `constants.ts` — All Magic Numbers

Organized by section: canvas, ship, asteroids, map, zoom, colors, shooting, galaxy/navigation, names.

### `types.ts` — TypeScript Interfaces

`GameState`, `Camera`, `Ship`, `Asteroid`, `FuelPod`, `Ghost`, `ShipShape`, `ShootingState`, `ZoomState`

## Belt Transition Design (Polar Mapping)

### Concept

The belt is a **ring** in the System tier. The Local tier shows a **rectangular section of that ring**. The coordinate mapping is:

```
System (polar):  (r, θ) from system center
                  ↕
Local (cartesian): localX = tangential, localY = radial

Conversion:
  systemAngle = entryAngle + localX / orbitDist
  systemRadius = orbitDist + localY
```

### Entry Flow

1. Ship in System tier reaches belt tolerance zone
2. `checkTierTransition` records: `entryAngle`, `enteredFromInside`
3. `applyTransition` places ship at:
   - `localX = 0` (center of arc section)
   - `localY = -6` if entered from inside (inward edge)
   - `localY = +6` if entered from outside (outward edge)

### Exit Flow (Radial — Y boundary)

1. Ship's `worldShipPos.y` exceeds `±(MAP_HALF_Y - 0.5)`
2. Determine direction:
   - `worldShipPos.y > 0` → exited **outward** (away from star)
   - `worldShipPos.y < 0` → exited **inward** (toward star)
3. Compute angular offset: `Δθ = worldShipPos.x / orbitDist`
4. System placement:
   - angle = `entryAngle + Δθ`
   - radius = `orbitDist + 1.5` (outward) or `orbitDist - 1.5` (inward)
   - pos = `(center + cos(angle) × radius, center + sin(angle) × radius)`

### Exit Flow (Tangential — X boundary)

1. Ship's `worldShipPos.x` exceeds `±(MAP_HALF_X - 0.5)`
2. This means the ship traveled along the ring
3. Update entry angle: `entryAngle += worldShipPos.x / orbitDist`
4. Reset `worldShipPos.x` to opposite edge (wrap around the ring)
5. Ship stays in Local tier with updated angular reference

### Why This Works

- **No Y-flip confusion**: `localY > 0` always means outward regardless of screen rendering
- **X-exits are meaningful**: They represent angular travel along the belt ring
- **Spatial continuity**: Exiting at `localX = 5` with `orbitDist = 12` shifts your system angle by `5/12 ≈ 0.42 rad`
- **Entry side is clear**: Inside → localY negative (toward star), Outside → localY positive (away from star)
- **Crossed-through is trivial**: If you entered from inside (localY = -6) and exit at localY > 0, you crossed the belt

## Rendering Note

`worldToScreen` flips Y (positive world-Y → screen bottom). This means:
- `localY > 0` (outward) renders toward **screen bottom**
- `localY < 0` (inward) renders toward **screen top**

The player entering from inside sees their ship at the **bottom** of screen. Going **up** on screen means going inward (negative Y, toward star). Going **down** on screen means going outward (positive Y, away from star). This is counterintuitive for "crossing through" from inside.

**Resolution**: The game logic does NOT reference screen direction. It only checks `worldShipPos.y > 0` = outward. The renderer handles display. If we want "inside = bottom, outside = top" visually, we simply flip the entry placement:
- Entered from inside → `localY = +6` (outward edge, screen bottom) — wait, this is wrong.

**Correct mapping**: 
- `localY = 0` is the belt center line
- **Positive Y = outward from star** (farther from center)
- **Negative Y = inward toward star** (closer to center)
- Entry from inside → ship was inward, moving outward → place at `localY = -6` (inward edge)
- Crossing through → ship reaches `localY > +7.5` (outward edge) → exits outside belt ✓

The screen rendering is irrelevant to the logic. If we want the visual to show "inward = bottom, outward = top", we can optionally negate Y in the Local tier renderer only, but this is cosmetic.
