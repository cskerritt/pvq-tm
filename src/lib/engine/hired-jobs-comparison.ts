/**
 * Hired Jobs Access Comparison Engine
 *
 * Compares a worker's pre-injury and post-injury trait profiles against
 * the most frequently hired jobs in their area to determine which jobs
 * they could have done before vs after injury.
 *
 * Uses SOC major group-level trait demand profiles (simplified from DOT)
 * to assess whether a worker meets the typical demands of each occupation group.
 */

import { TraitVector, TRAIT_KEYS, type TraitKey } from "@/lib/engine/traits";
import { type FrequentlyHiredJob } from "@/lib/engine/hired-jobs";

// ─── SOC Major Group Trait Demands ──────────────────────────────────────
//
// Simplified trait vectors representing typical demands for each SOC major
// occupation group. Uses the DOT trait system (0-4 scale).
// For any trait not specified, the default demand is 1 (low).

const SOC_TRAIT_DEMANDS: Record<string, Partial<TraitVector>> = {
  "11": { reasoning: 3, math: 3, language: 3, strength: 1 }, // Management
  "13": { reasoning: 3, math: 3, language: 2, clericalPerception: 3, strength: 0 }, // Business/Financial
  "15": { reasoning: 4, math: 4, language: 2, strength: 0 }, // Computer/Math
  "17": { reasoning: 4, math: 4, spatialPerception: 3, strength: 1 }, // Architecture/Engineering
  "19": { reasoning: 4, math: 3, language: 3, strength: 1 }, // Life/Physical/Social Science
  "21": { reasoning: 2, language: 3, strength: 1 }, // Community/Social Service
  "23": { reasoning: 4, language: 4, strength: 0 }, // Legal
  "25": { reasoning: 3, language: 3, strength: 1 }, // Education
  "27": { reasoning: 2, language: 2, spatialPerception: 2, fingerDexterity: 2, strength: 1 }, // Arts/Entertainment
  "29": { reasoning: 3, math: 2, language: 2, fingerDexterity: 3, strength: 2 }, // Healthcare Practitioners
  "31": { reasoning: 1, language: 1, strength: 2, stoopKneel: 2 }, // Healthcare Support
  "33": { reasoning: 2, language: 2, strength: 3, motorCoordination: 2 }, // Protective Service
  "35": { reasoning: 1, language: 1, strength: 2, motorCoordination: 2, extremeHeat: 2 }, // Food Prep/Serving
  "37": { reasoning: 1, strength: 3, stoopKneel: 3, dustsFumes: 2 }, // Building/Grounds Cleaning
  "39": { reasoning: 1, language: 2, strength: 1 }, // Personal Care
  "41": { reasoning: 2, math: 2, language: 3, clericalPerception: 2, strength: 1 }, // Sales
  "43": { reasoning: 2, math: 2, language: 2, clericalPerception: 3, fingerDexterity: 2, strength: 0 }, // Office/Admin Support
  "45": { reasoning: 1, strength: 3, workLocation: 3, extremeHeat: 2 }, // Farming/Fishing/Forestry
  "47": { reasoning: 2, math: 1, strength: 3, climbBalance: 3, stoopKneel: 3, hazards: 2, dustsFumes: 2 }, // Construction/Extraction
  "49": { reasoning: 2, math: 2, motorCoordination: 3, fingerDexterity: 3, strength: 2, hazards: 2 }, // Installation/Maintenance/Repair
  "51": { reasoning: 1, motorCoordination: 2, manualDexterity: 3, strength: 2, noiseVibration: 2 }, // Production
  "53": { reasoning: 1, strength: 3, motorCoordination: 2, eyeHandFoot: 2 }, // Transportation/Material Moving
};

/** Default demand level for traits not explicitly specified in a SOC profile */
const DEFAULT_DEMAND = 1;

// ─── Types ──────────────────────────────────────────────────────────────

export interface HiredJobComparison {
  job: FrequentlyHiredJob;
  typicalDemands: Partial<TraitVector>;
  preInjury: {
    canPerform: boolean;
    failingTraits: string[];
    marginAvg: number;
  };
  postInjury: {
    canPerform: boolean;
    failingTraits: string[];
    marginAvg: number;
  };
  /** Could do pre-injury but cannot do post-injury */
  accessLost: boolean;
}

