/**
 * Most-Frequently-Hired Jobs per County/MSA Analysis Engine
 *
 * Combines multiple data sources to determine which jobs are most frequently
 * hired in a given geography, and assesses a worker's pre- vs post-injury
 * access to those jobs:
 *
 *   1. Census QWI — hire counts by industry at the county/MSA level
 *   2. BLS staffing patterns — translates industry hires → occupation-level hires
 *   3. DOT/O*NET crosswalk — maps SOC codes to DOT codes and trait demands
 *   4. 24-trait comparison — determines accessibility pre/post injury
 *
 * The output quantifies how many of the most-hired local occupations a worker
 * has lost access to due to injury.
 */

import { getQWIHires, type QWIResult } from "@/lib/api/census";
import {
  TRAIT_KEYS,
  TRAIT_LABELS,
  type TraitKey,
} from "@/lib/engine/traits";

// ─── Types ──────────────────────────────────────────────────────────────

export interface HiredJobAnalysis {
  countyOrMsa: string;
  geographyName: string;
  totalHires: number;
  topHiredOccupations: HiredOccupation[];
  preInjuryAccessible: number;
  postInjuryAccessible: number;
  accessLost: number;
  accessLostPct: number;
}

export interface HiredOccupation {
  onetCode: string;
  dotCode: string | null;
  title: string;
  estimatedHires: number;
  hirePct: number;
  traitDemands: Record<string, number>;
  preInjuryAccessible: boolean;
  postInjuryAccessible: boolean;
  failedTraitsPostInjury: string[];
  medianWage: number | null;
}

// ─── SOC Major Group Representative O*NET Codes ──────────────────────────
//
// Each SOC major group is represented by its most common detailed occupation.
// These provide the O*NET code and title for the group-level analysis.

interface SocGroupRepresentative {
  onetCode: string;
  title: string;
}

const SOC_GROUP_REPS: Record<string, SocGroupRepresentative> = {
  "11": { onetCode: "11-1021.00", title: "General and Operations Managers" },
  "13": { onetCode: "13-2011.00", title: "Accountants and Auditors" },
  "15": { onetCode: "15-1252.00", title: "Software Developers" },
  "17": { onetCode: "17-2051.00", title: "Civil Engineers" },
  "19": { onetCode: "19-4099.00", title: "Life, Physical, and Social Science Technicians" },
  "21": { onetCode: "21-1093.00", title: "Social and Human Service Assistants" },
  "23": { onetCode: "23-1011.00", title: "Lawyers" },
  "25": { onetCode: "25-2031.00", title: "Secondary School Teachers" },
  "27": { onetCode: "27-1024.00", title: "Graphic Designers" },
  "29": { onetCode: "29-1141.00", title: "Registered Nurses" },
  "31": { onetCode: "31-1131.00", title: "Nursing Assistants" },
  "33": { onetCode: "33-9032.00", title: "Security Guards" },
  "35": { onetCode: "35-2014.00", title: "Cooks, Restaurant" },
  "37": { onetCode: "37-2011.00", title: "Janitors and Cleaners" },
  "39": { onetCode: "39-9011.00", title: "Childcare Workers" },
  "41": { onetCode: "41-2031.00", title: "Retail Salespersons" },
  "43": { onetCode: "43-9061.00", title: "Office Clerks, General" },
  "45": { onetCode: "45-2092.00", title: "Farmworkers and Laborers" },
  "47": { onetCode: "47-2061.00", title: "Construction Laborers" },
  "49": { onetCode: "49-9071.00", title: "Maintenance and Repair Workers, General" },
  "51": { onetCode: "51-9199.00", title: "Production Workers, All Other" },
  "53": { onetCode: "53-7062.00", title: "Laborers and Material Movers, Hand" },
};

// ─── SOC Group Typical Trait Demands ─────────────────────────────────────
//
// Simplified trait demand vectors for SOC major groups.
// Values on the 0-4 scale. Unspecified traits default to 1.

