/**
 * Most Frequently Hired Jobs Engine
 *
 * Combines FRED JOLTS industry-level hiring data with BLS staffing patterns
 * to estimate the most frequently hired occupations, both nationally and
 * weighted by local area industry mix.
 *
 * Approach:
 *   1. Get industry-level hires from FRED JOLTS (national, by NAICS sector)
 *   2. For each industry, apply BLS staffing patterns to distribute hires
 *      to SOC major occupation groups
 *   3. Aggregate across industries, rank by estimated hires
 *   4. Return top N occupations with estimated hire counts
 *
 * This replaces the CareerOneStop job-posting dependency with a structural
 * estimate derived from JOLTS hiring flows and staffing composition.
 */

import { fetchJoltsIndustryHires, type JoltsIndustryData } from "@/lib/api/fred";

// ─── Types ─────────────────────────────────────────────────────────────

export interface FrequentlyHiredJob {
  /** 2-digit SOC major group code (e.g., "29") */
  socCode: string;
  /** SOC major group title (e.g., "Healthcare Practitioners and Technical") */
  title: string;
  /** Estimated monthly hires (actual count, not thousands) */
  estimatedHires: number;
  /** NAICS code of the industry contributing the most hires */
  primaryIndustry: string;
  /** Breakdown of which industries contribute hires to this occupation */
  industryMix: Array<{ naics: string; share: number }>;
}

// ─── SOC Major Group Names ─────────────────────────────────────────────

const SOC_MAJOR_GROUP_NAMES: Record<string, string> = {
  "11": "Management",
  "13": "Business and Financial Operations",
  "15": "Computer and Mathematical",
  "17": "Architecture and Engineering",
  "19": "Life, Physical, and Social Science",
  "21": "Community and Social Service",
  "23": "Legal",
  "25": "Educational Instruction and Library",
  "27": "Arts, Design, Entertainment, Sports, and Media",
  "29": "Healthcare Practitioners and Technical",
  "31": "Healthcare Support",
  "33": "Protective Service",
  "35": "Food Preparation and Serving Related",
  "37": "Building and Grounds Cleaning and Maintenance",
  "39": "Personal Care and Service",
  "41": "Sales and Related",
  "43": "Office and Administrative Support",
  "45": "Farming, Fishing, and Forestry",
  "47": "Construction and Extraction",
  "49": "Installation, Maintenance, and Repair",
  "51": "Production",
  "53": "Transportation and Material Moving",
  "55": "Military Specific",
};

// ─── Staffing Shares ───────────────────────────────────────────────────
//
// Same staffing pattern data as in staffing-patterns.ts, but keyed for
// JOLTS industry NAICS ranges. JOLTS uses broader groupings than ZBP:
//   - "23" = Construction
//   - "31-33" = Manufacturing (we use key "31")
//   - "54-56" = Professional/Business Services (we split to "54" and "56")
//   - "61-62" = Education/Health (we split to "61" and "62")
//   - "71-72" = Leisure/Hospitality (we split to "71" and "72")
//   - "42-49" = Trade/Transport/Utilities (we split to "42","44","48")
//   - "52-53" = Financial Activities (we split to "52" and "53")
//   - "51" = Information
//   - "92" = Government
//
// For JOLTS ranges that span multiple NAICS 2-digit codes, we average
// the staffing patterns across the constituent industries.

// Map from JOLTS NAICS range to array of 2-digit NAICS codes that compose it
const JOLTS_TO_NAICS2: Record<string, string[]> = {
  "23": ["23"],
  "31-33": ["31"],
  "54-56": ["54", "56"],
  "61-62": ["61", "62"],
  "71-72": ["71", "72"],
  "42-49": ["42", "44", "48"],
  "52-53": ["52", "53"],
  "51": ["51"],
  "92": ["92"],
};

