-- RenameColumns: MVQS -> VQS in Analysis table
-- Use DO block to handle case where columns may have already been renamed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Analysis' AND column_name = 'mvqsPostEcMedian') THEN
    ALTER TABLE "Analysis" RENAME COLUMN "mvqsPostEcMedian" TO "vqsPostEcMedian";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Analysis' AND column_name = 'mvqsPreEcMedian') THEN
    ALTER TABLE "Analysis" RENAME COLUMN "mvqsPreEcMedian" TO "vqsPreEcMedian";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Analysis' AND column_name = 'mvqsEcLoss') THEN
    ALTER TABLE "Analysis" RENAME COLUMN "mvqsEcLoss" TO "vqsEcLoss";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Analysis' AND column_name = 'mvqsEcLossPct') THEN
    ALTER TABLE "Analysis" RENAME COLUMN "mvqsEcLossPct" TO "vqsEcLossPct";
  END IF;
END $$;
