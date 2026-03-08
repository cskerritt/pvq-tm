-- CreateTable
CREATE TABLE "OccupationDOT" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "industryDesig" TEXT,
    "svp" INTEGER NOT NULL,
    "strength" TEXT NOT NULL,
    "gedR" INTEGER NOT NULL,
    "gedM" INTEGER NOT NULL,
    "gedL" INTEGER NOT NULL,
    "aptitudes" JSONB NOT NULL,
    "temperaments" TEXT[],
    "interests" TEXT[],
    "physicalDemands" JSONB NOT NULL,
    "envConditions" JSONB NOT NULL,
    "workFields" TEXT[],
    "mpsms" TEXT[],
    "dlu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OccupationDOT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupationONET" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tasks" JSONB,
    "dwas" JSONB,
    "toolsTech" JSONB,
    "knowledge" JSONB,
    "skills" JSONB,
    "abilities" JSONB,
    "workActivities" JSONB,
    "workContext" JSONB,
    "jobZone" INTEGER,
    "svpRange" TEXT,
    "relatedOccs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OccupationONET_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupationORS" (
    "id" TEXT NOT NULL,
    "onetSocCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "physicalDemands" JSONB,
    "envConditions" JSONB,
    "cogMental" JSONB,
    "eduTrainExp" JSONB,
    "standardErrors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OccupationORS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupationWages" (
    "id" TEXT NOT NULL,
    "onetSocCode" TEXT NOT NULL,
    "areaType" TEXT NOT NULL,
    "areaCode" TEXT NOT NULL,
    "areaName" TEXT NOT NULL,
    "employment" INTEGER,
    "meanWage" DOUBLE PRECISION,
    "medianWage" DOUBLE PRECISION,
    "pct10" DOUBLE PRECISION,
    "pct25" DOUBLE PRECISION,
    "pct75" DOUBLE PRECISION,
    "pct90" DOUBLE PRECISION,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OccupationWages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupationProjections" (
    "id" TEXT NOT NULL,
    "socCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "baseYear" INTEGER NOT NULL,
    "projYear" INTEGER NOT NULL,
    "baseEmployment" DOUBLE PRECISION,
    "projEmployment" DOUBLE PRECISION,
    "changeN" DOUBLE PRECISION,
    "changePct" DOUBLE PRECISION,
    "openingsAnnual" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OccupationProjections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DOTONETCrosswalk" (
    "id" TEXT NOT NULL,
    "dotCode" TEXT NOT NULL,
    "onetSocCode" TEXT NOT NULL,

    CONSTRAINT "DOTONETCrosswalk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientDOB" TIMESTAMP(3),
    "evaluatorName" TEXT,
    "referralSource" TEXT,
    "dateOfInjury" TIMESTAMP(3),
    "dateOfEval" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerProfile" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "profileType" TEXT NOT NULL,
    "reasoning" INTEGER,
    "math" INTEGER,
    "language" INTEGER,
    "spatialPerception" INTEGER,
    "formPerception" INTEGER,
    "clericalPerception" INTEGER,
    "motorCoordination" INTEGER,
    "fingerDexterity" INTEGER,
    "manualDexterity" INTEGER,
    "eyeHandFoot" INTEGER,
    "colorDiscrimination" INTEGER,
    "strength" INTEGER,
    "climbBalance" INTEGER,
    "stoopKneel" INTEGER,
    "reachHandle" INTEGER,
    "talkHear" INTEGER,
    "see" INTEGER,
    "workLocation" INTEGER,
    "extremeCold" INTEGER,
    "extremeHeat" INTEGER,
    "wetnessHumidity" INTEGER,
    "noiseVibration" INTEGER,
    "hazards" INTEGER,
    "dustsFumes" INTEGER,
    "notes" TEXT,
    "sources" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastRelevantWork" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "employer" TEXT,
    "dotCode" TEXT,
    "onetSocCode" TEXT,
    "svp" INTEGER,
    "skillLevel" TEXT,
    "strengthLevel" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "durationMonths" INTEGER,
    "dutiesDescription" TEXT,
    "isSubstantialGainful" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PastRelevantWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcquiredSkill" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "prwId" TEXT NOT NULL,
    "actionVerb" TEXT NOT NULL,
    "object" TEXT NOT NULL,
    "context" TEXT,
    "toolsSoftware" TEXT,
    "materialsServices" TEXT,
    "svpLevel" INTEGER,
    "evidenceSource" TEXT,
    "frequency" TEXT,
    "recency" TEXT,
    "performanceMode" TEXT,
    "isTransferable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcquiredSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "step" INTEGER NOT NULL DEFAULT 1,
    "ageRule" TEXT,
    "priorEarnings" DOUBLE PRECISION,
    "targetArea" TEXT,
    "targetAreaName" TEXT,
    "dataVersions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetOccupation" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "onetSocCode" TEXT NOT NULL,
    "dotCode" TEXT,
    "title" TEXT NOT NULL,
    "svp" INTEGER,
    "stq" DOUBLE PRECISION,
    "stqDetails" JSONB,
    "tfq" DOUBLE PRECISION,
    "tfqDetails" JSONB,
    "vaq" DOUBLE PRECISION,
    "vaqDetails" JSONB,
    "lmq" DOUBLE PRECISION,
    "lmqDetails" JSONB,
    "pvq" DOUBLE PRECISION,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "exclusionReason" TEXT,
    "confidenceGrade" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetOccupation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSyncLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "version" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DataSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OccupationORS_onetSocCode_key" ON "OccupationORS"("onetSocCode");

-- CreateIndex
CREATE UNIQUE INDEX "OccupationWages_onetSocCode_areaType_areaCode_year_key" ON "OccupationWages"("onetSocCode", "areaType", "areaCode", "year");

-- CreateIndex
CREATE UNIQUE INDEX "OccupationProjections_socCode_baseYear_projYear_key" ON "OccupationProjections"("socCode", "baseYear", "projYear");

-- CreateIndex
CREATE UNIQUE INDEX "DOTONETCrosswalk_dotCode_onetSocCode_key" ON "DOTONETCrosswalk"("dotCode", "onetSocCode");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_caseId_profileType_key" ON "WorkerProfile"("caseId", "profileType");

-- AddForeignKey
ALTER TABLE "DOTONETCrosswalk" ADD CONSTRAINT "DOTONETCrosswalk_dotCode_fkey" FOREIGN KEY ("dotCode") REFERENCES "OccupationDOT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOTONETCrosswalk" ADD CONSTRAINT "DOTONETCrosswalk_onetSocCode_fkey" FOREIGN KEY ("onetSocCode") REFERENCES "OccupationONET"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerProfile" ADD CONSTRAINT "WorkerProfile_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastRelevantWork" ADD CONSTRAINT "PastRelevantWork_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastRelevantWork" ADD CONSTRAINT "PastRelevantWork_dotCode_fkey" FOREIGN KEY ("dotCode") REFERENCES "OccupationDOT"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcquiredSkill" ADD CONSTRAINT "AcquiredSkill_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcquiredSkill" ADD CONSTRAINT "AcquiredSkill_prwId_fkey" FOREIGN KEY ("prwId") REFERENCES "PastRelevantWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetOccupation" ADD CONSTRAINT "TargetOccupation_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetOccupation" ADD CONSTRAINT "TargetOccupation_onetSocCode_fkey" FOREIGN KEY ("onetSocCode") REFERENCES "OccupationONET"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