const SOC_TRAIT_DEMANDS: Record<string, Partial<Record<TraitKey, number>>> = {
  "11": { reasoning: 3, math: 3, language: 3, strength: 1 },
  "13": { reasoning: 3, math: 3, language: 2, clericalPerception: 3, strength: 0 },
  "15": { reasoning: 4, math: 4, language: 2, strength: 0 },
  "17": { reasoning: 4, math: 4, spatialPerception: 3, strength: 1 },
  "19": { reasoning: 4, math: 3, language: 3, strength: 1 },
  "21": { reasoning: 2, language: 3, strength: 1 },
  "23": { reasoning: 4, language: 4, strength: 0 },
  "25": { reasoning: 3, language: 3, strength: 1 },
  "27": { reasoning: 2, language: 2, spatialPerception: 2, fingerDexterity: 2, strength: 1 },
  "29": { reasoning: 3, math: 2, language: 2, fingerDexterity: 3, strength: 2 },
  "31": { reasoning: 1, language: 1, strength: 2, stoopKneel: 2 },
  "33": { reasoning: 2, language: 2, strength: 3, motorCoordination: 2 },
  "35": { reasoning: 1, language: 1, strength: 2, motorCoordination: 2, extremeHeat: 2 },
  "37": { reasoning: 1, strength: 3, stoopKneel: 3, dustsFumes: 2 },
  "39": { reasoning: 1, language: 2, strength: 1 },
  "41": { reasoning: 2, math: 2, language: 3, clericalPerception: 2, strength: 1 },
  "43": { reasoning: 2, math: 2, language: 2, clericalPerception: 3, fingerDexterity: 2, strength: 0 },
  "45": { reasoning: 1, strength: 3, workLocation: 3, extremeHeat: 2 },
  "47": { reasoning: 2, math: 1, strength: 3, climbBalance: 3, stoopKneel: 3, hazards: 2, dustsFumes: 2 },
  "49": { reasoning: 2, math: 2, motorCoordination: 3, fingerDexterity: 3, strength: 2, hazards: 2 },
  "51": { reasoning: 1, motorCoordination: 2, manualDexterity: 3, strength: 2, noiseVibration: 2 },
  "53": { reasoning: 1, strength: 3, motorCoordination: 2, eyeHandFoot: 2 },
};

const DEFAULT_DEMAND = 1;

// ─── Staffing Shares (industry → occupation distribution) ────────────────

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
  "22:49": 0.25, "22:47": 0.10, "22:43": 0.12, "22:17": 0.08, "22:11": 0.08,
  "21:47": 0.35, "21:53": 0.12, "21:49": 0.10, "21:17": 0.08, "21:11": 0.06,
  "11:45": 0.50, "11:53": 0.10, "11:11": 0.05,
  "55:11": 0.25, "55:13": 0.20, "55:43": 0.15, "55:15": 0.10,
  "81:49": 0.25, "81:39": 0.15, "81:43": 0.10, "81:41": 0.08, "81:11": 0.05,
};

// ─── Geography Helpers ──────────────────────────────────────────────────

/**
 * Extract the state FIPS code (first 2 digits) from a 5-digit county FIPS.
 */
function stateFromCountyFips(countyFips: string): string {
  return countyFips.substring(0, 2);
}

/**
 * Extract the 3-digit county portion from a 5-digit county FIPS.
 */
function countyPortionFromFips(countyFips: string): string {
  return countyFips.substring(2, 5);
}

// ─── Trait Comparison ───────────────────────────────────────────────────

/**
 * Check whether a worker profile meets the trait demands for a given SOC group.
 * Returns whether accessible and which traits fail.
 */
function checkTraitAccess(
  workerTraits: Record<string, number>,
  socCode: string
): { accessible: boolean; failedTraits: string[] } {
  const demands = SOC_TRAIT_DEMANDS[socCode] ?? {};
  const failedTraits: string[] = [];

  for (const trait of TRAIT_KEYS) {
    const demand = demands[trait] ?? DEFAULT_DEMAND;
    const capacity = workerTraits[trait] ?? 0;

    if (capacity < demand) {
      failedTraits.push(trait);
    }
  }

  return {
    accessible: failedTraits.length === 0,
    failedTraits,
  };
}

/**
 * Build trait demand record for a SOC group (all 24 traits, defaults filled).
 */
function buildFullDemands(socCode: string): Record<string, number> {
  const partial = SOC_TRAIT_DEMANDS[socCode] ?? {};
  const full: Record<string, number> = {};
  for (const trait of TRAIT_KEYS) {
    full[trait] = partial[trait as TraitKey] ?? DEFAULT_DEMAND;
  }
  return full;
}

// ─── Core Logic ─────────────────────────────────────────────────────────

/**
 * Distribute QWI industry hires to SOC major groups using staffing patterns.
 */
function distributeQWIHiresToOccupations(
  qwiData: QWIResult[]
): Map<string, number> {
  const socHires = new Map<string, number>();

  for (const qwi of qwiData) {
    if (qwi.hires === null || qwi.hires <= 0) continue;

    const naics2 = qwi.naics.substring(0, 2);

    // Find all staffing shares for this 2-digit NAICS
    for (const [key, share] of Object.entries(STAFFING_SHARES)) {
      if (!key.startsWith(`${naics2}:`)) continue;

      const socMajor = key.split(":")[1];
      const estimated = Math.round(qwi.hires * share);

      if (estimated > 0) {
        socHires.set(socMajor, (socHires.get(socMajor) ?? 0) + estimated);
      }
    }
  }

  return socHires;
}

// ─── Main Analysis Function ─────────────────────────────────────────────

/**
 * Analyze the most-frequently-hired jobs in a county or MSA and compare
 * against a worker's pre-injury and post-injury trait profiles.
 *
 * Steps:
 *   1. Fetch QWI hire counts by industry for the geography
 *   2. Apply staffing patterns to translate industry hires to occupation hires
 *   3. For each top-hired SOC group, build trait demand profile
 *   4. Compare pre-injury and post-injury worker traits against demands
 *   5. Return structured analysis with accessibility counts
 *
 * @param countyFips - 5-digit county FIPS code (e.g., "06037" for LA County)
 * @param msaCode - MSA/CBSA code (e.g., "31080" for LA metro)
 * @param preInjuryTraits - Worker's 24-trait pre-injury profile (trait key -> 0-4 value)
 * @param postInjuryTraits - Worker's 24-trait post-injury profile (trait key -> 0-4 value)
 * @returns Analysis with top hired occupations and accessibility comparison
 */
