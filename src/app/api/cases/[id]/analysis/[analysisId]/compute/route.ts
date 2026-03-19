import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computePVQ } from "@/lib/engine/pvq";
import { computeSTQ, type SkillTransferInput } from "@/lib/engine/skill-transfer";
import { computeTFQ, buildDOTDemandVector, buildOccupationDemands } from "@/lib/engine/trait-feasibility";
import { computeVAQ, estimateVAQ, type VocationalAdjustment } from "@/lib/engine/vocational-adjustment";
import { computeLMQ } from "@/lib/engine/labor-market";
import { profileToTraitVector } from "@/lib/engine/traits";
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
import { type PVQResult } from "@/lib/engine/pvq";
import { type STQResult } from "@/lib/engine/skill-transfer";
import { type TFQResult } from "@/lib/engine/trait-feasibility";
import { type LMQResult } from "@/lib/engine/labor-market";

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

    // ─── Pre-Injury TFQ (if PRE profile exists) ──────────────────
    let preTfqScore: number | null = null;
    let preTfqPasses: boolean | null = null;
    let preTfqDetailsJson: unknown = null;
    if (preTraits) {
      const preTfqResult = computeTFQ(preTraits, demandVector, demandSources);
      preTfqScore = preTfqResult.tfq;
      preTfqPasses = preTfqResult.passes;
      preTfqDetailsJson = JSON.parse(JSON.stringify(preTfqResult));
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
    const vaqResult = computeVAQ(
      adj,
      (analysis.ageRule as
        | "standard"
        | "advanced_age"
        | "closely_approaching") ?? "standard"
    );

    // ─── LMQ ────────────────────────────────────────────────────────
    const wages = await prisma.occupationWages.findFirst({
      where: { onetSocCode: target.onetSocCode, areaType: "national" },
      orderBy: { year: "desc" },
    });
    const projections = await prisma.occupationProjections.findFirst({
      where: {
        socCode: target.onetSocCode.replace(/\.\d+$/, ""),  // "43-4051.00" → "43-4051"
      },
    });

    // ─── Area-Level Employment Lookup ─────────────────────────────
    let targetAreaEmployment: number | null = null;
    let targetAreaMedianWage: number | null = null;
    if (eclrAreaCode) {
      const areaWages = await prisma.occupationWages.findFirst({
        where: { onetSocCode: target.onetSocCode, areaCode: eclrAreaCode },
        orderBy: { year: "desc" },
      });
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

    // ─── PVQ Composite ──────────────────────────────────────────────
    const pvqResult = computePVQ(stqResult, tfqResult, vaqResult, lmqResult);

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
        tfqDetails: JSON.parse(JSON.stringify(tfqResult)),
        vaq: pvqResult.vaq,
        vaqDetails: JSON.parse(JSON.stringify(vaqResult)),
        lmq: pvqResult.lmq,
        lmqDetails: JSON.parse(JSON.stringify(lmqResult)),
        pvq: pvqResult.pvq,
        excluded: pvqResult.excluded,
        exclusionReason: pvqResult.exclusionReason,
        confidenceGrade: pvqResult.confidenceGrade,
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
      },
    });
  }

  // ─── Compute Pre/Post Injury Aggregates ────────────────────────
  // Re-fetch targets with updated scores to compute aggregates
  const updatedTargets = await prisma.targetOccupation.findMany({
    where: { analysisId },
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
    const wages = wageMap.get(t.onetSocCode);
    const employment = wages?.employment ?? 0;
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
    where: { id: analysisId },
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

  // ── Save Comprehensive Analysis Results ─────────────────────────
  await prisma.analysis.update({
    where: { id: analysisId },
    data: {
      nearMissAnalysis: nearMissResult ? JSON.parse(JSON.stringify(nearMissResult)) : null,
      rfcNarrative: rfcResult ? JSON.parse(JSON.stringify(rfcResult)) : null,
      viableSetAnalysis: viableSetResult ? JSON.parse(JSON.stringify(viableSetResult)) : null,
      confidenceExplanation: confResult ? JSON.parse(JSON.stringify(confResult)) : null,
      regionalLaborMarket: regionResult ? JSON.parse(JSON.stringify(regionResult)) : null,
    },
  });

  return NextResponse.json({ computed: targets.length });
  } catch (error) {
    console.error("[POST /api/cases/[id]/analysis/[analysisId]/compute]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
