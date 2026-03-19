/**
 * Labor Market Access Analysis
 *
 * Compares a worker's PRE and POST injury profiles against ALL occupations
 * in the BLS OEWS database (831 occupations) to quantify the total labor
 * market impact of an injury.
 *
 * Instead of asking "which of these 10-20 candidate jobs can the worker do?",
 * this answers: "Out of ALL occupations with BLS employment data, how many
 * could this worker physically/cognitively access before and after injury?"
 */

import {
  type TraitVector,
  TRAIT_KEYS,
  TRAIT_LABELS,
  STRENGTH_LABELS,
  mapORSToTraits,
} from "./traits";

import {
  buildDOTDemandVector,
  buildOccupationDemands,
} from "./trait-feasibility";

import {
  type OEWSOccupationData,
  type DOTOccupationData,
  type ORSOccupationData,
  loadOEWSData,
  loadDOTData,
  loadORSData,
} from "@/lib/data-loaders";

// ─── Types ──────────────────────────────────────────────────────

export interface LaborMarketAccessResult {
  // Totals
  totalOccupationsAnalyzed: number;

  // Pre-injury
  preInjuryAccessible: number;
  preInjuryEmployment: number;
  preInjuryAreaEmployment: number;

  // Post-injury
  postInjuryAccessible: number;
  postInjuryEmployment: number;
  postInjuryAreaEmployment: number;

  // Loss
  occupationsLost: number;
  occupationsLostPct: number;
  employmentLost: number;
  employmentLostPct: number;
  areaEmploymentLost: number;
  areaEmploymentLostPct: number;

  // By strength level
  preByStrength: StrengthBreakdown;
  postByStrength: StrengthBreakdown;

  // Failing traits summary
  mostCommonFailingTraits: { trait: string; count: number }[];

  // Detail arrays (capped to top 50 each, sorted by employment desc)
  lostOccupations: OccupationAccessDetail[];
  retainedOccupations: OccupationAccessDetail[];
  gainedOccupations: OccupationAccessDetail[];
}

interface StrengthBreakdown {
  sedentary: number;
  light: number;
  medium: number;
  heavy: number;
  veryHeavy: number;
}

interface OccupationAccessDetail {
  code: string;
  title: string;
  employment: number;
  areaEmployment: number;
  strength: string;
  failedTraits?: string[];
}

/** DOT-to-SOC crosswalk entry (from database) */
export interface CrosswalkEntry {
  dotCode: string;
  onetSocCode: string;
}

/** Area-level wage data for employment lookup */
export interface AreaWageEntry {
  onetSocCode: string;
  employment: number | null;
}

// ─── SVP from O*NET Job Zone ────────────────────────────────────

/**
 * Map O*NET Job Zone (1-5) to approximate SVP range midpoint.
 * Job Zone 1 → SVP 1-2 (mid=2)
 * Job Zone 2 → SVP 3-4 (mid=4)
 * Job Zone 3 → SVP 5-6 (mid=6)
 * Job Zone 4 → SVP 7-8 (mid=7)
 * Job Zone 5 → SVP 8-9 (mid=9)
 */
function jobZoneToSvp(jobZone: number | null | undefined): number {
  if (!jobZone) return 2;
  const map: Record<number, number> = { 1: 2, 2: 4, 3: 6, 4: 7, 5: 9 };
  return map[jobZone] ?? 2;
}

// ─── Strength level from demand vector ──────────────────────────

function strengthLabel(strengthVal: number | null): string {
  if (strengthVal === null || strengthVal === undefined) return "Sedentary";
  return STRENGTH_LABELS[Math.round(strengthVal)] ?? "Sedentary";
}

function strengthCategory(strengthVal: number | null): keyof StrengthBreakdown {
  if (strengthVal === null || strengthVal === undefined) return "sedentary";
  const rounded = Math.round(strengthVal);
  const map: Record<number, keyof StrengthBreakdown> = {
    0: "sedentary",
    1: "light",
    2: "medium",
    3: "heavy",
    4: "veryHeavy",
  };
  return map[rounded] ?? "sedentary";
}