export async function analyzeHiredJobs(
  countyFips: string | null,
  msaCode: string | null,
  preInjuryTraits: Record<string, number>,
  postInjuryTraits: Record<string, number>,
): Promise<HiredJobAnalysis> {
  const geoCode = countyFips ?? msaCode ?? "unknown";
  const geoName = countyFips
    ? `County FIPS ${countyFips}`
    : msaCode
      ? `MSA ${msaCode}`
      : "Unknown Geography";

  // 1. Fetch QWI data for all industries in the geography
  const qwiResults = await fetchQWIForAllIndustries(countyFips, msaCode);

  // 2. Distribute industry hires to SOC occupation groups
  const socHires = distributeQWIHiresToOccupations(qwiResults);

  // 3. Sort by estimated hires and take top occupations
  const sortedSocHires = Array.from(socHires.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20);

  const totalHires = sortedSocHires.reduce((sum, [, h]) => sum + h, 0);

  // 4. Build HiredOccupation for each top SOC group
  const topHiredOccupations: HiredOccupation[] = sortedSocHires.map(
    ([socCode, hires]) => {
      const rep = SOC_GROUP_REPS[socCode];
      const demands = buildFullDemands(socCode);

      const preCheck = checkTraitAccess(preInjuryTraits, socCode);
      const postCheck = checkTraitAccess(postInjuryTraits, socCode);

      // Map failed trait keys to labels for readability
      const failedTraitsLabeled = postCheck.failedTraits.map(
        (t) => TRAIT_LABELS[t as TraitKey] ?? t
      );

      return {
        onetCode: rep?.onetCode ?? `${socCode}-0000.00`,
        dotCode: null, // DOT crosswalk lookup would require DB query
        title: rep?.title ?? `SOC ${socCode} Occupations`,
        estimatedHires: hires,
        hirePct: totalHires > 0 ? Math.round((hires / totalHires) * 10000) / 100 : 0,
        traitDemands: demands,
        preInjuryAccessible: preCheck.accessible,
        postInjuryAccessible: postCheck.accessible,
        failedTraitsPostInjury: failedTraitsLabeled,
        medianWage: null, // Would require OccupationWages DB lookup
      };
    }
  );

  // 5. Compute summary statistics
  const preInjuryAccessible = topHiredOccupations.filter(
    (o) => o.preInjuryAccessible
  ).length;
  const postInjuryAccessible = topHiredOccupations.filter(
    (o) => o.postInjuryAccessible
  ).length;
  const accessLost = topHiredOccupations.filter(
    (o) => o.preInjuryAccessible && !o.postInjuryAccessible
  ).length;
  const accessLostPct =
    preInjuryAccessible > 0
      ? Math.round((accessLost / preInjuryAccessible) * 10000) / 100
      : 0;

  return {
    countyOrMsa: geoCode,
    geographyName: geoName,
    totalHires,
    topHiredOccupations,
    preInjuryAccessible,
    postInjuryAccessible,
    accessLost,
    accessLostPct,
  };
}

// ─── QWI Data Fetching ──────────────────────────────────────────────────

/**
 * Fetch QWI hire data across major NAICS 2-digit industries for a geography.
 * Aggregates the most recent quarter's data.
 */
async function fetchQWIForAllIndustries(
  countyFips: string | null,
  msaCode: string | null
): Promise<QWIResult[]> {
  const naicsSectors = [
    "11", "21", "22", "23", "31", "42", "44", "48",
    "51", "52", "53", "54", "55", "56", "61", "62",
    "71", "72", "81", "92",
  ];

  const stateFips = countyFips ? stateFromCountyFips(countyFips) : null;
  const countyPortion = countyFips ? countyPortionFromFips(countyFips) : null;

  // For MSA queries, we still need a state FIPS for the QWI API.
  // Use a synthetic state code; QWI will return MSA-level data regardless.
  const effectiveStateFips = stateFips ?? "00";

  const promises = naicsSectors.map((naics) =>
    getQWIHires({
      countyFips: countyPortion ?? undefined,
      msaCode: msaCode ?? undefined,
      stateFips: effectiveStateFips,
      naics,
    }).catch(() => [] as QWIResult[])
  );

  const results = await Promise.all(promises);

  // Flatten and deduplicate: take the most recent period per NAICS
  const allResults = results.flat();
  const latestByNaics = new Map<string, QWIResult>();

  for (const r of allResults) {
    const existing = latestByNaics.get(r.naics);
    if (!existing || r.period > existing.period) {
      latestByNaics.set(r.naics, r);
    }
  }

  return Array.from(latestByNaics.values());
}
