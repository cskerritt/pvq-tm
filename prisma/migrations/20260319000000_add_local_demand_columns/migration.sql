-- AlterTable
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "localDemandDetails" JSONB;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "localDemandScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "JOLTSIndustryData" ADD COLUMN IF NOT EXISTS "hires" DOUBLE PRECISION;
