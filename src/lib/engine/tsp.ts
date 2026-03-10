/**
 * MVQS Transferable Skills Percent (TSP) Computation
 *
 * The TSP rates target jobs on a 0–97% scale in terms of transferable skills
 * relative to a reference job (typically the evaluee's work history).
 *
 * 5-Tier system based on DOT/O*NET code prefix matching:
 *   Tier 5 (80-97%): High transferable skills
 *   Tier 4 (60-79%): Moderate transferable skills
 *   Tier 3 (40-59%): Low transferable skills
 *   Tier 2 (20-39%): No significant transferable skills (semi-skilled)
 *   Tier 1 (0-19%):  No significant transferable skills (unskilled)
 *
 * TSP capped at 97% — even reentering the same job title requires some
 * new learning (McCroskey, 2015).
 *
 * References:
 *   Grimley, Williams, Hahn, Dennis (2000). Scientific Prediction of
 *     Transferable Skills. JOFV 6(1), pp. 7-16.
 *   McCroskey (2015). The MVQS Theory of Transferable Skills.
 */

import { type TraitKey, type TraitVector, TRAIT_KEYS } from "./traits";

// ─── TSP Tier Definitions ────────────────────────────────────────────────────

export interface TSPTier {
  tier: 1 | 2 | 3 | 4 | 5;
  min: number;
  max: number;
  label: string;
}

export const TSP_TIERS: readonly TSPTier[] = Object.freeze([
  { tier: 1, min: 0, max: 19, label: "Unskilled, no significant transferable skills" },
  { tier: 2, min: 20, max: 39, label: "Semi-skilled to skilled, no significant transferable skills" },
  { tier: 3, min: 40, max: 59, label: "Semi-skilled to skilled, low transferable skills" },
  { tier: 4, min: 60, max: 79, label: "Semi-skilled to skilled, moderate transferable skills" },
  { tier: 5, min: 80, max: 97, label: "Semi-skilled to skilled, high transferable skills" },
]);

// ─── V2 Component Weights (MVQS calibrated) ────────────────────────────────

const W_TRAIT_SIMILARITY = 0.30;
const W_TRAIT_COVERAGE = 0.16;
const W_DOT_PREFIX = 0.14;
const W_ONET_PREFIX = 0.14;
const W_VQ_PROXIMITY = 0.08;
const W_SVP_PROXIMITY = 0.06;
const W_STRENGTH_PROXIMITY = 0.12;

// ─── Input/Output Types ─────────────────────────────────────────────────────

export interface TSPInput {
  // Source (PRW reference job)
  sourceDotCode: string | null;
  sourceOnetCode: string | null;
  sourceTraits: TraitVector;
  sourceVq: number;
  sourceSvp: number;
  sourceStrength: number; // 0-4 normalized

  // Target occupation
  targetDotCode: string | null;
  targetOnetCode: string;
  targetTraits: TraitVector;
  targetVq: number;
  targetSvp: number;
  targetStrength: number; // 0-4 normalized
}

export interface TSPResult {
  tsp: number;            // TSP percentage (0-97)
  tier: 1 | 2 | 3 | 4 | 5;
  qualitativeLabel: string;
  tierReason: string;     // Why this tier was assigned
  components: {
    traitSimilarity: number;     // 0-1
    traitCoverage: number;       // 0-1
    dotPrefixScore: number;      // 0-1
    onetPrefixScore: number;     // 0-1
    vqProximity: number;         // 0-1
    svpProximity: number;        // 0-1
    strengthProximity: number;   // 0-1
    weightedBase: number;        // 0-1
    inTierProgress: number;      // 0-1 (position within tier)
  };
}

// ─── Helper Functions ───────────────────────────────────────────────────────

function clamp01(val: number): number {
  return Math.max(0, Math.min(1, val));
}

/**
 * Get the length of common prefix between two DOT codes.
 * DOT codes are typically 9-digit strings (e.g., "079364010").
 */
function dotPrefixLength(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const cleanA = a.replace(/[^0-9]/g, "");
  const cleanB = b.replace(/[^0-9]/g, "");
  let len = 0;
  const maxLen = Math.min(cleanA.length, cleanB.length);
  for (let i = 0; i < maxLen; i++) {
    if (cleanA[i] === cleanB[i]) len++;
    else break;
  }
  return len;
}

/**
 * Get the length of common prefix between two O*NET SOC codes.
 * O*NET codes like "29-1141.00" are compared as "29-1141" format.
 */
