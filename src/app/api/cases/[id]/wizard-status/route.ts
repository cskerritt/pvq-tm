import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/cases/[id]/wizard-status
 *
 * Returns wizard completion status for the TSA workflow steps.
 * Does a single query with counts to determine which steps are complete.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const caseData = await prisma.case.findUnique({
      where: { id },
      select: {
        id: true,
        clientName: true,
        _count: {
          select: {
            pastRelevantWork: true,
            acquiredSkills: true,
            profiles: true,
            analyses: true,
          },
        },
        profiles: {
          where: { profileType: "POST" },
          select: {
            reasoning: true,
            math: true,
            language: true,
            spatialPerception: true,
            formPerception: true,
            clericalPerception: true,
            motorCoordination: true,
            fingerDexterity: true,
            manualDexterity: true,
            eyeHandFoot: true,
            colorDiscrimination: true,
            strength: true,
            climbBalance: true,
            stoopKneel: true,
            reachHandle: true,
            talkHear: true,
            see: true,
            workLocation: true,
            extremeCold: true,
            extremeHeat: true,
            wetnessHumidity: true,
            noiseVibration: true,
            hazards: true,
            dustsFumes: true,
          },
          take: 1,
        },
        analyses: {
          where: { status: "completed" },
          select: {
            id: true,
            postInjuryViableCount: true,
          },
          take: 1,
        },
      },
    });

    if (!caseData) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const completedSteps: number[] = [];

    // Step 1: Case Info — always complete if case exists
    completedSteps.push(1);

    // Step 2: PRW — complete if case has >= 1 PRW entry
    const hasPRW = caseData._count.pastRelevantWork > 0;
    if (hasPRW) completedSteps.push(2);

    // Step 3: Skills — complete if case has >= 1 skill
    const hasSkills = caseData._count.acquiredSkills > 0;
    if (hasSkills) completedSteps.push(3);

    // Step 4: Profiles — complete if POST profile has >= 20 of 24 traits filled
    const postProfile = caseData.profiles[0];
    if (postProfile) {
      const traitKeys = [
        "reasoning", "math", "language", "spatialPerception",
        "formPerception", "clericalPerception", "motorCoordination",
        "fingerDexterity", "manualDexterity", "eyeHandFoot",
        "colorDiscrimination", "strength", "climbBalance", "stoopKneel",
        "reachHandle", "talkHear", "see", "workLocation", "extremeCold",
        "extremeHeat", "wetnessHumidity", "noiseVibration", "hazards",
        "dustsFumes",
      ] as const;
      const filledCount = traitKeys.filter(
        (k) => postProfile[k] !== null && postProfile[k] !== undefined
      ).length;
      if (filledCount >= 20) completedSteps.push(4);
    }

    // Step 5: Analysis — complete if analysis exists with completed status
    const completedAnalysis = caseData.analyses[0];
    const hasCompletedAnalysis = !!completedAnalysis;
    if (hasCompletedAnalysis) completedSteps.push(5);

    // Step 6: Results — complete if analysis has viable occupations
    if (
      hasCompletedAnalysis &&
      completedAnalysis.postInjuryViableCount !== null &&
      completedAnalysis.postInjuryViableCount > 0
    ) {
      completedSteps.push(6);
    }

    // Step 7: Comparison — same as step 6 (results available)
    if (completedSteps.includes(6)) completedSteps.push(7);

    // Step 8: Report — available if step 6 is complete
    if (completedSteps.includes(6)) completedSteps.push(8);

    // Determine current step (first incomplete step)
    let currentStep = 1;
    for (let i = 1; i <= 8; i++) {
      if (!completedSteps.includes(i)) {
        currentStep = i;
        break;
      }
      if (i === 8) currentStep = 8;
    }

    return NextResponse.json({
      completedSteps,
      currentStep,
      clientName: caseData.clientName,
    });
  } catch (error) {
    console.error("[GET /api/cases/[id]/wizard-status]", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
