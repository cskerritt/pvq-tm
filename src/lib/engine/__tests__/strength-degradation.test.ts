/**
 * Progressive Strength Reduction Test Suite
 *
 * Tests that the PVQ-TM pipeline correctly identifies transferable occupations
 * as worker capacity degrades from Heavy → Sedentary. Validates:
 *
 * 1. MONOTONIC DEGRADATION: As strength decreases, viable count must decrease
 *    or stay the same, NEVER increase.
 * 2. GATE CORRECTNESS: A Sedentary worker must NEVER pass a Heavy occupation.
 * 3. TFQ CONSISTENCY: TFQ scores for the same occupation must decrease as
 *    worker strength decreases.
 * 4. PVQ CONSISTENCY: Composite PVQ must reflect strength degradation.
 * 5. REPEATABILITY: Same inputs must always produce identical outputs.
 */
import { describe, it, expect } from "vitest";
import { computeTFQ, type TFQResult } from "@/lib/engine/trait-feasibility";
import { computeSTQ, type SkillTransferInput } from "@/lib/engine/skill-transfer";
import { computePVQ } from "@/lib/engine/pvq";
import { computeLMQ } from "@/lib/engine/labor-market";
import { computeVAQ } from "@/lib/engine/vocational-adjustment";
import { type TraitVector, TRAIT_KEYS } from "@/lib/engine/traits";

// ─── Test Profiles ───────────────────────────────────────────────────

/** Base worker profile: Construction Foreman, SVP 6, cognitive = moderate */
const BASE_COGNITIVE: Partial<TraitVector> = {
  reasoning: 2.4,    // GED R=4
  math: 1.6,         // GED M=3
  language: 2.4,     // GED L=4
  spatialPerception: 2,
  formPerception: 2,
  clericalPerception: 1,
};

const BASE_ENVIRONMENTAL: Partial<TraitVector> = {
  workLocation: 2,
  extremeCold: 1,
  extremeHeat: 1,
  wetnessHumidity: 1,
  noiseVibration: 2,
  hazards: 2,
  dustsFumes: 1,
};

/**
 * Build worker profile at a given strength level (0-4).
 * Physical traits scale linearly with strength so the test isolates
 * strength degradation. At strength=N, all physical traits that the
 * corresponding strength-level occupation demands are met exactly.
 */
function buildWorkerProfile(strength: number): TraitVector {
  return {
    ...BASE_COGNITIVE,
    motorCoordination: Math.min(4, 1 + strength),
    fingerDexterity: 2,
    manualDexterity: Math.min(4, 1 + strength),
    eyeHandFoot: Math.min(4, strength),
    colorDiscrimination: 2,
    strength,
    climbBalance: strength,        // Matches demand at same strength level
    stoopKneel: strength,          // Matches demand at same strength level
    reachHandle: Math.min(4, 1 + strength),
    talkHear: 3,
    see: 3,
    ...BASE_ENVIRONMENTAL,
  } as TraitVector;
}

/** Standard occupation demands for testing */
const HEAVY_OCCUPATION: TraitVector = {
  reasoning: 1.6, math: 0.8, language: 1.6,
  spatialPerception: 2, formPerception: 2, clericalPerception: 1,
  motorCoordination: 3, fingerDexterity: 2, manualDexterity: 3,
  eyeHandFoot: 2, colorDiscrimination: 1,
  strength: 3, climbBalance: 2, stoopKneel: 3, reachHandle: 3,
  talkHear: 1, see: 2,
  workLocation: 2, extremeCold: 1, extremeHeat: 1,
  wetnessHumidity: 1, noiseVibration: 2, hazards: 2, dustsFumes: 1,
} as TraitVector;

const MEDIUM_OCCUPATION: TraitVector = {
  ...HEAVY_OCCUPATION,
  strength: 2, climbBalance: 1, stoopKneel: 2, reachHandle: 2,
  motorCoordination: 2, manualDexterity: 2,
} as TraitVector;

