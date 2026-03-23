/**
 * Component Profile Code (CPC) Candidate Generation
 *
 * Uses the 237-dimensional occupation fingerprint system to find
 * candidate occupations based on component similarity rather than
 * DOT/O*NET relationship matrices.
 *
 * Incorporates:
 * - O*NET component fingerprints (knowledge, skills, abilities, work activities,
 *   work context, work styles)
 * - ORS physical/environmental demands (priority source per VDARE methodology)
 * - OEWS employment and wage data (labor market context)
 *
 * This enables finding structurally similar occupations even when traditional
 * DOT work field / O*NET related-occupation searches produce thin results,
 * supporting complete report generation in all cases.
 */

import {
  buildFingerprintIndex,
  cosineSimilarity,
  l2Normalize,
  analyzeComponentOverlap,
  generateCPCFromVector,
  getCanonicalOrder,
  jobZoneToMaxSvp,
  profileBreadth,
  FINGERPRINT_DIMENSIONS,
  TAXONOMY_RANGES,
  type OccupationFingerprint,
  type CPCSimilarityResult,
  type ComponentDetail,
  type ComponentProfileCode,
} from "./component-profile";

// ─── Types ───────────────────────────────────────────────────────────

export interface WorkerComponentProfile {
  /** L2-normalized composite fingerprint (average of PRW occupations) */
  compositeVector: Float64Array;
  /** Human-readable CPC code */
  cpc: ComponentProfileCode;
  /** Individual PRW occupation fingerprints */
  prwFingerprints: { onetCode: string; title: string }[];
  /** Maximum SVP from PRW history */
  maxSvp: number;
  /** Post-injury strength capacity (0-4 scale) */
  postStrength: number | null;
  /** Profile breadth assessment */
  breadth: { stdDev: number; label: "narrow" | "moderate" | "broad" };
  /** Top worker components (strongest dimensions) */
  topComponents: ComponentDetail[];
}

export interface CPCCandidateOptions {
  /** Maximum number of results (default: 30) */
  topN?: number;
  /** Maximum SVP gate (from PRW). Null = no SVP filter */
  maxSvp?: number | null;
  /** Post-injury strength level (0-4). Null = no strength filter */
  postStrength?: number | null;
  /** Minimum cosine similarity threshold (default: 0.3) */
  minSimilarity?: number;
  /** Whether to relax SVP gate by +1 level (for zero-viable fallback) */
  relaxSvp?: boolean;
  /** Exclude these O*NET codes (already evaluated as traditional candidates) */
  excludeCodes?: Set<string>;
}

export interface CPCAnalysis {
  /** Worker's component profile */
  workerProfile: {
    cpc: ComponentProfileCode;
    breadth: { stdDev: number; label: string };
    topComponents: ComponentDetail[];
    prwOccupations: { onetCode: string; title: string }[];
  };
  /** Top similar occupations by component profile */
  similarOccupations: CPCSimilarityResult[];
  /** Component gap analysis */
  gapAnalysis: {
    /** Worker's strongest components (top 10) */
    workerStrengths: ComponentDetail[];
    /** Most common market demands that worker lacks */
    marketGaps: ComponentDetail[];
    /** Profile breadth assessment */
    profileBreadth: string;
    /** Narrative summary */
    narrative: string;
  };
  /** OEWS labor market summary for CPC matches */
  laborMarketSummary: {
    /** Total employment across top CPC matches */
    totalEmployment: number;
    /** Median wage range across matches */
    wageRange: { min: number | null; max: number | null; median: number | null };
    /** Count of matches with OEWS data */
    withOEWSData: number;
  };
}

// ─── Worker Component Profile Builder ────────────────────────────────

/**
 * Build a worker's composite component profile from their PRW occupations.
 *
 * Per VDARE methodology, the worker's profile reflects demonstrated capacity
 * from all past relevant work. The composite fingerprint averages the
 * component vectors of all PRW occupations, then L2-normalizes.
 */
