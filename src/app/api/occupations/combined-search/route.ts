import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchOccupations } from "@/lib/api/onet";

/**
 * GET /api/occupations/combined-search?q=KEYWORD
 *
 * Combined keyword search across O*NET (API + cached) and DOT (local DB).
 * Returns unified results with both DOT and O*NET data where available.
 *
 * Each result includes:
 * - onetCode: modern O*NET-SOC code (if available)
 * - dotCode: DOT code (if available)
 * - title: occupation title
 * - svp: SVP from DOT (accurate) or O*NET jobZone estimate
 * - strength: from DOT data
 * - skillLevel: derived from SVP
 * - source: "DOT", "O*NET", or "DOT+O*NET"
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  const query = q.trim();

  try {
    // Search both sources in parallel
    const [dotResults, onetApiResults, onetCachedResults] = await Promise.all([
      // 1. Search DOT database by title (local, instant)
      prisma.occupationDOT.findMany({
        where: {
          title: { contains: query, mode: "insensitive" },
        },
        select: {
          id: true,
          title: true,
          svp: true,
          strength: true,
          gedR: true,
          gedM: true,
          gedL: true,
        },
        take: 20,
        orderBy: { title: "asc" },
      }),

      // 2. Search O*NET API (remote)
      searchOccupations(query, 1, 15).catch(() => ({ occupation: [] as { code: string; title: string }[], total: 0 })),

      // 3. Search cached O*NET (local)
      prisma.occupationONET.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { id: { contains: query, mode: "insensitive" } },
          ],
        },
        select: { id: true, title: true, jobZone: true },
        take: 10,
      }),
    ]);

    // Build DOT results with skill level
    const dotFormatted = dotResults.map((d) => ({
      dotCode: d.id,
      onetCode: null as string | null,
      title: d.title,
      svp: d.svp,
      strength: d.strength,
      skillLevel: d.svp <= 3 ? "unskilled" : d.svp <= 6 ? "semiskilled" : "skilled",
      gedR: d.gedR,
      gedM: d.gedM,
      gedL: d.gedL,
      source: "DOT" as const,
    }));

    // Build O*NET results (merge API + cached, dedupe)
    const onetMap = new Map<string, { code: string; title: string; jobZone: number | null }>();

    // Add cached results first (they have jobZone)
    for (const c of onetCachedResults) {
      onetMap.set(c.id, { code: c.id, title: c.title, jobZone: c.jobZone });
    }

    // Add API results
    const apiOccs = (onetApiResults as { occupation?: { code: string; title: string }[] }).occupation ?? [];
    for (const a of apiOccs) {
      if (!onetMap.has(a.code)) {
        onetMap.set(a.code, { code: a.code, title: a.title, jobZone: null });
      }
    }

    const onetFormatted = Array.from(onetMap.values()).map((o) => ({
      dotCode: null as string | null,
      onetCode: o.code,
      title: o.title,
      svp: o.jobZone ? jobZoneToSvp(o.jobZone) : null,
      strength: null as string | null,
      skillLevel: o.jobZone
        ? (jobZoneToSvp(o.jobZone) <= 3 ? "unskilled" : jobZoneToSvp(o.jobZone) <= 6 ? "semiskilled" : "skilled")
        : null,
      gedR: null as number | null,
      gedM: null as number | null,
      gedL: null as number | null,
      source: "O*NET" as const,
    }));

    // Try to match DOT entries to O*NET entries by title similarity
    // For each O*NET result, find DOT entries with matching/similar titles
    const enhanced = await enhanceWithCrossMatches(dotFormatted, onetFormatted, query);

    return NextResponse.json({
      query,
      results: enhanced,
      counts: {
        dot: dotFormatted.length,
        onet: onetFormatted.length,
        total: enhanced.length,
      },
    });
  } catch (error) {
    console.error("[GET /api/occupations/combined-search]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Enhance results by cross-matching DOT and O*NET entries using:
 * 1. The DOTONETCrosswalk table (most reliable)
 * 2. Title similarity matching (fallback)
 * 3. Database lookup for O*NET results missing DOT data
 */
