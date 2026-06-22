ALTER TYPE "AquariumEventType" ADD VALUE IF NOT EXISTS 'CONDITION_CREATED';
ALTER TYPE "AquariumEventType" ADD VALUE IF NOT EXISTS 'CONDITION_OBSERVATION';
ALTER TYPE "AquariumEventType" ADD VALUE IF NOT EXISTS 'CONDITION_STATUS_CHANGED';
ALTER TYPE "AquariumEventType" ADD VALUE IF NOT EXISTS 'CONDITION_RESOLVED';
ALTER TYPE "AquariumEventType" ADD VALUE IF NOT EXISTS 'CONDITION_LINKED_MEDICATION';
ALTER TYPE "AquariumEventType" ADD VALUE IF NOT EXISTS 'EQUIPMENT_ISSUE_LOGGED';
ALTER TYPE "CareScheduleType" ADD VALUE IF NOT EXISTS 'CONDITION_CHECK';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONDITION_FOLLOW_UP';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONDITION_CRITICAL_ALERT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONDITION_WORSENING_ALERT';

CREATE TYPE "CareTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "HealthConditionEntityType" AS ENUM ('AQUARIUM', 'INVENTORY_ITEM', 'SPECIES', 'EQUIPMENT', 'PLANT', 'FISH', 'INVERT', 'CORAL', 'SYSTEM', 'OTHER');
CREATE TYPE "HealthConditionCategory" AS ENUM ('WATER_QUALITY', 'ALGAE', 'DISEASE', 'PARASITE', 'PLANT_HEALTH', 'BEHAVIOR', 'INJURY', 'EQUIPMENT', 'MAINTENANCE', 'UNKNOWN', 'OTHER');
CREATE TYPE "HealthConditionStatus" AS ENUM ('WATCHING', 'ACTIVE', 'TREATING', 'IMPROVING', 'WORSENING', 'RESOLVED', 'ARCHIVED');
CREATE TYPE "HealthConditionSeverity" AS ENUM ('INFO', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL');
CREATE TYPE "HealthConditionLinkedEntityType" AS ENUM ('AQUARIUM', 'INVENTORY_ITEM', 'EQUIPMENT', 'SPECIES', 'MEDICATION_COURSE', 'TIMELINE_EVENT', 'CARE_TASK', 'MEDIA_ASSET');
CREATE TYPE "HealthConditionRelationship" AS ENUM ('AFFECTS', 'RELATED_TO', 'TREATED_BY', 'OBSERVED_IN', 'CAUSED_BY', 'PHOTO', 'FOLLOW_UP');

CREATE TABLE "HealthCondition" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "aquariumId" TEXT,
  "entityType" "HealthConditionEntityType" NOT NULL,
  "entityId" TEXT,
  "title" TEXT NOT NULL,
  "conditionType" TEXT NOT NULL,
  "category" "HealthConditionCategory" NOT NULL,
  "status" "HealthConditionStatus" NOT NULL DEFAULT 'ACTIVE',
  "severity" "HealthConditionSeverity" NOT NULL DEFAULT 'MODERATE',
  "firstObservedAt" TIMESTAMP(3) NOT NULL,
  "lastObservedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "affectedCount" DOUBLE PRECISION,
  "affectedCountLabel" TEXT,
  "summary" TEXT,
  "suspectedCause" TEXT,
  "actionPlan" TEXT,
  "resolutionNotes" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HealthCondition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HealthConditionObservation" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "conditionId" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "status" "HealthConditionStatus",
  "severity" "HealthConditionSeverity",
  "affectedCount" DOUBLE PRECISION,
  "notes" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HealthConditionObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HealthConditionLink" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "conditionId" TEXT NOT NULL,
  "linkedEntityType" "HealthConditionLinkedEntityType" NOT NULL,
  "linkedEntityId" TEXT NOT NULL,
  "relationship" "HealthConditionRelationship" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HealthConditionLink_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CareTask" ADD COLUMN "relatedConditionId" TEXT, ADD COLUMN "priority" "CareTaskPriority" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "MedicationCourse" ADD COLUMN "relatedConditionId" TEXT;
ALTER TABLE "AquariumEvent" ADD COLUMN "relatedConditionId" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "conditionId" TEXT;
ALTER TABLE "NotificationPreference"
  ADD COLUMN "conditionFollowUpEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "conditionFollowUpPushEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "conditionCriticalEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "conditionCriticalPushEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "conditionWorseningEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "conditionWorseningPushEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "HealthCondition_collectionId_status_severity_idx" ON "HealthCondition"("collectionId", "status", "severity");
CREATE INDEX "HealthCondition_aquariumId_status_idx" ON "HealthCondition"("aquariumId", "status");
CREATE INDEX "HealthCondition_entityType_entityId_status_idx" ON "HealthCondition"("entityType", "entityId", "status");
CREATE INDEX "HealthCondition_lastObservedAt_idx" ON "HealthCondition"("lastObservedAt");
CREATE INDEX "HealthConditionObservation_conditionId_observedAt_idx" ON "HealthConditionObservation"("conditionId", "observedAt");
CREATE INDEX "HealthConditionObservation_collectionId_createdAt_idx" ON "HealthConditionObservation"("collectionId", "createdAt");
CREATE UNIQUE INDEX "HealthConditionLink_conditionId_linkedEntityType_linkedEntityId_relationship_key" ON "HealthConditionLink"("conditionId", "linkedEntityType", "linkedEntityId", "relationship");
CREATE INDEX "HealthConditionLink_collectionId_linkedEntityType_linkedEntityId_idx" ON "HealthConditionLink"("collectionId", "linkedEntityType", "linkedEntityId");
CREATE INDEX "CareTask_relatedConditionId_status_dueAt_idx" ON "CareTask"("relatedConditionId", "status", "dueAt");
CREATE INDEX "MedicationCourse_relatedConditionId_idx" ON "MedicationCourse"("relatedConditionId");
CREATE INDEX "AquariumEvent_relatedConditionId_idx" ON "AquariumEvent"("relatedConditionId");
CREATE INDEX "MediaAsset_conditionId_createdAt_idx" ON "MediaAsset"("conditionId", "createdAt");

ALTER TABLE "HealthCondition" ADD CONSTRAINT "HealthCondition_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthCondition" ADD CONSTRAINT "HealthCondition_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HealthCondition" ADD CONSTRAINT "HealthCondition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HealthCondition" ADD CONSTRAINT "HealthCondition_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HealthConditionObservation" ADD CONSTRAINT "HealthConditionObservation_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthConditionObservation" ADD CONSTRAINT "HealthConditionObservation_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "HealthCondition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthConditionObservation" ADD CONSTRAINT "HealthConditionObservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HealthConditionLink" ADD CONSTRAINT "HealthConditionLink_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthConditionLink" ADD CONSTRAINT "HealthConditionLink_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "HealthCondition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareTask" ADD CONSTRAINT "CareTask_relatedConditionId_fkey" FOREIGN KEY ("relatedConditionId") REFERENCES "HealthCondition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MedicationCourse" ADD CONSTRAINT "MedicationCourse_relatedConditionId_fkey" FOREIGN KEY ("relatedConditionId") REFERENCES "HealthCondition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumEvent" ADD CONSTRAINT "AquariumEvent_relatedConditionId_fkey" FOREIGN KEY ("relatedConditionId") REFERENCES "HealthCondition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "HealthCondition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
