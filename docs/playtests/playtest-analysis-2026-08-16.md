# Playtest Logs Analysis — 2026-08-16

**Time range:** 2026-08-16T12:48:13Z → 2026-08-17T12:48:11Z (24h)
**Total log lines:** 4,733
**Source:** `devvit logs --since 24h --json valcordia_space_dev`
**Raw logs:** playtest-logs-2026-08-16.json

## Players

### WeirdAd4511 (1009 events)
- **Active:** 2026-08-16T12:50 → 2026-08-17T12:44
- **Categories:** [TELEMETRY] (358), [SERVER-SAVE] (338), [CLAIM] (204), [SERVER-LOAD] (92), [EXPLORE] (5), [RESET-VERIFY] (4), [ACHIEVEMENTS] (4), [ALLIANCE] (2), [ADMIN] (1), [ACHIEVEMENTS-DEBUG] (1)

**Key events:**
```
2026-08-16T12:50:34 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={}
2026-08-16T12:50:34 [CLAIM] user=WeirdAd4511 picked star 71 via default (no claims seen)
2026-08-16T12:50:34 [CLAIM] user=WeirdAd4511 DONE: homeStar=71 totalClaims=1 allClaimed=[{"starIndex":71,"username":"WeirdAd4511"}]
2026-08-16T12:50:42 [RESET-VERIFY] profile:WeirdAd4511 remaining keys: ["lastStore","lastPosition","shape","scannedBodies","name","discovere
2026-08-16T12:50:42 [RESET-VERIFY] profile:WeirdAd4511 remaining data: {"lastStore":"{}","lastPosition":"{\"starIndex\":71,\"tier\":3,\"body
2026-08-16T12:50:46 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={}
2026-08-16T12:50:46 [CLAIM] user=WeirdAd4511 picked star 71 via default (no claims seen)
2026-08-16T12:50:46 [CLAIM] user=WeirdAd4511 DONE: homeStar=71 totalClaims=1 allClaimed=[{"starIndex":71,"username":"WeirdAd4511"}]
2026-08-16T12:50:47 [ADMIN] set-state for WeirdAd4511 star=71: {"buildings":{"station":4,"dock":3,"mine":3,"solar":3,"hab":3,"warehouse":2,"
2026-08-16T12:54:12 [CLAIM] claimHomeStar user=VALCORDIA_PROBE postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdA
2026-08-16T12:54:12 [CLAIM] user=VALCORDIA_PROBE DONE: homeStar=57 totalClaims=2 allClaimed=[{"starIndex":71,"username":"WeirdAd4511"},{"sta
2026-08-16T15:21:20 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T15:21:20 [CLAIM] user=WeirdAd4511 already has claim at star 71
2026-08-16T15:21:34 [RESET-VERIFY] profile:WeirdAd4511 remaining keys: ["lastStore","wireframePref","shape","lastSeen","name","lastRank"]
2026-08-16T15:21:34 [RESET-VERIFY] profile:WeirdAd4511 remaining data: {"lastStore":"{\"s:71\":{\"ore\":2400,\"food\":2400,\"energy\":2400,\
2026-08-16T15:21:45 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={}
2026-08-16T15:21:45 [CLAIM] user=WeirdAd4511 picked star 71 via default (no claims seen)
2026-08-16T15:21:45 [CLAIM] user=WeirdAd4511 DONE: homeStar=71 totalClaims=1 allClaimed=[{"starIndex":71,"username":"WeirdAd4511"}]
2026-08-16T15:23:13 [CLAIM] claimHomeStar user=Training-Item5275 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"Weir
2026-08-16T15:23:13 [CLAIM] user=Training-Item5275 DONE: homeStar=57 totalClaims=2 allClaimed=[{"starIndex":71,"username":"WeirdAd4511"},{"s
2026-08-16T15:23:14 [CLAIM] claimHomeStar user=Training-Item5275 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"Weir
2026-08-16T15:23:59 [CLAIM] user=WeirdAd4511 already has claim at star 71
2026-08-16T15:23:59 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T15:24:11 [CLAIM] claimHomeStar user=VALCORDIA_PROBE postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdA
2026-08-16T15:24:11 [CLAIM] user=VALCORDIA_PROBE DONE: homeStar=25 totalClaims=3 allClaimed=[{"starIndex":71,"username":"WeirdAd4511"},{"sta
2026-08-16T15:24:20 [CLAIM] claimHomeStar user=Info_at_Valcordia postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"Weir
2026-08-16T15:24:20 [CLAIM] user=Info_at_Valcordia DONE: homeStar=27 totalClaims=4 allClaimed=[{"starIndex":71,"username":"WeirdAd4511"},{"s
2026-08-16T15:24:21 [CLAIM] claimHomeStar user=Info_at_Valcordia postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:57":"Trai
2026-08-16T15:25:35 [EXPLORE] user=WeirdAd4511 cooldown set for 60s after finding energy
2026-08-16T15:28:49 [CLAIM] claimHomeStar user=LegitimateTree5933 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:57":"Tra
2026-08-16T15:28:49 [CLAIM] user=LegitimateTree5933 DONE: homeStar=98 totalClaims=5 allClaimed=[{"starIndex":71,"username":"WeirdAd4511"},{"
2026-08-16T15:28:50 [CLAIM] claimHomeStar user=LegitimateTree5933 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"Wei
2026-08-16T15:30:33 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T15:30:33 [CLAIM] user=WeirdAd4511 already has claim at star 71
2026-08-16T15:30:34 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T15:30:34 [CLAIM] user=WeirdAd4511 already has claim at star 71
2026-08-16T15:33:54 [CLAIM] claimHomeStar user=Info_at_Valcordia postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:25":"VALC
2026-08-16T15:33:54 [CLAIM] claimHomeStar user=Info_at_Valcordia postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"Weir
2026-08-16T15:54:39 [EXPLORE] user=WeirdAd4511 cooldown set for 60s after finding artifact
2026-08-16T15:56:04 [EXPLORE] user=WeirdAd4511 cooldown set for 60s after finding artifact
... and 181 more
```

