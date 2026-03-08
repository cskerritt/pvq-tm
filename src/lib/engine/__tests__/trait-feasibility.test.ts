import { describe, it, expect } from 'vitest';
import {
  computeTFQ,
  buildDOTDemandVector,
  buildOccupationDemands,
} from '@/lib/engine/trait-feasibility';
import { type TraitVector, TRAIT_KEYS } from '@/lib/engine/traits';

// ─── Helpers ──────────────────────────────────────────────────────────

/** Build a TraitVector with all traits set to a single value. */
function uniformVector(value: number | null): TraitVector {
  const v: Partial<TraitVector> = {};
  for (const key of TRAIT_KEYS) {
    v[key] = value;
  }
  return v as TraitVector;
}

/** Build a TraitVector with defaults that can be partially overridden. */
function makeVector(
  base: number | null,
  overrides: Partial<Record<string, number | null>> = {},
): TraitVector {
  const v = uniformVector(base);
  for (const [key, val] of Object.entries(overrides)) {
    (v as Record<string, number | null>)[key] = val;
  }
  return v;
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('computeTFQ', () => {
  it('should pass when worker capacity meets or exceeds all demands', () => {
    const worker = uniformVector(3);
    const demands = uniformVector(2);

    const result = computeTFQ(worker, demands);

    expect(result.passes).toBe(true);
    expect(result.tfq).toBeGreaterThan(0);
    expect(result.failedTraits).toEqual([]);
  });

  it('should fail when any single trait demand exceeds capacity', () => {
    const worker = makeVector(3, { strength: 1 });
    const demands = makeVector(2, { strength: 3 });

    const result = computeTFQ(worker, demands);

    expect(result.passes).toBe(false);
    expect(result.tfq).toBe(0);
    expect(result.failedTraits.length).toBeGreaterThan(0);
    expect(result.failedTraits.some((t) => t.trait === 'strength')).toBe(true);
  });

  it('should report multiple failed traits', () => {
    const worker = makeVector(1);
    const demands = makeVector(3);

    const result = computeTFQ(worker, demands);

    expect(result.passes).toBe(false);
    expect(result.failedTraits.length).toBe(24); // all traits fail
  });

  it('should handle null worker capacity (treated as passing)', () => {
    const worker = uniformVector(null);
    const demands = uniformVector(2);

    const result = computeTFQ(worker, demands);

    // null capacity vs non-null demand: margin is null, passes is true
    expect(result.passes).toBe(true);
  });

  it('should handle null occupation demands (treated as passing)', () => {
    const worker = uniformVector(2);
    const demands = uniformVector(null);

    const result = computeTFQ(worker, demands);

    expect(result.passes).toBe(true);
  });

  it('should return higher TFQ with greater reserve margin', () => {
    const demands = uniformVector(1);

    const workerHigh = uniformVector(4);
    const workerLow = uniformVector(2);

    const resultHigh = computeTFQ(workerHigh, demands);
    const resultLow = computeTFQ(workerLow, demands);

    expect(resultHigh.tfq).toBeGreaterThan(resultLow.tfq);
  });

  it('should include trait comparisons for all 24 traits', () => {
    const worker = uniformVector(3);
    const demands = uniformVector(2);

    const result = computeTFQ(worker, demands);

    expect(result.traitComparisons.length).toBe(24);
  });

  it('should clamp TFQ between 0 and 100', () => {
    const worker = uniformVector(4);
    const demands = uniformVector(0);

    const result = computeTFQ(worker, demands);

    expect(result.tfq).toBeLessThanOrEqual(100);
    expect(result.tfq).toBeGreaterThanOrEqual(0);
  });

  it('should track data sources in comparisons', () => {
    const worker = uniformVector(3);
    const demands = uniformVector(2);
    const sources: Partial<Record<string, 'ORS' | 'DOT' | 'ONET' | 'proxy'>> = {
      reasoning: 'DOT',
      strength: 'ORS',
    };

    const result = computeTFQ(worker, demands, sources);

    const reasoningComp = result.traitComparisons.find((c) => c.trait === 'reasoning');
    expect(reasoningComp?.source).toBe('DOT');

    const strengthComp = result.traitComparisons.find((c) => c.trait === 'strength');
    expect(strengthComp?.source).toBe('ORS');
  });
});

describe('buildDOTDemandVector', () => {
  it('should map GED and strength to correct trait keys', () => {
    const { demands, sources } = buildDOTDemandVector({
      gedR: 3,
      gedM: 2,
      gedL: 4,
      strength: 'M',
    });

    expect(demands.reasoning).toBe(2); // normalizeDOTGED(3) = 2
    expect(demands.math).toBe(1);      // normalizeDOTGED(2) = 1
    expect(demands.language).toBe(2);   // normalizeDOTGED(4) = 2
    expect(demands.strength).toBe(2);   // normalizeDOTStrength('M') = 2

    expect(sources.reasoning).toBe('DOT');
    expect(sources.math).toBe('DOT');
    expect(sources.language).toBe('DOT');
    expect(sources.strength).toBe('DOT');
  });

  it('should set remaining traits to null with proxy source', () => {
    const { demands, sources } = buildDOTDemandVector({
      gedR: 3,
      gedM: 2,
      gedL: 4,
      strength: 'L',
    });

    // Traits not mapped from DOT should be null
    expect(demands.spatialPerception).toBeNull();
    expect(demands.fingerDexterity).toBeNull();
    expect(demands.hazards).toBeNull();

    expect(sources.spatialPerception).toBe('proxy');
    expect(sources.fingerDexterity).toBe('proxy');
  });

  it('should handle sedentary strength', () => {
    const { demands } = buildDOTDemandVector({
      gedR: 1,
      gedM: 1,
      gedL: 1,
      strength: 'S',
    });

    expect(demands.strength).toBe(0);
    expect(demands.reasoning).toBe(0); // normalizeDOTGED(1) = 0
  });

  it('should handle very heavy strength', () => {
    const { demands } = buildDOTDemandVector({
      gedR: 6,
      gedM: 6,
      gedL: 6,
      strength: 'V',
    });

    expect(demands.strength).toBe(4);
    expect(demands.reasoning).toBe(4); // normalizeDOTGED(6) = 4
  });
});

describe('buildOccupationDemands', () => {
  it('should prioritize ORS data over DOT and ONET', () => {
    const orsData = { reasoning: 3 };
    const dotData = { reasoning: 2 };
    const onetData = { reasoning: 1 };

    const { demands, sources } = buildOccupationDemands(orsData, dotData, onetData);

    expect(demands.reasoning).toBe(3);
    expect(sources.reasoning).toBe('ORS');
  });

  it('should fall back to DOT when ORS is missing', () => {
    const dotData = { reasoning: 2 };

    const { demands, sources } = buildOccupationDemands(null, dotData, null);

    expect(demands.reasoning).toBe(2);
    expect(sources.reasoning).toBe('DOT');
  });

  it('should fall back to ONET when ORS and DOT are missing', () => {
    const onetData = { reasoning: 1 };

    const { demands, sources } = buildOccupationDemands(null, null, onetData);

    expect(demands.reasoning).toBe(1);
    expect(sources.reasoning).toBe('ONET');
  });

  it('should set proxy source when no data is available', () => {
    const { demands, sources } = buildOccupationDemands(null, null, null);

    expect(demands.reasoning).toBeNull();
    expect(sources.reasoning).toBe('proxy');
  });

  it('should handle mixed sources across different traits', () => {
    const orsData = { reasoning: 3 };
    const dotData = { strength: 2 };
    const onetData = { math: 1 };

    const { demands, sources } = buildOccupationDemands(orsData, dotData, onetData);

    expect(demands.reasoning).toBe(3);
    expect(sources.reasoning).toBe('ORS');
    expect(demands.strength).toBe(2);
    expect(sources.strength).toBe('DOT');
    expect(demands.math).toBe(1);
    expect(sources.math).toBe('ONET');
  });
});
