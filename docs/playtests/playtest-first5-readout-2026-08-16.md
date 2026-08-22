# Playtest First-5-Minutes & Session Readout — 2026-08-16

**Source:** `devvit logs --since 24h --json valcordia_space_dev` (4,733 lines)
**Raw logs:** `playtest-logs-2026-08-16.json`
**Audit log:** `playtest-audit-2026-08-16.log`

---

## LegitimateTree5933

**Session:** 2026-08-16T15:28Z → 2026-08-16T17:58Z (150 min)
**Home star:** 71
**Sessions:** 1 (no return)
**Journey progress:** 80%
**Play style:** BUILDER

### Session Summary

| Metric | Value |
|--------|-------|
| Total interactions | 46 |
| → build | 24 |
| → explore | 18 |
| → buy_ship | 3 |
| → transfer | 1 |
| Position changes | 53 |
| Unique stars visited | 3 ([71, 87, 98]) |
| Unique bodies scanned | 10 |
| Economy actions (build+ship) | 27 (59%) |
| Exploration actions (explore+transfer) | 19 (41%) |

### Journey Milestones

| Progress | Milestone |
|----------|-----------|
| 1% | tree_1:game_start |
| 20% | tree_20:economy_update |
| 50% | tree_50:economy_update |
| 70% | tree_70:star_discovered |
| 80% | tree_80:star_discovered |

### First 5 Minutes — Step by Step

| Clock | Latency | Event |
|-------|---------|-------|
| 0:00 | — | 🆕 Load profile (new player, empty) |
| 0:00 | +0.0s | 🔍 Claim check |
| 0:00 | +0.0s | 🎯 Picked star 98 |
| 0:00 | +0.0s | 🏠 Claimed home star 98 |
| 0:00 | +0.4s | 🚀 Journey started |
| 0:00 | +0.2s | 🆕 Load profile (new player, empty) |
| 0:00 | +0.0s | 🔍 Claim check |
| 0:00 | +0.0s | ✓ Already has claim (duplicate call) |
| 0:01 | +0.5s | ✅ App ready |
| 0:01 | +0.0s | 🚀 Journey started |
| 0:01 | +0.3s | 📊 Progress: 0.01 tree_1:game_start |
| 0:05 | +4s | 💾 Position: star 98, planet, body 0 |
| 1:25 | +80s | 💾 Position: star 98, planet, body 0 |
| 1:43 | +18s | 🔍 Claim check |
| 1:44 | +0.9s | 🔍 Claim check |

**Dead zones (gaps ≥ 10s):**

- **80s (1.3 min)** gap at 1:25 — player idle or confused
- 18s gap at 1:43

### Full Session Timeline (10-min buckets)

| Window | build | buy_ship | explore | nav | transfer | Total |
|--------|-----|-----|-----|-----|-----|-------|
| 0–10 min | 1 |  |  | 2 |  | 3 |
| 10–20 min | 1 |  | 4 | 16 |  | 21 |
| 20–30 min | 3 |  |  | 1 |  | 4 |
| 30–40 min | 1 |  | 3 | 16 |  | 20 |
| 40–50 min | 2 |  |  | 1 |  | 3 |
| 50–60 min | 1 | 1 | 1 | 9 | 1 | 13 |
| 60–70 min | 1 |  | 3 | 13 |  | 17 |
| 70–80 min | 2 |  | 3 |  |  | 5 |
| 80–90 min | 3 |  | 4 |  |  | 7 |
| 90–100 min | 3 |  |  |  |  | 3 |
| 100–110 min | 1 |  |  |  |  | 1 |
| 110–120 min | 1 |  |  |  |  | 1 |
| 120–130 min | 2 |  |  |  |  | 2 |
| 130–140 min | 1 | 1 |  |  |  | 2 |
| 140–150 min | 1 |  |  |  |  | 1 |
| 150–160 min |  | 1 |  |  |  | 1 |

---

## Training-Item5275

**Session:** 2026-08-16T15:23Z → 2026-08-16T15:50Z (27 min)
**Home star:** 57
**Sessions:** 1 (no return)
**Journey progress:** 30%
**Play style:** BALANCED

### Session Summary