// ─── Profile pass/fail check ────────────────────────────────────

/**
 * Check if a worker profile can access an occupation given its demands.
 * Returns { passes, failedTraits }.
 */
function checkAccess(
  profile: TraitVector,
  demands: TraitVector
): { passes: boolean; failedTraits: string[] } {
  const failedTraits: string[] = [];

  for (const trait of TRAIT_KEYS) {
    const capacity = profile[trait];
    const demand = demands[trait];

    if (capacity !== null && demand !== null) {
      if (capacity < demand) {
        failedTraits.push(TRAIT_LABELS[trait]);
      }
    }
  }

  return { passes: failedTraits.length === 0, failedTraits };
}

// ─── Main Engine ────────────────────────────────────────────────

export interface LaborMarketAccessInput {
  preProfile: TraitVector;
  postProfile: TraitVector;
  maxSvp: number;
  areaCode?: string;

  // Pre-loaded data (to avoid re-fetching in compute route)
  crosswalkData: CrosswalkEntry[];
  areaWageData?: AreaWageEntry[];

  // Pre-loaded DOT records keyed by dotCode
  dotRecords?: Record<string, DOTOccupationData>;
}

/**
 * Compute the full labor market access analysis.
 *
 * For each of the 831 OEWS occupations:
 * 1. Find matching DOT records via crosswalk (O*NET SOC → DOT)
 * 2. Build demand vectors from DOT data
 * 3. Apply SVP gate
 * 4. Compare PRE and POST profiles against demands
 * 5. Aggregate results
 */
