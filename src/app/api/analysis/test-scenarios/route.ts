import { NextRequest, NextResponse } from "next/server";

/**
 * Pre-Built Test Scenarios API
 *
 * GET  — Returns all available test scenarios
 * POST — Runs a specific scenario through the one-shot analysis API
 *
 * Each scenario is designed to test specific edge cases and validate
 * that the PVQ-TM pipeline handles them correctly.
 */

interface TestScenario {
  id: string;
  name: string;
  description: string;
  expectedBehavior: string;
  payload: Record<string, unknown>;
}

const SCENARIOS: TestScenario[] = [
  {
    id: "baseline-office",
    name: "Baseline — Office Worker to Light Work",
    description: "Administrative Assistant with full cognitive capacity, restricted to Light physical work",
    expectedBehavior: "Multiple viable occupations, moderate STQ, CPC matches in admin/office cluster",
    payload: {
      case: {
        clientName: "Test: Office Baseline",
        dateOfInjury: "2024-06-15",
        zipCode: "10001",
        injuryDescription: "Lower back strain from repetitive lifting",
        bodyPartsAffected: ["lumbar spine"],
      },
      prw: [{
        jobTitle: "Administrative Assistant",
        onetSocCode: "43-6014.00",
        svp: 5,
        strengthLevel: "L",
        durationMonths: 60,
        actualWageAnnual: 38000,
      }],
      skills: [
        { prwIndex: 0, actionVerb: "Manage", object: "office correspondence", toolsSoftware: "Microsoft Office", isTransferable: true },
        { prwIndex: 0, actionVerb: "Schedule", object: "appointments and meetings", toolsSoftware: "Outlook", isTransferable: true },
        { prwIndex: 0, actionVerb: "Maintain", object: "filing systems", isTransferable: true },
      ],
      preProfile: { reasoning: 3, math: 2, language: 3, spatialPerception: 2, formPerception: 2, clericalPerception: 3, motorCoordination: 2, fingerDexterity: 3, manualDexterity: 2, eyeHandFoot: 1, colorDiscrimination: 2, strength: 1, climbBalance: 1, stoopKneel: 2, reachHandle: 2, talkHear: 3, see: 3, workLocation: 1, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 1, hazards: 0, dustsFumes: 0 },
      postProfile: { reasoning: 3, math: 2, language: 3, spatialPerception: 2, formPerception: 2, clericalPerception: 3, motorCoordination: 2, fingerDexterity: 3, manualDexterity: 2, eyeHandFoot: 1, colorDiscrimination: 2, strength: 1, climbBalance: 0, stoopKneel: 1, reachHandle: 2, talkHear: 3, see: 3, workLocation: 1, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 1, hazards: 0, dustsFumes: 0 },
      analysisConfig: { ageRule: "standard", priorEarnings: 38000 },
      cleanup: true,
    },
  },
  {
    id: "zero-viable",
    name: "Zero Viable — Heavy Worker to Sedentary",
    description: "Construction Laborer with severe restrictions, expecting zero viable occupations",
    expectedBehavior: "Zero viable targets, zeroViableExplanation populated, CPC still finds component-similar occupations",
    payload: {
      case: {
        clientName: "Test: Zero Viable",
        dateOfInjury: "2024-01-10",
        zipCode: "90001",
        injuryDescription: "Bilateral shoulder rotator cuff tears with lumbar fusion",
        bodyPartsAffected: ["bilateral shoulders", "lumbar spine"],
      },
      prw: [{
        jobTitle: "Construction Laborer",
        onetSocCode: "47-2061.00",
        svp: 3,
        strengthLevel: "H",
        durationMonths: 120,
        actualWageAnnual: 42000,
      }],
      skills: [],
      preProfile: { reasoning: 2, math: 1, language: 2, spatialPerception: 2, formPerception: 2, clericalPerception: 1, motorCoordination: 3, fingerDexterity: 2, manualDexterity: 3, eyeHandFoot: 2, colorDiscrimination: 2, strength: 3, climbBalance: 3, stoopKneel: 3, reachHandle: 3, talkHear: 2, see: 3, workLocation: 3, extremeCold: 2, extremeHeat: 2, wetnessHumidity: 2, noiseVibration: 3, hazards: 3, dustsFumes: 2 },
      postProfile: { reasoning: 2, math: 1, language: 2, spatialPerception: 2, formPerception: 2, clericalPerception: 1, motorCoordination: 1, fingerDexterity: 1, manualDexterity: 1, eyeHandFoot: 1, colorDiscrimination: 2, strength: 0, climbBalance: 0, stoopKneel: 0, reachHandle: 1, talkHear: 2, see: 3, workLocation: 1, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 1, hazards: 0, dustsFumes: 0 },
      analysisConfig: { ageRule: "standard", priorEarnings: 42000 },
      cleanup: true,
    },
  },
  {
    id: "skilled-nurse",
    name: "Skilled Worker — Registered Nurse",
    description: "RN with high SVP transferring to Light work after back injury",
    expectedBehavior: "Healthcare-adjacent targets with high STQ, strong CPC matches in healthcare cluster",
    payload: {
      case: {
        clientName: "Test: Skilled Nurse",
        dateOfInjury: "2024-03-20",
        zipCode: "60601",
        injuryDescription: "L4-L5 disc herniation from patient lifting",
        bodyPartsAffected: ["lumbar spine"],
      },
      prw: [{
        jobTitle: "Registered Nurse",
        onetSocCode: "29-1141.00",
        svp: 7,
        strengthLevel: "M",
        durationMonths: 96,
        actualWageAnnual: 72000,
      }],
      skills: [
        { prwIndex: 0, actionVerb: "Assess", object: "patient health conditions", isTransferable: true, svpLevel: 7 },
        { prwIndex: 0, actionVerb: "Administer", object: "medications and treatments", toolsSoftware: "Electronic Health Records", isTransferable: true, svpLevel: 6 },
        { prwIndex: 0, actionVerb: "Educate", object: "patients on health management", isTransferable: true, svpLevel: 5 },
        { prwIndex: 0, actionVerb: "Coordinate", object: "care plans with physicians", isTransferable: true, svpLevel: 6 },
      ],
      preProfile: { reasoning: 4, math: 3, language: 4, spatialPerception: 3, formPerception: 3, clericalPerception: 3, motorCoordination: 3, fingerDexterity: 3, manualDexterity: 3, eyeHandFoot: 2, colorDiscrimination: 3, strength: 2, climbBalance: 1, stoopKneel: 2, reachHandle: 3, talkHear: 4, see: 3, workLocation: 1, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 1, noiseVibration: 1, hazards: 2, dustsFumes: 1 },
      postProfile: { reasoning: 4, math: 3, language: 4, spatialPerception: 3, formPerception: 3, clericalPerception: 3, motorCoordination: 3, fingerDexterity: 3, manualDexterity: 3, eyeHandFoot: 2, colorDiscrimination: 3, strength: 1, climbBalance: 0, stoopKneel: 1, reachHandle: 2, talkHear: 4, see: 3, workLocation: 1, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 1, hazards: 1, dustsFumes: 0 },
      analysisConfig: { ageRule: "standard", priorEarnings: 72000 },
      cleanup: true,
    },
  },
  {
    id: "advanced-age",
    name: "Advanced Age Rule — Accountant",
    description: "Accountant age 56 (closely approaching advanced age) with Sedentary restriction",
    expectedBehavior: "VAQ must be 100 on all dimensions for viable occupations, otherwise excluded",
    payload: {
      case: {
        clientName: "Test: Advanced Age",
        dateOfInjury: "2024-09-01",
        zipCode: "30301",
        injuryDescription: "Carpal tunnel syndrome bilateral",
        bodyPartsAffected: ["bilateral wrists", "bilateral hands"],
      },
      prw: [{
        jobTitle: "Accountant",
        onetSocCode: "13-2011.00",
        svp: 7,
        strengthLevel: "S",
        durationMonths: 240,
        actualWageAnnual: 65000,
      }],
      skills: [
        { prwIndex: 0, actionVerb: "Prepare", object: "financial statements", toolsSoftware: "QuickBooks, Excel", isTransferable: true, svpLevel: 7 },
        { prwIndex: 0, actionVerb: "Analyze", object: "financial data for compliance", isTransferable: true, svpLevel: 6 },
      ],
      preProfile: { reasoning: 4, math: 4, language: 3, spatialPerception: 2, formPerception: 3, clericalPerception: 4, motorCoordination: 2, fingerDexterity: 3, manualDexterity: 2, eyeHandFoot: 1, colorDiscrimination: 2, strength: 0, climbBalance: 0, stoopKneel: 1, reachHandle: 2, talkHear: 3, see: 3, workLocation: 0, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 1, hazards: 0, dustsFumes: 0 },
      postProfile: { reasoning: 4, math: 4, language: 3, spatialPerception: 2, formPerception: 3, clericalPerception: 4, motorCoordination: 1, fingerDexterity: 1, manualDexterity: 1, eyeHandFoot: 1, colorDiscrimination: 2, strength: 0, climbBalance: 0, stoopKneel: 1, reachHandle: 1, talkHear: 3, see: 3, workLocation: 0, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 1, hazards: 0, dustsFumes: 0 },
      analysisConfig: { ageRule: "closely_approaching", priorEarnings: 65000 },
      cleanup: true,
    },
  },
  {
    id: "no-skills",
    name: "No Acquired Skills — Truck Driver",
    description: "Truck Driver with no manually entered skills, testing O*NET task fallback",
    expectedBehavior: "STQ should produce non-zero scores via O*NET task data fallback",
    payload: {
      case: {
        clientName: "Test: No Skills",
        dateOfInjury: "2024-05-01",
        zipCode: "75201",
        injuryDescription: "Cervical disc injury from rear-end collision",
        bodyPartsAffected: ["cervical spine"],
      },
      prw: [{
        jobTitle: "Heavy Truck Driver",
        onetSocCode: "53-3032.00",
        svp: 4,
        strengthLevel: "M",
        durationMonths: 84,
        actualWageAnnual: 48000,
      }],
      skills: [],
      preProfile: { reasoning: 2, math: 2, language: 2, spatialPerception: 3, formPerception: 2, clericalPerception: 2, motorCoordination: 3, fingerDexterity: 2, manualDexterity: 2, eyeHandFoot: 3, colorDiscrimination: 2, strength: 2, climbBalance: 2, stoopKneel: 2, reachHandle: 2, talkHear: 2, see: 3, workLocation: 2, extremeCold: 1, extremeHeat: 1, wetnessHumidity: 1, noiseVibration: 2, hazards: 2, dustsFumes: 1 },
      postProfile: { reasoning: 2, math: 2, language: 2, spatialPerception: 3, formPerception: 2, clericalPerception: 2, motorCoordination: 2, fingerDexterity: 2, manualDexterity: 2, eyeHandFoot: 2, colorDiscrimination: 2, strength: 1, climbBalance: 1, stoopKneel: 1, reachHandle: 2, talkHear: 2, see: 3, workLocation: 1, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 1, hazards: 1, dustsFumes: 0 },
      analysisConfig: { ageRule: "standard", priorEarnings: 48000 },
      cleanup: true,
    },
  },
  {
    id: "multi-prw",
    name: "Multiple PRW — Teacher + Office Manager",
    description: "Composite CPC profile from two distinct occupational backgrounds",
    expectedBehavior: "CPC composite blends education + admin components, broader skill transfer",
    payload: {
      case: {
        clientName: "Test: Multi PRW",
        dateOfInjury: "2024-07-01",
        zipCode: "02101",
        injuryDescription: "Knee replacement following work-related fall",
        bodyPartsAffected: ["right knee"],
      },
      prw: [
        { jobTitle: "Elementary School Teacher", onetSocCode: "25-2021.00", svp: 7, strengthLevel: "L", durationMonths: 120, actualWageAnnual: 52000 },
        { jobTitle: "General and Operations Manager", onetSocCode: "11-1021.00", svp: 8, strengthLevel: "L", durationMonths: 48, actualWageAnnual: 68000 },
      ],
      skills: [
        { prwIndex: 0, actionVerb: "Instruct", object: "students in academic subjects", isTransferable: true, svpLevel: 7 },
        { prwIndex: 0, actionVerb: "Develop", object: "lesson plans and curriculum", isTransferable: true, svpLevel: 6 },
        { prwIndex: 1, actionVerb: "Manage", object: "staff and daily operations", isTransferable: true, svpLevel: 8 },
        { prwIndex: 1, actionVerb: "Prepare", object: "budgets and financial reports", toolsSoftware: "Excel, SAP", isTransferable: true, svpLevel: 7 },
      ],
      preProfile: { reasoning: 4, math: 3, language: 4, spatialPerception: 2, formPerception: 2, clericalPerception: 3, motorCoordination: 2, fingerDexterity: 2, manualDexterity: 2, eyeHandFoot: 1, colorDiscrimination: 2, strength: 1, climbBalance: 1, stoopKneel: 2, reachHandle: 2, talkHear: 4, see: 3, workLocation: 1, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 1, hazards: 0, dustsFumes: 0 },
      postProfile: { reasoning: 4, math: 3, language: 4, spatialPerception: 2, formPerception: 2, clericalPerception: 3, motorCoordination: 2, fingerDexterity: 2, manualDexterity: 2, eyeHandFoot: 1, colorDiscrimination: 2, strength: 0, climbBalance: 0, stoopKneel: 1, reachHandle: 2, talkHear: 4, see: 3, workLocation: 0, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 1, hazards: 0, dustsFumes: 0 },
      analysisConfig: { ageRule: "standard", priorEarnings: 68000 },
      cleanup: true,
    },
  },
  {
    id: "max-capacity",
    name: "Maximum Capacity — No Restrictions",
    description: "General Manager with all traits at maximum capacity",
    expectedBehavior: "Many viable occupations, high PVQ scores, broad CPC profile",
    payload: {
      case: { clientName: "Test: Max Capacity", dateOfInjury: "2024-01-01", zipCode: "10001" },
      prw: [{ jobTitle: "General and Operations Manager", onetSocCode: "11-1021.00", svp: 8, strengthLevel: "H", durationMonths: 120, actualWageAnnual: 95000 }],
      skills: [
        { prwIndex: 0, actionVerb: "Direct", object: "organizational operations", isTransferable: true, svpLevel: 8 },
        { prwIndex: 0, actionVerb: "Develop", object: "strategic business plans", isTransferable: true, svpLevel: 8 },
      ],
      preProfile: { reasoning: 4, math: 4, language: 4, spatialPerception: 4, formPerception: 4, clericalPerception: 4, motorCoordination: 4, fingerDexterity: 4, manualDexterity: 4, eyeHandFoot: 4, colorDiscrimination: 4, strength: 4, climbBalance: 4, stoopKneel: 4, reachHandle: 4, talkHear: 4, see: 4, workLocation: 4, extremeCold: 4, extremeHeat: 4, wetnessHumidity: 4, noiseVibration: 4, hazards: 4, dustsFumes: 4 },
      postProfile: { reasoning: 4, math: 4, language: 4, spatialPerception: 4, formPerception: 4, clericalPerception: 4, motorCoordination: 4, fingerDexterity: 4, manualDexterity: 4, eyeHandFoot: 4, colorDiscrimination: 4, strength: 4, climbBalance: 4, stoopKneel: 4, reachHandle: 4, talkHear: 4, see: 4, workLocation: 4, extremeCold: 4, extremeHeat: 4, wetnessHumidity: 4, noiseVibration: 4, hazards: 4, dustsFumes: 4 },
      analysisConfig: { ageRule: "standard", priorEarnings: 95000 },
      cleanup: true,
    },
  },
  {
    id: "min-capacity",
    name: "Minimum Capacity — Severe Restrictions",
    description: "Janitor with most traits at 0-1, expecting few or zero viable",
    expectedBehavior: "Very few or zero viable occupations, clear exclusion reasons, severe limitation narrative",
    payload: {
      case: { clientName: "Test: Min Capacity", dateOfInjury: "2024-01-01", zipCode: "48201", injuryDescription: "Multiple injuries: TBI, bilateral upper/lower extremity", bodyPartsAffected: ["head", "bilateral arms", "bilateral legs", "spine"] },
      prw: [{ jobTitle: "Janitor", onetSocCode: "37-2011.00", svp: 2, strengthLevel: "M", durationMonths: 36, actualWageAnnual: 28000 }],
      skills: [],
      preProfile: { reasoning: 2, math: 1, language: 2, spatialPerception: 2, formPerception: 2, clericalPerception: 1, motorCoordination: 2, fingerDexterity: 2, manualDexterity: 2, eyeHandFoot: 2, colorDiscrimination: 2, strength: 2, climbBalance: 2, stoopKneel: 2, reachHandle: 2, talkHear: 2, see: 2, workLocation: 2, extremeCold: 1, extremeHeat: 1, wetnessHumidity: 1, noiseVibration: 1, hazards: 1, dustsFumes: 1 },
      postProfile: { reasoning: 1, math: 0, language: 1, spatialPerception: 0, formPerception: 0, clericalPerception: 0, motorCoordination: 0, fingerDexterity: 0, manualDexterity: 0, eyeHandFoot: 0, colorDiscrimination: 1, strength: 0, climbBalance: 0, stoopKneel: 0, reachHandle: 0, talkHear: 1, see: 1, workLocation: 0, extremeCold: 0, extremeHeat: 0, wetnessHumidity: 0, noiseVibration: 0, hazards: 0, dustsFumes: 0 },
      analysisConfig: { ageRule: "standard", priorEarnings: 28000 },
      cleanup: true,
    },
  },
];

export async function GET() {
  return NextResponse.json({
    count: SCENARIOS.length,
    scenarios: SCENARIOS.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      expectedBehavior: s.expectedBehavior,
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { scenarioId, cleanup } = await req.json();

    if (!scenarioId) {
      return NextResponse.json(
        { error: "scenarioId is required. GET this endpoint for available scenarios." },
        { status: 400 }
      );
    }

    const scenario = SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) {
      return NextResponse.json(
        { error: `Scenario '${scenarioId}' not found`, available: SCENARIOS.map((s) => s.id) },
        { status: 404 }
      );
    }

    // Override cleanup if specified
    const payload = { ...scenario.payload };
    if (cleanup !== undefined) {
      payload.cleanup = cleanup;
    }

    // Forward to the one-shot analysis API
    const runUrl = new URL("/api/analysis/run", req.url);
    const runRes = await fetch(runUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await runRes.json();

    return NextResponse.json({
      scenario: {
        id: scenario.id,
        name: scenario.name,
        description: scenario.description,
        expectedBehavior: scenario.expectedBehavior,
      },
      result,
    });
  } catch (error) {
    console.error("[POST /api/analysis/test-scenarios]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
