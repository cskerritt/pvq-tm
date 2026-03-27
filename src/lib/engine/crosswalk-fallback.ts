/**
 * DOT → O*NET Crosswalk Fallback
 *
 * Provides fallback O*NET mapping for the 1,203 DOT codes (9.5%) that lack
 * a direct crosswalk (`xw` field is empty). The strategy:
 *
 * 1. Check if the DOT code has an existing `xw` crosswalk value.
 * 2. If not, use DOT occupational category (first digit) + SVP level to
 *    find the best-matching O*NET occupation by SOC major group and Job Zone.
 *
 * DOT category → SOC major group mapping is based on the Census/DOL
 * occupational classification concordance. SVP → Job Zone alignment
 * follows the O*NET-SOC standard (BLS 2018).
 *
 * All fallback results are flagged with `isFallback: true`.
 */

import { loadDOTData, loadONETFullData, type DOTOccupationData } from "@/lib/data-loaders";

// ─── Types ───────────────────────────────────────────────────────────

export interface CrosswalkResult {
  dotCode: string;
  onetCode: string;
  onetTitle: string;
  isFallback: boolean;
  fallbackMethod?: "dot-category-svp" | "dot-category-only" | "svp-only";
}

// ─── DOT Category → SOC Major Group Mapping ─────────────────────────
// DOT first digit → array of SOC 2-digit major groups (primary first)

const DOT_CATEGORY_TO_SOC: Record<string, string[]> = {
  "0": ["11", "13", "15", "17", "19", "23", "25", "29"],  // Professional, Technical, Managerial
  "1": ["43", "41", "13"],                                  // Clerical and Sales
  "2": ["35", "39", "31", "21", "33"],                      // Service
  "3": ["45"],                                              // Agriculture, Fishery, Forestry
  "4": ["51"],                                              // Processing
  "5": ["51"],                                              // Processing (continued)
  "6": ["51", "49"],                                        // Machine Trades
  "7": ["51"],                                              // Benchwork
  "8": ["47", "49"],                                        // Structural Work
  "9": ["53", "51", "49"],                                  // Miscellaneous
};

// More precise mapping using DOT 2nd digit for subcategories within "0" (Professional)
const DOT_PROFESSIONAL_SUBCATEGORY: Record<string, string[]> = {
  "00": ["17"],            // Architecture, Engineering
  "01": ["17"],            // Engineering (specific)
  "02": ["17"],            // Engineering (specific)
  "03": ["17"],            // Engineering (specific)
  "04": ["15"],            // Computer
  "05": ["19"],            // Life/Physical Science
  "06": ["19"],            // Life/Physical Science
  "07": ["29"],            // Healthcare
  "08": ["29"],            // Healthcare
  "09": ["25"],            // Education
  "10": ["25"],            // Education/Library
  "11": ["23"],            // Legal
  "12": ["21", "39"],      // Social/Personal Service
  "13": ["27"],            // Arts/Media
  "14": ["27"],            // Arts/Media
  "15": ["27"],            // Entertainment
  "16": ["13"],            // Business/Financial
  "17": ["11", "13"],      // Management/Admin
  "18": ["11", "13"],      // Management/Admin
  "19": ["11", "13", "19"],// Management/Miscellaneous Professional
};

// ─── SVP → Job Zone Mapping ─────────────────────────────────────────

function svpToJobZone(svp: number): number {
  if (svp <= 2) return 1;
  if (svp <= 4) return 2;
  if (svp <= 6) return 3;
  if (svp === 7) return 4;
  return 5; // SVP 8-9
}

// ─── Module-Level Caches ─────────────────────────────────────────────

let _fallbackIndex: Map<string, CrosswalkResult> | null = null;
let _onetBySocAndJZ: Map<string, { code: string; title: string; jz: number }[]> | null = null;

// ─── Build O*NET Index by SOC Major Group and Job Zone ───────────────

async function buildONETIndex(): Promise<Map<string, { code: string; title: string; jz: number }[]>> {
  if (_onetBySocAndJZ) return _onetBySocAndJZ;

  const onetFull = await loadONETFullData();
  const index = new Map<string, { code: string; title: string; jz: number }[]>();

  for (const [code, data] of Object.entries(onetFull)) {
    const major = code.slice(0, 2);
    const jz = data.jz ?? 3; // default to JZ 3 (middle)
    const key = `${major}-${jz}`;

    if (!index.has(key)) index.set(key, []);
    index.get(key)!.push({ code, title: data.t, jz });

    // Also index by major group only (for broader fallback)
    const majorKey = `${major}-all`;
    if (!index.has(majorKey)) index.set(majorKey, []);
    index.get(majorKey)!.push({ code, title: data.t, jz });
  }

  _onetBySocAndJZ = index;
  return index;
}

// ─── Find Best O*NET Match for a DOT Code ────────────────────────────

