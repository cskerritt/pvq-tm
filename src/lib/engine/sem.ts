/**
 * Standard Error of Measurement Module for PVQ-TM
 *
 * Provides SEM computation for each quotient based on published
 * reliability coefficients and error propagation analysis.
 *
 * SEM = SD * sqrt(1 - reliability)  [Classical Test Theory]
 *
 * For the PVQ composite, independent component errors propagate as:
 *   PVQ_SEM = sqrt(w_stq^2 * SEM_stq^2 + w_tfq^2 * SEM_tfq^2
 *                + w_vaq^2 * SEM_vaq^2 + w_lmq^2 * SEM_lmq^2)
 *
 * References:
 *   Cain, P.S. & Green, B.F. (1983). Reliabilities of Selected Ratings
 *     Available from the Dictionary of Occupational Titles. Journal of
 *     Applied Psychology, 68(4), 664-670.
 *   Peterson, N.G., Mumford, M.D., Borman, W.C., Jeanneret, P.R., &
 *     Fleishman, E.A. (1997). O*NET Final Technical Report. Utah Department
 *     of Workforce Services.
 *   U.S. Bureau of Labor Statistics (2025). Occupational Requirements Survey
 *     Standard Errors. https://www.bls.gov/ors/se.htm
 *   U.S. Bureau of Labor Statistics (2024). OEWS Technical Notes.
 *     https://www.bls.gov/oes/current/oes_tec.htm
 *   McCroskey, B.J., Dennis, R., Wilkinson, L., et al. (2011). Predictive
 *     Validity (Rxy) and Standard Errors of Estimate (SEE) for the VQS VQ
 *     Job Difficulty Index.
 */

import { PVQ_WEIGHTS } from "./pvq";

// ─── Trait Source Reliability Coefficients ────────────────────────────────────

/**
 * Published reliability coefficients for each trait data source.
 *
 * These represent the proportion of variance in ratings that is systematic
 * (true score) vs. error. Higher values = more reliable.
 */
export const TRAIT_SOURCE_RELIABILITY: Record<
  string,
  { coefficient: number; citation: string; notes: string }
> = {
  ORS: {
    coefficient: 0.85,
    citation:
      "U.S. Bureau of Labor Statistics (2025). Occupational Requirements Survey: " +
      "Standard Errors. https://www.bls.gov/ors/se.htm. ORS uses probability " +
      "sampling of 50,600 occupational observations from 12,900 establishments; " +
      "standard errors published per estimate.",
    notes:
      "Estimated from ORS published standard errors relative to estimate magnitudes. " +
      "ORS does not publish a single reliability coefficient; 0.85 is derived from " +
      "typical RSE values of 3-8 percentage points on frequency estimates, implying " +
      "approximately 85% of variance is systematic.",
  },
  DOT: {
    coefficient: 0.77,
    citation:
      "Cain, P.S. & Green, B.F. (1983). Reliabilities of Selected Ratings " +
      "Available from the Dictionary of Occupational Titles. Journal of Applied " +
      "Psychology, 68(4), 664-670. Inter-rater reliabilities ranged from .77 to " +
      ".98 across trait categories using generalizability analysis.",
    notes:
      "The 0.77 value is the lower bound across DOT trait categories. Physical " +
      "demands and working conditions had higher reliability (.85-.98). GED Math " +
      "and Things complexity had the lowest reliability. Service occupations were " +
      "less reliable than manufacturing occupations.",
  },
  ONET: {
    coefficient: 0.83,
    citation:
      "Peterson, N.G., Mumford, M.D., Borman, W.C., Jeanneret, P.R., & " +
      "Fleishman, E.A. (1997). O*NET Final Technical Report. Utah Department " +
      "of Workforce Services. 15-30 incumbent responses provide 95% CI within " +
      "+/- 1 scale point on 5- and 7-point Likert scales.",
    notes:
      "O*NET collects data from incumbent surveys. With typical sample sizes of " +
      "15-30 respondents per occupation, the interrater reliability (ICC) is " +
      "approximately 0.83 for ability and skill ratings. Importance ratings tend " +
      "to be slightly more reliable than level ratings.",
  },
  DPT_PROXY: {
    coefficient: 0.65,
    citation:
      "Estimated. Proxy values derived from related DOT occupations within " +
      "the same occupational group carry additional matching error beyond the " +
      "base DOT reliability. Estimated as DOT reliability (0.77) reduced by " +
      "~15% for cross-occupation inference.",
    notes:
      "No direct published reliability for proxy-derived trait values. The " +
      "0.65 estimate reflects the compounding of DOT measurement error with " +
      "occupation-matching imprecision.",
  },
  SVP_PROXY: {
    coefficient: 0.70,
    citation:
      "Estimated. SVP-based proxy values use the DOT SVP level to impute " +
      "trait demands. SVP itself has high reliability (Cain & Green, 1983, " +
      "r > .90) but the mapping to specific trait demands introduces " +
      "additional uncertainty.",
    notes:
      "SVP is one of the most reliable DOT ratings (r > .90), but deriving " +
      "specific trait demands from SVP involves assumptions that reduce " +
      "effective reliability.",
  },
  proxy: {
    coefficient: 0.60,
    citation:
      "Estimated. Generic proxy values have no direct measurement basis. " +
      "Conservative estimate reflecting maximum uncertainty for imputed " +
      "trait values without a clear source methodology.",
    notes:
      "Used when trait source is unknown or derived from heuristic rules. " +
      "This is the most conservative reliability estimate in the system.",
  },
};

