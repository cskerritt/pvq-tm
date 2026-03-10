/**
 * MVQS Earning Capacity Estimation
 *
 * Uses VQ Band structure with published MVQS validity research (SEE and Rxy)
 * combined with real OEWS wage data to produce earning capacity estimates
 * with confidence intervals and geographic adjustments (ECLR).
 *
 * VQ Band SEE values from published MVQS research:
 *   McCroskey, Dennis, Wilkinson, et al. (2011 draft).
 *   Year 2007 SOC Data curvilinear regression results.
 *
 * ECLR (Earning Capacity Link Relatives) adjust national VQ-predicted
 * wages to local labor market conditions. Computed as:
 *   ECLR = areaMedianWage / nationalMedianWage for the same SOC code.
 *
 * References:
 *   McCroskey et al. (2011). Predictive Validity (Rxy) and Standard Errors
 *     of Estimate (SEE) for the MVQS VQ Job Difficulty Index.
 *   U.S. DOL Occupational Employment Statistics (OES) program.
 */

// ─── Published MVQS Band-Level Statistics ────────────────────────────────────
// Source: MVQS methodology document §4, Table 4a

export interface VQBandStats {
  band: 1 | 2 | 3 | 4;
  rxyMean: number;    // Predictive validity coefficient for mean wages
  rxyMedian: number;  // Predictive validity coefficient for median wages
  seeMean: number;    // Standard Error of Estimate for mean wages ($/hr)
  seeMedian: number;  // SEE for median wages ($/hr)
  seeP10: number;     // SEE for 10th percentile
  seeP90: number;     // SEE for 90th percentile
}

export const VQ_BAND_STATS: readonly VQBandStats[] = Object.freeze([
  {
    band: 1,
    rxyMean: 0.96,
    rxyMedian: 0.96,
    seeMean: 0.25,
    seeMedian: 0.20,
    seeP10: 0.15,
    seeP90: 0.63,
  },
  {
    band: 2,
    rxyMean: 0.98,
    rxyMedian: 0.98,
    seeMean: 0.38,
    seeMedian: 0.27,
    seeP10: 0.20,
    seeP90: 0.63,
  },
  {
    band: 3,
    rxyMean: 0.92,
    rxyMedian: 0.92,
    seeMean: 2.00,
    seeMedian: 1.32,
    seeP10: 0.90,
    seeP90: 3.04,
  },
  {
    band: 4,
    rxyMean: 0.83,
    rxyMedian: 0.83,
    seeMean: 12.47,
    seeMedian: 8.69,
    seeP10: 6.00,
    seeP90: 19.26,
  },
]);

// ─── Result Types ────────────────────────────────────────────────────────────

export interface EarningCapacityResult {
  // Wage data ($/hr) — from OEWS, optionally ECLR-adjusted
  median: number | null;
  mean: number | null;
  p10: number | null;
  p25: number | null;
  p75: number | null;
  p90: number | null;

  // VQ band statistics
  band: 1 | 2 | 3 | 4;
  rxy: number;      // Predictive validity coefficient
  see: number;      // Standard Error of Estimate ($/hr)

  // Confidence intervals (95%, ±1.96 × SEE around median)
  confLow: number | null;   // Lower bound
  confHigh: number | null;  // Upper bound

  // Geographic adjustment
  eclrApplied: boolean;
  eclrFactor: number | null;
  areaCode: string | null;
  areaName: string | null;
}

export interface OEWSWageData {
  medianWage: number | null; // annual
  meanWage: number | null;   // annual
  pct10: number | null;
  pct25: number | null;
  pct75: number | null;
  pct90: number | null;
  employment: number | null;
}

// ─── ECLR Computation ───────────────────────────────────────────────────────

/**
 * Compute the Earning Capacity Link Relative for a specific geographic area.
 *
 * ECLR = areaMedianWage / nationalMedianWage
 *
 * A value > 1.0 means the area pays more than national average.
 * A value < 1.0 means it pays less.
 * Returns 1.0 if data is insufficient.
 */
