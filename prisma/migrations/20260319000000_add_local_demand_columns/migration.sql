-- AlterTable
ALTER TABLE "TargetOccupation" ADD COLUMN     "localDemandDetails" JSONB,
ADD COLUMN     "localDemandScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "JOLTSIndustryData" ADD COLUMN     "hires" DOUBLE PRECISION;
