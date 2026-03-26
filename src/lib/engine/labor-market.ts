/**
 * Labor Market Engine (LMQ)
 *
 * Computes the Labor Market Quotient based on:
 * - National employment count
 * - Local Demand score (ZIP-level composite from postings, structural, hiring momentum)
 * - Wage comparison (target vs prior earnings)
 * - Projected openings & growth
 * - JOLTS trend (industry job openings direction)
 *
 * LMQ = weighted composite of all available scoring components.
 * When optional data (local demand, JOLTS) is unavailable,
 * weights redistribute proportionally to available components.
 */

export interface LaborMarketInput {
  employment: number | null;
  medianWage: number | null;
  meanWage: number | null;
  priorEarnings: number | null;
  projectedOpenings: number | null;
  projectedGrowthPct: number | null;
  pct10?: number | null;
  pct25?: number | null;
  pct75?: number | null;
  pct90?: number | null;
  // Local Demand score (0-100) from the Local Demand engine
  // Replaces the former areaEmployment raw count
  localDemandScore?: number | null;
  // Legacy field — still accepted for backward compatibility but
  // localDemandScore takes precedence when both are provided
  areaEmployment?: number | null;
  joltsTrend?: number | null;       // -1 to +1 normalized trend
  joltsOpenings?: number | null;    // current JOLTS openings (thousands)
  stateJoltsOpenings?: number | null; // state-level total nonfarm openings
}

export interface LMQResult {
  lmq: number;
  components: {
    employmentScore: number;
    localDemandScore: number | null;
    /** @deprecated Use localDemandScore. Kept for backward compatibility. */
    areaEmploymentScore: number | null;
    wageScore: number;
    projectionsScore: number;
    joltsTrendScore: number | null;
  };
  details: {
    employment: number | null;
    localDemandScore: number | null;
    /** @deprecated Use localDemandScore */
    areaEmployment: number | null;
    medianWage: number | null;
    meanWage: number | null;
    wageRatio: number | null;
    projectedOpenings: number | null;
    projectedGrowthPct: number | null;
    joltsOpenings: number | null;
    joltsTrend: number | null;
    stateJoltsOpenings: number | null;
    pct10: number | null;
    pct25: number | null;
    pct75: number | null;
    pct90: number | null;
    weightsUsed: Record<string, number>;
  };
}

/**
 * Score national employment count (0-100) using continuous log scaling.
 * Higher employment = more opportunity.
 *
 * Uses logarithmic interpolation to avoid cliff effects at thresholds.
 * Approximate mapping:
 *   100     → 10
 *   1,000   → 30
 *   5,000   → 45
 *   20,000  → 60
 *   50,000  → 75
 *   100,000 → 85
 *   500,000 → 100
 */
function scoreEmployment(employment: number | null): number {
  if (employment === null) return 50; // neutral if unknown
  if (employment <= 0) return 5;

  // Log-based continuous scoring: maps ~100 → 10, ~500k → 100
  const logScore = (Math.log10(Math.max(1, employment)) - 2) * (90 / 3.7) + 10;
  return Math.round(Math.max(5, Math.min(100, logScore)));
}

/**
 * Score area-level (metro) employment count (0-100) using continuous log scaling.
 * Lower thresholds than national since metro areas have smaller counts.
 *
 * Approximate mapping:
 *   10    → 10
 *   100   → 30
 *   500   → 50
 *   2,000 → 65
 *   5,000 → 75
 *   10,000 → 85
 *   50,000 → 100
 *
 * @deprecated Used as fallback when localDemandScore is not available.
 */
function scoreAreaEmployment(areaEmployment: number | null): number {
  if (areaEmployment === null) return -1; // signal: no data
  if (areaEmployment <= 0) return 5;

  // Log-based: maps ~10 → 10, ~50k → 100
  const logScore = (Math.log10(Math.max(1, areaEmployment)) - 1) * (90 / 3.7) + 10;
  return Math.round(Math.max(5, Math.min(100, logScore)));
}

/**
 * Score wage comparison (0-100) using continuous interpolation.
 * Compares target median wage against worker's prior earnings.
 *
 * With prior earnings: continuous mapping from ratio to score.
 *   ratio ≥ 1.0 → 100 (meets or exceeds prior earnings)
 *   ratio 0.0   → 10
 *   Linear interpolation between.
 *
 * Without prior earnings: continuous mapping from absolute wage.
 */
function scoreWage(
  medianWage: number | null,
  priorEarnings: number | null
): { score: number; ratio: number | null } {
  if (medianWage === null) return { score: 50, ratio: null };

  if (priorEarnings === null || priorEarnings === 0) {
    // No prior earnings — continuous score on absolute wage
    // Maps: $15k→20, $30k→45, $45k→65, $60k→80, $80k+→100
    const absScore = (medianWage / 80000) * 100;
    return {
      score: Math.round(Math.max(10, Math.min(100, absScore))),
      ratio: null,
    };
  }

  const ratio = medianWage / priorEarnings;

  // Continuous: ratio 0→10, ratio 1.0→100, capped at 100
  const score = 10 + Math.min(90, ratio * 90);
  return {
    score: Math.round(Math.max(10, Math.min(100, score))),
    ratio,
  };
}

/**
 * Score projected employment (0-100) using continuous interpolation.
 *
 * Scores growth and openings independently, then averages.
 *
 * Growth: continuous mapping from -10% → 10 to +15% → 100
 * Openings: log-scaled continuous mapping
 */