// ─── Scale Parameters ────────────────────────────────────────────────────────

/** The 24-trait system uses a 0-4 scale; SD of a uniform 0-4 distribution */
const TRAIT_SCALE_SD = 1.15; // SD of {0,1,2,3,4} uniform = sqrt(2) ~ 1.41; empirical SD across DOT ~ 1.15

/** VAQ dimension ordinal scale values */
const VAQ_LEVELS = [0, 33, 67, 100] as const;

/** VAQ minimum step size between adjacent levels */
const VAQ_STEP = 33;

// ─── STQ SEM ─────────────────────────────────────────────────────────────────

/**
 * Compute STQ SEM from alternate vocabulary variants.
 *
 * The STQ is sensitive to the specific vocabulary used to describe
 * tasks, tools, and materials. Different but semantically equivalent
 * descriptions can produce different similarity scores.
 *
 * SEM_STQ = SD of STQ scores computed across vocabulary variants.
 * If fewer than 2 variants provided, returns a conservative default.
 *
 * @param stqVariants - Array of STQ scores computed from different
 *   duty description phrasings for the same occupation pair.
 * @returns SEM for the STQ component (same 0-100 scale as STQ).
 */
export function computeSTQSEM(stqVariants: number[]): number {
  if (stqVariants.length < 2) {
    // Conservative default: ~5 points on the 0-100 scale
    // Based on typical vocabulary sensitivity observed in text similarity metrics
    return 5.0;
  }

  const mean = stqVariants.reduce((s, v) => s + v, 0) / stqVariants.length;
  const variance =
    stqVariants.reduce((s, v) => s + (v - mean) ** 2, 0) /
    (stqVariants.length - 1); // sample variance

  return Math.round(Math.sqrt(variance) * 100) / 100;
}

// ─── TFQ SEM ─────────────────────────────────────────────────────────────────

export interface TraitSEMComparison {
  trait: string;
  workerCapacity: number;
  occupationDemand: number;
  source: string;
  passes: boolean;
  margin: number;
}

export interface TFQSEMResult {
  /** SEM of the overall reserve margin (in TFQ scale points) */
  reserveMarginSEM: number;
  /** Probability that at least one passing trait could flip to failing */
  flipProbability: number;
  /** Traits where |margin| < trait-level SEM (at risk of flipping) */
  criticalTraits: string[];
}

/**
 * Compute TFQ SEM from trait measurement error propagation.
 *
 * For each trait comparison:
 *   traitSEM = TRAIT_SCALE_SD * sqrt(1 - reliability_of_source)
 *
 * A trait is "critical" when its margin (capacity - demand) is smaller
 * than the trait-level SEM, meaning measurement error could plausibly
 * flip the pass/fail decision.
 *
 * The flip probability is estimated as the fraction of rated traits
 * that are critical (a conservative approximation assuming independent
 * trait errors).
 *
 * The overall reserve margin SEM is computed via error propagation:
 *   reserveMarginSEM = sqrt(sum of traitSEM^2) / ratedCount
 * scaled to the TFQ percentage scale.
 */