### LegitimateTree5933 (291 events)
- **Active:** 2026-08-16T15:28 → 2026-08-17T12:44
- **Categories:** [SERVER-SAVE] (112), [CLAIM] (98), [TELEMETRY] (57), [ACHIEVEMENTS] (10), [EXPLORE] (7), [SERVER-LOAD] (4), [ACHIEVEMENTS-DEBUG] (3)

**Key events:**
```
2026-08-16T15:28:49 [CLAIM] claimHomeStar user=LegitimateTree5933 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:57":"Tra
2026-08-16T15:28:49 [CLAIM] user=LegitimateTree5933 picked star 98 via pickNext (excluded=57,25,27,71)
2026-08-16T15:28:49 [CLAIM] user=LegitimateTree5933 DONE: homeStar=98 totalClaims=5 allClaimed=[{"starIndex":71,"username":"WeirdAd4511"},{"
2026-08-16T15:28:50 [CLAIM] claimHomeStar user=LegitimateTree5933 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"Wei
2026-08-16T15:28:50 [CLAIM] user=LegitimateTree5933 already has claim at star 98
2026-08-16T15:30:33 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T15:30:34 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T15:33:54 [CLAIM] claimHomeStar user=Info_at_Valcordia postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:25":"VALC
2026-08-16T15:33:54 [CLAIM] claimHomeStar user=Info_at_Valcordia postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"Weir
2026-08-16T15:41:30 [EXPLORE] user=LegitimateTree5933 cooldown set for 60s after finding artifact
2026-08-16T15:42:55 [EXPLORE] user=LegitimateTree5933 cooldown set for 60s after finding artifact
2026-08-16T15:57:45 [ACHIEVEMENTS] checking upgrade_frigate for LegitimateTree5933, postId=t3_1uvhdm8
2026-08-16T15:57:45 [ACHIEVEMENTS] posting comment for upgrade_frigate: ⚔️ **u/LegitimateTree5933** upgraded their fleet — a **Frigate** is 
2026-08-16T16:00:40 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T16:01:02 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T16:01:02 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:25":"VALCORDIA_
2026-08-16T16:01:10 [EXPLORE] user=LegitimateTree5933 cooldown set for 60s after finding ore
2026-08-16T16:03:30 [EXPLORE] user=LegitimateTree5933 cooldown set for 60s after finding artifact
2026-08-16T16:20:20 [ACHIEVEMENTS-DEBUG] /ships/buy postId=t3_1uvhdm8 username=LegitimateTree5933
2026-08-16T16:20:20 [ACHIEVEMENTS] checking first_ship for LegitimateTree5933, postId=t3_1uvhdm8
2026-08-16T16:20:20 [ACHIEVEMENTS] posting comment for first_ship: 🚀 **u/LegitimateTree5933** has built their first ship!
2026-08-16T16:23:00 [EXPLORE] user=LegitimateTree5933 cooldown set for 60s after finding energy
2026-08-16T16:23:55 [ACHIEVEMENTS] checking first_transfer for LegitimateTree5933, postId=t3_1uvhdm8
2026-08-16T16:23:55 [ACHIEVEMENTS] posting comment for first_transfer: 🛸 **u/LegitimateTree5933** sent ships to another star system for the 
2026-08-16T16:24:41 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:27":"Info_at_Va
2026-08-16T16:24:42 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:27":"Info_at_Va
2026-08-16T16:27:24 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T16:28:17 [CLAIM] user=LegitimateTree5933 already has claim at star 98
2026-08-16T16:28:17 [CLAIM] claimHomeStar user=LegitimateTree5933 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:25":"VAL
2026-08-16T16:28:17 [CLAIM] user=LegitimateTree5933 already has claim at star 98
2026-08-16T16:28:17 [CLAIM] claimHomeStar user=LegitimateTree5933 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"Wei
2026-08-16T16:29:21 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:57":"Training-I
2026-08-16T16:29:22 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T16:32:13 [EXPLORE] user=LegitimateTree5933 cooldown set for 60s after finding energy
2026-08-16T16:34:33 [EXPLORE] user=LegitimateTree5933 cooldown set for 60s after finding energy
2026-08-16T16:57:25 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:57":"Training-I
2026-08-16T17:07:09 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T17:27:26 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:25":"VALCORDIA_
2026-08-16T17:42:38 [ACHIEVEMENTS] checking first_ship for LegitimateTree5933, postId=t3_1uvhdm8
2026-08-16T17:42:38 [ACHIEVEMENTS-DEBUG] /ships/buy postId=t3_1uvhdm8 username=LegitimateTree5933
... and 78 more
```

