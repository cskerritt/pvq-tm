-- RenameColumns: MVQS -> VQS in Analysis table
ALTER TABLE "Analysis" RENAME COLUMN "mvqsPostEcMedian" TO "vqsPostEcMedian";
ALTER TABLE "Analysis" RENAME COLUMN "mvqsPreEcMedian" TO "vqsPreEcMedian";
ALTER TABLE "Analysis" RENAME COLUMN "mvqsEcLoss" TO "vqsEcLoss";
ALTER TABLE "Analysis" RENAME COLUMN "mvqsEcLossPct" TO "vqsEcLossPct";
