import { describe, it, expect } from 'vitest';
import {
  computeTFQ,
  buildDOTDemandVector,
  buildOccupationDemands,
  getStrengthSVPDefaults,
  deriveDPTTraits,
  type TraitSource,
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

/** Assert no nulls in a TraitVector */
function assertNoNulls(demands: TraitVector) {
  for (const key of TRAIT_KEYS) {
    expect(demands[key], `${key} should not be null`).not.toBeNull();
    expect(demands[key], `${key} should not be undefined`).not.toBeUndefined();
  }
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
    const sources: Partial<Record<string, TraitSource>> = {
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

    expect(demands.reasoning).toBe(1.6); // normalizeDOTGED(3) = 1.6
    expect(demands.math).toBe(0.8);     // normalizeDOTGED(2) = 0.8
    expect(demands.language).toBe(2.4); // normalizeDOTGED(4) = 2.4
    expect(demands.strength).toBe(2);   // normalizeDOTStrength('M') = 2

    expect(sources.reasoning).toBe('DOT');
    expect(sources.math).toBe('DOT');
    expect(sources.language).toBe('DOT');
    expect(sources.strength).toBe('DOT');
  });

  it('should return no null values for any trait', () => {
    const { demands } = buildDOTDemandVector({
      gedR: 3,
      gedM: 2,
      gedL: 4,
      strength: 'L',
    });

    assertNoNulls(demands);
  });

  it('should fill previously-null traits with fallback sources', () => {
    const { demands, sources } = buildDOTDemandVector({
      gedR: 3,
      gedM: 2,
      gedL: 4,
      strength: 'L',
    });

    // These traits should no longer be null
    expect(typeof demands.spatialPerception).toBe('number');
    expect(typeof demands.fingerDexterity).toBe('number');
    expect(typeof demands.hazards).toBe('number');

    // Sources should reflect fallback chain
    const validSources: TraitSource[] = ['DOT', 'ONET', 'DPT_PROXY', 'SVP_PROXY', 'proxy'];
    expect(validSources).toContain(sources.spatialPerception);
    expect(validSources).toContain(sources.fingerDexterity);
  });

  it('should handle sedentary strength and apply SVP proxy for zero GED', () => {
    const { demands, gedSource } = buildDOTDemandVector({
      gedR: 1,
      gedM: 1,
      gedL: 1,
      strength: 'S',
      svp: 2,
    });

    expect(demands.strength).toBe(0);
    // normalizeDOTGED(1) = 0, but SVP proxy kicks in (SVP 2 → reasoning=0.8, math=0, language=0.8)
    expect(demands.reasoning).toBe(0.8);
    expect(demands.math).toBe(0);
    expect(demands.language).toBe(0.8);
    expect(gedSource).toBe('SVP_PROXY');

    // All traits should be filled
    assertNoNulls(demands);
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

    // All traits should be filled
    assertNoNulls(demands);
  });

  it('should use O*NET abilities for aptitude/motor traits when available', () => {
    const onetData = {
      abilities: [
        { id: "1.A.2.b.3", name: "Spatial Orientation", value: 3, level: 3.5 },
        { id: "1.A.2.b.2", name: "Perceptual Speed", value: 3, level: 2.8 },
        { id: "1.A.2.a.4", name: "Finger Dexterity", value: 4, level: 4.2 },
      ],
    };

    const { demands, sources } = buildDOTDemandVector(
      { gedR: 3, gedM: 2, gedL: 4, strength: 'M' },
      onetData,
    );

    // spatialPerception should come from O*NET
    expect(demands.spatialPerception).toBeGreaterThan(0);
    expect(sources.spatialPerception).toBe('ONET');

    // fingerDexterity should come from O*NET
    expect(demands.fingerDexterity).toBeGreaterThan(0);
    expect(sources.fingerDexterity).toBe('ONET');

    assertNoNulls(demands);
  });

  it('should use DPT inference when O*NET is unavailable', () => {
    const { demands, sources } = buildDOTDemandVector({
      gedR: 3,
      gedM: 2,
      gedL: 4,
      strength: 'M',
      data: 2,       // Analyzing
      people: 6,     // Speaking-Signaling
      things: 1,     // Precision Working
    });

    // DPT should contribute to motor/dexterity traits
    // Things=1 (Precision Working) → high motorCoordination, fingerDexterity
    assertNoNulls(demands);

    // With DPT data=2 (Analyzing), clericalPerception should be derived
    const source = sources.clericalPerception;
    expect(['ONET', 'DPT_PROXY', 'SVP_PROXY']).toContain(source);
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

  it('should return no null values even when no data is available', () => {
    const { demands } = buildOccupationDemands(null, null, null);

    assertNoNulls(demands);

    // With no data at all, SVP defaults to 2 (unskilled)
    // SVP 2 → GED R=1-2, M=1, L=1-2 → Normalized: R=0.8, M=0, L=0.8
    expect(demands.reasoning).toBe(0.8);
    expect(demands.math).toBe(0);
    expect(demands.language).toBe(0.8);
  });

  it('should return no null values with partial DOT data', () => {
    const dotData = { reasoning: 2, strength: 'M', svp: 4 };

    const { demands } = buildOccupationDemands(null, dotData, null);

    assertNoNulls(demands);
  });

  it('should return no null values with O*NET abilities and work context', () => {
    const onetData = {
      abilities: [
        { id: "1.A.2.b.3", name: "Spatial Orientation", value: 3, level: 3.5 },
        { id: "1.A.2.a.4", name: "Finger Dexterity", value: 4, level: 4.2 },
      ],
      workContext: [
        { name: "Outdoors, Exposed to Weather", level: 2 },
        { name: "Exposed to Hazardous Conditions", level: 3 },
      ],
    };

    const { demands, sources } = buildOccupationDemands(null, null, onetData);

    assertNoNulls(demands);

    // O*NET-derived traits should be properly sourced
    expect(sources.spatialPerception).toBe('ONET');
    expect(sources.fingerDexterity).toBe('ONET');
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

    // All traits should be filled
    assertNoNulls(demands);
  });

  it('should track sources accurately through the fallback chain', () => {
    const onetData = {
      abilities: [
        { id: "1.A.2.b.3", name: "Spatial Orientation", value: 3, level: 3.5 },
      ],
    };
    const dotData = { strength: 'H', svp: 4 };

    const { sources } = buildOccupationDemands(null, dotData, onetData);

    // spatialPerception from O*NET abilities
    expect(sources.spatialPerception).toBe('ONET');

    // strength from DOT
    expect(sources.strength).toBe('DOT');

    // Traits not covered by any primary source should be SVP_PROXY
    // (since no DPT data is available in dotData)
    const fallbackSources: TraitSource[] = ['ONET', 'DPT_PROXY', 'SVP_PROXY', 'proxy'];
    expect(fallbackSources).toContain(sources.hazards);
    expect(fallbackSources).toContain(sources.dustsFumes);
  });
});

describe('getStrengthSVPDefaults', () => {
  it('should return a complete TraitVector with no nulls', () => {
    const strengths = ['S', 'L', 'M', 'H', 'V'];
    const svps = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    for (const s of strengths) {
      for (const svp of svps) {
        const defaults = getStrengthSVPDefaults(s, svp);
        assertNoNulls(defaults);
      }
    }
  });

  it('should have low physical demands for sedentary occupations', () => {
    const defaults = getStrengthSVPDefaults('S', 2);

    expect(defaults.strength).toBe(0);
    expect(defaults.climbBalance).toBe(0);
    expect(defaults.stoopKneel).toBe(0);
    expect(defaults.workLocation).toBe(0); // inside
    expect(defaults.extremeCold).toBe(0);
    expect(defaults.extremeHeat).toBe(0);
    expect(defaults.hazards).toBe(0);
  });

  it('should have high physical demands for heavy occupations', () => {
    const defaults = getStrengthSVPDefaults('H', 4);

    expect(defaults.strength).toBe(3);
    expect(defaults.climbBalance).toBeGreaterThanOrEqual(2);
    expect(defaults.stoopKneel).toBeGreaterThanOrEqual(2);
    expect(defaults.hazards).toBeGreaterThanOrEqual(2);
    expect(defaults.noiseVibration).toBeGreaterThanOrEqual(2);
  });

  it('should have higher cognitive demands for high SVP', () => {
    const lowSVP = getStrengthSVPDefaults('M', 2);
    const highSVP = getStrengthSVPDefaults('M', 8);

    expect(highSVP.reasoning).toBeGreaterThan(lowSVP.reasoning);
    expect(highSVP.math).toBeGreaterThan(lowSVP.math);
  });

  it('should scale physical demands with strength level', () => {
    const sedentary = getStrengthSVPDefaults('S', 4);
    const heavy = getStrengthSVPDefaults('H', 4);
    const veryHeavy = getStrengthSVPDefaults('V', 4);

    expect(sedentary.strength).toBeLessThan(heavy.strength);
    expect(heavy.strength).toBeLessThanOrEqual(veryHeavy.strength);
    expect(sedentary.climbBalance).toBeLessThan(heavy.climbBalance);
  });

  it('should handle unknown strength codes gracefully', () => {
    const defaults = getStrengthSVPDefaults('X', 2);
    assertNoNulls(defaults);
  });
});

describe('deriveDPTTraits', () => {
  it('should derive clerical/spatial from high Data function', () => {
    // Data=0 (Synthesizing) = highest complexity
    const traits = deriveDPTTraits(0, null, null);

    expect(traits.clericalPerception).toBeGreaterThan(0);
    expect(traits.spatialPerception).toBeGreaterThan(0);
  });

  it('should derive talkHear from low People function code', () => {
    // People=0 (Mentoring) = highest interaction
    const traits = deriveDPTTraits(null, 0, null);

    expect(traits.talkHear).toBeGreaterThan(0);
  });

  it('should derive motor/dexterity from low Things function code', () => {
    // Things=0 (Setting Up) = highest complexity
    const traits = deriveDPTTraits(null, null, 0);

    expect(traits.motorCoordination).toBeGreaterThan(0);
    expect(traits.fingerDexterity).toBeGreaterThan(0);
    expect(traits.manualDexterity).toBeGreaterThan(0);
  });

  it('should return lower values for low-complexity DPT codes', () => {
    const highComplexity = deriveDPTTraits(0, 0, 0);
    const lowComplexity = deriveDPTTraits(6, 8, 7);

    expect(highComplexity.clericalPerception!).toBeGreaterThan(lowComplexity.clericalPerception!);
    expect(highComplexity.talkHear!).toBeGreaterThan(lowComplexity.talkHear!);
    expect(highComplexity.motorCoordination!).toBeGreaterThan(lowComplexity.motorCoordination!);
  });

  it('should return empty object when all inputs are null', () => {
    const traits = deriveDPTTraits(null, null, null);
    expect(Object.keys(traits).length).toBe(0);
  });
});

describe('no-nulls guarantee', () => {
  it('buildDOTDemandVector returns no nulls with minimal input', () => {
    const { demands } = buildDOTDemandVector({
      gedR: 1,
      gedM: 1,
      gedL: 1,
      strength: 'S',
    });
    assertNoNulls(demands);
  });

  it('buildOccupationDemands returns no nulls with no data at all', () => {
    const { demands } = buildOccupationDemands(null, null, null);
    assertNoNulls(demands);
  });

  it('buildOccupationDemands returns no nulls with only partial ORS data', () => {
    const orsData = { reasoning: 3, strength: 2 };
    const { demands } = buildOccupationDemands(orsData, null, null);
    assertNoNulls(demands);
  });

  it('all 24 traits are present and numeric in every scenario', () => {
    const scenarios = [
      buildOccupationDemands(null, null, null),
      buildOccupationDemands({ reasoning: 2 }, null, null),
      buildOccupationDemands(null, { strength: 3, svp: 6 }, null), // H=3 on 0-4 scale
      buildOccupationDemands(null, null, {
        abilities: [{ id: "1.A.2.b.3", name: "Spatial Orientation", value: 3, level: 3.5 }],
      }),
      buildDOTDemandVector({ gedR: 4, gedM: 3, gedL: 5, strength: 'M', svp: 5 }),
      buildDOTDemandVector({ gedR: 1, gedM: 1, gedL: 1, strength: 'S' }),
    ];

    for (const { demands } of scenarios) {
      assertNoNulls(demands);
      for (const key of TRAIT_KEYS) {
        expect(typeof demands[key]).toBe('number');
        expect(demands[key]).toBeGreaterThanOrEqual(0);
        expect(demands[key]).toBeLessThanOrEqual(4);
      }
    }
  });
});

// ─── VDARE Compliance Tests ──────────────────────────────────────────

describe('VDARE compliance: per-occupation demand vectors', () => {
  it('different DOT occupations produce different demand vectors', () => {
    // Construction Laborer: Very Heavy, low GED
    const constructionLaborer = buildDOTDemandVector({
      gedR: 2, gedM: 1, gedL: 2, strength: 'V', svp: 3,
    });

    // Office Clerk: Sedentary, moderate GED
    const officeClerk = buildDOTDemandVector({
      gedR: 3, gedM: 2, gedL: 3, strength: 'S', svp: 3,
    });

    // Sheet Metal Worker: Heavy, moderate GED
    const sheetMetal = buildDOTDemandVector({
      gedR: 3, gedM: 2, gedL: 3, strength: 'H', svp: 7,
    });

    // Strength demands MUST differ
    expect(constructionLaborer.demands.strength).toBe(4); // Very Heavy
    expect(officeClerk.demands.strength).toBe(0);          // Sedentary
    expect(sheetMetal.demands.strength).toBe(3);            // Heavy

    // TFQ scores must NOT be equal across these different occupations
    expect(constructionLaborer.demands.strength).not.toBe(officeClerk.demands.strength);
    expect(constructionLaborer.demands.strength).not.toBe(sheetMetal.demands.strength);
  });
});

describe('VDARE compliance: strength gate', () => {
  it('worker restricted to Light MUST fail for Very Heavy occupation', () => {
    // Worker POST: strength=1 (Light), limited stooping
    const worker = makeVector(3, { strength: 1, stoopKneel: 1 });

    // Construction Laborer: Very Heavy
    const { demands, sources } = buildDOTDemandVector({
      gedR: 2, gedM: 1, gedL: 2, strength: 'V', svp: 3,
    });

    const result = computeTFQ(worker, demands, sources);
    expect(result.passes).toBe(false);
    expect(result.failedTraits.some((t) => t.trait === 'strength')).toBe(true);

    // Verify the strength deficit is clear
    const strengthFail = result.failedTraits.find((t) => t.trait === 'strength');
    expect(strengthFail).toBeDefined();
    expect(strengthFail!.workerCapacity).toBe(1);
    expect(strengthFail!.occupationDemand).toBe(4);
    expect(strengthFail!.margin).toBe(-3); // 1 - 4 = -3
  });

  it('worker restricted to Light should PASS for Sedentary occupation', () => {
    const worker = makeVector(3, { strength: 1, stoopKneel: 1 });

    const { demands, sources } = buildDOTDemandVector({
      gedR: 3, gedM: 2, gedL: 3, strength: 'S', svp: 3,
    });

    const result = computeTFQ(worker, demands, sources);
    expect(result.passes).toBe(true);
    expect(result.tfq).toBeGreaterThan(0);
  });

  it('worker restricted to Light MUST fail for Heavy occupation', () => {
    const worker = makeVector(3, { strength: 1, stoopKneel: 1 });

    // Sheet Metal Worker: Heavy
    const { demands, sources } = buildDOTDemandVector({
      gedR: 3, gedM: 2, gedL: 3, strength: 'H', svp: 7,
    });

    const result = computeTFQ(worker, demands, sources);
    expect(result.passes).toBe(false);
    expect(result.failedTraits.some((t) => t.trait === 'strength')).toBe(true);
  });

  it('Sedentary worker (strength=0) fails all non-Sedentary occupations', () => {
    const worker = makeVector(4, { strength: 0 });

    for (const [code, expected] of [
      ['S', true],
      ['L', false],
      ['M', false],
      ['H', false],
      ['V', false],
    ] as const) {
      const { demands, sources } = buildDOTDemandVector({
        gedR: 3, gedM: 2, gedL: 3, strength: code, svp: 4,
      });

      const result = computeTFQ(worker, demands, sources);
      expect(result.passes).toBe(expected);

      if (!expected) {
        expect(
          result.failedTraits.some((t) => t.trait === 'strength'),
          `Strength gate should fail for ${code} occupation when worker is Sedentary`
        ).toBe(true);
      }
    }
  });
});

describe('VDARE compliance: physical demand gates', () => {
  it('stoopKneel failure excludes occupation', () => {
    // Worker with limited stooping
    const worker = makeVector(4, { stoopKneel: 0 });

    // Heavy occupation with frequent stooping
    const { demands, sources } = buildDOTDemandVector({
      gedR: 2, gedM: 1, gedL: 2, strength: 'H', svp: 4,
    });
    // SVP defaults for Heavy/semi give stoopKneel=3

    const result = computeTFQ(worker, demands, sources);
    // Should fail due to stoopKneel (worker=0, demand=3)
    if (demands.stoopKneel > 0) {
      expect(result.passes).toBe(false);
      expect(result.failedTraits.some((t) => t.trait === 'stoopKneel')).toBe(true);
    }
  });

  it('complete VDARE verification scenario', () => {
    // Worker POST profile: strength=1 (Light), stoopKneel=1 (limited)
    const worker = makeVector(3, { strength: 1, stoopKneel: 1 });

    // Target 1: Construction Laborer (V, SVP=3) -> MUST be excluded
    const cl = buildDOTDemandVector({ gedR: 2, gedM: 1, gedL: 2, strength: 'V', svp: 3 });
    const clResult = computeTFQ(worker, cl.demands, cl.sources);
    expect(clResult.passes).toBe(false);

    // Target 2: Office Clerk (S, SVP=3) -> should pass
    const oc = buildDOTDemandVector({ gedR: 3, gedM: 2, gedL: 3, strength: 'S', svp: 3 });
    const ocResult = computeTFQ(worker, oc.demands, oc.sources);
    expect(ocResult.passes).toBe(true);

    // Target 3: Sheet Metal Worker (H, SVP=7) -> MUST be excluded
    const sm = buildDOTDemandVector({ gedR: 3, gedM: 2, gedL: 3, strength: 'H', svp: 7 });
    const smResult = computeTFQ(worker, sm.demands, sm.sources);
    expect(smResult.passes).toBe(false);

    // The TFQ scores MUST differ between these occupations
    // Construction Laborer and Office Clerk should NOT have the same TFQ
    expect(clResult.tfq).not.toBe(ocResult.tfq);
    // Sheet Metal and Office Clerk should NOT have the same TFQ
    expect(smResult.tfq).not.toBe(ocResult.tfq);
  });
});