### Training-Item5275 (136 events)
- **Active:** 2026-08-16T15:23 → 2026-08-17T12:44
- **Categories:** [CLAIM] (105), [SERVER-SAVE] (12), [TELEMETRY] (11), [EXPLORE] (4), [SERVER-LOAD] (2), [ACHIEVEMENTS] (2)

**Key events:**
```
2026-08-16T15:23:13 [CLAIM] claimHomeStar user=Training-Item5275 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"Weir
2026-08-16T15:23:13 [CLAIM] user=Training-Item5275 picked star 57 via pickNext (excluded=71)
2026-08-16T15:23:13 [CLAIM] user=Training-Item5275 DONE: homeStar=57 totalClaims=2 allClaimed=[{"starIndex":71,"username":"WeirdAd4511"},{"s
2026-08-16T15:23:14 [CLAIM] claimHomeStar user=Training-Item5275 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"Weir
2026-08-16T15:23:14 [CLAIM] user=Training-Item5275 already has claim at star 57
2026-08-16T15:23:59 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T15:24:11 [CLAIM] claimHomeStar user=VALCORDIA_PROBE postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdA
2026-08-16T15:24:11 [CLAIM] user=VALCORDIA_PROBE DONE: homeStar=25 totalClaims=3 allClaimed=[{"starIndex":71,"username":"WeirdAd4511"},{"sta
2026-08-16T15:24:20 [CLAIM] claimHomeStar user=Info_at_Valcordia postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"Weir
2026-08-16T15:24:20 [CLAIM] user=Info_at_Valcordia DONE: homeStar=27 totalClaims=4 allClaimed=[{"starIndex":71,"username":"WeirdAd4511"},{"s
2026-08-16T15:24:21 [CLAIM] claimHomeStar user=Info_at_Valcordia postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:57":"Trai
2026-08-16T15:25:45 [EXPLORE] user=Training-Item5275 found blueprint — granted 1 complete charge
2026-08-16T15:25:45 [EXPLORE] user=Training-Item5275 cooldown set for 60s after finding blueprint
2026-08-16T15:28:49 [CLAIM] claimHomeStar user=LegitimateTree5933 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:57":"Tra
2026-08-16T15:28:49 [CLAIM] user=LegitimateTree5933 DONE: homeStar=98 totalClaims=5 allClaimed=[{"starIndex":71,"username":"WeirdAd4511"},{"
2026-08-16T15:28:50 [CLAIM] claimHomeStar user=LegitimateTree5933 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"Wei
2026-08-16T15:30:33 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T15:30:34 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T15:33:54 [CLAIM] claimHomeStar user=Info_at_Valcordia postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:25":"VALC
2026-08-16T15:33:54 [CLAIM] claimHomeStar user=Info_at_Valcordia postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"Weir
2026-08-16T15:40:15 [EXPLORE] user=Training-Item5275 found blueprint — granted 1 complete charge
2026-08-16T15:40:15 [EXPLORE] user=Training-Item5275 cooldown set for 60s after finding blueprint
2026-08-16T15:49:11 [ACHIEVEMENTS] checking upgrade_frigate for Training-Item5275, postId=t3_1uvhdm8
2026-08-16T15:49:11 [ACHIEVEMENTS] posting comment for upgrade_frigate: ⚔️ **u/Training-Item5275** upgraded their fleet — a **Frigate** is u
2026-08-16T16:00:40 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T16:01:02 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T16:01:02 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:25":"VALCORDIA_
2026-08-16T16:24:41 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:27":"Info_at_Va
2026-08-16T16:24:42 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:27":"Info_at_Va
2026-08-16T16:27:24 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T16:28:17 [CLAIM] claimHomeStar user=LegitimateTree5933 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:25":"VAL
2026-08-16T16:28:17 [CLAIM] claimHomeStar user=LegitimateTree5933 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"Wei
2026-08-16T16:29:21 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:57":"Training-I
2026-08-16T16:29:22 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T16:57:25 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:57":"Training-I
2026-08-16T17:07:09 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T17:27:26 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:25":"VALCORDIA_
2026-08-16T17:57:27 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:57":"Training-I
2026-08-16T18:06:35 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
2026-08-16T18:27:28 [CLAIM] claimHomeStar user=WeirdAd4511 postId=t3_1uvhdm8 registryKey=stars:t3_1uvhdm8 existingClaims={"s:71":"WeirdAd451
... and 71 more
```

