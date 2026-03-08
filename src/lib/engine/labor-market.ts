/**
 * Labor Market Engine (LMQ)
 *
 * Computes the Labor Market Quotient based on:
 * - Regional employment count
 * - Wage comparison (target vs prior earnings)
 * - Projected openings
 *
 * LMQ = weighted composite of employment, wage, and projections scores.
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
}

export interface LMQResult {
  lmq: number;
  components: {
    employmentScore: number;
    wageScore: number;
    projectionsScore: number;
  };
  details: {
    employment: number | null;
    medianWage: number | null;
    meanWage: number | null;
    wageRatio: number | null;
    projectedOpenings: number | null;
    projectedGrowthPct: number | null;
    pct10: number | null;
    pct25: number | null;
    pct75: number | null;
    pct90: number | null;
  };
}

/**
 * Score employment count (0-100).
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
 * Score wage comparison (0-100).
 * Compares target median wage against worker's prior earnings.
 *
 * Ratio >= 1.0 (same or better) = 100
 * Ratio >= 0.9 = 80
 * Ratio >= 0.75 = 60
 * Ratio >= 0.5 = 40
 * Ratio < 0.5 = 20
 *
 * If no prior earnings, score based on wage relative to median income.
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
 * Growth + openings:
 * Growth > 10% AND openings > 10,000 = 100
 * Growth > 5%  AND openings > 5,000  = 80
 * Growth > 0%  AND openings > 1,000  = 60
 * Growth <= 0% OR openings < 1,000   = 40
 * Declining with few openings         = 20
 */
function scoreProjections(
  projectedOpenings: number | null,
  projectedGrowthPct: number | null
): number {
  if (projectedOpenings === null && projectedGrowthPct === null) return 50;

  const openings = projectedOpenings ?? 0;
  const growth = projectedGrowthPct ?? 0;

  if (growth > 10 && openings > 10000) return 100;
  if (growth > 5 && openings > 5000) return 80;
  if (growth > 0 && openings > 1000) return 60;
  if (growth <= 0 && openings < 1000) return 20;
  return 40;
}

/**
 * Compute the Labor Market Quotient (LMQ).
 *
 * Weights:
 * - 40% employment score
 * - 35% wage score
 * - 25% projections score
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

  const lmq =
    0.4 * employmentScore + 0.35 * wageScore + 0.25 * projectionsScore;

  return {
    lmq: Math.round(lmq * 100) / 100,
    components: {
      employmentScore,
      wageScore,
      projectionsScore,
    },
    details: {
      employment: input.employment,
      medianWage: input.medianWage,
      meanWage: input.meanWage,
      wageRatio: wageRatio !== null ? Math.round(wageRatio * 100) / 100 : null,
      projectedOpenings: input.projectedOpenings,
      projectedGrowthPct: input.projectedGrowthPct,
      pct10: input.pct10 ?? null,
      pct25: input.pct25 ?? null,
      pct75: input.pct75 ?? null,
      pct90: input.pct90 ?? null,
    },
  };
}
