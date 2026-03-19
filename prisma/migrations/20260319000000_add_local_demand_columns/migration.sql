-- AlterTable: add localDemand columns (nullable; null = "not yet computed")
ALTER TABLE "TargetOccupation" ADD COLUMN     "localDemandDetails" JSONB,
ADD COLUMN     "localDemandScore" DOUBLE PRECISION;

-- Backfill: set neutral score (50) for existing rows so downstream code
-- doesn't need to distinguish "never computed" from "no data available".
UPDATE "TargetOccupation"
SET "localDemandScore" = 50
WHERE "localDemandScore" IS NULL;

-- AlterTable: hires is legitimately nullable (not every JOLTS record has it)
ALTER TABLE "JOLTSIndustryData" ADD COLUMN     "hires" DOUBLE PRECISION;
