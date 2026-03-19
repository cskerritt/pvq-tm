/**
 * Local Demand Engine
 *
 * Computes a 3-part local demand signal for a target occupation
 * within a ZIP market. Replaces the simpler "Area Employment" component
 * in LMQ with a richer composite:
 *
 *   1. Posting Score (50%)   — CareerOneStop deduplicated 90-day postings
 *   2. Structural Base (30%) — ZIP occupation employment from Census ZBP + BLS staffing
 *   3. Hiring Momentum (20%) — QWI county/MSA hire-flow data
 *
 * When components are missing (API unavailable, no data), weights
 * redistribute proportionally to available components — same pattern as LMQ.
 *
 * Output is labeled "ZIP market" — these are demand indicators,
 * not verified hires or exact ZIP employment counts.
 */

// ─── Types ─────────────────────────────────────────────────────────────

export interface LocalDemandInput {
  zip: string;
  onetSocCode: string;
  radius?: number; // default: 10 miles urban, 25 miles rural
  countyFips?: string;
  msaCode?: string;
  stateFips?: string;
  isMetro?: boolean;
}

export interface PostingData {
  totalCount: number;
  dedupedCount: number;
  radiusMiles: number;
  windowDays: number;
}

export interface StructuralData {
  estimatedEmployment: number;
  topIndustries: Array<{ naics: string; name: string; employment: number }>;
}

export interface HiringData {
  totalHires: number | null;
  avgQuarterlyHires: number | null;
  avgQuarterlyEmployment: number | null;
  hireRate: number | null; // hires / employment
  geography: "county" | "msa" | "state";
  geographyName: string;
}

export interface LocalDemandResult {
  localDemandScore: number; // 0-100, replaces Area Employment score in LMQ
  components: {
    postingScore: number | null; // 0-100
    structuralScore: number | null; // 0-100
    hiringMomentumScore: number | null; // 0-100
  };
  details: {
    postings: {
      totalCount: number;
      dedupedCount: number;
      radiusMiles: number;
      windowDays: number;
      percentileRank: number | null;
    } | null;
    structural: {
      estimatedEmployment: number | null;
      topIndustries: Array<{ naics: string; name: string; employment: number }>;
      percentileRank: number | null;
    } | null;
    hiringMomentum: {
      totalHires: number | null;
      hireRate: number | null;
      geography: string; // "county" or "MSA"
      geographyName: string;
      percentileRank: number | null;
    } | null;
    localWageCheck: {
      medianWage: number | null;
      source: string;
    } | null;
    anchorZip: string;
    radiusUsed: number;
    dataLabel: string; // "ZIP market" not "exact ZIP hires"
  };
  weightsUsed: Record<string, number>;
}

// ─── Scoring Functions ─────────────────────────────────────────────────

/**
 * Score deduplicated 90-day posting count (0-100).
 *
 * Thresholds reflect aggregate employer demand within a ZIP market radius:
 *   > 500 postings = 100 (very high demand)
 *   > 200 = 80
 *   > 50  = 60
 *   > 10  = 40
 *   > 0   = 20
 *   = 0   = 5
 */
function scorePostings(dedupedCount: number): number {
  if (dedupedCount > 500) return 100;
  if (dedupedCount > 200) return 80;
  if (dedupedCount > 50) return 60;
  if (dedupedCount > 10) return 40;
  if (dedupedCount > 0) return 20;
  return 5;
}

/**
 * Score estimated occupation employment from structural data (0-100).
 *
 * Based on the cross-industry staffing pattern estimate for the ZIP:
 *   > 5,000 = 100
 *   > 2,000 = 80
 *   > 500   = 60
 *   > 100   = 40
 *   > 20    = 20
 *   <= 20   = 5
 */
function scoreStructural(estimatedEmployment: number): number {
  if (estimatedEmployment > 5000) return 100;
  if (estimatedEmployment > 2000) return 80;
  if (estimatedEmployment > 500) return 60;
  if (estimatedEmployment > 100) return 40;
  if (estimatedEmployment > 20) return 20;
  return 5;
}

/**
 * Score hiring momentum from QWI hire rate (0-100).
 *
 * Hire rate = quarterly hires / quarterly employment.
 * A rate of 0.10 means 10% of jobs turned over (new hires) per quarter.
 *
 *   > 0.15 = 100 (15%+ quarterly hire rate — very active)
 *   > 0.10 = 80
 *   > 0.06 = 60
 *   > 0.03 = 40
 *   > 0    = 20
 *   = 0 or null = 5
 */
