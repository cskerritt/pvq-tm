import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildDOTDemandVector } from "@/lib/engine/trait-feasibility";
import { mapORSToTraits, mapONETAbilitiesToTraits, TRAIT_KEYS, type TraitKey, normalizeDOTAptitude, normalizeDOTPhysical } from "@/lib/engine/traits";

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
            include: {
              dotOcc: {
                select: {
                  id: true,
                  gedR: true,
                  gedM: true,
                  gedL: true,
                  strength: true,
                  aptitudes: true,
                  physicalDemands: true,
                  envConditions: true,
                },
              },
            },
          })
        : [];

    // Build a map: onetSocCode → first matching DOT occupation
    type CrosswalkDotData = {
      gedR: number;
      gedM: number;
      gedL: number;
      strength: string;
      aptitudes: unknown;
      physicalDemands: unknown;
      envConditions: unknown;
    };
    const crosswalkDotMap = new Map<string, CrosswalkDotData>();
    for (const cw of crosswalkEntries) {
      if (!crosswalkDotMap.has(cw.onetSocCode) && cw.dotOcc) {
        crosswalkDotMap.set(cw.onetSocCode, {
          gedR: cw.dotOcc.gedR,
          gedM: cw.dotOcc.gedM,
          gedL: cw.dotOcc.gedL,
          strength: cw.dotOcc.strength,
          aptitudes: cw.dotOcc.aptitudes,
          physicalDemands: cw.dotOcc.physicalDemands,
          envConditions: cw.dotOcc.envConditions,
        });
      }
    }

    // Fetch O*NET abilities data for all relevant O*NET codes
    const onetRecords =
      onetCodes.length > 0
        ? await prisma.occupationONET.findMany({
            where: { id: { in: onetCodes } },
            select: { id: true, abilities: true },
          })
        : [];

    const onetMap = new Map(onetRecords.map((r) => [r.id, r]));

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

      // O*NET abilities (spatialPerception, formPerception, clericalPerception,
      // eyeHandFoot, colorDiscrimination)
      if (prw.onetSocCode) {
        const onetOcc = onetMap.get(prw.onetSocCode);
        if (onetOcc?.abilities) {
          const abilityTraits = mapONETAbilitiesToTraits(
            onetOcc.abilities as { id: string; name: string; value: number; level: number }[]
          );

          for (const [key, val] of Object.entries(abilityTraits)) {
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

    // 4. Gap-filling pass: fill remaining null traits from expanded DOT data
    let gapsFilled = 0;

    // DOT aptitude code → trait key mapping
    const DOT_APTITUDE_MAP: Record<string, TraitKey> = {
      G: "reasoning",
      V: "language",
      N: "math",
      S: "spatialPerception",
      P: "formPerception",
      Q: "clericalPerception",
      K: "motorCoordination",
      F: "fingerDexterity",
      M: "manualDexterity",
      E: "eyeHandFoot",
      C: "colorDiscrimination",
    };

    // DOT physicalDemands key → trait key mapping
    const DOT_PHYSICAL_MAP: Record<string, TraitKey> = {
      climbing: "climbBalance",
      stooping: "stoopKneel",
      reaching: "reachHandle",
      seeing: "see",
    };
    // talking and hearing both map to talkHear (use max)
    const DOT_TALKHEAR_KEYS = ["talking", "hearing"];

    // DOT envConditions key → trait key mapping
    const DOT_ENV_MAP: Record<string, TraitKey> = {
      outsideWork: "workLocation",
      extremeCold: "extremeCold",
      extremeHeat: "extremeHeat",
      wet: "wetnessHumidity",
      noise: "noiseVibration",
      hazards: "hazards",
      dust: "dustsFumes",
    };

    for (const prw of prwEntries) {
      const dotData =
        prw.dotOcc ??
        (prw.onetSocCode ? crosswalkDotMap.get(prw.onetSocCode) : null);

      if (!dotData) continue;

      // (a) Fill from DOT aptitudes
      const aptitudes = dotData.aptitudes as Record<string, string | number> | null;
      if (aptitudes && typeof aptitudes === "object") {
        for (const [code, traitKey] of Object.entries(DOT_APTITUDE_MAP)) {
          if (aggregated[traitKey] !== undefined) continue; // already set
          const rawVal = aptitudes[code];
          if (rawVal !== undefined && rawVal !== null) {
            const dotVal = typeof rawVal === "string" ? parseInt(rawVal, 10) : rawVal;
            if (!isNaN(dotVal)) {
              const normalized = normalizeDOTAptitude(dotVal);
              aggregated[traitKey] = Math.max(aggregated[traitKey] ?? 0, normalized);
              gapsFilled++;
            }
          }
        }
      }

      // (b) Fill from DOT physicalDemands
      const physDemands = dotData.physicalDemands as Record<string, string> | null;
      if (physDemands && typeof physDemands === "object") {
        for (const [pdKey, traitKey] of Object.entries(DOT_PHYSICAL_MAP)) {
          if (aggregated[traitKey] !== undefined) continue;
          const code = physDemands[pdKey];
          if (code) {
            const normalized = normalizeDOTPhysical(code);
            aggregated[traitKey] = Math.max(aggregated[traitKey] ?? 0, normalized);
            gapsFilled++;
          }
        }

        // talkHear: max of talking and hearing
        if (aggregated["talkHear"] === undefined) {
          let maxTalkHear = -1;
          for (const key of DOT_TALKHEAR_KEYS) {
            const code = physDemands[key];
            if (code) {
              maxTalkHear = Math.max(maxTalkHear, normalizeDOTPhysical(code));
            }
          }
          if (maxTalkHear >= 0) {
            aggregated["talkHear"] = Math.max(aggregated["talkHear"] ?? 0, maxTalkHear);
            gapsFilled++;
          }
        }
      }

      // (c) Fill from DOT envConditions
      const envConds = dotData.envConditions as Record<string, string> | null;
      if (envConds && typeof envConds === "object") {
        for (const [envKey, traitKey] of Object.entries(DOT_ENV_MAP)) {
          if (aggregated[traitKey] !== undefined) continue;
          const code = envConds[envKey];
          if (code) {
            const normalized = normalizeDOTPhysical(code); // same N/S/O/F/C scale
            aggregated[traitKey] = Math.max(aggregated[traitKey] ?? 0, normalized);
            gapsFilled++;
          }
        }
      }
    }

    // 5. Build the response — only include traits that have values
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

    // 6. Cascade WORK_HISTORY traits to PRE, POST, and EVALUATIVE profiles
    // Only fill traits that are currently null in those profiles
    const cascadeProfileTypes = ["PRE", "POST", "EVALUATIVE"];
    const existingProfiles = await prisma.workerProfile.findMany({
      where: { caseId, profileType: { in: cascadeProfileTypes } },
    });

    for (const profile of existingProfiles) {
      const updates: Record<string, number> = {};
      for (const key of TRAIT_KEYS) {
        const currentVal = (profile as Record<string, unknown>)[key];
        const workHistoryVal = aggregated[key];
        if (
          (currentVal === null || currentVal === undefined) &&
          workHistoryVal !== undefined
        ) {
          updates[key] = workHistoryVal;
        }
      }
      if (Object.keys(updates).length > 0) {
        await prisma.workerProfile.update({
          where: { id: profile.id },
          data: updates,
        });
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
        onetAbilitiesAvailable: onetRecords.filter((r) => r.abilities).length,
        gapsFilled,
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