export interface HiredJobsComparisonResult {
  totalJobs: number;
  preInjuryAccessible: number;
  postInjuryAccessible: number;
  accessLost: number;
  accessRetained: number;
  neverAccessible: number;
  reductionPercent: number;
  comparisons: HiredJobComparison[];
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Get the trait demand profile for a SOC major group code.
 * Returns the explicit demands from SOC_TRAIT_DEMANDS, with all
 * unspecified traits defaulting to DEFAULT_DEMAND.
 */
function getDemandsForSOC(socCode: string): Partial<TraitVector> {
  return SOC_TRAIT_DEMANDS[socCode] ?? {};
}

/**
 * Get the effective demand value for a specific trait in a demand profile.
 * Uses the explicit value if present, otherwise DEFAULT_DEMAND.
 */
function effectiveDemand(demands: Partial<TraitVector>, trait: TraitKey): number {
  const val = demands[trait];
  return val !== undefined && val !== null ? val : DEFAULT_DEMAND;
}

/**
 * Get the effective worker capacity for a trait.
 * Null worker values are treated as 0 (cannot perform).
 */
function effectiveCapacity(profile: TraitVector, trait: TraitKey): number {
  const val = profile[trait];
  return val !== null && val !== undefined ? val : 0;
}

/**
 * Assess whether a worker can perform a job given a demand profile.
 * A worker "can perform" if ALL trait capacities meet or exceed demands.
 *
 * Returns whether they can perform, which traits fail, and average margin.
 */
function assessAccess(
  workerProfile: TraitVector,
  demands: Partial<TraitVector>
): { canPerform: boolean; failingTraits: string[]; marginAvg: number } {
  const failingTraits: string[] = [];
  let totalMargin = 0;
  let traitCount = 0;

  for (const trait of TRAIT_KEYS) {
    const demand = effectiveDemand(demands, trait);
    const capacity = effectiveCapacity(workerProfile, trait);
    const margin = capacity - demand;

    totalMargin += margin;
    traitCount++;

    if (margin < 0) {
      failingTraits.push(trait);
    }
  }

  const marginAvg = traitCount > 0 ? totalMargin / traitCount : 0;

  return {
    canPerform: failingTraits.length === 0,
    failingTraits,
    marginAvg: Math.round(marginAvg * 100) / 100,
  };
}

// ─── Core Function ──────────────────────────────────────────────────────

/**
 * Compare a worker's pre-injury and post-injury trait profiles against
 * the most frequently hired jobs to determine access changes.
 *
 * @param frequentlyHiredJobs - List of frequently hired jobs (from hired-jobs.ts)
 * @param preInjuryProfile - Worker's pre-injury 24-trait profile
 * @param postInjuryProfile - Worker's post-injury 24-trait profile
 * @returns Structured comparison with summary statistics
 */
export function compareHiredJobsAccess(
  frequentlyHiredJobs: FrequentlyHiredJob[],
  preInjuryProfile: TraitVector,
  postInjuryProfile: TraitVector
): HiredJobsComparisonResult {
  const comparisons: HiredJobComparison[] = [];

  for (const job of frequentlyHiredJobs) {
    const demands = getDemandsForSOC(job.socCode);

    const preInjury = assessAccess(preInjuryProfile, demands);
    const postInjury = assessAccess(postInjuryProfile, demands);

    const accessLost = preInjury.canPerform && !postInjury.canPerform;

    comparisons.push({
      job,
      typicalDemands: demands,
      preInjury,
      postInjury,
      accessLost,
    });
  }

  const totalJobs = comparisons.length;
  const preInjuryAccessible = comparisons.filter((c) => c.preInjury.canPerform).length;
  const postInjuryAccessible = comparisons.filter((c) => c.postInjury.canPerform).length;
  const accessLost = comparisons.filter((c) => c.accessLost).length;
  const accessRetained = comparisons.filter(
    (c) => c.preInjury.canPerform && c.postInjury.canPerform
  ).length;
  const neverAccessible = comparisons.filter(
    (c) => !c.preInjury.canPerform && !c.postInjury.canPerform
  ).length;

  const reductionPercent =
    preInjuryAccessible > 0
      ? Math.round(((preInjuryAccessible - postInjuryAccessible) / preInjuryAccessible) * 100)
      : 0;

  return {
    totalJobs,
    preInjuryAccessible,
    postInjuryAccessible,
    accessLost,
    accessRetained,
    neverAccessible,
    reductionPercent,
    comparisons,
  };
}