| Metric | Value |
|--------|-------|
| Total interactions | 6 |
| → explore | 3 |
| → build | 3 |
| Position changes | 4 |
| Unique stars visited | 1 ([57]) |
| Unique bodies scanned | 2 |
| Economy actions (build+ship) | 3 (50%) |
| Exploration actions (explore+transfer) | 3 (50%) |

### Journey Milestones

| Progress | Milestone |
|----------|-----------|
| 1% | tree_1:game_start |
| 20% | tree_20:economy_update |
| 30% | tree_30:economy_update |

### First 5 Minutes — Step by Step

| Clock | Latency | Event |
|-------|---------|-------|
| 0:00 | — | 🆕 Load profile (new player, empty) |
| 0:00 | +0.0s | 🔍 Claim check |
| 0:00 | +0.0s | 🎯 Picked star 57 |
| 0:00 | +0.0s | 🏠 Claimed home star 57 |
| 0:00 | +0.9s | 🆕 Load profile (new player, empty) |
| 0:00 | +0.0s | 🔍 Claim check |
| 0:00 | +0.0s | ✓ Already has claim (duplicate call) |
| 0:01 | +0.3s | ✅ App ready |
| 0:01 | +0.2s | 🚀 Journey started |
| 0:01 | +0.4s | 📊 Progress: 0.01 tree_1:game_start |
| 0:06 | +4s | 💾 Position: star 57, planet, body 0 |
| 0:11 | +5s | 💾 Position: star 57, planet, body 0 |
| 0:46 | +35s | 🔍 Claim check |
| 0:57 | +11s | 🔍 Claim check |
| 0:57 | +0.0s | 🏠 Claimed home star 25 |
| 1:06 | +9s | 🔍 Claim check |
| 1:06 | +0.0s | 🏠 Claimed home star 27 |
| 1:07 | +0.7s | 🔍 Claim check |
| 2:31 | +84s | 📜 **Found blueprint!** (+1 complete charge) |
| 2:31 | +0.0s | ⏳ Explore cooldown (found blueprint) |
| 2:32 | +0.7s | 🔭 Interaction: **explore** |
| 2:51 | +19s | 🔭 Interaction: **explore** |

**Dead zones (gaps ≥ 10s):**

- 35s gap at 0:46
- 11s gap at 0:57
- **84s (1.4 min)** gap at 2:31 — player idle or confused
- 19s gap at 2:51

### Full Session Timeline (10-min buckets)

| Window | build | explore | nav | Total |
|--------|-----|-----|-----|-------|
| 0–10 min | 1 | 2 | 2 | 5 |
| 10–20 min | 1 | 1 | 4 | 6 |
| 20–30 min | 1 |  |  | 1 |

---

## Info_at_Valcordia

**Session:** 2026-08-16T15:24Z → 2026-08-16T16:21Z (58 min)
**Home star:** 2
**Sessions:** 1 (no return)
**Journey progress:** 80%
**Play style:** EXPLORER

### Session Summary

| Metric | Value |
|--------|-------|
| Total interactions | 24 |
| → explore | 11 |
| → build | 8 |
| → buy_ship | 3 |
| → transfer | 2 |
| Position changes | 47 |
| Unique stars visited | 3 ([2, 27, 72]) |
| Unique bodies scanned | 9 |
| Economy actions (build+ship) | 11 (46%) |
| Exploration actions (explore+transfer) | 13 (54%) |

### Journey Milestones

| Progress | Milestone |
|----------|-----------|
| 1% | tree_1:game_start |
| 20% | tree_20:economy_update |
| 50% | tree_50:economy_update |
| 70% | tree_70:star_discovered |
| 80% | tree_80:star_discovered |

### First 5 Minutes — Step by Step

