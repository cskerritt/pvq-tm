import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; analysisId: string }> }
) {
  try {
  const { analysisId } = await params;

  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    include: {
      targetOccupations: {
        orderBy: [{ excluded: "asc" }, { pvq: "desc" }],
      },
      case: true,
    },
  });

  if (!analysis) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  return NextResponse.json(analysis);
  } catch (error) {
    console.error("[GET /api/cases/[id]/analysis/[analysisId]/results]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
