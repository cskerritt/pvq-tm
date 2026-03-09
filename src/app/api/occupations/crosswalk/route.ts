import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/occupations/crosswalk?q=KEYWORD&page=1&pageSize=25
 *
 * Browse DOT↔O*NET crosswalk entries.
 * Search by DOT title, O*NET title, DOT code, or O*NET code.
 *
 * Also supports:
 *   ?onet=XX-XXXX.XX — Find all DOT entries linked to this O*NET code
 *   ?dot=XXX.XXX-XXX — Find the O*NET code linked to this DOT code
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const onetCode = req.nextUrl.searchParams.get("onet");
  const dotCode = req.nextUrl.searchParams.get("dot");
  const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1");
  const pageSize = Math.min(parseInt(req.nextUrl.searchParams.get("pageSize") ?? "25"), 100);
  const skip = (page - 1) * pageSize;

  try {
    // Build where clause based on params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let where: any = {};

    if (onetCode) {
      // Find all DOT entries for a specific O*NET code
      where = { onetSocCode: onetCode };
    } else if (dotCode) {
      // Find the O*NET code for a specific DOT code
      where = { dotCode: dotCode };
    } else if (q && q.trim().length >= 2) {
      // Search by keyword across both DOT and O*NET titles and codes
      const query = q.trim();
      where = {
        OR: [
          { dotCode: { contains: query, mode: "insensitive" } },
          { onetSocCode: { contains: query, mode: "insensitive" } },
          { dotOcc: { title: { contains: query, mode: "insensitive" } } },
          { onetOcc: { title: { contains: query, mode: "insensitive" } } },
        ],
      };
    }

    // Get total count and results
    const [total, entries] = await Promise.all([
      prisma.dOTONETCrosswalk.count({ where }),
      prisma.dOTONETCrosswalk.findMany({
        where,
        include: {
          dotOcc: {
            select: {
              id: true,
              title: true,
              svp: true,
              strength: true,
              gedR: true,
              gedM: true,
              gedL: true,
            },
          },
          onetOcc: {
            select: {
              id: true,
              title: true,
              jobZone: true,
            },
          },
        },
        orderBy: { dotOcc: { title: "asc" } },
        skip,
        take: pageSize,
      }),
    ]);

    const results = entries.map((e) => ({
      dotCode: e.dotCode,
      dotTitle: e.dotOcc.title,
      dotSvp: e.dotOcc.svp,
      dotStrength: e.dotOcc.strength,
      dotGedR: e.dotOcc.gedR,
      dotGedM: e.dotOcc.gedM,
      dotGedL: e.dotOcc.gedL,
      onetCode: e.onetSocCode,
      onetTitle: e.onetOcc.title,
      onetJobZone: e.onetOcc.jobZone,
    }));

    // Also get stats
    const stats = q || onetCode || dotCode
      ? null
      : {
          totalCrosswalk: total,
          totalDOT: await prisma.occupationDOT.count(),
          totalONET: await prisma.occupationONET.count(),
        };

    return NextResponse.json({
      results,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats,
    });
  } catch (error) {
    console.error("[GET /api/occupations/crosswalk]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
