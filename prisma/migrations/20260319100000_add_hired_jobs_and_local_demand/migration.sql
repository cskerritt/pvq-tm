-- AlterTable - Add hired jobs analysis to Analysis
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "hiredJobsAnalysis" JSONB;

-- AlterTable - Add local demand fields to TargetOccupation
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "localDemandScore" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "localDemandDetails" JSONB;