export function computeTFQSEM(
  traitComparisons: TraitSEMComparison[]
): TFQSEMResult {
  if (traitComparisons.length === 0) {
    return { reserveMarginSEM: 0, flipProbability: 0, criticalTraits: [] };
  }

  const criticalTraits: string[] = [];
  let sumTraitSEMSquared = 0;
  let ratedCount = 0;

  for (const tc of traitComparisons) {
    const reliability =
      TRAIT_SOURCE_RELIABILITY[tc.source]?.coefficient ?? 0.60;
    const traitSEM = TRAIT_SCALE_SD * Math.sqrt(1 - reliability);

    // Combined SEM for the margin (capacity - demand) is sqrt(2) * traitSEM
    // because both capacity and demand have measurement error
    const marginSEM = Math.sqrt(2) * traitSEM;

    if (Math.abs(tc.margin) < marginSEM) {
      criticalTraits.push(tc.trait);
    }

    sumTraitSEMSquared += marginSEM ** 2;
    ratedCount++;
  }

  // Reserve margin SEM: propagate through averaging
  // reserve margin = (sum of margins) / (ratedCount * 4) * 100
  // SEM of sum = sqrt(sum of individual SEMs^2)
  // SEM of mean = SEM_sum / ratedCount
  // SEM on percentage scale = SEM_mean / 4 * 100
  const sumSEM = Math.sqrt(sumTraitSEMSquared);
  const meanSEM = sumSEM / ratedCount;
  const reserveMarginSEM = (meanSEM / 4) * 100;

  // Flip probability: approximate as fraction of traits that are critical
  const flipProbability =
    ratedCount > 0 ? criticalTraits.length / ratedCount : 0;

  return {
    reserveMarginSEM: Math.round(reserveMarginSEM * 100) / 100,
    flipProbability: Math.round(flipProbability * 1000) / 1000,
    criticalTraits,
  };
}

// ─── VAQ SEM ─────────────────────────────────────────────────────────────────

export interface VAQDimensions {
  tools: number;
  workProcesses: number;
  workSetting: number;
  industry: number;
}

export interface VAQSEMResult {
  /** SEM of the VAQ score (0-100 scale) */
  vaqSEM: number;
  /** How much VAQ changes if each dimension shifts +/- 1 level */
  dimensionSensitivity: Record<string, number>;
}

/**
 * Compute VAQ SEM based on ordinal scale sensitivity.
 *
 * The VAQ uses an ordinal scale (0/33/67/100) where each step is 33 points.
 * This creates large discrete jumps in the score.
 *
 * For evaluator-rated VAQ: inter-rater reliability for vocational
 * adjustment ratings is estimated at kappa ~ 0.65, based on the
 * Work-ability Support Scale literature (Gibson et al., 2014, PMC4118042)
 * where vocational assessment items showed kappa 0.60-0.79.
 *
 * For auto-estimated VAQ: reliability depends on threshold sensitivity
 * in the overlap/GOE matching algorithms. Estimated at 0.55 because
 * automatic classification is less reliable than expert judgment for
 * nuanced vocational adjustment decisions.
 *
 * SEM = step_size * sqrt(1 - reliability) * scaling_factor
 *
 * @param vaqDimensions - The four VAQ dimension scores
 * @param autoEstimated - Whether VAQ was auto-estimated (true) or evaluator-rated (false)
 */
export function computeVAQSEM(
  vaqDimensions: VAQDimensions,
  autoEstimated: boolean
): VAQSEMResult {
  // Reliability differs for auto vs. evaluator-rated
  const reliability = autoEstimated ? 0.55 : 0.65;

  // Per-dimension SEM: each dimension is ordinal with step=33
  // SEM per dimension = step_size * sqrt(1 - reliability)
  const dimSEM = VAQ_STEP * Math.sqrt(1 - reliability);

  // VAQ = average of 4 dimensions
  // SEM of average = dimSEM / sqrt(4) = dimSEM / 2
  // (assuming independent dimension errors)
  const vaqSEM = dimSEM / 2;

  // Dimension sensitivity: how much VAQ changes if each dimension shifts +/- 1 level
  // Since VAQ = mean of 4 dimensions, shifting one by +/-33 changes VAQ by +/-8.25
  const stepEffect = VAQ_STEP / 4; // 8.25

  const dimensionSensitivity: Record<string, number> = {
    tools: stepEffect,
    workProcesses: stepEffect,
    workSetting: stepEffect,
    industry: stepEffect,
  };

  return {
    vaqSEM: Math.round(vaqSEM * 100) / 100,
    dimensionSensitivity,
  };
}

