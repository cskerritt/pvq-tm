import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const analyses = await prisma.analysis.findMany({
      where: { caseId: id },
      include: { targetOccupations: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(analyses);
  } catch (error) {
    console.error("[GET /api/cases/[id]/analysis]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const analysis = await prisma.analysis.create({
      data: {
        caseId: id,
        name: body.name ?? `Analysis ${new Date().toLocaleDateString()}`,
        ageRule: body.ageRule,
        priorEarnings: body.priorEarnings,
        targetArea: body.targetArea,
        targetAreaName: body.targetAreaName,
      },
    });
    return NextResponse.json(analysis, { status: 201 });
  } catch (error) {
    console.error("[POST /api/cases/[id]/analysis]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
