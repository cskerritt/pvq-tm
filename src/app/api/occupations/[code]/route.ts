import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncSingleOccupation } from "@/lib/api/sync";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  try {
    // Check local cache first
    let occ = await prisma.occupationONET.findUnique({ where: { id: code } });

    // If not cached, fetch and cache
    if (!occ) {
      const synced = await syncSingleOccupation(code);
      if (synced) {
        occ = await prisma.occupationONET.findUnique({ where: { id: code } });
      }
    }

    if (!occ) {
      return NextResponse.json({ error: "Occupation not found" }, { status: 404 });
    }

    // Also get ORS and wage data if available
    const ors = await prisma.occupationORS.findUnique({ where: { onetSocCode: code } });
    const wages = await prisma.occupationWages.findMany({
      where: { onetSocCode: code },
      orderBy: { year: "desc" },
      take: 5,
    });

    return NextResponse.json({ ...occ, ors, wages });
  } catch (e) {
    console.error(`Failed to fetch occupation ${code}:`, e);
    return NextResponse.json(
      { error: "Failed to fetch occupation data" },
      { status: 500 }
    );
  }
}
