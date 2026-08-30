# Special Inventory Items and Daily Starbase Events

## Purpose

Define the reusable special-item, inventory, event, and quest systems needed for story-driven daily events. The first complete story is an air-purifier failure at a player's second starbase.

This document is intentionally separate from the main attack plan so the feature can continue across sessions without losing the design decisions.

## Design Principles

- The server is authoritative for inventory, quest state, deadlines, transfers, and repairs.
- Items have stable IDs; display names are never used as identifiers.
- Exploration, trade, freight, and alliance assistance are different ways to satisfy the same quest requirement.
- An item cannot be duplicated by retrying a request or opening multiple browser sessions.
- Daily events are generated once per UTC day with an idempotent day key.
- Quest warnings are visible but do not behave like onboarding: no unsolicited tutorial flashing or voice prompts.
- The first implementation should preserve a starbase claim even if the base becomes inactive, allowing future recovery design.

## Item Model

Add shared item definitions:

```ts
type ItemId =
  | 'luminari_artifact'
  | 'air_purifier_unit'
  | 'air_purifier_repair_kit';

type ItemDefinition = {
  id: ItemId;
  name: string;
  description: string;
  stackable: boolean;
  transferable: boolean;
  source: 'exploration' | 'trade' | 'quest' | 'alliance';
};
```

Initial items:

| Item | Purpose |
|---|---|
| `luminari_artifact` | Convert the existing artifact scan result into a persistent collectible. |
| `air_purifier_unit` | Full replacement unit that repairs a failed purifier. |
| `air_purifier_repair_kit` | Optional emergency item that restores partial capacity or extends a deadline. |

## Inventory

Start with inventory persisted on the player's profile, then add star-local and in-transit locations before freight delivery is implemented.

```ts
type Inventory = {
  personal: Record<ItemId, number>;
  stars: Record<string, Record<ItemId, number>>;
  inTransit: Array<{
    itemId: ItemId;
    count: number;
    fromStarIndex: number;
    toStarIndex: number;
    arrivalAt: number;
  }>;
};
```

Suggested rules:

- Exploration finds initially enter `personal` inventory.
- Purchased units enter the selected trading-star inventory.
- Freighter cargo moves items from one star inventory to another.
- Repair consumes the item only at the affected star.
- Alliance assistance transfers a real item and never creates one from nothing.

A Redis profile field can hold the serialized inventory initially:

```text
profile:{username}
  inventory: {...}
```

If the inventory grows substantially, move it to dedicated keys without changing the shared API model.

## Exploration Integration

The current `/api/explore` flow handles resources, blueprints, anomalies, and artifact results. Artifact results should gain an item identity:

```ts
type ExploreResult = {
  kind: 'ore' | 'food' | 'energy' | 'fuel' | 'artifact' | 'blueprint' | 'anomaly' | 'nothing';
  label: string;
  icon: string;
  amount: number;
  itemId?: ItemId;
  itemCount?: number;
};
```

The server grants the item before returning success. The client only displays the result.

Quest-specific finds must be deterministic and one-shot:

```text
quest:{username}:air_purifier:{eventId}:source_found
```

That prevents repeated scans, retries, or multiple browser sessions from generating duplicate replacement units.

## Quest and Event State

Use a generic daily event model with quest-specific requirements:

```ts
type DailyEvent = {
  eventId: string;
  type: 'air_purifier_failure';
  dayKey: string;
  starIndex: number;
  startedAt: number;
  deadlineAt: number;
  state: 'active' | 'resolved' | 'failed';
};

type AirPurifierQuest = {
  eventId: string;
  starIndex: number;
  startedAt: number;
  deadlineAt: number;
  capacityPercent: number;
  condition: 'reduced_capacity' | 'critical_failure' | 'repaired' | 'lost';
  repairMethod?: 'found_unit' | 'trade_purchase' | 'freighter_transfer' | 'alliance_help';
  resolvedAt?: number;
};
```

Persist the active quest on the player profile or in a dedicated quest key:

```text
profile:{username}
  activeQuest: {...}
```

Use an idempotent daily key:

```text
daily:{postId}:{yyyy-mm-dd}:air-purifier
```

