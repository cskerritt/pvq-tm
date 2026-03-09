import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildDOTDemandVector } from "@/lib/engine/trait-feasibility";
import { mapORSToTraits, TRAIT_KEYS, type TraitKey } from "@/lib/engine/traits";

/**
 * POST /api/cases/[id]/profiles/analyze
 *
 * Analyzes all PRW entries for a case and returns an aggregated
 * Work History trait vector. For each of the 24 traits, the maximum
 * demand across all PRW jobs is used (the work history represents
 * the highest demands the worker has demonstrated).
 *
 * Data sources (priority chain):
 * 1. DOT direct: PRW has dotCode → dotOcc relation → GED + strength
 * 2. DOT via crosswalk: PRW has onetSocCode → DOTONETCrosswalk → DOT data
 * 3. ORS: PRW has onetSocCode → OccupationORS → physical/environmental traits
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;

    // 1. Fetch all PRW entries with DOT occupation data
    const prwEntries = await prisma.pastRelevantWork.findMany({
      where: { caseId },
      include: { dotOcc: true },
    });

    if (prwEntries.length === 0) {
      return NextResponse.json(
        { error: "No past relevant work entries found for this case" },
        { status: 404 }
      );
    }

    // 2. Collect unique O*NET SOC codes for ORS + crosswalk lookup
    const onetCodes = [
      ...new Set(
        prwEntries
          .map((p) => p.onetSocCode)
          .filter((c): c is string => c !== null && c !== undefined)
      ),
    ];

    // Fetch ORS data for all relevant O*NET codes
    const orsRecords =
      onetCodes.length > 0
        ? await prisma.occupationORS.findMany({
            where: { onetSocCode: { in: onetCodes } },
          })
        : [];

    const orsMap = new Map(orsRecords.map((r) => [r.onetSocCode, r]));

    // For PRW entries without a direct dotCode, look up DOT via crosswalk
    const prwNeedingCrosswalk = prwEntries.filter(
      (p) => !p.dotOcc && p.onetSocCode
    );
    const crosswalkOnetCodes = [
      ...new Set(prwNeedingCrosswalk.map((p) => p.onetSocCode!)),
    ];

    const crosswalkEntries =
      crosswalkOnetCodes.length > 0
        ? await prisma.dOTONETCrosswalk.findMany({
            where: { onetSocCode: { in: crosswalkOnetCodes } },
            include: { dotOcc: true },
          })
        : [];

    // Build a map: onetSocCode → first matching DOT occupation
    const crosswalkDotMap = new Map<
      string,
      { gedR: number; gedM: number; gedL: number; strength: string }
    >();
    for (const cw of crosswalkEntries) {
      if (!crosswalkDotMap.has(cw.onetSocCode) && cw.dotOcc) {
        crosswalkDotMap.set(cw.onetSocCode, {
          gedR: cw.dotOcc.gedR,
          gedM: cw.dotOcc.gedM,
          gedL: cw.dotOcc.gedL,
          strength: cw.dotOcc.strength,
        });
      }
    }

    // 3. Build trait vectors for each PRW entry and aggregate (max per trait)
    const aggregated: Partial<Record<TraitKey, number>> = {};
    let filledCount = 0;
    const jobsUsed = prwEntries.length;
    let dotSourceCount = 0;

    for (const prw of prwEntries) {
      // DOT traits (reasoning, math, language, strength)
      // Priority: direct dotOcc → crosswalk lookup
      const dotData =
        prw.dotOcc ??
        (prw.onetSocCode ? crosswalkDotMap.get(prw.onetSocCode) : null);

      if (dotData) {
        const { demands: dotDemands } = buildDOTDemandVector({
          gedR: dotData.gedR,
          gedM: dotData.gedM,
          gedL: dotData.gedL,
          strength: dotData.strength,
        });

        for (const key of TRAIT_KEYS) {
          const val = dotDemands[key];
          if (val !== null) {
            aggregated[key] = Math.max(aggregated[key] ?? 0, val);
          }
        }
        dotSourceCount++;
      }

      // ORS traits (physical demands + environmental conditions)
      if (prw.onetSocCode) {
        // Try the full code first, then the base .00 code
        let ors = orsMap.get(prw.onetSocCode);
        if (!ors) {
          const baseSoc = prw.onetSocCode.replace(/\.\d+$/, ".00");
          if (baseSoc !== prw.onetSocCode) {
            ors = orsMap.get(baseSoc);
          }
        }

        if (ors) {
          const orsTraits = mapORSToTraits(
            ors.physicalDemands as Record<
              string,
              { t: string; v: string | number }[]
            > | null,
            ors.envConditions as Record<
              string,
              { t: string; v: string | number }[]
            > | null
          );

          for (const [key, val] of Object.entries(orsTraits)) {
            if (val !== null && val !== undefined) {
              aggregated[key as TraitKey] = Math.max(
                aggregated[key as TraitKey] ?? 0,
                val
              );
            }
          }
        }
      }
    }

    // 4. Build the response — only include traits that have values
    const result: Record<string, unknown> = {
      profileType: "WORK_HISTORY",
    };

    for (const key of TRAIT_KEYS) {
      const val = aggregated[key];
      if (val !== undefined) {
        result[key] = val;
        filledCount++;
      }
    }

    return NextResponse.json({
      ...result,
      _meta: {
        filledCount,
        totalTraits: TRAIT_KEYS.length,
        jobsAnalyzed: jobsUsed,
        dotSourceCount,
        orsAvailable: orsRecords.length,
      },
    });
  } catch (error) {
    console.error("[POST /api/cases/[id]/profiles/analyze]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
