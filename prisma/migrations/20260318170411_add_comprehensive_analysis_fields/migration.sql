-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "confidenceExplanation" JSONB,
ADD COLUMN     "nearMissAnalysis" JSONB,
ADD COLUMN     "regionalLaborMarket" JSONB,
ADD COLUMN     "rfcNarrative" JSONB,
ADD COLUMN     "viableSetAnalysis" JSONB;

-- AlterTable
ALTER TABLE "TargetOccupation" ADD COLUMN     "closestFailTrait" TEXT,
ADD COLUMN     "nearMissDetails" JSONB,
ADD COLUMN     "nearMissSeverity" TEXT,
ADD COLUMN     "traitMarginAvg" DOUBLE PRECISION,
ADD COLUMN     "traitMarginMin" DOUBLE PRECISION;
