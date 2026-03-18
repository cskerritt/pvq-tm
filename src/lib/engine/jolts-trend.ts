/**
 * JOLTS Trend Analysis Engine
 *
 * Computes labor market trends from multi-year JOLTS data using
 * linear regression. Returns a normalized trend score that feeds
 * into the LMQ calculation.
 */

export interface JOLTSTrendResult {
  /** Normalized trend from -1 (strongly declining) to +1 (strongly growing) */
  trend: number;
  /** Raw slope in thousands/year */
  slope: number;
  /** Qualitative label */
  label: "strongly_growing" | "growing" | "stable" | "declining" | "strongly_declining";
  /** Number of years of data used */
  yearsUsed: number;
  /** Annual growth rate as percentage */
  annualGrowthPct: number;
}

/**
 * Compute JOLTS trend from multi-year data using linear regression.
 *
 * @param yearlyData Map of year → { jobOpenings, hires } (values in thousands)
 * @param windowYears Number of recent years to analyze (default 5)
 * @returns Trend analysis result
 */
export function computeJOLTSTrend(
  yearlyData: Map<number, { jobOpenings: number | null; hires: number | null }>,
  windowYears: number = 5
): JOLTSTrendResult {
  // Get sorted years with valid job opening data
  const validEntries: { year: number; openings: number }[] = [];
  for (const [year, data] of yearlyData) {
    if (data.jobOpenings !== null && data.jobOpenings > 0) {
      validEntries.push({ year, openings: data.jobOpenings });
    }
  }

  if (validEntries.length < 2) {
    return {
      trend: 0,
      slope: 0,
      label: "stable",
      yearsUsed: validEntries.length,
      annualGrowthPct: 0,
    };
  }

  // Sort by year descending, take most recent windowYears
  validEntries.sort((a, b) => b.year - a.year);
  const recent = validEntries.slice(0, windowYears);
  recent.reverse(); // chronological order for regression

  // Simple linear regression: openings = slope * year + intercept
  const n = recent.length;
  const sumX = recent.reduce((s, e) => s + e.year, 0);
  const sumY = recent.reduce((s, e) => s + e.openings, 0);
  const sumXY = recent.reduce((s, e) => s + e.year * e.openings, 0);
  const sumX2 = recent.reduce((s, e) => s + e.year * e.year, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return {
      trend: 0,
      slope: 0,
      label: "stable",
      yearsUsed: n,
      annualGrowthPct: 0,
    };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const meanY = sumY / n;

  // Annual growth rate as percentage of mean
  const annualGrowthPct = meanY > 0 ? (slope / meanY) * 100 : 0;

  // Normalize to -1 to +1 range
  // ±10% annual growth maps to ±1.0
  const trend = Math.max(-1, Math.min(1, annualGrowthPct / 10));

  // Determine label
  let label: JOLTSTrendResult["label"];
  if (annualGrowthPct > 5) label = "strongly_growing";
  else if (annualGrowthPct > 1) label = "growing";
  else if (annualGrowthPct >= -1) label = "stable";
  else if (annualGrowthPct >= -5) label = "declining";
  else label = "strongly_declining";

  return {
    trend: Math.round(trend * 1000) / 1000,
    slope: Math.round(slope * 10) / 10,
    label,
    yearsUsed: n,
    annualGrowthPct: Math.round(annualGrowthPct * 100) / 100,
  };
}
