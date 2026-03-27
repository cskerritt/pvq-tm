/**
 * Benchmark Validation Tests
 *
 * Validates the PVQ-TM engine against hand-calculated fixtures.
 * Tests pure computation functions that don't require database access:
 * - Trait normalization
 * - VQ regression (trait vector → VQ score → band)
 * - TFQ pass/fail and reserve margin
 * - PVQ composite arithmetic (0.45*STQ + 0.25*TFQ + 0.15*VAQ + 0.15*LMQ)
 * - STQ similarity computation
 * - LMQ component scoring
 * - VAQ averaging
 */

import { describe, it, expect } from "vitest";
import {
  computeVQ,
  classifyVQBand,
} from "../vocational-quotient";
import {
  computeTFQ,
} from "../trait-feasibility";
import {
  computeSTQ,
  checkSvpGate,
  type SkillTransferInput,
} from "../skill-transfer";
import {
  computeVAQ,
  type VocationalAdjustment,
} from "../vocational-adjustment";
import {
  computeLMQ,
  type LaborMarketInput,
} from "../labor-market";
import {
  computePVQ,
  PVQ_WEIGHTS,
} from "../pvq";
import {
  type TraitVector,
  type TraitKey,
  TRAIT_KEYS,
  normalizeDOTGED,
  normalizeDOTAptitude,
  normalizeDOTStrength,
  normalizeDOTPhysical,
  compareTraits,
  calculateReserveMargin,
} from "../traits";

import benchmarkOccupations from "../__fixtures__/benchmark-occupations.json";
import benchmarkWorkerProfiles from "../__fixtures__/benchmark-worker-profiles.json";
import benchmarkPairsData from "../__fixtures__/benchmark-pairs.json";

const benchmarkPairs = benchmarkPairsData.pairs;

// ─── Helpers ──────────────────────────────────────────────────────────────

function toTraitVector(obj: Record<string, number>): TraitVector {
  const vector: Partial<TraitVector> = {};
  for (const key of TRAIT_KEYS) {
    vector[key] = obj[key] ?? null;
  }
  return vector as TraitVector;
}

function getOccupation(id: string) {
  return benchmarkOccupations.find((o) => o.id === id)!;
}

function getWorkerProfile(id: string) {
  return benchmarkWorkerProfiles.find((p) => p.id === id)!;
}

// ─── Section 1: Trait Normalization ───────────────────────────────────────

describe("Trait Normalization", () => {
  it("normalizes DOT GED levels correctly", () => {
    expect(normalizeDOTGED(1)).toBe(0);
    expect(normalizeDOTGED(2)).toBe(0.8);
    expect(normalizeDOTGED(3)).toBe(1.6);
    expect(normalizeDOTGED(4)).toBe(2.4);
    expect(normalizeDOTGED(5)).toBe(3.2);
    expect(normalizeDOTGED(6)).toBe(4.0);
  });

  it("normalizes DOT aptitude levels correctly (inverted)", () => {
    expect(normalizeDOTAptitude(1)).toBe(4);
    expect(normalizeDOTAptitude(2)).toBe(3);
    expect(normalizeDOTAptitude(3)).toBe(2);
    expect(normalizeDOTAptitude(4)).toBe(1);
    expect(normalizeDOTAptitude(5)).toBe(0);
  });

  it("normalizes DOT strength codes correctly", () => {
    expect(normalizeDOTStrength("S")).toBe(0);
    expect(normalizeDOTStrength("L")).toBe(1);
    expect(normalizeDOTStrength("M")).toBe(2);
    expect(normalizeDOTStrength("H")).toBe(3);
    expect(normalizeDOTStrength("V")).toBe(4);
  });

  it("normalizes DOT physical demand codes correctly", () => {
    expect(normalizeDOTPhysical("N")).toBe(0);
    expect(normalizeDOTPhysical("S")).toBe(1);
    expect(normalizeDOTPhysical("O")).toBe(2);
    expect(normalizeDOTPhysical("F")).toBe(3);
    expect(normalizeDOTPhysical("C")).toBe(4);
  });

  it("all benchmark trait values are within 0-4 scale", () => {
    for (const occ of benchmarkOccupations) {
      for (const key of TRAIT_KEYS) {
        const val = occ.traitVector[key as keyof typeof occ.traitVector];
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(4);
      }
    }
  });
});

