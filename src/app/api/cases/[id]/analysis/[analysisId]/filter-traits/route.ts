import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { profileToTraitVector } from "@/lib/engine/traits";
import {
  computeTFQ,
  buildDOTDemandVector,
  buildOccupationDemands,
} from "@/lib/engine/trait-feasibility";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; analysisId: string }> }
) {
  try {
  const { id, analysisId } = await params;

  // Get the POST profile
  const postProfile = await prisma.workerProfile.findUnique({
    where: { caseId_profileType: { caseId: id, profileType: "POST" } },
  });

  if (!postProfile) {
    return NextResponse.json(
      { error: "Post-profile not found. Create a POST profile first." },
      { status: 400 }
    );
  }

  const workerTraits = profileToTraitVector(postProfile);

  // Get all target occupations for this analysis
  const targets = await prisma.targetOccupation.findMany({
    where: { analysisId, excluded: false },
  });

  // Batch-fetch all DOT records for target occupations to avoid N+1 queries
  const targetDotCodes = targets
    .map((t) => t.dotCode)
    .filter((c): c is string => c !== null);
  const dotOccs = await prisma.occupationDOT.findMany({
    where: { id: { in: targetDotCodes } },
  });
  const dotMap = Object.fromEntries(dotOccs.map((d) => [d.id, d]));

  let excluded = 0;
  let passed = 0;

  for (const target of targets) {
    // Build occupation demands from DOT data (primary source)
    let demandVector;
    let demandSources;

    const dotOcc = target.dotCode ? dotMap[target.dotCode] : null;
    if (dotOcc) {
      // Use DOT data: maps GED R/M/L → reasoning/math/language, Strength → strength
      const dotDemands = buildDOTDemandVector(dotOcc);
      demandVector = dotDemands.demands;
      demandSources = dotDemands.sources;
    } else {
      // Fall back to generic demand builder with whatever O*NET data exists
      const { demands, sources } = buildOccupationDemands(null, null, null);
      demandVector = demands;
      demandSources = sources;
    }

    const tfqResult = computeTFQ(workerTraits, demandVector, demandSources);

    if (!tfqResult.passes) {
      await prisma.targetOccupation.update({
        where: { id: target.id },
        data: {
          excluded: true,
          exclusionReason: `Trait failure: ${tfqResult.failedTraits.map((t) => t.label).join(", ")}`,
          tfq: 0,
          tfqDetails: JSON.parse(JSON.stringify(tfqResult)),
        },
      });
      excluded++;
    } else {
      await prisma.targetOccupation.update({
        where: { id: target.id },
        data: {
          tfq: tfqResult.tfq,
          tfqDetails: JSON.parse(JSON.stringify(tfqResult)),
        },
      });
      passed++;
    }
  }

  await prisma.analysis.update({
    where: { id: analysisId },
    data: { step: 3 },
  });

  return NextResponse.json({ passed, excluded });
  } catch (error) {
    console.error("[POST /api/cases/[id]/analysis/[analysisId]/filter-traits]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
