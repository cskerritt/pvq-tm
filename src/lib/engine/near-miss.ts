/**
 * Near-Miss Analysis Engine
 *
 * Analyzes occupations excluded from the viable set and identifies
 * "near misses" — occupations that failed on only 1-2 traits by small
 * margins. These may be reachable through accommodation, retraining,
 * or reassessment.
 *
 * Severity classification:
 *   marginal    = 1 trait fails by ≤1 point
 *   moderate    = 1-2 traits fail by ≤2 points total deficit
 *   significant = 3+ traits or large deficits
 *
 * SVP retraining time estimates:
 *   gap 1 = 3 months
 *   gap 2 = 12 months
 *   gap 3 = 24 months
 *   gap 4+ = 48 months
 */

import { type PVQResult } from "./pvq";
import { type TFQResult } from "./trait-feasibility";
import { type TraitComparison, TRAIT_GROUPS, TRAIT_LABELS } from "./traits";

// ─── Interfaces ────────────────────────────────────────────────────────

export interface NearMissTraitDetail {
  /** Trait key (e.g., "reasoning", "strength") */
  trait: string;
  /** Human-readable label */
  label: string;
  /** Worker's post-injury capacity (0-4 scale) */
  workerCapacity: number;
  /** Occupation's demand level (0-4 scale) */
  occupationDemand: number;
  /** Positive number indicating how much the worker falls short */
  deficit: number;
  /** Which group this trait belongs to */
  traitGroup: "aptitude" | "physical" | "environmental";
  /** Aptitude traits are potentially learnable; physical/environmental usually are not */
  isLearnable: boolean;
}

export interface NearMissOccupation {
  /** Occupation title */
  occupationTitle: string;
  /** DOT code, if available */
  dotCode?: string;
  /** O*NET code, if available */
  onetCode?: string;

  /** Number of traits that failed */
  failedTraitCount: number;
  /** Sum of all negative margins (as a positive number) */
  totalDeficit: number;
  /** Worst single trait gap (as a positive number) */
  maxSingleDeficit: number;
  /** Details for each failing trait */
  failedTraits: NearMissTraitDetail[];

  /** How close was this to passing? */
  severity: "marginal" | "moderate" | "significant";

  /** True if all failures are in learnable (aptitude) traits */
  retrainable: boolean;
  /** Human-readable notes about retraining potential */
  retrainingNotes: string[];

  /** Target SVP minus source SVP; null if not SVP-gated */
  svpGap: number | null;
  /** Estimated months to bridge the SVP gap; null if not SVP-gated */
  svpRetrainingMonths: number | null;
}

export interface NearMissAnalysis {
  /** Total number of excluded occupations analyzed */
  totalExcluded: number;
  /** Near-miss occupations (marginal and moderate only) */
  nearMisses: NearMissOccupation[];
  /** Count of marginal-severity exclusions */
  marginalCount: number;
  /** Count of moderate-severity exclusions */
  moderateCount: number;
  /** Count of significant-severity exclusions */
  significantCount: number;

  /** Most common failing traits across all exclusions, sorted by frequency */
  commonFailingTraits: {
    trait: string;
    label: string;
    count: number;
    group: string;
  }[];

  /** Top 3 traits that cause the most exclusions */
  limitingTraits: string[];
}

// ─── Constants ─────────────────────────────────────────────────────────

const APTITUDE_TRAITS = new Set(TRAIT_GROUPS.aptitudes);
const PHYSICAL_TRAITS = new Set(TRAIT_GROUPS.physical);
const ENVIRONMENTAL_TRAITS = new Set(TRAIT_GROUPS.environmental);

/**
 * SVP gap to estimated retraining months.
 * Based on DOT SVP level time ranges.
 */
const SVP_GAP_MONTHS: Record<number, number> = {
  1: 3,
  2: 12,
  3: 24,
};
const SVP_GAP_MAX_MONTHS = 48;

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Determine which trait group a trait key belongs to.
 */
function getTraitGroup(
  trait: string
): "aptitude" | "physical" | "environmental" {
  if (APTITUDE_TRAITS.has(trait as never)) return "aptitude";
  if (PHYSICAL_TRAITS.has(trait as never)) return "physical";
  if (ENVIRONMENTAL_TRAITS.has(trait as never)) return "environmental";
  // Default to physical if unknown (conservative — not learnable)
  return "physical";
}

/**
 * Aptitude traits are considered potentially learnable through training.
 * Physical and environmental traits generally are not.
 */
function isTraitLearnable(trait: string): boolean {
  return APTITUDE_TRAITS.has(trait as never);
}

/**
 * Estimate retraining months for an SVP gap.
 */
function estimateSvpRetrainingMonths(gap: number): number {
  if (gap <= 0) return 0;
  return SVP_GAP_MONTHS[gap] ?? SVP_GAP_MAX_MONTHS;
}

/**
 * Classify severity based on failed trait count and total deficit.
 *
 * - marginal:    exactly 1 trait fails by ≤1 point
 * - moderate:    1-2 traits fail with total deficit ≤2 points
 * - significant: 3+ traits or large deficits
 */
function classifySeverity(
  failedTraitCount: number,
  totalDeficit: number
): "marginal" | "moderate" | "significant" {
  if (failedTraitCount === 1 && totalDeficit <= 1) return "marginal";
  if (failedTraitCount <= 2 && totalDeficit <= 2) return "moderate";
  return "significant";
}

/**
 * Build a NearMissTraitDetail from a failed TraitComparison.
 */