## Autobot
- Total autobot log entries: 2341
- Ticks with players online: 435

## Errors
43 error-like entries found:
```
2026-08-16T16:18:35 [ACHIEVEMENTS] Failed to post comment for first_transfer: Error: 8 RESOURCE_EXHAUSTED: grpc invocation failed with status 8; RatelimitError(TimeString
2026-08-16T16:54:12 [AUTOBOT] action: failed to send probe: Not enough fuel (need 500, have 305)
2026-08-16T16:54:12 [SCHEDULER] autobot-tick complete: action=failed to send probe: Not enough fuel (need 500, have 305) fsm=explore
2026-08-16T16:57:13 [AUTOBOT] action: failed to send probe: Not enough fuel (need 500, have 350)
2026-08-16T16:57:13 [SCHEDULER] autobot-tick complete: action=failed to send probe: Not enough fuel (need 500, have 350) fsm=explore
2026-08-16T17:00:13 [AUTOBOT] action: failed to send probe: Not enough fuel (need 500, have 395)
2026-08-16T17:00:13 [SCHEDULER] autobot-tick complete: action=failed to send probe: Not enough fuel (need 500, have 395) fsm=explore
2026-08-16T17:03:11 [AUTOBOT] action: failed to send probe: Not enough fuel (need 500, have 439)
2026-08-16T17:03:11 [SCHEDULER] autobot-tick complete: action=failed to send probe: Not enough fuel (need 500, have 439) fsm=explore
2026-08-16T17:06:10 [AUTOBOT] action: failed to send probe: Not enough fuel (need 500, have 484)
2026-08-16T17:06:10 [SCHEDULER] autobot-tick complete: action=failed to send probe: Not enough fuel (need 500, have 484) fsm=explore
2026-08-16T17:21:15 [AUTOBOT] action: failed to send probe: Not enough fuel (need 500, have 210)
2026-08-16T17:21:15 [SCHEDULER] autobot-tick complete: action=failed to send probe: Not enough fuel (need 500, have 210) fsm=explore
2026-08-16T17:24:12 [AUTOBOT] action: failed to send probe: Not enough fuel (need 500, have 255)
2026-08-16T17:24:12 [SCHEDULER] autobot-tick complete: action=failed to send probe: Not enough fuel (need 500, have 255) fsm=explore
2026-08-16T17:27:12 [AUTOBOT] action: failed to send probe: Not enough fuel (need 500, have 300)
2026-08-16T17:27:12 [SCHEDULER] autobot-tick complete: action=failed to send probe: Not enough fuel (need 500, have 300) fsm=explore
2026-08-16T17:30:13 [AUTOBOT] action: failed to send probe: Not enough fuel (need 500, have 345)
2026-08-16T17:30:13 [SCHEDULER] autobot-tick complete: action=failed to send probe: Not enough fuel (need 500, have 345) fsm=explore
2026-08-16T17:33:12 [AUTOBOT] action: failed to send probe: Not enough fuel (need 500, have 390)
... and 23 more
```
