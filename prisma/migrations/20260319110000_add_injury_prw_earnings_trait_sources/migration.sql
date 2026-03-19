-- Case: injury and medical context fields
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "injuryDescription" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "bodyPartsAffected" TEXT[] DEFAULT '{}';
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "treatingPhysician" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "physicianSpecialty" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "mmiDate" TIMESTAMP(3);
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "fceDate" TIMESTAMP(3);
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "fceProvider" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "surgeryDates" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "medicalNotes" TEXT;

-- PastRelevantWork: actual earnings history
ALTER TABLE "PastRelevantWork" ADD COLUMN IF NOT EXISTS "actualWageHourly" DOUBLE PRECISION;
ALTER TABLE "PastRelevantWork" ADD COLUMN IF NOT EXISTS "actualWageAnnual" DOUBLE PRECISION;
ALTER TABLE "PastRelevantWork" ADD COLUMN IF NOT EXISTS "wageYear" INTEGER;
ALTER TABLE "PastRelevantWork" ADD COLUMN IF NOT EXISTS "hoursPerWeek" DOUBLE PRECISION;

-- WorkerProfile: trait source documentation
ALTER TABLE "WorkerProfile" ADD COLUMN IF NOT EXISTS "traitSources" JSONB;
