/**
 * Strength-Aware Transferable Skills Crosswalk
 *
 * When a worker has post-injury physical restrictions, the traditional
 * candidate generation pipeline (O*NET Related + CPC similarity) tends to
 * produce only occupations at the SAME exertional level as the PRW.
 * A carpenter gets other construction trades — never estimating, inspection,
 * or drafting roles that share transferable cognitive skills.
 *
 * This module bridges that gap by:
 * 1. Searching the O*NET database for occupations at or below the worker's
 *    post-injury strength capacity
 * 2. Filtering to occupations that share knowledge/skill domains with PRW
 * 3. Generating candidates that represent realistic career transitions
 *    (e.g., carpenter → cost estimator, construction inspector, CAD drafter)
 *
 * This is the computational equivalent of what a vocational evaluator does
 * when they identify sedentary/light alternatives for an injured worker.
 */

import { prisma } from "@/lib/db";
import {
  buildFingerprintIndex,
  cosineSimilarity,
  l2Normalize,
  analyzeComponentOverlap,
  jobZoneToMaxSvp,
  TAXONOMY_RANGES,
  type OccupationFingerprint,
} from "./component-profile";

export interface StrengthCrosswalkCandidate {
  onetSocCode: string;
  title: string;
  svp: number;
  source: "STRENGTH_CROSSWALK";
  similarityScore: number;
  /** Which skill domains matched */
  matchedDomains: string[];
  /** ORS strength level of the target */
  targetStrength: number | null;
}

/**
 * Map O*NET SOC major groups to their exertional tendencies.
 * Used to prefer sedentary/light occupation families when searching.
 *
 * Groups that commonly contain sedentary/light work:
 * 11 = Management, 13 = Business/Financial, 15 = Computer/Math,
 * 17 = Architecture/Engineering, 19 = Life/Physical/Social Science,
 * 21 = Community/Social, 23 = Legal, 25 = Education,
 * 27 = Arts/Design/Media, 29 = Healthcare Practitioners,
 * 41 = Sales, 43 = Office/Admin
 */
const SEDENTARY_LIGHT_SOC_PREFIXES = [
  "11-", "13-", "15-", "17-", "19-", "21-", "23-", "25-",
  "27-", "29-", "41-", "43-",
];

/**
 * Generate sedentary/light-duty candidate occupations by finding
 * jobs that share cognitive/knowledge components with the worker's PRW
 * but at a lower exertional level.
 *
 * Uses a "cognitive fingerprint" — the component similarity score
 * computed from ONLY the knowledge, skills, abilities, and work style
 * dimensions (excluding physical work activities and work context).
 *
 * @param prwOnetCodes - O*NET codes from past relevant work
 * @param maxSvp - Maximum SVP from PRW history
 * @param postStrength - Post-injury strength capacity (0=sedentary, 1=light, 2=medium, etc.)
 * @param existingCodes - Codes already found by other candidate sources
 */
export async function generateStrengthCrosswalkCandidates(
  prwOnetCodes: string[],
  maxSvp: number,
  postStrength: number | null,
  existingCodes: Set<string> = new Set()
): Promise<StrengthCrosswalkCandidate[]> {
  // Only activate when worker has physical restrictions (light or sedentary)
  if (postStrength === null || postStrength > 2) {
    return []; // Medium+ capacity — traditional pipeline is sufficient
  }

  const index = await buildFingerprintIndex();

  // Build worker's COGNITIVE fingerprint (non-physical dimensions only)
  const workerVectors: Float64Array[] = [];
  for (const code of prwOnetCodes) {
    const fp = index.get(code);
    if (fp) workerVectors.push(fp.vector);
  }

  if (workerVectors.length === 0) return [];

  // Average the PRW fingerprints
  const dim = workerVectors[0].length;
  const avgVector = new Float64Array(dim);
  for (const v of workerVectors) {
    for (let i = 0; i < dim; i++) avgVector[i] += v[i];
  }
  for (let i = 0; i < dim; i++) avgVector[i] /= workerVectors.length;

  // Zero out physical dimensions to create a "cognitive-only" fingerprint.
  // This prevents physical similarity from dominating the match.
  // Work Activities (4.A.*) and Work Context (4.C.*) contain the physical demands.
  const cognitiveVector = new Float64Array(avgVector);
  const ranges = TAXONOMY_RANGES;
  if (ranges) {
    // Zero out workActivities and workContext ranges which contain physical demands
    // Zero out physical demand dimensions (workActivities + workContext)
    for (let i = ranges.workActivities.start; i < ranges.workActivities.start + ranges.workActivities.count; i++) {
      cognitiveVector[i] = 0;
    }
    for (let i = ranges.workContext.start; i < ranges.workContext.start + ranges.workContext.count; i++) {
      cognitiveVector[i] = 0;
    }
  }
  const normalizedCognitive = l2Normalize(cognitiveVector);

  // Search for matches in sedentary/light occupation families
  const results: StrengthCrosswalkCandidate[] = [];

  for (const [code, fp] of index) {
    if (existingCodes.has(code)) continue;
    if (prwOnetCodes.includes(code)) continue;

    // SVP gate: allow up to maxSvp + 1 for cross-exertional transfers
    // (a carpenter at SVP 7 might reasonably transition to a SVP 8 office job
    //  like construction manager or cost estimator)
    const occSvp = jobZoneToMaxSvp(fp.jobZone);
    if (occSvp > maxSvp + 1) continue;

    // Strength gate: only include occupations AT OR BELOW worker's capacity
    const occStrength = fp.orsTraits?.["ors_strength"];
    if (occStrength !== undefined && occStrength > postStrength) continue;

    // Prefer sedentary/light occupation families, but don't exclude others
    // that happen to be light duty (e.g., some manufacturing inspection roles)
    const isSedentaryFamily = SEDENTARY_LIGHT_SOC_PREFIXES.some((p) =>
      code.startsWith(p)
    );

    // Compute COGNITIVE similarity (physical dimensions zeroed out)
    const occCognitiveVector = new Float64Array(fp.vector);
    if (ranges) {
      for (let i = ranges.workActivities.start; i < ranges.workActivities.start + ranges.workActivities.count; i++) {
        occCognitiveVector[i] = 0;
      }
      for (let i = ranges.workContext.start; i < ranges.workContext.start + ranges.workContext.count; i++) {
        occCognitiveVector[i] = 0;
      }
    }
    const normalizedOccCognitive = l2Normalize(occCognitiveVector);

    const cognitiveSim = cosineSimilarity(normalizedCognitive, normalizedOccCognitive);

    // Minimum threshold: cognitive similarity must be meaningful
    // Lower threshold than CPC (0.3 vs 0.4) because we're comparing across exertional levels
    if (cognitiveSim < 0.25) continue;

    // Boost score for sedentary/light occupation families
    const boost = isSedentaryFamily ? 0.05 : 0;
    const finalScore = cognitiveSim + boost;

    // Identify matched knowledge/skill domains
    const { matching } = analyzeComponentOverlap(
      normalizedCognitive,
      normalizedOccCognitive,
      3
    );
    const matchedDomains = matching.map((m) => m.name);

    results.push({
      onetSocCode: code,
      title: fp.title,
      svp: occSvp,
      source: "STRENGTH_CROSSWALK",
      similarityScore: Math.round(finalScore * 10000) / 10000,
      matchedDomains,
      targetStrength: occStrength ?? null,
    });
  }

  // Sort by cognitive similarity descending
  results.sort((a, b) => b.similarityScore - a.similarityScore);

  // Return top 40 — generous because many will be filtered by TFQ later
  return results.slice(0, 40);
}
