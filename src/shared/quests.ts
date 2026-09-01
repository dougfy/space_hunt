// Duplicated to avoid circular import with api.ts
type ResourceStore = { ore: number; food: number; energy: number; fuel: number };
type BuildStatus = 'LOCKED' | 'READY' | 'UPGRADING' | 'ACTIVE';

export type StarCondition = 'normal' | 'reduced_capacity' | 'critical_failure' | 'lost';
export type AirPurifierQuestState = 'active' | 'resolved' | 'failed';

export type AirPurifierQuest = {
  eventId: string;
  dayKey: string;
  starIndex: number;
  affectedBodyIndex: number;
  sourceStarIndex: number;
  sourceBodyIndex: number;
  startedAt: number;
  deadlineAt: number;
  state: AirPurifierQuestState;
  condition: StarCondition;
  capacityPercent: number;
  repairMethod?: 'found_unit' | 'trade_purchase' | 'freighter_transfer' | 'alliance_help';
  resolvedAt?: number;
};

export type ActiveQuestResponse = {
  airPurifier: AirPurifierQuest | null;
};

export type AirPurifierTradeOrder = {
  orderId: string;
  itemId: 'air_purifier_unit';
  stationStarIndex: number;
  targetStarIndex: number;
  required: ResourceStore;
  paid: ResourceStore;
  status: 'open' | 'complete' | 'cancelled';
  createdAt: number;
  completedAt?: number;
};

export function getUtcDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function getAirPurifierCondition(quest: AirPurifierQuest, now: number): { condition: StarCondition; capacityPercent: number } {
  if (quest.state === 'resolved') return { condition: 'normal', capacityPercent: 100 };
  if (quest.state === 'failed' || now >= quest.deadlineAt) return { condition: 'lost', capacityPercent: 0 };
  const criticalAt = quest.startedAt + 12 * 60 * 60 * 1000;
  if (now >= criticalAt) return { condition: 'critical_failure', capacityPercent: 40 };
  return { condition: 'reduced_capacity', capacityPercent: 75 };
}

export function isActiveAirPurifierQuest(quest: AirPurifierQuest | null): quest is AirPurifierQuest {
  return quest != null && quest.state === 'active';
}

export type QuestBuildingStatus = BuildStatus;
