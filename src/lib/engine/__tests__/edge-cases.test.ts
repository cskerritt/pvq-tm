/**
 * Comprehensive edge case tests for all VQS engine quotients.
 *
 * Tests boundary conditions, null handling, extreme values,
 * and realistic scenarios that expose calculation issues.
 */
import { describe, it, expect } from "vitest";
import { computeSTQ, checkSvpGate, computeAggregateSTQ, type SkillTransferInput } from "@/lib/engine/skill-transfer";
import { computeTFQ, buildDOTDemandVector, buildOccupationDemands } from "@/lib/engine/trait-feasibility";
import { computeVAQ, estimateVAQ, type VocationalAdjustment } from "@/lib/engine/vocational-adjustment";
import { computeLMQ, type LaborMarketInput } from "@/lib/engine/labor-market";
import { computePVQ, rankOccupations } from "@/lib/engine/pvq";
import { computeJOLTSTrend } from "@/lib/engine/jolts-trend";
import {
  type TraitVector,
  TRAIT_KEYS,
  normalizeDOTGED,
  normalizeDOTStrength,
  normalizeDOTPhysical,
  normalizeDOTAptitude,
  normalizeONETScore,
  normalizeORSFrequency,
  calculateReserveMargin,
  compareTraits,
} from "@/lib/engine/traits";

// ─── Helpers ──────────────────────────────────────────────────────────

function uniformVector(value: number | null): TraitVector {
  const v: Partial<TraitVector> = {};
  for (const key of TRAIT_KEYS) v[key] = value;
  return v as TraitVector;
}

function sparseVector(
  values: Partial<Record<string, number | null>>
): TraitVector {
  const v = uniformVector(null);
  for (const [key, val] of Object.entries(values)) {
    (v as Record<string, number | null>)[key] = val;
  }
  return v;
}

function makeLMQInput(overrides: Partial<LaborMarketInput> = {}): LaborMarketInput {
  return {
    employment: 50000,
    medianWage: 45000,
    meanWage: 48000,
    priorEarnings: 50000,
    projectedOpenings: 6000,
    projectedGrowthPct: 6,
    ...overrides,
  };
}

