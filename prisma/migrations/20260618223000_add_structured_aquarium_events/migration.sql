-- Extend existing event enums without renaming historical values.
ALTER TYPE "AquariumEventType" ADD VALUE IF NOT EXISTS 'LIVESTOCK_ADDITION';
ALTER TYPE "AquariumEventType" ADD VALUE IF NOT EXISTS 'LIVESTOCK_LOSS';
ALTER TYPE "AquariumEventType" ADD VALUE IF NOT EXISTS 'PLANT_ADDITION';
ALTER TYPE "AquariumEventType" ADD VALUE IF NOT EXISTS 'PLANT_REMOVAL';
ALTER TYPE "AquariumEventType" ADD VALUE IF NOT EXISTS 'EQUIPMENT_MAINTENANCE';

CREATE TYPE "MaintenanceType" AS ENUM ('WATER_CHANGE', 'FILTER_SERVICE', 'GLASS_CLEANING', 'SUBSTRATE_VACUUM', 'PLANT_TRIM', 'EQUIPMENT_INSPECTION', 'DOSING', 'LIGHT_ADJUSTMENT', 'OTHER');
CREATE TYPE "MedicationType" AS ENUM ('ANTIBIOTIC', 'ANTIPARASITIC', 'ANTIFUNGAL', 'ANTISEPTIC', 'WATER_TREATMENT', 'OTHER');
CREATE TYPE "MedicationCourseStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

ALTER TABLE "AquariumEvent" ADD COLUMN "collectionId" TEXT;
ALTER TABLE "AquariumEvent" ADD COLUMN "relatedSpeciesId" TEXT;
ALTER TABLE "AquariumEvent" ADD COLUMN "relatedScheduleTaskId" TEXT;
ALTER TABLE "AquariumEvent" ADD COLUMN "relatedMedicationCourseId" TEXT;
ALTER TABLE "AquariumEvent" ADD COLUMN "metadata" JSONB;

UPDATE "AquariumEvent"
SET "collectionId" = "Aquarium"."collectionId"
FROM "Aquarium"
WHERE "AquariumEvent"."aquariumId" = "Aquarium"."id";

ALTER TABLE "AquariumEvent" ALTER COLUMN "collectionId" SET NOT NULL;

ALTER TABLE "WaterParameterReading" ADD COLUMN "aquariumEventId" TEXT;

