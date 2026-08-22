# Splash Screen & Scale Design Notes

## Reference: Raildit (Daily Railway Game)

![Raildit splash](screenshot: see attached)

### What they do well:
- **Two splash states**: pre-play vs post-play show different UI
  - **Pre-play**: Big "Play" button, map preview, streak incentive, top solver teaser
  - **Post-play**: Watch replay, full leaderboard, different layout (already engaged)
- **One post per day, different map** — creates daily ritual, fresh content without code changes
- **Prominent leaderboard on splash** — "TOP SOLVERS" with #1 player visible immediately
- **Daily rotation** — "Today's Map: Fernhollow" creates urgency + return visits
- **Play streak incentive** — "Play 2 consecutive days to unlock EMU-2"
- **New map countdown** — "new map in 12h 8m" drives return
- **Watch replay** — social proof, lets you see what good play looks like
- **They use drag/scroll in expanded mode** — so scrolling IS allowed there
- **Day counter** — "Day 44" shows longevity, community investment

### Implications for Valcordia Space:
- **Post-per-day model**: We could do "Star of the Day" — a featured system with special rewards
- **Pre/post splash differentiation**: First-time visitors see attract mode + "Join". Returning players see their status + what changed since last visit ("2 new players colonized nearby", "Your freighter delivered 500 ore")
- **Streak mechanic**: "Play 3 days in a row to unlock [cosmetic/title]" — drives daily return
- **Day counter equivalent**: "Galaxy Age: Day 12" — shows how long the universe has been running

### What we can learn for Valcordia Space splash:

**Current splash**: asteroids mini-game with "Join" button. No social context.

**Proposed splash redesign**:
- Show galaxy preview (current) + overlay with:
  - **Top Empire** — #1 player by stars claimed, visible on splash
  - **Active Players** — "X pilots online now"
  - **Your Status** — "You: 3 stars, Destroyer, Shield Bearer" (returning players)
  - **New Today** — "5 new explorers joined"
  - **Join / Play Full Size** buttons (keep existing)

---

## Scale: Multi-User Growth (20+ players)

### Current limitations:
- Single Redis namespace per post — all players share one post's data
- Galaxy has 100+ stars but economy/buildings per star are stored per-post
- Multiplayer presence uses polling (pose updates every few seconds)
- Autobot (NPC) runs on scheduler ticks

### Scaling questions at 20+ players:

**1. Star contention**
- 100 stars / 20 players = 5 stars each average
- But early players claim the best stars first
- **Solution**: Galaxy regeneration per post (each new post = fresh galaxy)
- **Solution**: Dynamic galaxy expansion — unlock new star clusters as player count grows

**2. Resource economy balance**
- More players = more competition for unclaimed stars
- Trade stations become more valuable (supply/demand)
- **Solution**: Scale resource richness or add more trade stations based on player count

**3. Server performance**
- Redis operations per player: ~10-20 per minute (pose, economy poll, fleet)
- 20 players × 15 ops/min = 300 ops/min — within Devvit limits
- 100 players × 15 ops/min = 1500 ops/min — may need optimization
- **Solution**: Batch reads, cache economy data, reduce poll frequency for idle players

**4. Multiplayer presence**
- Currently polls /api/pose every 2-3 seconds
- 50 players = 50 pose responses × 50 clients = 2500 reads/min
- **Solution**: Use Devvit Realtime API for presence (pub/sub vs polling)
- **Solution**: Only show nearby players (same star system), not all

**5. Galaxy map crowding**
- 20+ colored dots on galaxy map gets noisy
- **Solution**: Zoom-dependent filtering, cluster indicators
- **Solution**: Alliance colors/territories shown as regions, not individual dots

**6. Social scaling**
- Chat channels get noisy with 20+ people
- **Solution**: Per-star-system chat (local), alliance chat (private), global (moderated)
- Already have DM + public + alliance channels

### Expansion strategies:

**Option A: New post = new galaxy**
- Each post is a fresh universe
- Players start over but keep cosmetic unlocks (flair, skins)
- Good for "seasons" model — weekly/monthly resets

**Option B: Dynamic galaxy growth**
- When claimed stars > 60% of total, unlock new star cluster
- Adds 20-30 new stars connected to edge of existing galaxy
- Preserves existing progress

**Option C: Multi-post federation**
- Each post is a "sector" of a larger universe
- Players can warp between posts (sectors)
- Complex but most scalable

**Recommended**: Start with Option A (seasonal posts) + Option B (dynamic growth within a season). Option C is future architecture.

---

## Cross-Post Progression (Roguelike MMO Model)

**Key insight**: Redis is shared across posts. Player data can persist while galaxies reset.

### What carries forward (global profile):
- Ship type / upgrade level
- Earned titles / flair
- Resource stockpile (or % carry-forward, e.g. 50%)
- Discovered blueprints
- Alliance membership
- Play streak count
- Cosmetic unlocks (skins)

### What resets (per-post galaxy):
- Star map layout / topology
- Star claims / ownership
- Building infrastructure
- Fleet positions
- NPC autobot state
- Valcordian star placement

### Benefits:
- **Late-joiner fix** — new post = fresh galaxy, veterans just have better ships
- **Galaxy freshness** — fully claimed galaxy? Start a new post
- **Natural scaling** — 200+ players? Spin up sector posts
- **Content variety** — different galaxy seeds = different strategy each time
- **Streak incentive** — "Play across 3 galaxies to unlock [title]"

### Redis architecture:
- Global keys: `profile:{username}` (ships, resources, titles, streaks)
- Post-scoped keys: `post:{postId}:star:{idx}` (claims, buildings, economy)
- Already close to this structure — need to formalize which keys are global vs post-scoped

---

## Galaxy Win Condition & Emigration

### Win condition (per post/galaxy):
- **Valcordian Discovery**: First alliance to find & dock at all 3 Valcordian stars
- **Time limit**: Galaxy runs max 14 days
- If no alliance wins by day 14, highest score (stars × building levels) wins
- **Galaxy Age** shown on splash: "Day 9 of 14"

### When galaxy ends:
1. Victory announcement auto-posted to subreddit
2. Game becomes **read-only gallery mode** — browse the final galaxy state
3. Leaderboard frozen, titles awarded
4. Banner: "This galaxy has ended. [Alliance Name] discovered the Valcordian network on Day 9"

### Emigration flow:
- Button appears: **"Emigrate to New Galaxy →"**
- Narrative: "The Valcordian gate has opened. A new galaxy awaits beyond."
- Player is linked to the newest active post (new galaxy)
- Thematic: you're not resetting — you're **pioneering a new frontier**

### What emigrates with the player:
- Highest ship tier achieved (start with that ship, not scout)
- All earned titles / flair
- 25% of peak resources (not hoarded end-state)
- Alliance name persists (members regroup in new galaxy)
- Blueprints / cosmetic unlocks
- Play streak counter

### What stays behind (frozen in old galaxy):
- Star claims / ownership map
- Building infrastructure
- Fleet positions (monument to what was built)
- Old leaderboard
- Chat/message history

### Seasonal theme potential:
Each galaxy post could have a modifier:
- "Dense Cluster" — stars packed tight, more conflict
- "Resource Scarcity" — low richness, trading critical
- "Pirate Sector" — NPC raiders active from day 1
- "Alliance Wars" — bonus points for raiding, combat-focused
- "Explorer's Frontier" — extra Valcordian stars, huge map
