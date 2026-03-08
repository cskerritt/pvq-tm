import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const skills = await prisma.acquiredSkill.findMany({
      where: { caseId: id },
      include: { prw: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(skills);
  } catch (error) {
    console.error("[GET /api/cases/[id]/skills]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const skill = await prisma.acquiredSkill.create({
      data: {
        caseId: id,
        prwId: body.prwId,
        actionVerb: body.actionVerb,
        object: body.object,
        context: body.context,
        toolsSoftware: body.toolsSoftware,
        materialsServices: body.materialsServices,
        svpLevel: body.svpLevel,
        evidenceSource: body.evidenceSource,
        frequency: body.frequency,
        recency: body.recency,
        performanceMode: body.performanceMode,
        isTransferable: body.isTransferable ?? false,
      },
    });
    return NextResponse.json(skill, { status: 201 });
  } catch (error) {
    console.error("[POST /api/cases/[id]/skills]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "Missing skill record id" }, { status: 400 });
    }

    // Verify the record belongs to this case
    const existing = await prisma.acquiredSkill.findFirst({
      where: { id: body.id, caseId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Skill record not found for this case" }, { status: 404 });
    }

    const { id: recordId, ...fields } = body;

    const updated = await prisma.acquiredSkill.update({
      where: { id: recordId },
      data: fields,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PUT /api/cases/[id]/skills]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const recordId = req.nextUrl.searchParams.get("id");

    if (!recordId) {
      return NextResponse.json({ error: "Missing ?id= query parameter" }, { status: 400 });
    }

    // Verify the record belongs to this case
    const existing = await prisma.acquiredSkill.findFirst({
      where: { id: recordId, caseId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Skill record not found for this case" }, { status: 404 });
    }

    await prisma.acquiredSkill.delete({
      where: { id: recordId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/cases/[id]/skills]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