CREATE TABLE "WaterChangeEvent" (
  "id" TEXT NOT NULL,
  "aquariumEventId" TEXT NOT NULL,
  "aquariumId" TEXT NOT NULL,
  "volumeGallons" DOUBLE PRECISION,
  "percentChanged" DOUBLE PRECISION,
  "waterSource" TEXT,
  "conditionerUsed" TEXT,
  "temperatureMatched" BOOLEAN,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WaterChangeEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedingEvent" (
  "id" TEXT NOT NULL,
  "aquariumEventId" TEXT NOT NULL,
  "aquariumId" TEXT NOT NULL,
  "foodItemId" TEXT,
  "foodNameSnapshot" TEXT,
  "amount" TEXT,
  "target" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeedingEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenanceEvent" (
  "id" TEXT NOT NULL,
  "aquariumEventId" TEXT NOT NULL,
  "aquariumId" TEXT NOT NULL,
  "maintenanceType" "MaintenanceType" NOT NULL,
  "equipmentItemId" TEXT,
  "summary" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MedicationDefinition" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "manufacturer" TEXT,
  "medicationType" "MedicationType" NOT NULL DEFAULT 'OTHER',
  "activeIngredients" TEXT,
  "concentration" TEXT,
  "defaultDoseAmount" DOUBLE PRECISION,
  "defaultDoseUnit" TEXT,
  "dosePerGallons" DOUBLE PRECISION,
  "scheduleNotes" TEXT,
  "safetyNotes" TEXT,
  "contraindications" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MedicationDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MedicationCourse" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "aquariumId" TEXT NOT NULL,
  "medicationDefinitionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "reason" TEXT,
  "tankVolumeGallons" DOUBLE PRECISION NOT NULL,
  "calculatedDoseAmount" DOUBLE PRECISION,
  "calculatedDoseUnit" TEXT,
  "doseSchedule" JSONB,
  "status" "MedicationCourseStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MedicationCourse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MedicationDoseEvent" (
  "id" TEXT NOT NULL,
  "aquariumEventId" TEXT NOT NULL,
  "medicationCourseId" TEXT NOT NULL,
  "doseAmount" DOUBLE PRECISION,
  "doseUnit" TEXT,
  "doseNumber" INTEGER,
  "dosedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MedicationDoseEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AquariumEvent_collectionId_eventDate_idx" ON "AquariumEvent"("collectionId", "eventDate");
CREATE INDEX "AquariumEvent_relatedSpeciesId_idx" ON "AquariumEvent"("relatedSpeciesId");
CREATE INDEX "AquariumEvent_relatedScheduleTaskId_idx" ON "AquariumEvent"("relatedScheduleTaskId");
CREATE INDEX "AquariumEvent_relatedMedicationCourseId_idx" ON "AquariumEvent"("relatedMedicationCourseId");
CREATE INDEX "WaterParameterReading_aquariumEventId_idx" ON "WaterParameterReading"("aquariumEventId");
CREATE UNIQUE INDEX "WaterChangeEvent_aquariumEventId_key" ON "WaterChangeEvent"("aquariumEventId");
CREATE INDEX "WaterChangeEvent_aquariumId_idx" ON "WaterChangeEvent"("aquariumId");
CREATE UNIQUE INDEX "FeedingEvent_aquariumEventId_key" ON "FeedingEvent"("aquariumEventId");
CREATE INDEX "FeedingEvent_aquariumId_idx" ON "FeedingEvent"("aquariumId");
CREATE INDEX "FeedingEvent_foodItemId_idx" ON "FeedingEvent"("foodItemId");
CREATE UNIQUE INDEX "MaintenanceEvent_aquariumEventId_key" ON "MaintenanceEvent"("aquariumEventId");
CREATE INDEX "MaintenanceEvent_aquariumId_idx" ON "MaintenanceEvent"("aquariumId");
CREATE INDEX "MaintenanceEvent_equipmentItemId_idx" ON "MaintenanceEvent"("equipmentItemId");
CREATE INDEX "MedicationDefinition_collectionId_name_idx" ON "MedicationDefinition"("collectionId", "name");
CREATE INDEX "MedicationCourse_collectionId_status_idx" ON "MedicationCourse"("collectionId", "status");
CREATE INDEX "MedicationCourse_aquariumId_status_idx" ON "MedicationCourse"("aquariumId", "status");
CREATE UNIQUE INDEX "MedicationDoseEvent_aquariumEventId_key" ON "MedicationDoseEvent"("aquariumEventId");
CREATE INDEX "MedicationDoseEvent_medicationCourseId_idx" ON "MedicationDoseEvent"("medicationCourseId");

ALTER TABLE "AquariumEvent" ADD CONSTRAINT "AquariumEvent_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumEvent" ADD CONSTRAINT "AquariumEvent_relatedSpeciesId_fkey" FOREIGN KEY ("relatedSpeciesId") REFERENCES "SpeciesDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumEvent" ADD CONSTRAINT "AquariumEvent_relatedScheduleTaskId_fkey" FOREIGN KEY ("relatedScheduleTaskId") REFERENCES "CareTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumEvent" ADD CONSTRAINT "AquariumEvent_relatedMedicationCourseId_fkey" FOREIGN KEY ("relatedMedicationCourseId") REFERENCES "MedicationCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WaterParameterReading" ADD CONSTRAINT "WaterParameterReading_aquariumEventId_fkey" FOREIGN KEY ("aquariumEventId") REFERENCES "AquariumEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WaterChangeEvent" ADD CONSTRAINT "WaterChangeEvent_aquariumEventId_fkey" FOREIGN KEY ("aquariumEventId") REFERENCES "AquariumEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaterChangeEvent" ADD CONSTRAINT "WaterChangeEvent_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedingEvent" ADD CONSTRAINT "FeedingEvent_aquariumEventId_fkey" FOREIGN KEY ("aquariumEventId") REFERENCES "AquariumEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedingEvent" ADD CONSTRAINT "FeedingEvent_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedingEvent" ADD CONSTRAINT "FeedingEvent_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceEvent" ADD CONSTRAINT "MaintenanceEvent_aquariumEventId_fkey" FOREIGN KEY ("aquariumEventId") REFERENCES "AquariumEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceEvent" ADD CONSTRAINT "MaintenanceEvent_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceEvent" ADD CONSTRAINT "MaintenanceEvent_equipmentItemId_fkey" FOREIGN KEY ("equipmentItemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MedicationDefinition" ADD CONSTRAINT "MedicationDefinition_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicationCourse" ADD CONSTRAINT "MedicationCourse_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicationCourse" ADD CONSTRAINT "MedicationCourse_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicationCourse" ADD CONSTRAINT "MedicationCourse_medicationDefinitionId_fkey" FOREIGN KEY ("medicationDefinitionId") REFERENCES "MedicationDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicationDoseEvent" ADD CONSTRAINT "MedicationDoseEvent_aquariumEventId_fkey" FOREIGN KEY ("aquariumEventId") REFERENCES "AquariumEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicationDoseEvent" ADD CONSTRAINT "MedicationDoseEvent_medicationCourseId_fkey" FOREIGN KEY ("medicationCourseId") REFERENCES "MedicationCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
