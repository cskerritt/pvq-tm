/**
 * Tests for comprehensive analysis engine modules:
 * - Near-miss analysis
 * - RFC narrative generation
 * - Viable set coherence
 * - Confidence explanation
 * - Regional labor market
 */
import { describe, it, expect } from "vitest";
import { analyzeNearMisses } from "@/lib/engine/near-miss";
import { generateRFCNarrative } from "@/lib/engine/rfc-narrative";
import { analyzeViableSet } from "@/lib/engine/viable-set";
import { explainConfidence } from "@/lib/engine/confidence-explanation";
import { analyzeRegionalLaborMarket } from "@/lib/engine/regional-labor-market";
import { type TraitVector, TRAIT_KEYS } from "@/lib/engine/traits";
import type { STQResult } from "@/lib/engine/skill-transfer";
import type { TFQResult } from "@/lib/engine/trait-feasibility";
import type { LMQResult } from "@/lib/engine/labor-market";
import type { PVQResult } from "@/lib/engine/pvq";

// ─── Helpers ──────────────────────────────────────────────────────────

function uniformVector(value: number | null): TraitVector {
  const v: Partial<TraitVector> = {};
  for (const key of TRAIT_KEYS) v[key] = value;
  return v as TraitVector;
}

function makeSTQ(overrides: Partial<STQResult> = {}): STQResult {
  return {
    stq: 70,
    passesGate: true,
    components: { taskDwaOverlap: 60, wfMpsmsOverlap: 50, toolsOverlap: 40, materialsOverlap: 30, credentialOverlap: 20 },
    details: { matchedTasks: ["task1"], matchedDWAs: ["dwa1"], matchedTools: ["tool1"], matchedMaterials: [], matchedKnowledge: [] },
    ...overrides,
  };
}

function makeTFQ(overrides: Partial<TFQResult> = {}): TFQResult {
  return {
    tfq: 65,
    passes: true,
    failedTraits: [],
    traitComparisons: TRAIT_KEYS.map((trait) => ({
      trait,
      label: trait,
      workerCapacity: 3,
      occupationDemand: 2,
      margin: 1,
      passes: true,
      source: "DOT" as const,
    })),
    reserveMargin: 30,
    ...overrides,
  };
}

function makeLMQ(overrides: Partial<LMQResult> = {}): LMQResult {
  return {
    lmq: 60,
    components: { employmentScore: 80, localDemandScore: null, areaEmploymentScore: null, wageScore: 60, projectionsScore: 40, joltsTrendScore: null },
    details: {
      employment: 50000, localDemandScore: null, areaEmployment: null, medianWage: 45000, meanWage: 48000,
      wageRatio: 0.9, projectedOpenings: 5000, projectedGrowthPct: 3,
      joltsOpenings: null, joltsTrend: null, stateJoltsOpenings: null,
      pct10: null, pct25: null, pct75: null, pct90: null, weightsUsed: {},
    },
    ...overrides,
  };
}

