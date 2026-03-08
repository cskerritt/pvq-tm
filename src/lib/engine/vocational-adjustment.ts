/**
 * Vocational Adjustment Engine (VAQ)
 *
 * Rates the amount of vocational adjustment required in four dimensions:
 * - Tools
 * - Work processes
 * - Work setting
 * - Industry
 *
 * Rating scale:
 * 100 = Very little or none
 *  67 = Slight
 *  33 = Moderate
 *   0 = Substantial
 *
 * For advanced-age SSA cases (closely approaching advanced age or advanced age),
 * anything less than 100 is disqualifying.
 *
 * VAQ = average of the four dimension scores
 */

export type AdjustmentLevel = 100 | 67 | 33 | 0;

export const ADJUSTMENT_LABELS: Record<AdjustmentLevel, string> = {
  100: "Very little or none",
  67: "Slight",
  33: "Moderate",
  0: "Substantial",
};

export type AgeRule = "standard" | "advanced_age" | "closely_approaching";

export interface VocationalAdjustment {
  tools: AdjustmentLevel;
  workProcesses: AdjustmentLevel;
  workSetting: AdjustmentLevel;
  industry: AdjustmentLevel;
}

export interface VAQResult {
  vaq: number;
  passes: boolean;
  disqualifyingReason?: string;
  adjustment: VocationalAdjustment;
  ageRule: AgeRule;
}

/**
 * Compute the Vocational Adjustment Quotient (VAQ).
 *
 * For standard cases: VAQ is the average of the four dimension scores.
 * For advanced-age cases: any score below 100 is disqualifying.
 */
export function computeVAQ(
  adjustment: VocationalAdjustment,
  ageRule: AgeRule = "standard"
): VAQResult {
  const scores: number[] = [
    adjustment.tools,
    adjustment.workProcesses,
    adjustment.workSetting,
    adjustment.industry,
  ];

  const vaq = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  // Advanced age rule: "very little, if any, vocational adjustment"
  if (ageRule === "advanced_age" || ageRule === "closely_approaching") {
    const failingDimensions = [];
    if (adjustment.tools < 100) failingDimensions.push("tools");
    if (adjustment.workProcesses < 100)
      failingDimensions.push("work processes");
    if (adjustment.workSetting < 100) failingDimensions.push("work setting");
    if (adjustment.industry < 100) failingDimensions.push("industry");

    if (failingDimensions.length > 0) {
      return {
        vaq: 0,
        passes: false,
        disqualifyingReason: `Advanced age rule requires very little or no vocational adjustment. Adjustment needed in: ${failingDimensions.join(", ")}`,
        adjustment,
        ageRule,
      };
    }
  }

  return {
    vaq: Math.round(vaq * 100) / 100,
    passes: true,
    adjustment,
    ageRule,
  };
}

/**
 * Create a default adjustment (all substantial = worst case).
 */
export function defaultAdjustment(): VocationalAdjustment {
  return {
    tools: 0,
    workProcesses: 0,
    workSetting: 0,
    industry: 0,
  };
}

// ─── Data-Driven VAQ Auto-Estimation ─────────────────────────────────

interface DOTLikeOcc {
  aptitudes?: Record<string, unknown> | null;
  industryDesig?: string | null;
  workFields?: string[];
  mpsms?: string[];
}

interface ONETLikeOcc {
  toolsTech?: unknown[] | unknown | null;
  tasks?: unknown[] | unknown | null;
}

/**
 * Estimate vocational adjustment ratings from DOT/O*NET data instead of
 * requiring manual evaluator input. Returns data-driven estimates for all
 * four VAQ dimensions.
 *
 * This function is used as a fallback when the evaluator has not yet
 * provided manual ratings. Results are marked as "auto-estimated" so
 * the evaluator can review and override them.
 *
 * Dimensions:
 *   Tools:          O*NET tools/tech overlap between source and target
 *   Work Processes: GOE code similarity between source and target DOT
 *   Work Setting:   Industry designation comparison
 *   Industry:       Broader industry-level comparison
 */
export function estimateVAQ(
  sourceDotOccs: DOTLikeOcc[],
  targetDotOcc: DOTLikeOcc | null,
  sourceOnetOccs: ONETLikeOcc[],
  targetOnetOcc: ONETLikeOcc | null
): VocationalAdjustment & { autoEstimated: true } {
  return {
    tools: estimateToolsAdjustment(sourceOnetOccs, targetOnetOcc),
    workProcesses: estimateWorkProcessesAdjustment(sourceDotOccs, targetDotOcc),
    workSetting: estimateWorkSettingAdjustment(sourceDotOccs, targetDotOcc),
    industry: estimateIndustryAdjustment(sourceDotOccs, targetDotOcc),
    autoEstimated: true,
  };
}

/**
 * Tools adjustment: Compare O*NET tools/technology overlap.
 * >75% overlap → 100 (very little), >50% → 67 (slight),
 * >25% → 33 (moderate), ≤25% → 0 (substantial).
 * No data → 67 (conservative default).
 */
function estimateToolsAdjustment(
  sourceOnetOccs: ONETLikeOcc[],
  targetOnetOcc: ONETLikeOcc | null
): AdjustmentLevel {
  const sourceTools = extractToolNames(sourceOnetOccs);
  const targetTools = extractToolNamesFromOcc(targetOnetOcc);

  if (sourceTools.size === 0 || targetTools.size === 0) return 67;

  const intersection = new Set(
    [...sourceTools].filter((t) => targetTools.has(t))
  );
  // Use the smaller set as denominator for a generous overlap measure
  const denominator = Math.min(sourceTools.size, targetTools.size);
  if (denominator === 0) return 67;

  const overlap = intersection.size / denominator;

  if (overlap > 0.75) return 100;
  if (overlap > 0.5) return 67;
  if (overlap > 0.25) return 33;
  return 0;
}