export function computeECLR(
  areaMedianWage: number | null,
  nationalMedianWage: number | null
): number {
  if (!areaMedianWage || !nationalMedianWage || nationalMedianWage === 0) {
    return 1.0;
  }
  // Clamp to reasonable range (0.5 - 2.0)
  const eclr = areaMedianWage / nationalMedianWage;
  return Math.round(Math.max(0.5, Math.min(2.0, eclr)) * 10000) / 10000;
}

// ─── Earning Capacity Computation ───────────────────────────────────────────

/**
 * Convert annual wage to hourly (assuming 2080 hours/year).
 */
function annualToHourly(annual: number | null): number | null {
  if (annual === null || annual === undefined) return null;
  return Math.round((annual / 2080) * 100) / 100;
}

/**
 * Compute earning capacity estimate for an occupation.
 *
 * Uses real OEWS wage data as the base, applies ECLR geographic adjustment,
 * and adds VQ-band-specific SEE and confidence intervals from MVQS research.
 *
 * @param band - VQ Band (1-4) for the occupation
 * @param wages - OEWS wage data (national level, annual)
 * @param eclrFactor - Geographic wage adjustment multiplier (1.0 = no adjustment)
 * @param areaCode - Metro area code for reference
 * @param areaName - Metro area name for reference
 */
export function computeEarningCapacity(
  band: 1 | 2 | 3 | 4,
  wages: OEWSWageData | null,
  eclrFactor: number = 1.0,
  areaCode?: string | null,
  areaName?: string | null
): EarningCapacityResult {
  const bandStats = VQ_BAND_STATS.find((b) => b.band === band)!;
  const eclrApplied = eclrFactor !== 1.0;

  if (!wages || wages.medianWage === null) {
    return {
      median: null,
      mean: null,
      p10: null,
      p25: null,
      p75: null,
      p90: null,
      band,
      rxy: bandStats.rxyMedian,
      see: bandStats.seeMedian,
      confLow: null,
      confHigh: null,
      eclrApplied,
      eclrFactor: eclrApplied ? eclrFactor : null,
      areaCode: areaCode ?? null,
      areaName: areaName ?? null,
    };
  }

  // Convert annual OEWS wages to hourly and apply ECLR
  const applyECLR = (hourly: number | null): number | null => {
    if (hourly === null) return null;
    return Math.round(hourly * eclrFactor * 100) / 100;
  };

  const median = applyECLR(annualToHourly(wages.medianWage));
  const mean = applyECLR(annualToHourly(wages.meanWage));
  const p10 = applyECLR(annualToHourly(wages.pct10));
  const p25 = applyECLR(annualToHourly(wages.pct25));
  const p75 = applyECLR(annualToHourly(wages.pct75));
  const p90 = applyECLR(annualToHourly(wages.pct90));

  // 95% confidence interval = median ± 1.96 × SEE
  const see = bandStats.seeMedian;
  const confLow = median !== null ? Math.round((median - 1.96 * see) * 100) / 100 : null;
  const confHigh = median !== null ? Math.round((median + 1.96 * see) * 100) / 100 : null;

  return {
    median,
    mean,
    p10,
    p25,
    p75,
    p90,
    band,
    rxy: bandStats.rxyMedian,
    see,
    confLow: confLow !== null ? Math.max(0, confLow) : null, // Floor at $0
    confHigh,
    eclrApplied,
    eclrFactor: eclrApplied ? eclrFactor : null,
    areaCode: areaCode ?? null,
    areaName: areaName ?? null,
  };
}

/**
 * Format earning capacity result for display.
 */
export function formatEC(hourly: number | null): string {
  if (hourly === null) return "—";
  return `$${hourly.toFixed(2)}/hr`;
}

/**
 * Format earning capacity as annual.
 */
export function formatECAnnual(hourly: number | null): string {
  if (hourly === null) return "—";
  const annual = hourly * 2080;
  return `$${annual.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