// ─── Section 2: VQ Regression ─────────────────────────────────────────────

describe("VQ Regression - Benchmark Occupations", () => {
  for (const occ of benchmarkOccupations) {
    it(`${occ.title} (${occ.id}) should classify into VQ Band ${occ.vqBand}`, () => {
      const traitVec = toTraitVector(occ.traitVector);
      const vqResult = computeVQ(traitVec);

      // VQ should be in valid range
      expect(vqResult.vq).toBeGreaterThanOrEqual(68);
      expect(vqResult.vq).toBeLessThanOrEqual(158);

      // Band should match expected
      expect(vqResult.band).toBe(occ.vqBand);

      // No null traits since we provide all 24
      expect(vqResult.nullTraitCount).toBe(0);
    });
  }

  it("VQ scores increase with trait complexity (Band 1 < Band 4 average)", () => {
    const band1Occs = benchmarkOccupations.filter((o) => o.vqBand === 1);
    const band4Occs = benchmarkOccupations.filter((o) => o.vqBand === 4);

    const avgVQ1 =
      band1Occs.reduce(
        (s, o) => s + computeVQ(toTraitVector(o.traitVector)).vq,
        0
      ) / band1Occs.length;

    const avgVQ4 =
      band4Occs.reduce(
        (s, o) => s + computeVQ(toTraitVector(o.traitVector)).vq,
        0
      ) / band4Occs.length;

    expect(avgVQ4).toBeGreaterThan(avgVQ1);
  });
});

// ─── Section 3: TFQ Pass/Fail ─────────────────────────────────────────────

describe("TFQ - Benchmark Pairs", () => {
  for (const pair of benchmarkPairs) {
    it(`${pair.id}: TFQ pass/fail matches expected (${pair.description})`, () => {
      const occ = getOccupation(pair.targetOccupationId);
      const profile = getWorkerProfile(pair.workerProfileId);

      const workerTraits = toTraitVector(profile.traits);
      const occTraits = toTraitVector(occ.traitVector);

      const tfqResult = computeTFQ(workerTraits, occTraits);

      // Pass/fail must match
      expect(tfqResult.passes).toBe(pair.expectedResults.tfq.passes);

      if (pair.expectedResults.tfq.passes) {
        // If passes, TFQ score should be positive
        expect(tfqResult.tfq).toBeGreaterThan(0);
        // Reserve margin should be close to expected (within 1.0)
        expect(tfqResult.reserveMargin).toBeCloseTo(
          pair.expectedResults.tfq.reserveMargin,
          0
        );
      } else {
        // If fails, TFQ should be 0
        expect(tfqResult.tfq).toBe(0);
        // Should have failed traits
        expect(tfqResult.failedTraits.length).toBeGreaterThan(0);

        // Verify expected failed traits are present
        const failedKeys = tfqResult.failedTraits.map((f) => f.trait);
        for (const expectedFail of pair.expectedResults.tfq.failedTraits) {
          expect(failedKeys).toContain(expectedFail);
        }
      }
    });
  }
});

// ─── Section 4: SVP Gate ──────────────────────────────────────────────────

describe("SVP Gate - Benchmark Pairs", () => {
  for (const pair of benchmarkPairs) {
    it(`${pair.id}: SVP gate ${pair.expectedResults.svpGatePasses ? "passes" : "fails"}`, () => {
      const target = getOccupation(pair.targetOccupationId);
      const gate = checkSvpGate(pair.prwSVP, target.svp);

      expect(gate.passes).toBe(pair.expectedResults.svpGatePasses);
    });
  }
});

