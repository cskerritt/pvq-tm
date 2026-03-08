import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computePVQ } from "@/lib/engine/pvq";
import { computeSTQ, type SkillTransferInput } from "@/lib/engine/skill-transfer";
import { computeTFQ, buildDOTDemandVector, buildOccupationDemands } from "@/lib/engine/trait-feasibility";
import { computeVAQ, estimateVAQ, type VocationalAdjustment } from "@/lib/engine/vocational-adjustment";
import { computeLMQ } from "@/lib/engine/labor-market";
import { profileToTraitVector } from "@/lib/engine/traits";

/**
 * DPT (Data-People-Things) code labels from the DOT classification system.
 * Used to generate descriptors for STQ computation.
 */
const DPT_DATA_LABELS: Record<number, string> = {
  0: "Synthesizing",
  1: "Coordinating",
  2: "Analyzing",
  3: "Compiling",
  4: "Computing",
  5: "Copying",
  6: "Comparing",
  7: "Serving",
  8: "No significant relationship",
};
const DPT_PEOPLE_LABELS: Record<number, string> = {
  0: "Mentoring",
  1: "Negotiating",
  2: "Instructing",
  3: "Supervising",
  4: "Diverting",
  5: "Persuading",
  6: "Speaking-Signaling",
  7: "Serving",
  8: "No significant relationship",
};
const DPT_THINGS_LABELS: Record<number, string> = {
  0: "Setting Up",
  1: "Precision Working",
  2: "Operating-Controlling",
  3: "Driving-Operating",
  4: "Manipulating",
  5: "Tending",
  6: "Feeding-Offbearing",
  7: "Handling",
  8: "No significant relationship",
};

/**
 * Extract DPT worker-function descriptors from a DOT occupation's aptitudes JSON.
 * Returns strings like "Data: 1-Coordinating", "People: 6-Speaking-Signaling", etc.
 */
