import type { FeatureType } from './galaxy';

export type ResourceId = string;

export interface ResourceDefinition {
  id: ResourceId;
  name: string;
  shortName: string;
  order: number;
  enabled: boolean;
}

// Data-driven resource catalog. Add rows here to expand the economy UI.
export const RESOURCE_CATALOG: readonly ResourceDefinition[] = [
  { id: 'ore', name: 'Ore', shortName: 'ORE', order: 10, enabled: true },
  { id: 'food', name: 'Food', shortName: 'FOOD', order: 20, enabled: true },
  { id: 'energy', name: 'Energy', shortName: 'ENERGY', order: 30, enabled: true },
  { id: 'atomics', name: 'Atomics', shortName: 'ATOM', order: 40, enabled: false },
] as const;

export interface FeatureResourceMapping {
  featureType: FeatureType;
  produces: readonly ResourceId[];
  stores: readonly ResourceId[];
}

// Temporary mapping for current planet feature set.
export const FEATURE_RESOURCE_MAPPINGS: readonly FeatureResourceMapping[] = [
  { featureType: 'mine', produces: ['ore'], stores: [] },
  { featureType: 'colony', produces: ['food'], stores: [] },
  { featureType: 'refinery', produces: ['energy'], stores: [] },
  { featureType: 'station', produces: [], stores: ['ore', 'food', 'energy'] },
  { featureType: 'relay', produces: [], stores: [] },
  { featureType: 'solar_array', produces: ['energy'], stores: [] },
  { featureType: 'outpost', produces: [], stores: [] },
] as const;

const resourceById = new Map(RESOURCE_CATALOG.map((resource) => [resource.id, resource]));
const featureMapByType = new Map(FEATURE_RESOURCE_MAPPINGS.map((mapping) => [mapping.featureType, mapping]));

export function getEnabledResources(): ResourceDefinition[] {
  return RESOURCE_CATALOG
    .filter((resource) => resource.enabled)
    .slice()
    .sort((a, b) => a.order - b.order);
}

export function getResourceDisplayName(resourceId: ResourceId): string {
  return resourceById.get(resourceId)?.name ?? resourceId;
}

export function getFeatureResourceIds(featureType: FeatureType): ResourceId[] {
  const mapping = featureMapByType.get(featureType);
  if (!mapping) return [];

  const ids = new Set<ResourceId>();
  for (const resourceId of mapping.produces) ids.add(resourceId);
  for (const resourceId of mapping.stores) ids.add(resourceId);
  return Array.from(ids);
}

export function getFeatureResourceNames(featureType: FeatureType): string[] {
  return getFeatureResourceIds(featureType).map(getResourceDisplayName);
}
