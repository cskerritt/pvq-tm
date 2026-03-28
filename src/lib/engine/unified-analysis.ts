/**
 * Unified Analysis Engine
 *
 * Simplified analysis pipeline that uses pre-computed unified occupation data
 * instead of the 4-table runtime pipeline.
 *
 * For each target occupation:
 * 1. Look up unified record (pre-computed traits, VQ, wages)
 * 2. Compare worker traits against occupation demands → feasibility
 * 3. Compute STQ from PRW vs target O*NET content
 * 4. Return all scores and data in one pass
 */

import type { TraitVector, TraitKey } from "./traits";
import { TRAIT_KEYS } from "./traits";
import type { UnifiedOccupation } from "./unified-occupations";
import { getByOnetCode, toTraitVector } from "./unified-occupations";
import { computeFeasibilityScore, type FeasibilityResult, type TraitSource } from "./trait-feasibility";
import { computeVQ, type VQResult } from "./vocational-quotient";

// ─── Types ─────────────────────────────────────────────────────────

export interface UnifiedAnalysisInput {
  /** Worker's post-injury trait profile */
  workerTraits: TraitVector;
  /** Worker's pre-injury trait profile (optional) */
  preTraits?: TraitVector | null;
  /** Target O*NET code */
  onetCode: string;
  /** PRW source data for STQ (tasks, tools, DWAs) */
  prwData?: {
    tasks: string[];
    dwas: string[];
    tools: string[];
    materials: string[];
    knowledge: string[];
  };
}

export interface UnifiedAnalysisResult {
  onetCode: string;
  socCode: string;
  title: string;
  description: string;

  // Pre-computed from unified data
  vqScore: number;
  vqBand: number;
  svp: number;
  strengthLevel: string;
  medianWage: number | null;
  employment: number | null;
  growthPercent: number | null;
  annualOpenings: number | null;

  // Computed at analysis time (worker-specific)
  feasibility: FeasibilityResult;
  workerVQ: VQResult | null;

  // Trait comparison
  demandVector: TraitVector;
  demandSources: Partial<Record<string, TraitSource>>;

  // O*NET content (for STQ, TSP)
  tasks: string[];
  dwas: string[];
  tools: string[];

  // DOT drill-down
  dotTitles: Array<{ code: string; title: string; svp: number; strength: string }>;
  dotTitleCount: number;

  // Data quality
  dataSources: string[];
  traitCoverage: number;
}

// ─── Core Analysis ─────────────────────────────────────────────────

/**
 * Analyze a single target occupation against a worker's trait profile.
 * Uses pre-computed unified data — no DB queries needed for occupation data.
 */
export async function analyzeOccupation(
  input: UnifiedAnalysisInput
): Promise<UnifiedAnalysisResult | null> {
  const occ = await getByOnetCode(input.onetCode);
  if (!occ) return null;

  // Convert unified traits to engine format
  const { demands, sources } = toTraitVector(occ);

  // Compute feasibility (worker traits vs occupation demands)
  const feasibility = computeFeasibilityScore(
    input.workerTraits,
    demands,
    sources
  );

  // Worker VQ (optional — based on worker's trait profile)
  const workerVQ = input.preTraits ? computeVQ(input.preTraits) : null;

  return {
    onetCode: occ.onetCode,
    socCode: occ.socCode,
    title: occ.title,
    description: occ.description,

    vqScore: occ.vqScore,
    vqBand: occ.vqBand,
    svp: occ.svp,
    strengthLevel: occ.strengthLevel,
    medianWage: occ.wages.median,
    employment: occ.employment,
    growthPercent: occ.projections?.growthPercent ?? null,
    annualOpenings: occ.projections?.annualOpenings ?? null,

    feasibility,
    workerVQ,

    demandVector: demands,
    demandSources: sources,

    tasks: occ.tasks,
    dwas: occ.dwas,
    tools: occ.tools,

    dotTitles: occ.dotTitles,
    dotTitleCount: occ.dotTitleCount,

    dataSources: occ.dataSources,
    traitCoverage: occ.traitCoverage,
  };
}

