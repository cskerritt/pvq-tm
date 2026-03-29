-- Add missing RSE (Relative Standard Error) columns to OccupationWages table.
-- These columns exist in the Prisma schema but were never added via migration.

ALTER TABLE "OccupationWages" ADD COLUMN IF NOT EXISTS "rseEmployment" DOUBLE PRECISION;
ALTER TABLE "OccupationWages" ADD COLUMN IF NOT EXISTS "rseMedianWage" DOUBLE PRECISION;
ALTER TABLE "OccupationWages" ADD COLUMN IF NOT EXISTS "rseMeanWage" DOUBLE PRECISION;