function onetPrefixLength(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  // Strip trailing .XX detail
  const cleanA = a.split(".")[0];
  const cleanB = b.split(".")[0];
  let len = 0;
  const maxLen = Math.min(cleanA.length, cleanB.length);
  for (let i = 0; i < maxLen; i++) {
    if (cleanA[i] === cleanB[i]) len++;
    else break;
  }
  return len;
}

/**
 * Score DOT prefix match as 0-1.
 */
function scoreDotPrefix(source: string | null, target: string | null): number {
  const len = dotPrefixLength(source, target);
  if (len >= 3) return 1.0;
  if (len === 2) return 0.67;
  if (len === 1) return 0.33;
  return 0.0;
}

/**
 * Score O*NET prefix match as 0-1.
 * Full match (all chars): 1.0
 * 4+ character match: 0.75
 * 2+ character match: 0.45
 * Less: 0.0
 */
function scoreOnetPrefix(source: string | null, target: string | null): number {
  if (!source || !target) return 0;
  const cleanA = source.split(".")[0];
  const cleanB = target.split(".")[0];
  if (cleanA === cleanB) return 1.0;
  const len = onetPrefixLength(source, target);
  if (len >= 4) return 0.75;
  if (len >= 2) return 0.45;
  return 0.0;
}

/**
 * Compute trait-level similarity between source and target (0-1).
 * Normalized cosine-like comparison across all 24 traits.
 */
function computeTraitSimilarity(
  source: TraitVector,
  target: TraitVector
): number {
  let totalSim = 0;
  let count = 0;

  for (const key of TRAIT_KEYS) {
    const s = source[key];
    const t = target[key];
    if (s === null || t === null) continue;

    // Per-trait similarity: 1 - |diff| / 4 (since our scale is 0-4)
    const diff = Math.abs(s - t);
    totalSim += clamp01(1 - diff / 4);
    count++;
  }

  return count > 0 ? totalSim / count : 0.5; // neutral if no data
}

/**
 * Compute trait coverage ratio (proportion of target traits met by source).
 */
function computeTraitCoverage(
  source: TraitVector,
  target: TraitVector
): number {
  let meets = 0;
  let total = 0;

  for (const key of TRAIT_KEYS) {
    const s = source[key];
    const t = target[key];
    if (t === null) continue;
    total++;
    if (s !== null && s >= t) meets++;
  }

  return total > 0 ? meets / total : 0.5;
}

// ─── Tier Determination ─────────────────────────────────────────────────────

/**
 * Determine the MVQS TSP Tier using DOT/O*NET prefix matching rules.
 *
 * Tier 5 (80-97%): DOT 3-digit match AND full O*NET match
 * Tier 4 (60-79%): DOT 3 OR O*NET full OR (DOT 2 AND O*NET 4-digit)
 * Tier 3 (40-59%): DOT 2 OR O*NET 4-digit OR (DOT 1 AND O*NET 2-digit)
 * Tier 2 (20-39%): Default, limited overlap
 * Tier 1 (0-19%):  VQ < 85 (unskilled)
 */
function determineTier(input: TSPInput): { tier: 1 | 2 | 3 | 4 | 5; reason: string } {
  // Rule 1: If target VQ < 85, it's unskilled → Tier 1
  if (input.targetVq < 85) {
    return { tier: 1, reason: "Target VQ < 85 (unskilled occupation)" };
  }

  const dotLen = dotPrefixLength(input.sourceDotCode, input.targetDotCode);
  const onetSrcClean = input.sourceOnetCode?.split(".")[0];
  const onetTgtClean = input.targetOnetCode?.split(".")[0];
  const onetFullMatch = onetSrcClean && onetTgtClean && onetSrcClean === onetTgtClean;
  const onetLen = onetPrefixLength(input.sourceOnetCode, input.targetOnetCode);

  // Rule 2: Tier 5 — DOT 3-digit AND full O*NET match
  if (dotLen >= 3 && onetFullMatch) {
    return {
      tier: 5,
      reason: `DOT 3-digit prefix match (${dotLen} digits) AND full O*NET match`,
    };
  }

  // Rule 3: Tier 4 — DOT 3 OR O*NET full OR (DOT 2 AND O*NET 4-digit)
  if (dotLen >= 3) {
    return { tier: 4, reason: `DOT 3-digit prefix match (${dotLen} digits)` };
  }
  if (onetFullMatch) {
    return { tier: 4, reason: "Full O*NET code match" };
  }
  if (dotLen >= 2 && onetLen >= 4) {
    return {
      tier: 4,
      reason: `DOT 2-digit match AND O*NET 4-character match`,
    };
  }

  // Rule 4: Tier 3 — DOT 2 OR O*NET 4-digit OR (DOT 1 AND O*NET 2-digit)
  if (dotLen >= 2) {
    return { tier: 3, reason: `DOT 2-digit prefix match` };
  }
  if (onetLen >= 4) {
    return { tier: 3, reason: `O*NET 4-character prefix match` };
  }
  if (dotLen >= 1 && onetLen >= 2) {
    return {
      tier: 3,
      reason: `DOT 1-digit match AND O*NET 2-character match`,
    };
  }

  // Rule 5: Tier 2 — default, limited overlap
  return { tier: 2, reason: "Limited DOT/O*NET prefix overlap" };
}

