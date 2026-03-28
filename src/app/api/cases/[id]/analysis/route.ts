import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const analyses = await prisma.analysis.findMany({
      where: { caseId: id },
      include: {
        targetOccupations: {
          select: {
            id: true,
            onetSocCode: true,
            title: true,
            svp: true,
            stq: true,
            tfq: true,
            tfqDetails: true,
            vaq: true,
            lmq: true,
            pvq: true,
            excluded: true,
            exclusionReason: true,
            confidenceGrade: true,
          },
        },
        case: {
          select: {
            id: true,
            clientName: true,
            dateOfInjury: true,
          },
        },
      },
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
      include: {
        targetOccupations: {
          omit: { feasibilityScore: true, riskLevel: true, traitDeficits: true },
        },
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PUT /api/cases/[id]/analysis]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const analysisId = searchParams.get("analysisId");

    if (!analysisId) {
      return NextResponse.json({ error: "Missing analysisId query param" }, { status: 400 });
    }

    // Verify it belongs to this case
    const existing = await prisma.analysis.findFirst({
      where: { id: analysisId, caseId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    // Delete target occupations first (cascade), then the analysis
    await prisma.targetOccupation.deleteMany({ where: { analysisId } });
    await prisma.analysis.delete({ where: { id: analysisId } });

    return NextResponse.json({ success: true, deleted: analysisId });
  } catch (error) {
    console.error("[DELETE /api/cases/[id]/analysis]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Auto-derive priorEarnings from PRW if not explicitly provided
    let priorEarnings = body.priorEarnings ?? null;
    if (priorEarnings === null || priorEarnings === undefined) {
      const prwList = await prisma.pastRelevantWork.findMany({
        where: { caseId: id },
        select: { actualWageAnnual: true },
      });
      const earnings = prwList
        .map((p) => p.actualWageAnnual)
        .filter((e): e is number => e !== null && e > 0);
      if (earnings.length > 0) {
        // Use the highest PRW annual wage as prior earnings
        priorEarnings = Math.max(...earnings);
      }
    }

    // Auto-derive targetArea from case ZIP code if not explicitly provided
    let targetArea = body.targetArea ?? null;
    let targetAreaName = body.targetAreaName ?? null;

    if (!targetArea) {
      // Check if case has metroAreaCode already set
      const caseData = await prisma.case.findUnique({
        where: { id },
        select: { metroAreaCode: true, metroAreaName: true, zipCode: true },
      });

      if (caseData?.metroAreaCode) {
        targetArea = caseData.metroAreaCode;
        targetAreaName = caseData.metroAreaName ?? targetAreaName;
      } else if (caseData?.zipCode) {
        // Look up metro area from ZIP code via internal geo API
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
            || process.env.RAILWAY_PUBLIC_DOMAIN
              ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
              : `http://localhost:${process.env.PORT || 3000}`;
          const geoRes = await fetch(`${baseUrl}/api/geo/zip-to-metro?zip=${caseData.zipCode}`);
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData.areaCode) {
              targetArea = geoData.areaCode;
              targetAreaName = geoData.areaName ?? null;
              // Also update the case record for future analyses
              await prisma.case.update({
                where: { id },
                data: {
                  metroAreaCode: geoData.areaCode,
                  metroAreaName: geoData.areaName ?? null,
                },
              });
            }
          }
        } catch (e) {
          console.warn("[Analysis POST] Failed to auto-derive metro area from ZIP:", e);
          // Non-fatal — analysis will use national-level data
        }
      }
    }

    const analysis = await prisma.analysis.create({
      data: {
        caseId: id,
        name: body.name ?? `Analysis ${new Date().toLocaleDateString()}`,
        ageRule: body.ageRule,
        priorEarnings,
        targetArea,
        targetAreaName,
      },
    });
    return NextResponse.json(analysis, { status: 201 });
  } catch (error) {
    console.error("[POST /api/cases/[id]/analysis]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