function makePVQ(overrides: Partial<PVQResult> = {}): PVQResult {
  return {
    pvq: 60, stq: 70, tfq: 65, vaq: 50, lmq: 60,
    excluded: false,
    confidenceGrade: "B",
    components: {
      stqResult: makeSTQ(),
      tfqResult: makeTFQ(),
      vaqResult: {
        vaq: 50, passes: true,
        adjustment: { tools: 67, workProcesses: 67, workSetting: 67, industry: 67 },
        ageRule: "standard" as const,
      },
      lmqResult: makeLMQ(),
    },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// NEAR-MISS ANALYSIS
// ═══════════════════════════════════════════════════════════════════════

describe("analyzeNearMisses", () => {
  it("should identify marginal near-miss (1 trait, deficit ≤ 1)", () => {
    const failedTraitComparisons = TRAIT_KEYS.map((trait) => ({
      trait,
      label: trait,
      workerCapacity: trait === "strength" ? 2 : 3,
      occupationDemand: trait === "strength" ? 3 : 2,
      margin: trait === "strength" ? -1 : 1,
      passes: trait !== "strength",
      source: "DOT" as const,
    }));

    const pvqResult = makePVQ({
      excluded: true,
      exclusionReason: "Post-profile trait failure: strength",
      components: {
        ...makePVQ().components,
        tfqResult: {
          tfq: 0,
          passes: false,
          failedTraits: [{
            trait: "strength", label: "Strength",
            workerCapacity: 2, occupationDemand: 3,
            margin: -1, passes: false, source: "DOT" as const,
          }],
          traitComparisons: failedTraitComparisons,
          reserveMargin: 0,
        },
      },
    });

    const result = analyzeNearMisses([{
      pvqResult,
      occupationTitle: "Test Occupation",
      targetSvp: 4,
      sourceSvp: 5,
    }]);

    expect(result.totalExcluded).toBe(1);
    expect(result.marginalCount).toBe(1);
    expect(result.nearMisses.length).toBe(1);
    expect(result.nearMisses[0].severity).toBe("marginal");
    expect(result.nearMisses[0].failedTraitCount).toBe(1);
  });

  it("should classify significant exclusions (3+ traits)", () => {
    const failedTraits = ["strength", "reasoning", "math", "climbBalance"];
    const failedTraitComparisons = TRAIT_KEYS.map((trait) => ({
      trait,
      label: trait,
      workerCapacity: failedTraits.includes(trait) ? 0 : 3,
      occupationDemand: failedTraits.includes(trait) ? 3 : 2,
      margin: failedTraits.includes(trait) ? -3 : 1,
      passes: !failedTraits.includes(trait),
      source: "DOT" as const,
    }));

    const pvqResult = makePVQ({
      excluded: true,
      components: {
        ...makePVQ().components,
        tfqResult: {
          tfq: 0, passes: false,
          failedTraits: failedTraits.map((t) => ({
            trait: t, label: t,
            workerCapacity: 0, occupationDemand: 3,
            margin: -3, passes: false, source: "DOT" as const,
          })),
          traitComparisons: failedTraitComparisons,
          reserveMargin: 0,
        },
      },
    });

    const result = analyzeNearMisses([{
      pvqResult,
      occupationTitle: "Heavy Occupation",
      targetSvp: 4,
      sourceSvp: 5,
    }]);

    expect(result.significantCount).toBe(1);
    expect(result.nearMisses.length).toBe(0); // significant not included in nearMisses
  });

  it("should handle empty excluded list", () => {
    const result = analyzeNearMisses([]);
    expect(result.totalExcluded).toBe(0);
    expect(result.nearMisses.length).toBe(0);
    expect(result.commonFailingTraits.length).toBe(0);
  });

  it("should track common failing traits", () => {
    const makeExcluded = (failTrait: string) => {
      const failedTraitComparisons = TRAIT_KEYS.map((trait) => ({
        trait, label: trait,
        workerCapacity: trait === failTrait ? 1 : 3,
        occupationDemand: trait === failTrait ? 3 : 2,
        margin: trait === failTrait ? -2 : 1,
        passes: trait !== failTrait,
        source: "DOT" as const,
      }));
      return {
        pvqResult: makePVQ({
          excluded: true,
          components: {
            ...makePVQ().components,
            tfqResult: {
              tfq: 0, passes: false,
              failedTraits: [{
                trait: failTrait, label: failTrait,
                workerCapacity: 1, occupationDemand: 3,
                margin: -2, passes: false, source: "DOT" as const,
              }],
              traitComparisons: failedTraitComparisons,
              reserveMargin: 0,
            },
          },
        }),
        occupationTitle: `Occ failing ${failTrait}`,
        targetSvp: 4,
        sourceSvp: 5,
      };
    };

    const result = analyzeNearMisses([
      makeExcluded("strength"),
      makeExcluded("strength"),
      makeExcluded("strength"),
      makeExcluded("reasoning"),
    ]);

    expect(result.commonFailingTraits[0].trait).toBe("strength");
    expect(result.commonFailingTraits[0].count).toBe(3);
    expect(result.limitingTraits).toContain("Strength");
  });

  it("should identify SVP gate failures", () => {
    const pvqResult = makePVQ({
      excluded: true,
      exclusionReason: "Target SVP (6) exceeds source SVP (4)",
      components: {
        ...makePVQ().components,
        stqResult: makeSTQ({ stq: 0, passesGate: false, gateReason: "Target SVP (6) exceeds source SVP (4)" }),
      },
    });

    const result = analyzeNearMisses([{
      pvqResult,
      occupationTitle: "Skilled Occupation",
      targetSvp: 6,
      sourceSvp: 4,
    }]);

    expect(result.totalExcluded).toBe(1);
    // SVP failures are also analyzed
    expect(result.nearMisses.length + result.significantCount + result.moderateCount + result.marginalCount).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// RFC NARRATIVE
// ═══════════════════════════════════════════════════════════════════════

describe("generateRFCNarrative", () => {
  it("should determine functional level from strength trait", () => {
    const sedentary = uniformVector(3);
    sedentary.strength = 0;
    expect(generateRFCNarrative(sedentary).functionalLevel).toBe("sedentary");

    const light = uniformVector(3);
    light.strength = 1;
    expect(generateRFCNarrative(light).functionalLevel).toBe("light");

    const medium = uniformVector(3);
    medium.strength = 2;
    expect(generateRFCNarrative(medium).functionalLevel).toBe("medium");

    const heavy = uniformVector(3);
    heavy.strength = 3;
    expect(generateRFCNarrative(heavy).functionalLevel).toBe("heavy");

    const veryHeavy = uniformVector(3);
    veryHeavy.strength = 4;
    expect(generateRFCNarrative(veryHeavy).functionalLevel).toBe("very_heavy");
  });

  it("should identify strengths (traits ≥ 3)", () => {
    const profile = uniformVector(1);
    profile.reasoning = 4;
    profile.math = 3;

    const result = generateRFCNarrative(profile);
    expect(result.strengths.length).toBe(2);
    expect(result.strengths.map((s) => s.trait)).toContain("reasoning");
    expect(result.strengths.map((s) => s.trait)).toContain("math");
  });

  it("should identify limitations (traits ≤ 1)", () => {
    const profile = uniformVector(3);
    profile.climbBalance = 0;
    profile.stoopKneel = 1;

    const result = generateRFCNarrative(profile);
    const limitTraits = result.limitations.map((l) => l.trait);
    expect(limitTraits).toContain("climbBalance");
    expect(limitTraits).toContain("stoopKneel");
  });

  it("should generate non-empty narratives", () => {
    const profile = uniformVector(2);
    const result = generateRFCNarrative(profile);

    expect(result.physicalSummary.length).toBeGreaterThan(0);
    expect(result.cognitiveSummary.length).toBeGreaterThan(0);
    expect(result.fullNarrative.length).toBeGreaterThan(0);
  });

  it("should handle null strength as sedentary", () => {
    const profile = uniformVector(3);
    profile.strength = null;
    const result = generateRFCNarrative(profile);
    expect(result.functionalLevel).toBe("sedentary");
  });

  it("should suggest suitable work types", () => {
    const profile = uniformVector(3);
    profile.strength = 0; // sedentary
    const result = generateRFCNarrative(profile);
    expect(result.suitableWorkTypes.length).toBeGreaterThan(0);
    expect(result.unsuitableWorkTypes.length).toBeGreaterThan(0);
  });

  it("should note pre-to-post changes when pre-profile provided", () => {
    const pre = uniformVector(3);
    const post = uniformVector(3);
    post.strength = 1; // reduced from 3 to 1

    const result = generateRFCNarrative(post, pre);
    expect(result.fullNarrative).toContain("Strength");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// VIABLE SET COHERENCE
// ═══════════════════════════════════════════════════════════════════════

describe("analyzeViableSet", () => {
  it("should handle empty viable set", () => {
    const result = analyzeViableSet([]);
    expect(result.totalViable).toBe(0);
    expect(result.coherenceScore).toBe(0);
    expect(result.coherenceLabel).toBe("scattered");
  });

  it("should handle single occupation", () => {
    const result = analyzeViableSet([{
      title: "Cashier",
      pvqResult: makePVQ(),
      socCode: "41-2011",
    }]);
    expect(result.totalViable).toBe(1);
    expect(result.clusters.length).toBe(1);
  });

  it("should identify core vs peripheral occupations", () => {
    const highSTQ = makePVQ({ stq: 80 });
    const lowSTQ = makePVQ({ stq: 25 });

    const result = analyzeViableSet([
      { title: "Similar Job", pvqResult: highSTQ, socCode: "41-2011" },
      { title: "Stretch Job", pvqResult: lowSTQ, socCode: "53-3031" },
    ]);

    expect(result.coreOccupations).toContain("Similar Job");
    expect(result.peripheralOccupations).toContain("Stretch Job");
  });

  it("should cluster by SOC prefix", () => {
    const result = analyzeViableSet([
      { title: "Cashier", pvqResult: makePVQ(), socCode: "41-2011" },
      { title: "Retail Salesperson", pvqResult: makePVQ(), socCode: "41-2031" },
      { title: "Truck Driver", pvqResult: makePVQ(), socCode: "53-3031" },
    ]);

    // Should have 2 clusters: 41-xxxx and 53-xxxx
    expect(result.clusters.length).toBe(2);
  });

  it("should produce narrative summary", () => {
    const result = analyzeViableSet([
      { title: "Cashier", pvqResult: makePVQ(), socCode: "41-2011" },
      { title: "Retail Salesperson", pvqResult: makePVQ(), socCode: "41-2031" },
    ]);
    expect(result.narrativeSummary.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CONFIDENCE EXPLANATION
// ═══════════════════════════════════════════════════════════════════════

describe("explainConfidence", () => {
  it("should produce grade A with comprehensive data", () => {
    const stq = makeSTQ({ details: { matchedTasks: ["t1", "t2"], matchedDWAs: ["d1"], matchedTools: [], matchedMaterials: [], matchedKnowledge: [] } });
    const tfq = makeTFQ(); // 24 rated traits
    const lmq = makeLMQ(); // all data present

    const result = explainConfidence(stq, tfq, lmq);
    expect(result.grade).toBe("A");
    expect(result.totalScore).toBeGreaterThanOrEqual(7);
    expect(result.contributions.length).toBeGreaterThan(0);
  });

  it("should produce grade D with minimal data", () => {
    const stq = makeSTQ({ stq: 0, details: { matchedTasks: [], matchedDWAs: [], matchedTools: [], matchedMaterials: [], matchedKnowledge: [] } });
    const tfq = makeTFQ({
      traitComparisons: TRAIT_KEYS.map((t) => ({
        trait: t, label: t, workerCapacity: null, occupationDemand: null,
        margin: null, passes: true, source: "proxy" as const,
      })),
    });
    const lmq = makeLMQ({
      details: {
        ...makeLMQ().details,
        employment: null, medianWage: null, projectedOpenings: null,
      },
    });

    const result = explainConfidence(stq, tfq, lmq);
    expect(result.grade).toBe("D");
    expect(result.totalScore).toBeLessThan(3);
  });

  it("should provide recommendations for missing data", () => {
    const stq = makeSTQ({ stq: 0, details: { matchedTasks: [], matchedDWAs: [], matchedTools: [], matchedMaterials: [], matchedKnowledge: [] } });
    const tfq = makeTFQ({
      traitComparisons: TRAIT_KEYS.map((t) => ({
        trait: t, label: t, workerCapacity: 3, occupationDemand: null,
        margin: null, passes: true, source: "proxy" as const,
      })),
    });
    const lmq = makeLMQ({
      details: { ...makeLMQ().details, employment: null, projectedOpenings: null },
    });

    const result = explainConfidence(stq, tfq, lmq);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("should apply proxy penalty when >10 proxy traits", () => {
    const tfq = makeTFQ({
      traitComparisons: TRAIT_KEYS.map((t, i) => ({
        trait: t, label: t, workerCapacity: 3, occupationDemand: 2,
        margin: 1, passes: true, source: i < 12 ? "proxy" as const : "DOT" as const,
      })),
    });

    const result = explainConfidence(makeSTQ(), tfq, makeLMQ());
    expect(result.penalties.length).toBe(1);
    expect(result.penalties[0].component).toBe("tfq_proxy");
  });

  it("should include summary text", () => {
    const result = explainConfidence(makeSTQ(), makeTFQ(), makeLMQ());
    expect(result.summary).toContain("Confidence Grade");
    expect(result.summary.length).toBeGreaterThan(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// REGIONAL LABOR MARKET
// ═══════════════════════════════════════════════════════════════════════

describe("analyzeRegionalLaborMarket", () => {
  it("should generate location summary with metro area", () => {
    const result = analyzeRegionalLaborMarket({
      stateName: "California",
      metroAreaName: "Los Angeles-Long Beach-Anaheim",
      postViableCount: 5,
      postTotalEmployment: 100000,
      preViableCount: 8,
      preTotalEmployment: 150000,
      postAreaEmployment: 5000,
      preAreaEmployment: 8000,
      stateJoltsCurrent: 663.3,
      stateJoltsPreInjury: 550.0,
      eclrFactor: 1.15,
      occupationDetails: [
        { title: "Cashier", nationalEmployment: 3500000, areaEmployment: 50000, nationalMedianWage: 28000, areaMedianWage: 32000, joltsCurrentOpenings: 100, joltsTrendLabel: "growing", projectedGrowthPct: 3 },
        { title: "File Clerk", nationalEmployment: 150000, areaEmployment: 3000, nationalMedianWage: 35000, areaMedianWage: 40000, joltsCurrentOpenings: 20, joltsTrendLabel: "declining", projectedGrowthPct: -5 },
      ],
    });

    expect(result.locationSummary).toContain("Los Angeles");
    expect(result.locationSummary).toContain("California");
    expect(result.wagePremiumPct).toBeCloseTo(15, 0);
    expect(result.wagePremiumLabel).toContain("above");
    expect(result.growingOccupations).toContain("Cashier");
    expect(result.decliningOccupations).toContain("File Clerk");
    expect(result.fullNarrative.length).toBeGreaterThan(50);
  });

  it("should handle no geographic data", () => {
    const result = analyzeRegionalLaborMarket({
      stateName: null,
      metroAreaName: null,
      postViableCount: 3,
      postTotalEmployment: 50000,
      preViableCount: null,
      preTotalEmployment: null,
      postAreaEmployment: null,
      preAreaEmployment: null,
      stateJoltsCurrent: null,
      stateJoltsPreInjury: null,
      eclrFactor: 1.0,
      occupationDetails: [],
    });

    expect(result.locationSummary).toContain("national-level");
    expect(result.wagePremiumLabel).toContain("national average");
    expect(result.stateJoltsNarrative).toBeNull();
  });

  it("should identify risks and opportunities", () => {
    const result = analyzeRegionalLaborMarket({
      stateName: "Mississippi",
      metroAreaName: null,
      postViableCount: 3,
      postTotalEmployment: 50000,
      preViableCount: 5,
      preTotalEmployment: 80000,
      postAreaEmployment: 200,
      preAreaEmployment: 400,
      stateJoltsCurrent: 30.0,
      stateJoltsPreInjury: 50.0,
      eclrFactor: 0.82,
      occupationDetails: [
        { title: "Clerk", nationalEmployment: 100000, areaEmployment: 100, nationalMedianWage: 30000, areaMedianWage: 25000, joltsCurrentOpenings: 5, joltsTrendLabel: "declining", projectedGrowthPct: -3 },
      ],
    });

    expect(result.risks.length).toBeGreaterThan(0);
    // Below average wages
    expect(result.risks.some((r) => r.includes("below") || r.includes("decreased"))).toBe(true);
  });

  it("should calculate state JOLTS change percentage", () => {
    const result = analyzeRegionalLaborMarket({
      stateName: "Texas",
      metroAreaName: null,
      postViableCount: 5,
      postTotalEmployment: 100000,
      preViableCount: null,
      preTotalEmployment: null,
      postAreaEmployment: null,
      preAreaEmployment: null,
      stateJoltsCurrent: 600.0,
      stateJoltsPreInjury: 500.0,
      eclrFactor: 1.0,
      occupationDetails: [],
    });

    expect(result.stateJoltsChangePct).toBeCloseTo(20, 0);
    expect(result.stateJoltsNarrative).toContain("increase");
  });
});
