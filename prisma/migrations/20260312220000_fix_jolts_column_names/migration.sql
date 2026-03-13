-- Fix JOLTSIndustryData column names to match Prisma schema
-- The previous migration created "openings" but Prisma schema expects "jobOpenings"

-- Conditionally rename "openings" -> "jobOpenings" (only if "openings" exists)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'JOLTSIndustryData' AND column_name = 'openings'
  ) THEN
    ALTER TABLE "JOLTSIndustryData" RENAME COLUMN "openings" TO "jobOpenings";
  END IF;
END $$;

-- Drop extra columns that aren't in the Prisma schema
ALTER TABLE "JOLTSIndustryData" DROP COLUMN IF EXISTS "month";
ALTER TABLE "JOLTSIndustryData" DROP COLUMN IF EXISTS "separations";
ALTER TABLE "JOLTSIndustryData" DROP COLUMN IF EXISTS "quits";
ALTER TABLE "JOLTSIndustryData" DROP COLUMN IF EXISTS "layoffs";
