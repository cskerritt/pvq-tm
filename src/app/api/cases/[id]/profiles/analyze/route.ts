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
 * Data sources:
 * - DOT: reasoning, math, language, strength (from PRW → dotOcc relation)
 * - ORS: ~15 physical/environmental traits (from OccupationORS by O*NET code)
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

    // 2. Collect unique O*NET SOC codes for ORS lookup
    const onetCodes = [
      ...new Set(
        prwEntries
          .map((p) => p.onetSocCode)
          .filter((c): c is string => c !== null && c !== undefined)
      ),
    ];

    // Fetch ORS data for all relevant O*NET codes
    const orsRecords = onetCodes.length > 0
      ? await prisma.occupationORS.findMany({
          where: { onetSocCode: { in: onetCodes } },
        })
      : [];

    const orsMap = new Map(orsRecords.map((r) => [r.onetSocCode, r]));

    // 3. Build trait vectors for each PRW entry and aggregate (max per trait)
    const aggregated: Partial<Record<TraitKey, number>> = {};
    let filledCount = 0;
    const jobsUsed = prwEntries.length;

    for (const prw of prwEntries) {
      // DOT traits (reasoning, math, language, strength)
      if (prw.dotOcc) {
        const { demands: dotDemands } = buildDOTDemandVector({
          gedR: prw.dotOcc.gedR,
          gedM: prw.dotOcc.gedM,
          gedL: prw.dotOcc.gedL,
          strength: prw.dotOcc.strength,
        });

        for (const key of TRAIT_KEYS) {
          const val = dotDemands[key];
          if (val !== null) {
            aggregated[key] = Math.max(aggregated[key] ?? 0, val);
          }
        }
      }

      // ORS traits (physical demands + environmental conditions)
      if (prw.onetSocCode) {
        // Try the full code first, then the 6-digit base code
        let ors = orsMap.get(prw.onetSocCode);
        if (!ors) {
          // Try base SOC code (XX-XXXX) without the .XX suffix
          const baseSoc = prw.onetSocCode.replace(/\.\d+$/, ".00");
          if (baseSoc !== prw.onetSocCode) {
            ors = orsMap.get(baseSoc);
          }
        }

        if (ors) {
          const orsTraits = mapORSToTraits(
            ors.physicalDemands as Record<string, { t: string; v: string | number }[]> | null,
            ors.envConditions as Record<string, { t: string; v: string | number }[]> | null
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
