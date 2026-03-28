/**
 * PVQ Compositor
 *
 * The primary scoring system is now VQ-centric (McCroskey VQS methodology).
 * The PVQ composite (0.45×STQ + 0.25×TFQ + 0.15×VAQ + 0.15×LMQ) is
 * retained for backward compatibility but deprecated in favor of
 * computeUnifiedScore() which uses VQ as the primary score with
 * continuous feasibility assessment.
 *
 * Reference: McCroskey, B.J. (2011). VQS Manual and Quick Start Tutorial.
 */

import { type STQResult } from "./skill-transfer";
import { type TFQResult, type AnalysisMode } from "./trait-feasibility";
import {
  type FeasibilityResult,
  type RiskLevel,
  type TraitDeficit,
} from "./trait-feasibility";
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
  /** Analysis mode used (strict = SSA/litigation, clinical = rehabilitation) */
  analysisMode?: AnalysisMode;
  /** True when VAQ is auto-estimated and needs evaluator confirmation */
  pendingEvaluatorReview?: boolean;
  /** True when this occupation has tolerated marginal trait failures (clinical mode) */
  hasTolerations?: boolean;
  /** Standard Error of Measurement for each component and the composite */
  sem?: {
    stq: number;
    tfq: {
      reserveMarginSEM: number;
      flipProbability: number;
      criticalTraits: string[];
    };
    vaq: number;
    lmq: number;
    pvq: number;
    ci90: [number, number];
    ci95: [number, number];
  };
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
 * - TFQ trait gate fails (strict: any failure; clinical: >1 marginal or any severe)
 * - VAQ fails (advanced-age rule, unless auto-estimated → pending review)
 *
 * When analysis mode is "clinical", the TFQ tolerance for marginal failures
 * allows more occupations through the gate, producing a richer viable set
 * for rehabilitation planning.
 */
export function computePVQ(
  stqResult: STQResult,
  tfqResult: TFQResult,
  vaqResult: VAQResult,
  lmqResult: LMQResult
): PVQResult {
  const analysisMode = tfqResult.analysisMode ?? "strict";

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
      analysisMode,
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
      analysisMode,
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
      analysisMode,
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
    analysisMode,
    pendingEvaluatorReview: vaqResult.pendingEvaluatorReview,
    hasTolerations: (tfqResult.toleratedFailures?.length ?? 0) > 0,
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
 * @deprecated Use rankByUnifiedScore() instead.
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

// ─── VQ-Centric Unified Scoring ─────────────────────────────────────────

/**
 * Unified score result combining VQS primary scoring with
 * continuous feasibility assessment and supplementary PVQ-TM data.
 *
 * Data hierarchy:
 *   Level 1 (Primary): VQ, VQ Band, TSP, EC — from published VQS methodology
 *   Level 2 (Feasibility): feasibilityScore, riskLevel, deficits — continuous assessment
 *   Level 3 (Supplementary): STQ, LMQ, VAQ — PVQ-TM enrichment
 *   Level 4 (Legacy): pvqLegacy — deprecated PVQ composite
 */
export interface UnifiedScoreResult {
  // ─── Feasibility Assessment (replaces binary exclusion) ────
  feasibilityScore: number; // 0-100 continuous
  riskLevel: RiskLevel;
  deficits: TraitDeficit[];

  // ─── Supplementary (PVQ-TM additions) ──────────────────────
  stq: number;
  lmq: number;
  vaq: number;
  confidenceGrade: "A" | "B" | "C" | "D";

  // ─── Legacy (backward compatibility) ───────────────────────
  pvqLegacy: number; // old PVQ composite, kept for migration
  excluded: boolean; // derived from riskLevel for backward compat
  exclusionReason?: string;

  // ─── Component references ──────────────────────────────────
  feasibility: FeasibilityResult;
  components: {
    stqResult: STQResult;
    tfqResult: TFQResult;
    vaqResult: VAQResult;
    lmqResult: LMQResult;
  };
}

/**
 * Compute unified score using VQ-centric methodology.
 *
 * Unlike computePVQ() which uses binary exclusion gates, this produces
 * a continuous feasibility assessment alongside the component scores.
 * No occupation is ever "excluded" from scoring — risk levels are
 * informational flags, not gates.
 *
 * The legacy PVQ composite is still computed for backward compatibility
 * but should not be used as the primary ranking score. Use VQ (from
 * computeVQ()) as the primary score, with feasibilityScore as the
 * secondary sort criterion.
 */
export function computeUnifiedScore(
  stqResult: STQResult,
  tfqResult: TFQResult,
  vaqResult: VAQResult,
  lmqResult: LMQResult,
  feasibility: FeasibilityResult
): UnifiedScoreResult {
  // Compute legacy PVQ composite (for backward compat)
  const pvqLegacy =
    Math.round(
      (PVQ_WEIGHTS.stq * stqResult.stq +
        PVQ_WEIGHTS.tfq * tfqResult.tfq +
        PVQ_WEIGHTS.vaq * vaqResult.vaq +
        PVQ_WEIGHTS.lmq * lmqResult.lmq) *
        100
    ) / 100;

  // Derive legacy excluded flag from risk level for backward compat
  const excluded = feasibility.riskLevel === "severe";
  const exclusionReason =
    excluded && feasibility.deficits.length > 0
      ? `Trait deficits: ${feasibility.deficits.map((d) => d.label).join(", ")}`
      : undefined;

  return {
    feasibilityScore: feasibility.feasibilityScore,
    riskLevel: feasibility.riskLevel,
    deficits: feasibility.deficits,
    stq: stqResult.stq,
    lmq: lmqResult.lmq,
    vaq: vaqResult.vaq,
    confidenceGrade: gradeConfidence(stqResult, tfqResult, lmqResult),
    pvqLegacy,
    excluded,
    exclusionReason,
    feasibility,
    components: { stqResult, tfqResult, vaqResult, lmqResult },
  };
}

/**
 * Rank occupations using VQ-centric methodology.
 * Primary sort: feasibility score descending (all occupations included).
 * Secondary sort: STQ descending (skill transfer relevance).
 *
 * Note: VQ score is not included here because it measures job difficulty,
 * not worker-job fit. VQ should be used for earnings capacity classification,
 * not as a ranking criterion.
 */
export function rankByUnifiedScore(
  results: UnifiedScoreResult[]
): UnifiedScoreResult[] {
  return [...results].sort((a, b) => {
    // Primary: feasibility score descending
    const fDiff = b.feasibilityScore - a.feasibilityScore;
    if (Math.abs(fDiff) > 0.01) return fDiff;
    // Secondary: STQ descending
    return b.stq - a.stq;
  });
}
