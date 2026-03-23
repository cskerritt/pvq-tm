-- AlterTable: Add Component Profile Code (CPC) fields to TargetOccupation
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "cpcCode" TEXT;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "cpcSimilarity" DOUBLE PRECISION;

-- AlterTable: Add CPC analysis JSON to Analysis
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "cpcAnalysis" JSONB;
