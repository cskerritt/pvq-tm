/**
 * API: Unified Analysis
 *
 * POST /api/unified-analysis — analyze worker traits against all unified occupations
 *
 * Body: {
 *   workerTraits: Record<TraitKey, number | null>,  // 24-trait post-injury profile
 *   preTraits?: Record<TraitKey, number | null>,     // optional pre-injury profile
 *   options?: {
 *     minFeasibility?: number,   // minimum feasibility score (default 60)
 *     maxSVP?: number,           // maximum SVP filter
 *     strengthLimit?: string,    // max strength level (S, L, M, H, V)
 *   }
 * }
 *
 * Returns: full residual labor market access analysis
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeAllOccupations, computeResidualAccess } from "@/lib/engine/unified-analysis";
import type { TraitVector } from "@/lib/engine/traits";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workerTraits, preTraits, options } = body;

    if (!workerTraits) {
      return NextResponse.json(
        { error: "workerTraits is required (24-trait post-injury profile)" },
        { status: 400 }
      );
    }

    // Compute residual access summary
    const access = await computeResidualAccess(
      workerTraits as TraitVector,
      options
    );

    // Full analysis of all occupations
    const allResults = await analyzeAllOccupations(
      workerTraits as TraitVector,
      preTraits as TraitVector | null | undefined
    );

    // Sort by feasibility score descending
    allResults.sort((a, b) => b.feasibility.feasibilityScore - a.feasibility.feasibilityScore);

    // Separate into accessible vs restricted
    const minFeas = options?.minFeasibility ?? 60;
    const accessible = allResults.filter(r => r.feasibility.feasibilityScore >= minFeas);
    const restricted = allResults.filter(r => r.feasibility.feasibilityScore < minFeas);

    return NextResponse.json({
      summary: access,
      accessible: accessible.map(summarizeResult),
      restricted: restricted.slice(0, 50).map(summarizeResult), // top 50 near-misses
      totalAnalyzed: allResults.length,
    });
  } catch (error) {
    console.error("[unified-analysis] Error:", error);
    return NextResponse.json(
      { error: "Analysis failed", details: String(error) },
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarizeResult(r: any) {
  return {
    onetCode: r.onetCode,
    socCode: r.socCode,
    title: r.title,
    vqScore: r.vqScore,
    vqBand: r.vqBand,
    svp: r.svp,
    strengthLevel: r.strengthLevel,
    medianWage: r.medianWage,
    employment: r.employment,
    growthPercent: r.growthPercent,
    annualOpenings: r.annualOpenings,
    feasibilityScore: r.feasibility.feasibilityScore,
    riskLevel: r.feasibility.riskLevel,
    deficitCount: r.feasibility.deficits.length,
    deficits: r.feasibility.deficits.slice(0, 5), // top 5 deficits
    traitCoverage: r.traitCoverage,
    dataSources: r.dataSources,
    dotTitleCount: r.dotTitleCount,
  };
}