// Staffing shares: naics2:socMajor -> share (0 to 1)
// Duplicated from staffing-patterns.ts to avoid circular import issues
// and keep this module self-contained.
const STAFFING_SHARES: Record<string, number> = {
  "23:47": 0.45, "23:49": 0.12, "23:11": 0.06, "23:43": 0.06, "23:53": 0.05,
  "31:51": 0.48, "31:53": 0.10, "31:49": 0.07, "31:17": 0.05, "31:43": 0.05, "31:11": 0.04,
  "44:41": 0.55, "44:43": 0.12, "44:53": 0.08, "44:11": 0.05, "44:35": 0.04,
  "48:53": 0.60, "48:43": 0.10, "48:49": 0.05, "48:11": 0.04,
  "51:15": 0.25, "51:27": 0.15, "51:43": 0.10, "51:41": 0.08, "51:11": 0.08,
  "52:13": 0.30, "52:43": 0.25, "52:41": 0.15, "52:11": 0.08,
  "53:41": 0.25, "53:43": 0.20, "53:37": 0.15, "53:11": 0.08, "53:49": 0.06,
  "54:15": 0.18, "54:13": 0.15, "54:17": 0.10, "54:23": 0.08, "54:43": 0.10, "54:11": 0.10,
  "56:37": 0.20, "56:43": 0.18, "56:53": 0.10, "56:33": 0.08, "56:39": 0.06, "56:11": 0.04,
  "61:25": 0.55, "61:43": 0.10, "61:21": 0.05, "61:11": 0.06,
  "62:29": 0.30, "62:31": 0.20, "62:43": 0.12, "62:21": 0.06, "62:39": 0.05, "62:11": 0.05,
  "71:27": 0.20, "71:39": 0.15, "71:35": 0.12, "71:41": 0.08, "71:43": 0.08,
  "72:35": 0.55, "72:43": 0.08, "72:41": 0.06, "72:37": 0.05, "72:11": 0.04,
  "42:41": 0.25, "42:53": 0.20, "42:43": 0.12, "42:11": 0.06,
  "92:33": 0.20, "92:43": 0.20, "92:11": 0.10, "92:13": 0.08, "92:21": 0.06,
};

// ─── Core Logic ────────────────────────────────────────────────────────

/**
 * Distribute industry hires to SOC major groups using staffing patterns.
 *
 * For a JOLTS industry like "42-49" (Trade/Transport/Utilities), we:
 * 1. Look up the constituent 2-digit NAICS codes (42, 44, 48)
 * 2. For each, get the staffing shares (which SOC groups work in that industry)
 * 3. Split hires evenly among constituent NAICS codes
 * 4. Distribute each sub-industry's share of hires to SOC groups
 *
 * @returns Map of socMajor -> { hires, sources }
 */
function distributeHiresToOccupations(
  joltsData: JoltsIndustryData[]
): Map<string, { hires: number; sources: Map<string, number> }> {
  const socHires = new Map<
    string,
    { hires: number; sources: Map<string, number> }
  >();

  for (const industry of joltsData) {
    if (industry.hires === null || industry.hires <= 0) continue;

    const naics2List = JOLTS_TO_NAICS2[industry.naicsCode];
    if (!naics2List || naics2List.length === 0) continue;

    // Split hires evenly across constituent 2-digit NAICS codes
    const hiresPerSubIndustry = industry.hires / naics2List.length;

    for (const naics2 of naics2List) {
      // Find all staffing shares for this 2-digit NAICS
      for (const [key, share] of Object.entries(STAFFING_SHARES)) {
        if (!key.startsWith(`${naics2}:`)) continue;

        const socMajor = key.split(":")[1];
        const estimatedHires = Math.round(hiresPerSubIndustry * share);

        if (estimatedHires <= 0) continue;

        if (!socHires.has(socMajor)) {
          socHires.set(socMajor, { hires: 0, sources: new Map() });
        }

        const entry = socHires.get(socMajor)!;
        entry.hires += estimatedHires;

        // Track which JOLTS industry contributed
        const currentSource = entry.sources.get(industry.naicsCode) ?? 0;
        entry.sources.set(industry.naicsCode, currentSource + estimatedHires);
      }
    }
  }

  return socHires;
}

/**
 * Get the most frequently hired occupations nationally.
 *
 * Uses FRED JOLTS industry-level hires combined with BLS staffing patterns
 * to estimate which SOC major occupation groups have the highest hire volume.
 *
 * @param topN - Number of top occupations to return (default: 20)
 * @returns Array of frequently hired jobs sorted by estimated hires
 */
export async function getFrequentlyHiredJobs(
  topN: number = 20
): Promise<FrequentlyHiredJob[]> {
  const joltsData = await fetchJoltsIndustryHires();
  return rankOccupationsByHires(joltsData, topN);
}

/**
 * Get the most frequently hired occupations weighted by local area industry mix.
 *
 * Instead of using national JOLTS hires directly, this adjusts the distribution
 * based on local industry employment (from Census ZBP). Areas with more
 * construction will see construction-related occupations ranked higher.
 *
 * @param areaEmployment - Local employment by NAICS sector (from ZBP)
 * @param topN - Number of top occupations to return (default: 20)
 * @returns Array of frequently hired jobs, weighted by local industry mix
 */
