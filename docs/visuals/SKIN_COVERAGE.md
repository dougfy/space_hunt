# SpaceHunt Skin × Building Coverage

## Buildings (9 types)

| BuildType   | Label       | FeatureType    | Max Lv |
|-------------|-------------|----------------|--------|
| `station`   | Station     | `station`      | 8      |
| `mine`      | Mine        | `mine`         | 8      |
| `solar`     | Solar Array | `solar_array`  | 8      |
| `hab`       | Hab         | `colony`       | 8      |
| `warehouse` | Warehouse   | `warehouse`    | 8      |
| `dock`      | Space Dock  | `dock`         | 5      |
| `shield`    | Shield Gen  | `shield`       | 5      |
| `cannon`    | Ion Cannon  | `cannon`       | 5      |
| `refinery`  | Refinery    | `refinery`     | 3      |

Additional non-building FeatureTypes: `relay`, `outpost`, `mine_l2`, `solar_array_l2`

## Skins (4 types)

| SkinId       | Label     | Implementation                      | Status   |
|--------------|-----------|-------------------------------------|----------|
| `procedural` | Wireframe | Canvas line-art (`procedural.ts`)   | Complete |
| `raster`     | Standard  | PNG sprites (`raster.ts`)           | Partial  |
| `scifi`      | Sci-Fi    | Reuses raster + scifi station PNGs  | Partial  |
| `cartoon`    | Cartoon   | Not implemented                     | Locked   |

## Coverage Matrix

| Building      | procedural       | raster              | scifi               | cartoon |
|---------------|------------------|----------------------|----------------------|---------|
| **Station**   | ✅ custom (3 tiers) | ✅ per-level sprites (1-8) | ✅ unique sci-fi sprites (1-8) | 🔒 |
| **Mine**      | ✅ custom (3 tiers) | ⚠️ generic starbase sprite | ⚠️ generic starbase sprite | 🔒 |
| **Solar**     | ✅ custom (3 tiers) | ⚠️ generic starbase sprite | ⚠️ generic starbase sprite | 🔒 |
| **Hab**       | ✅ custom (3 tiers) | ⚠️ generic starbase sprite | ⚠️ generic starbase sprite | 🔒 |
| **Warehouse** | ✅ custom (3 tiers) | ⚠️ generic starbase sprite | ⚠️ generic starbase sprite | 🔒 |
| **Dock**      | ✅ custom (3 tiers) | ⚠️ generic starbase sprite | ⚠️ generic starbase sprite | 🔒 |
| **Shield**    | ✅ custom (3 tiers) | ❌ falls back to procedural | ❌ falls back to procedural | 🔒 |
| **Cannon**    | ✅ custom (3 tiers) | ❌ falls back to procedural | ❌ falls back to procedural | 🔒 |
| **Refinery**  | ✅ custom (3 tiers) | ⚠️ generic starbase sprite | ⚠️ generic starbase sprite | 🔒 |

### Legend
- ✅ = Building-specific custom art
- ⚠️ = Has a sprite, but it's a generic starbase PNG (not visually distinct per building type)
- ❌ = No sprite at all — falls back to procedural wireframe
- 🔒 = Skin is locked / not implemented

## Key Gaps

### Critical (visual inconsistency)
1. **Shield & Cannon have no raster/scifi sprites** — render as procedural wireframes even when player is using raster or sci-fi skin

### Moderate (visual variety)
2. **Raster sprites are generic** — mine, solar, hab, warehouse, dock, refinery all reuse the same starbase PNG at fixed levels. They look like stations, not distinct buildings.
3. **Sci-fi only has unique station art** — everything else is identical to raster

### Future
4. **Cartoon skin is fully locked** — type exists, UI shows it as locked, no art or code

## File Locations

- Skin registry: `src/game/skin.ts`
- Procedural drawing: `src/game/skins/procedural.ts`
- Raster drawing: `src/game/skins/raster.ts`
- Sci-fi sprites: `src/game/skins/scifi.ts`, `public/icons/skins/scifi/`
- Raster sprites: `public/icons/bases2/`
- Skin picker UI: `src/game/renderer.ts` (~line 6126)
- Feature icon dispatch: `src/game/renderer.ts` `drawFeatureIcon()`