/**
 * Analyze ALL unified occupations against a worker's trait profile.
 * Returns the full residual labor market access picture.
 */
export async function analyzeAllOccupations(
  workerTraits: TraitVector,
  preTraits?: TraitVector | null
): Promise<UnifiedAnalysisResult[]> {
  const { loadUnifiedOccupations } = await import("./unified-occupations");
  const allOccs = await loadUnifiedOccupations();
  const results: UnifiedAnalysisResult[] = [];

  for (const occ of allOccs) {
    const { demands, sources } = toTraitVector(occ);
    const feasibility = computeFeasibilityScore(workerTraits, demands, sources);
    const workerVQ = preTraits ? computeVQ(preTraits) : null;

    results.push({
      onetCode: occ.onetCode,
      socCode: occ.socCode,
      title: occ.title,
      description: occ.description,
      vqScore: occ.vqScore,
      vqBand: occ.vqBand,
      svp: occ.svp,
      strengthLevel: occ.strengthLevel,
      medianWage: occ.wages.median,
      employment: occ.employment,
      growthPercent: occ.projections?.growthPercent ?? null,
      annualOpenings: occ.projections?.annualOpenings ?? null,
      feasibility,
      workerVQ,
      demandVector: demands,
      demandSources: sources,
      tasks: occ.tasks,
      dwas: occ.dwas,
      tools: occ.tools,
      dotTitles: occ.dotTitles,
      dotTitleCount: occ.dotTitleCount,
      dataSources: occ.dataSources,
      traitCoverage: occ.traitCoverage,
    });
  }

  return results;
}

/**
 * Quick summary: how many occupations can this worker access?
 */
export async function computeResidualAccess(
  workerTraits: TraitVector,
  options?: {
    minFeasibility?: number;  // default 60
    maxSVP?: number;          // filter by max SVP
    strengthLimit?: string;   // filter by max strength (S, L, M, H, V)
  }
): Promise<{
  totalOccupations: number;
  accessibleCount: number;
  accessibleEmployment: number;
  totalEmployment: number;
  accessPercent: number;
  byStrength: Record<string, { count: number; employment: number }>;
  byVQBand: Record<number, { count: number; employment: number }>;
}> {
  const { loadUnifiedOccupations } = await import("./unified-occupations");
  const allOccs = await loadUnifiedOccupations();

  const minFeasibility = options?.minFeasibility ?? 60;
  const strengthOrder = ["S", "L", "M", "H", "V"];
  const maxStrengthIdx = options?.strengthLimit
    ? strengthOrder.indexOf(options.strengthLimit)
    : 4;

  let accessibleCount = 0;
  let accessibleEmployment = 0;
  let totalEmployment = 0;
  const byStrength: Record<string, { count: number; employment: number }> = {};
  const byVQBand: Record<number, { count: number; employment: number }> = {};

  for (const occ of allOccs) {
    const emp = occ.employment || 0;
    totalEmployment += emp;

    // SVP filter
    if (options?.maxSVP && occ.svp > options.maxSVP) continue;

    // Strength filter
    const occStrIdx = strengthOrder.indexOf(occ.strengthLevel);
    if (occStrIdx > maxStrengthIdx) continue;

    // Feasibility check
    const { demands, sources } = toTraitVector(occ);
    const feasibility = computeFeasibilityScore(workerTraits, demands, sources);

    if (feasibility.feasibilityScore >= minFeasibility) {
      accessibleCount++;
      accessibleEmployment += emp;

      // Track by strength
      const s = occ.strengthLevel;
      if (!byStrength[s]) byStrength[s] = { count: 0, employment: 0 };
      byStrength[s].count++;
      byStrength[s].employment += emp;

      // Track by VQ band
      const b = occ.vqBand;
      if (!byVQBand[b]) byVQBand[b] = { count: 0, employment: 0 };
      byVQBand[b].count++;
      byVQBand[b].employment += emp;
    }
  }

  return {
    totalOccupations: allOccs.length,
    accessibleCount,
    accessibleEmployment,
    totalEmployment,
    accessPercent: Math.round((accessibleCount / allOccs.length) * 1000) / 10,
    byStrength,
    byVQBand,
  };
}
