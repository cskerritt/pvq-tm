import { NextRequest, NextResponse } from "next/server";
import { searchOccupations } from "@/lib/api/onet";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  let onetResults: { code: string; title: string; tags?: Record<string, boolean> }[] = [];

  // Search O*NET API (with error handling)
  try {
    const results = await searchOccupations(q, 1, 20);
    onetResults = results.occupation ?? [];
  } catch (e) {
    console.error("O*NET search failed:", e);
    // Continue with local-only results
  }

  // Also search local cache
  const local = await prisma.occupationONET.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { id: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 10,
    select: { id: true, title: true, jobZone: true },
  });

  return NextResponse.json({
    onet: onetResults,
    local: local.map((l) => ({
      code: l.id,
      title: l.title,
      jobZone: l.jobZone,
      cached: true,
    })),
  });
}
