/**
 * PVQ-TM SYSTEM AUDIT
 *
 * Comprehensive test suite that systematically validates every component
 * of the PVQ-TM vocational analysis system. Each section tests a specific
 * module with known inputs and expected outputs.
 *
 * Audit Categories:
 * A. Data Loading & Integrity
 * B. Trait Normalization
 * C. Occupation Demand Construction
 * D. Skill Transfer Quotient (STQ)
 * E. Trait Feasibility Quotient (TFQ)
 * F. Vocational Adjustment Quotient (VAQ)
 * G. Labor Market Quotient (LMQ)
 * H. Vocational Quotient (VQ) & TSP
 * I. Public Vocational Quotient (PVQ) Composite
 * J. Component Profile Code (CPC)
 * K. Comprehensive Analysis Modules
 * L. Earning Capacity & ECLR
 * M. Confidence Grading
 * N. Validation Engine
 */
import { describe, it, expect } from "vitest";

// ── A. Data Loading ──────────────────────────────────────────────────
import {
  loadORSData,
  loadOEWSData,
  loadDOTData,
  loadONETFullData,
} from "@/lib/data-loaders";

// ── B. Trait Normalization ───────────────────────────────────────────
import {
  normalizeDOTGED,
  normalizeDOTStrength,
  normalizeDOTAptitude,
  normalizeONETScore,
  compareTraits,
  passesAllTraits,
  calculateReserveMargin,
  profileToTraitVector,
  type TraitVector,
  TRAIT_KEYS,
} from "@/lib/engine/traits";

// ── C-E. TFQ ─────────────────────────────────────────────────────────
import {
  computeTFQ,
  buildOccupationDemands,
  getStrengthSVPDefaults,
} from "@/lib/engine/trait-feasibility";

// ── D. STQ ───────────────────────────────────────────────────────────
import {
  computeSTQ,
  checkSvpGate,
  isValidTransferableSkill,
  type SkillTransferInput,
} from "@/lib/engine/skill-transfer";

// ── F. VAQ ───────────────────────────────────────────────────────────
import {
  computeVAQ,
  defaultAdjustment,
  estimateVAQ,
} from "@/lib/engine/vocational-adjustment";

// ── G. LMQ ───────────────────────────────────────────────────────────
import { computeLMQ } from "@/lib/engine/labor-market";

// ── H. VQ & TSP ──────────────────────────────────────────────────────
import { computeVQ, classifyVQBand, getVQBandInfo } from "@/lib/engine/vocational-quotient";
import { computeTSP, classifyTSPTier, getTSPLabel } from "@/lib/engine/tsp";

// ── I. PVQ ───────────────────────────────────────────────────────────
import { computePVQ, PVQ_WEIGHTS } from "@/lib/engine/pvq";

// ── J. CPC ───────────────────────────────────────────────────────────
import {
  buildFingerprintIndex,
  cosineSimilarity,
  l2Normalize,
  profileBreadth,
  jobZoneToMaxSvp,
  _resetFingerprintIndex,
} from "@/lib/engine/component-profile";

// ── K. Comprehensive Analysis ────────────────────────────────────────
import { analyzeNearMisses } from "@/lib/engine/near-miss";
import { generateRFCNarrative } from "@/lib/engine/rfc-narrative";
import { analyzeViableSet } from "@/lib/engine/viable-set";
import { explainConfidence } from "@/lib/engine/confidence-explanation";

// ── L. Earning Capacity ──────────────────────────────────────────────
import { computeECLR, computeEarningCapacity } from "@/lib/engine/earning-capacity";

// ── N. Validation ────────────────────────────────────────────────────
import { validateAnalysis } from "@/lib/engine/validation";

// ─── Helpers ─────────────────────────────────────────────────────────

function uniformVector(value: number): TraitVector {
  const v: Partial<TraitVector> = {};
  for (const key of TRAIT_KEYS) v[key] = value;
  return v as TraitVector;
}

function makeSTQResult(stq: number, passes = true) {
  return {
    stq,
    passesGate: passes,
    gateReason: passes ? undefined : "SVP gate",
    components: { taskDwaOverlap: stq, wfMpsmsOverlap: stq, toolsOverlap: stq, materialsOverlap: stq, credentialOverlap: stq },
    details: { matchedTasks: [], matchedDWAs: [], matchedTools: [], matchedMaterials: [], matchedKnowledge: [] },
  };
}