The event starts only when:

- The player owns at least two starbases.
- The selected secondary starbase is eligible.
- The player has no active or already-resolved purifier event for that day.
- The daily event record does not already exist.

## Starbase Failure Progression

Do not silently mutate ordinary building data. Add an explicit operational condition that affects server-side production:

```ts
type StarCondition =
  | 'normal'
  | 'reduced_capacity'
  | 'critical_failure'
  | 'lost';
```

Suggested progression:

```text
Event begins       75% capacity, reduced_capacity
Critical warning   40% capacity, critical_failure
deadline reached   0% capacity, lost/inactive
```

The server must apply the condition when calculating economy rates. The client should show the condition in Global Status and the returning report.

A lost base should initially remain claimed but inactive. This avoids destructive data loss and leaves room for recovery rules.

## Repair Paths

### 1. Locate the Replacement Unit

The event identifies a particular star and planet:

```text
Replacement unit located at:
Star: Deneb
Planet: Deneb IV
```

A successful exploration at that exact target grants `air_purifier_unit x1`. The player then delivers or uses it at the affected star.

The target is displayed using the generated system-map planet name. Once the unit is held, the player navigates to the affected starbase, docks at its Station, and uses the bottom orbit-bar `REPAIR AIR` action. The server validates and consumes the unit.

Server checks:

- Correct active event
- Correct target star and body
- Target has not already been searched
- Deadline has not passed
- Item grant has not already occurred

### 2. Purchase at a Trading Station

Use an escrow order rather than one direct resource deduction:

```ts
type TradeOrder = {
  orderId: string;
  itemId: 'air_purifier_unit';
  targetStarIndex: number;
  required: ResourceStore;
  paid: ResourceStore;
  status: 'open' | 'complete' | 'cancelled';
};
```

The player fulfills the cost through several freight deliveries. When the required resources are complete, the trading station grants the item. This makes the purchase a meaningful logistics choice.

### 3. Transfer by Freighter

Extend freighter cargo to include items:

```ts
type FreighterCargo = {
  resources: ResourceStore;
  items: Array<{
    itemId: ItemId;
    count: number;
  }>;
};
```

Server validation:

- Item exists at the source star.
- Source and destination are authorized.
- Freighter capacity is available.
- The item is transferable.
- The route is not complete or cancelled.
- The item moves only when the route arrives.

### 4. Alliance Assistance

Allow an alliance member to offer an existing item:

```ts
type AllianceItemOffer = {
  offerId: string;
  fromUser: string;
  toUser: string;
  itemId: ItemId;
  count: number;
  expiresAt: number;
  status: 'offered' | 'accepted' | 'declined' | 'expired';
};
```

For the first alliance version, only items actually found or purchased can be offered. Acceptance moves the item; it does not mint a replacement.

## Repair Contract

All repair methods resolve through one server-authoritative endpoint:

```text
POST /api/quests/air-purifier/repair
```

Example request:

```json
{
  "username": "player",
  "starIndex": 42,
  "method": "found_unit"
}
```

The server verifies:

1. The quest is active.
2. The deadline has not passed.
3. The affected star matches the request.
4. The required item or completed purchase condition exists at that star.
5. The player has authority to repair it.
6. The item is consumed exactly once.
7. Capacity and star condition are restored.
8. A completion event is recorded.

The client must never decide whether the item satisfies the event.

## UI Plan

Global Status should expose an incident section:

```text
ACTIVE INCIDENT
JEMRA STARBASE
AIR PURIFIER FAILURE
CAPACITY 62%
DEADLINE 18:42:11

REPAIR OPTIONS
[LOCATE UNIT]
[BUY AT TRADING STATION]
[TRANSFER BY FREIGHTER]
[REQUEST ALLIANCE HELP]
```

Returning reports should include confirmed state changes:

```text
[WARNING] Air purification failure at Jemra
[BUILD] Starbase capacity reduced to 62%
[QUEST] Replacement unit located at Deneb IV
[REPAIR] Jemra air purification restored
```

Use a static unread badge and status color changes. Do not reuse onboarding pulse behavior.

## Voice and Warning Plan