function scoreHiringMomentum(hireRate: number | null): number {
  if (hireRate === null || hireRate === 0) return 5;
  if (hireRate > 0.15) return 100;
  if (hireRate > 0.10) return 80;
  if (hireRate > 0.06) return 60;
  if (hireRate > 0.03) return 40;
  return 20;
}

// ─── Main Computation ──────────────────────────────────────────────────

/**
 * Compute the Local Demand composite score.
 *
 * Base weights (when all data available):
 *   50% Posting Score
 *   30% Structural Base Score
 *   20% Hiring Momentum Score
 *
 * When components are missing, their weights redistribute proportionally
 * to the remaining available components (same pattern as LMQ).
 *
 * @param postingData - Deduplicated posting counts from CareerOneStop
 * @param structuralData - Estimated employment from ZBP + staffing patterns
 * @param hiringData - QWI hire-flow data
 * @param anchorZip - The anchor ZIP code
 * @param radiusUsed - The radius (miles) used for the posting search
 * @param localWage - Optional local wage check data
 */
export function computeLocalDemand(
  postingData: PostingData | null,
  structuralData: StructuralData | null,
  hiringData: HiringData | null,
  anchorZip: string = "",
  radiusUsed: number = 10,
  localWage?: { medianWage: number | null; source: string } | null,
): LocalDemandResult {
  // Build weighted components dynamically based on available data
  const components: { name: string; weight: number; score: number }[] = [];

  let postingScore: number | null = null;
  let structuralScore: number | null = null;
  let hiringMomentumScore: number | null = null;

  if (postingData !== null) {
    postingScore = scorePostings(postingData.dedupedCount);
    components.push({ name: "posting", weight: 0.50, score: postingScore });
  }

  if (structuralData !== null) {
    structuralScore = scoreStructural(structuralData.estimatedEmployment);
    components.push({ name: "structural", weight: 0.30, score: structuralScore });
  }

  if (hiringData !== null) {
    hiringMomentumScore = scoreHiringMomentum(hiringData.hireRate);
    components.push({ name: "hiringMomentum", weight: 0.20, score: hiringMomentumScore });
  }

  // Compute weighted composite with dynamic weight redistribution
  let localDemandScore: number;
  const weightsUsed: Record<string, number> = {};

  if (components.length === 0) {
    // No data at all — return neutral score
    localDemandScore = 50;
    weightsUsed["none"] = 1.0;
  } else {
    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    localDemandScore = 0;

    for (const c of components) {
      const normalizedWeight = c.weight / totalWeight;
      weightsUsed[c.name] = Math.round(normalizedWeight * 1000) / 1000;
      localDemandScore += normalizedWeight * c.score;
    }

    localDemandScore = Math.round(localDemandScore * 100) / 100;
  }

  // Build the detailed result
  return {
    localDemandScore,
    components: {
      postingScore,
      structuralScore,
      hiringMomentumScore,
    },
    details: {
      postings: postingData
        ? {
            totalCount: postingData.totalCount,
            dedupedCount: postingData.dedupedCount,
            radiusMiles: postingData.radiusMiles,
            windowDays: postingData.windowDays,
            percentileRank: postingScore,
          }
        : null,
      structural: structuralData
        ? {
            estimatedEmployment: structuralData.estimatedEmployment,
            topIndustries: structuralData.topIndustries,
            percentileRank: structuralScore,
          }
        : null,
      hiringMomentum: hiringData
        ? {
            totalHires: hiringData.totalHires,
            hireRate: hiringData.hireRate,
            geography: hiringData.geography,
            geographyName: hiringData.geographyName,
            percentileRank: hiringMomentumScore,
          }
        : null,
      localWageCheck: localWage ?? null,
      anchorZip,
      radiusUsed,
      dataLabel: "ZIP market",
    },
    weightsUsed,
  };
}

/**
 * Determine the appropriate search radius based on metro/rural classification.
 *
 * Urban areas use a smaller radius (10 miles) since job markets are denser.
 * Rural areas use a larger radius (25 miles) to capture the practical commute area.
 *
 * @param isMetro - Whether the ZIP is in a metropolitan statistical area
 * @returns Radius in miles
 */
export function getDefaultRadius(isMetro: boolean): number {
  return isMetro ? 10 : 25;
}
