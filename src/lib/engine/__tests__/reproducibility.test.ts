/**
 * Reproducibility Tests
 *
 * Proves that PVQ-TM computations are reproducible:
 * 1. Multi-run consistency — run each benchmark computation 50 times
 *    and assert every result is identical to the first. No floating-point
 *    drift, no state leakage, no accumulation errors.
 * 2. Order independence — run computations in forward and reverse order
 *    and assert results are identical regardless of execution sequence.
 *    This proves no shared mutable state between computations.
 */

import { describe, it, expect } from "vitest";

import { computeVQ } from "../vocational-quotient";
import { computeTFQ } from "../trait-feasibility";
import {
  computeSTQ,
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
import { computePVQ } from "../pvq";
import {
  type TraitVector,
  TRAIT_KEYS,
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

interface PairComputationResult {
  pairId: string;
  vq: string;
  tfq: string;
  lmq: string;
  vaq: string;
  pvq: string;
  reserveMargin: number;
}

function computeForPair(
  pair: (typeof benchmarkPairs)[number]
): PairComputationResult {
  const occ = getOccupation(pair.targetOccupationId);
  const profile = getWorkerProfile(pair.workerProfileId);

  const workerTraits = toTraitVector(profile.traits);
  const occTraits = toTraitVector(occ.traitVector);

  const vqResult = computeVQ(occTraits);
  const tfqResult = computeTFQ(workerTraits, occTraits);
  const reserveMargin = calculateReserveMargin(workerTraits, occTraits);

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

  const vaqAdj: VocationalAdjustment = {
    tools: pair.expectedResults.vaq.tools as 0 | 33 | 67 | 100,
    workProcesses: pair.expectedResults.vaq
      .workProcesses as 0 | 33 | 67 | 100,
    workSetting: pair.expectedResults.vaq.workSetting as 0 | 33 | 67 | 100,
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

  const pvqResult = computePVQ(stqResult, tfqResult, vaqResult, lmqResult);

  return {
    pairId: pair.id,
    vq: JSON.stringify(vqResult),
    tfq: JSON.stringify(tfqResult),
    lmq: JSON.stringify(lmqResult),
    vaq: JSON.stringify(vaqResult),
    pvq: JSON.stringify(pvqResult),
    reserveMargin,
  };
}

// ─── Section 1: Multi-Run Consistency ─────────────────────────────────────

describe("Reproducibility", () => {
  describe("Multi-run consistency (50 iterations)", () => {
    for (const pair of benchmarkPairs) {
      it(`${pair.id}: 50 consecutive runs produce identical results`, () => {
        const results: PairComputationResult[] = [];

        for (let i = 0; i < 50; i++) {
          results.push(computeForPair(pair));
        }

        const first = results[0];
        for (let i = 1; i < results.length; i++) {
          const r = results[i];
          expect(r.vq).toBe(first.vq);
          expect(r.tfq).toBe(first.tfq);
          expect(r.lmq).toBe(first.lmq);
          expect(r.vaq).toBe(first.vaq);
          expect(r.pvq).toBe(first.pvq);
          expect(r.reserveMargin).toBe(first.reserveMargin);
        }
      });
    }
  });

  // ─── Section 2: Order Independence ────────────────────────────────────

  describe("Order independence", () => {
    it("forward and reverse execution order produce identical results for all pairs", () => {
      // Forward order
      const forwardResults = benchmarkPairs.map((pair) =>
        computeForPair(pair)
      );

      // Reverse order
      const reversedPairs = [...benchmarkPairs].reverse();
      const reverseResults = reversedPairs.map((pair) =>
        computeForPair(pair)
      );

      // Re-sort reverse results by pair ID so we can compare
      const reverseByPairId = new Map(
        reverseResults.map((r) => [r.pairId, r])
      );

      for (const fwd of forwardResults) {
        const rev = reverseByPairId.get(fwd.pairId)!;
        expect(rev).toBeDefined();
        expect(rev.vq).toBe(fwd.vq);
        expect(rev.tfq).toBe(fwd.tfq);
        expect(rev.lmq).toBe(fwd.lmq);
        expect(rev.vaq).toBe(fwd.vaq);
        expect(rev.pvq).toBe(fwd.pvq);
        expect(rev.reserveMargin).toBe(fwd.reserveMargin);
      }
    });

    it("VQ regression is order-independent across all 18 benchmark occupations", () => {
      // Forward order
      const forwardVQs = benchmarkOccupations.map((occ) => ({
        id: occ.id,
        result: JSON.stringify(computeVQ(toTraitVector(occ.traitVector))),
      }));

      // Reverse order
      const reversedOccs = [...benchmarkOccupations].reverse();
      const reverseVQs = reversedOccs.map((occ) => ({
        id: occ.id,
        result: JSON.stringify(computeVQ(toTraitVector(occ.traitVector))),
      }));

      const reverseById = new Map(
        reverseVQs.map((r) => [r.id, r.result])
      );

      for (const fwd of forwardVQs) {
        expect(reverseById.get(fwd.id)).toBe(fwd.result);
      }
    });

    it("trait comparison is order-independent across worker profiles", () => {
      const occ = getOccupation("benchmark-001");
      const occTraits = toTraitVector(occ.traitVector);

      // Forward order through profiles
      const forwardResults = benchmarkWorkerProfiles.map((p) => ({
        id: p.id,
        comparisons: JSON.stringify(
          compareTraits(toTraitVector(p.traits), occTraits)
        ),
        margin: calculateReserveMargin(toTraitVector(p.traits), occTraits),
      }));

      // Reverse order through profiles
      const reversedProfiles = [...benchmarkWorkerProfiles].reverse();
      const reverseResults = reversedProfiles.map((p) => ({
        id: p.id,
        comparisons: JSON.stringify(
          compareTraits(toTraitVector(p.traits), occTraits)
        ),
        margin: calculateReserveMargin(toTraitVector(p.traits), occTraits),
      }));

      const reverseById = new Map(
        reverseResults.map((r) => [r.id, r])
      );

      for (const fwd of forwardResults) {
        const rev = reverseById.get(fwd.id)!;
        expect(rev.comparisons).toBe(fwd.comparisons);
        expect(rev.margin).toBe(fwd.margin);
      }
    });
  });
});
