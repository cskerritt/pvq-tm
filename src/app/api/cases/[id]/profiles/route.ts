import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const profiles = await prisma.workerProfile.findMany({
      where: { caseId: id },
      orderBy: { profileType: "asc" },
    });
    return NextResponse.json(profiles);
  } catch (error) {
    console.error("[GET /api/cases/[id]/profiles]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const profile = await prisma.workerProfile.upsert({
      where: {
        caseId_profileType: { caseId: id, profileType: body.profileType },
      },
      create: { caseId: id, ...body },
      update: body,
    });
    return NextResponse.json(profile);
  } catch (error) {
    console.error("[POST /api/cases/[id]/profiles]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
