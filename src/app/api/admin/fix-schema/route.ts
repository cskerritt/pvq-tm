import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Emergency schema fix endpoint.
 * Runs raw SQL to add any missing columns to the production database.
 * Uses IF NOT EXISTS so it's safe to run multiple times.
 * DELETE THIS FILE after the production schema is fixed.
 */
export async function POST() {
  try {
    const statements = [
      // ============ Analysis table ============
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "preInjuryViableCount" INTEGER`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "preInjuryTotalEmployment" DOUBLE PRECISION`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "preInjuryJoltsOpenings" DOUBLE PRECISION`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "postInjuryViableCount" INTEGER`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "postInjuryTotalEmployment" DOUBLE PRECISION`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "postInjuryJoltsOpenings" DOUBLE PRECISION`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "preInjuryAreaEmployment" DOUBLE PRECISION`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "postInjuryAreaEmployment" DOUBLE PRECISION`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "stateJoltsCurrent" DOUBLE PRECISION`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "stateJoltsPreInjury" DOUBLE PRECISION`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "stateFips" TEXT`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "stateName" TEXT`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "vqsPostEcMedian" DOUBLE PRECISION`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "vqsPreEcMedian" DOUBLE PRECISION`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "vqsEcLoss" DOUBLE PRECISION`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "vqsEcLossPct" DOUBLE PRECISION`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "nearMissAnalysis" JSONB`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "rfcNarrative" JSONB`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "viableSetAnalysis" JSONB`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "confidenceExplanation" JSONB`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "regionalLaborMarket" JSONB`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "hiredJobsAnalysis" JSONB`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "laborMarketAccess" JSONB`,
      `ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "zeroViableExplanation" JSONB`,

      // ============ TargetOccupation table ============
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "nearMissSeverity" TEXT`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "nearMissDetails" JSONB`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "traitMarginMin" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "traitMarginAvg" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "closestFailTrait" TEXT`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "localDemandScore" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "localDemandDetails" JSONB`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "preTfq" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "preTfqPasses" BOOLEAN`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "preTfqDetails" JSONB`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "joltsIndustryCode" TEXT`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "joltsIndustryName" TEXT`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "joltsCurrentOpenings" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "joltsPreInjuryOpenings" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "joltsTrend" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "joltsTrendLabel" TEXT`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "areaEmployment" INTEGER`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "areaMedianWage" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "vqScore" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "vqBand" INTEGER`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "vqDetails" JSONB`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "tspScore" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "tspTier" INTEGER`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "tspLabel" TEXT`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "tspDetails" JSONB`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ecMedian" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ecMean" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ec10" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ec25" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ec75" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ec90" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ecSee" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ecConfLow" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ecConfHigh" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ecGeoAdjusted" BOOLEAN`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ecDetails" JSONB`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "preVqScore" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "preEcMedian" DOUBLE PRECISION`,
      `ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "preEcDetails" JSONB`,

      // ============ Case table ============
      `ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "zipCode" TEXT`,
      `ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "metroAreaCode" TEXT`,
      `ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "metroAreaName" TEXT`,
      `ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "injuryDescription" TEXT`,
      `ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "bodyPartsAffected" TEXT[] DEFAULT '{}'`,
      `ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "treatingPhysician" TEXT`,
      `ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "physicianSpecialty" TEXT`,
      `ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "mmiDate" TIMESTAMP(3)`,
      `ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "fceDate" TIMESTAMP(3)`,
      `ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "fceProvider" TEXT`,
      `ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "surgeryDates" TEXT`,
      `ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "medicalNotes" TEXT`,

      // ============ PastRelevantWork table ============
      `ALTER TABLE "PastRelevantWork" ADD COLUMN IF NOT EXISTS "actualWageHourly" DOUBLE PRECISION`,
      `ALTER TABLE "PastRelevantWork" ADD COLUMN IF NOT EXISTS "actualWageAnnual" DOUBLE PRECISION`,
      `ALTER TABLE "PastRelevantWork" ADD COLUMN IF NOT EXISTS "wageYear" INTEGER`,
      `ALTER TABLE "PastRelevantWork" ADD COLUMN IF NOT EXISTS "hoursPerWeek" DOUBLE PRECISION`,

      // ============ WorkerProfile table ============
      `ALTER TABLE "WorkerProfile" ADD COLUMN IF NOT EXISTS "traitSources" JSONB`,

      // ============ JOLTSIndustryData table ============
      `CREATE TABLE IF NOT EXISTS "JOLTSIndustryData" ("id" TEXT NOT NULL, "naicsCode" TEXT NOT NULL, "industryName" TEXT NOT NULL, "year" INTEGER NOT NULL, "jobOpenings" DOUBLE PRECISION, "hires" DOUBLE PRECISION, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "JOLTSIndustryData_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "JOLTSIndustryData_naicsCode_year_key" ON "JOLTSIndustryData"("naicsCode", "year")`,

      // ============ JOLTSStateData table ============
      `CREATE TABLE IF NOT EXISTS "JOLTSStateData" ("id" TEXT NOT NULL, "stateCode" TEXT NOT NULL, "stateName" TEXT NOT NULL, "year" INTEGER NOT NULL, "jobOpenings" DOUBLE PRECISION, "hires" DOUBLE PRECISION, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "JOLTSStateData_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "JOLTSStateData_stateCode_year_key" ON "JOLTSStateData"("stateCode", "year")`,

      // ============ RHAJReference table ============
      `CREATE TABLE IF NOT EXISTS "RHAJReference" ("id" TEXT NOT NULL, "category" TEXT NOT NULL, "title" TEXT NOT NULL, "data" JSONB NOT NULL, "source" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RHAJReference_pkey" PRIMARY KEY ("id"))`,
    ];

    let executed = 0;
    const errors: string[] = [];

    for (const sql of statements) {
      try {
        await prisma.$executeRawUnsafe(sql);
        executed++;
      } catch (e) {
        errors.push(`${sql.substring(0, 80)}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return NextResponse.json({
      executed,
      total: statements.length,
      errors: errors.length,
      errorDetails: errors.slice(0, 10),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
