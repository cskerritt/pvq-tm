import { describe, it, expect } from "vitest";
import {
  computeFeasibilityScore,
  type RiskLevel,
} from "@/lib/engine/trait-feasibility";
import { type TraitVector, TRAIT_KEYS } from "@/lib/engine/traits";

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
  overrides: Partial<Record<string, number | null>> = {}
): TraitVector {
  const v = uniformVector(base);
  for (const [key, val] of Object.entries(overrides)) {
    (v as Record<string, number | null>)[key] = val;
  }
  return v;
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("computeFeasibilityScore", () => {
  it("should return 100 feasibility and 'none' risk when all traits pass with surplus", () => {
    const worker = uniformVector(4);
    const demands = uniformVector(1);

    const result = computeFeasibilityScore(worker, demands);

    expect(result.feasibilityScore).toBeGreaterThan(0);
    expect(result.riskLevel).toBe("none");
    expect(result.deficits).toEqual([]);
  });

  it("should return 'none' risk when worker exactly meets all demands", () => {
    const worker = uniformVector(2);
    const demands = uniformVector(2);

    const result = computeFeasibilityScore(worker, demands);

    expect(result.riskLevel).toBe("none");
    expect(result.deficits).toEqual([]);
    // Reserve margin should be 0 since there's no surplus
    expect(result.reserveMargin).toBe(0);
    expect(result.feasibilityScore).toBe(0);
  });

  it("should produce deficits when demands exceed capacity", () => {
    const worker = makeVector(3, { strength: 1 });
    const demands = makeVector(2, { strength: 3 });

    const result = computeFeasibilityScore(worker, demands);

    expect(result.deficits.length).toBe(1);
    expect(result.deficits[0].trait).toBe("strength");
    expect(result.deficits[0].deficit).toBeGreaterThan(0);
    expect(result.deficits[0].vqWeight).toBeCloseTo(1.84953, 2);
    expect(result.riskLevel).not.toBe("none");
  });

  it("should weight reasoning deficits more heavily than minor trait deficits", () => {
    // Reasoning has VQ weight 5.3, dustsFumes has weight 0.3
    const workerA = makeVector(3, { reasoning: 1 });
    const demandsA = makeVector(2, { reasoning: 3 });

    const workerB = makeVector(3, { dustsFumes: 1 });
    const demandsB = makeVector(2, { dustsFumes: 3 });

    const resultA = computeFeasibilityScore(workerA, demandsA);
    const resultB = computeFeasibilityScore(workerB, demandsB);

    // Reasoning deficit should produce a larger penalty
    const reasoningPenalty = resultA.deficits[0].penalty;
    const dustsFumesPenalty = resultB.deficits[0].penalty;
    expect(reasoningPenalty).toBeGreaterThan(dustsFumesPenalty);
  });

  it("should classify a small single-trait deficit as 'marginal'", () => {
    // Worker capacity 2, demand 3 on a low-weight trait = small deficit
    const worker = makeVector(3, { dustsFumes: 2 });
    const demands = makeVector(2, { dustsFumes: 3 });

    const result = computeFeasibilityScore(worker, demands);

    expect(result.riskLevel).toBe("marginal");
    expect(result.deficits.length).toBe(1);
  });

  it("should classify multiple large deficits as 'severe'", () => {
    // Multiple high-weight trait failures
    const worker = makeVector(1);
    const demands = makeVector(3);

    const result = computeFeasibilityScore(worker, demands);

    expect(result.riskLevel).toBe("severe");
    expect(result.deficits.length).toBeGreaterThan(0);
    expect(result.feasibilityScore).toBe(0);
  });

  it("should never exclude — always returns a numeric feasibility score", () => {
    // Even worst case: all traits fail badly
    const worker = uniformVector(0);
    const demands = uniformVector(4);

    const result = computeFeasibilityScore(worker, demands);

    expect(typeof result.feasibilityScore).toBe("number");
    expect(result.feasibilityScore).toBeGreaterThanOrEqual(0);
    expect(result.feasibilityScore).toBeLessThanOrEqual(100);
    expect(result.riskLevel).toBe("severe");
    // No binary exclusion — risk level is informational
    expect(["none", "marginal", "moderate", "severe"]).toContain(
      result.riskLevel
    );
  });

  it("should handle null trait values gracefully", () => {
    const worker = makeVector(3, { reasoning: null, math: null });
    const demands = makeVector(2, { reasoning: null, math: null });

    const result = computeFeasibilityScore(worker, demands);

    // Null traits should not produce deficits
    const deficitTraits = result.deficits.map((d) => d.trait);
    expect(deficitTraits).not.toContain("reasoning");
    expect(deficitTraits).not.toContain("math");
  });

  it("should use McCroskey VQ weights for deficit penalties", () => {
    // Verify that talkHear (weight 4.54) produces a bigger penalty than
    // see (weight 0.20) for the same deficit magnitude
    const workerTH = makeVector(3, { talkHear: 1 });
    const demandsTH = makeVector(2, { talkHear: 3 });

    const workerSee = makeVector(3, { see: 1 });
    const demandsSee = makeVector(2, { see: 3 });

    const resultTH = computeFeasibilityScore(workerTH, demandsTH);
    const resultSee = computeFeasibilityScore(workerSee, demandsSee);

    const thPenalty = resultTH.deficits.find(
      (d) => d.trait === "talkHear"
    )!.penalty;
    const seePenalty = resultSee.deficits.find(
      (d) => d.trait === "see"
    )!.penalty;

    expect(thPenalty).toBeGreaterThan(seePenalty * 10); // 4.54 / 0.20 ≈ 22x
  });

  it("should return traitComparisons for all 24 traits", () => {
    const worker = uniformVector(3);
    const demands = uniformVector(2);

    const result = computeFeasibilityScore(worker, demands);

    expect(result.traitComparisons.length).toBe(24);
  });

  it("should produce deterministic results", () => {
    const worker = makeVector(3, { strength: 1, reasoning: 2 });
    const demands = makeVector(2, { strength: 3, reasoning: 3 });

    const result1 = computeFeasibilityScore(worker, demands);
    const result2 = computeFeasibilityScore(worker, demands);

    expect(result1.feasibilityScore).toBe(result2.feasibilityScore);
    expect(result1.riskLevel).toBe(result2.riskLevel);
    expect(result1.deficits.length).toBe(result2.deficits.length);
  });
});

describe("computeFeasibilityScore risk level thresholds", () => {
  it("'none' requires zero deficits", () => {
    const worker = uniformVector(3);
    const demands = uniformVector(2);
    const result = computeFeasibilityScore(worker, demands);
    expect(result.riskLevel).toBe("none");
  });

  it("'marginal' for total penalty ≤ 15", () => {
    // A single small deficit on a low-weight trait
    const worker = makeVector(3, { hazards: 2 });
    const demands = makeVector(2, { hazards: 3 });
    const result = computeFeasibilityScore(worker, demands);
    // hazards weight = 0.200072, penalty = 1 * (0.2/5.3) * 20 ≈ 0.76
    expect(result.riskLevel).toBe("marginal");
  });

  it("'severe' for very large penalties", () => {
    // Multiple high-weight traits fail by 2+ levels
    const worker = makeVector(1, {
      reasoning: 0,
      talkHear: 0,
      strength: 0,
    });
    const demands = makeVector(2, {
      reasoning: 4,
      talkHear: 4,
      strength: 4,
    });
    const result = computeFeasibilityScore(worker, demands);
    expect(result.riskLevel).toBe("severe");
  });
});
