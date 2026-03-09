import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncSingleOccupation } from "@/lib/api/sync";

/**
 * GET /api/occupations/auto-fill?code=XX-XXXX.XX
 *
 * Given an O*NET SOC code, return all data needed to auto-fill PRW form:
 * - SVP (from jobZone mapping)
 * - Strength (from ORS physical demands)
 * - Skill level (from SVP)
 * - DOT crosswalk data (if available)
 * - Wage data (if available)
 *
 * This endpoint is the single source for PRW auto-population.
 * It works even without DOT crosswalk data by using O*NET/ORS/OEWS data.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code parameter" }, { status: 400 });
  }

  try {
    // 1. Get O*NET cached data (sync if needed)
    let occ = await prisma.occupationONET.findUnique({ where: { id: code } });
    if (!occ) {
      const synced = await syncSingleOccupation(code);
      if (synced) {
        occ = await prisma.occupationONET.findUnique({ where: { id: code } });
      }
    }

    if (!occ) {
      return NextResponse.json({ error: "Occupation not found" }, { status: 404 });
    }

    // 2. Map jobZone → SVP
    const svp = jobZoneToSvp(occ.jobZone);
    const skillLevel = svpToSkillLevel(svp);

    // 3. Get ORS data for strength
    const ors = await prisma.occupationORS.findUnique({
      where: { onetSocCode: code },
    });
    const strength = orsToStrength(ors?.physicalDemands as Record<string, unknown> | null);

    // 4. Try DOT crosswalk
    let dotEntries: DotEntry[] = [];
    try {
      const crosswalks = await prisma.dOTONETCrosswalk.findMany({
        where: { onetSocCode: code },
        include: { dotOcc: true },
        take: 10,
      });

      dotEntries = crosswalks.map((cw) => {
        const dot = cw.dotOcc;
        const dotSkill = dot.svp <= 3 ? "unskilled" : dot.svp <= 6 ? "semiskilled" : "skilled";
        return {
          dotCode: dot.id,
          title: dot.title,
          svp: dot.svp,
          strength: dot.strength,
          skillLevel: dotSkill,
          gedR: dot.gedR,
          gedM: dot.gedM,
          gedL: dot.gedL,
          workFields: dot.workFields,
          mpsms: dot.mpsms,
        };
      });
    } catch {
      // Crosswalk not available
    }

    // 5. Get wage data
    let wages = null;
    try {
      wages = await prisma.occupationWages.findFirst({
        where: { onetSocCode: code },
        orderBy: { year: "desc" },
      });
    } catch {
      // Wages not available
    }

    // 6. Build response - use DOT data if available, otherwise O*NET-derived
    const bestDot = dotEntries.length > 0 ? dotEntries[0] : null;

    return NextResponse.json({
      onetCode: code,
      title: occ.title,
      jobZone: occ.jobZone,
      svpRange: occ.svpRange,
      // Auto-fill values (DOT takes priority, then O*NET-derived)
      autoFill: {
        svp: bestDot?.svp ?? svp,
        strength: bestDot?.strength ?? strength,
        skillLevel: bestDot?.skillLevel ?? skillLevel,
        dotCode: bestDot?.dotCode ?? null,
      },
      // Source info for transparency
      source: bestDot ? "DOT Crosswalk" : "O*NET (estimated)",
      // Full DOT entries (if crosswalk exists)
      dotEntries,
      // Wage data
      wages: wages ? {
        areaName: wages.areaName,
        year: wages.year,
        employment: wages.employment,
        medianWage: wages.medianWage,
        meanWage: wages.meanWage,
        pct10: wages.pct10,
        pct25: wages.pct25,
        pct75: wages.pct75,
        pct90: wages.pct90,
      } : null,
    });
  } catch (error) {
    console.error("[GET /api/occupations/auto-fill]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

interface DotEntry {
  dotCode: string;
  title: string;
  svp: number;
  strength: string;
  skillLevel: string;
  gedR: number;
  gedM: number;
  gedL: number;
  workFields: string[];
  mpsms: string[];
}

/**
 * O*NET Job Zone → SVP mapping
 * Job Zone 1: Little or No Preparation → SVP 1-2
 * Job Zone 2: Some Preparation → SVP 3-4
 * Job Zone 3: Medium Preparation → SVP 5-6
 * Job Zone 4: Considerable Preparation → SVP 7-8
 * Job Zone 5: Extensive Preparation → SVP 8-9
 */
function jobZoneToSvp(jobZone: number | null): number {
  switch (jobZone) {
    case 1: return 2;
    case 2: return 4;
    case 3: return 6;
    case 4: return 7;
    case 5: return 8;
    default: return 4; // Default to semi-skilled
  }
}

function svpToSkillLevel(svp: number): string {
  if (svp <= 3) return "unskilled";
  if (svp <= 6) return "semiskilled";
  return "skilled";
}

/**
 * Derive strength level from ORS physical demands data.
 * Uses the strength factor if available, or estimates from
 * lifting requirements and posture demands.
 */
function orsToStrength(physicalDemands: Record<string, unknown> | null): string {
  if (!physicalDemands) return "L"; // Default Light if no data

  // Check for explicit strength data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const demands = physicalDemands as any;

  // ORS often stores demands as arrays of objects with category/value
  // Try to find lifting/carrying demands to estimate strength
  if (demands.strength) {
    const s = String(demands.strength).charAt(0).toUpperCase();
    if (["S", "L", "M", "H", "V"].includes(s)) return s;
  }

  // Check for overall physical demand level
  if (demands.overallPhysicalDemand) {
    const level = String(demands.overallPhysicalDemand).toLowerCase();
    if (level.includes("sedentary")) return "S";
    if (level.includes("light")) return "L";
    if (level.includes("medium")) return "M";
    if (level.includes("heavy") && !level.includes("very")) return "H";
    if (level.includes("very heavy")) return "V";
  }

  // Try lifting weight categories
  if (demands.lifting) {
    const lift = demands.lifting;
    if (typeof lift === "number") {
      if (lift <= 10) return "S";
      if (lift <= 20) return "L";
      if (lift <= 50) return "M";
      if (lift <= 100) return "H";
      return "V";
    }
  }

  return "L"; // Default to Light
}