export async function computeLaborMarketAccess(
  input: LaborMarketAccessInput
): Promise<LaborMarketAccessResult> {
  const { preProfile, postProfile, maxSvp, areaCode, crosswalkData, areaWageData } = input;

  // Load datasets
  const [oewsData, dotData, orsData] = await Promise.all([
    loadOEWSData(),
    input.dotRecords ? Promise.resolve(input.dotRecords) : loadDOTData(),
    loadORSData(),
  ]);

  // Build crosswalk index: SOC base code (e.g., "43-4051") → DOT codes
  // O*NET codes are "XX-XXXX.XX", SOC codes in OEWS are "XX-XXXX"
  const socToDotCodes = new Map<string, string[]>();
  for (const cw of crosswalkData) {
    // Extract SOC base from O*NET code: "43-4051.00" → "43-4051"
    const socBase = cw.onetSocCode.replace(/\.\d+$/, "");
    if (!socToDotCodes.has(socBase)) {
      socToDotCodes.set(socBase, []);
    }
    socToDotCodes.get(socBase)!.push(cw.dotCode);
  }

  // Build area employment index if available
  const areaEmploymentMap = new Map<string, number>();
  if (areaWageData) {
    for (const aw of areaWageData) {
      const socBase = aw.onetSocCode.replace(/\.\d+$/, "");
      if (aw.employment !== null) {
        // Sum across sub-codes for the same SOC base
        areaEmploymentMap.set(socBase, (areaEmploymentMap.get(socBase) ?? 0) + aw.employment);
      }
    }
  }

  // Tracking
  let totalAnalyzed = 0;
  let preAccessible = 0;
  let postAccessible = 0;
  let preEmployment = 0;
  let postEmployment = 0;
  let preAreaEmployment = 0;
  let postAreaEmployment = 0;

  const preByStrength: StrengthBreakdown = { sedentary: 0, light: 0, medium: 0, heavy: 0, veryHeavy: 0 };
  const postByStrength: StrengthBreakdown = { sedentary: 0, light: 0, medium: 0, heavy: 0, veryHeavy: 0 };

  const failingTraitCounts = new Map<string, number>();

  const lostOccs: OccupationAccessDetail[] = [];
  const retainedOccs: OccupationAccessDetail[] = [];
  const gainedOccs: OccupationAccessDetail[] = [];

  // Process each OEWS occupation
  for (const [socCode, oewsOcc] of Object.entries(oewsData)) {
    const employment = oewsOcc.e ?? 0;
    if (employment <= 0) continue; // Skip occupations with no employment data

    totalAnalyzed++;

    // Find matching DOT records for this SOC
    const matchingDotCodes = socToDotCodes.get(socCode) ?? [];
    const matchingDotRecords = matchingDotCodes
      .map(dc => dotData[dc])
      .filter(Boolean);

    // Get ORS data (uses 6-digit code without dash)
    const orsCode = socCode.replace("-", "");
    const orsRecord = orsData[orsCode];

    // Build demand vector from the best available data
    let demands: TraitVector;
    let svpForOcc: number;
    let strengthVal: number | null;

    if (matchingDotRecords.length > 0) {
      // Use the first (most representative) DOT record
      // For occupations with multiple DOT codes, we use the one with
      // the most common strength level as representative
      const dotRec = selectRepresentativeDOT(matchingDotRecords);
      const { demands: d } = buildDOTDemandVector({
        gedR: dotRec.r,
        gedM: dotRec.m,
        gedL: dotRec.l,
        strength: dotRec.str,
        svp: dotRec.s,
        data: dotRec.dpt?.data,
        people: dotRec.dpt?.people,
        things: dotRec.dpt?.things,
      });

      // Override with ORS data where available
      if (orsRecord) {
        const orsTraits = mapORSToTraitsSimple(orsRecord);
        for (const [key, val] of Object.entries(orsTraits)) {
          if (val !== null && val !== undefined) {
            (d as Record<string, number | null>)[key] = val;
          }
        }
      }

      demands = d;
      svpForOcc = dotRec.s; // SVP from DOT compact format
      strengthVal = demands.strength;
    } else if (orsRecord) {
      // No DOT match but have ORS data
      const orsTraits = mapORSToTraitsSimple(orsRecord);
      const { demands: d } = buildOccupationDemands(
        orsTraits as Record<string, unknown>,
        null,
        null
      );
      demands = d;
      svpForOcc = 4; // Default mid-range SVP when no DOT data
      strengthVal = demands.strength;
    } else {
      // No DOT or ORS data — skip this occupation
      // (We can't meaningfully assess demands without source data)
      continue;
    }

    // ─── SVP Gate ─────────────────────────────────────────────
    // Worker can only access jobs with SVP <= their max SVP
    // Per SSA transferability rules, you can only transfer DOWN in SVP
    if (svpForOcc > maxSvp) {
      // Skip — worker lacks training for this occupation
      continue;
    }

    // ─── Area employment lookup ───────────────────────────────
    const areaEmpl = areaEmploymentMap.get(socCode) ?? 0;

    // ─── PRE-injury access check ──────────────────────────────
    const preCheck = checkAccess(preProfile, demands);

    // ─── POST-injury access check ─────────────────────────────
    const postCheck = checkAccess(postProfile, demands);

    const strCat = strengthCategory(strengthVal);
    const strLabel = strengthLabel(strengthVal);

    if (preCheck.passes) {
      preAccessible++;
      preEmployment += employment;
      preAreaEmployment += areaEmpl;
      preByStrength[strCat]++;
    }

    if (postCheck.passes) {
      postAccessible++;
      postEmployment += employment;
      postAreaEmployment += areaEmpl;
      postByStrength[strCat]++;
    }

    // Categorize: lost, retained, or gained
    if (preCheck.passes && !postCheck.passes) {
      // Lost access
      for (const trait of postCheck.failedTraits) {
        failingTraitCounts.set(trait, (failingTraitCounts.get(trait) ?? 0) + 1);
      }
      lostOccs.push({
        code: socCode,
        title: oewsOcc.t,
        employment,
        areaEmployment: areaEmpl,
        strength: strLabel,
        failedTraits: postCheck.failedTraits,
      });
    } else if (preCheck.passes && postCheck.passes) {
      // Retained
      retainedOccs.push({
        code: socCode,
        title: oewsOcc.t,
        employment,
        areaEmployment: areaEmpl,
        strength: strLabel,
      });
    } else if (!preCheck.passes && postCheck.passes) {
      // Gained (rare — post-injury somehow passes but pre doesn't)
      gainedOccs.push({
        code: socCode,
        title: oewsOcc.t,
        employment,
        areaEmployment: areaEmpl,
        strength: strLabel,
      });
    }
  }

  // Sort by employment descending and cap at 50
  const sortByEmployment = (a: OccupationAccessDetail, b: OccupationAccessDetail) =>
    b.employment - a.employment;

  lostOccs.sort(sortByEmployment);
  retainedOccs.sort(sortByEmployment);
  gainedOccs.sort(sortByEmployment);

  // Build failing traits summary
  const mostCommonFailingTraits = [...failingTraitCounts.entries()]
    .map(([trait, count]) => ({ trait, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Compute loss metrics
  const occupationsLost = preAccessible - postAccessible + gainedOccs.length;
  const employmentLost = preEmployment - postEmployment;
  const areaEmploymentLost = preAreaEmployment - postAreaEmployment;

  return {
    totalOccupationsAnalyzed: totalAnalyzed,

    preInjuryAccessible: preAccessible,
    preInjuryEmployment: preEmployment,
    preInjuryAreaEmployment: preAreaEmployment,

    postInjuryAccessible: postAccessible,
    postInjuryEmployment: postEmployment,
    postInjuryAreaEmployment: postAreaEmployment,

    occupationsLost: Math.max(0, occupationsLost),
    occupationsLostPct: preAccessible > 0
      ? Math.round((occupationsLost / preAccessible) * 10000) / 100
      : 0,
    employmentLost: Math.max(0, employmentLost),
    employmentLostPct: preEmployment > 0
      ? Math.round((employmentLost / preEmployment) * 10000) / 100
      : 0,
    areaEmploymentLost: Math.max(0, areaEmploymentLost),
    areaEmploymentLostPct: preAreaEmployment > 0
      ? Math.round((areaEmploymentLost / preAreaEmployment) * 10000) / 100
      : 0,

    preByStrength,
    postByStrength,

    mostCommonFailingTraits,

    lostOccupations: lostOccs.slice(0, 50),
    retainedOccupations: retainedOccs.slice(0, 50),
    gainedOccupations: gainedOccs.slice(0, 50),
  };
}

// ─── Helper: Select representative DOT record ───────────────────

/**
 * When multiple DOT records map to the same SOC, pick the most
 * representative one. Prefer the record with the median SVP and
 * most common strength level.
 */
function selectRepresentativeDOT(
  records: DOTOccupationData[]
): DOTOccupationData {
  if (records.length === 1) return records[0];

  // Use the record closest to the median SVP
  const svps = records.map(r => r.s).sort((a, b) => a - b);
  const medianSvp = svps[Math.floor(svps.length / 2)];

  // Among those with median SVP, prefer the first one
  const atMedian = records.filter(r => r.s === medianSvp);
  return atMedian[0] ?? records[0];
}

// ─── Helper: Simplified ORS → Traits mapping ───────────────────

/**
 * Simplified version that adapts the raw ORS data loader format
 * (compact keys: p, e) to the mapORSToTraits function from traits.ts.
 */
function mapORSToTraitsSimple(
  orsRecord: ORSOccupationData
): Record<string, number | null> {
  const physicalDemands = orsRecord.p ?? null;
  const envConditions = orsRecord.e ?? null;

  return mapORSToTraits(
    physicalDemands as Record<string, { t: string; v: string | number }[]> | null,
    envConditions as Record<string, { t: string; v: string | number }[]> | null
  ) as Record<string, number | null>;
}