The current staged pack is useful for existing events, but it lacks a precise air-purifier line. Recommended new lines:

```text
Warning. Air purification failure detected at your starbase.
Starbase capacity reduced. Repair required.
Critical failure. Starbase services will terminate soon.
Replacement unit recovered.
Air purification restored. Starbase systems returning to normal.
```

Dynamic star names should remain visible text because the current WAV system cannot synthesize arbitrary names.

Suggested behavior:

- No automatic voice merely because the event exists.
- A single optional warning when the player opens the incident.
- A completion voice after a successful repair.
- A returning-report entry when the player was away.
- No voice repetition on every economy poll.

## Proposed Endpoints

```text
GET  /api/inventory
POST /api/inventory/transfer
GET  /api/events/active
POST /api/quests/air-purifier/repair
POST /api/trade-orders
GET  /api/trade-orders
```

Existing `/api/fleet/all` can be extended with item cargo, or a separate Global Status response can aggregate it.

## Phased Implementation

### Phase 1: Item Foundation

- Add `ItemId` and item catalog.
- Persist personal inventory.
- Add grant, consume, and inspect helpers.
- Convert artifact exploration into a stored item.
- Show inventory in Global Status for admin review.

### Phase 2: Event Framework

- Add daily event identity and idempotent generation.
- Add active quest state and deadline handling.
- Add starbase condition and production-capacity effects.
- Add Global Status and returning-report incident entries.

### Phase 3: First Complete Quest

- Add deterministic replacement-unit target.
- Grant the unit through the correct exploration target.
- Add the repair endpoint.
- Consume the item and restore capacity.
- Add duplicate, expiry, and wrong-target protection.

### Phase 4: Freight Items

- Add item cargo to freighter routes.
- Add arrival-time delivery.
- Show item cargo and countdowns in Global Status.

The implementation accepts optional item cargo on `POST /api/fleet/freighter-route`. Items are reserved from personal inventory when the route is assigned, returned to inventory when the return leg arrives, and refunded if the route is cancelled before delivery. Resource-only routes remain unchanged. Global Status shows the item cargo while the route is active. A Fleet-panel item selector and star-local inventory remain future UI work.

### Phase 5: Trading Escrow

- Add trading-station purifier order.
- Track multi-delivery resource payments.
- Grant the purifier when fully funded.

The initial implementation provides `POST /api/quest/air-purifier/order` to create an order at a validated trading station and `POST /api/quest/air-purifier/order/pay` for staged payments from an owned star. The order requires 2,400 Ore, 1,800 Food, 2,200 Energy, and 600 Fuel. Full funding grants one `air_purifier_unit`; Global Status displays paid versus required resources.

### Phase 6: Alliance Assistance

- Add item offers, acceptance, expiration, and audit history.
- Require the offering player to own the item.

The initial implementation adds `/api/alliance/item-offers` and `/api/alliance/item-offers/respond`. Offers reserve the sender's real inventory immediately, are available only between current alliance members, expire after 24 hours with an automatic refund, and transfer the item only after recipient acceptance. The ALLY panel polls pending offers and provides TAKE/NO actions. Sending offers from the panel and persistent audit history remain follow-up UI work.

### Phase 7: Polish and Retention

- Add dedicated voices and warning text.
- Add daily Reddit Dispatch integration.
- Add shared challenges and other daily mechanics after the first quest is proven.

## Testing Requirements

Server tests should cover:

- Item grant and consumption
- Duplicate-grant prevention
- Daily event idempotency
- Capacity reduction and deadline failure
- Correct and incorrect repair items
- Repair after expiry
- Freight item delivery
- Trading escrow completion
- Alliance offer authorization

Playwright tests should cover:

- Two-star event appearance
- Global Status incident display
- Replacement-unit discovery
- Repair completion
- Failure warning and inactive base state

## First Milestone

The first complete playable milestone is:

1. Generic inventory
2. Artifact as a persistent item
3. Air-purifier event generation
4. Reduced-capacity starbase state
5. Deterministic replacement-unit location
6. Find-and-repair path
7. Global Status and returning-report display

Trading, freight item cargo, and alliance support then become extensions of the same item-transfer contract rather than separate quest implementations.
