import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  normalizeDOTAptitude,
  normalizeDOTStrength,
  normalizeDOTPhysical,
  normalizeDOTGED,
} from "@/lib/engine/traits";

/**
 * GET /api/occupations/dot-lookup?onet=XX-XXXX.XX
 *
 * Given an O*NET SOC code, find the corresponding DOT occupation(s) via crosswalk.
 * Returns DOT code, title, SVP, strength, skill level, and the full 24-trait vector
 * (normalized to 0-4 scale) for use in worker profile auto-population.
 */
export async function GET(req: NextRequest) {
  const onetCode = req.nextUrl.searchParams.get("onet");
  if (!onetCode) {
    return NextResponse.json({ error: "Missing onet parameter" }, { status: 400 });
  }

  try {
    // Find DOT entries via crosswalk
    const crosswalks = await prisma.dOTONETCrosswalk.findMany({
      where: { onetSocCode: onetCode },
      include: {
        dotOcc: true,
      },
      take: 10,
    });

    if (crosswalks.length === 0) {
      return NextResponse.json({ dotEntries: [], message: "No DOT crosswalk found" });
    }

    const dotEntries = crosswalks.map((cw) => {
      const dot = cw.dotOcc;

      // Determine skill level from SVP
      let skillLevel: string;
      if (dot.svp <= 3) skillLevel = "unskilled";
      else if (dot.svp <= 6) skillLevel = "semiskilled";
      else skillLevel = "skilled";

      // Build 24-trait vector from DOT data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aptitudes = dot.aptitudes as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const physDemands = dot.physicalDemands as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const envConds = dot.envConditions as any;

      // Aptitudes (DOT 1-5 scale → normalized 0-4)
      const traits: Record<string, number | null> = {
        reasoning: normalizeDOTGED(dot.gedR),
        math: normalizeDOTGED(dot.gedM),
        language: normalizeDOTGED(dot.gedL),
        spatialPerception: aptitudes?.S != null ? normalizeDOTAptitude(aptitudes.S) : null,
        formPerception: aptitudes?.P != null ? normalizeDOTAptitude(aptitudes.P) : null,
        clericalPerception: aptitudes?.Q != null ? normalizeDOTAptitude(aptitudes.Q) : null,

        // Physical / dexterity
        motorCoordination: aptitudes?.K != null ? normalizeDOTAptitude(aptitudes.K) : null,
        fingerDexterity: aptitudes?.F != null ? normalizeDOTAptitude(aptitudes.F) : null,
        manualDexterity: aptitudes?.M != null ? normalizeDOTAptitude(aptitudes.M) : null,
        eyeHandFoot: aptitudes?.E != null ? normalizeDOTAptitude(aptitudes.E) : null,
        colorDiscrimination: aptitudes?.C != null ? normalizeDOTAptitude(aptitudes.C) : null,

        // Strength
        strength: normalizeDOTStrength(dot.strength),

        // Physical demands
        climbBalance: physDemands?.climbing != null ? normalizeDOTPhysical(physDemands.climbing) : null,
        stoopKneel: physDemands?.stooping != null ? normalizeDOTPhysical(physDemands.stooping) : null,
        reachHandle: physDemands?.reaching != null ? normalizeDOTPhysical(physDemands.reaching) : null,
        talkHear: physDemands?.talking != null ? normalizeDOTPhysical(physDemands.talking) : null,
        see: physDemands?.seeing != null ? normalizeDOTPhysical(physDemands.seeing) : null,

        // Environmental
        workLocation: envConds?.outsideWork != null ? normalizeDOTPhysical(envConds.outsideWork) : null,
        extremeCold: envConds?.cold != null ? normalizeDOTPhysical(envConds.cold) : null,
        extremeHeat: envConds?.heat != null ? normalizeDOTPhysical(envConds.heat) : null,
        wetnessHumidity: envConds?.wet != null ? normalizeDOTPhysical(envConds.wet) : null,
        noiseVibration: envConds?.noise != null ? normalizeDOTPhysical(envConds.noise) : null,
        hazards: envConds?.hazards != null ? normalizeDOTPhysical(envConds.hazards) : null,
        dustsFumes: envConds?.fumes != null ? normalizeDOTPhysical(envConds.fumes) : null,
      };

      return {
        dotCode: dot.id,
        title: dot.title,
        svp: dot.svp,
        strength: dot.strength,
        skillLevel,
        gedR: dot.gedR,
        gedM: dot.gedM,
        gedL: dot.gedL,
        workFields: dot.workFields,
        mpsms: dot.mpsms,
        traits,
      };
    });

    return NextResponse.json({ dotEntries });
  } catch (error) {
    console.error("[GET /api/occupations/dot-lookup]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