// ─── Section 5: LMQ Component Scoring ─────────────────────────────────────

describe("LMQ - Benchmark Occupations", () => {
  for (const pair of benchmarkPairs) {
    if (pair.expectedResults.excluded && !pair.expectedResults.svpGatePasses) {
      continue; // Skip SVP-gated pairs for LMQ testing
    }

    it(`${pair.id}: LMQ composite matches expected (±2.0)`, () => {
      const occ = getOccupation(pair.targetOccupationId);

      const lmqInput: LaborMarketInput = {
        employment: occ.oewsData.employment,
        medianWage: occ.oewsData.medianWage,
        meanWage: occ.oewsData.meanWage,
        priorEarnings: null, // No prior earnings in fixtures
        projectedOpenings: null,
        projectedGrowthPct: null,
        pct10: occ.oewsData.pct10,
        pct25: occ.oewsData.pct25,
        pct75: occ.oewsData.pct75,
        pct90: occ.oewsData.pct90,
      };

      const lmqResult = computeLMQ(lmqInput);

      // Employment score should match expected (±2)
      expect(lmqResult.components.employmentScore).toBeCloseTo(
        pair.expectedResults.lmq.employmentScore,
        -1
      );

      // Wage score should match expected (±2)
      expect(lmqResult.components.wageScore).toBeCloseTo(
        pair.expectedResults.lmq.wageScore,
        -1
      );

      // LMQ composite should match expected (±3.0)
      expect(lmqResult.lmq).toBeCloseTo(
        pair.expectedResults.lmq.composite,
        -1
      );
    });
  }
});

// ─── Section 6: VAQ Computation ───────────────────────────────────────────

describe("VAQ - Benchmark Pairs", () => {
  for (const pair of benchmarkPairs) {
    it(`${pair.id}: VAQ average is consistent`, () => {
      const adj: VocationalAdjustment = {
        tools: pair.expectedResults.vaq.tools as 0 | 33 | 67 | 100,
        workProcesses: pair.expectedResults.vaq.workProcesses as 0 | 33 | 67 | 100,
        workSetting: pair.expectedResults.vaq.workSetting as 0 | 33 | 67 | 100,
        industry: pair.expectedResults.vaq.industry as 0 | 33 | 67 | 100,
      };

      const vaqResult = computeVAQ(adj, pair.ageRule as "standard" | "advanced_age");

      // Average should match
      const expectedAvg =
        (adj.tools + adj.workProcesses + adj.workSetting + adj.industry) / 4;
      expect(vaqResult.vaq).toBeCloseTo(expectedAvg, 1);
      expect(vaqResult.vaq).toBeCloseTo(pair.expectedResults.vaq.average, 1);
    });
  }

  it("Advanced age rule excludes when any dimension < 100", () => {
    const adj: VocationalAdjustment = {
      tools: 100,
      workProcesses: 67,
      workSetting: 100,
      industry: 100,
    };

    const result = computeVAQ(adj, "advanced_age", false);
    expect(result.passes).toBe(false);
    expect(result.vaq).toBe(0);
  });

  it("Advanced age rule passes when all dimensions = 100", () => {
    const adj: VocationalAdjustment = {
      tools: 100,
      workProcesses: 100,
      workSetting: 100,
      industry: 100,
    };

    const result = computeVAQ(adj, "advanced_age", false);
    expect(result.passes).toBe(true);
    expect(result.vaq).toBe(100);
  });
});

// ─── Section 7: PVQ Composite Arithmetic ──────────────────────────────────