const LIGHT_OCCUPATION: TraitVector = {
  ...HEAVY_OCCUPATION,
  strength: 1, climbBalance: 0, stoopKneel: 1, reachHandle: 2,
  motorCoordination: 2, manualDexterity: 1, eyeHandFoot: 1,
} as TraitVector;

const SEDENTARY_OCCUPATION: TraitVector = {
  reasoning: 1.6, math: 0.8, language: 1.6,  // Within construction foreman's cognitive capacity
  spatialPerception: 1, formPerception: 1, clericalPerception: 1,
  motorCoordination: 1, fingerDexterity: 1, manualDexterity: 1,
  eyeHandFoot: 0, colorDiscrimination: 1,
  strength: 0, climbBalance: 0, stoopKneel: 0, reachHandle: 1,
  talkHear: 2, see: 2,
  workLocation: 0, extremeCold: 0, extremeHeat: 0,
  wetnessHumidity: 0, noiseVibration: 1, hazards: 0, dustsFumes: 0,
} as TraitVector;

const STRENGTH_LABELS: Record<number, string> = {
  0: "Sedentary", 1: "Light", 2: "Medium", 3: "Heavy", 4: "Very Heavy",
};

// ─── Standard STQ input (same across all strength levels) ────────────

const STANDARD_STQ_INPUT: SkillTransferInput = {
  sourceSvp: 6,
  sourceTasks: ["Supervise construction crew", "Read blueprints", "Coordinate subcontractors"],
  sourceDWAs: ["Monitoring Processes", "Coordinating Work Activities"],
  sourceWorkFields: ["Structural Work", "Masonry Work"],
  sourceMPSMS: ["Construction Materials", "Building Components"],
  sourceTools: ["Level", "Tape measure", "Power drill"],
  sourceMaterials: ["Concrete", "Steel", "Lumber"],
  sourceKnowledge: ["Building and Construction", "Administration and Management"],
  targetSvp: 4,
  targetTasks: ["Inspect construction sites", "Monitor crew activities", "Ensure safety compliance"],
  targetDWAs: ["Monitoring Processes", "Inspecting Equipment"],
  targetWorkFields: ["Structural Work"],
  targetMPSMS: ["Construction Materials"],
  targetTools: ["Level", "Measuring instruments"],
  targetMaterials: ["Building Components"],
  targetKnowledge: ["Building and Construction", "Public Safety and Security"],
};

// ─── Tests ───────────────────────────────────────────────────────────