// ─── LMQ SEM ─────────────────────────────────────────────────────────────────

export interface LMQComponents {
  employmentScore: number;
  wageScore: number;
  projectionsScore: number | null;
  joltsScore: number | null;
  localDemandScore: number | null;
}

export interface OEWSRSEData {
  employment?: number; // RSE as percentage (e.g., 5 means 5%)
  wage?: number; // RSE as percentage
}

/**
 * Compute LMQ SEM from OEWS RSE propagation.
 *
 * OEWS publishes Relative Standard Errors (RSE) for employment and wage
 * estimates. RSE = (SE / estimate) * 100.
 *
 * Typical RSE values (BLS OEWS Technical Notes, 2024):
 * - National employment: 2-8% RSE for common occupations
 * - National wages: 1-5% RSE for common occupations
 * - State/metro employment: 5-15% RSE
 * - State/metro wages: 3-10% RSE
 *
 * BLS employment projections have MAPE of ~10-15% over 10-year periods
 * (BLS evaluation of 2012-2022 projections, 2024).
 *
 * JOLTS data has RSE typically 5-15% for industry-level estimates.
 *
 * The LMQ SEM is computed by propagating component uncertainties through
 * the weighted composite, using the same dynamic weight normalization
 * as the LMQ engine.
 *
 * @param lmqComponents - Scored component values (0-100 scale)
 * @param oewsRSE - Optional published RSE values for this occupation
 */
export function computeLMQSEM(
  lmqComponents: LMQComponents,
  oewsRSE?: OEWSRSEData
): number {
  // Convert RSE percentages to absolute SEM on the 0-100 score scale.
  // RSE applies to the raw data, not the score. We approximate by
  // multiplying the score by RSE/100 to get score-level uncertainty.

  const empRSE = oewsRSE?.employment ?? 8; // conservative default: 8%
  const wageRSE = oewsRSE?.wage ?? 5; // conservative default: 5%
  const projRSE = 12; // BLS projections MAPE ~10-15%
  const joltsRSE = 10; // JOLTS industry-level RSE ~5-15%
  const localRSE = 15; // local demand is a composite with highest uncertainty

  // Score-level SEMs
  const empSEM = lmqComponents.employmentScore * (empRSE / 100);
  const wageSEM = lmqComponents.wageScore * (wageRSE / 100);
  const projSEM =
    lmqComponents.projectionsScore !== null
      ? lmqComponents.projectionsScore * (projRSE / 100)
      : 0;
  const joltsSEM =
    lmqComponents.joltsScore !== null
      ? lmqComponents.joltsScore * (joltsRSE / 100)
      : 0;
  const localSEM =
    lmqComponents.localDemandScore !== null
      ? lmqComponents.localDemandScore * (localRSE / 100)
      : 0;

  // Build dynamic weights matching the LMQ engine
  const components: { weight: number; sem: number }[] = [
    { weight: 0.25, sem: empSEM },
    { weight: 0.25, sem: wageSEM },
    { weight: 0.2, sem: projSEM },
  ];

  if (lmqComponents.localDemandScore !== null) {
    components.push({ weight: 0.15, sem: localSEM });
  }
  if (lmqComponents.joltsScore !== null) {
    components.push({ weight: 0.15, sem: joltsSEM });
  }

  // Normalize weights
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);

  // Propagate: LMQ_SEM = sqrt(sum of (normalizedWeight * componentSEM)^2)
  let sumSquared = 0;
  for (const c of components) {
    const normalizedWeight = c.weight / totalWeight;
    sumSquared += (normalizedWeight * c.sem) ** 2;
  }

  return Math.round(Math.sqrt(sumSquared) * 100) / 100;
}

// ─── PVQ Composite SEM ──────────────────────────────────────────────────────

export interface ComponentSEMs {
  stqSEM: number;
  tfqSEM: number;
  vaqSEM: number;
  lmqSEM: number;
}

