/**
 * Confidence Grade Explanation Engine
 *
 * Generates detailed explanations of how the A-D confidence grade
 * was determined, showing which data sources contributed points
 * and which gaps reduced confidence.
 */

import { type STQResult } from "./skill-transfer";
import { type TFQResult } from "./trait-feasibility";
import { type LMQResult } from "./labor-market";

// ─── Interfaces ──────────────────────────────────────────────────────

export interface ConfidenceContribution {
  component: string;
  label: string;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface ConfidenceExplanation {
  grade: "A" | "B" | "C" | "D";
  totalScore: number;
  maxPossible: number;
  contributions: ConfidenceContribution[];
  penalties: ConfidenceContribution[];
  summary: string;
  recommendations: string[]; // what could improve the grade
}

// ─── Grading Thresholds ──────────────────────────────────────────────

const GRADE_THRESHOLDS = {
  A: 7,
  B: 5,
  C: 3,
} as const;

// ─── Main Function ───────────────────────────────────────────────────

/**
 * Generate a detailed explanation of how the confidence grade was determined.
 *
 * Scoring:
 * - STQ: +2 if matched tasks/DWAs, else +1 if STQ > 0
 * - TFQ: +3 if ≥20 traits rated, +2 if ≥15, +1 if ≥10
 * - TFQ penalty: -1 if >10 proxy traits
 * - LMQ: +1 each for employment, wage, projections data
 *
 * Grades: A (≥7), B (5-6), C (3-4), D (<3)
 */
export function explainConfidence(
  stqResult: STQResult,
  tfqResult: TFQResult,
  lmqResult: LMQResult
): ConfidenceExplanation {
  const contributions: ConfidenceContribution[] = [];
  const penalties: ConfidenceContribution[] = [];
  let totalScore = 0;

  // ─── STQ Data Quality ────────────────────────────────────────

  const stqHasMatchedData =
    stqResult.details.matchedTasks.length > 0 ||
    stqResult.details.matchedDWAs.length > 0;

  if (stqHasMatchedData) {
    const matchCount =
      stqResult.details.matchedTasks.length +
      stqResult.details.matchedDWAs.length;
    contributions.push({
      component: "stq",
      label: "Skill Transfer Data",
      points: 2,
      maxPoints: 2,
      reason: `${matchCount} matched task(s)/DWA(s) found between PRW and target`,
    });
    totalScore += 2;
  } else if (stqResult.stq > 0) {
    contributions.push({
      component: "stq",
      label: "Skill Transfer Data",
      points: 1,
      maxPoints: 2,
      reason: "STQ computed but no exact task/DWA matches found (token-level similarity only)",
    });
    totalScore += 1;
  } else {
    contributions.push({
      component: "stq",
      label: "Skill Transfer Data",
      points: 0,
      maxPoints: 2,
      reason: "No skill transfer data available or SVP gate failed",
    });
  }

  // ─── TFQ Data Quality ────────────────────────────────────────

  const ratedTraits = tfqResult.traitComparisons.filter(
    (c) => c.occupationDemand !== null
  );
  const proxyTraits = tfqResult.traitComparisons.filter(
    (c) => c.source === "proxy"
  );
  const ratedCount = ratedTraits.length;
  const proxyCount = proxyTraits.length;

  if (ratedCount >= 20) {
    contributions.push({
      component: "tfq",
      label: "Trait Data Coverage",
      points: 3,
      maxPoints: 3,
      reason: `${ratedCount}/24 traits have occupation demand data (comprehensive coverage)`,
    });
    totalScore += 3;
  } else if (ratedCount >= 15) {
    contributions.push({
      component: "tfq",
      label: "Trait Data Coverage",
      points: 2,
      maxPoints: 3,
      reason: `${ratedCount}/24 traits have occupation demand data (good coverage)`,
    });
    totalScore += 2;
  } else if (ratedCount >= 10) {
    contributions.push({
      component: "tfq",
      label: "Trait Data Coverage",
      points: 1,
      maxPoints: 3,
      reason: `${ratedCount}/24 traits have occupation demand data (moderate coverage)`,
    });
    totalScore += 1;
  } else {
    contributions.push({
      component: "tfq",
      label: "Trait Data Coverage",
      points: 0,
      maxPoints: 3,
      reason: `Only ${ratedCount}/24 traits have occupation demand data (insufficient coverage)`,
    });
  }

  // TFQ proxy penalty
  if (proxyCount > 10) {
    penalties.push({
      component: "tfq_proxy",
      label: "Proxy Trait Penalty",
      points: -1,
      maxPoints: 0,
      reason: `${proxyCount} traits derived from proxy sources (not ORS/DOT/O*NET)`,
    });
    totalScore -= 1;
  }

  // ─── LMQ Data Quality ────────────────────────────────────────

  if (lmqResult.details.employment !== null) {
    contributions.push({
      component: "lmq_employment",
      label: "Employment Data",
      points: 1,
      maxPoints: 1,
      reason: `National employment count available (${lmqResult.details.employment?.toLocaleString()})`,
    });
    totalScore += 1;
  } else {
    contributions.push({
      component: "lmq_employment",
      label: "Employment Data",
      points: 0,
      maxPoints: 1,
      reason: "No national employment data available",
    });
  }

  if (lmqResult.details.medianWage !== null) {
    contributions.push({
      component: "lmq_wage",
      label: "Wage Data",
      points: 1,
      maxPoints: 1,
      reason: `Median wage available ($${lmqResult.details.medianWage?.toLocaleString()}/yr)`,
    });
    totalScore += 1;
  } else {
    contributions.push({
      component: "lmq_wage",
      label: "Wage Data",
      points: 0,
      maxPoints: 1,
      reason: "No wage data available",
    });
  }

  if (lmqResult.details.projectedOpenings !== null) {
    contributions.push({
      component: "lmq_projections",
      label: "Projections Data",
      points: 1,
      maxPoints: 1,
      reason: `Projected openings available (${lmqResult.details.projectedOpenings?.toLocaleString()}/yr)`,
    });
    totalScore += 1;
  } else {
    contributions.push({
      component: "lmq_projections",
      label: "Projections Data",
      points: 0,
      maxPoints: 1,
      reason: "No employment projections data available",
    });
  }

  // ─── Determine Grade ─────────────────────────────────────────

  let grade: "A" | "B" | "C" | "D";
  if (totalScore >= GRADE_THRESHOLDS.A) grade = "A";
  else if (totalScore >= GRADE_THRESHOLDS.B) grade = "B";
  else if (totalScore >= GRADE_THRESHOLDS.C) grade = "C";
  else grade = "D";

  // ─── Recommendations ────────────────────────────────────────

  const recommendations: string[] = [];
  if (!stqHasMatchedData && stqResult.stq === 0) {
    recommendations.push(
      "Add detailed task descriptions to PRW entries to improve skill transfer matching"
    );
  }
  if (ratedCount < 15) {
    recommendations.push(
      `Only ${ratedCount}/24 traits have data. Adding ORS or O*NET data would improve trait coverage`
    );
  }
  if (proxyCount > 10) {
    recommendations.push(
      "Many traits use proxy data. Obtaining ORS survey data for this occupation would increase accuracy"
    );
  }
  if (lmqResult.details.employment === null) {
    recommendations.push(
      "Employment data is missing. Syncing OEWS wage data would provide employment counts"
    );
  }
  if (lmqResult.details.projectedOpenings === null) {
    recommendations.push(
      "Projections data is missing. Syncing BLS projections would provide growth trends"
    );
  }
  if (lmqResult.details.areaEmployment === null) {
    recommendations.push(
      "Area-level employment data is unavailable. Setting the case metro area code would enable regional data"
    );
  }

  // ─── Summary ─────────────────────────────────────────────────

  const maxPossible = 8; // 2 + 3 + 1 + 1 + 1
  const pct = Math.round((Math.max(0, totalScore) / maxPossible) * 100);

  const gradeDescriptions = {
    A: "comprehensive data from primary sources",
    B: "most data available with some proxy-derived values",
    C: "significant data gaps reducing reliability",
    D: "minimal data available — results should be interpreted with caution",
  };

  const summary = `Confidence Grade ${grade} (${totalScore}/${maxPossible} points, ${pct}%): Analysis based on ${gradeDescriptions[grade]}.`;

  return {
    grade,
    totalScore,
    maxPossible,
    contributions,
    penalties,
    summary,
    recommendations,
  };
}
