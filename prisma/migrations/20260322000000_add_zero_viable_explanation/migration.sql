-- Add zeroViableExplanation column to Analysis table
-- This column was added to the schema but the migration was appended to an
-- already-applied migration, so the column was never created in production.
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "zeroViableExplanation" JSONB;
