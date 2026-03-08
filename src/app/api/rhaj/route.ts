import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/rhaj — list all RHAJ reference entries
// GET /api/rhaj?id=dpt — get a specific RHAJ reference by ID
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (id) {
      const entry = await prisma.rHAJReference.findUnique({ where: { id } });
      if (!entry) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(entry);
    }

    // List all entries (without full data payload for index)
    const entries = await prisma.rHAJReference.findMany({
      select: {
        id: true,
        category: true,
        title: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    });
    return NextResponse.json(entries);
  } catch (error) {
    console.error("[GET /api/rhaj]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
