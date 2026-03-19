-- Add labor market access field to Analysis
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "laborMarketAccess" JSONB;
