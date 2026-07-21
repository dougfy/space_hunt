import { describe, expect, it } from 'vitest';
import {
  getEnabledResources,
  getFeatureResourceIds,
  getFeatureResourceNames,
} from '../economy-catalog';

describe('economy catalog', () => {
  it('returns enabled resources in display order', () => {
    const enabled = getEnabledResources();
    expect(enabled.map((resource) => resource.id)).toEqual(['ore', 'food', 'energy']);
  });

  it('maps planet features to resource ids', () => {
    expect(getFeatureResourceIds('mine')).toEqual(['ore']);
    expect(getFeatureResourceIds('colony')).toEqual(['food']);
    expect(getFeatureResourceIds('refinery')).toEqual(['energy']);
  });

  it('maps utility features to no resource names', () => {
    expect(getFeatureResourceNames('relay')).toEqual([]);
    expect(getFeatureResourceNames('outpost')).toEqual([]);
  });
});