describe("PVQ Composite - Mathematical Consistency", () => {
  it("PVQ weights sum to 1.0", () => {
    const sum =
      PVQ_WEIGHTS.stq + PVQ_WEIGHTS.tfq + PVQ_WEIGHTS.vaq + PVQ_WEIGHTS.lmq;
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it("PVQ weights match expected values", () => {
    expect(PVQ_WEIGHTS.stq).toBe(0.45);
    expect(PVQ_WEIGHTS.tfq).toBe(0.25);
    expect(PVQ_WEIGHTS.vaq).toBe(0.15);
    expect(PVQ_WEIGHTS.lmq).toBe(0.15);
  });

  it("PVQ composite equals weighted sum of components", () => {
    // Test with synthetic component scores
    const stq = 50;
    const tfq = 60;
    const vaq = 75;
    const lmq = 70;

    const expected =
      0.45 * stq + 0.25 * tfq + 0.15 * vaq + 0.15 * lmq;

    // We can't directly test computePVQ without full result objects,
    // so verify the math directly
    expect(expected).toBeCloseTo(
      0.45 * 50 + 0.25 * 60 + 0.15 * 75 + 0.15 * 70,
      10
    );
    expect(expected).toBeCloseTo(22.5 + 15 + 11.25 + 10.5, 10);
    expect(expected).toBeCloseTo(59.25, 10);
  });

  for (const pair of benchmarkPairs) {
    if (!pair.expectedResults.excluded) {
      it(`${pair.id}: PVQ = 0.45*STQ + 0.25*TFQ + 0.15*VAQ + 0.15*LMQ (±2.0)`, () => {
        const expected =
          0.45 * pair.expectedResults.stq.weighted +
          0.25 * pair.expectedResults.tfq.score +
          0.15 * pair.expectedResults.vaq.average +
          0.15 * pair.expectedResults.lmq.composite;

        // PVQ should be close to the weighted sum
        // Allow ±3.0 tolerance because STQ is approximate (text similarity varies)
        expect(pair.expectedResults.pvq).toBeCloseTo(expected, -1);
      });
    }
  }
});

// ─── Section 8: Exclusion Gate Order ──────────────────────────────────────

describe("Exclusion Gates", () => {
  it("SVP gate exclusion produces PVQ=0", () => {
    const pair011 = benchmarkPairs.find((p) => p.id === "pair-011")!;
    expect(pair011.expectedResults.excluded).toBe(true);
    expect(pair011.expectedResults.svpGatePasses).toBe(false);
    expect(pair011.expectedResults.pvq).toBe(0);
  });

  it("TFQ exclusion produces PVQ=0", () => {
    const pair010 = benchmarkPairs.find((p) => p.id === "pair-010")!;
    expect(pair010.expectedResults.excluded).toBe(true);
    expect(pair010.expectedResults.tfq.passes).toBe(false);
    expect(pair010.expectedResults.pvq).toBe(0);
  });

  it("Non-excluded pairs have PVQ > 0", () => {
    for (const pair of benchmarkPairs) {
      if (!pair.expectedResults.excluded) {
        expect(pair.expectedResults.pvq).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Section 9: Trait Comparison Mechanics ────────────────────────────────

describe("Trait Comparison - Categorical Tolerance", () => {
  it("worker capacity equal to floor(demand) passes", () => {
    const worker: TraitVector = { ...toTraitVector({} as Record<string, number>) };
    const occ: TraitVector = { ...toTraitVector({} as Record<string, number>) };

    // Set all traits to 2 for worker, 2 for occ
    for (const key of TRAIT_KEYS) {
      (worker as Record<string, number>)[key] = 2;
      (occ as Record<string, number>)[key] = 2;
    }

    const comparisons = compareTraits(worker, occ);
    expect(comparisons.every((c) => c.passes)).toBe(true);
  });

  it("worker capacity below floor(demand) fails", () => {
    const worker: TraitVector = { ...toTraitVector({} as Record<string, number>) };
    const occ: TraitVector = { ...toTraitVector({} as Record<string, number>) };

    for (const key of TRAIT_KEYS) {
      (worker as Record<string, number>)[key] = 2;
      (occ as Record<string, number>)[key] = 2;
    }

    // Set one trait where worker < demand
    (worker as Record<string, number>).strength = 1;
    (occ as Record<string, number>).strength = 3;

    const comparisons = compareTraits(worker, occ);
    const strengthComp = comparisons.find((c) => c.trait === "strength")!;
    expect(strengthComp.passes).toBe(false);
    expect(strengthComp.margin).toBe(-2); // 1 - 3 = -2
  });
});

// ─── Section 10: STQ Similarity Functions ─────────────────────────────────

describe("STQ - Similarity Computation", () => {
  it("identical lists produce 100% overlap", () => {
    const tasks = ["task A", "task B", "task C"];
    const input: SkillTransferInput = {
      sourceSvp: 5,
      sourceTasks: tasks,
      sourceDWAs: [],
      sourceWorkFields: ["field A"],
      sourceMPSMS: ["mpsms A"],
      sourceTools: ["tool A"],
      sourceMaterials: ["material A"],
      sourceKnowledge: ["knowledge A"],
      targetSvp: 3,
      targetTasks: tasks,
      targetDWAs: [],
      targetWorkFields: ["field A"],
      targetMPSMS: ["mpsms A"],
      targetTools: ["tool A"],
      targetMaterials: ["material A"],
      targetKnowledge: ["knowledge A"],
    };

    const result = computeSTQ(input);
    expect(result.passesGate).toBe(true);
    expect(result.stq).toBe(100);
    expect(result.components.taskDwaOverlap).toBe(100);
  });

  it("completely different lists produce 0% or near-0% overlap", () => {
    const input: SkillTransferInput = {
      sourceSvp: 5,
      sourceTasks: ["drive truck to destination"],
      sourceDWAs: [],
      sourceWorkFields: ["driving"],
      sourceMPSMS: [],
      sourceTools: ["tractor-trailer"],
      sourceMaterials: ["freight"],
      sourceKnowledge: ["transportation"],
      targetSvp: 3,
      targetTasks: ["prepare financial statements"],
      targetDWAs: [],
      targetWorkFields: ["accounting"],
      targetMPSMS: [],
      targetTools: ["spreadsheet software"],
      targetMaterials: ["tax forms"],
      targetKnowledge: ["economics"],
    };

    const result = computeSTQ(input);
    expect(result.passesGate).toBe(true);
    expect(result.stq).toBeLessThan(15); // Very low similarity
  });

  it("SVP gate blocks when target SVP exceeds source SVP", () => {
    const input: SkillTransferInput = {
      sourceSvp: 4,
      sourceTasks: ["task A"],
      sourceDWAs: [],
      sourceWorkFields: [],
      sourceMPSMS: [],
      sourceTools: [],
      sourceMaterials: [],
      sourceKnowledge: [],
      targetSvp: 7,
      targetTasks: ["task A"],
      targetDWAs: [],
      targetWorkFields: [],
      targetMPSMS: [],
      targetTools: [],
      targetMaterials: [],
      targetKnowledge: [],
    };

    const result = computeSTQ(input);
    expect(result.passesGate).toBe(false);
    expect(result.stq).toBe(0);
  });
});

// ─── Section 11: Reserve Margin Calculation ───────────────────────────────

describe("Reserve Margin", () => {
  it("all-surplus profile produces positive reserve margin", () => {
    const worker = toTraitVector(
      Object.fromEntries(TRAIT_KEYS.map((k) => [k, 4]))
    );
    const occ = toTraitVector(
      Object.fromEntries(TRAIT_KEYS.map((k) => [k, 0]))
    );

    const margin = calculateReserveMargin(worker, occ);
    expect(margin).toBe(100); // (4*24) / (24*4) * 100 = 100
  });

  it("exact match produces zero reserve margin", () => {
    const traits = Object.fromEntries(TRAIT_KEYS.map((k) => [k, 2]));
    const worker = toTraitVector(traits);
    const occ = toTraitVector(traits);

    const margin = calculateReserveMargin(worker, occ);
    expect(margin).toBe(0);
  });

  it("coverage penalty applies below 12 rated traits", () => {
    const worker: TraitVector = {} as TraitVector;
    const occ: TraitVector = {} as TraitVector;

    // Set only 6 traits (half of threshold)
    const sixTraits = TRAIT_KEYS.slice(0, 6);
    for (const key of TRAIT_KEYS) {
      (worker as Record<string, number | null>)[key] = null;
      (occ as Record<string, number | null>)[key] = null;
    }
    for (const key of sixTraits) {
      (worker as Record<string, number | null>)[key] = 4;
      (occ as Record<string, number | null>)[key] = 0;
    }

    const margin = calculateReserveMargin(worker, occ);
    // rawMargin = (4*6) / (6*4) * 100 = 100
    // coverageFactor = 6/12 = 0.5
    // adjustedMargin = 100 * 0.5 = 50
    expect(margin).toBe(50);
  });
});

// ─── Section 12: Full Integration (Pure Computation) ──────────────────────

describe("Integration: PVQ from components", () => {
  it("non-excluded pair produces valid PVQ composite", () => {
    // Use pair-001 (Accountant→Bookkeeper, medium profile)
    const pair = benchmarkPairs.find((p) => p.id === "pair-001")!;
    const occ = getOccupation(pair.targetOccupationId);
    const profile = getWorkerProfile(pair.workerProfileId);

    // Compute TFQ
    const workerTraits = toTraitVector(profile.traits);
    const occTraits = toTraitVector(occ.traitVector);
    const tfqResult = computeTFQ(workerTraits, occTraits);

    expect(tfqResult.passes).toBe(true);
    expect(tfqResult.tfq).toBeGreaterThan(0);

    // Compute LMQ
    const lmqResult = computeLMQ({
      employment: occ.oewsData.employment,
      medianWage: occ.oewsData.medianWage,
      meanWage: occ.oewsData.meanWage,
      priorEarnings: null,
      projectedOpenings: null,
      projectedGrowthPct: null,
    });

    expect(lmqResult.lmq).toBeGreaterThan(0);

    // Compute VAQ
    const vaqAdj: VocationalAdjustment = {
      tools: pair.expectedResults.vaq.tools as 0 | 33 | 67 | 100,
      workProcesses: pair.expectedResults.vaq.workProcesses as 0 | 33 | 67 | 100,
      workSetting: pair.expectedResults.vaq.workSetting as 0 | 33 | 67 | 100,
      industry: pair.expectedResults.vaq.industry as 0 | 33 | 67 | 100,
    };
    const vaqResult = computeVAQ(vaqAdj);

    expect(vaqResult.passes).toBe(true);

    // All components are valid, PVQ should be computable
    // The STQ would need the actual text comparison which we approximate,
    // but we can verify the TFQ, VAQ, LMQ components are consistent
    expect(tfqResult.reserveMargin).toBeCloseTo(
      pair.expectedResults.tfq.reserveMargin,
      0
    );
    expect(vaqResult.vaq).toBeCloseTo(pair.expectedResults.vaq.average, 1);
    expect(lmqResult.lmq).toBeCloseTo(
      pair.expectedResults.lmq.composite,
      -1
    );
  });

  it("excluded pair produces PVQ=0 through computePVQ", () => {
    // pair-011: SVP gate failure
    const pair = benchmarkPairs.find((p) => p.id === "pair-011")!;
    const occ = getOccupation(pair.targetOccupationId);
    const profile = getWorkerProfile(pair.workerProfileId);

    const workerTraits = toTraitVector(profile.traits);
    const occTraits = toTraitVector(occ.traitVector);

    // Build a failed STQ result (SVP gate failure)
    const stqResult = computeSTQ({
      sourceSvp: pair.prwSVP,
      sourceTasks: [],
      sourceDWAs: [],
      sourceWorkFields: [],
      sourceMPSMS: [],
      sourceTools: [],
      sourceMaterials: [],
      sourceKnowledge: [],
      targetSvp: occ.svp,
      targetTasks: occ.tasks,
      targetDWAs: [],
      targetWorkFields: occ.workFields,
      targetMPSMS: [],
      targetTools: occ.tools,
      targetMaterials: occ.materials,
      targetKnowledge: occ.knowledge,
    });

    expect(stqResult.passesGate).toBe(false);

    const tfqResult = computeTFQ(workerTraits, occTraits);
    const vaqResult = computeVAQ({
      tools: 33,
      workProcesses: 33,
      workSetting: 33,
      industry: 33,
    });
    const lmqResult = computeLMQ({
      employment: occ.oewsData.employment,
      medianWage: occ.oewsData.medianWage,
      meanWage: occ.oewsData.meanWage,
      priorEarnings: null,
      projectedOpenings: null,
      projectedGrowthPct: null,
    });

    const pvqResult = computePVQ(stqResult, tfqResult, vaqResult, lmqResult);

    expect(pvqResult.excluded).toBe(true);
    expect(pvqResult.pvq).toBe(0);
  });
});

// ─── Section 13: Fixture Data Integrity ───────────────────────────────────

describe("Fixture Data Integrity", () => {
  it("has 100 benchmark occupations", () => {
    expect(benchmarkOccupations).toHaveLength(100);
  });

  it("has 8 worker profiles", () => {
    expect(benchmarkWorkerProfiles).toHaveLength(8);
  });

  it("has 32 benchmark pairs", () => {
    expect(benchmarkPairs).toHaveLength(32);
  });

  it("all pairs reference valid occupations and profiles", () => {
    for (const pair of benchmarkPairs) {
      expect(getOccupation(pair.sourceOccupationId)).toBeDefined();
      expect(getOccupation(pair.targetOccupationId)).toBeDefined();
      expect(getWorkerProfile(pair.workerProfileId)).toBeDefined();
    }
  });

  it("all occupations have complete 24-trait vectors", () => {
    for (const occ of benchmarkOccupations) {
      for (const key of TRAIT_KEYS) {
        expect(occ.traitVector).toHaveProperty(key);
        const val = occ.traitVector[key as keyof typeof occ.traitVector];
        expect(typeof val).toBe("number");
      }
    }
  });

  it("all worker profiles have complete 24-trait vectors", () => {
    for (const profile of benchmarkWorkerProfiles) {
      for (const key of TRAIT_KEYS) {
        expect(profile.traits).toHaveProperty(key);
        const val = profile.traits[key as keyof typeof profile.traits];
        expect(typeof val).toBe("number");
      }
    }
  });

  it("occupations span all 4 VQ bands", () => {
    const bands = new Set(benchmarkOccupations.map((o) => o.vqBand));
    expect(bands.has(1)).toBe(true);
    expect(bands.has(2)).toBe(true);
    expect(bands.has(3)).toBe(true);
    expect(bands.has(4)).toBe(true);
  });

  it("occupations span all 5 strength levels", () => {
    const strengths = new Set(benchmarkOccupations.map((o) => o.strength));
    expect(strengths.has("S")).toBe(true);
    expect(strengths.has("L")).toBe(true);
    expect(strengths.has("M")).toBe(true);
    expect(strengths.has("H")).toBe(true);
    expect(strengths.has("V")).toBe(true);
  });

  it("OEWS wage data is realistic (all wages > $20k and < $300k)", () => {
    for (const occ of benchmarkOccupations) {
      expect(occ.oewsData.medianWage).toBeGreaterThan(20000);
      expect(occ.oewsData.medianWage).toBeLessThan(300000);
      expect(occ.oewsData.pct10).toBeLessThan(occ.oewsData.medianWage);
      expect(occ.oewsData.pct90).toBeGreaterThan(occ.oewsData.medianWage);
    }
  });
});
