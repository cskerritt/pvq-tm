-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "confidenceExplanation" JSONB;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "nearMissAnalysis" JSONB;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "regionalLaborMarket" JSONB;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "rfcNarrative" JSONB;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "viableSetAnalysis" JSONB;

-- AlterTable
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "closestFailTrait" TEXT;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "nearMissDetails" JSONB;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "nearMissSeverity" TEXT;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "traitMarginAvg" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "traitMarginMin" DOUBLE PRECISION;
