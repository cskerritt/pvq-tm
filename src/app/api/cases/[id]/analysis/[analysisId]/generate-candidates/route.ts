import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateCandidates } from "@/lib/engine/candidates";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; analysisId: string }> }
) {
  try {
  const { id, analysisId } = await params;

  const prwList = await prisma.pastRelevantWork.findMany({
    where: { caseId: id },
    include: { dotOcc: true },
  });

  const prwData = prwList.map((p) => ({
    onetSocCode: p.onetSocCode,
    dotCode: p.dotCode,
    svp: p.svp,
    workFields: (p.dotOcc?.workFields as string[]) ?? [],
    mpsms: (p.dotOcc?.mpsms as string[]) ?? [],
  }));

  const candidates = await generateCandidates(prwData);

  // Store candidates as target occupations
  const created = [];
  for (const c of candidates) {
    if (!c.onetSocCode) continue;

    // Ensure O*NET occupation exists in cache
    let onetOcc = await prisma.occupationONET.findUnique({
      where: { id: c.onetSocCode },
    });
    if (!onetOcc) {
      // Create a minimal placeholder
      onetOcc = await prisma.occupationONET.create({
        data: { id: c.onetSocCode, title: c.title },
      });
    }

    const target = await prisma.targetOccupation.create({
      data: {
        analysisId,
        onetSocCode: c.onetSocCode,
        dotCode: c.dotCode,
        title: c.title,
        svp: c.svp,
      },
    });
    created.push(target);
  }

  await prisma.analysis.update({
    where: { id: analysisId },
    data: { step: 2, status: "in_progress" },
  });

  return NextResponse.json({ count: created.length, candidates: created });
  } catch (error) {
    console.error("[POST /api/cases/[id]/analysis/[analysisId]/generate-candidates]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
