# Fleet Management UI — Mock Renderings

## Visual Mockups (SVG)

| Mockup | File |
|--------|------|
| Ship Status Icons | [mockups/ship-status-icons.svg](mockups/ship-status-icons.svg) |
| Ship Type Silhouettes | [mockups/ship-type-silhouettes.svg](mockups/ship-type-silhouettes.svg) |
| Fleet Command Panel | [mockups/fleet-command-panel.svg](mockups/fleet-command-panel.svg) |
| Move Order Flow (3 steps) | [mockups/move-order-flow.svg](mockups/move-order-flow.svg) |
| Galaxy Map with Badges | [mockups/galaxy-map-badges.svg](mockups/galaxy-map-badges.svg) |
| Transit Detail View | [mockups/transit-detail.svg](mockups/transit-detail.svg) |
| Ship Info Panel | [mockups/ship-info-panel.svg](mockups/ship-info-panel.svg) |

---

## Design Metaphor: Fleet Command (CIC)

Naval command center aesthetic. Green-on-black terminal look matching existing dock panel.
Player is an admiral issuing orders from their station.

---

## 1. Fleet Command Panel (Docked View)

Accessed via SHIPS button → tabs between BUILD and FLEET.

```
┌──────────────────────────────────────────────────────────┐
│  ─── FLEET COMMAND ──────────────────────────────────── │
│                                                          │
│  [BUILD]  [FLEET]                    ← tab toggle       │
│                                                          │
│  ★ QUOEN I  ───────────────────────  ⚓3  ⏸1           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  🔹 Scout           x1    ⚓ DOCKED              │   │
│  │  🔹 Freighter       x1    ⚓ DOCKED              │   │
│  │  🔹 Basic Probe     x1    ⏸ IDLE                 │   │
│  │  🔸 Destroyer       x1    → VEGA III  (3:24)     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ★ VEGA III  ──────────────────────  ⚓1               │
│  ┌──────────────────────────────────────────────────┐   │
│  │  🔹 Scout           x2    ⚓ DOCKED              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ── IN TRANSIT ─────────────────────────────────────    │
│  ┌──────────────────────────────────────────────────┐   │
│  │  🔸 Destroyer x1   QUOEN I → VEGA III   (3:24)  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ── BUILDING ───────────────────────────────────────    │
│  ┌──────────────────────────────────────────────────┐   │
│  │  ⚙ Scout @ QUOEN I          ████░░░░░░  62%     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Ship Row States

Each ship row has a status indicator icon + color:

| Status    | Icon | Color        | Description                    |
|-----------|------|--------------|--------------------------------|
| DOCKED    | ⚓   | Bright green | Parked at a station            |
| IDLE      | ⏸    | Medium green | At star, not docked            |
| IN-TRANSIT| →    | Yellow/amber | Moving between stars           |
| BUILDING  | ⚙    | Dim green    | Under construction             |

### Selected Ship Row (highlighted):
```
│  ▶ Scout           x1    ⚓ DOCKED     [MOVE] [INFO]  │
```

### Unselected Ship Row:
```
│  🔹 Scout           x1    ⚓ DOCKED                    │
```

---

## 3. Move Order Flow

### Step 1: Select ship → tap MOVE
```
┌──────────────────────────────────────────────────────────┐
│  ─── FLEET COMMAND ──────────────────────────────────── │
│                                                          │
│  ★ QUOEN I                                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  ▶ Scout           x1    ⚓ DOCKED               │   │
│  │                          [MOVE]  [INFO]           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  SELECT DESTINATION ON MAP                               │
│  (tap a star to set course)                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Step 2: Galaxy map highlights valid destinations
```
         ·                    ·
     ·       ·            ·
        · ★QUOEN I·          · ·
   ·        ↑              ·
      ·    [YOU]    ·  ○VEGA III     ← pulsing ring = valid
         ·       ·        ·
    ·        ·       ○DENEB V        ← pulsing ring = valid
       ·          ·
```

### Step 3: Confirm order
```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│         MOVE SCOUT TO VEGA III?                          │
│                                                          │
│         Distance: 4.2 ly                                 │
│         ETA: 5m 12s                                      │
│         Speed: 7                                         │
│                                                          │
│              [CONFIRM]     [CANCEL]                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Galaxy Map — Fleet Badges

Stars with ships show a badge count. In-transit shows animated dotted line.

```
                    ·  ·
        ·                    ·
   ·        ★ QUOEN I [⬡4]
      ·        \                    ·
         ·      \· · · · · ·              ← dotted transit line
    ·            \         \
       ·          ★ VEGA III [⬡2]
  ·         ·          ·
       ·         ·