function buildTraitDetail(comparison: TraitComparison): NearMissTraitDetail {
  const deficit = Math.abs(comparison.margin ?? 0);
  const group = getTraitGroup(comparison.trait);

  return {
    trait: comparison.trait,
    label: comparison.label,
    workerCapacity: comparison.workerCapacity ?? 0,
    occupationDemand: comparison.occupationDemand ?? 0,
    deficit: Math.round(deficit * 100) / 100,
    traitGroup: group,
    isLearnable: isTraitLearnable(comparison.trait),
  };
}

/**
 * Generate human-readable retraining notes for failed traits.
 */
function generateRetrainingNotes(
  failedDetails: NearMissTraitDetail[]
): string[] {
  const notes: string[] = [];

  for (const detail of failedDetails) {
    if (detail.isLearnable) {
      notes.push(
        `${detail.label} deficit of ${detail.deficit} level${detail.deficit !== 1 ? "s" : ""} may be addressed through training`
      );
    } else {
      const kind =
        detail.traitGroup === "physical"
          ? "physical limitation"
          : "environmental tolerance";
      notes.push(
        `${detail.label} deficit of ${detail.deficit} level${detail.deficit !== 1 ? "s" : ""} represents a ${kind} — accommodation may be required`
      );
    }
  }

  return notes;
}

// ─── Main Function ─────────────────────────────────────────────────────

/**
 * Analyze excluded occupations to identify near misses.
 *
 * Examines each excluded occupation's TFQ failed traits, classifies
 * the severity of the exclusion, assesses retrainability, and
 * identifies the most common limiting traits across all exclusions.
 *
 * @param excludedResults - Array of excluded occupation results with PVQ data
 * @returns Near-miss analysis with sorted results and summary statistics
 */
export function analyzeNearMisses(
  excludedResults: Array<{
    pvqResult: PVQResult;
    occupationTitle: string;
    dotCode?: string;
    onetCode?: string;
    targetSvp: number;
    sourceSvp: number;
  }>
): NearMissAnalysis {
  const traitFailCounts = new Map<string, number>();

  let marginalCount = 0;
  let moderateCount = 0;
  let significantCount = 0;

  const allOccupations: NearMissOccupation[] = [];

  for (const entry of excludedResults) {
    const tfqResult: TFQResult = entry.pvqResult.components.tfqResult;
    const failedComparisons = tfqResult.failedTraits;

    // Skip occupations that weren't excluded by trait failure (e.g., SVP or VAQ gate)
    // but still analyze them if they have trait failures alongside other gates
    const failedDetails = failedComparisons.map(buildTraitDetail);
    const failedTraitCount = failedDetails.length;

    // If no trait failures, check for SVP gate failure
    const stqResult = entry.pvqResult.components.stqResult;
    const isSvpGated = !stqResult.passesGate;

    // If no trait failures and no SVP gate, skip (VAQ-only exclusion, not a near miss)
    if (failedTraitCount === 0 && !isSvpGated) continue;

    // Compute deficit metrics from trait failures
    const totalDeficit =
      Math.round(
        failedDetails.reduce((sum, d) => sum + d.deficit, 0) * 100
      ) / 100;
    const maxSingleDeficit =
      failedDetails.length > 0
        ? Math.round(
            Math.max(...failedDetails.map((d) => d.deficit)) * 100
          ) / 100
        : 0;

    // Classify severity based on trait failures
    const severity = classifySeverity(failedTraitCount, totalDeficit);

    // Track trait failure frequencies
    for (const detail of failedDetails) {
      const current = traitFailCounts.get(detail.trait) ?? 0;
      traitFailCounts.set(detail.trait, current + 1);
    }

    // Assess retrainability: all failed traits must be learnable
    const retrainable =
      failedDetails.length > 0 && failedDetails.every((d) => d.isLearnable);
    const retrainingNotes = generateRetrainingNotes(failedDetails);

    // SVP gap analysis
    let svpGap: number | null = null;
    let svpRetrainingMonths: number | null = null;

    if (isSvpGated) {
      svpGap = entry.targetSvp - entry.sourceSvp;
      svpRetrainingMonths = estimateSvpRetrainingMonths(svpGap);
      retrainingNotes.push(
        `SVP gap of ${svpGap}: estimated ${svpRetrainingMonths} months of additional training needed`
      );
    }

    // Tally severity counts
    switch (severity) {
      case "marginal":
        marginalCount++;
        break;
      case "moderate":
        moderateCount++;
        break;
      case "significant":
        significantCount++;
        break;
    }

    allOccupations.push({
      occupationTitle: entry.occupationTitle,
      dotCode: entry.dotCode,
      onetCode: entry.onetCode,
      failedTraitCount,
      totalDeficit,
      maxSingleDeficit,
      failedTraits: failedDetails,
      severity,
      retrainable,
      retrainingNotes,
      svpGap,
      svpRetrainingMonths,
    });
  }

  // Build common failing traits list, sorted by frequency descending
  const commonFailingTraits = Array.from(traitFailCounts.entries())
    .map(([trait, count]) => ({
      trait,
      label: TRAIT_LABELS[trait as keyof typeof TRAIT_LABELS] ?? trait,
      count,
      group: getTraitGroup(trait),
    }))
    .sort((a, b) => b.count - a.count);

  // Top 3 limiting traits
  const limitingTraits = commonFailingTraits.slice(0, 3).map((t) => t.label);

  // Filter to near misses only (marginal and moderate), then sort:
  // 1. marginal before moderate
  // 2. within same severity, lower totalDeficit first
  const severityOrder: Record<string, number> = {
    marginal: 0,
    moderate: 1,
    significant: 2,
  };

  const nearMisses = allOccupations
    .filter((o) => o.severity === "marginal" || o.severity === "moderate")
    .sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.totalDeficit - b.totalDeficit;
    });

  return {
    totalExcluded: excludedResults.length,
    nearMisses,
    marginalCount,
    moderateCount,
    significantCount,
    commonFailingTraits,
    limitingTraits,
  };
}