// ─── Main TSP Computation ───────────────────────────────────────────────────

/**
 * Compute the MVQS Transferable Skills Percent for a source-target pair.
 */
export function computeTSP(input: TSPInput): TSPResult {
  // Determine tier
  const { tier, reason } = determineTier(input);
  const tierDef = TSP_TIERS.find((t) => t.tier === tier)!;

  // Compute V2 component scores (all 0-1)
  const traitSimilarity = computeTraitSimilarity(input.sourceTraits, input.targetTraits);
  const traitCoverage = computeTraitCoverage(input.sourceTraits, input.targetTraits);
  const dotPrefixScore = scoreDotPrefix(input.sourceDotCode, input.targetDotCode);
  const onetPrefixScore = scoreOnetPrefix(input.sourceOnetCode, input.targetOnetCode);

  const vqProximity = clamp01(1 - Math.abs(input.sourceVq - input.targetVq) / 60);
  const svpProximity = clamp01(1 - Math.abs(input.sourceSvp - input.targetSvp) / 8);
  const strengthProximity = clamp01(
    1 - Math.abs(input.sourceStrength - input.targetStrength) / 4
  );

  // Weighted base score (0-1)
  const weightedBase =
    traitSimilarity * W_TRAIT_SIMILARITY +
    traitCoverage * W_TRAIT_COVERAGE +
    dotPrefixScore * W_DOT_PREFIX +
    onetPrefixScore * W_ONET_PREFIX +
    vqProximity * W_VQ_PROXIMITY +
    svpProximity * W_SVP_PROXIMITY +
    strengthProximity * W_STRENGTH_PROXIMITY;

  // Tier-specific in-tier progress
  // Uses a tier core score weighted more toward structural similarity (DOT/O*NET/VQ/SVP)
  const tierCoreScore =
    dotPrefixScore * 0.38 +
    onetPrefixScore * 0.22 +
    vqProximity * 0.15 +
    svpProximity * 0.10 +
    strengthProximity * 0.15;

  let inTierProgress: number;
  if (tier === 5) {
    inTierProgress = clamp01(tierCoreScore - 0.1);
  } else if (tier === 1) {
    // Unskilled: use weighted base directly but scaled to tier range
    inTierProgress = clamp01(weightedBase);
  } else {
    inTierProgress = clamp01(tierCoreScore - 0.45);
  }

  // Compute final TSP within tier band
  let tsp = tierDef.min + inTierProgress * (tierDef.max - tierDef.min);
  tsp = Math.round(Math.max(0, Math.min(97, tsp)) * 10) / 10;

  return {
    tsp,
    tier,
    qualitativeLabel: tierDef.label,
    tierReason: reason,
    components: {
      traitSimilarity: Math.round(traitSimilarity * 1000) / 1000,
      traitCoverage: Math.round(traitCoverage * 1000) / 1000,
      dotPrefixScore,
      onetPrefixScore,
      vqProximity: Math.round(vqProximity * 1000) / 1000,
      svpProximity: Math.round(svpProximity * 1000) / 1000,
      strengthProximity: Math.round(strengthProximity * 1000) / 1000,
      weightedBase: Math.round(weightedBase * 1000) / 1000,
      inTierProgress: Math.round(inTierProgress * 1000) / 1000,
    },
  };
}

/**
 * Classify a TSP percentage into tier 1-5.
 */
export function classifyTSPTier(tsp: number): 1 | 2 | 3 | 4 | 5 {
  if (tsp >= 80) return 5;
  if (tsp >= 60) return 4;
  if (tsp >= 40) return 3;
  if (tsp >= 20) return 2;
  return 1;
}

/**
 * Get qualitative label for a TSP score.
 */
export function getTSPLabel(tsp: number): string {
  const tier = classifyTSPTier(tsp);
  return TSP_TIERS.find((t) => t.tier === tier)!.label;
}