```

### Badge styling:
- `[⬡4]` — ship count inside hexagon icon
- Bright green if ships present
- Pulsing if ships arriving/departing
- No badge if zero ships

---

## 5. Ship Info Panel

Tapping [INFO] shows full ship stats:

```
┌──────────────────────────────────────────────────────────┐
│  ─── SHIP INFO ─────────────────────────────────────── │
│                                                          │
│  SCOUT                                                   │
│  ─────────────────────────────                          │
│                                                          │
│       ◇                                                  │
│      ╱ ╲         ATK: 10                                │
│     ╱   ╲        DEF: 20                                │
│    ╱─────╲       SPD: 7                                 │
│     │ │ │        TRN: 0                                 │
│     ▼ ▼ ▼        PTS: 1                                │
│                                                          │
│  Location: QUOEN I                                       │
│  Status:   DOCKED                                        │
│  Tier:     1                                             │
│                                                          │
│                   [MOVE]  [BACK]                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 6. In-Transit Detail (tapping transit row)

```
┌──────────────────────────────────────────────────────────┐
│  ─── IN TRANSIT ────────────────────────────────────── │
│                                                          │
│  DESTROYER                                               │
│                                                          │
│  QUOEN I ─────────●────────────── VEGA III              │
│                   ↑                                      │
│               current position                           │
│                                                          │
│  Departed:  2m 36s ago                                   │
│  Arriving:  3m 24s                                       │
│  Progress:  ████████░░░░░░░░░░  43%                     │
│                                                          │
│                        [BACK]                            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Canvas Icon Designs (for renderer.ts)

### Ship type mini-icons (8x8px, drawn on canvas):

```
SCOUT:          FREIGHTER:      DESTROYER:      PROBE:
   ◇               ▬▬              ◆◆             ·
  ╱ ╲            ╔════╗           ╱══╲           ╱ ╲
 ╱   ╲           ║    ║          ╱════╲          ·─·
  │ │             ╚════╝          ║  ║
  ▼ ▼              ││             ▼▼▼▼
```

### Status badge icons (drawn in canvas):

```
DOCKED (⚓):     IDLE (⏸):      TRANSIT (→):    BUILDING (⚙):
  ╭─╮             ║ ║            ──▶             ╭─╮
  │●│             ║ ║                             │◊│
  ╰┬╯             ║ ║                             ╰┬╯
   │                                               │
  ~~~                                             ···
```

---

## 8. Color Palette (existing game colors)

| Token    | Hex       | Usage                          |
|----------|-----------|--------------------------------|
| G_BRIGHT | `#4fffb0` | Active/enabled text & borders  |
| G_MED    | `#2a9968` | Secondary text, labels         |
| G_DIM    | `#1a5c3f` | Disabled, hint text            |
| G_FAINT  | `#0d3020` | Inactive borders               |
| AMBER    | `#ffb84d` | In-transit highlights          |
| RED      | `#ff4f4f` | Alerts, combat (future)        |

---

## 9. Implementation Phases

### Phase 1 — Data Model
- Add `ShipInstance` with unique ID, location, status, destination, departedAt, arrivalAt
- Migrate from count-based (`{typeId, count}`) to instance-based tracking
- Server reconciliation for transit completion

### Phase 2 — Fleet Roster Panel
- BUILD/FLEET tab toggle on ship panel
- Roster grouped by star location
- Status indicators per ship

### Phase 3 — Move Orders
- Select ship → MOVE button → tap star → confirm
- Server records transit with departure/arrival times
- Client shows countdown

### Phase 4 — Galaxy Map Integration
- Fleet badges on stars
- Transit lines (animated dotted)
- Pulsing indicators for activity

### Phase 5 — Polish
- Ship info detail panel
- Transit progress visualization
- Arrival notifications
- Sound cues (future)

---

## 10. Panel Sizing

| Panel            | Width        | Height      | Position           |
|------------------|--------------|-------------|-------------------|
| Fleet Command    | 480px max    | 280px       | Bottom center      |
| Move Confirm     | 240px        | 160px       | Center screen      |
| Ship Info        | 320px        | 240px       | Center screen      |
| Galaxy Badge     | 24x16px      | —           | Adjacent to star   |

---

## Open Questions

1. **Instance-based vs count-based ships?**
   - Count-based is simpler but can't track individual ship movement
   - Recommend: split into instances when moving, re-merge counts at destination
   - e.g., "Move 1 of 3 Scouts" creates 1 instance in-transit, leaves 2 at origin

2. **Can ships move while not docked?**
   - Recommendation: Yes, from fleet panel (no need to be at that star's dock)

3. **Maximum fleet size per star?**
   - Unlimited for now; could add berth limit tied to dock level later

4. **Can you send multiple ships together?**
   - V1: one at a time. V2: multi-select for fleet dispatch
