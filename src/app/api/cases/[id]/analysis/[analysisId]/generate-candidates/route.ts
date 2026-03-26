import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateCandidates,
  generateCPCCandidates,
  generateStrengthAwareCandidates,
} from "@/lib/engine/candidates";
import { loadONETFullData, type ONETFullOccupationData } from "@/lib/data-loaders";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; analysisId: string }> }
) {
  try {
  const { id, analysisId } = await params;

  // Clear any existing candidates from previous runs to prevent duplicates
  await prisma.targetOccupation.deleteMany({ where: { analysisId } });

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

  // Phase 3: Strength-Aware Crosswalk — finds sedentary/light occupations
  // that share cognitive/knowledge skills with PRW. Only activates when
  // the worker has light/sedentary restrictions (postStrength <= 2).
  // This is critical for trade workers (carpenters, construction) who
  // otherwise only get other heavy-duty candidates from Phases 1 & 2.
  const phase12Codes = new Set([
    ...traditionalCandidates.map((c) => c.onetSocCode).filter(Boolean),
    ...cpcCandidates.map((c) => c.onetSocCode).filter(Boolean),
  ]);

  let strengthCrosswalkCandidates: Awaited<ReturnType<typeof generateStrengthAwareCandidates>> = [];
  try {
    strengthCrosswalkCandidates = await generateStrengthAwareCandidates(
      prwOnetCodes,
      maxSvp,
      postProfile?.strength ?? null,
      phase12Codes
    );
    console.log(
      `[generate-candidates] Strength crosswalk found ${strengthCrosswalkCandidates.length} sedentary/light candidates`
    );
  } catch (crosswalkError) {
    console.warn("[generate-candidates] Strength crosswalk failed:", crosswalkError);
  }

  // Merge traditional + CPC + strength-crosswalk candidates, deduplicating by O*NET code
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
  for (const c of strengthCrosswalkCandidates) {
    if (c.onetSocCode && !candidateMap.has(c.onetSocCode)) {
      candidateMap.set(c.onetSocCode, c);
    }
  }
  const allCandidates = [...candidateMap.values()];
  console.log(
    `[generate-candidates] After dedup: ${allCandidates.length} unique (from ${traditionalCandidates.length} traditional + ${cpcCandidates.length} CPC + ${strengthCrosswalkCandidates.length} strength-crosswalk)`
  );

  // Load full O*NET dataset from local JSON for enrichment
  const onetFullData = await loadONETFullData();

  // Store candidates as target occupations
  const created = [];
  let enrichedCount = 0;
  for (const c of allCandidates) {
    if (!c.onetSocCode) continue;

    // Ensure O*NET occupation exists in cache AND has full data
    let onetOcc = await prisma.occupationONET.findUnique({
      where: { id: c.onetSocCode },
    });

    const needsEnrichment = !onetOcc || !onetOcc.tasks || !onetOcc.knowledge;

    if (needsEnrichment) {
      // Enrich from local O*NET JSON data (26MB dataset with full tasks/tools/knowledge)
      const fullData = onetFullData[c.onetSocCode];
      if (fullData) {
        // Cast JSON arrays through stringify/parse for Prisma Json field compatibility
        const j = (v: unknown) => v ? JSON.parse(JSON.stringify(v)) : undefined;
        const enrichmentData = {
          id: c.onetSocCode,
          title: fullData.t || c.title,
          description: fullData.d || null,
          tasks: j(fullData.ta),
          dwas: j(fullData.dw),
          toolsTech: j(fullData.tt),
          knowledge: j(fullData.kn),
          skills: j(fullData.sk),
          abilities: j(fullData.ab),
          workActivities: j(fullData.wa),
          workContext: j(fullData.wc),
          jobZone: fullData.jz || null,
          relatedOccs: j(fullData.ro),
        };
        onetOcc = await prisma.occupationONET.upsert({
          where: { id: c.onetSocCode },
          update: enrichmentData,
          create: enrichmentData,
        });
        enrichedCount++;
      } else if (!onetOcc) {
        // No local data either — create minimal placeholder
        onetOcc = await prisma.occupationONET.create({
          data: { id: c.onetSocCode, title: c.title },
        });
      }
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
  if (enrichedCount > 0) {
    console.log(`[generate-candidates] Enriched ${enrichedCount} O*NET records from local data`);
  }

  await prisma.analysis.update({
    where: { id: analysisId, caseId: id },
    data: { step: 3, status: "in_progress" },
  });

  return NextResponse.json({
    count: created.length,
    traditionalCount: traditionalCandidates.length,
    cpcCount: cpcCandidates.length,
    strengthCrosswalkCount: strengthCrosswalkCandidates.length,
    candidates: created,
  });
  } catch (error) {
    console.error("[POST /api/cases/[id]/analysis/[analysisId]/generate-candidates]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
