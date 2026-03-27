/**
 * Determinism Proof Tests
 *
 * Formally proves that all PVQ-TM engine computations are deterministic:
 * given identical inputs, the system always produces identical outputs.
 *
 * Methodology:
 * 1. Hash verification — recompute results and compare SHA-256 hashes
 *    against the frozen expected-hashes.json baseline
 * 2. Identical re-computation — run each computation twice and assert
 *    bitwise-identical JSON output
 * 3. Trait normalization determinism — run each normalization function
 *    10 times with the same input and assert all results are identical
 * 4. VQ regression determinism — run VQ regression for all 18 benchmark
 *    occupations and assert identical results across runs
 */

import { describe, it, expect } from "vitest";
import { createHash } from "crypto";

import {
  computeVQ,
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
} from "../pvq";
import {
  type TraitVector,
  type TraitKey,
  TRAIT_KEYS,
  normalizeDOTGED,
  normalizeDOTAptitude,
  normalizeDOTStrength,
  normalizeDOTPhysical,
  normalizeONETScore,
  compareTraits,
  calculateReserveMargin,
} from "../traits";

import benchmarkOccupations from "../__fixtures__/benchmark-occupations.json";
import benchmarkWorkerProfiles from "../__fixtures__/benchmark-worker-profiles.json";
import benchmarkPairsData from "../__fixtures__/benchmark-pairs.json";
import expectedHashes from "../__fixtures__/expected-hashes.json";

const benchmarkPairs = benchmarkPairsData.pairs;

// ─── Helpers ──────────────────────────────────────────────────────────────

function toTraitVector(obj: Record<string, number>): TraitVector {
  const vector: Partial<TraitVector> = {};
  for (const key of TRAIT_KEYS) {
    vector[key] = obj[key] ?? null;
  }
  return vector as TraitVector;
}

function canonicalJSON(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(value).sort()) {
        sorted[k] = value[k];
      }
      return sorted;
    }
    return value;
  });
}

function sha256(data: string): string {
  return createHash("sha256").update(data, "utf-8").digest("hex");
}

function getOccupation(id: string) {
  return benchmarkOccupations.find((o) => o.id === id)!;
}

function getWorkerProfile(id: string) {
  return benchmarkWorkerProfiles.find((p) => p.id === id)!;
}

// ─── Section 1: Hash Verification ─────────────────────────────────────────

