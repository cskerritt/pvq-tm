import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const cases = await prisma.case.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { pastRelevantWork: true, analyses: true } },
      },
    });
    return NextResponse.json(cases);
  } catch (error) {
    console.error("[GET /api/cases]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.clientName?.trim()) {
      return NextResponse.json({ error: "clientName is required" }, { status: 400 });
    }

    const newCase = await prisma.case.create({
      data: {
        clientName: body.clientName,
        clientDOB: body.clientDOB ? new Date(body.clientDOB) : null,
        evaluatorName: body.evaluatorName,
        referralSource: body.referralSource,
        dateOfInjury: body.dateOfInjury ? new Date(body.dateOfInjury) : null,
        dateOfEval: body.dateOfEval ? new Date(body.dateOfEval) : null,
        zipCode: body.zipCode || null,
        metroAreaCode: body.metroAreaCode || null,
        metroAreaName: body.metroAreaName || null,
        notes: body.notes,
        // Injury & Medical fields
        injuryDescription: body.injuryDescription || null,
        bodyPartsAffected: body.bodyPartsAffected ?? [],
        treatingPhysician: body.treatingPhysician || null,
        physicianSpecialty: body.physicianSpecialty || null,
        mmiDate: body.mmiDate ? new Date(body.mmiDate) : null,
        fceDate: body.fceDate ? new Date(body.fceDate) : null,
        fceProvider: body.fceProvider || null,
        surgeryDates: body.surgeryDates || null,
        medicalNotes: body.medicalNotes || null,
      },
    });
    return NextResponse.json(newCase, { status: 201 });
  } catch (error) {
    console.error("[POST /api/cases]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