function findBestONETMatch(
  dotCode: string,
  dotEntry: DOTOccupationData,
  index: Map<string, { code: string; title: string; jz: number }[]>
): CrosswalkResult | null {
  const targetJZ = svpToJobZone(dotEntry.s);
  const dotCategory = dotCode.charAt(0);
  const dotSubcategory = dotCode.slice(0, 2);

  // Try precise subcategory mapping first (only for category 0 - Professional)
  let socGroups: string[];
  if (dotCategory === "0" && DOT_PROFESSIONAL_SUBCATEGORY[dotSubcategory]) {
    socGroups = DOT_PROFESSIONAL_SUBCATEGORY[dotSubcategory];
  } else {
    socGroups = DOT_CATEGORY_TO_SOC[dotCategory] || ["51"]; // default to Production
  }

  // Strategy 1: Match on SOC group + exact Job Zone
  for (const soc of socGroups) {
    const key = `${soc}-${targetJZ}`;
    const candidates = index.get(key);
    if (candidates && candidates.length > 0) {
      // Pick first non-residual occupation if available
      const nonResidual = candidates.find(c => !c.title.includes("All Other"));
      const pick = nonResidual || candidates[0];
      return {
        dotCode,
        onetCode: pick.code,
        onetTitle: pick.title,
        isFallback: true,
        fallbackMethod: "dot-category-svp",
      };
    }
  }

  // Strategy 2: Match on SOC group, any Job Zone (closest first)
  for (const soc of socGroups) {
    const key = `${soc}-all`;
    const candidates = index.get(key);
    if (candidates && candidates.length > 0) {
      // Sort by JZ distance from target
      const sorted = [...candidates].sort(
        (a, b) => Math.abs(a.jz - targetJZ) - Math.abs(b.jz - targetJZ)
      );
      const nonResidual = sorted.find(c => !c.title.includes("All Other"));
      const pick = nonResidual || sorted[0];
      return {
        dotCode,
        onetCode: pick.code,
        onetTitle: pick.title,
        isFallback: true,
        fallbackMethod: "dot-category-only",
      };
    }
  }

  // Strategy 3: Any O*NET with matching Job Zone
  const anyJZKey = Array.from(index.keys()).find(k => k.endsWith(`-${targetJZ}`));
  if (anyJZKey) {
    const candidates = index.get(anyJZKey)!;
    const pick = candidates[0];
    return {
      dotCode,
      onetCode: pick.code,
      onetTitle: pick.title,
      isFallback: true,
      fallbackMethod: "svp-only",
    };
  }

  return null;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Get the O*NET occupation code for a DOT code.
 * First checks the existing `xw` crosswalk field, then falls back to
 * DOT category + SVP matching.
 *
 * Note: The `xw` field in DOT data contains old OES census codes, not
 * O*NET-SOC codes. For DOT codes WITH an xw value, we still consider
 * them "mapped" (the xw serves as a general crosswalk identifier).
 * For DOT codes WITHOUT xw, we provide a fallback O*NET-SOC code.
 */
export async function getONETForDOT(dotCode: string): Promise<CrosswalkResult | null> {
  const dotData = await loadDOTData();
  const entry = dotData[dotCode];
  if (!entry) return null;

  // Check existing crosswalk
  if (entry.xw && entry.xw.trim().length > 0) {
    // The xw field has an old OES code — it's mapped but we need to resolve
    // to O*NET format. For "mapped" DOT codes, we use the existing system.
    // Return a non-fallback result indicating direct mapping exists.
    return {
      dotCode,
      onetCode: entry.xw.trim(), // OES code (consumers may need to resolve further)
      onetTitle: "", // Title not available from OES code alone
      isFallback: false,
    };
  }

  // Build fallback
  const index = await buildONETIndex();
  return findBestONETMatch(dotCode, entry, index);
}

/**
 * Get fallback O*NET mappings for ALL unmapped DOT codes.
 * Returns a Map of dotCode → CrosswalkResult.
 */
export async function getAllFallbackMappings(): Promise<Map<string, CrosswalkResult>> {
  if (_fallbackIndex) return _fallbackIndex;

  const dotData = await loadDOTData();
  const index = await buildONETIndex();
  const result = new Map<string, CrosswalkResult>();

  for (const [dotCode, entry] of Object.entries(dotData)) {
    if (entry.xw && entry.xw.trim().length > 0) continue; // already mapped

    const match = findBestONETMatch(dotCode, entry, index);
    if (match) {
      result.set(dotCode, match);
    }
  }

  _fallbackIndex = result;
  return result;
}

/**
 * Check if a DOT code can be resolved to an O*NET occupation
 * (either via existing crosswalk or fallback).
 */
export async function canResolveDOT(dotCode: string): Promise<boolean> {
  const result = await getONETForDOT(dotCode);
  return result !== null;
}

/**
 * Get coverage statistics for the crosswalk with fallbacks.
 */
export async function getCrosswalkCoverage(): Promise<{
  total: number;
  directMapped: number;
  fallbackMapped: number;
  unmapped: number;
  coveragePct: number;
  fallbackByMethod: Record<string, number>;
}> {
  const dotData = await loadDOTData();
  const dotCodes = Object.keys(dotData);
  const fallbacks = await getAllFallbackMappings();

  let directMapped = 0;
  let fallbackMapped = 0;
  let unmapped = 0;
  const fallbackByMethod: Record<string, number> = {};

  for (const code of dotCodes) {
    if (dotData[code].xw && dotData[code].xw!.trim().length > 0) {
      directMapped++;
    } else if (fallbacks.has(code)) {
      fallbackMapped++;
      const method = fallbacks.get(code)!.fallbackMethod || "unknown";
      fallbackByMethod[method] = (fallbackByMethod[method] || 0) + 1;
    } else {
      unmapped++;
    }
  }

  return {
    total: dotCodes.length,
    directMapped,
    fallbackMapped,
    unmapped,
    coveragePct: ((directMapped + fallbackMapped) / dotCodes.length) * 100,
    fallbackByMethod,
  };
}