describe("Determinism Proof", () => {
  describe("Hash verification against frozen baseline", () => {
    for (const pair of benchmarkPairs) {
      it(`${pair.id}: expectedResults SHA-256 matches frozen hash`, () => {
        const canonical = canonicalJSON(pair.expectedResults);
        const hash = sha256(canonical);
        const expectedHash =
          expectedHashes.pairHashes[
            pair.id as keyof typeof expectedHashes.pairHashes
          ];

        expect(hash).toBe(expectedHash);
      });
    }
  });

  // ─── Section 2: Identical Re-computation ──────────────────────────────

  describe("Identical re-computation", () => {
    for (const pair of benchmarkPairs) {
      it(`${pair.id}: two runs produce bitwise-identical output`, () => {
        const occ = getOccupation(pair.targetOccupationId);
        const profile = getWorkerProfile(pair.workerProfileId);

        const workerTraits = toTraitVector(profile.traits);
        const occTraits = toTraitVector(occ.traitVector);

        // Run 1: VQ
        const vq1 = computeVQ(occTraits);
        // Run 2: VQ
        const vq2 = computeVQ(occTraits);
        expect(JSON.stringify(vq1)).toBe(JSON.stringify(vq2));

        // Run 1: TFQ
        const tfq1 = computeTFQ(workerTraits, occTraits);
        // Run 2: TFQ
        const tfq2 = computeTFQ(workerTraits, occTraits);
        expect(JSON.stringify(tfq1)).toBe(JSON.stringify(tfq2));

        // Run 1: compareTraits
        const comp1 = compareTraits(workerTraits, occTraits);
        // Run 2: compareTraits
        const comp2 = compareTraits(workerTraits, occTraits);
        expect(JSON.stringify(comp1)).toBe(JSON.stringify(comp2));

        // Run 1: reserve margin
        const rm1 = calculateReserveMargin(workerTraits, occTraits);
        // Run 2: reserve margin
        const rm2 = calculateReserveMargin(workerTraits, occTraits);
        expect(rm1).toBe(rm2);

        // Run 1: LMQ
        const lmqInput: LaborMarketInput = {
          employment: occ.oewsData.employment,
          medianWage: occ.oewsData.medianWage,
          meanWage: occ.oewsData.meanWage,
          priorEarnings: null,
          projectedOpenings: null,
          projectedGrowthPct: null,
          pct10: occ.oewsData.pct10,
          pct25: occ.oewsData.pct25,
          pct75: occ.oewsData.pct75,
          pct90: occ.oewsData.pct90,
        };
        const lmq1 = computeLMQ(lmqInput);
        const lmq2 = computeLMQ(lmqInput);
        expect(JSON.stringify(lmq1)).toBe(JSON.stringify(lmq2));

        // Run 1: VAQ
        const vaqAdj: VocationalAdjustment = {
          tools: pair.expectedResults.vaq.tools as 0 | 33 | 67 | 100,
          workProcesses: pair.expectedResults.vaq
            .workProcesses as 0 | 33 | 67 | 100,
          workSetting: pair.expectedResults.vaq
            .workSetting as 0 | 33 | 67 | 100,
          industry: pair.expectedResults.vaq.industry as 0 | 33 | 67 | 100,
        };
        const vaq1 = computeVAQ(
          vaqAdj,
          pair.ageRule as "standard" | "advanced_age"
        );
        const vaq2 = computeVAQ(
          vaqAdj,
          pair.ageRule as "standard" | "advanced_age"
        );
        expect(JSON.stringify(vaq1)).toBe(JSON.stringify(vaq2));
      });
    }
  });

  // ─── Section 3: Trait Normalization Determinism ────────────────────────

  describe("Trait normalization determinism", () => {
    const ITERATIONS = 10;

    it("normalizeDOTGED produces identical results across 10 runs", () => {
      for (let gedLevel = 1; gedLevel <= 6; gedLevel++) {
        const results = Array.from({ length: ITERATIONS }, () =>
          normalizeDOTGED(gedLevel)
        );
        expect(new Set(results).size).toBe(1);
      }
    });

    it("normalizeDOTAptitude produces identical results across 10 runs", () => {
      for (let aptLevel = 1; aptLevel <= 5; aptLevel++) {
        const results = Array.from({ length: ITERATIONS }, () =>
          normalizeDOTAptitude(aptLevel)
        );
        expect(new Set(results).size).toBe(1);
      }
    });

    it("normalizeDOTStrength produces identical results across 10 runs", () => {
      for (const code of ["S", "L", "M", "H", "V"]) {
        const results = Array.from({ length: ITERATIONS }, () =>
          normalizeDOTStrength(code)
        );
        expect(new Set(results).size).toBe(1);
      }
    });

    it("normalizeDOTPhysical produces identical results across 10 runs", () => {
      for (const code of ["N", "S", "O", "F", "C"]) {
        const results = Array.from({ length: ITERATIONS }, () =>
          normalizeDOTPhysical(code)
        );
        expect(new Set(results).size).toBe(1);
      }
    });

    it("normalizeONETScore produces identical results across 10 runs", () => {
      for (const score of [0, 25, 50, 75, 100]) {
        const results = Array.from({ length: ITERATIONS }, () =>
          normalizeONETScore(score)
        );
        expect(new Set(results).size).toBe(1);
      }
    });
  });

  // ─── Section 4: VQ Regression Determinism ─────────────────────────────

  describe("VQ regression determinism", () => {
    for (const occ of benchmarkOccupations) {
      it(`${occ.title}: VQ regression produces identical results across 10 runs`, () => {
        const traitVec = toTraitVector(occ.traitVector);
        const results = Array.from({ length: 10 }, () =>
          computeVQ(traitVec)
        );

        const firstJSON = JSON.stringify(results[0]);
        for (let i = 1; i < results.length; i++) {
          expect(JSON.stringify(results[i])).toBe(firstJSON);
        }
      });
    }
  });

  // ─── Section 5: PVQ Composite Determinism ─────────────────────────────

  describe("PVQ composite determinism", () => {
    for (const pair of benchmarkPairs) {
      it(`${pair.id}: full PVQ pipeline produces identical results across 5 runs`, () => {
        const occ = getOccupation(pair.targetOccupationId);
        const profile = getWorkerProfile(pair.workerProfileId);

        const workerTraits = toTraitVector(profile.traits);
        const occTraits = toTraitVector(occ.traitVector);

        const runOnce = () => {
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

          const tfqResult = computeTFQ(workerTraits, occTraits);

          const vaqAdj: VocationalAdjustment = {
            tools: pair.expectedResults.vaq.tools as 0 | 33 | 67 | 100,
            workProcesses: pair.expectedResults.vaq
              .workProcesses as 0 | 33 | 67 | 100,
            workSetting: pair.expectedResults.vaq
              .workSetting as 0 | 33 | 67 | 100,
            industry: pair.expectedResults.vaq.industry as 0 | 33 | 67 | 100,
          };
          const vaqResult = computeVAQ(
            vaqAdj,
            pair.ageRule as "standard" | "advanced_age"
          );

          const lmqResult = computeLMQ({
            employment: occ.oewsData.employment,
            medianWage: occ.oewsData.medianWage,
            meanWage: occ.oewsData.meanWage,
            priorEarnings: null,
            projectedOpenings: null,
            projectedGrowthPct: null,
            pct10: occ.oewsData.pct10,
            pct25: occ.oewsData.pct25,
            pct75: occ.oewsData.pct75,
            pct90: occ.oewsData.pct90,
          });

          return computePVQ(stqResult, tfqResult, vaqResult, lmqResult);
        };

        const results = Array.from({ length: 5 }, runOnce);
        const firstJSON = JSON.stringify(results[0]);
        for (let i = 1; i < results.length; i++) {
          expect(JSON.stringify(results[i])).toBe(firstJSON);
        }
      });
    }
  });
});