/**
 * Work Processes adjustment: Compare GOE codes between source and target.
 * Same GOE group (first 4+ chars) → 100, same division (first 2 chars) → 67,
 * different → 33. No GOE data → 67.
 */
function estimateWorkProcessesAdjustment(
  sourceDotOccs: DOTLikeOcc[],
  targetDotOcc: DOTLikeOcc | null
): AdjustmentLevel {
  const sourceGOEs = sourceDotOccs
    .map((d) => extractGOE(d))
    .filter((g): g is string => g !== null);
  const targetGOE = targetDotOcc ? extractGOE(targetDotOcc) : null;

  if (sourceGOEs.length === 0 || !targetGOE) return 67;

  // Check if any source GOE matches at group level (first 4+ chars)
  const targetGroup = targetGOE.substring(0, 4);
  const targetDivision = targetGOE.substring(0, 2);

  const hasGroupMatch = sourceGOEs.some(
    (g) => g.substring(0, 4) === targetGroup
  );
  if (hasGroupMatch) return 100;

  const hasDivisionMatch = sourceGOEs.some(
    (g) => g.substring(0, 2) === targetDivision
  );
  if (hasDivisionMatch) return 67;

  return 33;
}

/**
 * Work Setting adjustment: Compare industry designations.
 * Same industry designation → 100, shares significant words → 67,
 * completely different → 33. No data → 67.
 */
function estimateWorkSettingAdjustment(
  sourceDotOccs: DOTLikeOcc[],
  targetDotOcc: DOTLikeOcc | null
): AdjustmentLevel {
  const sourceIndustries = sourceDotOccs
    .map((d) => d.industryDesig)
    .filter((i): i is string => i !== null && i !== undefined);
  const targetIndustry = targetDotOcc?.industryDesig;

  if (sourceIndustries.length === 0 || !targetIndustry) return 67;

  // Exact match
  if (sourceIndustries.some((i) => i.toLowerCase() === targetIndustry.toLowerCase())) {
    return 100;
  }

  // Word overlap
  const targetWords = significantWords(targetIndustry);
  const hasWordOverlap = sourceIndustries.some((si) => {
    const sourceWords = significantWords(si);
    return [...sourceWords].some((w) => targetWords.has(w));
  });

  if (hasWordOverlap) return 67;

  return 33;
}

/**
 * Industry adjustment: Broader industry-level comparison.
 * Uses the first significant word of industry designation as the "sector."
 * Same sector → 100, any word overlap → 67, different → 33. No data → 67.
 */
function estimateIndustryAdjustment(
  sourceDotOccs: DOTLikeOcc[],
  targetDotOcc: DOTLikeOcc | null
): AdjustmentLevel {
  const sourceIndustries = sourceDotOccs
    .map((d) => d.industryDesig)
    .filter((i): i is string => i !== null && i !== undefined);
  const targetIndustry = targetDotOcc?.industryDesig;

  if (sourceIndustries.length === 0 || !targetIndustry) return 67;

  // Extract primary sector (first significant word)
  const targetSector = primarySector(targetIndustry);
  const sourceSectors = sourceIndustries.map(primarySector);

  // Same primary sector
  if (targetSector && sourceSectors.some((s) => s === targetSector)) {
    return 100;
  }

  // Any word overlap across full industry designations
  const targetWords = significantWords(targetIndustry);
  const hasOverlap = sourceIndustries.some((si) => {
    const sourceWords = significantWords(si);
    return [...sourceWords].some((w) => targetWords.has(w));
  });

  if (hasOverlap) return 67;

  return 33;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function extractGOE(dotOcc: DOTLikeOcc): string | null {
  if (!dotOcc.aptitudes || typeof dotOcc.aptitudes !== "object") return null;
  const apt = dotOcc.aptitudes as Record<string, unknown>;
  const goe = apt.goe;
  return typeof goe === "string" && goe.length > 0 ? goe : null;
}

function extractToolNames(onetOccs: ONETLikeOcc[]): Set<string> {
  const names = new Set<string>();
  for (const occ of onetOccs) {
    const tools = Array.isArray(occ?.toolsTech) ? occ.toolsTech : [];
    for (const t of tools) {
      const name = typeof t === "object" && t !== null
        ? (t as Record<string, unknown>).title ?? (t as Record<string, unknown>).name
        : null;
      if (typeof name === "string") names.add(name.toLowerCase());
    }
  }
  return names;
}

function extractToolNamesFromOcc(occ: ONETLikeOcc | null): Set<string> {
  if (!occ) return new Set();
  return extractToolNames([occ]);
}

/** Extract significant words from an industry designation (skip noise words). */
function significantWords(text: string): Set<string> {
  const noise = new Set([
    "and", "or", "the", "a", "an", "of", "in", "for", "to", "with", "&",
    "n.e.c.", "nec", "any", "ind.", "industry", "mfg.", "mfg",
  ]);
  return new Set(
    text
      .toLowerCase()
      .split(/[\s,;.&]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 1 && !noise.has(w))
  );
}

/** Extract the primary sector from an industry designation. */
function primarySector(text: string): string | null {
  const words = [...significantWords(text)];
  return words.length > 0 ? words[0] : null;
}
