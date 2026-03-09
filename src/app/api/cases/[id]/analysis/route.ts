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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "Missing analysis id" }, { status: 400 });
    }

    // Verify it belongs to this case
    const existing = await prisma.analysis.findFirst({
      where: { id: body.id, caseId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    const updated = await prisma.analysis.update({
      where: { id: body.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.ageRule !== undefined ? { ageRule: body.ageRule } : {}),
        ...(body.priorEarnings !== undefined ? { priorEarnings: body.priorEarnings } : {}),
        ...(body.targetArea !== undefined ? { targetArea: body.targetArea } : {}),
        ...(body.targetAreaName !== undefined ? { targetAreaName: body.targetAreaName } : {}),
      },
      include: { targetOccupations: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PUT /api/cases/[id]/analysis]", error);
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