export interface PVQSEMResult {
  /** SEM of the PVQ composite score (0-100 scale) */
  pvqSEM: number;
  /** 90% confidence interval (PVQ +/- 1.645 * SEM) */
  ci90: [number, number];
  /** 95% confidence interval (PVQ +/- 1.96 * SEM) */
  ci95: [number, number];
}

/**
 * Compute PVQ composite SEM via weighted error propagation.
 *
 * PVQ = 0.45*STQ + 0.25*TFQ + 0.15*VAQ + 0.15*LMQ
 *
 * Assuming independent component errors (conservative, since some
 * components may share variance through common occupational data):
 *
 *   PVQ_SEM = sqrt(0.45^2 * STQ_SEM^2 + 0.25^2 * TFQ_SEM^2
 *                + 0.15^2 * VAQ_SEM^2 + 0.15^2 * LMQ_SEM^2)
 *
 * @param componentSEMs - SEM values for each quotient component
 * @param pvqScore - The observed PVQ score (needed for CI bounds)
 */
export function computePVQSEM(
  componentSEMs: ComponentSEMs,
  pvqScore: number
): PVQSEMResult {
  const pvqSEM = Math.sqrt(
    PVQ_WEIGHTS.stq ** 2 * componentSEMs.stqSEM ** 2 +
      PVQ_WEIGHTS.tfq ** 2 * componentSEMs.tfqSEM ** 2 +
      PVQ_WEIGHTS.vaq ** 2 * componentSEMs.vaqSEM ** 2 +
      PVQ_WEIGHTS.lmq ** 2 * componentSEMs.lmqSEM ** 2
  );

  const roundedSEM = Math.round(pvqSEM * 100) / 100;

  // Confidence intervals clamped to [0, 100]
  const ci90: [number, number] = [
    Math.round(Math.max(0, pvqScore - 1.645 * pvqSEM) * 100) / 100,
    Math.round(Math.min(100, pvqScore + 1.645 * pvqSEM) * 100) / 100,
  ];
  const ci95: [number, number] = [
    Math.round(Math.max(0, pvqScore - 1.96 * pvqSEM) * 100) / 100,
    Math.round(Math.min(100, pvqScore + 1.96 * pvqSEM) * 100) / 100,
  ];

  return { pvqSEM: roundedSEM, ci90, ci95 };
}

// ─── Full SEM Analysis ──────────────────────────────────────────────────────

export interface FullSEMResult {
  stq: { sem: number };
  tfq: TFQSEMResult;
  vaq: VAQSEMResult;
  lmq: { sem: number };
  pvq: PVQSEMResult;
}

export interface FullSEMInput {
  /** STQ scores from vocabulary variants (or single score) */
  stqVariants: number[];
  /** Trait comparisons with source, margin, and pass/fail */
  traitComparisons: TraitSEMComparison[];
  /** VAQ dimension scores */
  vaqDimensions: VAQDimensions;
  /** Whether VAQ was auto-estimated */
  vaqAutoEstimated: boolean;
  /** LMQ component scores */
  lmqComponents: LMQComponents;
  /** Optional OEWS RSE data */
  oewsRSE?: OEWSRSEData;
  /** The computed PVQ score */
  pvqScore: number;
}

/**
 * Compute full SEM analysis for a PVQ result.
 *
 * This is the convenience entry point that computes SEM for each
 * component and propagates through to the PVQ composite.
 */
export function computeFullSEM(input: FullSEMInput): FullSEMResult {
  const stqSEM = computeSTQSEM(input.stqVariants);
  const tfqSEM = computeTFQSEM(input.traitComparisons);
  const vaqSEM = computeVAQSEM(input.vaqDimensions, input.vaqAutoEstimated);
  const lmqSEM = computeLMQSEM(input.lmqComponents, input.oewsRSE);

  const pvqSEM = computePVQSEM(
    {
      stqSEM,
      tfqSEM: tfqSEM.reserveMarginSEM,
      vaqSEM: vaqSEM.vaqSEM,
      lmqSEM,
    },
    input.pvqScore
  );

  return {
    stq: { sem: stqSEM },
    tfq: tfqSEM,
    vaq: vaqSEM,
    lmq: { sem: lmqSEM },
    pvq: pvqSEM,
  };
}
