-- TargetOccupation: VQ-centric feasibility scoring columns
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "feasibilityScore" DOUBLE PRECISION;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "riskLevel" TEXT;
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "traitDeficits" JSONB;
