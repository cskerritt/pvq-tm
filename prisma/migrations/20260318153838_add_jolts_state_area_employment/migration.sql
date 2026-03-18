-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "postInjuryAreaEmployment" DOUBLE PRECISION,
ADD COLUMN     "preInjuryAreaEmployment" DOUBLE PRECISION,
ADD COLUMN     "stateFips" TEXT,
ADD COLUMN     "stateJoltsCurrent" DOUBLE PRECISION,
ADD COLUMN     "stateJoltsPreInjury" DOUBLE PRECISION,
ADD COLUMN     "stateName" TEXT;

-- AlterTable
ALTER TABLE "TargetOccupation" ADD COLUMN     "areaEmployment" INTEGER,
ADD COLUMN     "areaMedianWage" DOUBLE PRECISION,
ADD COLUMN     "joltsTrend" DOUBLE PRECISION,
ADD COLUMN     "joltsTrendLabel" TEXT;

-- CreateTable
CREATE TABLE "JOLTSStateData" (
    "id" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "jobOpenings" DOUBLE PRECISION,
    "hires" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JOLTSStateData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JOLTSStateData_stateCode_year_key" ON "JOLTSStateData"("stateCode", "year");
