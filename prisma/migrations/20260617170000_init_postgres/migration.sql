-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TankType" AS ENUM ('FRESHWATER', 'BRACKISH', 'SALTWATER', 'POND', 'QUARANTINE', 'GROWOUT', 'OTHER');

-- CreateEnum
CREATE TYPE "AquariumStatus" AS ENUM ('ACTIVE', 'PLANNING', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SpeciesCategory" AS ENUM ('FISH', 'INVERT', 'PLANT', 'CORAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('FISH', 'INVERT', 'PLANT', 'HARDSCAPE', 'EQUIPMENT', 'BOTANICAL', 'FOOD', 'MEDICATION', 'ADDITIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "AquariumItemStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'CONSUMED', 'DEAD', 'REMOVED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('HEATER', 'LIGHT', 'FILTER', 'PUMP', 'AIR_PUMP', 'CO2', 'SENSOR', 'CONTROLLER', 'DOSER', 'OTHER');

-- CreateEnum
CREATE TYPE "AquariumEventType" AS ENUM ('NOTE', 'FEEDING', 'WATER_CHANGE', 'TEST_RESULT', 'MAINTENANCE', 'MEDICATION', 'STOCKING', 'DEATH', 'SPAWN', 'PHOTO', 'EQUIPMENT_CHANGE', 'TRANSFER', 'AUDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "WaterParameter" AS ENUM ('TEMPERATURE', 'PH', 'AMMONIA', 'NITRITE', 'NITRATE', 'GH', 'KH', 'TDS', 'TURBIDITY', 'LIGHT', 'WATER_LEVEL', 'OTHER');

-- CreateEnum
CREATE TYPE "ReadingSource" AS ENUM ('MANUAL', 'SENSOR', 'PROMETHEUS', 'IMPORTED');

-- CreateEnum
CREATE TYPE "SensorDeviceType" AS ENUM ('RASPBERRY_PI', 'PICO', 'ESP32', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SensorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR', 'RETIRED');

-- CreateEnum
CREATE TYPE "WorkflowCategory" AS ENUM ('MAINTENANCE', 'QUARANTINE', 'MEDICATION', 'BREEDING', 'CYCLING', 'ACCLIMATION', 'VACATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WorkflowStepType" AS ENUM ('TASK', 'CHECK', 'INPUT', 'DECISION', 'WAIT', 'LOG_EVENT');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'PAUSED');

-- CreateEnum
CREATE TYPE "WorkflowStepRunStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AiSuggestionType" AS ENUM ('TANK_NAME', 'COVER_CARD', 'CARE_ADVICE', 'WORKFLOW', 'STOCKING', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aquarium" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "generatedName" TEXT,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "tankType" "TankType" NOT NULL,
    "volumeGallons" DOUBLE PRECISION,
    "lengthInches" DOUBLE PRECISION,
    "widthInches" DOUBLE PRECISION,
    "heightInches" DOUBLE PRECISION,
    "location" TEXT,
    "status" "AquariumStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3),
    "notes" TEXT,
    "coverImageUrl" TEXT,
    "coverCardStyle" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aquarium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquariumProfile" (
    "id" TEXT NOT NULL,
    "aquariumId" TEXT NOT NULL,
    "substrate" TEXT,
    "lightingType" TEXT,
    "lightingSchedule" TEXT,
    "filtration" TEXT,
    "heating" TEXT,
    "co2" TEXT,
    "waterSource" TEXT,
    "targetTemperature" DOUBLE PRECISION,
    "targetPh" DOUBLE PRECISION,
    "targetGh" DOUBLE PRECISION,
    "targetKh" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "AquariumProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeciesDefinition" (
    "id" TEXT NOT NULL,
    "category" "SpeciesCategory" NOT NULL,
    "commonName" TEXT NOT NULL,
    "scientificName" TEXT,
    "genus" TEXT,
    "species" TEXT,
    "variety" TEXT,
    "cultivar" TEXT,
    "notes" TEXT,
    "careNotes" TEXT,
    "tempMin" DOUBLE PRECISION,
    "tempMax" DOUBLE PRECISION,
    "phMin" DOUBLE PRECISION,
    "phMax" DOUBLE PRECISION,
    "ghMin" DOUBLE PRECISION,
    "ghMax" DOUBLE PRECISION,
    "khMin" DOUBLE PRECISION,
    "khMax" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpeciesDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquariumItem" (
    "id" TEXT NOT NULL,
    "aquariumId" TEXT,
    "collectionId" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "speciesDefinitionId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT,
    "status" "AquariumItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "acquiredFrom" TEXT,
    "acquiredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AquariumItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemTransfer" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fromAquariumId" TEXT,
    "toAquariumId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,

    CONSTRAINT "ItemTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentProfile" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "equipmentType" "EquipmentType" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "warrantyUntil" TIMESTAMP(3),
    "maintenanceIntervalDays" INTEGER,
    "lastMaintainedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "EquipmentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquariumEvent" (
    "id" TEXT NOT NULL,
    "aquariumId" TEXT NOT NULL,
    "eventType" "AquariumEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "notes" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AquariumEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterParameterReading" (
    "id" TEXT NOT NULL,
    "aquariumId" TEXT NOT NULL,
    "parameter" "WaterParameter" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "source" "ReadingSource" NOT NULL DEFAULT 'MANUAL',
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "WaterParameterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorDevice" (
    "id" TEXT NOT NULL,
    "aquariumId" TEXT,
    "name" TEXT NOT NULL,
    "deviceType" "SensorDeviceType" NOT NULL,
    "status" "SensorStatus" NOT NULL DEFAULT 'ACTIVE',
    "prometheusJob" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SensorDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorChannel" (
    "id" TEXT NOT NULL,
    "sensorDeviceId" TEXT NOT NULL,
    "parameter" "WaterParameter" NOT NULL,
    "displayName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "prometheusMetricName" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SensorChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "WorkflowCategory" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowTemplateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "stepType" "WorkflowStepType" NOT NULL,
    "config" JSONB,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "workflowTemplateId" TEXT NOT NULL,
    "aquariumId" TEXT NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStepRun" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "workflowStepId" TEXT NOT NULL,
    "status" "WorkflowStepRunStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "WorkflowStepRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSuggestion" (
    "id" TEXT NOT NULL,
    "aquariumId" TEXT,
    "suggestionType" "AiSuggestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrCode" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Aquarium_slug_key" ON "Aquarium"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AquariumProfile_aquariumId_key" ON "AquariumProfile"("aquariumId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentProfile_itemId_key" ON "EquipmentProfile"("itemId");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aquarium" ADD CONSTRAINT "Aquarium_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquariumProfile" ADD CONSTRAINT "AquariumProfile_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquariumItem" ADD CONSTRAINT "AquariumItem_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquariumItem" ADD CONSTRAINT "AquariumItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquariumItem" ADD CONSTRAINT "AquariumItem_speciesDefinitionId_fkey" FOREIGN KEY ("speciesDefinitionId") REFERENCES "SpeciesDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTransfer" ADD CONSTRAINT "ItemTransfer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AquariumItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTransfer" ADD CONSTRAINT "ItemTransfer_fromAquariumId_fkey" FOREIGN KEY ("fromAquariumId") REFERENCES "Aquarium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTransfer" ADD CONSTRAINT "ItemTransfer_toAquariumId_fkey" FOREIGN KEY ("toAquariumId") REFERENCES "Aquarium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTransfer" ADD CONSTRAINT "ItemTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentProfile" ADD CONSTRAINT "EquipmentProfile_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AquariumItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquariumEvent" ADD CONSTRAINT "AquariumEvent_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquariumEvent" ADD CONSTRAINT "AquariumEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterParameterReading" ADD CONSTRAINT "WaterParameterReading_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorDevice" ADD CONSTRAINT "SensorDevice_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorChannel" ADD CONSTRAINT "SensorChannel_sensorDeviceId_fkey" FOREIGN KEY ("sensorDeviceId") REFERENCES "SensorDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowTemplateId_fkey" FOREIGN KEY ("workflowTemplateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowTemplateId_fkey" FOREIGN KEY ("workflowTemplateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStepRun" ADD CONSTRAINT "WorkflowStepRun_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStepRun" ADD CONSTRAINT "WorkflowStepRun_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

