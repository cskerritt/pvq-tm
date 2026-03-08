import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prw = await prisma.pastRelevantWork.findMany({
      where: { caseId: id },
      include: { acquiredSkills: true, dotOcc: true },
      orderBy: { startDate: "desc" },
    });
    return NextResponse.json(prw);
  } catch (error) {
    console.error("[GET /api/cases/[id]/prw]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const prw = await prisma.pastRelevantWork.create({
      data: {
        caseId: id,
        jobTitle: body.jobTitle,
        employer: body.employer,
        dotCode: body.dotCode,
        onetSocCode: body.onetSocCode,
        svp: body.svp,
        skillLevel: body.skillLevel,
        strengthLevel: body.strengthLevel,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        durationMonths: body.durationMonths,
        dutiesDescription: body.dutiesDescription,
        isSubstantialGainful: body.isSubstantialGainful ?? true,
      },
    });
    return NextResponse.json(prw, { status: 201 });
  } catch (error) {
    console.error("[POST /api/cases/[id]/prw]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "Missing PRW record id" }, { status: 400 });
    }

    // Verify the record belongs to this case
    const existing = await prisma.pastRelevantWork.findFirst({
      where: { id: body.id, caseId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: "PRW record not found for this case" }, { status: 404 });
    }

    const { id: recordId, ...fields } = body;

    // Convert date strings to Date objects if present
    if (fields.startDate !== undefined) {
      fields.startDate = fields.startDate ? new Date(fields.startDate) : null;
    }
    if (fields.endDate !== undefined) {
      fields.endDate = fields.endDate ? new Date(fields.endDate) : null;
    }

    const updated = await prisma.pastRelevantWork.update({
      where: { id: recordId },
      data: fields,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PUT /api/cases/[id]/prw]", error);
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
    const existing = await prisma.pastRelevantWork.findFirst({
      where: { id: recordId, caseId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: "PRW record not found for this case" }, { status: 404 });
    }

    // Cascade delete: acquired skills linked to this PRW are deleted automatically by Prisma
    await prisma.pastRelevantWork.delete({
      where: { id: recordId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/cases/[id]/prw]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
