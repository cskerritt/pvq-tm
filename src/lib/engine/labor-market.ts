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
 * Score national employment count (0-100).
 * Higher employment = more opportunity.
 *
 * Thresholds (national):
 * > 100,000 = 100
 * > 50,000  = 80
 * > 20,000  = 60
 * > 5,000   = 40
 * > 1,000   = 20
 * <= 1,000  = 10
 */
function scoreEmployment(employment: number | null): number {
  if (employment === null) return 50; // neutral if unknown

  if (employment > 100000) return 100;
  if (employment > 50000) return 80;
  if (employment > 20000) return 60;
  if (employment > 5000) return 40;
  if (employment > 1000) return 20;
  return 10;
}

/**
 * Score area-level (metro) employment count (0-100).
 * Lower thresholds than national since metro areas have smaller counts.
 *
 * > 10,000 = 100  (major employer in the area)
 * > 5,000  = 80
 * > 2,000  = 60
 * > 500    = 40
 * > 100    = 20
 * <= 100   = 10
 *
 * @deprecated Used as fallback when localDemandScore is not available.
 */
function scoreAreaEmployment(areaEmployment: number | null): number {
  if (areaEmployment === null) return -1; // signal: no data

  if (areaEmployment > 10000) return 100;
  if (areaEmployment > 5000) return 80;
  if (areaEmployment > 2000) return 60;
  if (areaEmployment > 500) return 40;
  if (areaEmployment > 100) return 20;
  return 10;
}

/**
 * Score wage comparison (0-100).
 * Compares target median wage against worker's prior earnings.
 */
function scoreWage(
  medianWage: number | null,
  priorEarnings: number | null
): { score: number; ratio: number | null } {
  if (medianWage === null) return { score: 50, ratio: null };

  if (priorEarnings === null || priorEarnings === 0) {
    // No prior earnings to compare — score on absolute wage
    if (medianWage > 60000) return { score: 80, ratio: null };
    if (medianWage > 40000) return { score: 60, ratio: null };
    if (medianWage > 25000) return { score: 40, ratio: null };
    return { score: 20, ratio: null };
  }

  const ratio = medianWage / priorEarnings;

  if (ratio >= 1.0) return { score: 100, ratio };
  if (ratio >= 0.9) return { score: 80, ratio };
  if (ratio >= 0.75) return { score: 60, ratio };
  if (ratio >= 0.5) return { score: 40, ratio };
  return { score: 20, ratio };
}

/**
 * Score projected employment (0-100).
 *
 * Scores growth and openings independently, then averages.
 * This prevents penalizing high-growth fields with moderate
 * openings (or vice versa).
 *
 * Growth scoring:
 *   > 10% = 100, > 5% = 80, > 0% = 60, > -5% = 40, <= -5% = 20
 *
 * Openings scoring:
 *   > 10,000 = 100, > 5,000 = 80, > 1,000 = 60, > 500 = 40, <= 500 = 20
 */
function scoreProjections(
  projectedOpenings: number | null,
  projectedGrowthPct: number | null
): number {
  if (projectedOpenings === null && projectedGrowthPct === null) return 50;

  let growthScore: number;
  if (projectedGrowthPct === null) {
    growthScore = 50;
  } else if (projectedGrowthPct > 10) {
    growthScore = 100;
  } else if (projectedGrowthPct > 5) {
    growthScore = 80;
  } else if (projectedGrowthPct > 0) {
    growthScore = 60;
  } else if (projectedGrowthPct > -5) {
    growthScore = 40;
  } else {
    growthScore = 20;
  }

  let openingsScore: number;
  if (projectedOpenings === null) {
    openingsScore = 50;
  } else if (projectedOpenings > 10000) {
    openingsScore = 100;
  } else if (projectedOpenings > 5000) {
    openingsScore = 80;
  } else if (projectedOpenings > 1000) {
    openingsScore = 60;
  } else if (projectedOpenings > 500) {
    openingsScore = 40;
  } else {
    openingsScore = 20;
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
