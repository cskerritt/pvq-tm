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
    const newCase = await prisma.case.create({
      data: {
        clientName: body.clientName,
        clientDOB: body.clientDOB ? new Date(body.clientDOB) : null,
        evaluatorName: body.evaluatorName,
        referralSource: body.referralSource,
        dateOfInjury: body.dateOfInjury ? new Date(body.dateOfInjury) : null,
        dateOfEval: body.dateOfEval ? new Date(body.dateOfEval) : null,
        notes: body.notes,
      },
    });
    return NextResponse.json(newCase, { status: 201 });
  } catch (error) {
    console.error("[POST /api/cases]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