function scoreProjections(
  projectedOpenings: number | null,
  projectedGrowthPct: number | null
): number {
  if (projectedOpenings === null && projectedGrowthPct === null) return 50;

  let growthScore: number;
  if (projectedGrowthPct === null) {
    growthScore = 50;
  } else {
    // Linear: -10% → 10, 0% → 50, +15% → 100
    growthScore = 50 + (projectedGrowthPct / 15) * 50;
    growthScore = Math.max(10, Math.min(100, Math.round(growthScore)));
  }

  let openingsScore: number;
  if (projectedOpenings === null) {
    openingsScore = 50;
  } else if (projectedOpenings <= 0) {
    openingsScore = 10;
  } else {
    // Log-based: ~100 → 20, ~1000 → 45, ~5000 → 65, ~10000 → 75, ~50000 → 100
    openingsScore = (Math.log10(Math.max(1, projectedOpenings)) - 1.5) * (90 / 3.2) + 20;
    openingsScore = Math.max(10, Math.min(100, Math.round(openingsScore)));
  }

  return Math.round((growthScore + openingsScore) / 2);
}

/**
 * Score JOLTS trend (0-100).
 * Maps the -1 to +1 trend score to 0-100.
 *
 * +1.0 (strongly growing)  = 100
 * +0.5 (growing)           = 80
 *  0.0 (stable)            = 60
 * -0.5 (declining)         = 40
 * -1.0 (strongly declining) = 20
 */
function scoreJOLTSTrend(trend: number | null): number {
  if (trend === null) return -1; // signal: no data

  // Linear mapping: trend -1→20, 0→60, +1→100
  const score = 60 + trend * 40;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Resolve the local demand component score.
 *
 * Priority:
 *   1. localDemandScore (pre-computed by Local Demand engine) — used directly
 *   2. areaEmployment (legacy raw count) — scored via scoreAreaEmployment()
 *   3. Neither available — returns -1 (signal: no data, weight redistributes)
 */
function resolveLocalDemandScore(input: LaborMarketInput): number {
  // If the new Local Demand score is provided, use it directly (already 0-100)
  if (input.localDemandScore !== undefined && input.localDemandScore !== null) {
    return Math.max(0, Math.min(100, input.localDemandScore));
  }

  // Fall back to legacy area employment scoring
  return scoreAreaEmployment(input.areaEmployment ?? null);
}

/**
 * Compute the Labor Market Quotient (LMQ).
 *
 * Base weights (when all data available):
 * - 25% national employment score
 * - 15% local demand score (ZIP market composite)
 * - 25% wage score
 * - 20% projections score
 * - 15% JOLTS trend score
 *
 * When optional components (local demand, JOLTS) are unavailable,
 * their weights redistribute proportionally to the core components.
 */
export function computeLMQ(input: LaborMarketInput): LMQResult {
  const employmentScore = scoreEmployment(input.employment);
  const { score: wageScore, ratio: wageRatio } = scoreWage(
    input.medianWage,
    input.priorEarnings
  );
  const projectionsScore = scoreProjections(
    input.projectedOpenings,
    input.projectedGrowthPct
  );

  const localScore = resolveLocalDemandScore(input);
  const trendScore = scoreJOLTSTrend(input.joltsTrend ?? null);

  // Build weighted components dynamically based on available data
  const components: { name: string; weight: number; score: number }[] = [
    { name: "employment", weight: 0.25, score: employmentScore },
    { name: "wage", weight: 0.25, score: wageScore },
    { name: "projections", weight: 0.20, score: projectionsScore },
  ];

  const hasLocal = localScore >= 0;
  const hasTrend = trendScore >= 0;

  if (hasLocal) {
    components.push({ name: "localDemand", weight: 0.15, score: localScore });
  }
  if (hasTrend) {
    components.push({ name: "joltsTrend", weight: 0.15, score: trendScore });
  }

  // Normalize weights to sum to 1.0
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const weightsUsed: Record<string, number> = {};
  let lmq = 0;
  for (const c of components) {
    const normalizedWeight = c.weight / totalWeight;
    weightsUsed[c.name] = Math.round(normalizedWeight * 1000) / 1000;
    lmq += normalizedWeight * c.score;
  }

  return {
    lmq: Math.round(lmq * 100) / 100,
    components: {
      employmentScore,
      localDemandScore: hasLocal ? localScore : null,
      // Backward compatibility: mirror localDemandScore into areaEmploymentScore
      areaEmploymentScore: hasLocal ? localScore : null,
      wageScore,
      projectionsScore,
      joltsTrendScore: hasTrend ? trendScore : null,
    },
    details: {
      employment: input.employment,
      localDemandScore: input.localDemandScore ?? null,
      areaEmployment: input.areaEmployment ?? null,
      medianWage: input.medianWage,
      meanWage: input.meanWage,
      wageRatio: wageRatio !== null ? Math.round(wageRatio * 100) / 100 : null,
      projectedOpenings: input.projectedOpenings,
      projectedGrowthPct: input.projectedGrowthPct,
      joltsOpenings: input.joltsOpenings ?? null,
      joltsTrend: input.joltsTrend ?? null,
      stateJoltsOpenings: input.stateJoltsOpenings ?? null,
      pct10: input.pct10 ?? null,
      pct25: input.pct25 ?? null,
      pct75: input.pct75 ?? null,
      pct90: input.pct90 ?? null,
      weightsUsed,
    },
  };
}
