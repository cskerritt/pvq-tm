-- Performance indexes on foreign key columns
CREATE INDEX IF NOT EXISTS "PastRelevantWork_caseId_idx" ON "PastRelevantWork"("caseId");
CREATE INDEX IF NOT EXISTS "PastRelevantWork_onetSocCode_idx" ON "PastRelevantWork"("onetSocCode");
CREATE INDEX IF NOT EXISTS "AcquiredSkill_caseId_idx" ON "AcquiredSkill"("caseId");
CREATE INDEX IF NOT EXISTS "AcquiredSkill_prwId_idx" ON "AcquiredSkill"("prwId");
CREATE INDEX IF NOT EXISTS "Analysis_caseId_idx" ON "Analysis"("caseId");
CREATE INDEX IF NOT EXISTS "TargetOccupation_analysisId_idx" ON "TargetOccupation"("analysisId");
CREATE INDEX IF NOT EXISTS "TargetOccupation_onetSocCode_idx" ON "TargetOccupation"("onetSocCode");
CREATE INDEX IF NOT EXISTS "OccupationWages_onetSocCode_idx" ON "OccupationWages"("onetSocCode");