function extractDPTDescriptors(
  aptitudes: Record<string, unknown> | null
): string[] {
  if (!aptitudes) return [];
  const wf = aptitudes.workerFunctions as
    | { data?: number; people?: number; things?: number }
    | undefined;
  if (!wf) return [];

  const descriptors: string[] = [];
  if (wf.data !== undefined && wf.data !== null) {
    descriptors.push(
      `Data: ${wf.data}-${DPT_DATA_LABELS[wf.data] ?? "Unknown"}`
    );
  }
  if (wf.people !== undefined && wf.people !== null) {
    descriptors.push(
      `People: ${wf.people}-${DPT_PEOPLE_LABELS[wf.people] ?? "Unknown"}`
    );
  }
  if (wf.things !== undefined && wf.things !== null) {
    descriptors.push(
      `Things: ${wf.things}-${DPT_THINGS_LABELS[wf.things] ?? "Unknown"}`
    );
  }
  return descriptors;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; analysisId: string }> }
) {
  try {
  const { id, analysisId } = await params;

  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
  });
  if (!analysis) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  const postProfile = await prisma.workerProfile.findUnique({
    where: { caseId_profileType: { caseId: id, profileType: "POST" } },
  });
  if (!postProfile) {
    return NextResponse.json(
      { error: "Post-profile required" },
      { status: 400 }
    );
  }

  const workerTraits = profileToTraitVector(postProfile);

  const prwList = await prisma.pastRelevantWork.findMany({
    where: { caseId: id },
    include: { acquiredSkills: true },
  });

  const targets = await prisma.targetOccupation.findMany({
    where: { analysisId, excluded: false },
    include: { onetOcc: true },
  });

  // ─── Batch-fetch all DOT records (avoids N+1 queries) ───────────────

  const prwDotCodes = prwList
    .map((p) => p.dotCode)
    .filter((c): c is string => c !== null);
  const targetDotCodes = targets
    .map((t) => t.dotCode)
    .filter((c): c is string => c !== null);
  const allDotCodes = [...new Set([...prwDotCodes, ...targetDotCodes])];

  const allDotOccs = allDotCodes.length > 0
    ? await prisma.occupationDOT.findMany({
        where: { id: { in: allDotCodes } },
      })
    : [];
  const dotMap = Object.fromEntries(allDotOccs.map((d) => [d.id, d]));

  // Pre-extract PRW DOT data for STQ and VAQ
  const prwDotOccs = prwDotCodes.map((c) => dotMap[c]).filter(Boolean);

  // Pre-extract PRW source data that's shared across all targets
  const sourceDPTDescriptors = prwDotOccs.flatMap((d) =>
    extractDPTDescriptors(d.aptitudes as Record<string, unknown> | null)
  );
  const sourceWorkFields = prwDotOccs.flatMap((d) => d.workFields ?? []);
  const sourceMPSMS = prwDotOccs.flatMap((d) => d.mpsms ?? []);

  // Also collect O*NET data for PRW (for VAQ tools estimation)
  const prwOnetCodes = prwList
    .map((p) => p.onetSocCode)
    .filter((c): c is string => c !== null);
  const prwOnetOccs = prwOnetCodes.length > 0
    ? await prisma.occupationONET.findMany({
        where: { id: { in: [...new Set(prwOnetCodes)] } },
      })
    : [];

  for (const target of targets) {
    const targetDotOcc = target.dotCode ? dotMap[target.dotCode] : null;

    // ─── STQ ────────────────────────────────────────────────────────
    const targetDPTDescriptors = targetDotOcc
      ? extractDPTDescriptors(
          targetDotOcc.aptitudes as Record<string, unknown> | null
        )
      : [];

    const stqInput: SkillTransferInput = {
      sourceSvp: Math.max(...prwList.map((p) => p.svp ?? 2), 2),
      sourceTasks: prwList.flatMap((p) =>
        p.acquiredSkills.map((s) => `${s.actionVerb} ${s.object}`)
      ),
      sourceDWAs: sourceDPTDescriptors,
      sourceWorkFields,
      sourceMPSMS,
      sourceTools: prwList.flatMap((p) =>
        p.acquiredSkills
          .filter((s) => s.toolsSoftware)
          .map((s) => s.toolsSoftware!)
      ),
      sourceMaterials: prwList.flatMap((p) =>
        p.acquiredSkills
          .filter((s) => s.materialsServices)
          .map((s) => s.materialsServices!)
      ),
      sourceKnowledge: [],
      targetSvp: target.svp ?? 2,
      targetTasks: (
        (target.onetOcc?.tasks as { title?: string; statement?: string }[]) ??
        []
      ).map((t) => t.title ?? t.statement ?? ""),
      targetDWAs: [
        ...((target.onetOcc?.dwas as { title?: string }[]) ?? []).map(
          (d) => d.title ?? ""
        ),
        ...targetDPTDescriptors,
      ],
      targetWorkFields: targetDotOcc?.workFields ?? [],
      targetMPSMS: targetDotOcc?.mpsms ?? [],
      targetTools: (
        (target.onetOcc?.toolsTech as { title?: string }[]) ?? []
      ).map((t) => t.title ?? ""),
      targetMaterials: [],
      targetKnowledge: (
        (target.onetOcc?.knowledge as { name?: string }[]) ?? []
      ).map((k) => k.name ?? ""),
    };
    const stqResult = computeSTQ(stqInput);

    // ─── TFQ ────────────────────────────────────────────────────────
    let demandVector;
    let demandSources;

    if (targetDotOcc) {
      const dotDemands = buildDOTDemandVector(targetDotOcc);
      demandVector = dotDemands.demands;
      demandSources = dotDemands.sources;
    } else {
      const { demands, sources } = buildOccupationDemands(null, null, null);
      demandVector = demands;
      demandSources = sources;
    }
    const tfqResult = computeTFQ(workerTraits, demandVector, demandSources);

    // ─── VAQ ────────────────────────────────────────────────────────
    // Check if evaluator provided manual ratings first
    const existingVAQ = target.vaqDetails as Record<string, unknown> | null;
    const hasManualRatings =
      existingVAQ &&
      typeof existingVAQ.tools === "number" &&
      !existingVAQ.autoEstimated;

    let adj: VocationalAdjustment;
    if (hasManualRatings) {
      // Use evaluator's manual ratings
      adj = existingVAQ as unknown as VocationalAdjustment;
    } else {
      // Auto-estimate from DOT/O*NET data
      adj = estimateVAQ(
        prwDotOccs.map((d) => ({
          aptitudes: d.aptitudes as Record<string, unknown> | null,
          industryDesig: d.industryDesig,
          workFields: d.workFields ?? [],
          mpsms: d.mpsms ?? [],
        })),
        targetDotOcc
          ? {
              aptitudes: targetDotOcc.aptitudes as Record<
                string,
                unknown
              > | null,
              industryDesig: targetDotOcc.industryDesig,
              workFields: targetDotOcc.workFields ?? [],
              mpsms: targetDotOcc.mpsms ?? [],
            }
          : null,
        prwOnetOccs.map((o) => ({
          toolsTech: o.toolsTech as unknown[] | null,
          tasks: o.tasks as unknown[] | null,
        })),
        target.onetOcc
          ? {
              toolsTech: target.onetOcc.toolsTech as unknown[] | null,
              tasks: target.onetOcc.tasks as unknown[] | null,
            }
          : null
      );
    }
    const vaqResult = computeVAQ(
      adj,
      (analysis.ageRule as
        | "standard"
        | "advanced_age"
        | "closely_approaching") ?? "standard"
    );

    // ─── LMQ ────────────────────────────────────────────────────────
    const wages = await prisma.occupationWages.findFirst({
      where: { onetSocCode: target.onetSocCode },
      orderBy: { year: "desc" },
    });
    const projections = await prisma.occupationProjections.findFirst({
      where: {
        socCode: target.onetSocCode.replace(".", "").slice(0, 7),
      },
    });
    const lmqResult = computeLMQ({
      employment: wages?.employment ?? null,
      medianWage: wages?.medianWage ?? null,
      meanWage: wages?.meanWage ?? null,
      priorEarnings: analysis.priorEarnings,
      projectedOpenings: projections?.openingsAnnual ?? null,
      projectedGrowthPct: projections?.changePct ?? null,
      pct10: wages?.pct10 ?? null,
      pct25: wages?.pct25 ?? null,
      pct75: wages?.pct75 ?? null,
      pct90: wages?.pct90 ?? null,
    });

    // ─── PVQ Composite ──────────────────────────────────────────────
    const pvqResult = computePVQ(stqResult, tfqResult, vaqResult, lmqResult);

    await prisma.targetOccupation.update({
      where: { id: target.id },
      data: {
        stq: pvqResult.stq,
        stqDetails: JSON.parse(JSON.stringify(stqResult)),
        tfq: pvqResult.tfq,
        tfqDetails: JSON.parse(JSON.stringify(tfqResult)),
        vaq: pvqResult.vaq,
        vaqDetails: JSON.parse(JSON.stringify(vaqResult)),
        lmq: pvqResult.lmq,
        lmqDetails: JSON.parse(JSON.stringify(lmqResult)),
        pvq: pvqResult.pvq,
        excluded: pvqResult.excluded,
        exclusionReason: pvqResult.exclusionReason,
        confidenceGrade: pvqResult.confidenceGrade,
      },
    });
  }

  await prisma.analysis.update({
    where: { id: analysisId },
    data: { step: 5, status: "completed" },
  });

  return NextResponse.json({ computed: targets.length });
  } catch (error) {
    console.error("[POST /api/cases/[id]/analysis/[analysisId]/compute]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
