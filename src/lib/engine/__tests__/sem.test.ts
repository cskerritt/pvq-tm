import { describe, it, expect } from "vitest";
import {
  computeSTQSEM,
  computeTFQSEM,
  computeVAQSEM,
  computeLMQSEM,
  computePVQSEM,
  computeFullSEM,
  TRAIT_SOURCE_RELIABILITY,
  type TraitSEMComparison,
  type LMQComponents,
  type VAQDimensions,
} from "@/lib/engine/sem";
import { PVQ_WEIGHTS } from "@/lib/engine/pvq";

// ─── STQ SEM ─────────────────────────────────────────────────────────────────

describe("computeSTQSEM", () => {
  it("returns conservative default for single variant", () => {
    expect(computeSTQSEM([72])).toBe(5.0);
  });

  it("returns conservative default for empty array", () => {
    expect(computeSTQSEM([])).toBe(5.0);
  });

  it("computes SD correctly for multiple variants", () => {
    // Variants: [70, 74, 68, 72] → mean=71, variance ~ 6.67, SD ~ 2.58
    const sem = computeSTQSEM([70, 74, 68, 72]);
    expect(sem).toBeCloseTo(2.58, 1);
  });

  it("returns 0 when all variants are identical", () => {
    expect(computeSTQSEM([50, 50, 50])).toBe(0);
  });

  it("handles two variants", () => {
    // [60, 70] → mean=65, variance=50, SD=sqrt(50)~7.07
    const sem = computeSTQSEM([60, 70]);
    expect(sem).toBeCloseTo(7.07, 1);
  });

  it("handles widely spread variants", () => {
    const sem = computeSTQSEM([20, 40, 60, 80]);
    expect(sem).toBeGreaterThan(20);
  });
});

// ─── TFQ SEM ─────────────────────────────────────────────────────────────────

describe("computeTFQSEM", () => {
  const makeComparison = (
    trait: string,
    margin: number,
    source: string = "DOT",
    passes: boolean = true
  ): TraitSEMComparison => ({
    trait,
    workerCapacity: 3,
    occupationDemand: 3 - margin,
    source,
    passes,
    margin,
  });

  it("returns zero SEM for empty comparisons", () => {
    const result = computeTFQSEM([]);
    expect(result.reserveMarginSEM).toBe(0);
    expect(result.flipProbability).toBe(0);
    expect(result.criticalTraits).toEqual([]);
  });

  it("identifies critical traits where margin < SEM", () => {
    // DOT reliability = 0.77, traitSEM = 1.15 * sqrt(1-0.77) ≈ 0.551
    // marginSEM = sqrt(2) * 0.551 ≈ 0.779
    // A trait with margin=0.5 should be critical (0.5 < 0.779)
    // A trait with margin=2.0 should NOT be critical (2.0 > 0.779)
    const comparisons = [
      makeComparison("reasoning", 0.5, "DOT"),
      makeComparison("strength", 2.0, "DOT"),
    ];
    const result = computeTFQSEM(comparisons);
    expect(result.criticalTraits).toContain("reasoning");
    expect(result.criticalTraits).not.toContain("strength");
  });

  it("computes higher SEM for proxy sources", () => {
    const dotComparisons = [
      makeComparison("reasoning", 1.0, "DOT"),
      makeComparison("math", 1.0, "DOT"),
    ];
    const proxyComparisons = [
      makeComparison("reasoning", 1.0, "proxy"),
      makeComparison("math", 1.0, "proxy"),
    ];

    const dotResult = computeTFQSEM(dotComparisons);
    const proxyResult = computeTFQSEM(proxyComparisons);

    expect(proxyResult.reserveMarginSEM).toBeGreaterThan(
      dotResult.reserveMarginSEM
    );
  });

  it("flip probability is fraction of critical traits", () => {
    // All traits with small margins should all be critical
    const comparisons = [
      makeComparison("reasoning", 0.1, "DOT"),
      makeComparison("math", 0.1, "DOT"),
      makeComparison("language", 0.1, "DOT"),
      makeComparison("strength", 3.0, "DOT"), // not critical
    ];
    const result = computeTFQSEM(comparisons);
    expect(result.flipProbability).toBe(0.75); // 3 out of 4
  });

  it("handles mixed sources correctly", () => {
    const comparisons = [
      makeComparison("reasoning", 1.0, "ORS"),
      makeComparison("math", 1.0, "ONET"),
      makeComparison("language", 1.0, "proxy"),
    ];
    const result = computeTFQSEM(comparisons);
    expect(result.reserveMarginSEM).toBeGreaterThan(0);
  });

  it("uses default reliability for unknown source", () => {
    const comparisons = [
      makeComparison("reasoning", 1.0, "UNKNOWN_SOURCE"),
    ];
    const result = computeTFQSEM(comparisons);
    // Should use proxy default (0.60) → higher SEM
    expect(result.reserveMarginSEM).toBeGreaterThan(0);
  });
});

