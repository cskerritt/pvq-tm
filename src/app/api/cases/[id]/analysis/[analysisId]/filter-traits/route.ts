import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { profileToTraitVector, STRENGTH_LABELS } from "@/lib/engine/traits";
import {
  computeTFQ,
  buildDOTDemandVector,
  buildOccupationDemands,
} from "@/lib/engine/trait-feasibility";
import { mapORSToTraits } from "@/lib/engine/traits";

/**
 * Physical demand trait keys that receive explicit gating checks.
 * If the occupation's demand exceeds the worker's POST capacity on any
 * of these traits, the occupation is excluded with a human-readable reason
 * REGARDLESS of the overall TFQ score.
 */
const PHYSICAL_GATE_TRAITS = [
  { key: "strength", label: "Strength" },
  { key: "climbBalance", label: "Climb/Balance" },
  { key: "stoopKneel", label: "Stoop/Kneel" },
  { key: "reachHandle", label: "Reach/Handle" },
] as const;

const STRENGTH_LABEL_MAP: Record<number, string> = {
  0: "Sedentary",
  1: "Light",
  2: "Medium",
  3: "Heavy",
  4: "Very Heavy",
};

const FREQUENCY_LABEL_MAP: Record<number, string> = {
  0: "Not Present",
  1: "Seldom",
  2: "Occasionally",
  3: "Frequently",
  4: "Constantly",
};

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
    omit: { feasibilityScore: true, riskLevel: true, traitDeficits: true },
    include: { onetOcc: true },
  });

  // ─── Batch-fetch DOT records for targets that have dotCode ────────
  const targetDotCodes = targets
    .map((t) => t.dotCode)
    .filter((c): c is string => c !== null);
  const dotOccs = await prisma.occupationDOT.findMany({
    where: { id: { in: targetDotCodes } },
  });
  const dotMap = Object.fromEntries(dotOccs.map((d) => [d.id, d]));

  // ─── For targets WITHOUT dotCode, look up crosswalk ───────────────
  const targetsNeedingCrosswalk = targets.filter(
    (t) => !t.dotCode || !dotMap[t.dotCode]
  );
  const crosswalkOnetCodes = [
    ...new Set(targetsNeedingCrosswalk.map((t) => t.onetSocCode)),
  ];

  let crosswalkMap: Record<string, string> = {}; // onetSocCode → dotCode
  if (crosswalkOnetCodes.length > 0) {
    const crosswalks = await prisma.dOTONETCrosswalk.findMany({
      where: { onetSocCode: { in: crosswalkOnetCodes } },
      include: { dotOcc: true },
    });
    // Pick the first crosswalk DOT for each O*NET code
    for (const cw of crosswalks) {
      if (!crosswalkMap[cw.onetSocCode]) {
        crosswalkMap[cw.onetSocCode] = cw.dotCode;
        if (!dotMap[cw.dotCode]) {
          dotMap[cw.dotCode] = cw.dotOcc;
        }
      }
    }
  }

  // ─── Batch-fetch ORS records for all target O*NET codes ───────────
  const allOnetCodes = [...new Set(targets.map((t) => t.onetSocCode))];
  const orsRecords = await prisma.occupationORS.findMany({
    where: { onetSocCode: { in: allOnetCodes } },
  });
  const orsMap = Object.fromEntries(
    orsRecords.map((o) => [o.onetSocCode, o])
  );

  let excluded = 0;
  let passed = 0;

  for (const target of targets) {
    // Resolve DOT record: direct dotCode, or via crosswalk
    const effectiveDotCode =
      target.dotCode ?? crosswalkMap[target.onetSocCode] ?? null;
    const dotOcc = effectiveDotCode ? dotMap[effectiveDotCode] : null;

    // Get O*NET data from the included relation
    const onetOcc = target.onetOcc;
    const onetData = onetOcc
      ? {
          abilities: onetOcc.abilities,
          workContext: onetOcc.workContext,
          svp: onetOcc.jobZone != null ? onetOcc.jobZone + 1 : undefined,
        }
      : null;

    // Get ORS data
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

    // Build occupation demands from the best available data
    let demandVector;
    let demandSources;

    if (dotOcc) {
      // Primary path: DOT data + O*NET supplementation
      const dotDemands = buildDOTDemandVector(
        dotOcc,
        onetData as Record<string, unknown> | null
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
        onetData as Record<string, unknown> | null
      );
      demandVector = demands;
      demandSources = sources;
    }

    // ─── Explicit Physical Demand Gates (VDARE Step 7) ──────────────
    // These produce clear, human-readable exclusion reasons BEFORE TFQ
    const gateFailures: string[] = [];

    for (const gate of PHYSICAL_GATE_TRAITS) {
      const demand = (demandVector as Record<string, number | null>)[gate.key];
      const capacity = (workerTraits as Record<string, number | null>)[
        gate.key
      ];

      // Categorical comparison: floor demand to integer category level.
      // Worker profiles use integers (0-4), O*NET demands may be decimal.
      // A worker at category 2 should pass demand 2.99 (same category).
      const demandCategory = demand !== null && demand !== undefined ? Math.floor(demand) : null;

      if (
        demandCategory !== null &&
        capacity !== null &&
        capacity !== undefined &&
        capacity < demandCategory
      ) {
        if (gate.key === "strength") {
          const demandLabel =
            STRENGTH_LABEL_MAP[demandCategory] ?? `Level ${demandCategory}`;
          const capacityLabel =
            STRENGTH_LABEL_MAP[capacity] ?? `Level ${capacity}`;
          gateFailures.push(
            `${gate.label}: occupation requires ${demandLabel} but worker restricted to ${capacityLabel}`
          );
        } else {
          const demandLabel =
            FREQUENCY_LABEL_MAP[demandCategory] ?? `Level ${demandCategory}`;
          const capacityLabel =
            FREQUENCY_LABEL_MAP[capacity] ?? `Level ${capacity}`;
          gateFailures.push(
            `${gate.label}: occupation demands ${demandLabel} but worker capacity is ${capacityLabel}`
          );
        }
      }
    }

    // If any gate fails, exclude immediately with descriptive reason
    if (gateFailures.length > 0) {
      await prisma.targetOccupation.update({
        where: { id: target.id },
        data: {
          excluded: true,
          exclusionReason: `Physical demand gate failure: ${gateFailures.join("; ")}`,
          tfq: 0,
          tfqDetails: JSON.parse(
            JSON.stringify({
              tfq: 0,
              passes: false,
              failedTraits: gateFailures.map((reason) => ({
                trait: reason.split(":")[0],
                label: reason.split(":")[0],
                reason,
              })),
              traitComparisons: [],
              reserveMargin: 0,
              gateFailures,
            })
          ),
        },
      });
      excluded++;
      continue;
    }

    // ─── Full TFQ Computation ───────────────────────────────────────
    // Look up analysis mode from the analysis record (defaults to "strict" if column not yet migrated)
    let analysisMode: "strict" | "clinical" = "strict";
    try {
      const analysisRecord = await prisma.analysis.findUnique({ where: { id: analysisId } });
      if (analysisRecord && "analysisMode" in analysisRecord) {
        analysisMode = (analysisRecord as Record<string, unknown>).analysisMode as "strict" | "clinical" ?? "strict";
      }
    } catch { /* column may not exist pre-migration */ }
    const tfqResult = computeTFQ(workerTraits, demandVector, demandSources, analysisMode);

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
    where: { id: analysisId, caseId: id },
    data: { step: 4 },
  });

  return NextResponse.json({ passed, excluded });
  } catch (error) {
    console.error("[POST /api/cases/[id]/analysis/[analysisId]/filter-traits]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
