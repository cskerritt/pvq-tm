/**
 * PVQ Compositor
 *
 * Combines all four quotients into the final Public Vocational Quotient:
 *
 * PVQ = 0.45×STQ + 0.25×TFQ + 0.15×VAQ + 0.15×LMQ
 *
 * The composite is used only for ranking among already-acceptable occupations.
 * It never overrides the legal rule structure.
 */

import { type STQResult } from "./skill-transfer";
import { type TFQResult } from "./trait-feasibility";
import { type VAQResult } from "./vocational-adjustment";
import { type LMQResult } from "./labor-market";

export interface PVQResult {
  pvq: number;
  stq: number;
  tfq: number;
  vaq: number;
  lmq: number;
  excluded: boolean;
  exclusionReason?: string;
  confidenceGrade: "A" | "B" | "C" | "D";
  components: {
    stqResult: STQResult;
    tfqResult: TFQResult;
    vaqResult: VAQResult;
    lmqResult: LMQResult;
  };
}

export const PVQ_WEIGHTS = {
  stq: 0.45,
  tfq: 0.25,
  vaq: 0.15,
  lmq: 0.15,
} as const;

/**
 * Compute the final Public Vocational Quotient.
 *
 * An occupation is excluded if:
 * - STQ SVP gate fails
 * - TFQ any trait fails
 * - VAQ fails (advanced-age rule)
 */
export function computePVQ(
  stqResult: STQResult,
  tfqResult: TFQResult,
  vaqResult: VAQResult,
  lmqResult: LMQResult
): PVQResult {
  // Check exclusion gates in order
  if (!stqResult.passesGate) {
    return {
      pvq: 0,
      stq: 0,
      tfq: 0,
      vaq: 0,
      lmq: 0,
      excluded: true,
      exclusionReason: stqResult.gateReason ?? "SVP gate failed",
      confidenceGrade: gradeConfidence(stqResult, tfqResult, lmqResult),
      components: { stqResult, tfqResult, vaqResult, lmqResult },
    };
  }

  if (!tfqResult.passes) {
    const failedNames = tfqResult.failedTraits
      .map((t) => t.label)
      .join(", ");
    return {
      pvq: 0,
      stq: stqResult.stq,
      tfq: 0,
      vaq: 0,
      lmq: 0,
      excluded: true,
      exclusionReason: `Post-profile trait failure: ${failedNames}`,
      confidenceGrade: gradeConfidence(stqResult, tfqResult, lmqResult),
      components: { stqResult, tfqResult, vaqResult, lmqResult },
    };
  }

  if (!vaqResult.passes) {
    return {
      pvq: 0,
      stq: stqResult.stq,
      tfq: tfqResult.tfq,
      vaq: 0,
      lmq: 0,
      excluded: true,
      exclusionReason:
        vaqResult.disqualifyingReason ?? "Vocational adjustment too great",
      confidenceGrade: gradeConfidence(stqResult, tfqResult, lmqResult),
      components: { stqResult, tfqResult, vaqResult, lmqResult },
    };
  }

  // Compute weighted composite
  const pvq =
    PVQ_WEIGHTS.stq * stqResult.stq +
    PVQ_WEIGHTS.tfq * tfqResult.tfq +
    PVQ_WEIGHTS.vaq * vaqResult.vaq +
    PVQ_WEIGHTS.lmq * lmqResult.lmq;

  return {
    pvq: Math.round(pvq * 100) / 100,
    stq: stqResult.stq,
    tfq: tfqResult.tfq,
    vaq: vaqResult.vaq,
    lmq: lmqResult.lmq,
    excluded: false,
    confidenceGrade: gradeConfidence(stqResult, tfqResult, lmqResult),
    components: { stqResult, tfqResult, vaqResult, lmqResult },
  };
}

/**
 * Grade the confidence of the result based on data completeness.
 *
 * A = All data from primary sources (ORS + OEWS + O*NET + DOT)
 * B = Most data available, some proxy-derived
 * C = Significant gaps, multiple proxy-derived values
 * D = Minimal data available
 */
function gradeConfidence(
  stqResult: STQResult,
  tfqResult: TFQResult,
  lmqResult: LMQResult
): "A" | "B" | "C" | "D" {
  let score = 0;

  // STQ: check if there were actual matched items
  const stqHasData =
    stqResult.details.matchedTasks.length > 0 ||
    stqResult.details.matchedDWAs.length > 0;
  if (stqHasData) score += 2;
  else if (stqResult.stq > 0) score += 1;

  // TFQ: check how many traits have actual data
  const ratedTraits = tfqResult.traitComparisons.filter(
    (c) => c.occupationDemand !== null
  );
  const proxyTraits = tfqResult.traitComparisons.filter(
    (c) => c.source === "proxy"
  );
  if (ratedTraits.length >= 20) score += 3;
  else if (ratedTraits.length >= 15) score += 2;
  else if (ratedTraits.length >= 10) score += 1;
  if (proxyTraits.length > 10) score -= 1;

  // LMQ: check data availability
  if (lmqResult.details.employment !== null) score += 1;
  if (lmqResult.details.medianWage !== null) score += 1;
  if (lmqResult.details.projectedOpenings !== null) score += 1;

  if (score >= 7) return "A";
  if (score >= 5) return "B";
  if (score >= 3) return "C";
  return "D";
}

/**
 * Rank target occupations by PVQ score.
 * Excluded occupations are placed at the end.
 */
export function rankOccupations(results: PVQResult[]): PVQResult[] {
  return [...results].sort((a, b) => {
    // Non-excluded first
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
    // Then by PVQ descending
    return b.pvq - a.pvq;
  });
}