async function enhanceWithCrossMatches(
  dotResults: Array<{
    dotCode: string | null;
    onetCode: string | null;
    title: string;
    svp: number | null;
    strength: string | null;
    skillLevel: string | null;
    gedR: number | null;
    gedM: number | null;
    gedL: number | null;
    source: string;
  }>,
  onetResults: Array<{
    dotCode: string | null;
    onetCode: string | null;
    title: string;
    svp: number | null;
    strength: string | null;
    skillLevel: string | null;
    gedR: number | null;
    gedM: number | null;
    gedL: number | null;
    source: string;
  }>,
  _query: string
) {
  const combined: typeof dotResults = [];
  const usedDot = new Set<string>();
  const usedOnet = new Set<string>();

  // Step 1: Use crosswalk table to find DOT entries for O*NET codes
  const onetCodes = onetResults
    .map((o) => o.onetCode)
    .filter((c): c is string => !!c);

  const crosswalkByOnet = new Map<
    string,
    { dotCode: string; title: string; svp: number; strength: string; gedR: number; gedM: number; gedL: number }[]
  >();

  if (onetCodes.length > 0) {
    const crosswalks = await prisma.dOTONETCrosswalk.findMany({
      where: { onetSocCode: { in: onetCodes } },
      include: {
        dotOcc: {
          select: { id: true, title: true, svp: true, strength: true, gedR: true, gedM: true, gedL: true },
        },
      },
    });
    for (const xw of crosswalks) {
      const existing = crosswalkByOnet.get(xw.onetSocCode) ?? [];
      existing.push({
        dotCode: xw.dotOcc.id,
        title: xw.dotOcc.title,
        svp: xw.dotOcc.svp,
        strength: xw.dotOcc.strength,
        gedR: xw.dotOcc.gedR,
        gedM: xw.dotOcc.gedM,
        gedL: xw.dotOcc.gedL,
      });
      crosswalkByOnet.set(xw.onetSocCode, existing);
    }
  }

  // Step 2: Use crosswalk to find O*NET codes for DOT results
  const dotCodes = dotResults
    .map((d) => d.dotCode)
    .filter((c): c is string => !!c);

  const crosswalkByDot = new Map<string, string>(); // dotCode → onetSocCode

  if (dotCodes.length > 0) {
    const dotCrosswalks = await prisma.dOTONETCrosswalk.findMany({
      where: { dotCode: { in: dotCodes } },
      select: { dotCode: true, onetSocCode: true },
    });
    for (const xw of dotCrosswalks) {
      if (!crosswalkByDot.has(xw.dotCode)) {
        crosswalkByDot.set(xw.dotCode, xw.onetSocCode);
      }
    }
  }

  // Step 3: Process O*NET results — enrich with DOT data
  for (const onet of onetResults) {
    const onetCode = onet.onetCode!;

    // Try crosswalk first (most reliable)
    const xwDots = crosswalkByOnet.get(onetCode);
    if (xwDots && xwDots.length > 0) {
      // Pick the DOT entry that best matches (prefer one from search results, or first crosswalk)
      const matchFromSearch = dotResults.find(
        (d) => !usedDot.has(d.dotCode!) && xwDots.some((xw) => xw.dotCode === d.dotCode)
      );
      const dotData = matchFromSearch
        ? { dotCode: matchFromSearch.dotCode!, svp: matchFromSearch.svp!, strength: matchFromSearch.strength!, gedR: matchFromSearch.gedR!, gedM: matchFromSearch.gedM!, gedL: matchFromSearch.gedL! }
        : xwDots[0];

      usedDot.add(dotData.dotCode);
      usedOnet.add(onetCode);
      combined.push({
        dotCode: dotData.dotCode,
        onetCode: onetCode,
        title: onet.title,
        svp: dotData.svp,
        strength: dotData.strength,
        skillLevel: dotData.svp <= 3 ? "unskilled" : dotData.svp <= 6 ? "semiskilled" : "skilled",
        gedR: dotData.gedR,
        gedM: dotData.gedM,
        gedL: dotData.gedL,
        source: "DOT+O*NET",
      });
      continue;
    }

    // Try title matching as fallback
    const onetTitleNorm = onet.title.toLowerCase().trim();
    const matchingDot = dotResults.find((d) => {
      if (usedDot.has(d.dotCode!)) return false;
      const dotTitleNorm = d.title.toLowerCase().trim();
      return (
        dotTitleNorm === onetTitleNorm ||
        dotTitleNorm.includes(onetTitleNorm) ||
        onetTitleNorm.includes(dotTitleNorm)
      );
    });

    if (matchingDot) {
      usedDot.add(matchingDot.dotCode!);
      usedOnet.add(onetCode);
      combined.push({
        dotCode: matchingDot.dotCode,
        onetCode: onetCode,
        title: onet.title,
        svp: matchingDot.svp,
        strength: matchingDot.strength,
        skillLevel: matchingDot.skillLevel,
        gedR: matchingDot.gedR,
        gedM: matchingDot.gedM,
        gedL: matchingDot.gedL,
        source: "DOT+O*NET",
      });
    } else {
      // O*NET only — still add it
      usedOnet.add(onetCode);
      combined.push(onet);
    }
  }

  // Step 4: Add remaining DOT results — enrich with O*NET code from crosswalk
  for (const dot of dotResults) {
    if (usedDot.has(dot.dotCode!)) continue;

    const onetCode = crosswalkByDot.get(dot.dotCode!);
    if (onetCode && !usedOnet.has(onetCode)) {
      usedOnet.add(onetCode);
      combined.push({
        ...dot,
        onetCode,
        source: "DOT+O*NET",
      });
    } else {
      combined.push(dot);
    }
  }

  // Sort: combined results first, then by title
  combined.sort((a, b) => {
    if (a.source === "DOT+O*NET" && b.source !== "DOT+O*NET") return -1;
    if (b.source === "DOT+O*NET" && a.source !== "DOT+O*NET") return 1;
    return a.title.localeCompare(b.title);
  });

  return combined;
}

function jobZoneToSvp(jobZone: number): number {
  switch (jobZone) {
    case 1: return 2;
    case 2: return 4;
    case 3: return 6;
    case 4: return 7;
    case 5: return 8;
    default: return 4;
  }
}
