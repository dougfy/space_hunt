// Persistent quest and collectible items.

export type ItemId =
  | 'luminari_artifact'
  | 'air_purifier_unit'
  | 'air_purifier_repair_kit';

export type ItemSource = 'exploration' | 'trade' | 'quest' | 'alliance';

export type ItemDefinition = {
  id: ItemId;
  name: string;
  description: string;
  stackable: boolean;
  transferable: boolean;
  source: ItemSource;
};

export type PlayerInventory = Partial<Record<ItemId, number>>;

export const ITEM_CATALOG: Record<ItemId, ItemDefinition> = {
  luminari_artifact: {
    id: 'luminari_artifact',
    name: 'Luminari Artifact',
    description: 'A rare relic recovered during planetary exploration.',
    stackable: true,
    transferable: true,
    source: 'exploration',
  },
  air_purifier_unit: {
    id: 'air_purifier_unit',
    name: 'Air Purifier Unit',
    description: 'A replacement unit for a failing starbase air system.',
    stackable: true,
    transferable: true,
    source: 'quest',
  },
  air_purifier_repair_kit: {
    id: 'air_purifier_repair_kit',
    name: 'Air Purifier Repair Kit',
    description: 'Emergency components for restoring a damaged air system.',
    stackable: true,
    transferable: true,
    source: 'quest',
  },
};

export function normalizeInventory(inventory: PlayerInventory | undefined): PlayerInventory {
  const normalized: PlayerInventory = {};
  for (const id of Object.keys(ITEM_CATALOG) as ItemId[]) {
    const count = inventory?.[id];
    if (count != null && Number.isFinite(count) && count > 0) normalized[id] = Math.floor(count);
  }
  return normalized;
}
