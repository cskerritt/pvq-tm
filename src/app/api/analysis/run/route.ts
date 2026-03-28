import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAnalysis, type ValidationReport } from "@/lib/engine/validation";

/**
 * One-Shot Analysis API
 *
 * Accepts complete case data in a single POST request and runs the entire
 * PVQ-TM analysis pipeline, returning full results with accuracy validation.
 *
 * This endpoint is designed for testing and edge case discovery. It:
 * 1. Creates all database records (case, PRW, skills, profiles, analysis)
 * 2. Generates candidates (traditional + CPC)
 * 3. Runs the full compute pipeline (STQ, TFQ, VAQ, LMQ, PVQ, CPC)
 * 4. Validates every computation for accuracy
 * 5. Returns complete results with validation report
 * 6. Optionally cleans up the test data
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      case: caseInput,
      prw: prwInput,
      skills: skillsInput,
      preProfile,
      postProfile,
      analysisConfig,
      cleanup = false,
    } = body;

    if (!postProfile) {
      return NextResponse.json(
        { error: "postProfile is required (24 traits)" },
        { status: 400 }
      );
    }

    if (!prwInput || prwInput.length === 0) {
      return NextResponse.json(
        { error: "At least one PRW entry is required" },
        { status: 400 }
      );
    }

    const log: string[] = [];
    const logStep = (msg: string) => {
      log.push(`[${Date.now() - startTime}ms] ${msg}`);
    };

    // ── Step 1: Create Case ──────────────────────────────────────
    logStep("Creating case record");
    const caseRecord = await prisma.case.create({
      data: {
        clientName: caseInput?.clientName ?? "Test Analysis",
        clientDOB: caseInput?.clientDOB ? new Date(caseInput.clientDOB) : null,
        evaluatorName: caseInput?.evaluatorName ?? null,
        dateOfInjury: caseInput?.dateOfInjury ? new Date(caseInput.dateOfInjury) : null,
        dateOfEval: caseInput?.dateOfEval ? new Date(caseInput.dateOfEval) : null,
        zipCode: caseInput?.zipCode ?? null,
        metroAreaCode: caseInput?.metroAreaCode ?? null,
        metroAreaName: caseInput?.metroAreaName ?? null,
        injuryDescription: caseInput?.injuryDescription ?? null,
        bodyPartsAffected: caseInput?.bodyPartsAffected ?? [],
        treatingPhysician: caseInput?.treatingPhysician ?? null,
        physicianSpecialty: caseInput?.physicianSpecialty ?? null,
        notes: "One-shot analysis API test case",
      },
    });
    logStep(`Case created: ${caseRecord.id}`);

    // ── Step 2: Create PRW Records ───────────────────────────────
    logStep(`Creating ${prwInput.length} PRW records`);
    const prwRecords = [];
    for (const prw of prwInput) {
      // Ensure O*NET occupation exists in cache
      if (prw.onetSocCode) {
        const exists = await prisma.occupationONET.findUnique({
          where: { id: prw.onetSocCode },
        });
        if (!exists) {
          await prisma.occupationONET.create({
            data: { id: prw.onetSocCode, title: prw.jobTitle ?? prw.onetSocCode },
          });
        }
      }

      const prwRecord = await prisma.pastRelevantWork.create({
        data: {
          caseId: caseRecord.id,
          jobTitle: prw.jobTitle ?? "Unknown",
          employer: prw.employer ?? null,
          dotCode: prw.dotCode ?? null,
          onetSocCode: prw.onetSocCode ?? null,
          svp: prw.svp ?? null,
          skillLevel: prw.skillLevel ?? null,
          strengthLevel: prw.strengthLevel ?? null,
          startDate: prw.startDate ? new Date(prw.startDate) : null,
          endDate: prw.endDate ? new Date(prw.endDate) : null,
          durationMonths: prw.durationMonths ?? null,
          dutiesDescription: prw.dutiesDescription ?? null,
          actualWageAnnual: prw.actualWageAnnual ?? null,
          actualWageHourly: prw.actualWageHourly ?? null,
          wageYear: prw.wageYear ?? null,
          hoursPerWeek: prw.hoursPerWeek ?? null,
        },
      });
      prwRecords.push(prwRecord);
    }
    logStep(`${prwRecords.length} PRW records created`);

    // ── Step 3: Create Acquired Skills ───────────────────────────
    const skillRecords = [];
    if (skillsInput && skillsInput.length > 0) {
      logStep(`Creating ${skillsInput.length} acquired skills`);
      for (const skill of skillsInput) {
        const prwIndex = skill.prwIndex ?? 0;
        const prwId = prwRecords[prwIndex]?.id;
        if (!prwId) continue;

        const skillRecord = await prisma.acquiredSkill.create({
          data: {
            caseId: caseRecord.id,
            prwId,
            actionVerb: skill.actionVerb ?? "Perform",
            object: skill.object ?? "tasks",
            context: skill.context ?? null,
            toolsSoftware: skill.toolsSoftware ?? null,
            materialsServices: skill.materialsServices ?? null,
            svpLevel: skill.svpLevel ?? null,
            isTransferable: skill.isTransferable ?? true,
            frequency: skill.frequency ?? null,
            recency: skill.recency ?? null,
          },
        });
        skillRecords.push(skillRecord);
      }
      logStep(`${skillRecords.length} skills created`);
    } else {
      logStep("No skills provided (STQ will use O*NET task fallback)");
    }

    // ── Step 4: Create Profiles ──────────────────────────────────
    logStep("Creating worker profiles");
    const traitFields = [
      "reasoning", "math", "language", "spatialPerception", "formPerception",
      "clericalPerception", "motorCoordination", "fingerDexterity", "manualDexterity",
      "eyeHandFoot", "colorDiscrimination", "strength", "climbBalance", "stoopKneel",
      "reachHandle", "talkHear", "see", "workLocation", "extremeCold", "extremeHeat",
      "wetnessHumidity", "noiseVibration", "hazards", "dustsFumes",
    ];

    const buildProfileData = (profile: Record<string, unknown>, type: string) => {
      const data: Record<string, unknown> = {
        caseId: caseRecord.id,
        profileType: type,
      };
      for (const key of traitFields) {
        data[key] = profile[key] != null ? Number(profile[key]) : null;
      }
      return data;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.workerProfile.create({ data: buildProfileData(postProfile, "POST") as any });
    if (preProfile) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.workerProfile.create({ data: buildProfileData(preProfile, "PRE") as any });
    }
    logStep("Profiles created");

    // ── Step 5: Create Analysis ──────────────────────────────────
    logStep("Creating analysis record");
    const analysisRecord = await prisma.analysis.create({
      data: {
        caseId: caseRecord.id,
        name: analysisConfig?.name ?? "One-Shot Test Analysis",
        ageRule: analysisConfig?.ageRule ?? "standard",
        priorEarnings: analysisConfig?.priorEarnings ?? null,
        targetArea: analysisConfig?.targetArea ?? null,
        targetAreaName: analysisConfig?.targetAreaName ?? null,
        status: "draft",
        step: 1,
      },
    });
    logStep(`Analysis created: ${analysisRecord.id}`);

    // ── Step 6: Generate Candidates ──────────────────────────────
    logStep("Generating candidates (traditional + CPC)");
    const genUrl = new URL(
      `/api/cases/${caseRecord.id}/analysis/${analysisRecord.id}/generate-candidates`,
      req.url
    );
    const genRes = await fetch(genUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const genData = await genRes.json();
    logStep(
      `Candidates generated: ${genData.count ?? 0} total ` +
      `(traditional: ${genData.traditionalCount ?? "?"}, CPC: ${genData.cpcCount ?? "?"})`
    );

    // ── Step 7: Compute ──────────────────────────────────────────
    logStep("Running compute pipeline (STQ, TFQ, VAQ, LMQ, PVQ, CPC)");
    const computeUrl = new URL(
      `/api/cases/${caseRecord.id}/analysis/${analysisRecord.id}/compute`,
      req.url
    );
    const computeRes = await fetch(computeUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const computeData = await computeRes.json();
    logStep(
      `Compute complete: ${computeData.computed ?? 0} scored, ${computeData.excluded ?? 0} excluded`
    );

    // ── Step 8: Fetch Results ────────────────────────────────────
    logStep("Fetching results");
    const updatedAnalysis = await prisma.analysis.findUnique({
      where: { id: analysisRecord.id },
    });
    const allTargets = await prisma.targetOccupation.findMany({
      where: { analysisId: analysisRecord.id },
      omit: { feasibilityScore: true, riskLevel: true, traitDeficits: true },
      orderBy: [{ excluded: "asc" }, { pvq: "desc" }],
    });

    const viableTargets = allTargets.filter((t) => !t.excluded);
    const excludedTargets = allTargets.filter((t) => t.excluded);

    logStep(`Results: ${viableTargets.length} viable, ${excludedTargets.length} excluded`);

    // ── Step 9: Validate ─────────────────────────────────────────
    logStep("Running accuracy validation");
    let validation: ValidationReport | null = null;
    try {
      validation = validateAnalysis({
        analysis: updatedAnalysis as unknown as Record<string, unknown>,
        targets: allTargets as unknown as Array<Record<string, unknown>>,
        prw: prwRecords as unknown as Array<Record<string, unknown>>,
        skills: skillRecords as unknown as Array<Record<string, unknown>>,
        postProfile: postProfile as Record<string, unknown>,
        preProfile: preProfile as Record<string, unknown> | null,
        analysisConfig: analysisConfig ?? {},
      });
      logStep(
        `Validation: ${validation.passed}/${validation.totalChecks} passed, ` +
        `${validation.errors} errors, ${validation.warnings} warnings`
      );
    } catch (valErr) {
      logStep(`Validation failed: ${valErr instanceof Error ? valErr.message : String(valErr)}`);
    }

    // ── Step 10: Cleanup (optional) ──────────────────────────────
    if (cleanup) {
      logStep("Cleaning up test data");
      await prisma.case.delete({ where: { id: caseRecord.id } });
      logStep("Test data deleted");
    }

    const totalTime = Date.now() - startTime;
    logStep(`Total execution time: ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      executionTimeMs: totalTime,
      caseId: cleanup ? "(cleaned up)" : caseRecord.id,
      analysisId: cleanup ? "(cleaned up)" : analysisRecord.id,
      summary: {
        totalCandidates: allTargets.length,
        viable: viableTargets.length,
        excluded: excludedTargets.length,
        traditionalCandidates: genData.traditionalCount ?? null,
        cpcCandidates: genData.cpcCount ?? null,
        hasCpcAnalysis: updatedAnalysis?.cpcAnalysis != null,
        hasLaborMarketAccess: updatedAnalysis?.laborMarketAccess != null,
        hasZeroViableExplanation: updatedAnalysis?.zeroViableExplanation != null,
      },
      topViable: viableTargets.slice(0, 10).map((t) => ({
        title: t.title,
        onetCode: t.onetSocCode,
        pvq: t.pvq,
        stq: t.stq,
        tfq: t.tfq,
        vaq: t.vaq,
        lmq: t.lmq,
        cpcSimilarity: t.cpcSimilarity,
        cpcCode: t.cpcCode,
        confidenceGrade: t.confidenceGrade,
      })),
      topExcluded: excludedTargets.slice(0, 5).map((t) => ({
        title: t.title,
        onetCode: t.onetSocCode,
        exclusionReason: t.exclusionReason,
        nearMissSeverity: t.nearMissSeverity,
      })),
      cpcAnalysis: updatedAnalysis?.cpcAnalysis
        ? {
            workerCpc: (updatedAnalysis.cpcAnalysis as Record<string, unknown>).workerProfile,
            similarCount: (
              (updatedAnalysis.cpcAnalysis as Record<string, unknown>)
                .similarOccupations as unknown[]
            )?.length ?? 0,
            gapAnalysis: (updatedAnalysis.cpcAnalysis as Record<string, unknown>).gapAnalysis,
            laborMarketSummary: (updatedAnalysis.cpcAnalysis as Record<string, unknown>).laborMarketSummary,
          }
        : null,
      validation,
      log,
    });
  } catch (error) {
    console.error("[POST /api/analysis/run]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        ...(process.env.NODE_ENV !== "production" && error instanceof Error
          ? { stack: error.stack }
          : {}),
      },
      { status: 500 }
    );
  }
}
