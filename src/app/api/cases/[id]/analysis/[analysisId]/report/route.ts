import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateReport } from "@/lib/reports/pdf";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; analysisId: string }> }
) {
  try {
  const { id, analysisId } = await params;

  // Fetch the case with all related data
  const caseData = await prisma.case.findUnique({
    where: { id },
    include: {
      profiles: true,
      pastRelevantWork: {
        include: { acquiredSkills: true },
        orderBy: { createdAt: "asc" },
      },
      acquiredSkills: true,
    },
  });

  if (!caseData) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  // Fetch the specific analysis with its target occupations
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId, caseId: id },
    include: {
      targetOccupations: {
        orderBy: [{ excluded: "asc" }, { pvq: "desc" }],
      },
    },
  });

  if (!analysis) {
    return NextResponse.json(
      { error: "Analysis not found" },
      { status: 404 }
    );
  }

  // Build the report data payload
  const reportData = {
    case: {
      clientName: caseData.clientName,
      clientDOB: caseData.clientDOB,
      evaluatorName: caseData.evaluatorName,
      referralSource: caseData.referralSource,
      dateOfInjury: caseData.dateOfInjury,
      dateOfEval: caseData.dateOfEval,
      notes: caseData.notes,
    },
    profiles: caseData.profiles.map((p) => ({
      profileType: p.profileType,
      reasoning: p.reasoning,
      math: p.math,
      language: p.language,
      spatialPerception: p.spatialPerception,
      formPerception: p.formPerception,
      clericalPerception: p.clericalPerception,
      motorCoordination: p.motorCoordination,
      fingerDexterity: p.fingerDexterity,
      manualDexterity: p.manualDexterity,
      eyeHandFoot: p.eyeHandFoot,
      colorDiscrimination: p.colorDiscrimination,
      strength: p.strength,
      climbBalance: p.climbBalance,
      stoopKneel: p.stoopKneel,
      reachHandle: p.reachHandle,
      talkHear: p.talkHear,
      see: p.see,
      workLocation: p.workLocation,
      extremeCold: p.extremeCold,
      extremeHeat: p.extremeHeat,
      wetnessHumidity: p.wetnessHumidity,
      noiseVibration: p.noiseVibration,
      hazards: p.hazards,
      dustsFumes: p.dustsFumes,
    })),
    prw: caseData.pastRelevantWork.map((prw) => ({
      jobTitle: prw.jobTitle,
      dotCode: prw.dotCode,
      onetSocCode: prw.onetSocCode,
      svp: prw.svp,
      strengthLevel: prw.strengthLevel,
      startDate: prw.startDate,
      endDate: prw.endDate,
      durationMonths: prw.durationMonths,
    })),
    skills: caseData.acquiredSkills.map((s) => ({
      actionVerb: s.actionVerb,
      object: s.object,
      toolsSoftware: s.toolsSoftware,
      materialsServices: s.materialsServices,
      svpLevel: s.svpLevel,
      isTransferable: s.isTransferable,
    })),
    analysis: {
      name: analysis.name,
      ageRule: analysis.ageRule,
      priorEarnings: analysis.priorEarnings,
    },
    targets: analysis.targetOccupations.map((t) => ({
      title: t.title,
      onetSocCode: t.onetSocCode,
      stq: t.stq,
      tfq: t.tfq,
      vaq: t.vaq,
      lmq: t.lmq,
      pvq: t.pvq,
      confidenceGrade: t.confidenceGrade,
      excluded: t.excluded,
      exclusionReason: t.exclusionReason,
      stqDetails: t.stqDetails,
      tfqDetails: t.tfqDetails,
      vaqDetails: t.vaqDetails,
      lmqDetails: t.lmqDetails,
    })),
  };

  // Generate the PDF
  const pdfBytes = await generateReport(reportData);

  // Build a safe filename
  const safeName = caseData.clientName
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 50);
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `PVQ-TM_Report_${safeName}_${dateStr}.pdf`;

  // Return the PDF response
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBytes.byteLength),
      "Cache-Control": "no-store",
    },
  });
  } catch (error) {
    console.error("[GET /api/cases/[id]/analysis/[analysisId]/report]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