// ─── VAQ SEM ─────────────────────────────────────────────────────────────────

describe("computeVAQSEM", () => {
  const dims: VAQDimensions = {
    tools: 100,
    workProcesses: 67,
    workSetting: 67,
    industry: 33,
  };

  it("returns positive SEM", () => {
    const result = computeVAQSEM(dims, false);
    expect(result.vaqSEM).toBeGreaterThan(0);
  });

  it("auto-estimated has higher SEM than evaluator-rated", () => {
    const evaluator = computeVAQSEM(dims, false);
    const auto = computeVAQSEM(dims, true);
    expect(auto.vaqSEM).toBeGreaterThan(evaluator.vaqSEM);
  });

  it("dimension sensitivity is uniform at 8.25", () => {
    const result = computeVAQSEM(dims, false);
    expect(result.dimensionSensitivity.tools).toBeCloseTo(8.25, 2);
    expect(result.dimensionSensitivity.workProcesses).toBeCloseTo(8.25, 2);
    expect(result.dimensionSensitivity.workSetting).toBeCloseTo(8.25, 2);
    expect(result.dimensionSensitivity.industry).toBeCloseTo(8.25, 2);
  });

  it("evaluator-rated VAQ SEM uses kappa ~0.65", () => {
    // dimSEM = 33 * sqrt(1 - 0.65) = 33 * sqrt(0.35) ≈ 19.52
    // vaqSEM = 19.52 / 2 ≈ 9.76
    const result = computeVAQSEM(dims, false);
    expect(result.vaqSEM).toBeCloseTo(9.76, 0);
  });

  it("auto-estimated VAQ SEM uses reliability ~0.55", () => {
    // dimSEM = 33 * sqrt(1 - 0.55) = 33 * sqrt(0.45) ≈ 22.13
    // vaqSEM = 22.13 / 2 ≈ 11.07
    const result = computeVAQSEM(dims, true);
    expect(result.vaqSEM).toBeCloseTo(11.07, 0);
  });
});

// ─── LMQ SEM ─────────────────────────────────────────────────────────────────

describe("computeLMQSEM", () => {
  const fullComponents: LMQComponents = {
    employmentScore: 70,
    wageScore: 80,
    projectionsScore: 60,
    joltsScore: 55,
    localDemandScore: 65,
  };

  it("returns positive SEM for full components", () => {
    const sem = computeLMQSEM(fullComponents);
    expect(sem).toBeGreaterThan(0);
  });

  it("uses provided RSE when available", () => {
    const defaultSEM = computeLMQSEM(fullComponents);
    const lowRSE = computeLMQSEM(fullComponents, {
      employment: 2,
      wage: 1,
    });
    expect(lowRSE).toBeLessThan(defaultSEM);
  });

  it("handles missing optional components", () => {
    const coreOnly: LMQComponents = {
      employmentScore: 70,
      wageScore: 80,
      projectionsScore: 60,
      joltsScore: null,
      localDemandScore: null,
    };
    const sem = computeLMQSEM(coreOnly);
    expect(sem).toBeGreaterThan(0);
  });

  it("returns zero when all scores are zero", () => {
    const zeroComponents: LMQComponents = {
      employmentScore: 0,
      wageScore: 0,
      projectionsScore: 0,
      joltsScore: 0,
      localDemandScore: 0,
    };
    expect(computeLMQSEM(zeroComponents)).toBe(0);
  });

  it("higher scores with same RSE produce higher absolute SEM", () => {
    const lowScores: LMQComponents = {
      employmentScore: 30,
      wageScore: 30,
      projectionsScore: 30,
      joltsScore: null,
      localDemandScore: null,
    };
    const highScores: LMQComponents = {
      employmentScore: 90,
      wageScore: 90,
      projectionsScore: 90,
      joltsScore: null,
      localDemandScore: null,
    };
    expect(computeLMQSEM(highScores)).toBeGreaterThan(
      computeLMQSEM(lowScores)
    );
  });
});