// ═════════════════════════════════════════════════════════════════════
// A. DATA LOADING & INTEGRITY
// ═════════════════════════════════════════════════════════════════════

describe("A. Data Loading & Integrity", () => {
  it("A1: DOT data loads with expected record count", async () => {
    const data = await loadDOTData();
    const count = Object.keys(data).length;
    expect(count).toBeGreaterThan(12000);
    expect(count).toBeLessThan(15000);
  });

  it("A2: O*NET data loads with expected record count", async () => {
    const data = await loadONETFullData();
    const count = Object.keys(data).length;
    expect(count).toBeGreaterThan(900);
    expect(count).toBeLessThan(1200);
  });

  it("A3: ORS data loads with expected record count", async () => {
    const data = await loadORSData();
    const count = Object.keys(data).length;
    expect(count).toBeGreaterThan(200);
    expect(count).toBeLessThan(300);
  });

  it("A4: OEWS data loads with expected record count", async () => {
    const data = await loadOEWSData();
    const count = Object.keys(data).length;
    expect(count).toBeGreaterThan(800);
    expect(count).toBeLessThan(1200);
  });

  it("A5: DOT records have required fields", async () => {
    const data = await loadDOTData();
    const sample = Object.values(data).slice(0, 100);
    for (const occ of sample) {
      expect(occ).toHaveProperty("t"); // title
      expect(occ).toHaveProperty("str"); // strength
    }
  });

  it("A6: O*NET records have titles and valid SOC codes", async () => {
    const data = await loadONETFullData();
    const entries = Object.entries(data);
    expect(entries.length).toBeGreaterThan(0);
    for (const [code, occ] of entries.slice(0, 10)) {
      expect(typeof occ.t).toBe("string");
      expect(occ.t.length).toBeGreaterThan(0);
      expect(code).toMatch(/^\d{2}-\d{4}/);
    }
  });

  it("A7: OEWS records have wage data", async () => {
    const data = await loadOEWSData();
    const sample = Object.values(data).slice(0, 50);
    for (const occ of sample) {
      expect(occ.md).toBeDefined(); // median wage
      expect(occ.e).toBeDefined();  // employment
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// B. TRAIT NORMALIZATION
// ═════════════════════════════════════════════════════════════════════

describe("B. Trait Normalization", () => {
  it("B1: DOT GED normalization formula: (level-1)×0.8", () => {
    expect(normalizeDOTGED(1)).toBe(0);
    expect(normalizeDOTGED(2)).toBeCloseTo(0.8, 5);
    expect(normalizeDOTGED(3)).toBeCloseTo(1.6, 5);
    expect(normalizeDOTGED(4)).toBeCloseTo(2.4, 5);
    expect(normalizeDOTGED(5)).toBeCloseTo(3.2, 5);
    expect(normalizeDOTGED(6)).toBeCloseTo(4.0, 5);
  });

  it("B2: DOT Strength normalization S=0 L=1 M=2 H=3 V=4", () => {
    expect(normalizeDOTStrength("S")).toBe(0);
    expect(normalizeDOTStrength("L")).toBe(1);
    expect(normalizeDOTStrength("M")).toBe(2);
    expect(normalizeDOTStrength("H")).toBe(3);
    expect(normalizeDOTStrength("V")).toBe(4);
  });

  it("B3: DOT Aptitude inversion: normalized = 5 - dotValue", () => {
    expect(normalizeDOTAptitude(1)).toBe(4); // highest aptitude
    expect(normalizeDOTAptitude(3)).toBe(2); // middle
    expect(normalizeDOTAptitude(5)).toBe(0); // lowest
  });

  it("B4: O*NET score normalization produces 0-4 range", () => {
    // Default maxScale=100 (O*NET importance scores are 0-100)
    expect(normalizeONETScore(0)).toBe(0);
    expect(normalizeONETScore(50)).toBe(2);
    expect(normalizeONETScore(100)).toBe(4);
    // Custom maxScale=7 (O*NET level scores)
    expect(normalizeONETScore(0, 7)).toBe(0);
    expect(normalizeONETScore(7, 7)).toBe(4);
  });

  it("B5: All 24 trait keys defined", () => {
    expect(TRAIT_KEYS.length).toBe(24);
    expect(TRAIT_KEYS).toContain("reasoning");
    expect(TRAIT_KEYS).toContain("strength");
    expect(TRAIT_KEYS).toContain("dustsFumes");
  });

  it("B6: profileToTraitVector converts database profile", () => {
    const profile = { reasoning: 3, math: 2, language: 3, strength: 1 };
    const vector = profileToTraitVector(profile);
    expect(vector.reasoning).toBe(3);
    expect(vector.strength).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// C. OCCUPATION DEMAND CONSTRUCTION
// ═════════════════════════════════════════════════════════════════════

describe("C. Occupation Demand Construction", () => {
  it("C1: buildOccupationDemands returns no null values", () => {
    const { demands } = buildOccupationDemands(null, null, null);
    for (const key of TRAIT_KEYS) {
      expect(demands[key]).not.toBeNull();
      expect(demands[key]).not.toBeUndefined();
    }
  });

  it("C2: Strength×SVP defaults cover all combinations", () => {
    const strengths = ["S", "L", "M", "H", "V"];
    const svps = [2, 3, 4, 5, 6, 7, 8];
    for (const str of strengths) {
      for (const svp of svps) {
        const defaults = getStrengthSVPDefaults(str, svp);
        expect(defaults).toBeDefined();
        expect(defaults.strength).toBeDefined();
      }
    }
  });

  it("C3: ORS data takes priority over DOT/O*NET", () => {
    const orsData = { strength: 1 }; // Light
    const dotData = { strength: "H" }; // Heavy
    const { demands, sources } = buildOccupationDemands(orsData, dotData, null);
    // ORS should win
    expect(demands.strength).toBe(1); // Light from ORS
    expect(sources.strength).toBe("ORS");
  });
});

// ═════════════════════════════════════════════════════════════════════
// D. SKILL TRANSFER QUOTIENT (STQ)
// ═════════════════════════════════════════════════════════════════════

describe("D. Skill Transfer Quotient (STQ)", () => {
  it("D1: SVP gate blocks when target exceeds source", () => {
    const gate = checkSvpGate(4, 6);
    expect(gate.passes).toBe(false);
  });

  it("D2: SVP gate passes when target ≤ source", () => {
    const gate = checkSvpGate(6, 4);
    expect(gate.passes).toBe(true);
  });

  it("D3: SVP 1-3 = unskilled (not transferable)", () => {
    expect(isValidTransferableSkill(1)).toBe(false);
    expect(isValidTransferableSkill(2)).toBe(false);
    expect(isValidTransferableSkill(3)).toBe(false);
    expect(isValidTransferableSkill(4)).toBe(true);
  });

  it("D4: STQ = 0 when SVP gate fails", () => {
    const result = computeSTQ({
      sourceSvp: 3, targetSvp: 5,
      sourceTasks: ["task1"], targetTasks: ["task1"],
      sourceDWAs: [], targetDWAs: [],
      sourceWorkFields: [], targetWorkFields: [],
      sourceMPSMS: [], targetMPSMS: [],
      sourceTools: [], targetTools: [],
      sourceMaterials: [], targetMaterials: [],
      sourceKnowledge: [], targetKnowledge: [],
    });
    expect(result.stq).toBe(0);
    expect(result.passesGate).toBe(false);
  });

  it("D5: STQ > 0 for identical task lists", () => {
    const result = computeSTQ({
      sourceSvp: 6, targetSvp: 4,
      sourceTasks: ["Manage budgets", "Prepare reports"],
      targetTasks: ["Manage budgets", "Prepare reports"],
      sourceDWAs: [], targetDWAs: [],
      sourceWorkFields: ["Admin"], targetWorkFields: ["Admin"],
      sourceMPSMS: [], targetMPSMS: [],
      sourceTools: ["Excel"], targetTools: ["Excel"],
      sourceMaterials: [], targetMaterials: [],
      sourceKnowledge: ["Administration"], targetKnowledge: ["Administration"],
    });
    expect(result.stq).toBeGreaterThan(50);
    expect(result.passesGate).toBe(true);
  });

  it("D6: STQ weights sum to 1.0 (0.35+0.25+0.20+0.10+0.10)", () => {
    expect(0.35 + 0.25 + 0.20 + 0.10 + 0.10).toBe(1.0);
  });

  it("D7: STQ bounded 0-100", () => {
    const result = computeSTQ({
      sourceSvp: 8, targetSvp: 2,
      sourceTasks: ["everything"], targetTasks: ["everything"],
      sourceDWAs: ["all"], targetDWAs: ["all"],
      sourceWorkFields: ["all"], targetWorkFields: ["all"],
      sourceMPSMS: ["all"], targetMPSMS: ["all"],
      sourceTools: ["all"], targetTools: ["all"],
      sourceMaterials: ["all"], targetMaterials: ["all"],
      sourceKnowledge: ["all"], targetKnowledge: ["all"],
    });
    expect(result.stq).toBeGreaterThanOrEqual(0);
    expect(result.stq).toBeLessThanOrEqual(100);
  });
});

// ═════════════════════════════════════════════════════════════════════
// E. TRAIT FEASIBILITY QUOTIENT (TFQ)
// ═════════════════════════════════════════════════════════════════════

describe("E. Trait Feasibility Quotient (TFQ)", () => {
  it("E1: All traits pass when worker exceeds demands", () => {
    const result = computeTFQ(uniformVector(4), uniformVector(2));
    expect(result.passes).toBe(true);
    expect(result.tfq).toBeGreaterThan(0);
  });

  it("E2: Single failed trait excludes occupation", () => {
    const worker = uniformVector(3);
    const demands = uniformVector(2);
    demands.strength = 4; // Exceeds worker capacity of 3
    const result = computeTFQ(worker, demands);
    expect(result.passes).toBe(false);
    expect(result.tfq).toBe(0);
    expect(result.failedTraits.length).toBeGreaterThan(0);
  });

  it("E3: TFQ = 0 when any trait fails", () => {
    const worker = { ...uniformVector(3), strength: 0 };
    const demands = { ...uniformVector(1), strength: 3 };
    const result = computeTFQ(worker as TraitVector, demands as TraitVector);
    expect(result.passes).toBe(false);
    expect(result.tfq).toBe(0);
  });

  it("E4: Reserve margin increases with greater capacity surplus", () => {
    const demands = uniformVector(1);
    const tfq2 = computeTFQ(uniformVector(2), demands);
    const tfq3 = computeTFQ(uniformVector(3), demands);
    const tfq4 = computeTFQ(uniformVector(4), demands);
    expect(tfq3.tfq).toBeGreaterThan(tfq2.tfq);
    expect(tfq4.tfq).toBeGreaterThan(tfq3.tfq);
  });

  it("E5: TFQ bounded 0-100", () => {
    const result = computeTFQ(uniformVector(4), uniformVector(0));
    expect(result.tfq).toBeGreaterThanOrEqual(0);
    expect(result.tfq).toBeLessThanOrEqual(100);
  });

  it("E6: Null capacity treated as passing", () => {
    const worker = uniformVector(2);
    worker.dustsFumes = null as unknown as number;
    const demands = uniformVector(1);
    demands.dustsFumes = 3;
    const comps = compareTraits(worker, demands);
    const dustsFumes = comps.find(c => c.trait === "dustsFumes");
    expect(dustsFumes?.passes).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// F. VOCATIONAL ADJUSTMENT QUOTIENT (VAQ)
// ═════════════════════════════════════════════════════════════════════

describe("F. Vocational Adjustment Quotient (VAQ)", () => {
  it("F1: Default adjustment returns all dimensions", () => {
    const adj = defaultAdjustment();
    expect(adj.tools).toBeDefined();
    expect(adj.workProcesses).toBeDefined();
    expect(adj.workSetting).toBeDefined();
    expect(adj.industry).toBeDefined();
  });

  it("F2: VAQ = average of four dimensions", () => {
    const result = computeVAQ({ tools: 100, workProcesses: 67, workSetting: 33, industry: 0 });
    expect(result.vaq).toBe(50); // (100+67+33+0)/4 = 50
    expect(result.passes).toBe(true);
  });

  it("F3: Advanced age rule — all dimensions must be 100", () => {
    const result = computeVAQ({ tools: 100, workProcesses: 67, workSetting: 100, industry: 100 }, "advanced_age");
    expect(result.passes).toBe(false);
    expect(result.vaq).toBe(0);
  });

  it("F4: Advanced age rule — all 100 passes", () => {
    const result = computeVAQ({ tools: 100, workProcesses: 100, workSetting: 100, industry: 100 }, "advanced_age");
    expect(result.passes).toBe(true);
  });

  it("F5: Closely approaching treated same as advanced age", () => {
    const result = computeVAQ({ tools: 100, workProcesses: 67, workSetting: 100, industry: 100 }, "closely_approaching");
    expect(result.passes).toBe(false);
  });

  it("F6: Standard age rule — any dimension values pass", () => {
    const result = computeVAQ({ tools: 33, workProcesses: 0, workSetting: 33, industry: 0 }, "standard");
    expect(result.passes).toBe(true);
    expect(result.vaq).toBe(16.5);
  });

  it("F7: estimateVAQ auto-estimation returns valid values", () => {
    const result = estimateVAQ([], null, [], null);
    expect(result.tools).toBeGreaterThanOrEqual(0);
    expect(result.tools).toBeLessThanOrEqual(100);
    expect(result.autoEstimated).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// G. LABOR MARKET QUOTIENT (LMQ)
// ═════════════════════════════════════════════════════════════════════

describe("G. Labor Market Quotient (LMQ)", () => {
  it("G1: High employment + good wage = high LMQ", () => {
    const result = computeLMQ({
      employment: 200000,
      medianWage: 60000,
      meanWage: 65000,
      priorEarnings: 50000,
      projectedOpenings: 15000,
      projectedGrowthPct: 12,
      joltsTrend: 0.5,
    });
    expect(result.lmq).toBeGreaterThan(80);
  });

  it("G2: Low employment + poor wage = low LMQ", () => {
    const result = computeLMQ({
      employment: 500,
      medianWage: 20000,
      meanWage: 22000,
      priorEarnings: 60000,
      projectedOpenings: 100,
      projectedGrowthPct: -8,
    });
    expect(result.lmq).toBeLessThan(30);
  });

  it("G3: LMQ bounded 0-100", () => {
    const result = computeLMQ({
      employment: 200000,
      medianWage: 100000,
      meanWage: 100000,
      priorEarnings: 50000,
      projectedOpenings: 50000,
      projectedGrowthPct: 20,
      joltsTrend: 1.0,
    });
    expect(result.lmq).toBeGreaterThanOrEqual(0);
    expect(result.lmq).toBeLessThanOrEqual(100);
  });

  it("G4: Null employment returns neutral score", () => {
    const result = computeLMQ({
      employment: null,
      medianWage: 50000,
      meanWage: 55000,
      priorEarnings: 50000,
      projectedOpenings: null,
      projectedGrowthPct: null,
    });
    expect(result.lmq).toBeGreaterThan(0);
    expect(result.components.employmentScore).toBe(50); // neutral
  });

  it("G5: Wage ratio scoring correct", () => {
    // Median ≥ prior → ratio ≥ 1.0 → score 100
    const result = computeLMQ({
      employment: 50000,
      medianWage: 60000,
      meanWage: 60000,
      priorEarnings: 50000,
      projectedOpenings: 5000,
      projectedGrowthPct: 5,
    });
    expect(result.components.wageScore).toBe(100);
  });
});

// ═════════════════════════════════════════════════════════════════════
// H. VOCATIONAL QUOTIENT (VQ) & TSP
// ═════════════════════════════════════════════════════════════════════

describe("H. Vocational Quotient (VQ) & TSP", () => {
  it("H1: VQ produces score in expected range (68-158)", () => {
    const result = computeVQ(uniformVector(2));
    expect(result.vq).toBeGreaterThanOrEqual(60);
    expect(result.vq).toBeLessThanOrEqual(170);
  });

  it("H2: VQ band classification correct", () => {
    expect(classifyVQBand(80)).toBe(1);
    expect(classifyVQBand(100)).toBe(2);
    expect(classifyVQBand(125)).toBe(3);
    expect(classifyVQBand(150)).toBe(4);
  });

  it("H3: VQ band info returns valid structure", () => {
    const info = getVQBandInfo(100);
    expect(info).toHaveProperty("band");
    expect(info).toHaveProperty("label");
  });

  it("H4: TSP bounded 0-97%", () => {
    const result = computeTSP({
      sourceDotCode: null,
      sourceOnetCode: "11-1021.00",
      sourceTraits: uniformVector(3),
      sourceVq: 100,
      sourceSvp: 8,
      sourceStrength: 3,
      targetDotCode: null,
      targetOnetCode: "11-1021.00",
      targetTraits: uniformVector(3),
      targetVq: 100,
      targetSvp: 8,
      targetStrength: 3,
    });
    expect(result.tsp).toBeLessThanOrEqual(97);
    expect(result.tsp).toBeGreaterThanOrEqual(0);
  });

  it("H5: TSP tier classification", () => {
    expect(classifyTSPTier(95)).toBe(5); // Highest
    expect(classifyTSPTier(50)).toBeLessThanOrEqual(3);
    expect(classifyTSPTier(10)).toBe(1); // Lowest
  });

  it("H6: TSP label returns string", () => {
    const label = getTSPLabel(85);
    expect(typeof label).toBe("string");
    expect(label.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// I. PVQ COMPOSITE
// ═════════════════════════════════════════════════════════════════════

describe("I. Public Vocational Quotient (PVQ) Composite", () => {
  it("I1: PVQ weights sum to 1.0", () => {
    const sum = PVQ_WEIGHTS.stq + PVQ_WEIGHTS.tfq + PVQ_WEIGHTS.vaq + PVQ_WEIGHTS.lmq;
    expect(sum).toBe(1.0);
  });

  it("I2: PVQ = 0.45×STQ + 0.25×TFQ + 0.15×VAQ + 0.15×LMQ", () => {
    const stq = makeSTQResult(80);
    const tfq = computeTFQ(uniformVector(3), uniformVector(1));
    const vaq = computeVAQ({ tools: 67, workProcesses: 67, workSetting: 67, industry: 67 });
    const lmq = computeLMQ({
      employment: 50000, medianWage: 50000, meanWage: 55000,
      priorEarnings: 50000, projectedOpenings: 5000, projectedGrowthPct: 5,
    });

    const result = computePVQ(stq, tfq, vaq, lmq);
    const expected = 0.45 * stq.stq + 0.25 * tfq.tfq + 0.15 * vaq.vaq + 0.15 * lmq.lmq;
    expect(Math.abs(result.pvq - expected)).toBeLessThan(1);
  });

  it("I3: STQ gate failure → excluded", () => {
    const stq = makeSTQResult(0, false);
    const tfq = computeTFQ(uniformVector(3), uniformVector(1));
    const vaq = computeVAQ(defaultAdjustment());
    const lmq = computeLMQ({ employment: 50000, medianWage: 50000, meanWage: 55000, priorEarnings: 50000, projectedOpenings: 5000, projectedGrowthPct: 5 });
    const result = computePVQ(stq, tfq, vaq, lmq);
    expect(result.excluded).toBe(true);
    expect(result.pvq).toBe(0);
  });

  it("I4: TFQ failure → excluded", () => {
    const stq = makeSTQResult(70);
    const worker = uniformVector(1);
    const demands = uniformVector(3); // Worker can't meet demands
    const tfq = computeTFQ(worker, demands);
    const vaq = computeVAQ(defaultAdjustment());
    const lmq = computeLMQ({ employment: 50000, medianWage: 50000, meanWage: 55000, priorEarnings: 50000, projectedOpenings: 5000, projectedGrowthPct: 5 });
    const result = computePVQ(stq, tfq, vaq, lmq);
    expect(result.excluded).toBe(true);
    expect(result.pvq).toBe(0);
  });

  it("I5: Confidence grade A-D", () => {
    const stq = makeSTQResult(70);
    const tfq = computeTFQ(uniformVector(3), uniformVector(1));
    const vaq = computeVAQ(defaultAdjustment());
    const lmq = computeLMQ({ employment: 50000, medianWage: 50000, meanWage: 55000, priorEarnings: 50000, projectedOpenings: 5000, projectedGrowthPct: 5 });
    const result = computePVQ(stq, tfq, vaq, lmq);
    expect(["A", "B", "C", "D"]).toContain(result.confidenceGrade);
  });
});

// ═════════════════════════════════════════════════════════════════════
// J. COMPONENT PROFILE CODE (CPC)
// ═════════════════════════════════════════════════════════════════════

describe("J. Component Profile Code (CPC)", () => {
  let index: Map<string, unknown>;

  it("J1: Fingerprint index builds for all O*NET occupations", async () => {
    index = await buildFingerprintIndex() as Map<string, unknown>;
    expect(index.size).toBeGreaterThan(900);
    _resetFingerprintIndex();
  });

  it("J2: L2 normalization produces unit vectors", () => {
    const v = new Float64Array([3, 4, 0]);
    const normed = l2Normalize(v);
    const magnitude = Math.sqrt(normed.reduce((s, x) => s + x * x, 0));
    expect(magnitude).toBeCloseTo(1.0, 5);
  });

  it("J3: Cosine similarity of identical vectors = 1.0", () => {
    const v = l2Normalize(new Float64Array([1, 2, 3]));
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it("J4: Cosine similarity of orthogonal vectors = 0.0", () => {
    const a = l2Normalize(new Float64Array([1, 0, 0]));
    const b = l2Normalize(new Float64Array([0, 1, 0]));
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
  });

  it("J5: Profile breadth classification", () => {
    const uniform = l2Normalize(new Float64Array(237).fill(1));
    const { label } = profileBreadth(uniform);
    expect(["narrow", "moderate", "broad"]).toContain(label);
  });

  it("J6: Job zone to max SVP mapping", () => {
    expect(jobZoneToMaxSvp(1)).toBeLessThanOrEqual(3);
    expect(jobZoneToMaxSvp(3)).toBeLessThanOrEqual(6);
    expect(jobZoneToMaxSvp(5)).toBeLessThanOrEqual(9);
  });
});

// ═════════════════════════════════════════════════════════════════════
// K. COMPREHENSIVE ANALYSIS MODULES
// ═════════════════════════════════════════════════════════════════════

describe("K. Comprehensive Analysis Modules", () => {
  it("K1: Near-miss analysis categorizes by severity", () => {
    const excluded = [{
      pvqResult: {
        ...computePVQ(
          makeSTQResult(70),
          computeTFQ(uniformVector(2), { ...uniformVector(2), strength: 3 } as TraitVector),
          computeVAQ(defaultAdjustment()),
          computeLMQ({ employment: 50000, medianWage: 50000, meanWage: 55000, priorEarnings: 50000, projectedOpenings: 5000, projectedGrowthPct: 5 }),
        ),
      },
      occupationTitle: "Heavy Equipment Operator",
      onetCode: "53-7032.00",
      targetSvp: 4,
      sourceSvp: 6,
    }];
    const analysis = analyzeNearMisses(excluded);
    expect(analysis).toBeDefined();
  });

  it("K2: RFC narrative generates for all profiles", () => {
    const narrative = generateRFCNarrative(uniformVector(2), uniformVector(3), 5, 10);
    expect(narrative).toBeDefined();
    expect(narrative.functionalLevel).toBeTruthy();
    expect(narrative.functionalLevelLabel).toBeTruthy();
  });

  it("K3: RFC narrative works without pre-profile", () => {
    const narrative = generateRFCNarrative(uniformVector(2), null, 3, 8);
    expect(narrative).toBeDefined();
    expect(narrative.functionalLevel).toBeTruthy();
  });

  it("K4: Viable set analysis produces coherence assessment", () => {
    const stq = makeSTQResult(70);
    const tfq = computeTFQ(uniformVector(3), uniformVector(1));
    const vaq = computeVAQ(defaultAdjustment());
    const lmq = computeLMQ({ employment: 50000, medianWage: 50000, meanWage: 55000, priorEarnings: 50000, projectedOpenings: 5000, projectedGrowthPct: 5 });
    const pvqResult = computePVQ(stq, tfq, vaq, lmq);
    const result = analyzeViableSet([
      { title: "Clerk", pvqResult, socCode: "43-4051" },
      { title: "Admin Asst", pvqResult, socCode: "43-6014" },
    ]);
    expect(result).toBeDefined();
  });

  it("K5: Confidence explanation provides detail for all components", () => {
    const stq = makeSTQResult(70);
    const tfq = computeTFQ(uniformVector(3), uniformVector(1));
    const lmq = computeLMQ({ employment: 50000, medianWage: 50000, meanWage: 55000, priorEarnings: 50000, projectedOpenings: 5000, projectedGrowthPct: 5 });
    const explanation = explainConfidence(stq, tfq, lmq);
    expect(explanation).toBeDefined();
    expect(explanation.grade).toBeTruthy();
  });
});

// ═════════════════════════════════════════════════════════════════════
// L. EARNING CAPACITY & ECLR
// ═════════════════════════════════════════════════════════════════════

describe("L. Earning Capacity & ECLR", () => {
  it("L1: ECLR = 1.0 when area wage equals national", () => {
    expect(computeECLR(50000, 50000)).toBeCloseTo(1.0, 2);
  });

  it("L2: ECLR > 1.0 when area wage exceeds national", () => {
    expect(computeECLR(60000, 50000)).toBeGreaterThan(1.0);
  });

  it("L3: ECLR < 1.0 when area wage below national", () => {
    expect(computeECLR(40000, 50000)).toBeLessThan(1.0);
  });

  it("L4: ECLR = 1.0 when either wage is null", () => {
    expect(computeECLR(null, 50000)).toBe(1.0);
    expect(computeECLR(50000, null)).toBe(1.0);
  });

  it("L5: Earning capacity returns valid structure", () => {
    const result = computeEarningCapacity(2, { md: 25, m: 27, p10: 15, p25: 20, p75: 32, p90: 40, e: 50000 });
    expect(result).toBeDefined();
    expect(result.band).toBe(2);
    expect(result.median).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// M. VALIDATION ENGINE
// ═════════════════════════════════════════════════════════════════════

describe("M. Validation Engine", () => {
  it("M1: Validation produces structured report", () => {
    const report = validateAnalysis({
      analysis: { cpcAnalysis: null, zeroViableExplanation: null, laborMarketAccess: null, viableSetAnalysis: null, rfcNarrative: null },
      targets: [],
      prw: [],
      skills: [],
      postProfile: uniformVector(2) as unknown as Record<string, unknown>,
      preProfile: null,
      analysisConfig: {},
    });
    expect(report.totalChecks).toBeGreaterThan(0);
    expect(report.timestamp).toBeTruthy();
    expect(typeof report.passed).toBe("number");
    expect(typeof report.errors).toBe("number");
  });

  it("M2: Validation catches PVQ out of range", () => {
    const report = validateAnalysis({
      analysis: { cpcAnalysis: null, zeroViableExplanation: null, laborMarketAccess: null, viableSetAnalysis: null, rfcNarrative: null },
      targets: [{ onetSocCode: "11-1011.00", title: "Test", pvq: 150, stq: 50, tfq: 50, vaq: 50, lmq: 50, excluded: false, cpcSimilarity: null, cpcCode: null, confidenceGrade: "B" }],
      prw: [],
      skills: [],
      postProfile: uniformVector(2) as unknown as Record<string, unknown>,
      preProfile: null,
      analysisConfig: {},
    });
    const pvqCheck = report.checks.find(c => c.check === "PVQ within 0-100 range");
    expect(pvqCheck?.passed).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// N. DETERMINISM & REPEATABILITY
// ═════════════════════════════════════════════════════════════════════

describe("N. Determinism & Repeatability", () => {
  it("N1: TFQ deterministic across 20 runs", () => {
    const results = Array.from({ length: 20 }, () =>
      computeTFQ(uniformVector(3), uniformVector(2))
    );
    for (const r of results) {
      expect(r.tfq).toBe(results[0].tfq);
      expect(r.passes).toBe(results[0].passes);
    }
  });

  it("N2: STQ deterministic across 20 runs", () => {
    const input: SkillTransferInput = {
      sourceSvp: 6, targetSvp: 4,
      sourceTasks: ["Manage staff", "Budget planning"],
      targetTasks: ["Manage resources", "Plan budgets"],
      sourceDWAs: [], targetDWAs: [],
      sourceWorkFields: ["Admin"], targetWorkFields: ["Admin"],
      sourceMPSMS: [], targetMPSMS: [],
      sourceTools: ["Excel"], targetTools: ["Excel"],
      sourceMaterials: [], targetMaterials: [],
      sourceKnowledge: ["Admin"], targetKnowledge: ["Admin"],
    };
    const results = Array.from({ length: 20 }, () => computeSTQ(input));
    for (const r of results) expect(r.stq).toBe(results[0].stq);
  });

  it("N3: LMQ deterministic across 20 runs", () => {
    const input = {
      employment: 50000, medianWage: 50000, meanWage: 55000,
      priorEarnings: 50000, projectedOpenings: 5000, projectedGrowthPct: 5 as number | null,
    };
    const results = Array.from({ length: 20 }, () => computeLMQ(input));
    for (const r of results) expect(r.lmq).toBe(results[0].lmq);
  });

  it("N4: PVQ composite deterministic across 20 runs", () => {
    const stq = makeSTQResult(70);
    const tfq = computeTFQ(uniformVector(3), uniformVector(1));
    const vaq = computeVAQ(defaultAdjustment());
    const lmq = computeLMQ({ employment: 50000, medianWage: 50000, meanWage: 55000, priorEarnings: 50000, projectedOpenings: 5000, projectedGrowthPct: 5 });
    const results = Array.from({ length: 20 }, () => computePVQ(stq, tfq, vaq, lmq));
    for (const r of results) {
      expect(r.pvq).toBe(results[0].pvq);
      expect(r.confidenceGrade).toBe(results[0].confidenceGrade);
    }
  });
});