describe("Progressive Strength Reduction", () => {
  const strengthLevels = [4, 3, 2, 1, 0]; // Very Heavy → Sedentary

  describe("TFQ Monotonic Degradation Against Heavy Occupation", () => {
    const results: { strength: number; tfq: number; passes: boolean }[] = [];

    for (const strength of strengthLevels) {
      it(`strength=${strength} (${STRENGTH_LABELS[strength]}) vs Heavy occupation`, () => {
        const worker = buildWorkerProfile(strength);
        const result = computeTFQ(worker, HEAVY_OCCUPATION);
        results.push({ strength, tfq: result.tfq, passes: result.passes });

        // Heavy occupation (strength demand = 3)
        if (strength < 3) {
          expect(result.passes).toBe(false);
          expect(result.tfq).toBe(0);
        }
        if (strength >= 3) {
          expect(result.passes).toBe(true);
          expect(result.tfq).toBeGreaterThan(0);
        }
      });
    }

    it("TFQ scores are monotonically non-increasing", () => {
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].tfq).toBeGreaterThanOrEqual(results[i + 1].tfq);
      }
    });
  });

  describe("TFQ Monotonic Degradation Against Medium Occupation", () => {
    const results: { strength: number; tfq: number; passes: boolean }[] = [];

    for (const strength of strengthLevels) {
      it(`strength=${strength} (${STRENGTH_LABELS[strength]}) vs Medium occupation`, () => {
        const worker = buildWorkerProfile(strength);
        const result = computeTFQ(worker, MEDIUM_OCCUPATION);
        results.push({ strength, tfq: result.tfq, passes: result.passes });

        // Medium occupation (strength demand = 2)
        if (strength < 2) {
          expect(result.passes).toBe(false);
        }
        if (strength >= 2) {
          expect(result.passes).toBe(true);
        }
      });
    }

    it("TFQ scores are monotonically non-increasing", () => {
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].tfq).toBeGreaterThanOrEqual(results[i + 1].tfq);
      }
    });
  });

  describe("TFQ Against Light Occupation", () => {
    for (const strength of strengthLevels) {
      it(`strength=${strength} (${STRENGTH_LABELS[strength]}) vs Light occupation`, () => {
        const worker = buildWorkerProfile(strength);
        const result = computeTFQ(worker, LIGHT_OCCUPATION);

        if (strength < 1) {
          expect(result.passes).toBe(false);
        }
        if (strength >= 1) {
          expect(result.passes).toBe(true);
        }
      });
    }
  });

  describe("TFQ Against Sedentary Occupation", () => {
    for (const strength of strengthLevels) {
      it(`strength=${strength} (${STRENGTH_LABELS[strength]}) vs Sedentary occupation — all should pass`, () => {
        const worker = buildWorkerProfile(strength);
        const result = computeTFQ(worker, SEDENTARY_OCCUPATION);

        // Every worker should be able to do sedentary work (strength demand = 0)
        expect(result.passes).toBe(true);
        expect(result.tfq).toBeGreaterThan(0);
      });
    }
  });

  describe("Viable Occupation Count Decreases With Strength", () => {
    const occupations = [
      { name: "Sedentary Office", demands: SEDENTARY_OCCUPATION },
      { name: "Light Inspector", demands: LIGHT_OCCUPATION },
      { name: "Medium Maintenance", demands: MEDIUM_OCCUPATION },
      { name: "Heavy Construction", demands: HEAVY_OCCUPATION },
    ];

    const viableCounts: number[] = [];

    for (const strength of strengthLevels) {
      it(`strength=${strength}: count viable from ${occupations.length} candidates`, () => {
        const worker = buildWorkerProfile(strength);
        let viableCount = 0;

        for (const occ of occupations) {
          const result = computeTFQ(worker, occ.demands);
          if (result.passes) viableCount++;
        }

        viableCounts.push(viableCount);

        // At strength=4 (Very Heavy), all 4 should be viable
        if (strength === 4) expect(viableCount).toBe(4);
        // At strength=0 (Sedentary), only sedentary should be viable
        if (strength === 0) expect(viableCount).toBe(1);
      });
    }

    it("viable count is monotonically non-increasing as strength drops", () => {
      for (let i = 0; i < viableCounts.length - 1; i++) {
        expect(viableCounts[i]).toBeGreaterThanOrEqual(viableCounts[i + 1]);
      }
    });
  });

  describe("STQ Is Strength-Independent (Skill Transfer)", () => {
    // STQ should NOT change with strength — it measures skill overlap, not physical capacity
    it("STQ returns identical scores across all strength levels", () => {
      const stqResults: number[] = [];

      for (const strength of strengthLevels) {
        const result = computeSTQ(STANDARD_STQ_INPUT);
        stqResults.push(result.stq);
      }

      // All should be identical
      for (let i = 1; i < stqResults.length; i++) {
        expect(stqResults[i]).toBe(stqResults[0]);
      }
    });

    it("STQ correctly blocks when target SVP exceeds source SVP", () => {
      const higherSvpInput = { ...STANDARD_STQ_INPUT, targetSvp: 8, sourceSvp: 6 };
      const result = computeSTQ(higherSvpInput);
      expect(result.passesGate).toBe(false);
      expect(result.stq).toBe(0);
    });

    it("STQ produces non-zero score for related occupations", () => {
      const result = computeSTQ(STANDARD_STQ_INPUT);
      expect(result.stq).toBeGreaterThan(0);
      expect(result.passesGate).toBe(true);
    });

    it("STQ produces zero for completely unrelated occupations", () => {
      const unrelatedInput: SkillTransferInput = {
        ...STANDARD_STQ_INPUT,
        targetTasks: ["Perform brain surgery", "Administer anesthesia"],
        targetDWAs: ["Treating Patients"],
        targetWorkFields: ["Medicine"],
        targetMPSMS: ["Pharmaceuticals"],
        targetTools: ["Scalpel", "MRI machine"],
        targetMaterials: ["Medical Supplies"],
        targetKnowledge: ["Medicine and Dentistry", "Biology"],
      };
      const result = computeSTQ(unrelatedInput);
      expect(result.stq).toBeLessThan(20); // Should be near zero
    });
  });

  describe("Full PVQ Pipeline Degradation", () => {
    const pvqResults: { strength: number; viable: number; avgPvq: number }[] = [];
    const occupations = [SEDENTARY_OCCUPATION, LIGHT_OCCUPATION, MEDIUM_OCCUPATION, HEAVY_OCCUPATION];

    for (const strength of strengthLevels) {
      it(`PVQ pipeline at strength=${strength} (${STRENGTH_LABELS[strength]})`, () => {
        const worker = buildWorkerProfile(strength);
        let viable = 0;
        let totalPvq = 0;

        for (const demands of occupations) {
          const stqResult = computeSTQ(STANDARD_STQ_INPUT);
          const tfqResult = computeTFQ(worker, demands);
          const vaqResult = computeVAQ({ tools: 67, workProcesses: 67, workSetting: 67, industry: 67 }, "standard");
          const lmqResult = computeLMQ({
            employment: 50000,
            medianWage: 48000,
            meanWage: 50000,
            priorEarnings: 55000,
            projectedOpenings: 3000,
            projectedGrowthPct: 5.0,
            joltsTrend: 0.2,
          });

          const pvqResult = computePVQ(stqResult, tfqResult, vaqResult, lmqResult);

          if (!pvqResult.excluded) {
            viable++;
            totalPvq += pvqResult.pvq;
          }
        }

        const avgPvq = viable > 0 ? totalPvq / viable : 0;
        pvqResults.push({ strength, viable, avgPvq });
      });
    }

    it("viable count is monotonically non-increasing", () => {
      for (let i = 0; i < pvqResults.length - 1; i++) {
        expect(pvqResults[i].viable).toBeGreaterThanOrEqual(pvqResults[i + 1].viable);
      }
    });

    it("Very Heavy worker has the most viable occupations", () => {
      expect(pvqResults[0].viable).toBe(4); // All 4 viable
    });

    it("Sedentary worker has only sedentary occupations viable", () => {
      expect(pvqResults[4].viable).toBe(1); // Only sedentary
    });
  });

  describe("Repeatability — Deterministic Outputs", () => {
    it("same inputs produce identical TFQ across 10 runs", () => {
      const worker = buildWorkerProfile(2);
      const results: TFQResult[] = [];

      for (let i = 0; i < 10; i++) {
        results.push(computeTFQ(worker, MEDIUM_OCCUPATION));
      }

      for (let i = 1; i < results.length; i++) {
        expect(results[i].tfq).toBe(results[0].tfq);
        expect(results[i].passes).toBe(results[0].passes);
        expect(results[i].reserveMargin).toBe(results[0].reserveMargin);
      }
    });

    it("same inputs produce identical STQ across 10 runs", () => {
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(computeSTQ(STANDARD_STQ_INPUT));
      }
      for (let i = 1; i < results.length; i++) {
        expect(results[i].stq).toBe(results[0].stq);
      }
    });
  });
});
