import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateCandidates,
  generateCPCCandidates,
} from "@/lib/engine/candidates";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; analysisId: string }> }
) {
  try {
  const { id, analysisId } = await params;

  // Fetch the case's POST profile for strength data
  const postProfile = await prisma.workerProfile.findFirst({
    where: { caseId: id, profileType: "POST" },
  });

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

  // Phase 1: Traditional candidate generation (DOT/O*NET relationships)
  const traditionalCandidates = await generateCandidates(prwData);

  // Phase 2: CPC component-based candidate generation
  // Runs alongside traditional candidates per VDARE methodology —
  // ensures structurally similar occupations are found even when
  // DOT/O*NET relationship matrices produce thin results
  const maxSvp = Math.max(...prwData.map((p) => p.svp ?? 2));
  const prwOnetCodes = prwData
    .map((p) => p.onetSocCode)
    .filter((c): c is string => !!c);

  const existingCodes = new Set(
    traditionalCandidates.map((c) => c.onetSocCode).filter(Boolean)
  );

  let cpcCandidates: Awaited<ReturnType<typeof generateCPCCandidates>> = [];
  try {
    cpcCandidates = await generateCPCCandidates(
      prwOnetCodes,
      maxSvp,
      postProfile?.strength ?? null,
      existingCodes
    );
    console.log(
      `[generate-candidates] CPC found ${cpcCandidates.length} additional candidates`
    );
  } catch (cpcError) {
    console.warn("[generate-candidates] CPC candidate generation failed:", cpcError);
  }

  // Merge traditional + CPC candidates, deduplicating by O*NET code
  const candidateMap = new Map<string, (typeof traditionalCandidates)[number]>();
  for (const c of traditionalCandidates) {
    if (c.onetSocCode && !candidateMap.has(c.onetSocCode)) {
      candidateMap.set(c.onetSocCode, c);
    }
  }
  for (const c of cpcCandidates) {
    if (c.onetSocCode && !candidateMap.has(c.onetSocCode)) {
      candidateMap.set(c.onetSocCode, c);
    }
  }
  const allCandidates = [...candidateMap.values()];
  console.log(
    `[generate-candidates] After dedup: ${allCandidates.length} unique (from ${traditionalCandidates.length} traditional + ${cpcCandidates.length} CPC)`
  );

  // Store candidates as target occupations
  const created = [];
  for (const c of allCandidates) {
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
    data: { step: 3, status: "in_progress" },
  });

  return NextResponse.json({
    count: created.length,
    traditionalCount: traditionalCandidates.length,
    cpcCount: cpcCandidates.length,
    candidates: created,
  });
  } catch (error) {
    console.error("[POST /api/cases/[id]/analysis/[analysisId]/generate-candidates]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
