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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await prisma.case.update({
      where: { id },
      data: {
        clientName: body.clientName,
        clientDOB: body.clientDOB ? new Date(body.clientDOB) : undefined,
        evaluatorName: body.evaluatorName,
        referralSource: body.referralSource,
        dateOfInjury: body.dateOfInjury ? new Date(body.dateOfInjury) : undefined,
        dateOfEval: body.dateOfEval ? new Date(body.dateOfEval) : undefined,
        zipCode: body.zipCode !== undefined ? (body.zipCode || null) : undefined,
        metroAreaCode: body.metroAreaCode !== undefined ? (body.metroAreaCode || null) : undefined,
        metroAreaName: body.metroAreaName !== undefined ? (body.metroAreaName || null) : undefined,
        notes: body.notes,
        status: body.status,
      },
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