export async function getFrequentlyHiredJobsForArea(
  areaEmployment: Array<{ naicsCode: string; employment: number }>,
  topN: number = 20
): Promise<FrequentlyHiredJob[]> {
  const joltsData = await fetchJoltsIndustryHires();

  if (areaEmployment.length === 0) {
    // No local data -- fall back to national
    return rankOccupationsByHires(joltsData, topN);
  }

  // Compute national employment shares from JOLTS (hires as proxy)
  const nationalTotal = joltsData.reduce((s, d) => s + (d.hires ?? 0), 0);

  // Compute local employment total
  const localTotal = areaEmployment.reduce((s, e) => s + e.employment, 0);

  if (nationalTotal === 0 || localTotal === 0) {
    return rankOccupationsByHires(joltsData, topN);
  }

  // Build a weight factor for each JOLTS industry based on local vs national share
  // Weight = (local share of industry) / (national share of industry)
  // This amplifies industries that are overrepresented locally
  const localShareByNaics = new Map<string, number>();
  for (const ae of areaEmployment) {
    const naics2 = normalizeNaicsToJolts(ae.naicsCode);
    if (naics2) {
      const current = localShareByNaics.get(naics2) ?? 0;
      localShareByNaics.set(naics2, current + ae.employment / localTotal);
    }
  }

  // Adjust JOLTS hires by local weight
  const adjustedJolts: JoltsIndustryData[] = joltsData.map((ind) => {
    const nationalShare =
      nationalTotal > 0 ? (ind.hires ?? 0) / nationalTotal : 0;
    const localShare = localShareByNaics.get(ind.naicsCode) ?? nationalShare;

    // Weight factor: how much more (or less) this industry is represented locally
    const weight =
      nationalShare > 0 ? localShare / nationalShare : localShare > 0 ? 2 : 0;

    // Cap the weight to avoid extreme distortion
    const cappedWeight = Math.min(weight, 5);

    return {
      ...ind,
      hires: ind.hires !== null ? Math.round(ind.hires * cappedWeight) : null,
      openings:
        ind.openings !== null
          ? Math.round(ind.openings * cappedWeight)
          : null,
    };
  });

  return rankOccupationsByHires(adjustedJolts, topN);
}

/**
 * Convert a ZBP NAICS code to the JOLTS industry NAICS range key.
 *
 * ZBP uses codes like "23", "31-33", "44-45", "48-49".
 * JOLTS uses broader groupings like "42-49", "52-53", "61-62".
 */
function normalizeNaicsToJolts(naicsCode: string): string | null {
  // Direct match
  if (JOLTS_TO_NAICS2[naicsCode]) return naicsCode;

  // Extract the first 2-digit code
  const dashIdx = naicsCode.indexOf("-");
  const naics2 = dashIdx > 0 ? naicsCode.substring(0, dashIdx) : naicsCode.substring(0, 2);

  // Map 2-digit NAICS to JOLTS ranges
  const mapping: Record<string, string> = {
    "23": "23",
    "31": "31-33", "32": "31-33", "33": "31-33",
    "54": "54-56", "55": "54-56", "56": "54-56",
    "61": "61-62", "62": "61-62",
    "71": "71-72", "72": "71-72",
    "42": "42-49", "44": "42-49", "45": "42-49", "48": "42-49", "49": "42-49",
    "52": "52-53", "53": "52-53",
    "51": "51",
    "92": "92",
  };

  return mapping[naics2] ?? null;
}

/**
 * Rank occupations by estimated hires and format the output.
 */
function rankOccupationsByHires(
  joltsData: JoltsIndustryData[],
  topN: number
): FrequentlyHiredJob[] {
  const socHires = distributeHiresToOccupations(joltsData);

  // Convert to sorted array
  const ranked: FrequentlyHiredJob[] = [];

  for (const [socCode, data] of socHires) {
    const title = SOC_MAJOR_GROUP_NAMES[socCode] ?? `SOC ${socCode}`;

    // Find primary industry (highest contributing)
    let primaryIndustry = "";
    let maxContribution = 0;
    const industryMix: Array<{ naics: string; share: number }> = [];

    for (const [naics, hires] of data.sources) {
      if (hires > maxContribution) {
        maxContribution = hires;
        primaryIndustry = naics;
      }
      industryMix.push({ naics, share: data.hires > 0 ? hires / data.hires : 0 });
    }

    // Sort industry mix by share descending
    industryMix.sort((a, b) => b.share - a.share);

    ranked.push({
      socCode,
      title,
      estimatedHires: data.hires,
      primaryIndustry,
      industryMix,
    });
  }

  // Sort by estimated hires descending
  ranked.sort((a, b) => b.estimatedHires - a.estimatedHires);

  return ranked.slice(0, topN);
}