function makeSTQInput(overrides: Partial<SkillTransferInput> = {}): SkillTransferInput {
  return {
    sourceSvp: 5,
    sourceTasks: ["Inspect finished products", "Operate machines"],
    sourceDWAs: ["Monitor equipment", "Record data"],
    sourceWorkFields: ["machining"],
    sourceMPSMS: ["metal parts"],
    sourceTools: ["calipers", "micrometers"],
    sourceMaterials: ["steel", "aluminum"],
    sourceKnowledge: ["mechanical engineering"],
    targetSvp: 4,
    targetTasks: ["Inspect finished products", "Read blueprints"],
    targetDWAs: ["Monitor equipment", "Maintain records"],
    targetWorkFields: ["machining"],
    targetMPSMS: ["metal parts"],
    targetTools: ["calipers", "gauges"],
    targetMaterials: ["steel", "plastic"],
    targetKnowledge: ["mechanical engineering"],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// NORMALIZATION EDGE CASES
// ═══════════════════════════════════════════════════════════════════════

describe("normalization edge cases", () => {
  describe("normalizeDOTGED", () => {
    it("should produce distinct values for all 6 GED levels", () => {
      const values = [1, 2, 3, 4, 5, 6].map(normalizeDOTGED);
      const unique = new Set(values);
      expect(unique.size).toBe(6);
    });

    it("should produce monotonically increasing values", () => {
      for (let i = 1; i < 6; i++) {
        expect(normalizeDOTGED(i + 1)).toBeGreaterThan(normalizeDOTGED(i));
      }
    });

    it("should clamp values below 1", () => {
      expect(normalizeDOTGED(0)).toBe(0);
      expect(normalizeDOTGED(-1)).toBe(0);
    });

    it("should clamp values above 6", () => {
      expect(normalizeDOTGED(7)).toBe(4);
      expect(normalizeDOTGED(99)).toBe(4);
    });

    it("should map endpoints correctly: GED 1→0, GED 6→4", () => {
      expect(normalizeDOTGED(1)).toBe(0);
      expect(normalizeDOTGED(6)).toBe(4);
    });
  });

  describe("normalizeDOTStrength", () => {
    it("should handle all standard codes", () => {
      expect(normalizeDOTStrength("S")).toBe(0);
      expect(normalizeDOTStrength("L")).toBe(1);
      expect(normalizeDOTStrength("M")).toBe(2);
      expect(normalizeDOTStrength("H")).toBe(3);
      expect(normalizeDOTStrength("V")).toBe(4);
    });

    it("should handle lowercase codes", () => {
      expect(normalizeDOTStrength("s")).toBe(0);
      expect(normalizeDOTStrength("m")).toBe(2);
    });

    it("should return 0 for unknown codes", () => {
      expect(normalizeDOTStrength("X")).toBe(0);
      expect(normalizeDOTStrength("")).toBe(0);
    });
  });

  describe("normalizeDOTPhysical", () => {
    it("should handle all standard codes", () => {
      expect(normalizeDOTPhysical("N")).toBe(0);
      expect(normalizeDOTPhysical("O")).toBe(2);
      expect(normalizeDOTPhysical("F")).toBe(3);
      expect(normalizeDOTPhysical("C")).toBe(4);
    });

    it("should handle seldom code", () => {
      expect(normalizeDOTPhysical("S")).toBe(1);
    });
  });

  describe("normalizeDOTAptitude", () => {
    it("should invert scale: DOT 1 (best) → 4, DOT 5 (worst) → 0", () => {
      expect(normalizeDOTAptitude(1)).toBe(4);
      expect(normalizeDOTAptitude(5)).toBe(0);
    });

    it("should handle out-of-range values", () => {
      expect(normalizeDOTAptitude(0)).toBe(5); // unclamped — edge case
      expect(normalizeDOTAptitude(6)).toBe(0); // clamped to 0 via Math.max
    });
  });

  describe("normalizeONETScore", () => {
    it("should map 0-100 scale to 0-4", () => {
      expect(normalizeONETScore(0)).toBe(0);
      expect(normalizeONETScore(50)).toBe(2);
      expect(normalizeONETScore(100)).toBe(4);
    });

    it("should handle custom max scale", () => {
      expect(normalizeONETScore(3.5, 7)).toBe(2);
    });
  });

  describe("normalizeORSFrequency", () => {
    it("should return the level with highest percentage", () => {
      expect(
        normalizeORSFrequency({
          notPresent: 5,
          seldom: 10,
          occasionally: 50,
          frequently: 30,
          constantly: 5,
        })
      ).toBe(2); // occasionally has highest %
    });

    it("should handle all zeros as not present", () => {
      expect(normalizeORSFrequency({})).toBe(0);
    });

    it("should pick first highest on tie", () => {
      const result = normalizeORSFrequency({
        occasionally: 40,
        frequently: 40,
      });
      // Both 40%, picks first by array order
      expect([2, 3]).toContain(result);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TFQ EDGE CASES
// ═══════════════════════════════════════════════════════════════════════

describe("TFQ edge cases", () => {
  it("should produce lower TFQ with sparse data than full data (anti-inflation)", () => {
    // Worker with capacity 3 across the board
    const worker = uniformVector(3);

    // Full demands: all 24 traits at level 2
    const fullDemands = uniformVector(2);
    const fullResult = computeTFQ(worker, fullDemands);

    // Sparse demands: only 4 traits at level 2, rest null
    const sparseDemands = sparseVector({
      reasoning: 2,
      math: 2,
      language: 2,
      strength: 2,
    });
    const sparseResult = computeTFQ(worker, sparseDemands);

    // With the fix: sparse TFQ should be LOWER than full TFQ
    // because unrated traits contribute margin=0
    expect(sparseResult.tfq).toBeLessThan(fullResult.tfq);
  });

  it("should still pass with sparse data if no traits fail", () => {
    const worker = uniformVector(3);
    const demands = sparseVector({ reasoning: 2, strength: 2 });
    const result = computeTFQ(worker, demands);

    expect(result.passes).toBe(true);
    expect(result.tfq).toBeGreaterThan(0);
  });

  it("should fail if even one sparse trait exceeds capacity", () => {
    const worker = sparseVector({ reasoning: 1, strength: 3 });
    const demands = sparseVector({ reasoning: 3 }); // demand > capacity

    const result = computeTFQ(worker, demands);
    expect(result.passes).toBe(false);
    expect(result.failedTraits.length).toBe(1);
    expect(result.failedTraits[0].trait).toBe("reasoning");
  });

  it("should handle worker with all nulls and demands with all values", () => {
    const worker = uniformVector(null);
    const demands = uniformVector(3);
    const result = computeTFQ(worker, demands);

    // null capacity vs non-null demand: margin is null, passes is true
    expect(result.passes).toBe(true);
  });

  it("should handle both worker and demands all null", () => {
    const worker = uniformVector(null);
    const demands = uniformVector(null);
    const result = computeTFQ(worker, demands);

    expect(result.passes).toBe(true);
    expect(result.tfq).toBe(0); // no rated traits → reserve margin 0
  });

  it("should report exact margin for single trait", () => {
    const worker = sparseVector({ strength: 4 });
    const demands = sparseVector({ strength: 1 });
    const result = computeTFQ(worker, demands);

    expect(result.passes).toBe(true);
    // Margin: (4-1) = 3 for 1 trait, normalized against 24*4 = 96
    // TFQ = (3/96)*100 ≈ 3.13
    expect(result.tfq).toBeCloseTo(3.13, 1);
  });

  it("should report 100 TFQ when all traits have max margin", () => {
    const worker = uniformVector(4);
    const demands = uniformVector(0);
    const result = computeTFQ(worker, demands);

    expect(result.passes).toBe(true);
    expect(result.tfq).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TFQ RESERVE MARGIN EDGE CASES
// ═══════════════════════════════════════════════════════════════════════

describe("calculateReserveMargin edge cases", () => {
  it("should normalize against 24 traits even with few rated", () => {
    const worker = sparseVector({ reasoning: 4 });
    const demands = sparseVector({ reasoning: 0 });

    const margin = calculateReserveMargin(worker, demands);
    // 1 trait with margin 4, normalized against 24*4=96
    expect(margin).toBeCloseTo((4 / 96) * 100, 1);
  });

  it("should return 0 when no traits are rated", () => {
    const worker = uniformVector(null);
    const demands = uniformVector(null);
    expect(calculateReserveMargin(worker, demands)).toBe(0);
  });

  it("should return 100 when all 24 traits have max margin", () => {
    const worker = uniformVector(4);
    const demands = uniformVector(0);
    expect(calculateReserveMargin(worker, demands)).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// LMQ EDGE CASES
// ═══════════════════════════════════════════════════════════════════════

describe("LMQ edge cases", () => {
  describe("projections scoring (growth vs openings independence)", () => {
    it("should score high growth + moderate openings better than old AND logic", () => {
      // 50% growth, 8000 openings — previously scored 40 (required BOTH thresholds)
      const result = computeLMQ(
        makeLMQInput({ projectedGrowthPct: 50, projectedOpenings: 8000 })
      );
      // Growth=100, Openings=80, avg=90
      expect(result.components.projectionsScore).toBe(90);
    });

    it("should score moderate growth + high openings well", () => {
      const result = computeLMQ(
        makeLMQInput({ projectedGrowthPct: 3, projectedOpenings: 50000 })
      );
      // Growth=60, Openings=100, avg=80
      expect(result.components.projectionsScore).toBe(80);
    });

    it("should score declining growth with decent openings correctly", () => {
      const result = computeLMQ(
        makeLMQInput({ projectedGrowthPct: -3, projectedOpenings: 3000 })
      );
      // Growth=40, Openings=60, avg=50
      expect(result.components.projectionsScore).toBe(50);
    });

    it("should score null growth with known openings using neutral growth", () => {
      const result = computeLMQ(
        makeLMQInput({ projectedGrowthPct: null, projectedOpenings: 15000 })
      );
      // Growth=50(neutral), Openings=100, avg=75
      expect(result.components.projectionsScore).toBe(75);
    });

    it("should score known growth with null openings using neutral openings", () => {
      const result = computeLMQ(
        makeLMQInput({ projectedGrowthPct: 8, projectedOpenings: null })
      );
      // Growth=80, Openings=50(neutral), avg=65
      expect(result.components.projectionsScore).toBe(65);
    });

    it("should score both null as neutral", () => {
      const result = computeLMQ(
        makeLMQInput({ projectedGrowthPct: null, projectedOpenings: null })
      );
      expect(result.components.projectionsScore).toBe(50);
    });

    it("should score strongly declining with no openings as poor", () => {
      const result = computeLMQ(
        makeLMQInput({ projectedGrowthPct: -10, projectedOpenings: 100 })
      );
      // Growth=20, Openings=20, avg=20
      expect(result.components.projectionsScore).toBe(20);
    });
  });

  describe("wage scoring edge cases", () => {
    it("should treat priorEarnings=0 same as null (absolute wage scoring)", () => {
      const result = computeLMQ(
        makeLMQInput({ medianWage: 45000, priorEarnings: 0 })
      );
      expect(result.components.wageScore).toBe(60); // absolute: >40k
      expect(result.details.wageRatio).toBeNull();
    });

    it("should handle very high wage ratios", () => {
      const result = computeLMQ(
        makeLMQInput({ medianWage: 200000, priorEarnings: 30000 })
      );
      expect(result.components.wageScore).toBe(100); // ratio 6.67 >> 1.0
      expect(result.details.wageRatio).toBeCloseTo(6.67, 1);
    });

    it("should handle very low wage ratios", () => {
      const result = computeLMQ(
        makeLMQInput({ medianWage: 10000, priorEarnings: 100000 })
      );
      expect(result.components.wageScore).toBe(20); // ratio 0.1 < 0.5
    });
  });

  describe("area employment and JOLTS integration", () => {
    it("should include area score in LMQ when provided via legacy areaEmployment", () => {
      const result = computeLMQ(
        makeLMQInput({ areaEmployment: 5500 })
      );
      expect(result.components.areaEmploymentScore).toBe(80);
      expect(result.components.localDemandScore).toBe(80);
      expect(result.details.weightsUsed).toHaveProperty("localDemand");
    });

    it("should include area score in LMQ when provided via localDemandScore", () => {
      const result = computeLMQ(
        makeLMQInput({ localDemandScore: 75 })
      );
      expect(result.components.localDemandScore).toBe(75);
      expect(result.components.areaEmploymentScore).toBe(75);
      expect(result.details.weightsUsed).toHaveProperty("localDemand");
    });

    it("should prefer localDemandScore over areaEmployment", () => {
      const result = computeLMQ(
        makeLMQInput({ localDemandScore: 90, areaEmployment: 5500 })
      );
      // localDemandScore takes precedence
      expect(result.components.localDemandScore).toBe(90);
    });

    it("should exclude area from weights when null", () => {
      const result = computeLMQ(makeLMQInput({ areaEmployment: null }));
      expect(result.components.areaEmploymentScore).toBeNull();
      expect(result.components.localDemandScore).toBeNull();
      expect(result.details.weightsUsed).not.toHaveProperty("localDemand");
    });

    it("should include JOLTS trend score when provided", () => {
      const result = computeLMQ(
        makeLMQInput({ joltsTrend: 0.5 })
      );
      expect(result.components.joltsTrendScore).toBe(80); // 60 + 0.5*40
    });

    it("should handle negative JOLTS trend", () => {
      const result = computeLMQ(
        makeLMQInput({ joltsTrend: -0.8 })
      );
      expect(result.components.joltsTrendScore).toBe(28); // 60 + (-0.8)*40 = 28
    });

    it("should redistribute weights when both area and JOLTS available", () => {
      const result = computeLMQ(
        makeLMQInput({ areaEmployment: 3000, joltsTrend: 0.3 })
      );
      // All 5 components present, weights should sum to ~1.0
      const weights = result.details.weightsUsed;
      const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
      expect(totalWeight).toBeCloseTo(1.0, 2);
      expect(Object.keys(weights)).toHaveLength(5);
    });

    it("should redistribute weights when no optional data present", () => {
      const result = computeLMQ(makeLMQInput());
      const weights = result.details.weightsUsed;
      const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
      expect(totalWeight).toBeCloseTo(1.0, 2);
      expect(Object.keys(weights)).toHaveLength(3); // emp, wage, proj only
    });
  });

  describe("all-null LMQ", () => {
    it("should return neutral 50 when all inputs are null", () => {
      const result = computeLMQ({
        employment: null,
        medianWage: null,
        meanWage: null,
        priorEarnings: null,
        projectedOpenings: null,
        projectedGrowthPct: null,
      });
      expect(result.lmq).toBe(50);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// STQ EDGE CASES
// ═══════════════════════════════════════════════════════════════════════

describe("STQ edge cases", () => {
  it("should handle SVP boundary: source=4, target=4 (passes)", () => {
    const gate = checkSvpGate(4, 4);
    expect(gate.passes).toBe(true);
  });

  it("should handle SVP boundary: source=4, target=5 (fails)", () => {
    const gate = checkSvpGate(4, 5);
    expect(gate.passes).toBe(false);
  });

  it("should handle partial token overlap correctly", () => {
    // "Inspect finished products" vs "Inspect raw materials" shares "inspect"
    const result = computeSTQ(
      makeSTQInput({
        sourceTasks: ["Inspect finished products"],
        targetTasks: ["Inspect raw materials"],
        sourceDWAs: [],
        targetDWAs: [],
      })
    );
    expect(result.components.taskDwaOverlap).toBeGreaterThan(0);
  });

  it("should handle very long task lists", () => {
    const tasks = Array.from({ length: 50 }, (_, i) => `Task ${i}`);
    const result = computeSTQ(
      makeSTQInput({
        sourceTasks: tasks,
        targetTasks: tasks.slice(25),
      })
    );
    expect(result.stq).toBeGreaterThan(0);
  });

  it("should handle single matching item across all components", () => {
    const result = computeSTQ(
      makeSTQInput({
        sourceTasks: ["Operate machinery"],
        targetTasks: ["Operate machinery"],
        sourceDWAs: [],
        targetDWAs: [],
        sourceTools: [],
        targetTools: [],
        sourceMaterials: [],
        targetMaterials: [],
        sourceKnowledge: [],
        targetKnowledge: [],
        sourceWorkFields: [],
        targetWorkFields: [],
        sourceMPSMS: [],
        targetMPSMS: [],
      })
    );
    // Only task component has data, everything else is 0
    expect(result.stq).toBeGreaterThan(0);
    expect(result.components.taskDwaOverlap).toBe(100);
    expect(result.components.toolsOverlap).toBe(0);
  });

  it("should handle aggregateSTQ with mixed SVP entries", () => {
    const prwEntries: SkillTransferInput[] = [
      makeSTQInput({ sourceSvp: 2 }), // unskilled — skipped
      makeSTQInput({ sourceSvp: 6 }), // skilled — used
    ];
    const target = {
      targetSvp: 4,
      targetTasks: ["Inspect finished products"],
      targetDWAs: ["Monitor equipment"],
      targetWorkFields: ["machining"],
      targetMPSMS: ["metal parts"],
      targetTools: ["calipers"],
      targetMaterials: ["steel"],
      targetKnowledge: ["mechanical engineering"],
    };

    const result = computeAggregateSTQ(prwEntries, target);
    expect(result.passesGate).toBe(true);
    expect(result.stq).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// VAQ EDGE CASES
// ═══════════════════════════════════════════════════════════════════════

describe("VAQ edge cases", () => {
  it("should correctly average mixed adjustment levels", () => {
    const adj: VocationalAdjustment = {
      tools: 100,
      workProcesses: 0,
      workSetting: 67,
      industry: 33,
    };
    const result = computeVAQ(adj, "standard");
    expect(result.vaq).toBe(50);
    expect(result.passes).toBe(true);
  });

  it("should disqualify advanced_age with any single non-100 dimension", () => {
    const adj: VocationalAdjustment = {
      tools: 100,
      workProcesses: 100,
      workSetting: 100,
      industry: 67, // only one not 100
    };
    const result = computeVAQ(adj, "advanced_age");
    expect(result.passes).toBe(false);
    expect(result.disqualifyingReason).toContain("industry");
  });

  it("should handle estimateVAQ with no DOT or O*NET data", () => {
    const result = estimateVAQ([], null, [], null);
    expect(result.autoEstimated).toBe(true);
    // All default to 67 (slight)
    expect(result.tools).toBe(67);
    expect(result.workProcesses).toBe(67);
    expect(result.workSetting).toBe(67);
    expect(result.industry).toBe(67);
  });

  it("should handle estimateVAQ with identical source/target industry", () => {
    const sourceDot = [{ industryDesig: "construction" }];
    const targetDot = { industryDesig: "construction" };
    const result = estimateVAQ(sourceDot, targetDot, [], null);
    expect(result.workSetting).toBe(100);
    expect(result.industry).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// JOLTS TREND EDGE CASES
// ═══════════════════════════════════════════════════════════════════════

describe("JOLTS trend edge cases", () => {
  it("should return stable for single data point", () => {
    const data = new Map([[2023, { jobOpenings: 100, hires: 50 }]]);
    const result = computeJOLTSTrend(data);
    expect(result.trend).toBe(0);
    expect(result.label).toBe("stable");
    expect(result.yearsUsed).toBe(1);
  });

  it("should detect strong growth", () => {
    const data = new Map([
      [2020, { jobOpenings: 100, hires: 50 }],
      [2021, { jobOpenings: 120, hires: 60 }],
      [2022, { jobOpenings: 150, hires: 75 }],
      [2023, { jobOpenings: 180, hires: 90 }],
      [2024, { jobOpenings: 220, hires: 110 }],
    ]);
    const result = computeJOLTSTrend(data);
    expect(result.trend).toBeGreaterThan(0.5);
    expect(result.slope).toBeGreaterThan(0);
    expect(["growing", "strongly_growing"]).toContain(result.label);
  });

  it("should detect decline", () => {
    const data = new Map([
      [2020, { jobOpenings: 200, hires: 100 }],
      [2021, { jobOpenings: 180, hires: 90 }],
      [2022, { jobOpenings: 150, hires: 75 }],
      [2023, { jobOpenings: 120, hires: 60 }],
      [2024, { jobOpenings: 100, hires: 50 }],
    ]);
    const result = computeJOLTSTrend(data);
    expect(result.trend).toBeLessThan(-0.3);
    expect(result.slope).toBeLessThan(0);
    expect(["declining", "strongly_declining"]).toContain(result.label);
  });

  it("should handle flat/stable data", () => {
    const data = new Map([
      [2020, { jobOpenings: 100, hires: 50 }],
      [2021, { jobOpenings: 100, hires: 50 }],
      [2022, { jobOpenings: 100, hires: 50 }],
      [2023, { jobOpenings: 100, hires: 50 }],
    ]);
    const result = computeJOLTSTrend(data);
    expect(result.trend).toBe(0);
    expect(result.label).toBe("stable");
    expect(result.annualGrowthPct).toBe(0);
  });

  it("should handle null jobOpenings in some years", () => {
    const data = new Map<number, { jobOpenings: number | null; hires: number | null }>([
      [2020, { jobOpenings: 100, hires: 50 }],
      [2021, { jobOpenings: null, hires: null }], // gap
      [2022, { jobOpenings: 120, hires: 60 }],
      [2023, { jobOpenings: 140, hires: 70 }],
    ]);
    const result = computeJOLTSTrend(data);
    expect(result.yearsUsed).toBe(3); // skips null year
    expect(result.trend).toBeGreaterThan(0);
  });

  it("should respect windowYears parameter", () => {
    const data = new Map([
      [2018, { jobOpenings: 500, hires: 250 }], // old, should be excluded with window=3
      [2019, { jobOpenings: 400, hires: 200 }],
      [2020, { jobOpenings: 100, hires: 50 }],
      [2021, { jobOpenings: 120, hires: 60 }],
      [2022, { jobOpenings: 140, hires: 70 }],
    ]);
    const result3 = computeJOLTSTrend(data, 3);
    expect(result3.yearsUsed).toBe(3);
    expect(result3.trend).toBeGreaterThan(0); // 2020-2022 growing

    const result5 = computeJOLTSTrend(data, 5);
    expect(result5.yearsUsed).toBe(5);
    // Including 2018=500 → 2022=140 overall decline
    expect(result5.trend).toBeLessThan(0);
  });

  it("should clamp trend to [-1, +1]", () => {
    // Extreme growth: 10x in 2 years
    const data = new Map([
      [2022, { jobOpenings: 10, hires: 5 }],
      [2023, { jobOpenings: 100, hires: 50 }],
    ]);
    const result = computeJOLTSTrend(data);
    expect(result.trend).toBeLessThanOrEqual(1);
    expect(result.trend).toBeGreaterThanOrEqual(-1);
  });

  it("should handle empty map", () => {
    const data = new Map<number, { jobOpenings: number | null; hires: number | null }>();
    const result = computeJOLTSTrend(data);
    expect(result.trend).toBe(0);
    expect(result.label).toBe("stable");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PVQ COMPOSITE EDGE CASES
// ═══════════════════════════════════════════════════════════════════════

describe("PVQ composite edge cases", () => {
  it("should exclude and report ALL failing traits, not just the first", () => {
    const stqResult = {
      stq: 70,
      passesGate: true,
      components: { taskDwaOverlap: 60, wfMpsmsOverlap: 50, toolsOverlap: 40, materialsOverlap: 30, credentialOverlap: 20 },
      details: { matchedTasks: ["t1"], matchedDWAs: [], matchedTools: [], matchedMaterials: [], matchedKnowledge: [] },
    };
    const tfqResult = {
      tfq: 0,
      passes: false,
      failedTraits: [
        { trait: "strength" as const, label: "Strength", workerCapacity: 1, occupationDemand: 3, margin: -2, passes: false, source: "DOT" as const },
        { trait: "reasoning" as const, label: "Reasoning", workerCapacity: 1, occupationDemand: 4, margin: -3, passes: false, source: "DOT" as const },
      ],
      traitComparisons: [],
      reserveMargin: 0,
    };
    const vaqResult = { vaq: 75, passes: true, adjustment: { tools: 100, workProcesses: 67, workSetting: 67, industry: 67 } as VocationalAdjustment, ageRule: "standard" as const };
    const lmqResult = {
      lmq: 60,
      components: { employmentScore: 80, localDemandScore: null, areaEmploymentScore: null, wageScore: 60, projectionsScore: 40, joltsTrendScore: null },
      details: { employment: 50000, localDemandScore: null, areaEmployment: null, medianWage: 45000, meanWage: 48000, wageRatio: 0.9, projectedOpenings: 5000, projectedGrowthPct: 3, joltsOpenings: null, joltsTrend: null, stateJoltsOpenings: null, pct10: null, pct25: null, pct75: null, pct90: null, weightsUsed: { employment: 0.357, wage: 0.357, projections: 0.286 } },
    };

    const result = computePVQ(stqResult, tfqResult, vaqResult, lmqResult);
    expect(result.excluded).toBe(true);
    expect(result.exclusionReason).toContain("Strength");
    expect(result.exclusionReason).toContain("Reasoning");
  });

  it("should rank correctly with mix of excluded and included", () => {
    const stqPass = {
      stq: 50, passesGate: true,
      components: { taskDwaOverlap: 50, wfMpsmsOverlap: 50, toolsOverlap: 50, materialsOverlap: 50, credentialOverlap: 50 },
      details: { matchedTasks: ["t1"], matchedDWAs: [], matchedTools: [], matchedMaterials: [], matchedKnowledge: [] },
    };
    const tfqPass = { tfq: 50, passes: true, failedTraits: [], traitComparisons: [], reserveMargin: 25 };
    const vaqPass = { vaq: 50, passes: true, adjustment: { tools: 67, workProcesses: 33, workSetting: 67, industry: 33 } as VocationalAdjustment, ageRule: "standard" as const };
    const lmqBase = {
      lmq: 50,
      components: { employmentScore: 50, localDemandScore: null, areaEmploymentScore: null, wageScore: 50, projectionsScore: 50, joltsTrendScore: null },
      details: { employment: 5000, localDemandScore: null, areaEmployment: null, medianWage: 40000, meanWage: 42000, wageRatio: 0.8, projectedOpenings: 2000, projectedGrowthPct: 2, joltsOpenings: null, joltsTrend: null, stateJoltsOpenings: null, pct10: null, pct25: null, pct75: null, pct90: null, weightsUsed: {} },
    };

    const included = computePVQ(stqPass, tfqPass, vaqPass, lmqBase);
    const stqFail = { ...stqPass, stq: 0, passesGate: false, gateReason: "SVP too high" };
    const excluded = computePVQ(stqFail, tfqPass, vaqPass, lmqBase);

    const ranked = rankOccupations([excluded, included, included]);
    expect(ranked[0].excluded).toBe(false);
    expect(ranked[ranked.length - 1].excluded).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// buildOccupationDemands EDGE CASES
// ═══════════════════════════════════════════════════════════════════════

describe("buildOccupationDemands edge cases", () => {
  it("should handle ORS with 0 value (not null)", () => {
    const { demands, sources } = buildOccupationDemands(
      { strength: 0 }, // 0 is valid (sedentary)
      { strength: 2 },
      null
    );
    expect(demands.strength).toBe(0); // ORS takes priority
    expect(sources.strength).toBe("ORS");
  });

  it("should handle undefined values in data", () => {
    const { demands, sources } = buildOccupationDemands(
      { strength: undefined },
      { strength: 2 },
      null
    );
    // undefined should fall through to DOT
    expect(demands.strength).toBe(2);
    expect(sources.strength).toBe("DOT");
  });

  it("should handle all three sources contributing different traits", () => {
    const ors = { strength: 3 };
    const dot = { reasoning: 2 };
    const onet = { spatialPerception: 1 };
    const { demands, sources } = buildOccupationDemands(ors, dot, onet);

    expect(demands.strength).toBe(3);
    expect(sources.strength).toBe("ORS");
    expect(demands.reasoning).toBe(2);
    expect(sources.reasoning).toBe("DOT");
    expect(demands.spatialPerception).toBe(1);
    expect(sources.spatialPerception).toBe("ONET");
    // hazards is filled via the fallback chain (no longer null)
    expect(demands.hazards).not.toBeNull();
    expect(typeof demands.hazards).toBe("number");
  });
});