// ─── PVQ Composite SEM ──────────────────────────────────────────────────────

describe("computePVQSEM", () => {
  it("computes correct weighted error propagation", () => {
    const componentSEMs = {
      stqSEM: 5,
      tfqSEM: 4,
      vaqSEM: 10,
      lmqSEM: 3,
    };

    const result = computePVQSEM(componentSEMs, 60);

    // Manual calculation:
    // PVQ_SEM = sqrt(0.45^2*5^2 + 0.25^2*4^2 + 0.15^2*10^2 + 0.15^2*3^2)
    //         = sqrt(0.2025*25 + 0.0625*16 + 0.0225*100 + 0.0225*9)
    //         = sqrt(5.0625 + 1.0 + 2.25 + 0.2025)
    //         = sqrt(8.515)
    //         ≈ 2.918
    expect(result.pvqSEM).toBeCloseTo(2.92, 1);
  });

  it("CI90 uses 1.645 multiplier", () => {
    const result = computePVQSEM(
      { stqSEM: 5, tfqSEM: 4, vaqSEM: 10, lmqSEM: 3 },
      60
    );

    const expectedLow = 60 - 1.645 * result.pvqSEM;
    const expectedHigh = 60 + 1.645 * result.pvqSEM;

    expect(result.ci90[0]).toBeCloseTo(expectedLow, 1);
    expect(result.ci90[1]).toBeCloseTo(expectedHigh, 1);
  });

  it("CI95 uses 1.96 multiplier", () => {
    const result = computePVQSEM(
      { stqSEM: 5, tfqSEM: 4, vaqSEM: 10, lmqSEM: 3 },
      60
    );

    const expectedLow = 60 - 1.96 * result.pvqSEM;
    const expectedHigh = 60 + 1.96 * result.pvqSEM;

    expect(result.ci95[0]).toBeCloseTo(expectedLow, 1);
    expect(result.ci95[1]).toBeCloseTo(expectedHigh, 1);
  });

  it("CI is clamped to [0, 100]", () => {
    // Very high SEM with low PVQ should clamp lower bound to 0
    const result = computePVQSEM(
      { stqSEM: 50, tfqSEM: 50, vaqSEM: 50, lmqSEM: 50 },
      5
    );
    expect(result.ci90[0]).toBe(0);
    expect(result.ci95[0]).toBe(0);

    // High PVQ should clamp upper bound to 100
    const result2 = computePVQSEM(
      { stqSEM: 50, tfqSEM: 50, vaqSEM: 50, lmqSEM: 50 },
      95
    );
    expect(result2.ci90[1]).toBe(100);
    expect(result2.ci95[1]).toBe(100);
  });

  it("returns zero SEM when all component SEMs are zero", () => {
    const result = computePVQSEM(
      { stqSEM: 0, tfqSEM: 0, vaqSEM: 0, lmqSEM: 0 },
      60
    );
    expect(result.pvqSEM).toBe(0);
    expect(result.ci90[0]).toBe(60);
    expect(result.ci90[1]).toBe(60);
  });

  it("STQ contributes most to PVQ SEM due to highest weight", () => {
    // Same component SEM but STQ has 0.45 weight
    const baseline = computePVQSEM(
      { stqSEM: 10, tfqSEM: 10, vaqSEM: 10, lmqSEM: 10 },
      60
    );

    // Double only STQ SEM
    const stqDoubled = computePVQSEM(
      { stqSEM: 20, tfqSEM: 10, vaqSEM: 10, lmqSEM: 10 },
      60
    );

    // Double only LMQ SEM (weight 0.15)
    const lmqDoubled = computePVQSEM(
      { stqSEM: 10, tfqSEM: 10, vaqSEM: 10, lmqSEM: 20 },
      60
    );

    // STQ doubling should increase PVQ SEM more than LMQ doubling
    const stqIncrease = stqDoubled.pvqSEM - baseline.pvqSEM;
    const lmqIncrease = lmqDoubled.pvqSEM - baseline.pvqSEM;
    expect(stqIncrease).toBeGreaterThan(lmqIncrease);
  });
});

