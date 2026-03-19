import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const c = await prisma.case.findUnique({
      where: { id },
      include: {
        profiles: true,
        pastRelevantWork: { include: { acquiredSkills: true } },
        acquiredSkills: true,
        analyses: { include: { targetOccupations: true } },
      },
    });
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(c);
  } catch (error) {
    console.error("[GET /api/cases/[id]]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const data: Record<string, any> = {};

    // Only set fields that were explicitly sent in the request body
    if (body.clientName !== undefined) data.clientName = body.clientName;
    if (body.clientDOB !== undefined) data.clientDOB = body.clientDOB ? new Date(body.clientDOB) : null;
    if (body.evaluatorName !== undefined) data.evaluatorName = body.evaluatorName || null;
    if (body.referralSource !== undefined) data.referralSource = body.referralSource || null;
    if (body.dateOfInjury !== undefined) data.dateOfInjury = body.dateOfInjury ? new Date(body.dateOfInjury) : null;
    if (body.dateOfEval !== undefined) data.dateOfEval = body.dateOfEval ? new Date(body.dateOfEval) : null;
    if (body.zipCode !== undefined) data.zipCode = body.zipCode || null;
    if (body.metroAreaCode !== undefined) data.metroAreaCode = body.metroAreaCode || null;
    if (body.metroAreaName !== undefined) data.metroAreaName = body.metroAreaName || null;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.status !== undefined) data.status = body.status;

    // Injury & Medical fields
    if (body.injuryDescription !== undefined) data.injuryDescription = body.injuryDescription || null;
    if (body.bodyPartsAffected !== undefined) data.bodyPartsAffected = body.bodyPartsAffected ?? [];
    if (body.treatingPhysician !== undefined) data.treatingPhysician = body.treatingPhysician || null;
    if (body.physicianSpecialty !== undefined) data.physicianSpecialty = body.physicianSpecialty || null;
    if (body.mmiDate !== undefined) data.mmiDate = body.mmiDate ? new Date(body.mmiDate) : null;
    if (body.fceDate !== undefined) data.fceDate = body.fceDate ? new Date(body.fceDate) : null;
    if (body.fceProvider !== undefined) data.fceProvider = body.fceProvider || null;
    if (body.surgeryDates !== undefined) data.surgeryDates = body.surgeryDates || null;
    if (body.medicalNotes !== undefined) data.medicalNotes = body.medicalNotes || null;

    const updated = await prisma.case.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PUT /api/cases/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.case.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/cases/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