export async function buildWorkerComponentProfile(
  prwOnetCodes: string[],
  maxSvp: number,
  postStrength: number | null = null
): Promise<WorkerComponentProfile> {
  const index = await buildFingerprintIndex();

  const prwFingerprints: { onetCode: string; title: string }[] = [];
  const vectors: Float64Array[] = [];

  for (const code of prwOnetCodes) {
    const fp = index.get(code);
    if (fp) {
      prwFingerprints.push({ onetCode: code, title: fp.title });
      vectors.push(fp.vector);
    } else {
      // Try common format variations: "XX-XXXX.00" vs "XX-XXXX"
      const variations = [
        code.includes(".") ? code.split(".")[0] : `${code}.00`,
        code.replace(/\.0+$/, ".00"),
      ];
      let found = false;
      for (const variant of variations) {
        const fpV = index.get(variant);
        if (fpV) {
          prwFingerprints.push({ onetCode: variant, title: fpV.title });
          vectors.push(fpV.vector);
          console.log(`[CPC] PRW code "${code}" not in index, matched variant "${variant}"`);
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn(`[CPC] PRW O*NET code "${code}" not found in fingerprint index — worker profile will be incomplete`);
      }
    }
  }

  // Average all PRW fingerprint vectors element-wise
  const composite = new Float64Array(FINGERPRINT_DIMENSIONS);
  if (vectors.length > 0) {
    for (const vec of vectors) {
      for (let i = 0; i < FINGERPRINT_DIMENSIONS; i++) {
        composite[i] += vec[i];
      }
    }
    for (let i = 0; i < FINGERPRINT_DIMENSIONS; i++) {
      composite[i] /= vectors.length;
    }
  }

  // L2-normalize the composite
  l2Normalize(composite);

  // Determine strength for CPC code
  const strMap: Record<number, string> = { 0: "S", 1: "L", 2: "M", 3: "H", 4: "V" };
  const strengthLabel = postStrength !== null ? (strMap[postStrength] ?? "?") : "?";

  // Estimate job zone from max SVP
  let estimatedJZ = 3;
  if (maxSvp <= 2) estimatedJZ = 1;
  else if (maxSvp <= 4) estimatedJZ = 2;
  else if (maxSvp <= 6) estimatedJZ = 3;
  else if (maxSvp <= 7) estimatedJZ = 4;
  else estimatedJZ = 5;

  const cpc = generateCPCFromVector(composite, estimatedJZ, strengthLabel);
  const breadth = profileBreadth(composite);

  // Extract top worker components
  const topComponents = extractTopComponents(composite, 10);

  return {
    compositeVector: composite,
    cpc,
    prwFingerprints,
    maxSvp,
    postStrength,
    breadth,
    topComponents,
  };
}

/**
 * Extract the top N strongest components from a fingerprint vector.
 */
function extractTopComponents(
  vector: Float64Array,
  topN: number
): ComponentDetail[] {
  const entries: { idx: number; score: number }[] = [];
  for (let i = 0; i < FINGERPRINT_DIMENSIONS; i++) {
    if (vector[i] > 0) {
      entries.push({ idx: i, score: vector[i] });
    }
  }
  entries.sort((a, b) => b.score - a.score);

  // Safe to call since buildFingerprintIndex ensures canonical order is initialized
  let canonicalOrder: string[];
  try {
    canonicalOrder = getCanonicalOrder();
  } catch {
    return [];
  }

  return entries.slice(0, topN).map((e) => {
    const id = canonicalOrder[e.idx];
    const taxonomy = getTaxonomyForIndex(e.idx);
    return {
      id,
      name: id, // Will be resolved by component-profile module
      taxonomy,
      score: e.score,
    };
  });
}

function getTaxonomyForIndex(idx: number): string {
  for (const [name, range] of Object.entries(TAXONOMY_RANGES)) {
    if (idx >= range.start && idx < range.start + range.count) {
      return name;
    }
  }
  return "unknown";
}

// ─── CPC Candidate Search ────────────────────────────────────────────

/**
 * Generate candidate occupations based on component profile similarity.
 *
 * Searches all 1016 O*NET occupations, applying SVP and strength gates,
 * then ranks by cosine similarity to the worker's composite fingerprint.
 *
 * Incorporates OEWS data (employment, wages) in results for labor market context.
 */
export async function generateCPCCandidates(
  workerProfile: WorkerComponentProfile,
  options: CPCCandidateOptions = {}
): Promise<CPCSimilarityResult[]> {
  const {
    topN = 30,
    maxSvp = workerProfile.maxSvp,
    postStrength = workerProfile.postStrength,
    minSimilarity = 0.3,
    relaxSvp = false,
    excludeCodes = new Set<string>(),
  } = options;

  const index = await buildFingerprintIndex();
  const results: CPCSimilarityResult[] = [];

  const effectiveMaxSvp = maxSvp
    ? relaxSvp
      ? maxSvp + 1
      : maxSvp
    : 9;

  for (const [code, fp] of index) {
    // Skip excluded codes (already traditional candidates)
    if (excludeCodes.has(code)) continue;

    // SVP gate: occupation's job zone must map to SVP ≤ worker's max
    const occSvp = jobZoneToMaxSvp(fp.jobZone);
    if (occSvp > effectiveMaxSvp) continue;

    // Strength gate: if worker has post-injury strength limit, skip occupations
    // that require more strength (using ORS data if available)
    if (postStrength !== null && fp.orsTraits?.["ors_strength"] !== undefined) {
      if (fp.orsTraits["ors_strength"] > postStrength) continue;
    }

    // Compute cosine similarity
    const similarity = cosineSimilarity(workerProfile.compositeVector, fp.vector);
    if (similarity < minSimilarity) continue;

    // Analyze component overlap
    const { matching, gaps } = analyzeComponentOverlap(
      workerProfile.compositeVector,
      fp.vector,
      5
    );

    results.push({
      onetCode: code,
      title: fp.title,
      cosineSimilarity: Math.round(similarity * 10000) / 10000,
      topMatchingComponents: matching,
      topGapComponents: gaps,
      cpc: fp.cpc,
      jobZone: fp.jobZone,
      strength: fp.cpc.strength,
      employment: fp.oewsData?.employment ?? null,
      medianWage: fp.oewsData?.medianWage ?? null,
    });
  }

  // Sort by cosine similarity descending
  results.sort((a, b) => b.cosineSimilarity - a.cosineSimilarity);

  return results.slice(0, topN);
}

// ─── Gap Analysis ────────────────────────────────────────────────────

/**
 * Compute the component gap analysis between worker profile and the labor market.
 *
 * Identifies:
 * - Worker's strongest components (what they bring to the table)
 * - Market gaps (demanded components the worker is weak in)
 * - Profile breadth assessment
 * - Narrative summary incorporating OEWS labor market data
 */
export function computeGapAnalysis(
  workerProfile: WorkerComponentProfile,
  cpcResults: CPCSimilarityResult[]
): CPCAnalysis["gapAnalysis"] {
  // Worker's top strengths (already computed)
  const workerStrengths = workerProfile.topComponents;

  // Market gaps: aggregate the gap components across top CPC matches
  const gapCounts = new Map<string, { detail: ComponentDetail; count: number; totalGap: number }>();
  for (const result of cpcResults.slice(0, 15)) {
    for (const gap of result.topGapComponents) {
      const existing = gapCounts.get(gap.id);
      if (existing) {
        existing.count++;
        existing.totalGap += gap.score;
      } else {
        gapCounts.set(gap.id, { detail: gap, count: 1, totalGap: gap.score });
      }
    }
  }

  // Sort by frequency × total gap
  const marketGaps = [...gapCounts.values()]
    .sort((a, b) => b.count * b.totalGap - a.count * a.totalGap)
    .slice(0, 10)
    .map((g) => g.detail);

  // Generate narrative
  const breadthLabel = workerProfile.breadth.label;
  const topMatchCount = cpcResults.length;
  const avgSimilarity = topMatchCount > 0
    ? cpcResults.reduce((s, r) => s + r.cosineSimilarity, 0) / topMatchCount
    : 0;

  // OEWS summary
  const withWages = cpcResults.filter((r) => r.medianWage !== null);
  const wageInfo = withWages.length > 0
    ? `, with median wages ranging from $${Math.min(...withWages.map((r) => r.medianWage!)).toLocaleString()} to $${Math.max(...withWages.map((r) => r.medianWage!)).toLocaleString()}`
    : "";

  const topStrengthNames = workerStrengths
    .slice(0, 3)
    .map((s) => s.name)
    .join(", ");

  const topGapNames = marketGaps
    .slice(0, 3)
    .map((g) => g.name)
    .join(", ");

  let narrative = `The evaluee's component profile is ${breadthLabel}, `;
  narrative += `with primary strengths in ${topStrengthNames || "general occupational skills"}. `;
  narrative += `Component analysis identified ${topMatchCount} occupations with `;
  narrative += `${Math.round(avgSimilarity * 100)}% average component similarity${wageInfo}. `;

  if (marketGaps.length > 0) {
    narrative += `Key component gaps relative to the broader labor market include ${topGapNames}. `;
  }

  return {
    workerStrengths,
    marketGaps,
    profileBreadth: breadthLabel,
    narrative,
  };
}

// ─── Full CPC Analysis Builder ───────────────────────────────────────

/**
 * Build the complete CPC analysis for a case.
 * This is the top-level function called by the compute pipeline.
 *
 * Produces the full CPCAnalysis object that gets stored in analysis.cpcAnalysis
 * and rendered in the PDF report.
 */
export async function buildCPCAnalysis(
  prwOnetCodes: string[],
  maxSvp: number,
  postStrength: number | null,
  options: CPCCandidateOptions = {}
): Promise<CPCAnalysis> {
  // Build worker composite profile
  const workerProfile = await buildWorkerComponentProfile(
    prwOnetCodes,
    maxSvp,
    postStrength
  );

  // Generate CPC candidates
  const cpcResults = await generateCPCCandidates(workerProfile, options);

  // Compute gap analysis
  const gapAnalysis = computeGapAnalysis(workerProfile, cpcResults);

  // Build labor market summary from OEWS data
  const withEmployment = cpcResults.filter((r) => r.employment !== null);
  const withWages = cpcResults.filter((r) => r.medianWage !== null);

  const laborMarketSummary = {
    totalEmployment: withEmployment.reduce((s, r) => s + (r.employment ?? 0), 0),
    wageRange: {
      min: withWages.length > 0
        ? Math.min(...withWages.map((r) => r.medianWage!))
        : null,
      max: withWages.length > 0
        ? Math.max(...withWages.map((r) => r.medianWage!))
        : null,
      median: withWages.length > 0
        ? withWages
            .map((r) => r.medianWage!)
            .sort((a, b) => a - b)[Math.floor(withWages.length / 2)]
        : null,
    },
    withOEWSData: withEmployment.length,
  };

  return {
    workerProfile: {
      cpc: workerProfile.cpc,
      breadth: workerProfile.breadth,
      topComponents: workerProfile.topComponents,
      prwOccupations: workerProfile.prwFingerprints,
    },
    similarOccupations: cpcResults,
    gapAnalysis,
    laborMarketSummary,
  };
}