// ─── Full SEM Analysis ──────────────────────────────────────────────────────

describe("computeFullSEM", () => {
  it("computes all components in one call", () => {
    const result = computeFullSEM({
      stqVariants: [65, 70, 68],
      traitComparisons: [
        {
          trait: "reasoning",
          workerCapacity: 3,
          occupationDemand: 2,
          source: "DOT",
          passes: true,
          margin: 1,
        },
        {
          trait: "strength",
          workerCapacity: 2,
          occupationDemand: 2,
          source: "ORS",
          passes: true,
          margin: 0,
        },
      ],
      vaqDimensions: {
        tools: 100,
        workProcesses: 67,
        workSetting: 67,
        industry: 33,
      },
      vaqAutoEstimated: false,
      lmqComponents: {
        employmentScore: 70,
        wageScore: 80,
        projectionsScore: 60,
        joltsScore: null,
        localDemandScore: null,
      },
      pvqScore: 55,
    });

    expect(result.stq.sem).toBeGreaterThan(0);
    expect(result.tfq.reserveMarginSEM).toBeGreaterThan(0);
    expect(result.vaq.vaqSEM).toBeGreaterThan(0);
    expect(result.lmq.sem).toBeGreaterThan(0);
    expect(result.pvq.pvqSEM).toBeGreaterThan(0);
    expect(result.pvq.ci90[0]).toBeLessThan(55);
    expect(result.pvq.ci90[1]).toBeGreaterThan(55);
    expect(result.pvq.ci95[0]).toBeLessThan(result.pvq.ci90[0]);
    expect(result.pvq.ci95[1]).toBeGreaterThan(result.pvq.ci90[1]);
  });
});

// ─── Reliability Coefficients ───────────────────────────────────────────────

describe("TRAIT_SOURCE_RELIABILITY", () => {
  it("has entries for all expected sources", () => {
    expect(TRAIT_SOURCE_RELIABILITY).toHaveProperty("ORS");
    expect(TRAIT_SOURCE_RELIABILITY).toHaveProperty("DOT");
    expect(TRAIT_SOURCE_RELIABILITY).toHaveProperty("ONET");
    expect(TRAIT_SOURCE_RELIABILITY).toHaveProperty("DPT_PROXY");
    expect(TRAIT_SOURCE_RELIABILITY).toHaveProperty("SVP_PROXY");
    expect(TRAIT_SOURCE_RELIABILITY).toHaveProperty("proxy");
  });

  it("all coefficients are between 0 and 1", () => {
    for (const [, data] of Object.entries(TRAIT_SOURCE_RELIABILITY)) {
      expect(data.coefficient).toBeGreaterThan(0);
      expect(data.coefficient).toBeLessThanOrEqual(1);
    }
  });

  it("all entries have non-empty citations", () => {
    for (const [, data] of Object.entries(TRAIT_SOURCE_RELIABILITY)) {
      expect(data.citation.length).toBeGreaterThan(10);
    }
  });

  it("primary sources have higher reliability than proxies", () => {
    expect(TRAIT_SOURCE_RELIABILITY.ORS.coefficient).toBeGreaterThan(
      TRAIT_SOURCE_RELIABILITY.proxy.coefficient
    );
    expect(TRAIT_SOURCE_RELIABILITY.DOT.coefficient).toBeGreaterThan(
      TRAIT_SOURCE_RELIABILITY.proxy.coefficient
    );
    expect(TRAIT_SOURCE_RELIABILITY.ONET.coefficient).toBeGreaterThan(
      TRAIT_SOURCE_RELIABILITY.proxy.coefficient
    );
  });

  it("DOT lower bound matches Cain & Green (1983)", () => {
    // Cain & Green reported reliabilities from .77 to .98
    expect(TRAIT_SOURCE_RELIABILITY.DOT.coefficient).toBe(0.77);
  });
});
