# Fleet Management Design

## Current Structure
Ships are already stored per-star:
```
shipsProfile.stars = {
  "s:53": { ships: [{typeId: 3, count: 1}], building: null },
  "s:71": { ships: [{typeId: 5, count: 1}], building: null },
}
```

## Options

### 1. Stationed Fleets (recommended)
- Ships stay where built
- Player's active ship = best ship across ALL owned stars
- Ships provide passive defense at their star
- Per-star garrison determines defense strength
- Dock level at each star limits what can be stationed there

### 2. Global Pool
- All ships in one bucket
- Simpler but removes strategic depth

### 3. Transferable
- Ships stationed per-star but can be moved
- Colony ship / freighter mechanic for transfers
- Most complex but most strategic

## Recommended Implementation
- **Active ship shape**: `getFleetShape()` aggregates across ALL stars the player owns
- **Per-star garrison**: Each star's local fleet determines defense strength
- **Building**: Can only build at stars with a dock
- **Ship points cap**: Dock level limits what can be stationed per-star
- **Profile response**: Server returns `playerBestShipType` across all stars so client doesn't poll every star
- Change `/api/ships` poll to also return a "global best ship" summary

## Open Questions
- Should ships be movable between stars? (freighter mechanic)
- Does losing a star destroy its garrison?
- Can you build at colonized stars without visiting them?
