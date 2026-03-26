-- Add analysisMode to Analysis (strict = SSA/litigation, clinical = rehabilitation)
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "analysisMode" TEXT DEFAULT 'strict';

-- Add pendingEvaluatorReview to TargetOccupation (VAQ auto-estimated, needs evaluator confirmation)
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "pendingEvaluatorReview" BOOLEAN DEFAULT false;

-- Add hasTolerations to TargetOccupation (clinical mode: marginal trait failures tolerated)
ALTER TABLE "TargetOccupation" ADD COLUMN IF NOT EXISTS "hasTolerations" BOOLEAN DEFAULT false;