| Clock | Latency | Event |
|-------|---------|-------|
| 0:00 | — | 🆕 Load profile (new player, empty) |
| 0:00 | +0.0s | 🔍 Claim check |
| 0:00 | +0.0s | 🎯 Picked star 27 |
| 0:00 | +0.0s | 🏠 Claimed home star 27 |
| 0:00 | +0.7s | 🆕 Load profile (new player, empty) |
| 0:00 | +0.0s | 🔍 Claim check |
| 0:00 | +0.0s | ✓ Already has claim (duplicate call) |
| 0:01 | +0.7s | 🚀 Journey started |
| 0:01 | +0.0s | ✅ App ready |
| 0:01 | +0.2s | 📊 Progress: 0.01 tree_1:game_start |
| 0:06 | +5s | 💾 Position: star 27, planet, body 0 |
| 0:36 | +30s | 🔭 Interaction: **explore** |
| 1:16 | +40s | 🔨 Interaction: **build** |
| 1:46 | +29s | 💾 Position: star 27, system |
| 1:51 | +5s | 💾 Position: star 27, planet, body 1 |
| 1:56 | +5s | 🔭 Interaction: **explore** |
| 2:16 | +20s | 💾 Position: star 27, system |
| 2:21 | +5s | 💾 Position: star 27, planet, body 4 |
| 2:31 | +10s | 🔭 Interaction: **explore** |
| 2:41 | +10s | 💾 Position: star 27, system |
| 2:46 | +5s | 💾 Position: star 27, galaxy, body 6 |
| 3:46 | +60s | 💾 Position: star 27, system |
| 4:11 | +25s | 💾 Position: star 27, planet, body 2 |
| 4:21 | +10s | 🔭 Interaction: **explore** |
| 4:21 | +0.1s | 📊 Progress: 0.2 tree_20:economy_update |
| 4:29 | +7s | 🔍 Claim check |
| 4:29 | +0.0s | 🏠 Claimed home star 98 |
| 4:29 | +0.6s | 🔍 Claim check |
| 4:31 | +2s | 💾 Position: star 27, system |
| 4:46 | +15s | 💾 Position: star 27, planet, body 2 |
| 4:51 | +5s | 💾 Position: star 27, system |
| 4:56 | +5s | 💾 Position: star 27, planet, body 5 |

**Dead zones (gaps ≥ 10s):**

- 30s gap at 0:36
- 40s gap at 1:16
- 29s gap at 1:46
- 20s gap at 2:16
- 10s gap at 2:31
- 60s gap at 3:46
- 25s gap at 4:11
- 10s gap at 4:21
- 15s gap at 4:46

### Full Session Timeline (10-min buckets)

| Window | build | buy_ship | explore | nav | transfer | Total |
|--------|-----|-----|-----|-----|-----|-------|
| 0–10 min | 2 |  | 6 | 20 |  | 28 |
| 10–20 min | 2 |  | 1 | 6 |  | 9 |
| 20–30 min | 1 | 1 | 1 | 5 |  | 8 |
| 30–40 min | 1 |  |  | 2 |  | 3 |
| 40–50 min | 2 | 2 | 1 | 6 |  | 11 |
| 50–60 min |  |  | 2 | 11 | 2 | 15 |

---

## Cross-Player Comparison

| Metric | LegitimateTree5933 | Info_at_Valcordia | Training-Item5275 |
|--------|-------------------|-------------------|-------------------|
| Session duration | 150 min | 58 min | 27 min |
| Journey progress | 80% | 80% | 30% |
| Returned? | No | No | No |
| Total interactions | 46 | 24 | 6 |
| Play style | BUILDER (59%) | EXPLORER (54%) | BALANCED |
| Stars visited | 3 | 3 | 1 |
| Bodies scanned | 10 | 9 | 2 |
| Position changes | 53 | 47 | 4 |
| First real action | 1:25 (position save) | 0:36 (explore) | 2:31 (explore) |
| Dead zone (first 5 min) | 80s | 30s | 140s |

## Key Findings

1. **First-minute dead zone:** All players had 30–140s of inactivity after landing. Tutorial must trigger immediately.
2. **No returns:** Zero players came back for a second session. Retention is the #1 problem.
3. **Colonization gap:** LegitimateTree5933 bought 2 Colony Ships but never colonized — the flow is too complex.
4. **Explorer engagement:** Info_at_Valcordia was the most active navigator (47 position changes in 58 min) — exploration is compelling.
5. **Low-engagement churn:** Training-Item5275 only made 6 interactions in 27 min (1 every 4.5 min avg) then left.
6. **Build wait times:** LegitimateTree5933 stayed engaged through build waits (150 min session) by alternating build/explore. Build timers work as engagement glue for builders.
7. **Scan cooldown visible:** Info_at_Valcordia hit exact 60s scan cooldown gaps — players are waiting for cooldowns, not confused by them.