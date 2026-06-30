-- CreateEnum
CREATE TYPE "BreedingProjectType" AS ENUM ('MANAGED', 'OPPORTUNISTIC', 'COMMUNITY', 'PROPAGATION');

-- CreateEnum
CREATE TYPE "BreedingProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BreedingParentRole" AS ENUM ('MALE', 'FEMALE', 'POLLEN', 'SEED', 'UNKNOWN', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "BreedingParentConfidence" AS ENUM ('KNOWN', 'CANDIDATE', 'UNKNOWN', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "BreedingQuantityType" AS ENUM ('EXACT', 'ESTIMATED', 'RANGE');

-- CreateEnum
CREATE TYPE "BreedingObservationType" AS ENUM ('GENERAL', 'SPAWN', 'EGGS', 'HATCH', 'BIRTH', 'GROWTH', 'MILESTONE', 'TRAIT', 'MEASUREMENT', 'LOSS', 'TRANSFER', 'PHOTO', 'NOTE');

-- CreateEnum
CREATE TYPE "BreedingTraitConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CONFIRMED');

-- AlterEnum
ALTER TYPE "AquariumEventType" ADD VALUE 'BREEDING';

-- AlterTable
ALTER TABLE "AquariumItem" ADD COLUMN     "originBreedingCohortId" TEXT,
ADD COLUMN     "originBreedingProjectId" TEXT;

-- AlterTable
ALTER TABLE "AquariumEvent" ADD COLUMN     "breedingCohortId" TEXT,
ADD COLUMN     "breedingObservationId" TEXT,
ADD COLUMN     "breedingProjectId" TEXT;

-- AlterTable
ALTER TABLE "CareTask" ADD COLUMN     "breedingProjectId" TEXT;

-- CreateTable
CREATE TABLE "SpeciesTrait" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "speciesDefinitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpeciesTrait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingProject" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "projectType" "BreedingProjectType" NOT NULL,
    "speciesDefinitionId" TEXT,
    "aquariumId" TEXT,
    "status" "BreedingProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "description" TEXT,
    "notes" TEXT,
    "workflowRunId" TEXT,
    "createdById" TEXT,
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingParent" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "aquariumItemId" TEXT,
    "role" "BreedingParentRole" NOT NULL DEFAULT 'UNKNOWN',
    "confidence" "BreedingParentConfidence" NOT NULL DEFAULT 'CANDIDATE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingParent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingCohort" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "estimatedQuantity" TEXT,
    "quantityType" "BreedingQuantityType" NOT NULL DEFAULT 'ESTIMATED',
    "stage" TEXT NOT NULL,
    "currentEstimate" DOUBLE PRECISION,
    "destinationAquariumId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingObservation" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cohortId" TEXT,
    "aquariumId" TEXT,
    "observationType" "BreedingObservationType" NOT NULL DEFAULT 'GENERAL',
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "notes" TEXT NOT NULL,
    "conditionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingTraitObservation" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "observationId" TEXT,
    "speciesTraitId" TEXT,
    "traitName" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "confidence" "BreedingTraitConfidence" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingTraitObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingGoal" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingMeasurement" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cohortId" TEXT,
    "observationId" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingPhoto" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "observationId" TEXT,
    "mediaAssetId" TEXT NOT NULL,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreedingPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingMilestone" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cohortId" TEXT,
    "observationId" TEXT,
    "title" TEXT NOT NULL,
    "milestoneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingSummary" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "outcomes" TEXT,
    "goalsAchieved" TEXT,
    "improvements" TEXT,
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpeciesTrait_speciesDefinitionId_sortOrder_idx" ON "SpeciesTrait"("speciesDefinitionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesTrait_collectionId_speciesDefinitionId_name_key" ON "SpeciesTrait"("collectionId", "speciesDefinitionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingProject_workflowRunId_key" ON "BreedingProject"("workflowRunId");

-- CreateIndex
CREATE INDEX "BreedingProject_collectionId_status_startedAt_idx" ON "BreedingProject"("collectionId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "BreedingProject_speciesDefinitionId_idx" ON "BreedingProject"("speciesDefinitionId");

-- CreateIndex
CREATE INDEX "BreedingProject_aquariumId_idx" ON "BreedingProject"("aquariumId");

-- CreateIndex
CREATE INDEX "BreedingParent_projectId_role_idx" ON "BreedingParent"("projectId", "role");

-- CreateIndex
CREATE INDEX "BreedingParent_aquariumItemId_idx" ON "BreedingParent"("aquariumItemId");

-- CreateIndex
CREATE INDEX "BreedingCohort_projectId_stage_idx" ON "BreedingCohort"("projectId", "stage");

-- CreateIndex
CREATE INDEX "BreedingCohort_destinationAquariumId_idx" ON "BreedingCohort"("destinationAquariumId");

-- CreateIndex
CREATE INDEX "BreedingObservation_projectId_observedAt_idx" ON "BreedingObservation"("projectId", "observedAt");

-- CreateIndex
CREATE INDEX "BreedingObservation_cohortId_observedAt_idx" ON "BreedingObservation"("cohortId", "observedAt");

-- CreateIndex
CREATE INDEX "BreedingObservation_aquariumId_observedAt_idx" ON "BreedingObservation"("aquariumId", "observedAt");

-- CreateIndex
CREATE INDEX "BreedingObservation_conditionId_idx" ON "BreedingObservation"("conditionId");

-- CreateIndex
CREATE INDEX "BreedingTraitObservation_projectId_observedAt_idx" ON "BreedingTraitObservation"("projectId", "observedAt");

-- CreateIndex
CREATE INDEX "BreedingTraitObservation_speciesTraitId_idx" ON "BreedingTraitObservation"("speciesTraitId");

-- CreateIndex
CREATE INDEX "BreedingGoal_projectId_status_idx" ON "BreedingGoal"("projectId", "status");

-- CreateIndex
CREATE INDEX "BreedingMeasurement_projectId_metric_measuredAt_idx" ON "BreedingMeasurement"("projectId", "metric", "measuredAt");

-- CreateIndex
CREATE INDEX "BreedingMeasurement_cohortId_measuredAt_idx" ON "BreedingMeasurement"("cohortId", "measuredAt");

-- CreateIndex
CREATE INDEX "BreedingPhoto_projectId_createdAt_idx" ON "BreedingPhoto"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "BreedingPhoto_observationId_idx" ON "BreedingPhoto"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingPhoto_projectId_mediaAssetId_key" ON "BreedingPhoto"("projectId", "mediaAssetId");

-- CreateIndex
CREATE INDEX "BreedingMilestone_projectId_milestoneAt_idx" ON "BreedingMilestone"("projectId", "milestoneAt");

-- CreateIndex
CREATE INDEX "BreedingMilestone_cohortId_milestoneAt_idx" ON "BreedingMilestone"("cohortId", "milestoneAt");

-- CreateIndex
CREATE INDEX "BreedingSummary_projectId_createdAt_idx" ON "BreedingSummary"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AquariumItem_originBreedingProjectId_idx" ON "AquariumItem"("originBreedingProjectId");

-- CreateIndex
CREATE INDEX "AquariumItem_originBreedingCohortId_idx" ON "AquariumItem"("originBreedingCohortId");

-- CreateIndex
CREATE INDEX "AquariumEvent_breedingProjectId_idx" ON "AquariumEvent"("breedingProjectId");

-- CreateIndex
CREATE INDEX "AquariumEvent_breedingCohortId_idx" ON "AquariumEvent"("breedingCohortId");

-- CreateIndex
CREATE INDEX "AquariumEvent_breedingObservationId_idx" ON "AquariumEvent"("breedingObservationId");

-- CreateIndex
CREATE INDEX "CareTask_breedingProjectId_status_dueAt_idx" ON "CareTask"("breedingProjectId", "status", "dueAt");

-- AddForeignKey
ALTER TABLE "AquariumItem" ADD CONSTRAINT "AquariumItem_originBreedingProjectId_fkey" FOREIGN KEY ("originBreedingProjectId") REFERENCES "BreedingProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquariumItem" ADD CONSTRAINT "AquariumItem_originBreedingCohortId_fkey" FOREIGN KEY ("originBreedingCohortId") REFERENCES "BreedingCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesTrait" ADD CONSTRAINT "SpeciesTrait_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesTrait" ADD CONSTRAINT "SpeciesTrait_speciesDefinitionId_fkey" FOREIGN KEY ("speciesDefinitionId") REFERENCES "SpeciesDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingProject" ADD CONSTRAINT "BreedingProject_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingProject" ADD CONSTRAINT "BreedingProject_speciesDefinitionId_fkey" FOREIGN KEY ("speciesDefinitionId") REFERENCES "SpeciesDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingProject" ADD CONSTRAINT "BreedingProject_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingProject" ADD CONSTRAINT "BreedingProject_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingProject" ADD CONSTRAINT "BreedingProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingProject" ADD CONSTRAINT "BreedingProject_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingParent" ADD CONSTRAINT "BreedingParent_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingParent" ADD CONSTRAINT "BreedingParent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BreedingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingParent" ADD CONSTRAINT "BreedingParent_aquariumItemId_fkey" FOREIGN KEY ("aquariumItemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingCohort" ADD CONSTRAINT "BreedingCohort_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingCohort" ADD CONSTRAINT "BreedingCohort_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BreedingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingCohort" ADD CONSTRAINT "BreedingCohort_destinationAquariumId_fkey" FOREIGN KEY ("destinationAquariumId") REFERENCES "Aquarium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingObservation" ADD CONSTRAINT "BreedingObservation_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingObservation" ADD CONSTRAINT "BreedingObservation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BreedingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingObservation" ADD CONSTRAINT "BreedingObservation_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "BreedingCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingObservation" ADD CONSTRAINT "BreedingObservation_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingObservation" ADD CONSTRAINT "BreedingObservation_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "HealthCondition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingObservation" ADD CONSTRAINT "BreedingObservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingTraitObservation" ADD CONSTRAINT "BreedingTraitObservation_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingTraitObservation" ADD CONSTRAINT "BreedingTraitObservation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BreedingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingTraitObservation" ADD CONSTRAINT "BreedingTraitObservation_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "BreedingObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingTraitObservation" ADD CONSTRAINT "BreedingTraitObservation_speciesTraitId_fkey" FOREIGN KEY ("speciesTraitId") REFERENCES "SpeciesTrait"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingGoal" ADD CONSTRAINT "BreedingGoal_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingGoal" ADD CONSTRAINT "BreedingGoal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BreedingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingMeasurement" ADD CONSTRAINT "BreedingMeasurement_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingMeasurement" ADD CONSTRAINT "BreedingMeasurement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BreedingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingMeasurement" ADD CONSTRAINT "BreedingMeasurement_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "BreedingCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingMeasurement" ADD CONSTRAINT "BreedingMeasurement_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "BreedingObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPhoto" ADD CONSTRAINT "BreedingPhoto_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPhoto" ADD CONSTRAINT "BreedingPhoto_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BreedingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPhoto" ADD CONSTRAINT "BreedingPhoto_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "BreedingObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPhoto" ADD CONSTRAINT "BreedingPhoto_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingMilestone" ADD CONSTRAINT "BreedingMilestone_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingMilestone" ADD CONSTRAINT "BreedingMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BreedingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingMilestone" ADD CONSTRAINT "BreedingMilestone_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "BreedingCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingMilestone" ADD CONSTRAINT "BreedingMilestone_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "BreedingObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingSummary" ADD CONSTRAINT "BreedingSummary_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingSummary" ADD CONSTRAINT "BreedingSummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BreedingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingSummary" ADD CONSTRAINT "BreedingSummary_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquariumEvent" ADD CONSTRAINT "AquariumEvent_breedingProjectId_fkey" FOREIGN KEY ("breedingProjectId") REFERENCES "BreedingProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquariumEvent" ADD CONSTRAINT "AquariumEvent_breedingCohortId_fkey" FOREIGN KEY ("breedingCohortId") REFERENCES "BreedingCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquariumEvent" ADD CONSTRAINT "AquariumEvent_breedingObservationId_fkey" FOREIGN KEY ("breedingObservationId") REFERENCES "BreedingObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareTask" ADD CONSTRAINT "CareTask_breedingProjectId_fkey" FOREIGN KEY ("breedingProjectId") REFERENCES "BreedingProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

