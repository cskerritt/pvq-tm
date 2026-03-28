import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computePVQ, computeUnifiedScore } from "@/lib/engine/pvq";
import { computeSTQ, type SkillTransferInput } from "@/lib/engine/skill-transfer";
import { computeTFQ, computeFeasibilityScore, buildDOTDemandVector, buildOccupationDemands } from "@/lib/engine/trait-feasibility";
import { computeVAQ, estimateVAQ, type VocationalAdjustment } from "@/lib/engine/vocational-adjustment";
import { computeLMQ } from "@/lib/engine/labor-market";
import { profileToTraitVector, STRENGTH_LABELS, TRAIT_LABELS, mapORSToTraits } from "@/lib/engine/traits";
import { getPrimaryIndustryForSOC, getIndustryNameForSOC } from "@/lib/engine/industry-mapping";
import { computeVQ } from "@/lib/engine/vocational-quotient";
import { computeTSP, type TSPInput } from "@/lib/engine/tsp";
import { computeEarningCapacity, computeECLR, type OEWSWageData } from "@/lib/engine/earning-capacity";
import { computeJOLTSTrend } from "@/lib/engine/jolts-trend";
import { getStateFipsFromZip, getStateNameFromZip } from "@/lib/geo/state-fips";
import { analyzeNearMisses } from "@/lib/engine/near-miss";
import { generateRFCNarrative } from "@/lib/engine/rfc-narrative";
import { analyzeViableSet, type ViableOccupationInput } from "@/lib/engine/viable-set";
import { explainConfidence } from "@/lib/engine/confidence-explanation";
import { analyzeRegionalLaborMarket, type OccupationRegionalDetail } from "@/lib/engine/regional-labor-market";
import { computeLaborMarketAccess } from "@/lib/engine/labor-market-access";
import { type PVQResult } from "@/lib/engine/pvq";
import { type STQResult } from "@/lib/engine/skill-transfer";
import { type TFQResult } from "@/lib/engine/trait-feasibility";
import { type LMQResult } from "@/lib/engine/labor-market";
import { buildCPCAnalysis } from "@/lib/engine/cpc-candidates";
import { buildFingerprintIndex, cosineSimilarity, getFingerprint } from "@/lib/engine/component-profile";

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
    where: { id: analysisId, caseId: id },
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

  // ─── Pre-Injury Profile (optional) ──────────────────────────────
  const preProfile = await prisma.workerProfile.findUnique({
    where: { caseId_profileType: { caseId: id, profileType: "PRE" } },
  });
  const preTraits = preProfile ? profileToTraitVector(preProfile) : null;

  // ─── Case date of injury (for JOLTS lookups) ───────────────────
  const caseData = await prisma.case.findUnique({
    where: { id },
    select: { dateOfInjury: true },
  });
  const injuryYear = caseData?.dateOfInjury?.getFullYear() ?? null;

  // ─── Batch-load JOLTS data from DB ────────────────────────────
  const joltsMap = new Map<string, Map<number, { jobOpenings: number | null; hires: number | null }>>();
  let joltsCurrentYear = new Date().getFullYear();
  try {
    const joltsRecords = await prisma.jOLTSIndustryData.findMany({});
    for (const rec of joltsRecords) {
      if (!joltsMap.has(rec.naicsCode)) joltsMap.set(rec.naicsCode, new Map());
      joltsMap.get(rec.naicsCode)!.set(rec.year, {
        jobOpenings: rec.jobOpenings,
        hires: rec.hires,
      });
    }
    if (joltsRecords.length > 0) {
      joltsCurrentYear = Math.max(...joltsRecords.map(r => r.year));
    }
  } catch (joltsError) {
    console.warn("[compute] JOLTS data unavailable, continuing without it:", joltsError);
  }

  // ─── ECLR Geographic Wage Adjustment ─────────────────────
  const fullCaseData = await prisma.case.findUnique({
    where: { id },
    select: { metroAreaCode: true, metroAreaName: true, zipCode: true },
  });
  let eclrFactor = 1.0;
  const eclrAreaCode = fullCaseData?.metroAreaCode ?? null;
  const eclrAreaName = fullCaseData?.metroAreaName ?? null;
  const caseZipCode = fullCaseData?.zipCode ?? null;

  if (eclrAreaCode) {
    // Compute ECLR: compare area-level median wages to national
    const nationalAvgWage = await prisma.occupationWages.aggregate({
      _avg: { medianWage: true },
      where: { areaType: "national" },
    });
    // For area wages, we use "metro" type or derive from state data if available
    const areaAvgWage = await prisma.occupationWages.aggregate({
      _avg: { medianWage: true },
      where: { areaCode: eclrAreaCode },
    });
    if (areaAvgWage._avg.medianWage && nationalAvgWage._avg.medianWage) {
      eclrFactor = computeECLR(areaAvgWage._avg.medianWage, nationalAvgWage._avg.medianWage);
    }
  }

  // ─── State-Level JOLTS Lookup ──────────────────────────────
  const stateFips = caseZipCode ? getStateFipsFromZip(caseZipCode) : null;
  const stateName = caseZipCode ? getStateNameFromZip(caseZipCode) : null;

  // Build state JOLTS map for trend and current/pre-injury lookups
  const stateJoltsMap = new Map<number, { jobOpenings: number | null; hires: number | null }>();
  let stateJoltsCurrent: number | null = null;
  let stateJoltsPreInjury: number | null = null;

  if (stateFips) {
    try {
      const stateRecords = await prisma.jOLTSStateData.findMany({
        where: { stateCode: stateFips },
      });
      for (const rec of stateRecords) {
        stateJoltsMap.set(rec.year, {
          jobOpenings: rec.jobOpenings,
          hires: rec.hires,
        });
      }
      // Current year
      const currentData = stateJoltsMap.get(joltsCurrentYear);
      stateJoltsCurrent = currentData?.jobOpenings ?? null;
      // Pre-injury year (closest match)
      if (injuryYear !== null) {
        let bestYear: number | null = null;
        let bestDiff = Infinity;
        for (const yr of stateJoltsMap.keys()) {
          const diff = Math.abs(yr - injuryYear);
          if (diff < bestDiff) { bestDiff = diff; bestYear = yr; }
        }
        if (bestYear !== null) {
          stateJoltsPreInjury = stateJoltsMap.get(bestYear)?.jobOpenings ?? null;
        }
      }
    } catch (stateJoltsError) {
      console.warn("[compute] State JOLTS data unavailable:", stateJoltsError);
    }
  }

  const prwList = await prisma.pastRelevantWork.findMany({
    where: { caseId: id },
    include: { acquiredSkills: true },
  });

  // Fetch ALL targets (including excluded) so we can analyze exclusion reasons
  const allTargetsInAnalysis = await prisma.targetOccupation.findMany({
    where: { analysisId },
    omit: { feasibilityScore: true, riskLevel: true, traitDeficits: true },
    include: { onetOcc: true },
  });

  if (allTargetsInAnalysis.length === 0) {
    return NextResponse.json(
      { error: "No target occupations found. Please re-run Generate Candidates (Step 2) first." },
      { status: 400 }
    );
  }

  if (prwList.length === 0) {
    return NextResponse.json(
      { error: "No Past Relevant Work found. Please add PRW data before computing." },
      { status: 400 }
    );
  }

  // Non-excluded targets get full scoring; excluded targets still get analysis
  const targets = allTargetsInAnalysis.filter(t => !t.excluded);

  // ─── Backfill O*NET records that are placeholders (null tasks) ──────
  // This catches targets generated before the enrichment fix
  const targetsNeedingEnrichment = allTargetsInAnalysis.filter(
    (t) => t.onetOcc && !t.onetOcc.tasks
  );
  if (targetsNeedingEnrichment.length > 0) {
    const { loadONETFullData } = await import("@/lib/data-loaders");
    const onetFullData = await loadONETFullData();
    let backfillCount = 0;
    for (const t of targetsNeedingEnrichment) {
      const fullData = onetFullData[t.onetSocCode];
      if (fullData) {
        // Cast JSON arrays through unknown → JSON-compatible for Prisma
        const jsonOrNull = (v: unknown) => v ? JSON.parse(JSON.stringify(v)) : undefined;
        await prisma.occupationONET.update({
          where: { id: t.onetSocCode },
          data: {
            title: fullData.t || t.onetOcc!.title,
            description: fullData.d || null,
            tasks: jsonOrNull(fullData.ta),
            dwas: jsonOrNull(fullData.dw),
            toolsTech: jsonOrNull(fullData.tt),
            knowledge: jsonOrNull(fullData.kn),
            skills: jsonOrNull(fullData.sk),
            abilities: jsonOrNull(fullData.ab),
            workActivities: jsonOrNull(fullData.wa),
            workContext: jsonOrNull(fullData.wc),
            jobZone: fullData.jz || null,
            relatedOccs: jsonOrNull(fullData.ro),
          },
        });
        backfillCount++;
      }
    }
    if (backfillCount > 0) {
      console.log(`[compute] Backfilled ${backfillCount} O*NET placeholder records`);
      // Reload targets with enriched data
      const refreshedTargets = await prisma.targetOccupation.findMany({
        where: { analysisId },
        omit: { feasibilityScore: true, riskLevel: true, traitDeficits: true },
        include: { onetOcc: true },
      });
      allTargetsInAnalysis.splice(0, allTargetsInAnalysis.length, ...refreshedTargets);
      targets.splice(0, targets.length, ...refreshedTargets.filter(t => !t.excluded));
    }
  }

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
  const dotMap: Record<string, typeof allDotOccs[0]> = Object.fromEntries(allDotOccs.map((d) => [d.id, d]));

  // ─── Crosswalk lookup for targets without dotCode ──────────────────
  const targetsNeedingCrosswalk = targets.filter(
    (t) => !t.dotCode || !dotMap[t.dotCode]
  );
  const crosswalkOnetCodes = [
    ...new Set(targetsNeedingCrosswalk.map((t) => t.onetSocCode)),
  ];

  const crosswalkMap: Record<string, string> = {}; // onetSocCode → dotCode
  if (crosswalkOnetCodes.length > 0) {
    const crosswalks = await prisma.dOTONETCrosswalk.findMany({
      where: { onetSocCode: { in: crosswalkOnetCodes } },
      include: { dotOcc: true },
    });
    for (const cw of crosswalks) {
      if (!crosswalkMap[cw.onetSocCode]) {
        crosswalkMap[cw.onetSocCode] = cw.dotCode;
        if (!dotMap[cw.dotCode]) {
          dotMap[cw.dotCode] = cw.dotOcc;
        }
      }
    }
  }

  // ─── Batch-fetch ORS records for all target O*NET codes ────────────
  const allTargetOnetCodes = [...new Set(targets.map((t) => t.onetSocCode))];
  const orsRecords = await prisma.occupationORS.findMany({
    where: { onetSocCode: { in: allTargetOnetCodes } },
  });
  const orsMap = Object.fromEntries(
    orsRecords.map((o) => [o.onetSocCode, o])
  );

  // ─── Batch-fetch wages and projections (eliminates N+1 queries) ───
  const allTargetSocShort = [...new Set(allTargetOnetCodes.map((c) => c.replace(/\.\d+$/, "")))];
  const [allNationalWages, allAreaWages, allProjections] = await Promise.all([
    prisma.occupationWages.findMany({
      where: { onetSocCode: { in: allTargetOnetCodes }, areaType: "national" },
      orderBy: { year: "desc" },
    }),
    eclrAreaCode
      ? prisma.occupationWages.findMany({
          where: { onetSocCode: { in: allTargetOnetCodes }, areaCode: eclrAreaCode },
          orderBy: { year: "desc" },
        })
      : Promise.resolve([]),
    prisma.occupationProjections.findMany({
      where: { socCode: { in: allTargetSocShort } },
    }),
  ]);
  // Build lookup maps (take first = most recent year due to orderBy)
  const nationalWageMap = new Map<string, (typeof allNationalWages)[number]>();
  for (const w of allNationalWages) {
    if (!nationalWageMap.has(w.onetSocCode)) nationalWageMap.set(w.onetSocCode, w);
  }
  const areaWageMap = new Map<string, (typeof allAreaWages)[number]>();
  for (const w of allAreaWages) {
    if (!areaWageMap.has(w.onetSocCode)) areaWageMap.set(w.onetSocCode, w);
  }
  const projectionsMap = new Map<string, (typeof allProjections)[number]>();
  for (const p of allProjections) {
    if (!projectionsMap.has(p.socCode)) projectionsMap.set(p.socCode, p);
  }

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
    // Resolve DOT record: direct dotCode, or via crosswalk
    const effectiveDotCode =
      target.dotCode ?? crosswalkMap[target.onetSocCode] ?? null;
    const targetDotOcc = effectiveDotCode ? dotMap[effectiveDotCode] : null;

    // ─── STQ ────────────────────────────────────────────────────────
    const targetDPTDescriptors = targetDotOcc
      ? extractDPTDescriptors(
          targetDotOcc.aptitudes as Record<string, unknown> | null
        )
      : [];

    // ─── Build STQ source data ──────────────────────────────────────
    // Acquired skills from PRW (primary source for task overlap)
    const acquiredSkillTasks = prwList.flatMap((p) =>
      p.acquiredSkills.map((s) => `${s.actionVerb} ${s.object}`)
    );

    // Fallback: when no acquired skills exist, use O*NET task data from PRW
    // occupations. This prevents STQ task overlap (35% weight) from being zero
    // simply because skills weren't manually entered.
    let sourceTasks = acquiredSkillTasks;
    if (acquiredSkillTasks.length === 0 && prwOnetOccs.length > 0) {
      sourceTasks = prwOnetOccs.flatMap((occ) =>
        ((occ.tasks as { t?: string; title?: string; id?: string }[]) ?? []).map(
          (t) => t.title ?? t.t ?? ""
        ).filter(Boolean)
      );
    }
    // ALWAYS supplement with O*NET tasks even when acquired skills exist
    // (acquired skills are usually 3-5 items; O*NET tasks are 15-25)
    if (prwOnetOccs.length > 0) {
      const onetTasks = prwOnetOccs.flatMap((occ) =>
        ((occ.tasks as { t?: string; title?: string }[]) ?? []).map(
          (t) => t.title ?? t.t ?? ""
        ).filter(Boolean)
      );
      // Merge without duplicating
      const taskSet = new Set(sourceTasks.map(t => t.toLowerCase()));
      for (const t of onetTasks) {
        if (!taskSet.has(t.toLowerCase())) {
          sourceTasks.push(t);
          taskSet.add(t.toLowerCase());
        }
      }
    }

    // FIX GAP 1: Source DWAs — load actual O*NET DWAs from PRW occupations
    // Previously only DPT labels like "Data: 1-Coordinating" were used.
    // Now we load real DWAs like "Resolve customer complaints" from O*NET.
    const sourceDWAsFromONET = prwOnetOccs.flatMap((occ) =>
      ((occ.dwas as { title?: string; t?: string }[]) ?? []).map(
        (d) => d.title ?? d.t ?? ""
      ).filter(Boolean)
    );
    const allSourceDWAs = [...sourceDPTDescriptors, ...sourceDWAsFromONET];

    // Source tools: from acquired skills + O*NET tools from PRW occupations
    // ALWAYS merge both sources — acquired skills may only list 2-3 tools
    const acquiredTools = prwList.flatMap((p) =>
      p.acquiredSkills
        .filter((s) => s.toolsSoftware)
        .map((s) => s.toolsSoftware!)
    );
    const onetSourceTools = prwOnetOccs.flatMap((occ) =>
      ((occ.toolsTech as { t?: string; title?: string }[]) ?? []).map(
        (t) => t.title ?? t.t ?? ""
      ).filter(Boolean)
    );
    // Merge both — acquired skills are primary, O*NET fills gaps
    const sourceToolSet = new Set(acquiredTools.map(t => t.toLowerCase()));
    const sourceTools = [...acquiredTools];
    for (const t of onetSourceTools) {
      if (!sourceToolSet.has(t.toLowerCase())) {
        sourceTools.push(t);
        sourceToolSet.add(t.toLowerCase());
      }
    }

    // FIX GAP 3: Source materials — add O*NET tool categories as fallback
    const acquiredMaterials = prwList.flatMap((p) =>
      p.acquiredSkills
        .filter((s) => s.materialsServices)
        .map((s) => s.materialsServices!)
    );
    const onetSourceMaterials = prwOnetOccs.flatMap((occ) =>
      ((occ.toolsTech as { c?: string; category?: string }[]) ?? []).map(
        (t) => t.category ?? t.c ?? ""
      ).filter(Boolean)
    );
    const sourceMaterials = acquiredMaterials.length > 0
      ? acquiredMaterials
      : [...new Set(onetSourceMaterials)]; // deduplicate categories

    // Source knowledge: populated from PRW O*NET knowledge areas
    const sourceKnowledge = prwOnetOccs.flatMap((occ) =>
      ((occ.knowledge as { n?: string; name?: string }[]) ?? []).map(
        (k) => k.name ?? k.n ?? ""
      ).filter(Boolean)
    );

    // FIX GAP 2: WorkFields/MPSMS from O*NET work activities when DOT is empty
    // DOT workFields/mpsms are always empty in our seed data, so extract
    // equivalent data from O*NET work activities as a fallback
    let effectiveSourceWorkFields = sourceWorkFields;
    let effectiveSourceMPSMS = sourceMPSMS;
    if (sourceWorkFields.length === 0 && prwOnetOccs.length > 0) {
      effectiveSourceWorkFields = prwOnetOccs.flatMap((occ) =>
        ((occ.workActivities as { name?: string; n?: string }[]) ?? []).map(
          (wa) => wa.name ?? wa.n ?? ""
        ).filter(Boolean)
      );
    }

    let effectiveTargetWorkFields = targetDotOcc?.workFields ?? [];
    let effectiveTargetMPSMS = targetDotOcc?.mpsms ?? [];
    if (effectiveTargetWorkFields.length === 0 && target.onetOcc) {
      effectiveTargetWorkFields = (
        (target.onetOcc.workActivities as { name?: string; n?: string }[]) ?? []
      ).map((wa) => wa.name ?? wa.n ?? "").filter(Boolean);
    }

    // Target materials: populate from O*NET tools/tech categories
    const targetMaterials = [
      ...new Set(
        ((target.onetOcc?.toolsTech as { t?: string; c?: string; category?: string }[]) ?? [])
          .map((t) => t.category ?? t.c ?? "")
          .filter(Boolean)
      ),
    ];

    // ─── Diagnostic: log STQ input sizes for debugging ─────────────
    if (sourceTasks.length === 0 || (
      ((target.onetOcc?.tasks as unknown[]) ?? []).length === 0
    )) {
      console.warn(
        `[STQ][${target.onetSocCode}] Data gap: sourceTasks=${sourceTasks.length}, ` +
        `targetTasks=${((target.onetOcc?.tasks as unknown[]) ?? []).length}, ` +
        `sourceTools=${sourceTools.length}, sourceKnowledge=${sourceKnowledge.length}, ` +
        `sourceDWAs=${allSourceDWAs.length}, ` +
        `onetOcc=${target.onetOcc ? 'present' : 'MISSING'}, ` +
        `onetTasks=${target.onetOcc?.tasks ? 'has data' : 'NULL'}`
      );
    }

    const stqInput: SkillTransferInput = {
      sourceSvp: Math.max(...prwList.map((p) => p.svp ?? 2), 2),
      sourceTasks,
      sourceDWAs: allSourceDWAs,
      sourceWorkFields: effectiveSourceWorkFields,
      sourceMPSMS: effectiveSourceMPSMS,
      sourceTools,
      sourceMaterials,
      sourceKnowledge,
      targetSvp: target.svp ?? 2,
      targetTasks: (
        (target.onetOcc?.tasks as { title?: string; statement?: string; t?: string }[]) ??
        []
      ).map((t) => t.title ?? t.statement ?? t.t ?? "").filter(Boolean),
      targetDWAs: [
        ...((target.onetOcc?.dwas as { title?: string; t?: string }[]) ?? []).map(
          (d) => d.title ?? d.t ?? ""
        ).filter(Boolean),
        ...targetDPTDescriptors,
      ],
      targetWorkFields: effectiveTargetWorkFields,
      targetMPSMS: effectiveTargetMPSMS,
      targetTools: (
        (target.onetOcc?.toolsTech as { title?: string; t?: string }[]) ?? []
      ).map((t) => t.title ?? t.t ?? "").filter(Boolean),
      targetMaterials,
      targetKnowledge: (
        (target.onetOcc?.knowledge as { name?: string; n?: string }[]) ?? []
      ).map((k) => k.name ?? k.n ?? "").filter(Boolean),
    };
    const stqResult = computeSTQ(stqInput);

    // ─── TFQ ────────────────────────────────────────────────────────
    // Build per-occupation demand vector from DOT + O*NET + ORS data
    let demandVector;
    let demandSources;

    const onetOcc = target.onetOcc;
    const onetDataForTFQ = onetOcc
      ? {
          abilities: onetOcc.abilities,
          workContext: onetOcc.workContext,
          svp: onetOcc.jobZone != null ? onetOcc.jobZone + 1 : undefined,
        }
      : null;

    const orsRecord = orsMap[target.onetSocCode];
    const orsTraits = orsRecord
      ? mapORSToTraits(
          orsRecord.physicalDemands as Record<
            string,
            { t: string; v: string | number }[]
          > | null,
          orsRecord.envConditions as Record<
            string,
            { t: string; v: string | number }[]
          > | null
        )
      : null;

    if (targetDotOcc) {
      const dotDemands = buildDOTDemandVector(
        targetDotOcc,
        onetDataForTFQ as Record<string, unknown> | null
      );
      demandVector = dotDemands.demands;
      demandSources = dotDemands.sources;

      // Override with ORS data where available (ORS > DOT > O*NET)
      if (orsTraits) {
        for (const [key, val] of Object.entries(orsTraits)) {
          if (val !== null && val !== undefined) {
            (demandVector as Record<string, number | null>)[key] = val;
            (demandSources as Record<string, string>)[key] = "ORS";
          }
        }
      }
    } else {
      // Fallback: use buildOccupationDemands with ORS + O*NET
      const { demands, sources } = buildOccupationDemands(
        orsTraits as Record<string, unknown> | null,
        null,
        onetDataForTFQ as Record<string, unknown> | null
      );
      demandVector = demands;
      demandSources = sources;
    }

    // ─── Explicit Physical Demand Gates (VDARE Step 7) ──────────────
    const gateFailures: string[] = [];
    const PHYSICAL_GATE_TRAITS = [
      { key: "strength", label: "Strength" },
      { key: "climbBalance", label: "Climb/Balance" },
      { key: "stoopKneel", label: "Stoop/Kneel" },
      { key: "reachHandle", label: "Reach/Handle" },
    ] as const;

    for (const gate of PHYSICAL_GATE_TRAITS) {
      const demand = (demandVector as Record<string, number | null>)[gate.key];
      const capacity = (workerTraits as Record<string, number | null>)[gate.key];

      // Categorical comparison: floor demand to integer category level.
      // Worker profiles use integers (0-4), O*NET demands may be decimal.
      // A worker at category 2 should pass demand 2.99 (same category).
      const demandCategory = demand !== null && demand !== undefined ? Math.floor(demand) : null;

      if (
        demandCategory !== null &&
        capacity !== null && capacity !== undefined &&
        capacity < demandCategory
      ) {
        if (gate.key === "strength") {
          const demandLabel = STRENGTH_LABELS[demandCategory] ?? `Level ${demandCategory}`;
          const capacityLabel = STRENGTH_LABELS[capacity] ?? `Level ${capacity}`;
          gateFailures.push(
            `${gate.label}: occupation requires ${demandLabel} but worker restricted to ${capacityLabel}`
          );
        } else {
          const FREQ_LABELS: Record<number, string> = { 0: "Not Required", 1: "Seldom", 2: "Occasionally", 3: "Frequently", 4: "Constantly" };
          const demandLabel = FREQ_LABELS[demandCategory] ?? `Level ${demandCategory}`;
          const capacityLabel = FREQ_LABELS[capacity] ?? `Level ${capacity}`;
          gateFailures.push(
            `${gate.label}: occupation demands ${demandLabel} but worker capacity is ${capacityLabel}`
          );
        }
      }
    }

    const analysisMode = ("analysisMode" in analysis ? (analysis as Record<string, unknown>).analysisMode as string : "strict") === "clinical" ? "clinical" as const : "strict" as const;
    const tfqResult = computeTFQ(workerTraits, demandVector, demandSources, analysisMode);

    // Merge gate failures into TFQ result
    if (gateFailures.length > 0 && tfqResult.passes) {
      // TFQ passed on average margins but explicit gates failed
      // Override to exclude
      (tfqResult as { passes: boolean }).passes = false;
      (tfqResult as { tfq: number }).tfq = 0;
      (tfqResult as { reserveMargin: number }).reserveMargin = 0;
      (tfqResult as { failedTraits: unknown[] }).failedTraits = gateFailures.map((reason) => ({
        trait: reason.split(":")[0],
        label: reason.split(":")[0],
        reason,
        workerCapacity: null,
        occupationDemand: null,
        margin: null,
        passes: false,
        source: "DOT",
      }));
    }
    // Attach gate failures for reporting
    const tfqResultWithGates = {
      ...tfqResult,
      gateFailures: gateFailures.length > 0 ? gateFailures : undefined,
    };

    // ─── Pre-Injury TFQ (if PRE profile exists) ──────────────────
    let preTfqScore: number | null = null;
    let preTfqPasses: boolean | null = null;
    let preTfqDetailsJson: unknown = null;
    if (preTraits) {
      const preTfqResult = computeTFQ(preTraits, demandVector, demandSources, analysisMode);
      preTfqScore = preTfqResult.tfq;
      preTfqPasses = preTfqResult.passes;
      preTfqDetailsJson = JSON.parse(JSON.stringify({
        ...preTfqResult,
        gateFailures: undefined, // Pre-injury doesn't apply post-injury gates
      }));
    }

    // ─── JOLTS Industry Lookup ──────────────────────────────────
    const joltsNaics = getPrimaryIndustryForSOC(target.onetSocCode);
    const joltsName = getIndustryNameForSOC(target.onetSocCode);
    const industryData = joltsMap.get(joltsNaics);

    let joltsCurrentOpenings: number | null = null;
    let joltsPreInjuryOpenings: number | null = null;

    if (industryData) {
      // Current year openings
      const currentData = industryData.get(joltsCurrentYear);
      joltsCurrentOpenings = currentData?.jobOpenings ?? null;

      // Pre-injury year openings (closest available year to injury date)
      if (injuryYear !== null) {
        let bestYear: number | null = null;
        let bestDiff = Infinity;
        for (const yr of industryData.keys()) {
          const diff = Math.abs(yr - injuryYear);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestYear = yr;
          }
        }
        if (bestYear !== null) {
          const preData = industryData.get(bestYear);
          joltsPreInjuryOpenings = preData?.jobOpenings ?? null;
        }
      }
    }

    // ─── JOLTS Trend Analysis ─────────────────────────────────────
    const joltsTrendResult = industryData
      ? computeJOLTSTrend(industryData)
      : null;

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
    const isAutoEstimated = "autoEstimated" in adj && (adj as Record<string, unknown>).autoEstimated === true;
    const vaqResult = computeVAQ(
      adj,
      (analysis.ageRule as
        | "standard"
        | "advanced_age"
        | "closely_approaching") ?? "standard",
      isAutoEstimated
    );

    // ─── LMQ ────────────────────────────────────────────────────────
    const wages = nationalWageMap.get(target.onetSocCode) ?? null;
    const socShort = target.onetSocCode.replace(/\.\d+$/, "");
    const projections = projectionsMap.get(socShort) ?? null;

    // ─── Area-Level Employment Lookup ─────────────────────────────
    let targetAreaEmployment: number | null = null;
    let targetAreaMedianWage: number | null = null;
    if (eclrAreaCode) {
      const areaWages = areaWageMap.get(target.onetSocCode) ?? null;
      targetAreaEmployment = areaWages?.employment ?? null;
      targetAreaMedianWage = areaWages?.medianWage ?? null;
    }

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
      areaEmployment: targetAreaEmployment,
      joltsTrend: joltsTrendResult?.trend ?? null,
      joltsOpenings: joltsCurrentOpenings,
      stateJoltsOpenings: stateJoltsCurrent,
    });

    // ─── PVQ Composite (legacy) ───────────────────────────────────
    const pvqResult = computePVQ(stqResult, tfqResult, vaqResult, lmqResult);

    // ─── VQ-Centric Feasibility Score ───────────────────────────
    const feasibilityResult = computeFeasibilityScore(
      workerTraits,
      demandVector,
      demandSources
    );
    const unifiedResult = computeUnifiedScore(
      stqResult, tfqResult, vaqResult, lmqResult, feasibilityResult
    );

    // ─── VQS: VQ Computation ─────────────────────────────────────
    const vqResult = computeVQ(demandVector);

    // ─── VQS: TSP Computation ────────────────────────────────────
    // Build source traits from best PRW DOT data
    const bestPrwDotOcc = prwDotOccs[0];
    let sourceTraitsForTSP = workerTraits; // fallback to worker profile
    let sourceVqForTSP = 100; // default mid-range

    if (bestPrwDotOcc) {
      const prwDemands = buildDOTDemandVector(bestPrwDotOcc);
      sourceTraitsForTSP = prwDemands.demands;
      sourceVqForTSP = computeVQ(prwDemands.demands).vq;
    }

    const tspInput: TSPInput = {
      sourceDotCode: prwDotCodes[0] ?? null,
      sourceOnetCode: prwOnetCodes[0] ?? null,
      sourceTraits: sourceTraitsForTSP,
      sourceVq: sourceVqForTSP,
      sourceSvp: Math.max(...prwList.map((p) => p.svp ?? 2), 2),
      sourceStrength: sourceTraitsForTSP.strength ?? 2,
      targetDotCode: target.dotCode,
      targetOnetCode: target.onetSocCode,
      targetTraits: demandVector,
      targetVq: vqResult.vq,
      targetSvp: target.svp ?? 2,
      targetStrength: demandVector.strength ?? 2,
    };
    const tspResult = computeTSP(tspInput);

    // ─── VQS: Earning Capacity ──────────────────────────────────
    const ecWageData: OEWSWageData = {
      medianWage: wages?.medianWage ?? null,
      meanWage: wages?.meanWage ?? null,
      pct10: wages?.pct10 ?? null,
      pct25: wages?.pct25 ?? null,
      pct75: wages?.pct75 ?? null,
      pct90: wages?.pct90 ?? null,
      employment: wages?.employment ?? null,
    };
    const ecResult = computeEarningCapacity(
      vqResult.band,
      ecWageData,
      eclrFactor,
      eclrAreaCode,
      eclrAreaName
    );

    // Pre-injury VQ and EC (VQ is occupation-based, same for both)
    let preVqScore: number | null = null;
    let preEcMedian: number | null = null;
    let preEcDetailsJson: unknown = null;
    if (preTraits && preTfqPasses) {
      // VQ is the same (occupation-based), but we only store for pre-accessible targets
      preVqScore = vqResult.vq;
      preEcMedian = ecResult.median;
      preEcDetailsJson = JSON.parse(JSON.stringify(ecResult));
    }

    await prisma.targetOccupation.update({
      where: { id: target.id },
      data: {
        stq: pvqResult.stq,
        stqDetails: JSON.parse(JSON.stringify(stqResult)),
        tfq: pvqResult.tfq,
        tfqDetails: JSON.parse(JSON.stringify(tfqResultWithGates)),
        vaq: pvqResult.vaq,
        vaqDetails: JSON.parse(JSON.stringify(vaqResult)),
        lmq: pvqResult.lmq,
        lmqDetails: JSON.parse(JSON.stringify(lmqResult)),
        pvq: pvqResult.pvq,
        excluded: pvqResult.excluded,
        exclusionReason: pvqResult.exclusionReason,
        confidenceGrade: pvqResult.confidenceGrade,
        pendingEvaluatorReview: pvqResult.pendingEvaluatorReview ?? false,
        hasTolerations: pvqResult.hasTolerations ?? false,
        // Pre-injury TFQ
        preTfq: preTfqScore,
        preTfqPasses: preTfqPasses,
        preTfqDetails: preTfqDetailsJson ? JSON.parse(JSON.stringify(preTfqDetailsJson)) : null,
        // JOLTS industry data
        joltsIndustryCode: joltsNaics,
        joltsIndustryName: joltsName,
        joltsCurrentOpenings,
        joltsPreInjuryOpenings,
        joltsTrend: joltsTrendResult?.trend ?? null,
        joltsTrendLabel: joltsTrendResult?.label ?? null,
        // Area-level employment
        areaEmployment: targetAreaEmployment,
        areaMedianWage: targetAreaMedianWage,
        // VQS: VQ
        vqScore: vqResult.vq,
        vqBand: vqResult.band,
        vqDetails: JSON.parse(JSON.stringify(vqResult)),
        // VQS: TSP
        tspScore: tspResult.tsp,
        tspTier: tspResult.tier,
        tspLabel: tspResult.qualitativeLabel,
        tspDetails: JSON.parse(JSON.stringify(tspResult)),
        // VQS: Earning Capacity
        ecMedian: ecResult.median,
        ecMean: ecResult.mean,
        ec10: ecResult.p10,
        ec25: ecResult.p25,
        ec75: ecResult.p75,
        ec90: ecResult.p90,
        ecSee: ecResult.see,
        ecConfLow: ecResult.confLow,
        ecConfHigh: ecResult.confHigh,
        ecGeoAdjusted: ecResult.eclrApplied,
        ecDetails: JSON.parse(JSON.stringify(ecResult)),
        // VQS: Pre-Injury
        preVqScore,
        preEcMedian,
        preEcDetails: preEcDetailsJson ? JSON.parse(JSON.stringify(preEcDetailsJson)) : null,
        // VQ-Centric Feasibility (new continuous scoring)
        feasibilityScore: unifiedResult.feasibilityScore,
        riskLevel: unifiedResult.riskLevel,
        traitDeficits: unifiedResult.deficits.length > 0
          ? JSON.parse(JSON.stringify(unifiedResult.deficits))
          : null,
      },
    });
  }

  // ─── CPC Per-Target Scoring ─────────────────────────────────────
  // Compute CPC code and cosine similarity for each target occupation
  // against the worker's composite component profile.
  try {
    const prwOnetCodes = prwList
      .map((p) => p.onetSocCode)
      .filter((c): c is string => c !== null);
    const maxSvp = Math.max(...prwList.map((p) => p.svp ?? 2), 2);

    // Build the worker's component profile and fingerprint index
    const { buildWorkerComponentProfile } = await import("@/lib/engine/cpc-candidates");
    const workerCPC = await buildWorkerComponentProfile(
      prwOnetCodes,
      maxSvp,
      workerTraits.strength
    );

    // Score each target against the worker composite
    const refetchTargets = await prisma.targetOccupation.findMany({
      where: { analysisId },
      select: { id: true, onetSocCode: true },
    });

    for (const t of refetchTargets) {
      const fp = await getFingerprint(t.onetSocCode);
      if (fp && workerCPC.compositeVector.length > 0) {
        const sim = cosineSimilarity(workerCPC.compositeVector, fp.vector);
        await prisma.targetOccupation.update({
          where: { id: t.id },
          data: {
            cpcCode: fp.cpc.code,
            cpcSimilarity: Math.round(sim * 10000) / 10000,
          },
        });
      }
    }
    console.log(`[compute] CPC scores computed for ${refetchTargets.length} targets`);
  } catch (cpcTargetError) {
    console.warn("[compute] CPC per-target scoring failed:", cpcTargetError);
  }

  // ─── Compute Pre/Post Injury Aggregates ────────────────────────
  // Re-fetch targets with updated scores to compute aggregates
  const updatedTargets = await prisma.targetOccupation.findMany({
    where: { analysisId },
    omit: { feasibilityScore: true, riskLevel: true, traitDeficits: true },
  });

  // Also fetch wage data for employment figures
  const allOnetCodes = [...new Set(updatedTargets.map(t => t.onetSocCode))];
  const allWages = allOnetCodes.length > 0
    ? await prisma.occupationWages.findMany({
        where: { onetSocCode: { in: allOnetCodes } },
        orderBy: { year: "desc" },
        distinct: ["onetSocCode"],
      })
    : [];
  const wageMap = new Map(allWages.map(w => [w.onetSocCode, w]));

  let preInjuryViableCount: number | null = null;
  let preInjuryTotalEmployment: number | null = null;
  let preInjuryJoltsOpenings: number | null = null;
  let preInjuryAreaEmployment: number | null = null;
  let postInjuryViableCount = 0;
  let postInjuryTotalEmployment = 0;
  let postInjuryJoltsOpenings = 0;
  let postInjuryAreaEmployment = 0;

  const hasPreProfile = preTraits !== null;

  if (hasPreProfile) {
    preInjuryViableCount = 0;
    preInjuryTotalEmployment = 0;
    preInjuryJoltsOpenings = 0;
    preInjuryAreaEmployment = 0;
  }

  for (const t of updatedTargets) {
    const aggWages = wageMap.get(t.onetSocCode);
    const employment = aggWages?.employment ?? 0;
    const areaEmpl = t.areaEmployment ?? 0;

    // Post-injury: viable if not excluded
    if (!t.excluded) {
      postInjuryViableCount++;
      postInjuryTotalEmployment += employment;
      postInjuryJoltsOpenings += t.joltsCurrentOpenings ?? 0;
      postInjuryAreaEmployment += areaEmpl;
    }

    // Pre-injury: viable if pre-TFQ passes
    if (hasPreProfile && t.preTfqPasses === true) {
      preInjuryViableCount!++;
      preInjuryTotalEmployment! += employment;
      preInjuryJoltsOpenings! += t.joltsPreInjuryOpenings ?? t.joltsCurrentOpenings ?? 0;
      preInjuryAreaEmployment! += areaEmpl;
    }
  }

  // ─── VQS Earning Capacity Aggregates ──────────────────────
  const viableWithEC = updatedTargets.filter(t => !t.excluded && t.ecMedian !== null);
  const vqsPostEcMedian = viableWithEC.length > 0
    ? Math.round((viableWithEC.reduce((sum, t) => sum + (t.ecMedian ?? 0), 0) / viableWithEC.length) * 100) / 100
    : null;

  let vqsPreEcMedian: number | null = null;
  if (hasPreProfile) {
    const preViableWithEC = updatedTargets.filter(t => t.preTfqPasses && t.preEcMedian !== null);
    vqsPreEcMedian = preViableWithEC.length > 0
      ? Math.round((preViableWithEC.reduce((sum, t) => sum + (t.preEcMedian ?? 0), 0) / preViableWithEC.length) * 100) / 100
      : null;
  }

  const vqsEcLoss = (vqsPreEcMedian !== null && vqsPostEcMedian !== null)
    ? Math.round((vqsPreEcMedian - vqsPostEcMedian) * 100) / 100
    : null;
  const vqsEcLossPct = (vqsPreEcMedian !== null && vqsEcLoss !== null && vqsPreEcMedian > 0)
    ? Math.round((vqsEcLoss / vqsPreEcMedian) * 10000) / 100
    : null;

  await prisma.analysis.update({
    where: { id: analysisId, caseId: id },
    data: {
      step: 5,
      status: "completed",
      preInjuryViableCount: hasPreProfile ? preInjuryViableCount : null,
      preInjuryTotalEmployment: hasPreProfile ? preInjuryTotalEmployment : null,
      preInjuryJoltsOpenings: hasPreProfile ? preInjuryJoltsOpenings : null,
      postInjuryViableCount,
      postInjuryTotalEmployment,
      postInjuryJoltsOpenings,
      // Area-level employment aggregates
      preInjuryAreaEmployment: hasPreProfile ? preInjuryAreaEmployment : null,
      postInjuryAreaEmployment,
      // State-level JOLTS
      stateJoltsCurrent,
      stateJoltsPreInjury,
      stateFips,
      stateName,
      // VQS aggregates
      vqsPostEcMedian,
      vqsPreEcMedian,
      vqsEcLoss,
      vqsEcLossPct,
    },
  });

  // ─── Comprehensive Analysis ───────────────────────────────────────
  // Run after aggregates are computed

  const sourceSvp = Math.max(...prwList.map((p) => p.svp ?? 2), 2);

  // ── 1. Near-Miss Analysis for Excluded Occupations ──────────────
  const excludedTargets = updatedTargets.filter((t) => t.excluded);
  let nearMissResult = null;

  if (excludedTargets.length > 0) {
    const excludedForNearMiss = excludedTargets
      .filter((t) => t.stqDetails && t.tfqDetails && t.vaqDetails && t.lmqDetails)
      .map((t) => {
        const stqDetails = t.stqDetails as unknown as STQResult;
        const tfqDetails = t.tfqDetails as unknown as TFQResult;
        const vaqDetails = t.vaqDetails as unknown;
        const lmqDetails = t.lmqDetails as unknown as LMQResult;

        const pvqResult: PVQResult = {
          pvq: t.pvq ?? 0,
          stq: t.stq ?? 0,
          tfq: t.tfq ?? 0,
          vaq: t.vaq ?? 0,
          lmq: t.lmq ?? 0,
          excluded: t.excluded,
          exclusionReason: t.exclusionReason ?? undefined,
          confidenceGrade: (t.confidenceGrade as "A" | "B" | "C" | "D") ?? "D",
          components: {
            stqResult: stqDetails,
            tfqResult: tfqDetails,
            vaqResult: vaqDetails as PVQResult["components"]["vaqResult"],
            lmqResult: lmqDetails,
          },
        };

        return {
          pvqResult,
          occupationTitle: t.title,
          dotCode: t.dotCode ?? undefined,
          onetCode: t.onetSocCode,
          targetSvp: t.svp ?? 2,
          sourceSvp,
        };
      });

    if (excludedForNearMiss.length > 0) {
      nearMissResult = analyzeNearMisses(excludedForNearMiss);

      // Update excluded targets with near-miss per-occupation data
      for (const nm of nearMissResult.nearMisses) {
        const matchingTarget = excludedTargets.find(
          (t) =>
            t.title === nm.occupationTitle &&
            (t.dotCode === nm.dotCode || (!t.dotCode && !nm.dotCode))
        );
        if (matchingTarget) {
          await prisma.targetOccupation.update({
            where: { id: matchingTarget.id },
            data: {
              nearMissSeverity: nm.severity,
              nearMissDetails: JSON.parse(JSON.stringify(nm)),
            },
          });
        }
      }

      // Also tag significant exclusions that aren't near-misses
      for (const t of excludedTargets) {
        const isNearMiss = nearMissResult.nearMisses.some(
          (nm) =>
            nm.occupationTitle === t.title &&
            (nm.dotCode === t.dotCode || (!nm.dotCode && !t.dotCode))
        );
        if (!isNearMiss && t.nearMissSeverity === null) {
          await prisma.targetOccupation.update({
            where: { id: t.id },
            data: { nearMissSeverity: "significant" },
          });
        }
      }
    }
  }

  // ── 2. Trait Margins for Viable Occupations ─────────────────────
  const viableTargets = updatedTargets.filter((t) => !t.excluded);

  for (const viable of viableTargets) {
    const tfqDetails = viable.tfqDetails as { traitComparisons?: Array<{ margin?: number | null; trait?: string; label?: string; occupationDemand?: number | null }> } | null;
    if (!tfqDetails?.traitComparisons) continue;

    const ratedComparisons = tfqDetails.traitComparisons.filter(
      (c) => c.margin !== null && c.margin !== undefined && c.occupationDemand !== null
    );

    if (ratedComparisons.length === 0) continue;

    const margins = ratedComparisons.map((c) => c.margin as number);
    const traitMarginMin = Math.round(Math.min(...margins) * 100) / 100;
    const traitMarginAvg = Math.round((margins.reduce((s, m) => s + m, 0) / margins.length) * 100) / 100;

    // Find the trait with the smallest margin (closest to failing)
    let closestFailTrait: string | null = null;
    let minMargin = Infinity;
    for (const c of ratedComparisons) {
      if ((c.margin as number) < minMargin) {
        minMargin = c.margin as number;
        closestFailTrait = c.label ?? c.trait ?? null;
      }
    }

    await prisma.targetOccupation.update({
      where: { id: viable.id },
      data: {
        traitMarginMin,
        traitMarginAvg,
        closestFailTrait,
      },
    });
  }

  // ── 3. RFC Narrative ────────────────────────────────────────────
  const viableCount = viableTargets.length;
  const excludedCount = excludedTargets.length;
  const rfcResult = generateRFCNarrative(
    workerTraits,
    preTraits,
    viableCount,
    excludedCount
  );

  // ── 4. Viable Set Analysis ──────────────────────────────────────
  let viableSetResult = null;

  if (viableTargets.length > 0) {
    const viableInputs: ViableOccupationInput[] = viableTargets
      .filter((t) => t.stqDetails && t.tfqDetails && t.vaqDetails && t.lmqDetails)
      .map((t) => {
        const stqDetails = t.stqDetails as unknown as STQResult;
        const tfqDetails = t.tfqDetails as unknown as TFQResult;
        const vaqDetails = t.vaqDetails as unknown;
        const lmqDetails = t.lmqDetails as unknown as LMQResult;

        const pvqResult: PVQResult = {
          pvq: t.pvq ?? 0,
          stq: t.stq ?? 0,
          tfq: t.tfq ?? 0,
          vaq: t.vaq ?? 0,
          lmq: t.lmq ?? 0,
          excluded: t.excluded,
          exclusionReason: t.exclusionReason ?? undefined,
          confidenceGrade: (t.confidenceGrade as "A" | "B" | "C" | "D") ?? "D",
          components: {
            stqResult: stqDetails,
            tfqResult: tfqDetails,
            vaqResult: vaqDetails as PVQResult["components"]["vaqResult"],
            lmqResult: lmqDetails,
          },
        };

        // Build trait demands from tfqDetails traitComparisons
        const traitDemands: Record<string, number | null> = {};
        if (tfqDetails.traitComparisons) {
          for (const c of tfqDetails.traitComparisons) {
            traitDemands[c.trait] = c.occupationDemand ?? null;
          }
        }

        return {
          title: t.title,
          pvqResult,
          traitDemands,
          socCode: t.onetSocCode,
          dotCode: t.dotCode ?? undefined,
        };
      });

    if (viableInputs.length > 0) {
      viableSetResult = analyzeViableSet(viableInputs);
    }
  }

  // ── 5. Confidence Explanation ───────────────────────────────────
  // Use the first viable target as the representative occupation
  let confResult = null;
  const representativeTarget = viableTargets.find(
    (t) => t.stqDetails && t.tfqDetails && t.lmqDetails
  );

  if (representativeTarget) {
    const repStq = representativeTarget.stqDetails as unknown as STQResult;
    const repTfq = representativeTarget.tfqDetails as unknown as TFQResult;
    const repLmq = representativeTarget.lmqDetails as unknown as LMQResult;

    confResult = explainConfidence(repStq, repTfq, repLmq);
  }

  // ── 6. Regional Labor Market ────────────────────────────────────
  let regionResult = null;

  const occupationDetails: OccupationRegionalDetail[] = viableTargets.map((t) => {
    const w = wageMap.get(t.onetSocCode);
    return {
      title: t.title,
      nationalEmployment: w?.employment ?? null,
      areaEmployment: t.areaEmployment ?? null,
      nationalMedianWage: w?.medianWage ?? null,
      areaMedianWage: t.areaMedianWage ?? null,
      joltsCurrentOpenings: t.joltsCurrentOpenings ?? null,
      joltsTrendLabel: t.joltsTrendLabel ?? null,
      projectedGrowthPct: null, // projections were fetched per-target in the loop; use trend label instead
    };
  });

  regionResult = analyzeRegionalLaborMarket({
    stateName: stateName ?? null,
    metroAreaName: eclrAreaName ?? null,
    postViableCount: postInjuryViableCount,
    postTotalEmployment: postInjuryTotalEmployment,
    preViableCount: preInjuryViableCount,
    preTotalEmployment: preInjuryTotalEmployment,
    postAreaEmployment: postInjuryAreaEmployment > 0 ? postInjuryAreaEmployment : null,
    preAreaEmployment: hasPreProfile && preInjuryAreaEmployment !== null && preInjuryAreaEmployment > 0
      ? preInjuryAreaEmployment
      : null,
    stateJoltsCurrent,
    stateJoltsPreInjury,
    eclrFactor,
    occupationDetails,
  });

  // ── 7. Labor Market Access (All 831 OEWS Occupations) ──────────
  let laborMarketAccessResult = null;

  if (preTraits) {
    try {
      // Fetch ALL crosswalk entries for the labor market access engine
      const allCrosswalks = await prisma.dOTONETCrosswalk.findMany({
        select: { dotCode: true, onetSocCode: true },
      });

      // Fetch area-level wage data if metro area is set
      let areaWageData: { onetSocCode: string; employment: number | null }[] | undefined;
      if (eclrAreaCode) {
        areaWageData = await prisma.occupationWages.findMany({
          where: { areaCode: eclrAreaCode },
          select: { onetSocCode: true, employment: true },
        });
      }

      laborMarketAccessResult = await computeLaborMarketAccess({
        preProfile: preTraits,
        postProfile: workerTraits,
        maxSvp: Math.max(...prwList.map((p) => p.svp ?? 2), 2),
        areaCode: eclrAreaCode ?? undefined,
        crosswalkData: allCrosswalks,
        areaWageData,
      });
    } catch (lmaError) {
      console.warn("[compute] Labor market access analysis failed:", lmaError);
    }
  }

  // ── 8. Zero Viable Explanation ────────────────────────────────────
  // When no occupations survive filtering, build a detailed explanation
  // of what factors caused all candidates to be excluded.
  let zeroViableExplanation: Record<string, unknown> | null = null;

  if (viableTargets.length === 0 && excludedTargets.length > 0) {
    // Tally exclusion reasons by category
    const reasonCounts: Record<string, number> = {};
    const strengthExclusions: string[] = [];
    const traitExclusions: Record<string, number> = {};

    for (const t of excludedTargets) {
      const reason = t.exclusionReason ?? "Unknown";
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;

      // Parse out specific failing traits from exclusion reasons
      if (reason.includes("Strength")) {
        strengthExclusions.push(`${t.title}: ${reason}`);
      }

      // Parse trait names from TFQ details
      const tfq = t.tfqDetails as { failedTraits?: Array<{ label?: string; trait?: string }> } | null;
      if (tfq?.failedTraits) {
        for (const ft of tfq.failedTraits) {
          const name = ft.label ?? ft.trait ?? "Unknown trait";
          traitExclusions[name] = (traitExclusions[name] ?? 0) + 1;
        }
      }
    }

    // Sort traits by frequency
    const sortedTraits = Object.entries(traitExclusions)
      .sort((a, b) => b[1] - a[1]);

    // Build the worker's limiting factors from POST profile
    const strengthLabel = STRENGTH_LABELS[workerTraits.strength ?? 0] ?? "Unknown";
    const limitingTraits: string[] = [];
    const traitKeys = Object.keys(workerTraits) as Array<keyof typeof workerTraits>;
    for (const key of traitKeys) {
      const val = workerTraits[key];
      if (val !== null && val !== undefined && val <= 1) {
        const label = (TRAIT_LABELS as Record<string, string>)[key] ?? key;
        limitingTraits.push(`${label} (level ${val})`);
      }
    }

    zeroViableExplanation = {
      totalCandidatesEvaluated: excludedTargets.length,
      viableCount: 0,
      summary: `All ${excludedTargets.length} candidate occupations were excluded based on the evaluee's post-injury residual functional capacity. ` +
        `The evaluee is restricted to ${strengthLabel} exertional level` +
        (limitingTraits.length > 0
          ? `, with additional limitations in: ${limitingTraits.slice(0, 8).join("; ")}`
          : "") +
        `. These restrictions precluded all identified transferable occupations.`,
      primaryExclusionFactors: sortedTraits.slice(0, 10).map(([trait, count]) => ({
        trait,
        count,
        pctOfExcluded: Math.round((count / excludedTargets.length) * 100),
      })),
      strengthAnalysis: {
        workerLevel: strengthLabel,
        workerValue: workerTraits.strength ?? 0,
        exclusionsDueToStrength: strengthExclusions.length,
        details: strengthExclusions.slice(0, 10),
      },
      workerLimitations: limitingTraits,
      exclusionReasonBreakdown: Object.entries(reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([reason, count]) => ({ reason, count })),
      vocationalImplication: viableTargets.length === 0
        ? "Based on this analysis, no transferable occupations within the evaluee's demonstrated skill level were identified that fall within the post-injury residual functional capacity. " +
          "This finding indicates a complete loss of access to occupations requiring the evaluee's transferable skills at the current functional level."
        : null,
    };
  }

  // ── 9. Component Profile Code (CPC) Analysis ────────────────────
  // Always computed — every report gets the component profile section.
  // Incorporates ORS physical demands and OEWS employment/wage data.
  let cpcAnalysisResult = null;
  try {
    const prwOnetCodesForCPC = prwList
      .map((p) => p.onetSocCode)
      .filter((c): c is string => c !== null);
    const maxSvpForCPC = Math.max(...prwList.map((p) => p.svp ?? 2), 2);

    // Collect existing target codes so CPC candidates don't duplicate them
    const existingTargetCodes = new Set(
      updatedTargets.map((t) => t.onetSocCode)
    );

    cpcAnalysisResult = await buildCPCAnalysis(
      prwOnetCodesForCPC,
      maxSvpForCPC,
      workerTraits.strength,
      {
        excludeCodes: existingTargetCodes,
        // When zero viable, run a second pass with relaxed SVP to find near-matches
        relaxSvp: viableTargets.length === 0,
        minSimilarity: viableTargets.length === 0 ? 0.25 : 0.4,
        topN: 30,
      }
    );
    console.log(
      `[compute] CPC analysis complete: ${cpcAnalysisResult.similarOccupations.length} similar occupations found, ` +
      `OEWS data available for ${cpcAnalysisResult.laborMarketSummary.withOEWSData} matches`
    );
  } catch (cpcError) {
    console.warn("[compute] CPC analysis failed:", cpcError);
  }

  // ── Save Comprehensive Analysis Results ─────────────────────────
  await prisma.analysis.update({
    where: { id: analysisId, caseId: id },
    data: {
      nearMissAnalysis: nearMissResult ? JSON.parse(JSON.stringify(nearMissResult)) : null,
      rfcNarrative: rfcResult ? JSON.parse(JSON.stringify(rfcResult)) : null,
      viableSetAnalysis: viableSetResult ? JSON.parse(JSON.stringify(viableSetResult)) : null,
      confidenceExplanation: confResult ? JSON.parse(JSON.stringify(confResult)) : null,
      regionalLaborMarket: regionResult ? JSON.parse(JSON.stringify(regionResult)) : null,
      laborMarketAccess: laborMarketAccessResult ? JSON.parse(JSON.stringify(laborMarketAccessResult)) : null,
      zeroViableExplanation: zeroViableExplanation ? JSON.parse(JSON.stringify(zeroViableExplanation)) : null,
      cpcAnalysis: cpcAnalysisResult ? JSON.parse(JSON.stringify(cpcAnalysisResult)) : null,
    },
  });

  return NextResponse.json({ computed: targets.length, excluded: excludedTargets.length });
  } catch (error) {
    console.error("[POST /api/cases/[id]/analysis/[analysisId]/compute]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
