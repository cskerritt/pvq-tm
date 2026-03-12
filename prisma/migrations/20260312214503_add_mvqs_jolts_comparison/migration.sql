-- CreateTable: JOLTSIndustryData
CREATE TABLE IF NOT EXISTS "JOLTSIndustryData" (
    "id" TEXT NOT NULL,
    "naicsCode" TEXT NOT NULL,
    "industryName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "openings" DOUBLE PRECISION,
    "hires" DOUBLE PRECISION,
    "separations" DOUBLE PRECISION,
    "quits" DOUBLE PRECISION,
    "layoffs" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JOLTSIndustryData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "JOLTSIndustryData_naicsCode_year_key" ON "JOLTSIndustryData"("naicsCode", "year");

-- AlterTable: Analysis - add MVQS aggregate fields and comparison fields
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "mvqsEcLoss" DOUBLE PRECISION;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "mvqsEcLossPct" DOUBLE PRECISION;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "mvqsPostEcMedian" DOUBLE PRECISION;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "mvqsPreEcMedian" DOUBLE PRECISION;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "postInjuryJoltsOpenings" DOUBLE PRECISION;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "postInjuryTotalEmployment" DOUBLE PRECISION;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "postInjuryViableCount" INTEGER;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "preInjuryJoltsOpenings" DOUBLE PRECISION;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "preInjuryTotalEmployment" DOUBLE PRECISION;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "preInjuryViableCount" INTEGER;

-- AlterTable: TargetOccupation - add VQ fields
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "vqScore" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "vqBand" INTEGER;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "vqDetails" JSONB;

-- AlterTable: TargetOccupation - add TSP fields
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "tspScore" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "tspTier" INTEGER;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "tspLabel" TEXT;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "tspDetails" JSONB;

-- AlterTable: TargetOccupation - add EC fields
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ecMedian" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ecMean" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ec10" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ec25" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ec75" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ec90" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ecSee" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ecConfLow" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ecConfHigh" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ecGeoAdjusted" BOOLEAN;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "ecDetails" JSONB;

-- AlterTable: TargetOccupation - add pre-injury fields
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "preVqScore" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "preEcMedian" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "preEcDetails" JSONB;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "preTfq" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "preTfqPasses" BOOLEAN;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "preTfqDetails" JSONB;

-- AlterTable: TargetOccupation - add JOLTS fields
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "joltsIndustryCode" TEXT;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "joltsIndustryName" TEXT;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "joltsCurrentOpenings" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "joltsPreInjuryOpenings" DOUBLE PRECISION;
